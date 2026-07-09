/**
 * Server-only Azure DevOps client. Never import from a "use client" file.
 *
 * Auth: a per-user Microsoft Entra bearer minted from the host's Azure CLI
 * session (`az login`) — Azure CLI's first-party client is pre-consented for
 * ADO, so no app registration is needed. When `az` is absent or signed out,
 * calls fall back to the service `AZDO_PAT` (basic auth) for local dev / sim.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const pExecFile = promisify(execFile);

/**
 * Short, non-reversible fingerprint of an auth header. Used to key per-identity
 * caches so one user's ADO reads are never served to another. Never logged.
 */
export function authFingerprint(auth: string): string {
  return createHash("sha256").update(auth).digest("hex").slice(0, 16);
}

/** Azure DevOps resource app id — fixed across every tenant. */
const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

const ORG = process.env.ADO_ORG ?? "vfuk-digital";
const PROJECT = process.env.ADO_PROJECT ?? "Digital";
const API = "api-version=7.1-preview.1";

/** Branch the pipeline YAML is read from. Override until the YAML lands on main. */
const PIPELINE_BRANCH = process.env.PIPELINE_BRANCH ?? "refs/heads/main";

/** Hardcoded pipeline definition IDs (fallback when env var is not set) */
const PIPELINE_DEFAULTS: Record<string, number> = {
  "testcase-ado": 13634,
};

/** capabilityId → ADO pipeline definition id, from env (PIPELINE_<ID>) or hardcoded default */
export function pipelineIdFor(capabilityId: string): number | null {
  const key = "PIPELINE_" + capabilityId.toUpperCase().replace(/-/g, "_");
  const raw = process.env[key];
  const id = raw ? Number(raw) : NaN;
  if (Number.isFinite(id)) return id;
  return PIPELINE_DEFAULTS[capabilityId] ?? null;
}

/** capabilityId → git ref the pipeline YAML is read from, from env (PIPELINE_<ID>_BRANCH) or PIPELINE_BRANCH. */
export function pipelineBranchFor(capabilityId: string): string {
  const key = "PIPELINE_" + capabilityId.toUpperCase().replace(/-/g, "_") + "_BRANCH";
  const raw = process.env[key]?.trim();
  if (!raw) return PIPELINE_BRANCH;
  return raw.startsWith("refs/") ? raw : `refs/heads/${raw}`;
}

export function adoConfigured(): boolean {
  return Boolean(process.env.AZDO_PAT);
}

/** Resolved ADO org + project this hub targets. */
export function adoTarget(): { org: string; project: string } {
  return { org: ORG, project: PROJECT };
}

/** Basic auth header from an ADO PAT (per-user PAT or the service fallback). */
export function basicFromPat(pat: string): string {
  return "Basic " + Buffer.from(":" + pat).toString("base64");
}

function authHeader(): string {
  return basicFromPat(process.env.AZDO_PAT ?? "");
}

/**
 * Auth header for ADO data reads. Precedence: the caller's own PAT (multi-user
 * hub) → the host's `az login` bearer (local dev) → the service PAT (env / sim).
 */
export async function adoReadAuthHeader(userPat?: string): Promise<string> {
  if (userPat) return basicFromPat(userPat);
  return (await azAdoBearer()) ?? basicFromPat(process.env.AZDO_PAT ?? "");
}

/** True when ADO reads can authenticate — via a user PAT, `az login`, OR a service PAT. */
export async function adoReadable(userPat?: string): Promise<boolean> {
  if (userPat) return true;
  if (process.env.AZDO_PAT) return true;
  return (await azAdoBearer()) != null;
}

/**
 * Validate a per-user ADO PAT and return the signed-in identity. Uses the
 * connectionData endpoint — cheap, read-only, and works with a Code/Work-Items
 * scoped token.
 */
export async function validateAdoPat(
  pat: string,
): Promise<{ valid: boolean; name?: string }> {
  if (!pat || pat.trim().length < 8) return { valid: false };
  try {
    const res = await fetch(
      `https://dev.azure.com/${encodeURIComponent(ORG)}/_apis/connectionData?api-version=7.1-preview`,
      { headers: { Authorization: basicFromPat(pat.trim()) }, cache: "no-store" },
    );
    if (!res.ok) return { valid: false };
    const data = await res.json();
    const name =
      data?.authenticatedUser?.providerDisplayName ??
      data?.authenticatedUser?.customDisplayName ??
      undefined;
    // An unauthenticated PAT still returns 200 but resolves to the anonymous
    // identity — treat a missing/anonymous display name as invalid.
    if (!name || name === "Anonymous") return { valid: false };
    return { valid: true, name };
  } catch {
    return { valid: false };
  }
}

/**
 * ADO bearer from the host's Azure CLI session (`az login`). null when `az` is
 * missing or signed out, so callers fall back to the service PAT. Tokens are
 * short-lived — acquire fresh per request.
 */
export async function azAdoBearer(): Promise<string | null> {
  try {
    const { stdout } = await pExecFile(
      "az",
      ["account", "get-access-token", "--resource", ADO_RESOURCE, "--query", "accessToken", "-o", "tsv"],
      { timeout: 15000 },
    );
    const token = stdout.trim();
    return token ? `Bearer ${token}` : null;
  } catch {
    return null;
  }
}

