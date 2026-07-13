/**
 * Server-only Wiki Weaver — direct-REST port of
 * ado_copilot_workitem_doc_generator.py. Climbs a User Story/Feature/Epic to
 * its top-level parent, reads that parent's description/acceptance
 * criteria/comments/attached .docx design docs, walks the hierarchy beneath
 * the resolved scope root (falling back to an area-path query when no
 * hierarchy children exist), inlines linked PR metadata for leaf items, then
 * makes a single Copilot chat call to generate one business+tech wiki page
 * and publishes it to Azure DevOps Wiki.
 */

import { runCopilotChat } from "@/lib/copilot";
import { extractDocxText } from "@/lib/docx";
import { adoTarget, parseWorkItemId } from "@/lib/ado";
import {
  addWorkItemComment,
  downloadAttachment,
  getLatestPrIterationId,
  getPrChangedFiles,
  getPullRequestRecord,
  getWorkItemComments,
  getWorkItemRecord,
  loadPrFileContexts,
  queryWiql,
  workItemIdFromRelationUrl,
  type ChangedFile,
  type WorkItemRecord,
} from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";

type EmitFn = (line: string) => void;

const TOP_LEVEL_TYPES = new Set(["epic"]);
const LEAF_TYPES = new Set(["user story", "bug"]);
const HIERARCHY_FORWARD = "System.LinkTypes.Hierarchy-Forward";
const HIERARCHY_REVERSE = "System.LinkTypes.Hierarchy-Reverse";
const WIKI_API_VERSION = "7.1-preview.1";

const DEFAULT_WIKI_IDENTIFIER = "Digital X.wiki";
const DEFAULT_WIKI_PARENT_PATH = "/Digital";
const DEFAULT_WIKI_PARENT_URL = "https://dev.azure.com/vfuk-digital/Digital/_wiki/wikis/Digital%20X.wiki/80/Digital";

const PR_ARTIFACT_PATTERN = /vstfs:\/\/\/Git\/PullRequestId\/([^/%]+)\/([^/%]+)\/(\d+)/i;

/** Caps on how much PR code evidence gets pulled into the prompt — enough to
 * ground technical sections and code snippets in real diffs without blowing
 * up the context. A Copilot chat request has a hard prompt-token ceiling
 * (observed: 64k tokens), so on a scope with many linked PRs we can only
 * afford to pull full diffs for a relevant subset — see selectCodeEvidence. */
const MAX_DIFF_FILES_PER_PR = 5;
const MAX_DIFF_CHARS_PER_FILE = 4_000;
const MAX_PRS_WITH_CODE = 6;
const TOTAL_DIFF_CHAR_BUDGET = 45_000;

type CodeExcerpt = { path: string; diff: string };
type LinkedPrInfo = {
  title?: string;
  description?: string;
  files?: string[];
  url?: string;
  codeExcerpts?: CodeExcerpt[];
  /** Internal — used only by selectCodeEvidence to fetch diffs for the chosen subset; never read by buildContextMessage directly. */
  _repoId?: string;
  _prId?: number;
  _sourceCommit?: string;
  _targetCommit?: string;
  _changedFiles?: ChangedFile[];
};
type WikiWorkItem = {
  id: number;
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  areaPath: string;
  url: string;
  comments: string[];
  attachmentsText: string[];
  linkedPrs: LinkedPrInfo[];
};

// --- path/url helpers -----------------------------------------------------------

