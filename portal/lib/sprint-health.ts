/**
 * Server-only Sprint Health Coach — pure heuristic scoring over ADO work items
 * and PRs, no AI call. Ported from ado_sprint_health_coach.py's Config/
 * WorkItem/evaluate_health flow, adapted to return JSON directly instead of
 * writing markdown/JSON files and setting pipeline variables (there's no
 * pipeline in this hub — this is a "hub-inline" read-only capability, exactly
 * like Executive Dashboard / AI Productivity Index).
 */

import { adoReadAuthHeader, adoTarget } from "@/lib/ado";
import { adoFetchJson, adoPostJson } from "@/lib/ado-http";

const DEFAULT_STALE_DAYS = 3;
const DEFAULT_BLOCKED_DAYS = 2;
const DEFAULT_PR_WAIT_DAYS = 2;
const DEFAULT_MAX_WIP_PER_ENGINEER = 3;

const DONE_STATES = new Set(["done", "closed", "resolved", "completed", "removed"]);
const IN_PROGRESS_STATES = new Set([
  "active",
  "in progress",
  "committed",
  "implementing",
  "doing",
  "in review",
  "ready for test",
  "testing",
]);
const NOT_STARTED_STATES = new Set(["new", "approved", "to do", "committed backlog", "proposed"]);
const BLOCKED_TAG_HINTS = ["blocked", "impediment", "dependency", "waiting", "hold"];

function normalizeState(state: string): string {
  return (state ?? "").trim().toLowerCase();
}
function isDoneState(state: string): boolean {
  return DONE_STATES.has(normalizeState(state));
}
function isInProgressState(state: string): boolean {
  const n = normalizeState(state);
  return IN_PROGRESS_STATES.has(n) || (!DONE_STATES.has(n) && !NOT_STARTED_STATES.has(n) && n.length > 0);
}
function isNotStartedState(state: string): boolean {
  return NOT_STARTED_STATES.has(normalizeState(state));
}

function daysBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoGet(url: string, auth: string): Promise<any> {
  return adoFetchJson(url, auth);
}

type IterationInfo = {
  name: string;
  path: string;
  startDate: Date | null;
  finishDate: Date | null;
};

/** Parses the `_sprints/backlog/{squad}/{project}/{team}/{pi}/{iteration}` URL form. */
function parseBacklogUrl(url: string): { team: string | null; pi: string | null; iteration: string | null } {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const idx = parts.indexOf("_sprints");
    if (idx >= 0 && parts[idx + 1] === "backlog" && parts.length > idx + 2) {
      const team = parts[idx + 4] ?? parts[idx + 2];
      const pi = parts[idx + 5] ?? null;
      const iteration = parts[idx + 6] ?? null;
      return { team, pi, iteration };
    }
    // `_backlogs/backlog/{team}` form — team only, no PI/iteration in the URL.
    const bIdx = parts.indexOf("_backlogs");
    if (bIdx >= 0 && parts[bIdx + 1] === "backlog" && parts.length > bIdx + 2) {
      return { team: parts[bIdx + 2], pi: null, iteration: null };
    }
    return { team: null, pi: null, iteration: null };
  } catch {
    return { team: null, pi: null, iteration: null };
  }
}

