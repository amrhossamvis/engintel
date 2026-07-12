/**
 * Server-only PR Impact Analyzer.
 *
 * Reads a backend PR, detects impacted API endpoints, and returns a
 * confidence-scored monitoring plan for operations. Confidence is derived from
 * direct PR evidence first, then boosted when linked cross-repo PRs and
 * optional context repositories reinforce the same endpoint surface.
 */

import { runCopilotChat } from "@/lib/copilot";
import { parsePrUrl } from "@/lib/ado";
import {
  deletePrComment,
  getLatestPrIterationId,
  getPrChangedFiles,
  getPrLinkedWorkItemIds,
  getPullRequestRecord,
  getRepoItemContent,
  getWorkItemRecord,
  listPrThreads,
  loadPrFileContexts,
  postPrGeneralComment,
  type PrFileContext,
} from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";

const PR_ARTIFACT_PATTERN = /vstfs:\/\/\/Git\/PullRequestId\/([^/%]+)\/([^/%]+)\/(\d+)/i;
const MAX_PRIMARY_FILES = 40;
const MAX_LINKED_PRS = 6;
const MAX_LINKED_PR_FILES = 14;
const MAX_ENDPOINTS = 20;
const IMPACT_MARKER = "[COPILOT-POC-PR-IMPACT]";
const IMPACT_REF_PATTERN = /\[IMPACT-REF:\s*I(\d+)/i;

const BACKEND_EXTENSIONS = [
  ".java",
  ".kt",
  ".groovy",
  ".cs",
  ".go",
  ".py",
  ".rb",
  ".php",
  ".js",
  ".ts",
  ".scala",
  ".rs",
];

const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

type EndpointEvidence = {
  source: "primary-pr" | "linked-pr" | "context-repo";
  detail: string;
};

type EndpointHit = {
  method: string;
  path: string;
  files: Set<string>;
  primaryMentions: number;
  linkedMentions: number;
  contextMentions: number;
  evidences: EndpointEvidence[];
};

type EndpointRecommendation = {
  method: string;
  path: string;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  impactLevel: "critical" | "high" | "medium";
  evidence: string[];
  monitoringRecommendations: string[];
};

export type PrImpactOutput = {
  webUrl: string;
  prCommentPosted: boolean;
  prCommentError?: string;
  impactRef?: string;
  summary: {
    primaryRepo: string;
    totalEndpoints: number;
    crossRepoSignals: number;
    overallConfidence: number;
  };
  impactedEndpoints: EndpointRecommendation[];
};

async function tryPostImpactComment(
  repo: string,
  prId: string,
  content: string,
  adoAuth: string,
  emit: (line: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await postPrGeneralComment(repo, prId, content, adoAuth);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    emit(`[warn] failed to post PR impact summary comment: ${error}`);
    return { ok: false, error };
  }
}

function buildImpactComment(
  prId: string,
  prTitle: string,
  impactRef: string,
  summary: PrImpactOutput["summary"],
  endpoints: EndpointRecommendation[],
): string {
  const lines: string[] = [
    `${IMPACT_MARKER} [IMPACT-REF: ${impactRef}]`,
    "",
    `Automated PR impact analysis for PR ${prId}`,
    `**Impact reference:** ${impactRef}`,
    `**PR title:** ${prTitle}`,
    `**Primary repo:** ${summary.primaryRepo}`,
    `**Overall confidence:** ${Math.round(summary.overallConfidence * 100)}%`,
    `**Impacted endpoints:** ${summary.totalEndpoints}`,
    `**Cross-repo signals:** ${summary.crossRepoSignals}`,
    "",
  ];

  if (!endpoints.length) {
    lines.push("No API-facing endpoints were confidently detected from this PR context.");
    return lines.join("\n");
  }

  lines.push("**Monitoring focus by endpoint:**");
  for (const ep of endpoints.slice(0, 12)) {
    lines.push(
      `- ${ep.method} ${ep.path} · confidence ${Math.round(ep.confidenceScore * 100)}% (${ep.confidenceLabel}) · impact ${ep.impactLevel}`,
    );
    for (const reco of ep.monitoringRecommendations.slice(0, 2)) {
      lines.push(`  - ${reco}`);
    }
  }

  return lines.join("\n");
}

function isBackendFile(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  return BACKEND_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

function parseContextRepos(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function normalizePath(rawPath: string): string {
  let p = rawPath.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+/g, "/");
  p = p.replace(/\/$/, "") || "/";
  return p;
}

function endpointKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path).toLowerCase()}`;
}

function parseEndpointsFromText(text: string): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  const push = (method: string, path: string) => {
    if (!path || path.includes(" ")) return;
    out.push({ method: method.toUpperCase(), path: normalizePath(path) });
  };

  const springPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*\(([^)]*)\)/g;
  for (const m of text.matchAll(springPattern)) {
    const ann = m[1] ?? "";
    const args = m[2] ?? "";
    const methodMatch = args.match(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/i);
    const pathMatch = args.match(/["'`]([^"'`]+)["'`]/);
    const method = methodMatch?.[1] ?? ann.replace("Mapping", "").replace("Request", "ANY");
    if (pathMatch?.[1]) push(method, pathMatch[1]);
  }

  const httpDecorators = /@(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const m of text.matchAll(httpDecorators)) push(m[1] ?? "ANY", m[2] ?? "");

  const expressRouter = /\b(?:router|app)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const m of text.matchAll(expressRouter)) push(m[1] ?? "ANY", m[2] ?? "");

  const aspNet = /\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete|Route)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const m of text.matchAll(aspNet)) {
    const token = m[1] ?? "Route";
    const method = token.replace("Http", "").replace("Route", "ANY");
    push(method, m[2] ?? "");
  }

  const fastApi = /@(\w+)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const m of text.matchAll(fastApi)) push(m[2] ?? "ANY", m[3] ?? "");

  const django = /\bpath\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const m of text.matchAll(django)) push("ANY", m[1] ?? "");

  const openApiPair = /\b(get|post|put|patch|delete|options|head):\s*\n/gi;
  const pathLine = /^\s{0,8}(\/[a-zA-Z0-9_\-{}\/.:]+):\s*$/gm;
  const paths: string[] = [];
  for (const m of text.matchAll(pathLine)) paths.push(m[1]);
  if (paths.length) {
    const methods = Array.from(text.matchAll(openApiPair)).map((m) => (m[1] ?? "").toUpperCase());
    for (const p of paths.slice(0, 80)) {
      if (methods.length) {
        for (const method of methods.slice(0, 10)) push(method, p);
      } else {
        push("ANY", p);
      }
    }
  }

  return out.filter((e) => HTTP_VERBS.includes(e.method as (typeof HTTP_VERBS)[number]) || e.method === "ANY");
}

