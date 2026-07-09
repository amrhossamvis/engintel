/**
 * Server-only Azure DevOps work-item / PR / attachment reads and writes. Never
 * import from a "use client" file.
 *
 * Generic helpers shared by every "local"-execution capability (Bug Triage,
 * Feature/Epic Breakdown, Business Intent Builder, Test Case Generator, Figma
 * Test Case Generator, PR Reviewer, UI TestData ID Reviewer) — the direct-REST
 * equivalent of what each capability's ADO REST client class did individually
 * in its Python pipeline script. Auth reuses lib/ado.ts's existing precedence
 * (caller's PAT → az login → service PAT); this file does not reinvent auth.
 *
 * Named distinctly from lib/ado-workitems.ts (Playground's bulk work-item
 * creation helper) to avoid colliding with its own createWorkItem/
 * CreateWorkItemInput exports — different shape, different caller.
 */

import { adoReadAuthHeader, adoTarget } from "@/lib/ado";
import { adoFetchJson, adoPatchJson, adoPostJson } from "@/lib/ado-http";
import { diffFile, type FileDiff } from "@/lib/diff";

const API = "7.1";

function projectBase(): string {
  const { org, project } = adoTarget();
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;
}

function witBase(): string {
  return `${projectBase()}/_apis/wit`;
}