function normalizeWikiPath(value: string, defaultPath = DEFAULT_WIKI_PARENT_PATH): string {
  const raw = (value ?? "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return defaultPath;
  const parts = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? "/" + parts.join("/") : defaultPath;
}

function parseWikiParentReference(value: string): { wikiIdentifier: string; parentPath: string } {
  const raw = (value ?? "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return { wikiIdentifier: DEFAULT_WIKI_IDENTIFIER, parentPath: DEFAULT_WIKI_PARENT_PATH };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { wikiIdentifier: DEFAULT_WIKI_IDENTIFIER, parentPath: normalizeWikiPath(raw) };
  }

  const pagePath = url.searchParams.get("pagePath") ?? url.searchParams.get("pagepath") ?? "";
  const segments = url.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  const lowerSegments = segments.map((s) => s.toLowerCase());

  let wikiIdentifier = DEFAULT_WIKI_IDENTIFIER;
  let resolvedPath = pagePath;
  const wikiIndex = lowerSegments.indexOf("wikis");
  if (wikiIndex >= 0) {
    if (segments.length > wikiIndex + 1) wikiIdentifier = segments[wikiIndex + 1];
    if (!resolvedPath) {
      let remaining = segments.slice(wikiIndex + 2);
      if (remaining.length && /^\d+$/.test(remaining[0])) remaining = remaining.slice(1);
      resolvedPath = remaining.length ? "/" + remaining.join("/") : DEFAULT_WIKI_PARENT_PATH;
    }
  }

  if (!resolvedPath) {
    throw new Error(
      `Could not resolve wiki parent path from the provided URL. Provide an Azure DevOps wiki page URL such as ${DEFAULT_WIKI_PARENT_URL}`,
    );
  }
  return { wikiIdentifier, parentPath: normalizeWikiPath(resolvedPath) };
}

function sanitizeWikiPageSegment(value: string, maxLength = 150): string {
  let text = (value ?? "").replace(/\\/g, "-").replace(/\//g, "-");
  text = text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/[<>:"|?*#%{}~&]+/g, "-");
  text = text.replace(/-{2,}/g, "-").replace(/^[\s.-]+|[\s.-]+$/g, "");
  if (text.length > maxLength) text = text.slice(0, maxLength).replace(/[\s.-]+$/g, "");
  return text || "Untitled";
}

function buildGeneratedWikiChildPath(parentPath: string, rootType: string, rootId: number, rootTitle: string): string {
  const parent = normalizeWikiPath(parentPath).replace(/\/$/, "");
  const childTitle = sanitizeWikiPageSegment(`${rootType} ${rootId} - ${rootTitle}`);
  return parent ? `${parent}/${childTitle}` : `/${childTitle}`;
}

function encodeWikiPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function buildWikiPageUrl(org: string, project: string, wikiIdentifier: string, pagePath: string): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_wiki/wikis/` +
    `${encodeURIComponent(wikiIdentifier)}?pagePath=${encodeWikiPath(pagePath)}`
  );
}

/** Resolve the target wiki + page path/URL for a draft — pure, no I/O. Shared by the draft preview, the exists-check, and the actual publish. */
function resolveWikiTarget(
  org: string,
  project: string,
  rootType: string,
  rootId: number,
  rootTitle: string,
  wikiParentUrl: string,
): { wikiIdentifier: string; path: string; url: string; title: string } {
  const { wikiIdentifier, parentPath } = parseWikiParentReference(wikiParentUrl);
  const path = buildGeneratedWikiChildPath(parentPath, rootType, rootId, rootTitle);
  return {
    wikiIdentifier,
    path,
    url: buildWikiPageUrl(org, project, wikiIdentifier, path),
    title: `${rootType} ${rootId}: ${rootTitle}`,
  };
}

// --- ADO wiki REST (not shared elsewhere, kept local to this capability) --------

function wikiPagesUrl(org: string, project: string, wikiIdentifier: string, path: string): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wiki/wikis/` +
    `${encodeURIComponent(wikiIdentifier)}/pages?path=${encodeURIComponent(path)}&api-version=${WIKI_API_VERSION}`
  );
}

async function getWikiPageEtag(org: string, project: string, wikiIdentifier: string, path: string, auth: string): Promise<string | null> {
  const url = wikiPagesUrl(org, project, wikiIdentifier, path);
  const res = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" }, cache: "no-store" });
  if (res.status === 404) return null;
  if (res.url.includes("visualstudio.com/_signin")) {
    throw new Error(`Azure DevOps rejected the request's credentials (redirected to sign-in) for ${url}.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADO wiki page lookup failed (${res.status}) for ${url}: ${text.slice(0, 300)}`);
  }
  return res.headers.get("etag");
}

async function putWikiPage(
  org: string,
  project: string,
  wikiIdentifier: string,
  path: string,
  content: string,
  etag: string | null,
  auth: string,
): Promise<void> {
  const url = wikiPagesUrl(org, project, wikiIdentifier, path);
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
    body: JSON.stringify({ content }),
  });
  if (res.url.includes("visualstudio.com/_signin")) {
    throw new Error(`Azure DevOps rejected the request's credentials (redirected to sign-in) for ${url}.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADO wiki page publish failed (${res.status}) for ${url}: ${text.slice(0, 300)}`);
  }
}

async function publishWikiPage(
  org: string,
  project: string,
  rootType: string,
  rootId: number,
  rootTitle: string,
  content: string,
  wikiParentUrl: string,
  auth: string,
): Promise<{ title: string; url: string }> {
  const { wikiIdentifier, path, url, title } = resolveWikiTarget(org, project, rootType, rootId, rootTitle, wikiParentUrl);
  const etag = await getWikiPageEtag(org, project, wikiIdentifier, path, auth);
  await putWikiPage(org, project, wikiIdentifier, path, content, etag, auth);
  return { title, url };
}