/** Display name of the Azure CLI signed-in user, or null when signed out. */
export async function azWhoami(): Promise<string | null> {
  try {
    const { stdout } = await pExecFile("az", ["account", "show", "--query", "user.name", "-o", "tsv"], {
      timeout: 10000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function base(): string {
  return `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_apis/pipelines`;
}

function buildBase(): string {
  return `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_apis/build/builds`;
}

export type StepState = { name: string; state: string; result?: string };

export type RunDetail = {
  steps: StepState[];
  currentStep: string | null;
  logTail: string[];
};

/** ADO log lines are prefixed with an ISO timestamp — strip it for display. */
function stripTs(line: string): string {
  return line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, "");
}

/**
 * Live build detail: ordered step states + a tail of the active step's log.
 * The pipeline run id equals the build id, so the Build API works directly.
 */
export async function getRunDetail(buildId: number, auth?: string): Promise<RunDetail | null> {
  const headers = { Authorization: auth ?? authHeader() };
  const tl = await fetch(`${buildBase()}/${buildId}/timeline?api-version=7.1-preview.2`, {
    headers,
    cache: "no-store",
  });
  if (!tl.ok) return null;

  const json = await tl.json();
  const tasks: Array<{
    type: string;
    name: string;
    state: string;
    result?: string;
    order?: number;
    log?: { id: number };
  }> = (json.records ?? []).filter((r: { type: string }) => r.type === "Task");
  tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const steps: StepState[] = tasks.map((t) => ({
    name: t.name,
    state: t.state,
    result: t.result,
  }));

  const active =
    tasks.find((t) => t.state === "inProgress") ??
    [...tasks].reverse().find((t) => t.result === "failed") ??
    tasks[tasks.length - 1];

  let logTail: string[] = [];
  if (active?.log?.id) {
    const lg = await fetch(`${buildBase()}/${buildId}/logs/${active.log.id}?api-version=7.1-preview.2`, {
      headers,
      cache: "no-store",
    });
    if (lg.ok) {
      const txt = await lg.text();
      logTail = txt
        .split("\n")
        .map(stripTs)
        .filter((l) => l.trim().length > 0)
        .slice(-40);
    }
  }

  return { steps, currentStep: active?.name ?? null, logTail };
}

export type ParsedPr = { org: string; project: string; repo: string; prId: string };

/**
 * Parse an ADO pull request URL. Supports both formats:
 *  - https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}
 *  - https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{prId}
 */
export function parsePrUrl(url: string): ParsedPr | null {
  try {
    const u = new URL(url);

    // Format 1: dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
    if (u.hostname === "dev.azure.com") {
      const m = u.pathname.match(
        /\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i,
      );
      if (!m) return null;
      return {
        org: decodeURIComponent(m[1]),
        project: decodeURIComponent(m[2]),
        repo: decodeURIComponent(m[3]),
        prId: m[4],
      };
    }

    // Format 2: {org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{id}
    if (u.hostname.endsWith(".visualstudio.com")) {
      const org = u.hostname.replace(".visualstudio.com", "");
      const m = u.pathname.match(
        /\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i,
      );
      if (!m) return null;
      return {
        org,
        project: decodeURIComponent(m[1]),
        repo: decodeURIComponent(m[2]),
        prId: m[3],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** Extract a work-item id from any ADO work-item URL form, or a bare id. */
export function parseWorkItemId(url: string): string | null {
  const trimmed = url.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    const q = u.searchParams.get("workitem");
    if (q && /^\d+$/.test(q)) return q;
    const m = u.pathname.match(/(?:_workitems\/edit|workItems)\/(\d+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export type RunResult = {
  runId: number;
  state: string; // "inProgress" | "completed" | "unknown"
  result?: string; // "succeeded" | "failed" | "canceled"
  webUrl?: string;
};

export async function runPipeline(
  pipelineId: number,
  templateParameters: Record<string, string | boolean>,
  secretVariables: Record<string, string>,
  auth?: string,
  refName: string = PIPELINE_BRANCH,
): Promise<RunResult> {
  const variables: Record<string, { value: string; isSecret: true }> = {};
  for (const [k, v] of Object.entries(secretVariables)) {
    variables[k] = { value: v, isSecret: true };
  }

  const body = {
    templateParameters,
    variables,
    resources: { repositories: { self: { refName } } },
  };

  const res = await fetch(`${base()}/${pipelineId}/runs?${API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth ?? authHeader() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[ado] run failed", {
      status: res.status,
      url: `${base()}/${pipelineId}/runs`,
      authScheme: (auth ?? authHeader()).split(" ")[0],
      wwwAuthenticate: res.headers.get("www-authenticate"),
      tfsError: res.headers.get("x-tfs-serviceerror"),
      body: text.slice(0, 500),
    });
    throw new Error(
      `ADO run failed (${res.status}): ${text.slice(0, 200) || res.headers.get("x-tfs-serviceerror") || "no body"}`,
    );
  }

  const json = await res.json();
  return {
    runId: json.id,
    state: json.state ?? "unknown",
    result: json.result,
    webUrl: json._links?.web?.href,
  };
}

export async function getRunStatus(
  pipelineId: number,
  runId: number,
  auth?: string,
): Promise<RunResult> {
  const res = await fetch(`${base()}/${pipelineId}/runs/${runId}?${API}`, {
    headers: { Authorization: auth ?? authHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADO status failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return {
    runId: json.id,
    state: json.state ?? "unknown",
    result: json.result,
    webUrl: json._links?.web?.href,
  };
}