function upsertHit(
  map: Map<string, EndpointHit>,
  endpoint: { method: string; path: string },
  filePath: string,
  evidence: EndpointEvidence,
): void {
  const key = endpointKey(endpoint.method, endpoint.path);
  const existing = map.get(key);
  if (existing) {
    existing.files.add(filePath);
    if (evidence.source === "primary-pr") existing.primaryMentions += 1;
    if (evidence.source === "linked-pr") existing.linkedMentions += 1;
    if (evidence.source === "context-repo") existing.contextMentions += 1;
    existing.evidences.push(evidence);
    return;
  }
  map.set(key, {
    method: endpoint.method.toUpperCase(),
    path: normalizePath(endpoint.path),
    files: new Set([filePath]),
    primaryMentions: evidence.source === "primary-pr" ? 1 : 0,
    linkedMentions: evidence.source === "linked-pr" ? 1 : 0,
    contextMentions: evidence.source === "context-repo" ? 1 : 0,
    evidences: [evidence],
  });
}

function collectFromFileContexts(
  contexts: PrFileContext[],
  source: "primary-pr" | "linked-pr",
  map: Map<string, EndpointHit>,
): void {
  for (const fc of contexts) {
    const diffEndpoints = parseEndpointsFromText(fc.text);
    for (const ep of diffEndpoints) {
      upsertHit(map, ep, fc.path, {
        source,
        detail: `${source === "primary-pr" ? "Primary" : "Linked"} PR diff contains route signature in ${fc.path}`,
      });
    }

    const fullEndpoints = parseEndpointsFromText(fc.newContent);
    for (const ep of fullEndpoints.slice(0, 80)) {
      upsertHit(map, ep, fc.path, {
        source,
        detail: `${source === "primary-pr" ? "Primary" : "Linked"} PR file context contains route declaration in ${fc.path}`,
      });
    }
  }
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.8) return "high";
  if (score >= 0.62) return "medium";
  return "low";
}