function gitRepoBase(repoIdOrName: string): string {
  return `${projectBase()}/_apis/git/repositories/${encodeURIComponent(repoIdOrName)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoGet(url: string, auth: string): Promise<any> {
  return adoFetchJson(url, auth);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoPost(url: string, auth: string, body: unknown): Promise<any> {
  return adoPostJson(url, auth, body);
}

export type JsonPatchOp = { op: "add" | "remove" | "replace"; path: string; value?: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoPatch(url: string, auth: string, operations: JsonPatchOp[]): Promise<any> {
  return adoPatchJson(url, auth, operations);
}

/** Strip ADO's rich-text HTML fields down to readable plain text. */
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<li>/gi, "- ");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/[ \t\x0B\f\r]+/g, " ");
  text = text.replace(/\n\s*\n+/g, "\n\n");
  return text.trim();
}

export type WorkItemRelation = { rel: string; url: string; attributes?: Record<string, unknown> };

export type WorkItemRecord = {
  id: number;
  type: string;
  title: string;
  state: string;
  description: string;
  acceptanceCriteria: string;
  reproSteps: string;
  areaPath: string;
  iterationPath: string;
  tags: string;
  relations: WorkItemRelation[];
  /** Raw fields object, for capability-specific fields not covered above. */
  fields: Record<string, unknown>;
};

function toWorkItemRecord(raw: { id: number; fields?: Record<string, unknown>; relations?: WorkItemRelation[] }): WorkItemRecord {
  const f = raw.fields ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: raw.id,
    type: str(f["System.WorkItemType"]),
    title: str(f["System.Title"]),
    state: str(f["System.State"]),
    description: stripHtml(str(f["System.Description"])),
    acceptanceCriteria: stripHtml(str(f["Microsoft.VSTS.Common.AcceptanceCriteria"])),
    reproSteps: stripHtml(str(f["Microsoft.VSTS.TCM.ReproSteps"])),
    areaPath: str(f["System.AreaPath"]),
    iterationPath: str(f["System.IterationPath"]),
    tags: str(f["System.Tags"]),
    relations: raw.relations ?? [],
    fields: f,
  };
}

/** Extract a work-item id from a `.../workItems/{id}` relation URL. */
export function workItemIdFromRelationUrl(url: string): number | null {
  const m = url.match(/\/workItems\/(\d+)(?:[/?#]|$)/i);
  return m ? Number(m[1]) : null;
}

export async function getWorkItemRecord(id: number, auth: string, expandRelations = true): Promise<WorkItemRecord> {
  const url = `${witBase()}/workitems/${id}${expandRelations ? "?$expand=relations&api-version=" + API : "?api-version=" + API}`;
  const raw = await adoGet(url, auth);
  if (!raw) throw new Error(`Work item ${id} not found`);
  return toWorkItemRecord(raw);
}

export type WorkItemComment = { id: number; text: string; authorDisplayName: string; isDeleted: boolean };

export async function getWorkItemComments(id: number, auth: string): Promise<WorkItemComment[]> {
  const comments: WorkItemComment[] = [];
  let continuationToken: string | undefined;
  do {
    const url =
      `${witBase()}/workItems/${id}/comments?$top=200&includeDeleted=true&order=desc&api-version=7.1-preview.4` +
      (continuationToken ? `&continuationToken=${encodeURIComponent(continuationToken)}` : "");
    const root = await adoGet(url, auth);
    if (!root) break;
    for (const c of root.comments ?? []) {
      comments.push({
        id: Number(c.id ?? 0),
        text: String(c.text ?? ""),
        authorDisplayName: String(c.createdBy?.displayName ?? ""),
        isDeleted: Boolean(c.isDeleted),
      });
    }
    continuationToken = root.continuationToken;
  } while (continuationToken);
  return comments;
}

export type WorkItemUpdate = {
  revisedByDisplayName: string;
  fields: Record<string, { newValue?: string }>;
};

export async function getWorkItemUpdates(id: number, auth: string): Promise<WorkItemUpdate[]> {
  const root = await adoGet(`${witBase()}/workitems/${id}/updates?api-version=${API}`, auth);
  const updates: WorkItemUpdate[] = [];
  for (const u of root?.value ?? []) {
    updates.push({
      revisedByDisplayName: String(u.revisedBy?.displayName ?? "Unknown"),
      fields: u.fields ?? {},
    });
  }
  return updates;
}

/**
 * Comments + field-change history rendered as readable text, in chronological
 * order — mirrors get_discussion()/get_bug_discussion() from the Python
 * pipeline scripts.
 */
export async function getDiscussionHistory(id: number, auth: string, maxChars = 60_000): Promise<string> {
  const parts: string[] = [];
  try {
    const comments = await getWorkItemComments(id, auth);
    for (const c of [...comments].reverse()) {
      if (c.isDeleted) continue;
      const text = stripHtml(c.text);
      if (text) parts.push(`[Comment by ${c.authorDisplayName || "Unknown"}]\n${text}`);
    }
  } catch {
    // non-fatal — continue with whatever else we can gather
  }

  try {
    const updates = await getWorkItemUpdates(id, auth);
    for (const u of updates) {
      for (const [fieldName, fieldData] of Object.entries(u.fields)) {
        if (["System.History", "System.Description", "Microsoft.VSTS.Common.AcceptanceCriteria"].includes(fieldName)) {
          const newValue = stripHtml(fieldData?.newValue);
          if (newValue) parts.push(`[${u.revisedByDisplayName}] ${fieldName}:\n${newValue}`);
        }
      }
    }
  } catch {
    // non-fatal
  }

  const text = parts.join("\n\n");
  return text.length > maxChars ? text.slice(0, maxChars) + "\n... [truncated]" : text;
}

export async function addWorkItemComment(id: number, text: string, auth: string): Promise<void> {
  await adoPost(`${witBase()}/workItems/${id}/comments?format=markdown&api-version=7.1-preview.4`, auth, { text });
}

export async function queryWiql(wiql: string, auth: string): Promise<number[]> {
  const root = await adoPost(`${witBase()}/wiql?api-version=7.1-preview.2`, auth, { query: wiql });
  return (root?.workItems ?? []).map((w: { id: number }) => w.id);
}

export type CreateWorkItemRecordInput = {
  type: string;
  title: string;
  descriptionHtml: string;
  acceptanceCriteriaHtml?: string;
  /** Omit to let ADO apply the project default area. */
  areaPath?: string;
  iterationPath?: string;
  tags?: string;
  extraFields?: Record<string, string>;
  parentId?: number;
};

export type CreatedWorkItemRecord = { id: number; type: string; title: string; parentId: number };

const HIERARCHY_REVERSE = "System.LinkTypes.Hierarchy-Reverse";

export async function createWorkItemRecord(input: CreateWorkItemRecordInput, auth: string): Promise<CreatedWorkItemRecord> {
  const url = `${projectBase()}/_apis/wit/workitems/$${encodeURIComponent(input.type)}?api-version=${API}`;
  const ops: JsonPatchOp[] = [
    { op: "add", path: "/fields/System.Title", value: input.title },
    { op: "add", path: "/fields/System.Description", value: input.descriptionHtml },
  ];
  if (input.areaPath) ops.push({ op: "add", path: "/fields/System.AreaPath", value: input.areaPath });
  if (input.acceptanceCriteriaHtml) {
    ops.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: input.acceptanceCriteriaHtml });
  }
  if (input.iterationPath) ops.push({ op: "add", path: "/fields/System.IterationPath", value: input.iterationPath });
  if (input.tags) ops.push({ op: "add", path: "/fields/System.Tags", value: input.tags });
  for (const [field, value] of Object.entries(input.extraFields ?? {})) {
    ops.push({ op: "add", path: `/fields/${field}`, value });
  }
  if (input.parentId !== undefined) {
    ops.push({
      op: "add",
      path: "/relations/-",
      value: { rel: HIERARCHY_REVERSE, url: `${witBase()}/workItems/${input.parentId}` },
    });
  }

  const root = await adoPatch(url, auth, ops);
  const fields = root.fields ?? {};
  return {
    id: Number(root.id),
    type: String(fields["System.WorkItemType"] ?? input.type),
    title: String(fields["System.Title"] ?? input.title),
    parentId: input.parentId ?? 0,
  };
}

/** Link two work items with a non-hierarchy relation (e.g. "System.LinkTypes.Related"). */
export async function linkWorkItems(
  sourceId: number,
  targetId: number,
  relType: string,
  auth: string,
  comment?: string,
): Promise<void> {
  const ops: JsonPatchOp[] = [
    {
      op: "add",
      path: "/relations/-",
      value: {
        rel: relType,
        url: `${witBase()}/workItems/${targetId}`,
        ...(comment ? { attributes: { comment } } : {}),
      },
    },
  ];
  await adoPatch(`${witBase()}/workitems/${sourceId}?api-version=${API}`, auth, ops);
}

export async function patchWorkItemFields(id: number, fields: Record<string, string>, auth: string): Promise<void> {
  const ops: JsonPatchOp[] = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([field, value]) => ({ op: "add", path: `/fields/${field}`, value }));
  if (ops.length === 0) return;
  await adoPatch(`${witBase()}/workitems/${id}?api-version=${API}`, auth, ops);
}

export async function downloadAttachment(url: string, auth: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
  if (!res.ok) throw new Error(`Attachment download failed ${res.status} for ${url}`);
  if (res.url.includes("visualstudio.com/_signin")) {
    throw new Error(`Azure DevOps rejected the request's credentials (redirected to sign-in) downloading ${url}.`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Pull requests
// ---------------------------------------------------------------------------

export type PullRequestRecord = {
  title: string;
  description: string;
  status: string;
  sourceCommit: string;
  targetCommit: string;
  webUrl: string;
};

export async function getPullRequestRecord(repoId: string, prId: string | number, auth: string): Promise<PullRequestRecord> {
  const root = await adoGet(`${gitRepoBase(repoId)}/pullrequests/${prId}?api-version=${API}`, auth);
  if (!root) throw new Error(`Pull request ${prId} not found in repo ${repoId}`);
  return {
    title: String(root.title ?? ""),
    description: String(root.description ?? ""),
    status: String(root.status ?? ""),
    sourceCommit: String(root.lastMergeSourceCommit?.commitId ?? ""),
    targetCommit: String(root.lastMergeTargetCommit?.commitId ?? ""),
    webUrl: String(root._links?.web?.href ?? ""),
  };
}

export async function getLatestPrIterationId(repoId: string, prId: string | number, auth: string): Promise<number> {
  const root = await adoGet(`${gitRepoBase(repoId)}/pullRequests/${prId}/iterations?api-version=${API}`, auth);
  let latest = 1;
  for (const item of root?.value ?? []) latest = Math.max(latest, Number(item.id ?? 1));
  return latest;
}

export type ChangedFile = { path: string; changeType: string; changeTrackingId: number };

export async function getPrChangedFiles(
  repoId: string,
  prId: string | number,
  iterationId: number,
  auth: string,
): Promise<ChangedFile[]> {
  const root = await adoGet(
    `${gitRepoBase(repoId)}/pullRequests/${prId}/iterations/${iterationId}/changes?$top=500&api-version=${API}`,
    auth,
  );
  const files: ChangedFile[] = [];
  for (const entry of root?.changeEntries ?? []) {
    const path = entry.item?.path;
    if (path) {
      files.push({ path, changeType: String(entry.changeType ?? ""), changeTrackingId: Number(entry.changeTrackingId ?? 0) });
    }
  }
  return files;
}

export async function getPrItemContent(repoId: string, path: string, commitId: string, auth: string): Promise<string> {
  if (!commitId) return "";
  const url =
    `${gitRepoBase(repoId)}/items?path=${encodeURIComponent(path)}&includeContent=true` +
    `&versionDescriptor.versionType=commit&versionDescriptor.version=${encodeURIComponent(commitId)}&api-version=${API}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
  const root = (await adoGet(url, auth)) as any;
  if (!root) return "";
  if (root.content) return String(root.content);
  if (Array.isArray(root.value) && root.value[0]?.content) return String(root.value[0].content);
  return "";
}

export type PrFileContext = {
  path: string;
  changeType: string;
  changeTrackingId: number;
  oldContent: string;
  newContent: string;
} & FileDiff;

/**
 * Load old/new content + diff + changed-line set for each changed file in a PR
 * iteration. Shared by PR Reviewer and UI TestData ID Reviewer so both call
 * sites reuse the same file-loading logic instead of duplicating it.
 */
export async function loadPrFileContexts(
  repoId: string,
  prId: string | number,
  files: ChangedFile[],
  sourceCommit: string,
  targetCommit: string,
  auth: string,
  maxFiles = 30,
): Promise<PrFileContext[]> {
  const results: PrFileContext[] = [];
  for (const file of files.slice(0, maxFiles)) {
    if (file.changeType.toLowerCase().includes("delete")) continue;
    try {
      const newContent = await getPrItemContent(repoId, file.path, sourceCommit, auth);
      const oldContent = targetCommit ? await getPrItemContent(repoId, file.path, targetCommit, auth) : "";
      if (!newContent.trim() && !oldContent.trim()) continue;
      const diff = diffFile(file.path, oldContent, newContent);
      results.push({ path: file.path, changeType: file.changeType, changeTrackingId: file.changeTrackingId, oldContent, newContent, ...diff });
    } catch {
      continue;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// PR comment threads — shared by PR Reviewer and UI TestData ID Reviewer.
// ---------------------------------------------------------------------------

export type PrThreadComment = { id: number; content: string; authorDisplayName: string };
export type PrThread = { id: number; comments: PrThreadComment[] };

export async function listPrThreads(repoId: string, prId: string | number, auth: string): Promise<PrThread[]> {
  const root = await adoGet(`${gitRepoBase(repoId)}/pullRequests/${prId}/threads?api-version=${API}`, auth);
  const threads: PrThread[] = [];
  for (const t of root?.value ?? []) {
    threads.push({
      id: Number(t.id),
      comments: (t.comments ?? []).map((c: Record<string, unknown>) => ({
        id: Number(c.id ?? 0),
        content: String(c.content ?? ""),
        authorDisplayName: String((c.author as Record<string, unknown> | undefined)?.displayName ?? ""),
      })),
    });
  }
  return threads;
}

export async function deletePrComment(repoId: string, prId: string | number, threadId: number, commentId: number, auth: string): Promise<void> {
  const url = `${gitRepoBase(repoId)}/pullRequests/${prId}/threads/${threadId}/comments/${commentId}?api-version=${API}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
  if (![200, 202, 204].includes(res.status)) {
    throw new Error(`DELETE PR comment failed ${res.status} for ${url}`);
  }
}

export async function postPrGeneralComment(repoId: string, prId: string | number, content: string, auth: string): Promise<void> {
  await adoPost(`${gitRepoBase(repoId)}/pullRequests/${prId}/threads?api-version=${API}`, auth, {
    status: "active",
    comments: [{ parentCommentId: 0, content, commentType: "text" }],
  });
}

export async function postPrInlineComment(
  repoId: string,
  prId: string | number,
  filePath: string,
  line: number,
  changeTrackingId: number,
  iterationId: number,
  content: string,
  auth: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    status: "active",
    comments: [{ parentCommentId: 0, content, commentType: "text" }],
    threadContext: {
      filePath,
      rightFileStart: { line, offset: 1 },
      rightFileEnd: { line, offset: 1 },
    },
  };
  if (changeTrackingId > 0) {
    body.pullRequestThreadContext = {
      changeTrackingId,
      iterationContext: { firstComparingIteration: Math.max(1, iterationId - 1), secondComparingIteration: iterationId },
    };
  }
  await adoPost(`${gitRepoBase(repoId)}/pullRequests/${prId}/threads?api-version=${API}`, auth, body);
}

export { adoReadAuthHeader };