async function listTeamIterations(org: string, project: string, team: string, auth: string): Promise<IterationInfo[]> {
  const base = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis`;
  const toInfo = (raw: { name: string; path?: string; attributes?: { startDate?: string; finishDate?: string } }): IterationInfo => ({
    name: raw.name,
    path: raw.path ?? raw.name,
    startDate: raw.attributes?.startDate ? new Date(raw.attributes.startDate) : null,
    finishDate: raw.attributes?.finishDate ? new Date(raw.attributes.finishDate) : null,
  });

  const current = await adoGet(`${base}/work/teamsettings/iterations?api-version=7.1-preview.1&$timeframe=current`, auth);
  const currentList: IterationInfo[] = (current.value ?? []).map(toInfo);

  const all = await adoGet(`${base}/work/teamsettings/iterations?api-version=7.1-preview.1`, auth);
  const seen = new Set(currentList.map((i) => i.path));
  for (const raw of all.value ?? []) {
    const info = toInfo(raw);
    if (!seen.has(info.path)) currentList.push(info);
  }
  return currentList;
}

/** Resolve which iteration to score: an explicit override, or the team's current sprint. */
function resolveIteration(iterations: IterationInfo[], override?: string): IterationInfo {
  if (override?.trim()) {
    const needle = override.trim().toLowerCase();
    const match = iterations.find(
      (it) => it.name.toLowerCase() === needle || it.path.toLowerCase().endsWith(`/${needle}`) || it.path.toLowerCase() === needle,
    );
    if (match) return match;
  }
  if (iterations.length > 0) return iterations[0]; // $timeframe=current result, when no override matched
  throw new Error("Could not resolve a current iteration for this team. Try specifying the iteration explicitly.");
}

type PrLink = { repositoryId: string; pullRequestId: number };

type WorkItemRow = {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo: string | null;
  tags: string[];
  createdDate: Date | null;
  changedDate: Date | null;
  linkedPrs: PrLink[];
  addedAfterSprintStart: boolean;
  blocked: boolean;
  blockedAgeDays: number;
  staleDays: number;
};

function extractPrArtifacts(relations: Array<{ rel?: string; url?: string }>): PrLink[] {
  const links: PrLink[] = [];
  for (const rel of relations) {
    const relName = (rel.rel ?? "").toLowerCase();
    if (!relName.includes("pull request") && !relName.includes("artifactlink") && !relName.includes("pullrequestid")) continue;
    const m = (rel.url ?? "").match(/PullRequestId\/[^%]+%2F([^%]+)%2F(\d+)$/);
    if (m) links.push({ repositoryId: m[1], pullRequestId: Number(m[2]) });
  }
  return links;
}

async function fetchSprintWorkItems(
  org: string,
  project: string,
  iterationPath: string,
  includeBugs: boolean,
  auth: string,
): Promise<WorkItemRow[]> {
  const wiqlBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1-preview.2`;
  let query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.IterationPath] UNDER '${iterationPath.replace(/'/g, "''")}'`;
  if (!includeBugs) query += ` AND [System.WorkItemType] <> 'Bug'`;
  query += " ORDER BY [System.ChangedDate] DESC";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
  const wiqlData = (await adoPostJson(wiqlBase, auth, { query })) as any;
  const ids: number[] = (wiqlData.workItems ?? []).map((w: { id: number }) => w.id);
  if (ids.length === 0) return [];

  const fields = [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "System.AssignedTo",
    "System.Tags",
    "System.CreatedDate",
    "System.ChangedDate",
  ];
  const witBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit`;
  const rows: WorkItemRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const data = await adoGet(
      `${witBase}/workitems?ids=${chunk.join(",")}&fields=${fields.join(",")}&$expand=relations&api-version=7.1-preview.3`,
      auth,
    );
    for (const raw of data.value ?? []) {
      const f = raw.fields ?? {};
      const assignedTo = f["System.AssignedTo"];
      rows.push({
        id: raw.id,
        title: f["System.Title"] ?? "",
        workItemType: f["System.WorkItemType"] ?? "Unknown",
        state: f["System.State"] ?? "Unknown",
        assignedTo: typeof assignedTo === "object" ? (assignedTo?.displayName ?? null) : (assignedTo ?? null),
        tags: String(f["System.Tags"] ?? "")
          .split(";")
          .map((t: string) => t.trim())
          .filter(Boolean),
        createdDate: f["System.CreatedDate"] ? new Date(f["System.CreatedDate"]) : null,
        changedDate: f["System.ChangedDate"] ? new Date(f["System.ChangedDate"]) : null,
        linkedPrs: extractPrArtifacts(raw.relations ?? []),
        addedAfterSprintStart: false,
        blocked: false,
        blockedAgeDays: 0,
        staleDays: 0,
      });
    }
  }
  return rows;
}

function enrichWorkItems(items: WorkItemRow[], iteration: IterationInfo, thresholds: { staleItemDays: number }): void {
  const now = new Date();
  for (const wi of items) {
    wi.staleDays = daysBetween(wi.changedDate, now);
    wi.addedAfterSprintStart = Boolean(iteration.startDate && wi.createdDate && wi.createdDate > iteration.startDate);
    const tagsLower = wi.tags.map((t) => t.toLowerCase());
    wi.blocked = tagsLower.some((tag) => BLOCKED_TAG_HINTS.some((h) => tag.includes(h)));
    if (wi.blocked) {
      const lastUpdate = wi.changedDate ?? wi.createdDate ?? now;
      wi.blockedAgeDays = daysBetween(lastUpdate, now);
    }
    if (!wi.blocked && isInProgressState(wi.state)) {
      const stateLower = normalizeState(wi.state);
      if (["blocked", "waiting", "hold"].some((h) => stateLower.includes(h))) {
        wi.blocked = true;
        wi.blockedAgeDays = wi.staleDays;
      }
    }
    void thresholds; // staleItemDays used by evaluateHealth, not per-item here
  }
}

type PrRow = { isOpen: boolean; ageDays: number; waitingForReview: boolean };

async function fetchPullRequests(
  org: string,
  project: string,
  items: WorkItemRow[],
  includePrData: boolean,
  auth: string,
  warnings: string[],
): Promise<Map<string, PrRow>> {
  const prs = new Map<string, PrRow>();
  if (!includePrData) return prs;
  const repoBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories`;

  for (const wi of items) {
    for (const link of wi.linkedPrs) {
      const key = `${link.repositoryId}|${link.pullRequestId}`;
      if (prs.has(key)) continue;
      try {
        const data = await adoGet(`${repoBase}/${link.repositoryId}/pullRequests/${link.pullRequestId}?api-version=7.1-preview.1`, auth);
        const isOpen = ["active", "notset"].includes(String(data.status ?? "").toLowerCase());
        const created = data.creationDate ? new Date(data.creationDate) : null;
        const closed = data.closedDate ? new Date(data.closedDate) : null;
        const ageDays = daysBetween(created, closed ?? new Date());
        const reviewers: Array<{ vote?: number }> = data.reviewers ?? [];
        const waitingForReview = isOpen && (reviewers.length === 0 || reviewers.every((r) => (r.vote ?? 0) === 0));
        prs.set(key, { isOpen, ageDays, waitingForReview });
      } catch (e) {
        warnings.push(`Could not resolve PR ${link.pullRequestId} for repository ${link.repositoryId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  return prs;
}

export type SprintHealthRisk = { type: string; severity: "HIGH" | "MEDIUM" | "LOW"; message: string };
export type SprintHealthAtRiskItem = {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo: string | null;
  risk: string;
  reason: string;
  action: string;
};

export type SprintHealthOutput = {
  team: string;
  iterationName: string;
  iterationPath: string;
  sprintStartDate: string | null;
  sprintEndDate: string | null;
  daysRemaining: number | null;
  health: "GREEN" | "AMBER" | "RED";
  healthScore: number;
  deliveryConfidence: number;
  summary: {
    committed: number;
    done: number;
    inProgress: number;
    notStarted: number;
    blocked: number;
    stale: number;
    openPrs: number;
    agingPrs: number;
    likelySpillover: number;
    scopeAddedAfterStart: number;
  };
  topRisks: SprintHealthRisk[];
  atRiskItems: SprintHealthAtRiskItem[];
  recommendedActions: string[];
  warnings: string[];
};

function evaluateHealth(
  items: WorkItemRow[],
  iteration: IterationInfo,
  prs: Map<string, PrRow>,
  warnings: string[],
): Omit<SprintHealthOutput, "team" | "iterationName" | "iterationPath"> {
  const thresholds = {
    staleItemDays: DEFAULT_STALE_DAYS,
    blockedItemDays: DEFAULT_BLOCKED_DAYS,
    prWaitDays: DEFAULT_PR_WAIT_DAYS,
    maxWipPerEngineer: DEFAULT_MAX_WIP_PER_ENGINEER,
  };
  const now = new Date();
  const start = iteration.startDate ?? now;
  const finish = iteration.finishDate ?? now;
  const totalDays = Math.max(1, daysBetween(start, finish));
  const elapsedDays = now > start ? Math.min(totalDays, Math.max(0, daysBetween(start, now))) : 0;
  const daysRemaining = iteration.finishDate ? Math.max(0, daysBetween(now, finish)) : null;
  const sprintProgressRatio = elapsedDays / totalDays;

  const committed = items.length;
  const doneItems = items.filter((i) => isDoneState(i.state));
  const inProgressItems = items.filter((i) => isInProgressState(i.state) && !isDoneState(i.state));
  const notStartedItems = items.filter((i) => isNotStartedState(i.state));
  const blockedItems = items.filter((i) => i.blocked && i.blockedAgeDays >= thresholds.blockedItemDays);
  const staleItems = items.filter((i) => isInProgressState(i.state) && i.staleDays >= thresholds.staleItemDays && !isDoneState(i.state));
  const scopeAdded = items.filter((i) => i.addedAfterSprintStart);

  const openPrs = [...prs.values()].filter((p) => p.isOpen);
  const agingPrs = openPrs.filter((p) => p.ageDays >= thresholds.prWaitDays && p.waitingForReview);

  const likelySpillover: WorkItemRow[] = [];
  for (const wi of items) {
    if (isDoneState(wi.state)) continue;
    let reasons = 0;
    if (wi.blocked) reasons += 1;
    if (wi.staleDays >= thresholds.staleItemDays) reasons += 1;
    if (isNotStartedState(wi.state) && sprintProgressRatio >= 0.6) reasons += 1;
    if (wi.linkedPrs.some((p) => prs.get(`${p.repositoryId}|${p.pullRequestId}`)?.isOpen)) reasons += 1;
    if (reasons >= 2 || (reasons >= 1 && (daysRemaining ?? 99) <= 2)) likelySpillover.push(wi);
  }

  const byAssignee = new Map<string, number>();
  for (const wi of inProgressItems) {
    const name = wi.assignedTo ?? "Unassigned";
    byAssignee.set(name, (byAssignee.get(name) ?? 0) + 1);
  }
  const overloadedPeople = [...byAssignee.entries()].filter(([name, count]) => count > thresholds.maxWipPerEngineer && name !== "Unassigned");

  let score = 100;
  const risks: SprintHealthRisk[] = [];
  const actions: string[] = [];

  const addRisk = (type: string, severity: SprintHealthRisk["severity"], message: string, penalty: number, action?: string) => {
    score -= penalty;
    risks.push({ type, severity, message });
    if (action) actions.push(action);
  };

  if (blockedItems.length > 0) {
    addRisk(
      "BLOCKED_ITEMS",
      blockedItems.length >= 2 ? "HIGH" : "MEDIUM",
      `${blockedItems.length} work items have been blocked for at least ${thresholds.blockedItemDays} day(s)`,
      8 + Math.min(12, blockedItems.length * 4),
      "Escalate blocked dependencies and assign an owner for each blocker.",
    );
  }
  if (staleItems.length > 0) {
    addRisk(
      "STALE_ITEMS",
      staleItems.length >= 3 ? "HIGH" : "MEDIUM",
      `${staleItems.length} in-progress work items have not been updated for more than ${thresholds.staleItemDays} day(s)`,
      6 + Math.min(12, staleItems.length * 3),
      "Review stale items in stand-up and either unblock, update, or de-scope them.",
    );
  }
  if (agingPrs.length > 0) {
    addRisk(
      "PR_BOTTLENECK",
      agingPrs.length >= 3 ? "HIGH" : "MEDIUM",
      `${agingPrs.length} pull request(s) have been waiting for review for more than ${thresholds.prWaitDays} day(s)`,
      5 + Math.min(10, agingPrs.length * 3),
      "Swarm aging PRs and nominate same-day reviewers.",
    );
  }
  if (scopeAdded.length > 0 && iteration.startDate) {
    addRisk(
      "SCOPE_CHANGE",
      scopeAdded.length >= Math.max(3, Math.floor(committed * 0.2)) ? "HIGH" : "MEDIUM",
      `${scopeAdded.length} work item(s) appear to have been added after sprint start`,
      4 + Math.min(10, scopeAdded.length * 2),
      "Review newly added scope and remove low-priority items if capacity is tight.",
    );
  }
  if (likelySpillover.length > 0) {
    addRisk(
      "LIKELY_SPILLOVER",
      likelySpillover.length >= 3 ? "HIGH" : "MEDIUM",
      `${likelySpillover.length} work item(s) look likely to spill over into the next sprint`,
      8 + Math.min(12, likelySpillover.length * 3),
      "Focus the squad on finishing near-done items and de-scope anything unlikely to complete.",
    );
  }
  if (overloadedPeople.length > 0) {
    addRisk(
      "WIP_IMBALANCE",
      "MEDIUM",
      `${overloadedPeople.length} engineer(s) exceed the WIP threshold of ${thresholds.maxWipPerEngineer}`,
      5,
      "Rebalance WIP across the squad and limit new starts.",
    );
  }

  const lateNotStartedThreshold = sprintProgressRatio >= 0.75 ? 0.4 : 0.5;
  if (committed > 0 && sprintProgressRatio >= 0.6 && notStartedItems.length / committed >= lateNotStartedThreshold) {
    addRisk(
      "LATE_NOT_STARTED_SCOPE",
      sprintProgressRatio >= 0.75 ? "HIGH" : "MEDIUM",
      `${notStartedItems.length} of ${committed} work item(s) are still not started late in the sprint`,
      10,
      "Decide what can realistically be finished and de-scope or split the rest.",
    );
  }

  const doneRatio = committed > 0 ? doneItems.length / committed : 0;
  if (committed > 0) {
    if (doneRatio >= sprintProgressRatio + 0.15) score += 8;
    else if (doneRatio >= sprintProgressRatio) score += 4;
    else if (doneRatio < Math.max(0.2, sprintProgressRatio - 0.2)) {
      score -= 8;
      actions.push("Accelerate completion by swarming the highest-value near-done items.");
    }
  }

  score = Math.max(0, Math.min(100, score));
  const health: SprintHealthOutput["health"] = score >= 80 ? "GREEN" : score >= 60 ? "AMBER" : "RED";
  const deliveryConfidence = Math.max(5, Math.min(99, Math.round(score * 0.9 + doneRatio * 10)));

  const riskItemIds = new Set([...likelySpillover, ...blockedItems, ...staleItems].map((i) => i.id));
  const riskItemsMap = new Map(items.filter((i) => riskItemIds.has(i.id)).map((i) => [i.id, i]));
  const atRiskItems: SprintHealthAtRiskItem[] = [];
  for (const wi of [...riskItemsMap.values()].slice(0, 15)) {
    const reasons: string[] = [];
    let action = "Review in stand-up and assign a clear next step today.";
    let risk = "At risk";
    if (wi.blocked) {
      reasons.push(`Blocked for ${wi.blockedAgeDays} day(s)`);
      action = "Escalate dependency and assign blocker owner today.";
      risk = "Blocked";
    }
    if (wi.staleDays >= thresholds.staleItemDays) {
      reasons.push(`Stale for ${wi.staleDays} day(s)`);
      action = "Ask for update or pairing support in stand-up.";
      risk = "Stale";
    }
    if (likelySpillover.some((x) => x.id === wi.id)) {
      reasons.push("Likely spillover");
      action = "Review scope, split if needed, and focus on completion path.";
      risk = "Likely spillover";
    }
    if (wi.linkedPrs.length > 0) {
      const openCount = wi.linkedPrs.filter((p) => prs.get(`${p.repositoryId}|${p.pullRequestId}`)?.isOpen).length;
      if (openCount > 0) {
        reasons.push(`${openCount} open PR(s)`);
        action = "Assign reviewers and target same-day PR turnaround.";
      }
    }
    atRiskItems.push({
      id: wi.id,
      title: wi.title,
      type: wi.workItemType,
      state: wi.state,
      assignedTo: wi.assignedTo,
      risk,
      reason: reasons.join(" and ") || "Risk heuristics triggered",
      action,
    });
  }

  const summary = {
    committed,
    done: doneItems.length,
    inProgress: inProgressItems.length,
    notStarted: notStartedItems.length,
    blocked: blockedItems.length,
    stale: staleItems.length,
    openPrs: openPrs.length,
    agingPrs: agingPrs.length,
    likelySpillover: likelySpillover.length,
    scopeAddedAfterStart: scopeAdded.length,
  };

  const dedupedActions = [...new Set(actions)];
  const topRisks = [...risks].sort((a, b) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 })[b.severity] - ({ HIGH: 3, MEDIUM: 2, LOW: 1 })[a.severity]).slice(0, 6);

  return {
    sprintStartDate: iteration.startDate ? iteration.startDate.toISOString() : null,
    sprintEndDate: iteration.finishDate ? iteration.finishDate.toISOString() : null,
    daysRemaining,
    health,
    healthScore: score,
    deliveryConfidence,
    summary,
    topRisks,
    atRiskItems,
    recommendedActions: dedupedActions.slice(0, 8),
    warnings: [...new Set(warnings)],
  };
}

export async function runSprintHealth(
  inputs: Record<string, string | boolean> = {},
  adoPat?: string,
): Promise<SprintHealthOutput> {
  const backlogUrl = typeof inputs.backlogUrl === "string" ? inputs.backlogUrl.trim() : "";
  if (!backlogUrl) throw new Error("A team backlog URL is required.");
  const iterationOverride = typeof inputs.iteration === "string" ? inputs.iteration.trim() : "";

  const { team: parsedTeam } = parseBacklogUrl(backlogUrl);
  if (!parsedTeam) throw new Error("Could not parse a team name from that backlog URL.");

  const { org, project } = adoTarget();
  const auth = await adoReadAuthHeader(adoPat);

  const iterations = await listTeamIterations(org, project, parsedTeam, auth);
  const iteration = resolveIteration(iterations, iterationOverride);

  const items = await fetchSprintWorkItems(org, project, iteration.path, true, auth);
  if (items.length === 0) {
    // still return a (empty) scorecard rather than throwing — matches the
    // Python original's graceful "no work items found" warning path.
  }
  enrichWorkItems(items, iteration, { staleItemDays: DEFAULT_STALE_DAYS });

  const warnings: string[] = items.length === 0 ? ["No work items found for the selected sprint."] : [];
  const prs = await fetchPullRequests(org, project, items, true, auth, warnings);

  const evaluation = evaluateHealth(items, iteration, prs, warnings);

  return {
    team: parsedTeam,
    iterationName: iteration.name,
    iterationPath: iteration.path,
    ...evaluation,
  };
}