function impactLevel(score: number, method: string): "critical" | "high" | "medium" {
  const writeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (score >= 0.86 && writeMethod) return "critical";
  if (score >= 0.7) return "high";
  return "medium";
}

function buildMonitoringRecommendations(method: string, path: string): string[] {
  const base = [
    `Track request volume and error-rate split for ${method} ${path}`,
    `Track p95/p99 latency and saturation for ${method} ${path}`,
    "Alert on upstream dependency timeout and 5xx spikes",
    "Correlate logs/traces by endpoint label and deployment version",
  ];
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    base.push("Add alert for write-failure ratio and retry burst patterns");
  }
  return base;
}

async function gatherLinkedPrContexts(
  repo: string,
  prId: string,
  adoAuth: string,
  emit: (line: string) => void,
): Promise<PrFileContext[]> {
  const linkedWorkItemIds = await getPrLinkedWorkItemIds(repo, prId, adoAuth);
  if (!linkedWorkItemIds.length) return [];

  const prRefs: Array<{ repoId: string; prId: number }> = [];
  const seen = new Set<string>();
  for (const id of linkedWorkItemIds.slice(0, 20)) {
    try {
      const wi = await getWorkItemRecord(id, adoAuth, true);
      for (const rel of wi.relations) {
        const decoded = decodeURIComponent(rel.url ?? "");
        const m = decoded.match(PR_ARTIFACT_PATTERN);
        if (!m) continue;
        const refRepo = m[2];
        const refPrId = Number(m[3]);
        if (refRepo === repo && String(refPrId) === String(prId)) continue;
        const key = `${refRepo}:${refPrId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        prRefs.push({ repoId: refRepo, prId: refPrId });
      }
    } catch {
      continue;
    }
  }

  if (!prRefs.length) return [];
  emit(`[ado] found ${prRefs.length} linked cross-repo PR reference(s) from linked work items`);

  const contexts: PrFileContext[] = [];
  for (const ref of prRefs.slice(0, MAX_LINKED_PRS)) {
    try {
      const linkedPr = await getPullRequestRecord(ref.repoId, ref.prId, adoAuth);
      const iter = await getLatestPrIterationId(ref.repoId, ref.prId, adoAuth);
      const files = (await getPrChangedFiles(ref.repoId, ref.prId, iter, adoAuth)).filter((f) => isBackendFile(f.path));
      const loaded = await loadPrFileContexts(
        ref.repoId,
        ref.prId,
        files,
        linkedPr.sourceCommit,
        linkedPr.targetCommit,
        adoAuth,
        MAX_LINKED_PR_FILES,
      );
      contexts.push(...loaded);
    } catch {
      continue;
    }
  }

  return contexts;
}

async function enrichWithContextRepos(
  repos: string[],
  adoAuth: string,
  endpointMap: Map<string, EndpointHit>,
  emit: (line: string) => void,
): Promise<void> {
  if (!repos.length || !endpointMap.size) return;

  const branchCandidates = ["refs/heads/main", "refs/heads/master"];
  const filesToProbe = [
    "/README.md",
    "/openapi.yaml",
    "/openapi.yml",
    "/swagger.yaml",
    "/swagger.yml",
    "/docs/openapi.yaml",
    "/docs/openapi.yml",
    "/src/main/resources/openapi.yaml",
  ];

  for (const repo of repos) {
    let corpus = "";
    for (const branch of branchCandidates) {
      for (const probePath of filesToProbe) {
        try {
          const content = await getRepoItemContent(repo, probePath, branch, adoAuth);
          if (content.trim()) {
            corpus += `\n\n# ${repo}:${probePath}\n${content.slice(0, 12000)}`;
          }
        } catch {
          continue;
        }
      }
      if (corpus.trim()) break;
    }

    if (!corpus.trim()) {
      emit(`[ado] context repo ${repo}: no probe files found on main/master`);
      continue;
    }

    let matched = 0;
    for (const hit of endpointMap.values()) {
      const needle = `${hit.path}:`;
      const altNeedle = `\"${hit.path}\"`;
      if (corpus.includes(needle) || corpus.includes(altNeedle)) {
        hit.contextMentions += 1;
        hit.evidences.push({
          source: "context-repo",
          detail: `Context repo ${repo} references endpoint path ${hit.path}`,
        });
        matched += 1;
      }
    }
    emit(`[ado] context repo ${repo}: matched ${matched} endpoint path reference(s)`);
  }
}