/**
 * Check whether a page already exists at the target path without writing
 * anything — used by the publish route to ask the user for confirmation
 * before silently overwriting an existing page.
 */
export async function checkWikiPageExists(
  input: { rootType: string; rootId: number; rootTitle: string; wikiParentUrl: string },
  adoAuth: string,
): Promise<{ exists: boolean; url: string }> {
  const { org, project } = adoTarget();
  const { wikiIdentifier, path, url } = resolveWikiTarget(org, project, input.rootType, input.rootId, input.rootTitle, input.wikiParentUrl);
  const etag = await getWikiPageEtag(org, project, wikiIdentifier, path, adoAuth);
  return { exists: etag !== null, url };
}

// --- hierarchy gathering ---------------------------------------------------------

async function climbToTopParent(start: WorkItemRecord, auth: string): Promise<WorkItemRecord> {
  let current = start;
  while (!TOP_LEVEL_TYPES.has(current.type.trim().toLowerCase())) {
    const parentRelation = current.relations.find((r) => r.rel === HIERARCHY_REVERSE);
    if (!parentRelation) break;
    const parentId = workItemIdFromRelationUrl(parentRelation.url ?? "");
    if (!parentId) break;
    current = await getWorkItemRecord(parentId, auth, true);
  }
  return current;
}

async function resolveScopeRoot(topParent: WorkItemRecord, original: WorkItemRecord, docLevel: string, auth: string): Promise<WorkItemRecord> {
  if (topParent.type.trim().toLowerCase() !== "epic") return topParent;
  if (docLevel !== "feature") return topParent;

  let current = original;
  while (current.type.trim().toLowerCase() !== "feature") {
    const parentRelation = current.relations.find((r) => r.rel === HIERARCHY_REVERSE);
    if (!parentRelation) return topParent;
    const parentId = workItemIdFromRelationUrl(parentRelation.url ?? "");
    if (!parentId) return topParent;
    current = await getWorkItemRecord(parentId, auth, true);
  }
  return current;
}

