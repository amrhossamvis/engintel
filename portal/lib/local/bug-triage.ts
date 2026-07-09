/**
 * Server-only Bug Triage — direct-REST port of ado_copilot_bug_triage.py.
 * Two Copilot chat calls (signal extraction, then diagnosis synthesis) with
 * bug text, discussion history, linked PR diffs, and related closed user
 * stories inlined directly into the messages, an optional DataDog Logs
 * Search correlation, and docs/triage/team-map.yaml-based owning-team
 * routing — then posts the diagnosis back as a bug comment.
 *
 * The direct-REST Copilot chat-completions API (lib/copilot.ts) is text-only,
 * so unlike the CLI-subprocess original this cannot view screenshot/error
 * image attachments on the bug — signal extraction relies on the bug text,
 * discussion history, and linked-PR content only.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { runCopilotChat } from "@/lib/copilot";
import { adoTarget, parseWorkItemId } from "@/lib/ado";
import {
  addWorkItemComment,
  deleteWorkItemComment,
  getDiscussionHistory,
  getLatestPrIterationId,
  getPrChangedFiles,
  getPrItemContent,
  getPullRequestRecord,
  getWorkItemComments,
  getWorkItemRecord,
  stripHtml,
  workItemIdFromRelationUrl,
  type WorkItemRecord,
} from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { docsRoot, extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";

const TRIAGE_MARKER = "[COPILOT-TRIAGE]";
const REVIEWABLE_EXTENSIONS = [".java", ".kt", ".groovy", ".properties", ".js", ".ts", ".tsx", ".cs", ".py"];
const IGNORED_EXTENSIONS = [".xml", ".sql", ".yaml", ".yml", ".json", ".md", ".txt"];
const MAX_PRS_PER_BUG = 5;
const MAX_FILES_PER_PR = 20;
const MAX_FILE_CHARS = 60_000;
const MAX_RELATED_WORK_ITEMS = 20;
const MAX_RELATED_WI_TEXT = 30_000;
const MAX_DD_LOGS = 50;

const PR_ARTIFACT_PATTERN = /vstfs:\/\/\/Git\/PullRequestId\/([^/%]+)\/([^/%]+)\/(\d+)/i;
const TIL_SIGNAL = /\b(til|fmw|siebel|wcc|webmethods)\b/i;
const LOWER_ENV = /\b(sit|dev|int1|qc1|qa|uat|test)\b/i;

type Signals = { services: string[]; errors: string[]; ids: string[]; urls: string[]; env: string; timeFrom: string; timeTo: string };
type TeamMapTeam = {
  name?: string;
  area?: string;
  section?: string;
  teams_channel?: string;
  eng_manager?: string;
  lead_dev?: string;
  po?: string;
  services?: string[];
};
type TilRoute = { team?: string; use_when?: string; area_path?: string; distribution_list?: string; source_section?: string };
type TeamMap = { teams: TeamMapTeam[]; tilRouting: TilRoute[] };
type TeamMatch = { kind: "exact" | "shared" | "til" | "area" | "unmapped"; service: string | null; teams: TeamMapTeam[]; til: TilRoute[]; note: string };
type Diagnosis = { service: string; confidence: "high" | "medium" | "low"; evidence: string[]; recommendedAction: string };
type PrContext = { repoId: string; prId: number; title: string; description: string; status: string; sourceCommit: string; files: { path: string; content: string }[] };

const SIGNALS_SYSTEM_PROMPT = `You are triaging an Azure DevOps bug. Read the bug details, discussion history, related closed user stories, and linked pull requests provided by the user, and extract diagnostic signals.

Return JSON only with exactly this shape:
{ "services": string[], "errors": string[], "ids": string[], "urls": string[], "env": string, "timeWindow": { "from": string, "to": string } }

- env is one of prod/int1/qc1/sit/dev or "" if unknown.
- timeWindow uses DataDog syntax (e.g. "now-4h", "now").
- ids = correlation/trace/session/request IDs.
- Do not invent values; use "" or [] when unknown.
- Output ONLY raw JSON, no prose, no code fences.`;

const DIAGNOSIS_SYSTEM_PROMPT = `You are triaging an Azure DevOps bug. Read every piece of context provided by the user — the bug, its discussion history, linked pull requests, and the extracted signals / DataDog results / team match evidence — and produce a diagnosis.

Return JSON only with exactly this shape:
{ "service": string, "confidence": "high"|"medium"|"low", "evidence": string[], "recommendedAction": string }

Confidence: high = logs + a clear signal agree on one mapped service; medium = one strong signal or area-path agreement without logs; low = weak/conflicting or unmapped.
Base every evidence line on the provided data. Do not fabricate.
Output ONLY raw JSON, no prose, no code fences.`;

function truncate(text: string | undefined, maxLen: number): string {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "\n... [truncated]";
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

function isReviewable(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  if (IGNORED_EXTENSIONS.some((ext) => lowered.endsWith(ext))) return false;
  return REVIEWABLE_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

function isUserStoryLike(type: string): boolean {
  const v = (type ?? "").trim().toLowerCase();
  return ["user story", "product backlog item", "story", "requirement"].some((t) => v.includes(t));
}

function isClosedState(state: string): boolean {
  const v = (state ?? "").trim().toLowerCase();
  return ["closed", "done", "resolved", "completed", "removed"].includes(v);
}

// --- context loaders ---------------------------------------------------------

function extractLinkedPrRefs(bug: WorkItemRecord): { repoId: string; prId: number }[] {
  const results: { repoId: string; prId: number }[] = [];
  const seen = new Set<string>();
  for (const relation of bug.relations) {
    const name = String((relation.attributes as Record<string, unknown> | undefined)?.name ?? "");
    const decodedUrl = decodeURIComponent(relation.url ?? "");
    if (!name.toLowerCase().includes("pull request") && !decodedUrl.includes("PullRequestId")) continue;
    const match = decodedUrl.match(PR_ARTIFACT_PATTERN);
    if (!match) continue;
    const repoId = match[2];
    const prId = Number(match[3]);
    const key = `${repoId}:${prId}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ repoId, prId });
    }
  }
  return results;
}

function extractRelatedWorkItemIds(bug: WorkItemRecord): number[] {
  const ids = new Set<number>();
  for (const relation of bug.relations) {
    const id = workItemIdFromRelationUrl(relation.url ?? "");
    if (id && id !== bug.id) ids.add(id);
  }
  return [...ids];
}

async function loadLinkedPrContexts(
  refs: { repoId: string; prId: number }[],
  auth: string,
  emit: (line: string) => void,
): Promise<PrContext[]> {
  const contexts: PrContext[] = [];
  for (const ref of refs) {
    try {
      const pr = await getPullRequestRecord(ref.repoId, ref.prId, auth);
      const iterationId = await getLatestPrIterationId(ref.repoId, ref.prId, auth);
      const changedFiles = (await getPrChangedFiles(ref.repoId, ref.prId, iterationId, auth))
        .filter((f) => isReviewable(f.path))
        .slice(0, MAX_FILES_PER_PR);
      const files: { path: string; content: string }[] = [];
      for (const file of changedFiles) {
        try {
          const content = pr.sourceCommit ? await getPrItemContent(ref.repoId, file.path, pr.sourceCommit, auth) : "";
          files.push({ path: file.path, content: truncate(content, MAX_FILE_CHARS) });
        } catch {
          continue;
        }
      }
      contexts.push({
        repoId: ref.repoId,
        prId: ref.prId,
        title: pr.title,
        description: pr.description,
        status: pr.status,
        sourceCommit: pr.sourceCommit,
        files,
      });
    } catch (ex) {
      emit(`[ado] failed to load linked PR ${ref.prId}: ${ex instanceof Error ? ex.message : ex}`);
    }
  }
  return contexts.slice(0, MAX_PRS_PER_BUG);
}

async function loadRelatedClosedUserStories(ids: number[], auth: string): Promise<WorkItemRecord[]> {
  const items: WorkItemRecord[] = [];
  for (const id of ids) {
    try {
      const wi = await getWorkItemRecord(id, auth, false);
      if (isUserStoryLike(wi.type) && isClosedState(wi.state)) items.push(wi);
    } catch {
      continue;
    }
  }
  return items;
}

// --- DataDog -----------------------------------------------------------------

function buildDdQuery(signals: Signals): string {
  if (signals.ids.length) {
    const sid = signals.ids[0];
    return `@trace_id:${sid} OR @correlation_id:${sid} OR "${sid}"`;
  }
  if (signals.errors.length) return `"${signals.errors[0]}"`;
  if (signals.services.length) return `service:${signals.services[0]} status:error`;
  return "status:error";
}

async function searchDdLogs(query: string, timeFrom: string, timeTo: string): Promise<{ count: number; services: string[] }> {
  const ddAppKey = (process.env.DD_APP_KEY ?? "").trim();
  const ddApiKey = (process.env.DD_API_KEY ?? "").trim();
  const ddSite = (process.env.DD_SITE ?? "").trim() || "datadoghq.com";

  const headers: Record<string, string> = { "DD-APPLICATION-KEY": ddAppKey, "Content-Type": "application/json" };
  if (ddApiKey) headers["DD-API-KEY"] = ddApiKey;

  const res = await fetch(`https://api.${ddSite}/api/v2/logs/events/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filter: { query, from: timeFrom, to: timeTo }, sort: "-timestamp", page: { limit: MAX_DD_LOGS } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataDog logs search failed (HTTP ${res.status}) ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const logs: Record<string, unknown>[] = data?.data ?? [];
  const services: string[] = [];
  for (const entry of logs) {
    const svc = String((entry.attributes as Record<string, unknown> | undefined)?.service ?? "").trim();
    if (svc && !services.includes(svc)) services.push(svc);
  }
  return { count: logs.length, services };
}

// --- team-map ------------------------------------------------------------------

async function loadTeamMap(): Promise<TeamMap> {
  const filePath = path.join(docsRoot(), "triage", "team-map.yaml");
  const content = await fs.readFile(filePath, "utf-8");
  const doc = (loadYaml(content) ?? {}) as Record<string, unknown>;
  return {
    teams: (doc.teams as TeamMapTeam[]) ?? [],
    tilRouting: (doc.til_routing as TilRoute[]) ?? [],
  };
}

function matchTeam(services: string[], areaPath: string, env: string, tags: string, teamMap: TeamMap): TeamMatch {
  for (const svc of services) {
    const owners = teamMap.teams.filter((t) => (t.services ?? []).includes(svc));
    if (owners.length === 1) return { kind: "exact", service: svc, teams: owners, til: [], note: "" };
    if (owners.length > 1) {
      return { kind: "shared", service: svc, teams: owners, til: [], note: `Shared service "${svc}" owned by ${owners.length} teams` };
    }
  }

  const haystack = `${tags ?? ""} ${areaPath ?? ""} ${services.join(" ")}`;
  if (TIL_SIGNAL.test(haystack)) {
    const isLower = env ? LOWER_ENV.test(env) : false;
    const routing = teamMap.tilRouting;
    const til = isLower
      ? routing.filter((r) => /sit|dev/i.test(r.source_section ?? ""))
      : routing.filter((r) => /l2|prod/i.test(r.source_section ?? ""));
    if (til.length) {
      return { kind: "til", service: services[0] ?? null, teams: [], til, note: "Integration-layer signal -> TIL routing" };
    }
  }

  const segments = new Set(
    (areaPath ?? "")
      .split(/[\\/]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (segments.size) {
    const svc = services[0] ?? null;
    const nameOwners = teamMap.teams.filter((t) => segments.has((t.name ?? "").trim().toLowerCase()));
    if (nameOwners.length) return { kind: "area", service: svc, teams: nameOwners, til: [], note: "Matched by area path (team name)" };
    const areaOwners = teamMap.teams.filter((t) => segments.has((t.area ?? "").trim().toLowerCase()));
    if (areaOwners.length) {
      const note = areaOwners.length === 1 ? "Matched by area path (area)" : `Area shared by ${areaOwners.length} teams`;
      return { kind: "area", service: svc, teams: areaOwners, til: [], note };
    }
  }

  return { kind: "unmapped", service: services[0] ?? null, teams: [], til: [], note: "No exact service match" };
}

// --- Copilot prompts -----------------------------------------------------------

function buildBugSection(bug: WorkItemRecord): string {
  return `# Bug\n\n- ID: ${bug.id}\n- Type: ${bug.type}\n- State: ${bug.state}\n- Title: ${bug.title}\n- AreaPath: ${bug.areaPath}\n- Tags: ${bug.tags}\n\n## Description\n${bug.description || ""}\n\n## Repro Steps\n${bug.reproSteps || ""}`;
}

function buildRelatedItemsSection(items: WorkItemRecord[]): string {
  if (!items.length) return "No related closed user stories found.";
  return items
    .map(
      (item) =>
        `# Work Item ${item.id}\n- Type: ${item.type}\n- State: ${item.state}\n- Title: ${item.title}\n\n## Description\n${truncate(item.description, MAX_RELATED_WI_TEXT)}`,
    )
    .join("\n\n");
}

function buildPrsSection(prContexts: PrContext[]): string {
  if (!prContexts.length) return "No linked PRs found.";
  return prContexts
    .map((pr) => {
      const header = `## PR ${pr.prId} — repo ${pr.repoId}\n- Status: ${pr.status}\n- Source Commit: ${pr.sourceCommit}\n- Title: ${pr.title}\n\n### Description\n${stripHtml(pr.description) || ""}`;
      const files = pr.files.length
        ? pr.files.map((f) => `#### File: ${f.path}\n${f.content}`).join("\n\n")
        : "No reviewable changed files found.";
      return `${header}\n\n${files}`;
    })
    .join("\n\n---\n\n");
}

function buildSignalsUserMessage(bug: WorkItemRecord, discussion: string, relatedItems: WorkItemRecord[], prContexts: PrContext[]): string {
  return [
    buildBugSection(bug),
    "",
    "## Discussion / History",
    discussion || "No bug discussion/history found.",
    "",
    "## Related Closed User Stories",
    buildRelatedItemsSection(relatedItems),
    "",
    "## Linked Pull Requests",
    buildPrsSection(prContexts),
  ].join("\n");
}

function buildEvidenceSection(bug: WorkItemRecord, signals: Signals, ddCount: number, ddServices: string[], match: TeamMatch): string {
  const teamNames = match.teams.map((t) => t.name ?? "").filter(Boolean).join(", ") || "—";
  const tilNames = match.til.map((t) => t.team ?? "").filter(Boolean).join(", ") || "—";
  return [
    "# Triage Evidence",
    "",
    "## Bug",
    `- AreaPath: ${bug.areaPath}`,
    `- Tags: ${bug.tags}`,
    "",
    "## Extracted Signals",
    `- services: ${signals.services.join(", ") || "—"}`,
    `- errors: ${signals.errors.join(", ") || "—"}`,
    `- ids: ${signals.ids.join(", ") || "—"}`,
    `- urls: ${signals.urls.join(", ") || "—"}`,
    `- env: ${signals.env || "—"}`,
    `- timeWindow: ${signals.timeFrom} -> ${signals.timeTo}`,
    "",
    "## DataDog",
    `- logs matched: ${ddCount}`,
    `- services in logs: ${ddServices.join(", ") || "—"}`,
    "",
    "## Team Match",
    `- kind: ${match.kind}`,
    `- service: ${match.service || "—"}`,
    `- teams: ${teamNames}`,
    `- til: ${tilNames}`,
    `- note: ${match.note || "—"}`,
  ].join("\n");
}

function buildDiagnosisUserMessage(bug: WorkItemRecord, discussion: string, prContexts: PrContext[], evidenceSection: string): string {
  return [
    buildBugSection(bug),
    "",
    "## Discussion / History",
    discussion || "No bug discussion/history found.",
    "",
    "## Linked Pull Requests",
    buildPrsSection(prContexts),
    "",
    evidenceSection,
  ].join("\n");
}

function parseSignals(raw: string): Signals | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const root = loadCopilotJson(jsonStr) as Record<string, unknown>;
    const window = (root.timeWindow as Record<string, unknown>) ?? {};
    return {
      services: toStringArray(root.services),
      errors: toStringArray(root.errors),
      ids: toStringArray(root.ids),
      urls: toStringArray(root.urls),
      env: String(root.env ?? "").trim(),
      timeFrom: String(window.from ?? "now-4h").trim() || "now-4h",
      timeTo: String(window.to ?? "now").trim() || "now",
    };
  } catch {
    return null;
  }
}

function parseDiagnosis(raw: string, fallbackService: string): Diagnosis | null {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) return null;
  try {
    const root = loadCopilotJson(jsonStr) as Record<string, unknown>;
    let confidence = String(root.confidence ?? "low").trim().toLowerCase();
    if (!["high", "medium", "low"].includes(confidence)) confidence = "low";
    return {
      service: String(root.service ?? fallbackService ?? "unknown").trim() || "unknown",
      confidence: confidence as "high" | "medium" | "low",
      evidence: toStringArray(root.evidence),
      recommendedAction: String(root.recommendedAction ?? "").trim(),
    };
  } catch {
    return null;
  }
}

// --- comment -------------------------------------------------------------------

function buildTriageComment(diagnosis: Diagnosis | null, match: TeamMatch, ddCount: number): string {
  if (!diagnosis) return `${TRIAGE_MARKER}\n\nTriage could not be generated from the available evidence.`;

  const lines: string[] = [TRIAGE_MARKER, "", "Bug Triage", `Affected service: ${diagnosis.service} (confidence: ${diagnosis.confidence})`];

  if (["exact", "shared", "area"].includes(match.kind) && match.teams.length) {
    const owners = match.teams.map((t) => t.name ?? "").filter(Boolean).join(" / ");
    const area = match.teams[0]?.area ?? "";
    lines.push(`Owning team: ${owners}${area ? ` — ${area}` : ""}`);
    for (const team of match.teams) {
      const contacts: string[] = [];
      if (team.eng_manager) contacts.push(`Eng Mgr ${team.eng_manager}`);
      if (team.lead_dev) contacts.push(`Lead Dev ${team.lead_dev}`);
      if (team.po) contacts.push(`PO ${team.po}`);
      if (contacts.length) lines.push(`Contacts (${team.name}): ${contacts.join(" · ")}`);
      if (team.teams_channel) lines.push(`Teams channel: ${team.teams_channel}`);
    }
    if (["shared", "area"].includes(match.kind) && match.note) lines.push(`Note: ${match.note}`);
  } else if (match.kind === "til" && match.til.length) {
    lines.push("Owning team: Integration layer (TIL) — escalate");
    for (const route of match.til) {
      const dl = route.distribution_list ?? "";
      lines.push(`Escalate to: ${route.team}${dl ? ` (${dl})` : ""}`);
    }
  } else {
    lines.push("Owning team: Unmapped — manual routing required");
    if (match.note) lines.push(`Note: ${match.note}`);
  }

  if (diagnosis.evidence.length) {
    lines.push("", "Evidence:");
    lines.push(...diagnosis.evidence.slice(0, 6).map((e) => `- ${e}`));
  } else if (ddCount) {
    lines.push(`Evidence: ${ddCount} matching DataDog log(s)`);
  }

  if (diagnosis.recommendedAction) {
    lines.push("", "Recommended action:", diagnosis.recommendedAction);
  }

  return lines.join("\n").trim();
}

// --- orchestration ---------------------------------------------------------------

export async function runBugTriage(inputs: Record<string, string | boolean>, ctx: LocalCtx): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const bugUrl = typeof inputs.bugUrl === "string" ? inputs.bugUrl.trim() : "";
  if (!bugUrl) throw new Error("A bug URL is required.");
  const bugIdStr = parseWorkItemId(bugUrl);
  if (!bugIdStr) throw new Error(`Could not parse a work item id from: ${bugUrl}`);
  const bugId = Number(bugIdStr);
  const dryRun = Boolean(inputs.dryRun);

  emit(`[ado] loading bug ${bugId}…`);
  const bug = await getWorkItemRecord(bugId, adoAuth, true);
  if (bug.type.trim().toLowerCase() !== "bug") {
    throw new Error(`Work item ${bugId} is a ${bug.type || "unknown type"}, not a Bug.`);
  }

  emit("[ado] checking for an existing triage comment…");
  const comments = await getWorkItemComments(bugId, adoAuth);
  const existingTriage = comments.filter((c) => !c.isDeleted && c.text.includes(TRIAGE_MARKER));
  if (existingTriage.length) {
    if (dryRun) {
      emit(`[ado] dry run — would delete ${existingTriage.length} previous triage comment(s)`);
    } else {
      for (const c of existingTriage) {
        try {
          await deleteWorkItemComment(bugId, c.id, adoAuth);
        } catch {
          continue;
        }
      }
      emit(`[ado] deleted ${existingTriage.length} previous triage comment(s)`);
    }
  }

  emit("[ado] loading discussion history…");
  const discussion = await getDiscussionHistory(bugId, adoAuth);

  emit("[ado] loading linked pull requests…");
  const prRefs = extractLinkedPrRefs(bug).slice(0, MAX_PRS_PER_BUG);
  const prContexts = await loadLinkedPrContexts(prRefs, adoAuth, emit);
  emit(`[ado] ${prContexts.length} linked PR(s) loaded`);

  emit("[ado] loading related closed user stories…");
  const relatedIds = extractRelatedWorkItemIds(bug).slice(0, MAX_RELATED_WORK_ITEMS);
  const relatedItems = await loadRelatedClosedUserStories(relatedIds, adoAuth);
  emit(`[ado] ${relatedItems.length} related closed user stor(y/ies) found`);

  emit("[copilot] extracting diagnostic signals …");
  const signalsRaw = await runCopilotChat(
    SIGNALS_SYSTEM_PROMPT,
    buildSignalsUserMessage(bug, discussion, relatedItems, prContexts),
    githubToken,
  );
  const signals = parseSignals(signalsRaw) ?? { services: [], errors: [], ids: [], urls: [], env: "", timeFrom: "now-4h", timeTo: "now" };
  emit(`[copilot] signals: services=${signals.services.join(", ") || "none"} env=${signals.env || "unknown"}`);

  let ddCount = 0;
  let ddServices: string[] = [];
  const ddAppKey = (process.env.DD_APP_KEY ?? "").trim();
  if (ddAppKey) {
    try {
      const result = await searchDdLogs(buildDdQuery(signals), signals.timeFrom, signals.timeTo);
      ddCount = result.count;
      ddServices = result.services;
      emit(`[datadog] ${ddCount} log(s) matched, services=${ddServices.join(", ") || "none"}`);
    } catch (ex) {
      emit(`[datadog] query failed: ${ex instanceof Error ? ex.message : ex}`);
    }
  } else {
    emit("[datadog] skipped (DD_APP_KEY not configured on the server)");
  }

  const services = [...new Set([...ddServices, ...signals.services])];
  const teamMap = await loadTeamMap();
  const match = matchTeam(services, bug.areaPath, signals.env, bug.tags, teamMap);
  emit(`[triage] team match: ${match.kind} -> ${match.teams.map((t) => t.name).filter(Boolean).join(", ") || match.note}`);

  emit("[copilot] synthesizing diagnosis …");
  const evidenceSection = buildEvidenceSection(bug, signals, ddCount, ddServices, match);
  const fallbackService = match.service || services[0] || "unknown";
  const diagnosisRaw = await runCopilotChat(
    DIAGNOSIS_SYSTEM_PROMPT,
    buildDiagnosisUserMessage(bug, discussion, prContexts, evidenceSection),
    githubToken,
  );
  const diagnosis = parseDiagnosis(diagnosisRaw, fallbackService);

  const comment = buildTriageComment(diagnosis, match, ddCount);
  if (dryRun) {
    emit("[done] dry run — no triage comment posted");
  } else {
    await addWorkItemComment(bugId, comment, adoAuth);
    emit("[ado] triage comment posted");
  }

  const { org, project } = adoTarget();
  const webUrl = `https://dev.azure.com/${org}/${project}/_workitems/edit/${bugId}`;
  const teamLabel =
    match.teams.map((t) => t.name).filter(Boolean).join(", ") ||
    (match.til.length ? match.til.map((t) => t.team).filter(Boolean).join(", ") : match.kind);

  emit(`[done] ${diagnosis?.service ?? fallbackService} (${diagnosis?.confidence ?? "low"}) -> ${teamLabel}`);

  return {
    webUrl,
    dryRun,
    service: diagnosis?.service ?? fallbackService,
    confidence: diagnosis?.confidence ?? "low",
    team: teamLabel,
    matchKind: match.kind,
    linkedPrsCount: prContexts.length,
    relatedItemsCount: relatedItems.length,
    ddLogCount: ddCount,
  };
}
