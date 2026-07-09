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
  queryWiql,
  workItemIdFromRelationUrl,
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

type LinkedPrInfo = { title?: string; description?: string; files?: string[]; url?: string };
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
  dryRun: boolean,
  auth: string,
): Promise<{ title: string; url: string }> {
  const { wikiIdentifier, parentPath } = parseWikiParentReference(wikiParentUrl);
  const path = buildGeneratedWikiChildPath(parentPath, rootType, rootId, rootTitle);
  const pageUrl = buildWikiPageUrl(org, project, wikiIdentifier, path);
  const title = `${rootType} ${rootId}: ${rootTitle}`;

  if (dryRun) return { title, url: pageUrl };

  const etag = await getWikiPageEtag(org, project, wikiIdentifier, path, auth);
  await putWikiPage(org, project, wikiIdentifier, path, content, etag, auth);
  return { title, url: pageUrl };
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

async function toWikiWorkItem(record: WorkItemRecord, org: string, project: string, auth: string): Promise<WikiWorkItem> {
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
        const files = (await getPrChangedFiles(repoId, prId, iterationId, auth)).map((f) => f.path);
        linkedPrs.push({ title: pr.title, description: pr.description, files, url: pr.webUrl });
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

async function gatherHierarchy(scopeRoot: WorkItemRecord, org: string, project: string, auth: string, emit: EmitFn): Promise<WikiWorkItem[]> {
  const rootWi = await toWikiWorkItem(scopeRoot, org, project, auth);
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
    items.push(await toWikiWorkItem(raw, org, project, auth));
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
    items.push(await toWikiWorkItem(raw, org, project, auth));
  }

  emit(`[context] hierarchy links were not available — gathered ${items.length} work item(s) using area-path fallback`);
  return items;
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
      if (pr.files?.length) lines.push(`- Files changed: ${pr.files.join(", ")}`);
      if (pr.description) lines.push("", pr.description);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildInstructionsSystemPrompt(docLevel: string, docType: string): string {
  const docTypeGuidance =
    docType === "business"
      ? "Focus on business/user-facing documentation. Include only technical details that are necessary to explain behaviour, dependencies, validation, or delivery risk."
      : docType === "tech"
        ? "Focus on technical documentation. Still include a short business overview so the technical solution is understandable."
        : "Produce both business and technical documentation. The page must be useful for Product, Engineering, QA, and Delivery readers.";

  return `# Wiki Weaver instructions

docLevel=${docLevel}
docType=${docType}

You are generating a polished Azure DevOps Wiki / Confluence-style documentation page.
The output must be comprehensive, structured, and ready to publish. Do not produce a shallow summary.

## Core rules

- Use ONLY the evidence provided in the user message.
- Do not invent APIs, fields, copy, defects, timelines, owners, or implementation details.
- When information is missing, write "Not confirmed in the provided work item context" rather than guessing.
- Preserve traceability by referencing work item IDs in section text, for example: (User Story 4065564).
- Synthesize the information into a coherent page; do not simply dump or repeat the source context.
- Use clear headings, tables, and concise paragraphs.
- Do not include markdown fences.
- Return only the wiki page Markdown content.

## Required page shape

Create the page using this structure unless the context clearly makes a section irrelevant:

# <Feature/Epic title>

## 1. Executive summary
Explain what the scope delivers, who it affects, and why it matters. This should be 2-4 meaningful paragraphs, not one sentence.

## 2. Scope and hierarchy
Add a table of the root item and child work items with ID, type, title, and purpose.

## 3. Business overview
Describe the business intent, customer/user need, supported journeys, visibility conditions, business rules, thresholds, and expected user-facing behaviour.

## 4. User experience and content behaviour
Describe screens/components, entry points, status states, CTAs, bottom sheets, copy notes, accessibility expectations, and any user-facing edge cases.

## 5. Functional requirements by work item
For each meaningful User Story/Bug/Feature in scope, create a subsection with:
- Intent / user need
- Trigger or when it applies
- Behaviour / acceptance criteria
- Dependencies or blockers
- Testing / validation notes
- Known gaps or open questions

## 6. Technical solution overview
Describe the implementation approach at a solution level. Include frontend/backend responsibilities, integration points, feature flags, APIs, source systems, data mapping, state handling, and error/edge-case handling where provided.

## 7. API, data and decision logic
Add tables where possible:
- API/source system
- Purpose
- Consuming component
- Conditions/feature flags
- Notes/gaps
Also include business rules such as thresholds, plan eligibility, billing-cycle behaviour, or status mapping if present.

## 8. Analytics, accessibility and non-functional requirements
Cover analytics references, accessibility wording/behaviour, PACE/performance notes, build validation, and any NFRs explicitly present.

## 9. Testing, validation and defects
Summarize tested builds, stubs/mocks, E2E scenarios, blocked testing, bugs, rejected bugs, and resolved defects. Use a table for defects/blockers if evidence exists.

## 10. Delivery risks, dependencies and open questions
Highlight unresolved dependencies, test data issues, API blockers, copy gaps, design contradictions, and anything requiring PO/BA/UX/DXL/QA confirmation.

## 11. Traceability appendix
Include a compact table linking work item IDs to relevant evidence and notes.

## Quality bar

The page should read like a real Confluence page prepared by an Engineering Manager / Tech Lead:
- Detailed enough for someone new to the feature to understand the business and technical scope.
- Explicit about what is confirmed vs not confirmed.
- Avoid generic filler.
- Prefer useful tables over long unordered lists.
- Do not stop after a short overview if detailed context exists.

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
  const dryRun = Boolean(inputs.dryRun);

  emit(`[input] resolved work item id: ${workItemId}`);
  const originalRaw = await getWorkItemRecord(workItemId, adoAuth, true);
  const topParentRaw = await climbToTopParent(originalRaw, adoAuth);
  const scopeRootRaw = await resolveScopeRoot(topParentRaw, originalRaw, docLevel, adoAuth);

  const { org, project } = adoTarget();
  const items = await gatherHierarchy(scopeRootRaw, org, project, adoAuth, emit);
  const rootWi = items[0];

  const systemPrompt = buildInstructionsSystemPrompt(docLevel, docType);
  const userMessage = buildContextMessage(items);
  emit(`[bundle] assembled scope index + context for ${items.length} work item(s)`);

  emit("[copilot] streaming model response …");
  const content = (await runCopilotChat(systemPrompt, userMessage, githubToken)).trim();
  if (!content) throw new Error("GitHub Copilot returned empty content for the wiki page.");

  const page = await publishWikiPage(org, project, rootWi.type, rootWi.id, rootWi.title, content, wikiParentUrl, dryRun, adoAuth);
  emit(`[wiki] target page: ${page.url}`);

  if (postSummaryComment && !dryRun) {
    await addWorkItemComment(rootWi.id, `Wiki Weaver published documentation for this item: ${page.url}`, adoAuth);
    emit("[ado] posted summary comment");
  }

  emit(`[done] dryRun=${dryRun ? 1 : 0}`);
  return {
    webUrl: page.url,
    dryRun,
    wikiPages: [page],
    wikiDryRun: dryRun,
  };
}