function getChildWorkItemIds(record: WorkItemRecord): number[] {
  const ids: number[] = [];
  for (const relation of record.relations) {
    if (relation.rel !== HIERARCHY_FORWARD) continue;
    const id = workItemIdFromRelationUrl(relation.url ?? "");
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function toWikiWorkItem(record: WorkItemRecord, org: string, project: string, docType: string, auth: string): Promise<WikiWorkItem> {
  const url = `https://dev.azure.com/${org}/${project}/_workitems/edit/${record.id}`;
  const comments = (await getWorkItemComments(record.id, auth))
    .filter((c) => !c.isDeleted)
    .map((c) => c.text)
    .filter(Boolean);

  const attachmentsText: string[] = [];
  for (const relation of record.relations) {
    if (String(relation.rel ?? "").trim() !== "AttachedFile") continue;
    const attrs = (relation.attributes as Record<string, unknown> | undefined) ?? {};
    const filename = String(attrs.name ?? "").trim();
    if (!filename.toLowerCase().endsWith(".docx")) continue;
    if (!relation.url) {
      attachmentsText.push(`[${filename || "attachment"}: missing attachment URL — skipped]`);
      continue;
    }
    try {
      const bytes = await downloadAttachment(relation.url, auth);
      const text = await extractDocxText(bytes);
      attachmentsText.push(text || `[${filename}: valid .docx but no readable text found]`);
    } catch (ex) {
      attachmentsText.push(`[${filename}: attachment download failed (${ex instanceof Error ? ex.message : ex}) — skipped]`);
    }
  }

  // Only metadata (title/description/changed-file list) is gathered here —
  // fetching real diffs for every linked PR on every leaf item does not fit
  // a 64k-token prompt budget once a scope has more than a handful of PRs.
  // Diffs are fetched afterwards, only for the most relevant subset, by
  // selectCodeEvidence once the full hierarchy (and its title context) is known.
  const linkedPrs: LinkedPrInfo[] = [];
  if (LEAF_TYPES.has(record.type.trim().toLowerCase())) {
    for (const relation of record.relations) {
      const rel = String(relation.rel ?? "");
      const decodedUrl = decodeURIComponent(relation.url ?? "");
      if (rel !== "ArtifactLink" || !decodedUrl.includes("PullRequestId")) continue;
      const match = decodedUrl.match(PR_ARTIFACT_PATTERN);
      if (!match) continue;
      const repoId = match[2];
      const prId = Number(match[3]);
      try {
        const pr = await getPullRequestRecord(repoId, prId, auth);
        const iterationId = await getLatestPrIterationId(repoId, prId, auth);
        const changedFiles = docType !== "business" ? await getPrChangedFiles(repoId, prId, iterationId, auth) : [];
        const files = changedFiles.map((f) => f.path);

        linkedPrs.push({
          title: pr.title,
          description: pr.description,
          files,
          url: pr.webUrl,
          _repoId: repoId,
          _prId: prId,
          _sourceCommit: pr.sourceCommit,
          _targetCommit: pr.targetCommit,
          _changedFiles: changedFiles,
        });
      } catch {
        continue;
      }
    }
  }

  return {
    id: record.id,
    type: record.type,
    title: record.title,
    description: record.description,
    acceptanceCriteria: record.acceptanceCriteria,
    areaPath: record.areaPath,
    url,
    comments,
    attachmentsText,
    linkedPrs,
  };
}

async function gatherHierarchy(
  scopeRoot: WorkItemRecord,
  org: string,
  project: string,
  docType: string,
  auth: string,
  emit: EmitFn,
): Promise<WikiWorkItem[]> {
  const rootWi = await toWikiWorkItem(scopeRoot, org, project, docType, auth);
  const items: WikiWorkItem[] = [rootWi];
  const seenIds = new Set<number>([rootWi.id]);
  const queue: number[] = getChildWorkItemIds(scopeRoot);

  while (queue.length) {
    const childId = queue.shift()!;
    if (seenIds.has(childId)) continue;
    let raw: WorkItemRecord;
    try {
      raw = await getWorkItemRecord(childId, auth, true);
    } catch {
      continue;
    }
    seenIds.add(childId);
    items.push(await toWikiWorkItem(raw, org, project, docType, auth));
    for (const grandchildId of getChildWorkItemIds(raw)) {
      if (!seenIds.has(grandchildId) && !queue.includes(grandchildId)) queue.push(grandchildId);
    }
  }

  if (items.length > 1) {
    emit(`[context] gathered ${items.length} work items using hierarchy links`);
    return items;
  }

  // Compatibility fallback for work items where hierarchy relations are missing.
  const areaPath = rootWi.areaPath;
  const childTypes = scopeRoot.type.trim().toLowerCase() === "epic" ? ["Feature", "User Story", "Bug"] : ["User Story", "Bug"];
  const typesClause = childTypes.map((t) => `'${t}'`).join(", ");
  const wiql =
    `SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] = '${areaPath}' ` +
    `AND [System.WorkItemType] IN (${typesClause}) ORDER BY [System.WorkItemType], [System.Id]`;
  const childIds = await queryWiql(wiql, auth);

  for (const childId of childIds) {
    if (seenIds.has(childId)) continue;
    let raw: WorkItemRecord;
    try {
      raw = await getWorkItemRecord(childId, auth, true);
    } catch {
      continue;
    }
    seenIds.add(childId);
    items.push(await toWikiWorkItem(raw, org, project, docType, auth));
  }

  emit(`[context] hierarchy links were not available — gathered ${items.length} work item(s) using area-path fallback`);
  return items;
}

// --- relevant-PR selection --------------------------------------------------------

const RELEVANCE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "is", "are", "this",
  "that", "by", "as", "at", "from", "be", "it", "into", "not", "add", "update", "fix", "feat",
]);

function relevanceTokens(text: string): Set<string> {
  return new Set(
    (text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !RELEVANCE_STOPWORDS.has(w)),
  );
}

