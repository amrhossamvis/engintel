import { adoReadAuthHeader, adoTarget } from "@/lib/ado";
import { markdownToHtml } from "@/lib/markdown";

export type ClassificationNode = { name: string; path: string };

export type CreateWorkItemInput = {
  type: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  areaPath?: string;
  iterationPath?: string;
  parentId?: number;
};

export const WORK_ITEM_TYPES = [
  "User Story",
  "Product Backlog Item",
  "Task",
  "Bug",
  "Feature",
] as const;

function witBase(): string {
  const { org, project } = adoTarget();
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit`;
}

function orgWitBase(): string {
  const { org } = adoTarget();
  return `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit`;
}

type RawNode = { name: string; children?: RawNode[] };

/**
 * Flatten a classification tree into selectable `Project\Area\Sub` paths — the
 * exact string System.AreaPath / System.IterationPath expect.
 */
export function flatten(node: RawNode, prefix: string, out: ClassificationNode[]): void {
  const path = prefix ? `${prefix}\\${node.name}` : node.name;
  out.push({ name: node.name, path });
  for (const child of node.children ?? []) flatten(child, path, out);
}

/** Read the area or iteration tree for the dropdowns. `kind` is "areas" | "iterations". */
export async function getClassificationNodes(
  kind: "areas" | "iterations",
  userPat?: string,
): Promise<ClassificationNode[]> {
  const auth = await adoReadAuthHeader(userPat);
  const res = await fetch(`${witBase()}/classificationnodes/${kind}?$depth=10&api-version=7.0`, {
    headers: { Authorization: auth },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`classification_fetch_failed_${res.status}`);
  const root = (await res.json()) as RawNode;
  const out: ClassificationNode[] = [];
  flatten(root, "", out);
  return out;
}

export { markdownToHtml };

export type CreatedWorkItem = { id: number; url: string };

export async function createWorkItem(
  input: CreateWorkItemInput,
  userPat?: string,
): Promise<CreatedWorkItem> {
  const auth = await adoReadAuthHeader(userPat);
  const ops: Array<Record<string, unknown>> = [
    { op: "add", path: "/fields/System.Title", value: input.title },
  ];
  if (input.description?.trim())
    ops.push({ op: "add", path: "/fields/System.Description", value: markdownToHtml(input.description) });
  if (input.acceptanceCriteria?.trim())
    ops.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
      value: markdownToHtml(input.acceptanceCriteria),
    });
  if (input.areaPath?.trim())
    ops.push({ op: "add", path: "/fields/System.AreaPath", value: input.areaPath.trim() });
  if (input.iterationPath?.trim())
    ops.push({ op: "add", path: "/fields/System.IterationPath", value: input.iterationPath.trim() });
  if (input.parentId)
    ops.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: `${orgWitBase()}/workItems/${input.parentId}`,
      },
    });

  const res = await fetch(
    `${witBase()}/workitems/$${encodeURIComponent(input.type)}?api-version=7.0`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json-patch+json" },
      body: JSON.stringify(ops),
    },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    const detail = body?.message ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }

  const data = (await res.json()) as { id: number; _links?: { html?: { href?: string } } };
  const { org, project } = adoTarget();
  const url =
    data._links?.html?.href ??
    `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${data.id}`;
  return { id: data.id, url };
}

export type ParentCandidate = { id: number; title: string; type: string };

/** Title-search candidate parents (Epic / Feature / Story) for the parent link picker. */
export async function searchParents(query: string, userPat?: string): Promise<ParentCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const auth = await adoReadAuthHeader(userPat);
  const safe = q.replace(/'/g, "''");
  const wiql = {
    query:
      `SELECT [System.Id] FROM WorkItems WHERE [System.Title] CONTAINS '${safe}' ` +
      `AND [System.WorkItemType] IN ('Feature','Epic','User Story','Product Backlog Item') ` +
      `ORDER BY [System.ChangedDate] DESC`,
  };
  const res = await fetch(`${witBase()}/wiql?api-version=7.0&$top=20`, {
    method: "POST",
    headers: { Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(wiql),
  });
  if (!res.ok) throw new Error(`wiql_${res.status}`);
  const wiqlData = (await res.json()) as { workItems?: Array<{ id: number }> };
  const ids = (wiqlData.workItems ?? []).map((w) => w.id).slice(0, 20);
  if (!ids.length) return [];

  const wi = await fetch(
    `${witBase()}/workitems?ids=${ids.join(",")}&fields=System.Title,System.WorkItemType&api-version=7.0`,
    { headers: { Authorization: auth }, cache: "no-store" },
  );
  if (!wi.ok) throw new Error(`workitems_${wi.status}`);
  const wiData = (await wi.json()) as {
    value?: Array<{ id: number; fields: Record<string, string> }>;
  };
  return (wiData.value ?? []).map((v) => ({
    id: v.id,
    title: v.fields["System.Title"],
    type: v.fields["System.WorkItemType"],
  }));
}

/**
 * Best-effort probe of Work Items create permission using ADO's validateOnly
 * dry-run. Runs under the caller's identity, so a 401/403 means the PAT can't
 * create; a 400 (field-rule failure) still means create is permitted.
 */
export async function canCreate(type: string, userPat?: string): Promise<boolean> {
  const auth = await adoReadAuthHeader(userPat);
  const ops = [{ op: "add", path: "/fields/System.Title", value: "permission probe" }];
  const res = await fetch(
    `${witBase()}/workitems/$${encodeURIComponent(type)}?validateOnly=true&api-version=7.0`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json-patch+json" },
      body: JSON.stringify(ops),
    },
  );
  return res.status !== 401 && res.status !== 403;
}