async function refineWithCopilot(
  githubToken: string,
  primaryPrTitle: string,
  endpoints: EndpointRecommendation[],
): Promise<EndpointRecommendation[]> {
  if (!endpoints.length) return [];

  const systemPrompt = `You are an SRE-focused backend PR impact analyzer.
Refine endpoint confidence and monitoring recommendations from the input endpoint candidates.

Rules:
- Keep only endpoints that are likely API-facing and operationally monitorable.
- Preserve method/path exactly.
- confidenceScore is 0..1 and should only move slightly (+/- 0.08 max from provided base score).
- If evidence is weak, lower confidence.
- Provide 2-4 concise monitoring recommendations per endpoint.
- Return JSON only, no markdown.

Output schema:
{
  "impactedEndpoints": [
    {
      "method": "GET",
      "path": "/api/v1/orders/{id}",
      "confidenceScore": 0.0,
      "confidenceLabel": "high|medium|low",
      "impactLevel": "critical|high|medium",
      "evidence": ["..."],
      "monitoringRecommendations": ["..."]
    }
  ]
}`;

  const userPrompt = `PR title: ${primaryPrTitle}\n\nEndpoint candidates:\n${JSON.stringify(endpoints, null, 2)}`;

  try {
    const raw = await runCopilotChat(systemPrompt, userPrompt, githubToken);
    const json = extractJsonObject(raw);
    if (!json) return endpoints;
    const parsed = loadCopilotJson(json) as { impactedEndpoints?: EndpointRecommendation[] };
    if (!Array.isArray(parsed.impactedEndpoints) || !parsed.impactedEndpoints.length) return endpoints;

    const byKey = new Map(endpoints.map((e) => [endpointKey(e.method, e.path), e]));
    const refined: EndpointRecommendation[] = [];
    for (const candidate of parsed.impactedEndpoints.slice(0, MAX_ENDPOINTS)) {
      const base = byKey.get(endpointKey(candidate.method, candidate.path));
      if (!base) continue;
      const rawScore = Number(candidate.confidenceScore);
      const bounded = Number.isFinite(rawScore)
        ? Math.max(base.confidenceScore - 0.08, Math.min(base.confidenceScore + 0.08, rawScore))
        : base.confidenceScore;
      const rounded = Math.round(Math.max(0.25, Math.min(0.98, bounded)) * 100) / 100;
      refined.push({
        method: base.method,
        path: base.path,
        confidenceScore: rounded,
        confidenceLabel: confidenceLabel(rounded),
        impactLevel: candidate.impactLevel ?? base.impactLevel,
        evidence: Array.isArray(candidate.evidence) && candidate.evidence.length ? candidate.evidence.slice(0, 4) : base.evidence,
        monitoringRecommendations:
          Array.isArray(candidate.monitoringRecommendations) && candidate.monitoringRecommendations.length
            ? candidate.monitoringRecommendations.slice(0, 4)
            : base.monitoringRecommendations,
      });
    }

    return refined.length ? refined : endpoints;
  } catch {
    return endpoints;
  }
}