/** Word-overlap relevance of a PR title against the work item title it's linked to, normalized 0-1. */
function relevanceScore(itemTitle: string, prTitle: string): number {
  const a = relevanceTokens(itemTitle);
  const b = relevanceTokens(prTitle);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * Fetch real code diffs for only the most relevant subset of linked PRs
 * across the whole scope, ranked by title-overlap with their owning work
 * item and capped by both a PR count and a total character budget — a
 * scope with many linked PRs cannot fit every diff into a single Copilot
 * prompt (observed hard limit: 64k prompt tokens), so this trades completeness
 * for staying within budget, prioritizing PRs whose title most plausibly
 * matches the work item they're attached to.
 */
async function selectCodeEvidence(items: WikiWorkItem[], auth: string, emit: EmitFn): Promise<void> {
  type Candidate = { item: WikiWorkItem; pr: LinkedPrInfo; score: number };
  const candidates: Candidate[] = [];
  for (const item of items) {
    for (const pr of item.linkedPrs) {
      if (pr._repoId && pr._prId != null && pr._changedFiles?.length) {
        candidates.push({ item, pr, score: relevanceScore(item.title, pr.title ?? "") });
      }
    }
  }
  if (!candidates.length) return;

  candidates.sort((a, b) => b.score - a.score);

  const totalPrs = candidates.length;
  let budgetChars = TOTAL_DIFF_CHAR_BUDGET;
  let selected = 0;

  for (const { item, pr, score } of candidates) {
    if (selected >= MAX_PRS_WITH_CODE || budgetChars <= 0) {
      emit(`[context] skipped code diff for PR "${pr.title}" (linked to ${item.type} ${item.id}) — kept title/link only`);
      continue;
    }
    try {
      const contexts = await loadPrFileContexts(
        pr._repoId!,
        pr._prId!,
        pr._changedFiles!,
        pr._sourceCommit ?? "",
        pr._targetCommit ?? "",
        auth,
        MAX_DIFF_FILES_PER_PR,
      );
      const excerpts: CodeExcerpt[] = [];
      for (const ctx of contexts) {
        if (!ctx.text) continue;
        const clipped =
          ctx.text.length > MAX_DIFF_CHARS_PER_FILE ? ctx.text.slice(0, MAX_DIFF_CHARS_PER_FILE) + "\n... [diff truncated]" : ctx.text;
        if (clipped.length > budgetChars) break;
        excerpts.push({ path: ctx.path, diff: clipped });
        budgetChars -= clipped.length;
      }
      if (excerpts.length) {
        pr.codeExcerpts = excerpts;
        selected++;
        emit(
          `[context] pulled code diff for PR "${pr.title}" (relevance ${(score * 100).toFixed(0)}% to ${item.type} ${item.id}, ${excerpts.length} file(s))`,
        );
      }
    } catch {
      // Code evidence is a bonus for tech sections — a diff-loading failure shouldn't fail the whole run.
    }
  }

  emit(`[context] code evidence: ${selected}/${totalPrs} linked PR(s) selected within budget (most relevant by title first)`);
}

// --- Copilot prompt --------------------------------------------------------------

function buildWorkItemIndex(items: WikiWorkItem[]): string {
  const lines = ["# Source Scope Index", "", `- Total scoped work items: ${items.length}`];
  if (items.length) lines.push(`- Scope root: ${items[0].type} ${items[0].id} — ${items[0].title}`);
  lines.push("", "| Type | ID | Title |", "|---|---:|---|");
  for (const wi of items) lines.push(`| ${wi.type} | ${wi.id} | ${wi.title.replace(/\|/g, "\\|")} |`);
  return lines.join("\n");
}

function buildContextMessage(items: WikiWorkItem[]): string {
  const lines: string[] = [buildWorkItemIndex(items), "", "# Detailed Source Context"];
  for (const wi of items) {
    lines.push("", `## ${wi.type} ${wi.id}: ${wi.title}`, "", `- Source URL: ${wi.url}`, `- Area Path: ${wi.areaPath}`, "");
    lines.push("### Description", wi.description || "Not provided in the work item context.", "");
    if (wi.acceptanceCriteria) lines.push("### Acceptance Criteria", wi.acceptanceCriteria, "");
    if (wi.comments.length) {
      lines.push("### Comments / Discussion");
      for (const c of wi.comments) lines.push(`- ${c}`);
      lines.push("");
    }
    wi.attachmentsText.forEach((text, i) => {
      lines.push(`### Attached Design Doc ${i + 1}`, text || "Attachment had no readable text.", "");
    });
    for (const pr of wi.linkedPrs) {
      lines.push(`### Linked PR: ${pr.title || "(unresolved)"}`);
      if (pr.url) lines.push(`- PR URL: ${pr.url}`);
      if (pr.files?.length) {
        const shown = pr.files.slice(0, 25);
        const more = pr.files.length - shown.length;
        lines.push(`- Files changed: ${shown.join(", ")}${more > 0 ? ` … and ${more} more` : ""}`);
      }
      if (pr.description) lines.push("", pr.description);
      if (pr.codeExcerpts?.length) {
        lines.push("", "#### Code diffs (use as evidence for the technical sections and code snippets)");
        for (const excerpt of pr.codeExcerpts) {
          lines.push("", `File: ${excerpt.path}`, "```diff", excerpt.diff, "```");
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildInstructionsSystemPrompt(docLevel: string, docType: string): string {
  const docTypeGuidance =
    docType === "business"
      ? "Focus on business/user-facing documentation. Include only technical details that are necessary to explain behaviour, dependencies, validation, or delivery risk. Sections 3 and 4 (business overview, user experience/journey) must still be fully detailed — never compress the business narrative or the journey down to a summary paragraph."
      : docType === "tech"
        ? "This is a technical documentation pass, but business context is not optional: Sections 3 and 4 (business overview, user experience/journey) must still be written in full — a reader needs to understand what the feature does for the business and the user before the technical explanation means anything. On top of that, go deep on the technical solution: ground Sections 6 and 7 in the actual code evidence from linked pull requests, covering backend/service-side AND frontend/app-side changes wherever the evidence includes both — do not favour one side of the stack. Use the code-evidence rules below to include real, illustrative code snippets."
        : "Produce both business and technical documentation, each with full depth — this page must be equally useful for Product, Engineering, QA, and Delivery readers, with neither half feeling like an afterthought. Ground the technical sections in the actual code evidence from linked pull requests, covering backend/service-side AND frontend/app-side changes wherever the evidence includes both, using the code-evidence rules below.";

  return `# Wiki Weaver instructions

docLevel=${docLevel}
docType=${docType}

You are writing a polished Azure DevOps Wiki / Confluence-style documentation page — the kind a senior engineer or tech lead writes when walking a new team member through a feature they know deeply: connected, reasoned, narrative prose, not a database dump of the work items that built it. The reader should come away understanding *why* the feature exists and *how* its pieces fit together, not just *what* the individual tickets said.

## The core failure mode to avoid

Do NOT structure the document as "one subsection per work item" with mechanical fields (intent / trigger / behaviour / dependencies / testing) repeated for each User Story or Bug. That produces a shallow catalog, not documentation. A reader who wanted that could just open the work items in ADO. Your job is synthesis: read across every item in the scope, find the actual user journey or technical flow they together implement, and explain THAT — weaving in specific item references inline as supporting evidence (e.g. "when a customer's renewal date falls within the reminder window, the system now surfaces an in-app nudge before the SMS fallback fires (User Story 4065564) — this ordering was deliberate, since..."), not as the organizing structure of the page.

## Core rules

- Use ONLY the evidence provided in the user message. Do not invent APIs, fields, copy, defects, timelines, owners, or implementation details.
- When information is missing, write "Not confirmed in the provided work item context" rather than guessing — but don't let missing detail on one point stop you from writing rich prose about everything that IS evidenced.
- Preserve traceability by referencing work item IDs inline within sentences, e.g. "(User Story 4065564)" — never as the sole structuring device for a section.
- Write primarily in flowing paragraphs. Tables and bullet lists are supporting evidence for a claim you've already made in prose, not a substitute for explaining it — a table or list must never be the entire content of a section. If you find yourself about to write a bullet for every work item, stop and write a paragraph that synthesizes what those items collectively accomplish instead.
- Connect items to each other explicitly: how does one story enable or depend on another, how did a bug fix change a Feature's approach, what's the sequence of a real user's journey through this functionality. Treat the work items as raw material for an argument, not as an enumeration to transcribe.
- Explain reasoning and trade-offs where the evidence supports it (why this approach, what alternative was implicitly rejected, what risk this manages), not just the resulting behaviour.
- Do not wrap the whole page in one big code fence. Small fenced code blocks and fenced Mermaid diagrams used deliberately inside the document (per the rules below) are expected, not prohibited.
- Return only the wiki page Markdown content.
- Go deep, not wide-and-shallow: this page should be genuinely detailed, the length a thorough Confluence page prepared over real focused effort would be, not a compressed abstract. Prefer fully working through fewer themes with real depth over shallow coverage of everything.

## Code evidence and diagrams

- Only the most relevant linked PRs (by title match to their work item) carry a "Code diffs" subsection — others only have a title/description/link. This is expected: do not treat the absence of a diff on a given PR as missing evidence to apologize for, and do not assume every story lacks technical grounding just because its particular PR wasn't the one selected for code evidence.
- When the source context includes "Code diffs" evidence under a linked PR (only present when docType is tech or both), use it to ground the Technical solution overview and API/data/decision-logic sections in what was actually built — name real functions, components, endpoints, files, and classes drawn from the diffs, on both the backend/service side and the frontend/app side wherever the evidence covers both. Do not write generic architecture prose when specific code evidence is available.
- Where a piece of implementation is important enough to show rather than just describe — a key validation rule, a calculation, a state transition, an API contract, a critical error-handling branch — include a short fenced code snippet (roughly 5-20 lines) adapted directly from the provided diff, with a language tag matching the file, immediately followed by a paragraph explaining what it does and why it matters to the feature. Never paste an entire file or an entire raw diff verbatim — extract only the meaningful lines.
- Do not fabricate code. If docType is tech/both but no PR code evidence was provided for a claim you want to make, say so rather than inventing a snippet.
- Where a flow is hard to follow in prose alone — a multi-step user journey, a request/response sequence across frontend/backend/external services, a decision tree, a state machine — include a Mermaid diagram in a fenced \`\`\`mermaid block (flowchart, sequence, or state diagram as fits) to make it visually clear; Azure DevOps Wiki renders Mermaid natively. Use diagrams only where they add real clarity beyond the prose, not as decoration, and only depict flows the evidence actually supports.

## Required page shape

Create the page using this structure unless the context clearly makes a section irrelevant. Section length guidance below is a floor, not a target to pad past with filler — write less only when the evidence genuinely doesn't support more.

# <Feature/Epic title>

## 1. Executive summary
4-6 paragraphs: what this scope delivers, who it affects, why it matters now, the shape of the solution at a glance, and (when docType is tech/both) a preview of the technical approach. This is the pitch a delivery lead gives in a real briefing — make it that good and that complete, not a restated title.

## 2. Scope and hierarchy
A paragraph framing how the root item and its children relate (a genuine breakdown? a rollup? a mix of feature work and bug fixes? what themes group the children?), followed by a compact table of ID/type/title/purpose for reference.

## 3. Business overview
Several substantive paragraphs — this is not optional filler, it is core content regardless of docType. Cover the business intent, the customer/user need being addressed, the journeys this supports end to end, visibility/eligibility conditions, and the business rules and thresholds that govern behaviour. Write this as the full story of the problem and the solution, referencing specific stories inline as evidence for specific claims — not as "Story 1 does X. Story 2 does Y."

## 4. User experience and content behaviour — the journey
Walk through the complete, real experience in the order a user encounters it, as a narrative journey rather than a component-by-component checklist: entry points, screens/components, every state transition, CTAs, copy and content behaviour, accessibility expectations, and edge cases along the way. Describe the journey from first contact through to completion/resolution, including branches (what happens if a condition isn't met, if a step fails, if data is missing).

## 5. Functional deep-dive
This is the section most prone to becoming a work-item catalog — actively resist that. Organize by user journey, workflow stage, or logical theme (whichever the evidence supports), and write it as a connected, thorough explanation of how the functionality behaves end to end, including the conditions, edge cases, and business rules that shape each step. Reference specific work items inline as evidence for specific claims throughout. Only fall back to a more itemized treatment for any story/bug that is genuinely standalone with no natural grouping — and even then, give it a real paragraph, not a bullet list of fields.

## 6. Technical solution overview
Explain the implementation approach as a coherent design: frontend/backend responsibilities, integration points, feature flags, source systems, data flow, state handling, and error/edge-case handling — and *why* it's shaped this way where the evidence shows reasoning (a migration, a constraint, a prior incident, a platform limitation). When docType is tech or both and code diffs are present in the evidence, this section must be grounded in that real code — actual function/component/endpoint names, actual logic — covering both backend/service-side and frontend/app-side work where both exist, with illustrative code snippets per the Code evidence rules. This should read like a design doc written by the engineer who built it, not a component inventory.

## 7. API, data and decision logic
Prose explaining the data flow and decision logic first — including real request/response shapes, field mappings, and conditions drawn from the code evidence when available — then a supporting table (API/source system, purpose, consuming component, conditions/feature flags, notes) for quick reference. Include business rules such as thresholds, eligibility, billing-cycle behaviour, or status mapping woven into the explanation, not just listed. Use a code snippet here too when a specific piece of decision logic (a condition, a mapping, a calculation) is clearer shown than described.

## 8. Analytics, accessibility and non-functional requirements
Cover analytics instrumentation, accessibility behaviour, performance/PACE notes, build validation, and other NFRs actually present in the evidence — explained, not just named.

## 9. Testing, validation and defects
Summarize what was tested, how, and what was found — tested builds, stubs/mocks, E2E scenarios, blocked testing, and the story behind any defects (what broke, why, how it was resolved or why it's still open). Use a table for a defect list if there are enough to warrant one, after the narrative explains what it means.

## 10. Delivery risks, dependencies and open questions
Explain unresolved dependencies, blockers, gaps, and contradictions in the evidence, and what confirming them would require — as reasoned risk assessment, not a bullet dump.

## 11. Traceability appendix
A compact table linking work item IDs to what they contributed — this is the one section where a plain table is appropriate, since its entire purpose is quick lookup after the narrative above has already done the explaining.

## Quality bar

- A reader new to the feature should finish understanding the full business context, the complete user journey, and (when applicable) the real technical implementation the way a teammate's thorough explanation would deliver it — not the way a ticket export would.
- Be explicit about what is confirmed vs not confirmed, but don't let that hedge substitute for depth on what IS confirmed — go as deep as the evidence allows everywhere it allows it.
- No section 3, 4, 5, 6, or 7 should consist mainly of a table or list — each must carry real analytical prose, with tables/snippets/diagrams as supporting evidence.
- Avoid generic filler and avoid restating acceptance criteria verbatim — explain what they mean and why they're there.
- Business detail and the user journey (Sections 3-4) must be fully covered regardless of docType — never sacrifice them to make room for technical depth; add the technical depth on top, not instead.
- When code evidence or diagram-worthy flows exist, use them — a technical page with no grounded code snippets or a complex journey with no diagram, when the evidence clearly supports either, is a missed opportunity, not a safe default.

## Documentation type guidance
${docTypeGuidance}`;
}

// --- orchestration -----------------------------------------------------------------

export async function runWikiWeaver(inputs: Record<string, string | boolean>, ctx: LocalCtx): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const workItemRef = typeof inputs.workItemRef === "string" ? inputs.workItemRef.trim() : "";
  if (!workItemRef) throw new Error("A work item ID or URL is required.");
  const workItemIdStr = parseWorkItemId(workItemRef);
  if (!workItemIdStr) throw new Error(`Could not parse a work item id from: ${workItemRef}`);
  const workItemId = Number(workItemIdStr);

  const docLevel = (typeof inputs.docLevel === "string" ? inputs.docLevel.trim().toLowerCase() : "") || "feature";
  const docType = (typeof inputs.docType === "string" ? inputs.docType.trim().toLowerCase() : "") || "both";
  const wikiParentUrl = typeof inputs.wikiParentUrl === "string" ? inputs.wikiParentUrl.trim() : "";
  const postSummaryComment = inputs.postSummaryComment !== false;

  emit(`[input] resolved work item id: ${workItemId}`);
  const originalRaw = await getWorkItemRecord(workItemId, adoAuth, true);
  const topParentRaw = await climbToTopParent(originalRaw, adoAuth);
  const scopeRootRaw = await resolveScopeRoot(topParentRaw, originalRaw, docLevel, adoAuth);

  const { org, project } = adoTarget();
  const items = await gatherHierarchy(scopeRootRaw, org, project, docType, adoAuth, emit);
  const rootWi = items[0];

  if (docType !== "business") {
    emit(`[context] docType=${docType} — selecting the most relevant linked PRs for code evidence`);
    await selectCodeEvidence(items, adoAuth, emit);
  }

  const systemPrompt = buildInstructionsSystemPrompt(docLevel, docType);
  let userMessage = buildContextMessage(items);
  emit(`[bundle] assembled scope index + context for ${items.length} work item(s)`);

  emit("[copilot] streaming model response …");
  let content: string;
  try {
    content = (await runCopilotChat(systemPrompt, userMessage, githubToken)).trim();
  } catch (ex) {
    const message = ex instanceof Error ? ex.message : String(ex);
    if (!/max_prompt_tokens_exceeded|exceeds the limit/i.test(message)) throw ex;
    emit(`[copilot] prompt too large for the model (${message}) — dropping code diffs and retrying with a smaller context`);
    for (const item of items) for (const pr of item.linkedPrs) pr.codeExcerpts = undefined;
    userMessage = buildContextMessage(items);
    content = (await runCopilotChat(systemPrompt, userMessage, githubToken)).trim();
  }
  if (!content) throw new Error("GitHub Copilot returned empty content for the wiki page.");

  // Generation stops here — publishing is a separate, explicit user action
  // (see publishGeneratedWikiPage / app/api/wiki-weaver/publish) so the user
  // can review the page and choose to publish it or export it as a Word doc
  // instead, rather than it landing on the wiki unreviewed.
  const target = resolveWikiTarget(org, project, rootWi.type, rootWi.id, rootWi.title, wikiParentUrl);

  emit(`[done] generated — review before publishing to ${target.url}`);
  return {
    awaitingPublish: true,
    content,
    rootType: rootWi.type,
    rootId: rootWi.id,
    rootTitle: rootWi.title,
    wikiParentUrl,
    postSummaryComment,
    targetUrl: target.url,
  };
}

/**
 * Publish an already-generated wiki page — the explicit second step of the
 * review-before-publish flow, called from app/api/wiki-weaver/publish once
 * the user approves the content rendered by runWikiWeaver's job result (and,
 * if a page already exists at the target path, has confirmed overwriting it).
 */
export async function publishGeneratedWikiPage(
  input: {
    content: string;
    rootType: string;
    rootId: number;
    rootTitle: string;
    wikiParentUrl: string;
    postSummaryComment: boolean;
  },
  adoAuth: string,
): Promise<{ title: string; url: string }> {
  const { org, project } = adoTarget();
  const page = await publishWikiPage(
    org,
    project,
    input.rootType,
    input.rootId,
    input.rootTitle,
    input.content,
    input.wikiParentUrl,
    adoAuth,
  );
  if (input.postSummaryComment) {
    await addWorkItemComment(input.rootId, `Wiki Weaver published documentation for this item: ${page.url}`, adoAuth);
  }
  return page;
}
