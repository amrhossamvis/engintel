import { adoReadAuthHeader, adoTarget } from "@/lib/ado";

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
function flatten(node: RawNode, prefix: string, out: ClassificationNode[]): void {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** ADO rich-text fields are HTML — preserve line breaks from the plain-text draft. */
function toHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

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
    ops.push({ op: "add", path: "/fields/System.Description", value: toHtml(input.description) });
  if (input.acceptanceCriteria?.trim())
    ops.push({
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
      value: toHtml(input.acceptanceCriteria),
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