export async function runPrImpactAnalyzer(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, adoAuth, githubToken } = ctx;

  const prUrl = typeof inputs.prUrl === "string" ? inputs.prUrl.trim() : "";
  if (!prUrl) throw new Error("A pull request URL is required.");

  const parsed = parsePrUrl(prUrl);
  if (!parsed) throw new Error(`Could not parse a pull request URL from: ${prUrl}`);
  const { repo, prId } = parsed;

  const contextReposInput = typeof inputs.contextRepos === "string" ? inputs.contextRepos : "";
  const contextRepos = parseContextRepos(contextReposInput);

  emit(`[ado] loading PR ${prId} in ${repo}...`);
  const pr = await getPullRequestRecord(repo, prId, adoAuth);
  if (!pr.sourceCommit) throw new Error("Could not resolve the PR source commit.");

  emit("[ado] computing next impact reference...");
  let threads: Awaited<ReturnType<typeof listPrThreads>> = [];
  try {
    threads = await listPrThreads(repo, prId, adoAuth);
  } catch (e) {
    emit(`[warn] could not load existing PR threads for impact reference: ${e instanceof Error ? e.message : String(e)}`);
  }
  let nextImpactNumber = 0;
  for (const t of threads) {
    for (const c of t.comments) {
      if (!c.content.includes(IMPACT_MARKER)) continue;
      const m = c.content.match(IMPACT_REF_PATTERN);
      if (m) nextImpactNumber = Math.max(nextImpactNumber, Number(m[1]));
    }
  }
  const impactRef = `I${String(nextImpactNumber + 1).padStart(3, "0")}-PR${prId}`;

  emit("[ado] deleting previous impact summary comments...");
  let deleted = 0;
  for (const t of threads) {
    for (const c of t.comments) {
      if (!c.content.includes(IMPACT_MARKER)) continue;
      try {
        await deletePrComment(repo, prId, t.id, c.id, adoAuth);
        deleted += 1;
      } catch {
        continue;
      }
    }
  }
  emit(`[ado] deleted ${deleted} previous impact summary comment(s)`);

  const iterationId = await getLatestPrIterationId(repo, prId, adoAuth);
  const changed = (await getPrChangedFiles(repo, prId, iterationId, adoAuth)).filter((f) => isBackendFile(f.path));
  if (!changed.length) {
    const emptySummary: PrImpactOutput["summary"] = {
      primaryRepo: repo,
      totalEndpoints: 0,
      crossRepoSignals: 0,
      overallConfidence: 0,
    };
    const posted = await tryPostImpactComment(
      repo,
      prId,
      buildImpactComment(String(prId), pr.title, impactRef, emptySummary, []),
      adoAuth,
      emit,
    );
    emit("[done] no backend file changes detected in this PR");
    return {
      webUrl: pr.webUrl,
      prCommentPosted: posted.ok,
      prCommentError: posted.ok ? undefined : posted.error,
      impactRef,
      summary: emptySummary,
      impactedEndpoints: [],
    } satisfies PrImpactOutput;
  }

  emit(`[ado] loading backend file contexts (${Math.min(changed.length, MAX_PRIMARY_FILES)} files)...`);
  const primaryContexts = await loadPrFileContexts(
    repo,
    prId,
    changed,
    pr.sourceCommit,
    pr.targetCommit,
    adoAuth,
    MAX_PRIMARY_FILES,
  );

  const endpointMap = new Map<string, EndpointHit>();
  collectFromFileContexts(primaryContexts, "primary-pr", endpointMap);
  emit(`[analysis] extracted ${endpointMap.size} endpoint candidate(s) from primary PR`);

  const linkedContexts = await gatherLinkedPrContexts(repo, prId, adoAuth, emit);
  if (linkedContexts.length) {
    collectFromFileContexts(linkedContexts, "linked-pr", endpointMap);
    emit(`[analysis] cross-repo linked PR context added (${linkedContexts.length} files)`);
  }

  if (contextRepos.length) {
    emit(`[ado] probing ${contextRepos.length} context repo(s) for OpenAPI/README references...`);
    await enrichWithContextRepos(contextRepos, adoAuth, endpointMap, emit);
  }

  const preRanked = Array.from(endpointMap.values())
    .map((hit): EndpointRecommendation => {
      const fileSpreadBoost = Math.min(0.12, (hit.files.size - 1) * 0.04);
      const primaryBoost = Math.min(0.28, hit.primaryMentions * 0.07);
      const linkedBoost = Math.min(0.16, hit.linkedMentions * 0.04);
      const contextBoost = Math.min(0.12, hit.contextMentions * 0.06);
      const methodBoost = hit.method === "ANY" ? 0 : 0.04;
      const raw = 0.42 + fileSpreadBoost + primaryBoost + linkedBoost + contextBoost + methodBoost;
      const score = Math.round(Math.max(0.3, Math.min(0.98, raw)) * 100) / 100;
      const evidence = hit.evidences.map((e) => e.detail).slice(0, 5);

      return {
        method: hit.method,
        path: hit.path,
        confidenceScore: score,
        confidenceLabel: confidenceLabel(score),
        impactLevel: impactLevel(score, hit.method),
        evidence,
        monitoringRecommendations: buildMonitoringRecommendations(hit.method, hit.path),
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, MAX_ENDPOINTS);

  const refined = await refineWithCopilot(githubToken, pr.title, preRanked);
  const finalEndpoints = refined
    .map((ep) => ({
      ...ep,
      confidenceScore: Math.round(Math.max(0.3, Math.min(0.98, ep.confidenceScore)) * 100) / 100,
      confidenceLabel: confidenceLabel(ep.confidenceScore),
    }))
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, MAX_ENDPOINTS);

  const crossRepoSignals = finalEndpoints.reduce((acc, e) => {
    const hit = endpointMap.get(endpointKey(e.method, e.path));
    return acc + (hit?.linkedMentions ?? 0) + (hit?.contextMentions ?? 0);
  }, 0);
  const avg = finalEndpoints.length
    ? finalEndpoints.reduce((sum, e) => sum + e.confidenceScore, 0) / finalEndpoints.length
    : 0;
  const overallConfidence = Math.round(avg * 100) / 100;

  emit(
    `[done] analyzed ${primaryContexts.length} primary file(s), identified ${finalEndpoints.length} impacted endpoint(s), overall confidence ${Math.round(overallConfidence * 100)}%`,
  );

  const summary: PrImpactOutput["summary"] = {
    primaryRepo: repo,
    totalEndpoints: finalEndpoints.length,
    crossRepoSignals,
    overallConfidence,
  };

  emit("[ado] posting impact analysis summary comment to PR...");
  const posted = await tryPostImpactComment(
    repo,
    prId,
    buildImpactComment(String(prId), pr.title, impactRef, summary, finalEndpoints),
    adoAuth,
    emit,
  );

  return {
    webUrl: pr.webUrl,
    prCommentPosted: posted.ok,
    prCommentError: posted.ok ? undefined : posted.error,
    impactRef,
    summary,
    impactedEndpoints: finalEndpoints,
  } satisfies PrImpactOutput;
}
