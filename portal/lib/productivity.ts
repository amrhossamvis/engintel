import { adoReadable, adoReadAuthHeader, authFingerprint } from "@/lib/ado";
import { fetchTeamDashboard } from "@/lib/ado-metrics";
import {
  calcPRCycleTime,
  fetchPRsFromAllRepos,
  productivityRepoNames,
  resolveRepoIds,
} from "@/lib/ado-prs";

export type SprintADOMetrics = {
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  totalWorkItems: number;
  completedWorkItems: number;
  completionRate: number;
  velocity: number;
  bugCount: number;
  newBugs: number;
  resolvedBugs: number;
  bugEscapeRate: number;
  prCount: number;
  avgPRCycleTimeDays: number;
  medianPRCycleTimeDays: number;
};

export type CopilotMetrics = {
  source: "github_api" | "manual";
  acceptanceRate: number;
  activeUsers: number;
  totalSuggestions: number;
  acceptedSuggestions: number;
  linesAccepted: number;
  weekLabel: string;
};

export type ProductivityIndex = {
  score: number;
  trend: "improving" | "stable" | "declining";
  components: {
    deliveryScore: number;
    qualityScore: number;
    velocityScore: number;
    prEfficiencyScore: number;
    copilotAdoptionScore: number;
  };
  insights: string[];
};

export type OrgStats = {
  avgCompletion: number;
  avgCycleTime: string;
  totalPRs: number;
  avgBugEscape: number;
  sprintCount: number;
};

export type ProductivityOutput = {
  index: ProductivityIndex;
  sprints: SprintADOMetrics[];
  copilot: CopilotMetrics | null;
  orgStats: OrgStats | null;
  productivityGainPct: number;
  team: string;
  trackedRepos: string[];
  digestConfigured: boolean;
};

// Ported verbatim from A portal/src/app/api/ai-productivity/route.ts
// computeAIProductivityIndex.
export function computeAIProductivityIndex(
  sprints: SprintADOMetrics[],
  copilot: CopilotMetrics | null,
): ProductivityIndex {
  if (sprints.length === 0) {
    return {
      score: 0,
      trend: "stable",
      components: { deliveryScore: 0, qualityScore: 0, velocityScore: 0, prEfficiencyScore: 0, copilotAdoptionScore: 0 },
      insights: ["No sprint data available"],
    };
  }

  const completed = sprints.filter((_, i) => i < sprints.length - 1); // exclude current in-progress
  const recent = completed.length > 0 ? completed : sprints;

  // 1. Delivery score (completion rate avg, 0-100)
  const avgCompletion = recent.reduce((s, sp) => s + sp.completionRate, 0) / recent.length;
  const deliveryScore = Math.min(100, Math.round(avgCompletion));

  // 2. Quality score (inverse bug escape rate) — 0% = 100, 30%+ = 0
  const avgBugEscape = recent.reduce((s, sp) => s + sp.bugEscapeRate, 0) / recent.length;
  const qualityScore = Math.max(0, Math.round(100 - (avgBugEscape / 30) * 100));

  // 3. Velocity score (stability — is velocity consistent or growing?)
  let velocityScore = 75;
  if (recent.length >= 2) {
    const velocities = recent.map((s) => s.velocity).filter((v) => v > 0);
    if (velocities.length >= 2) {
      const first = velocities[0];
      const last = velocities[velocities.length - 1];
      const trend = last / first;
      if (trend >= 1.1) velocityScore = 100;
      else if (trend >= 0.9) velocityScore = 80;
      else if (trend >= 0.7) velocityScore = 60;
      else velocityScore = 40;
    }
  }

  // 4. PR efficiency score (cycle time — lower is better)
  const avgCycleTime = recent.reduce((s, sp) => s + sp.avgPRCycleTimeDays, 0) / recent.length;
  let prEfficiencyScore = 75;
  if (avgCycleTime > 0) {
    if (avgCycleTime < 1) prEfficiencyScore = 100;
    else if (avgCycleTime < 2) prEfficiencyScore = 85;
    else if (avgCycleTime < 5) prEfficiencyScore = 65;
    else if (avgCycleTime < 10) prEfficiencyScore = 40;
    else prEfficiencyScore = 20;
  }

  // 5. Copilot adoption score
  let copilotAdoptionScore = 0;
  if (copilot) {
    copilotAdoptionScore = Math.min(100, Math.round(copilot.acceptanceRate));
  }

  // Composite: weighted average. Without copilot, redistribute its weight.
  let score: number;
  if (copilot) {
    score = Math.round(
      deliveryScore * 0.25 +
        qualityScore * 0.2 +
        velocityScore * 0.2 +
        prEfficiencyScore * 0.15 +
        copilotAdoptionScore * 0.2,
    );
  } else {
    score = Math.round(
      deliveryScore * 0.3 + qualityScore * 0.25 + velocityScore * 0.25 + prEfficiencyScore * 0.2,
    );
  }

  // Trend: compare first half vs second half of sprints
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recent.length >= 4) {
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);
    const firstAvg = firstHalf.reduce((s, sp) => s + sp.completionRate, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, sp) => s + sp.completionRate, 0) / secondHalf.length;
    if (secondAvg > firstAvg + 5) trend = "improving";
    else if (secondAvg < firstAvg - 5) trend = "declining";
  }

  const insights: string[] = [];
  if (deliveryScore >= 80) insights.push(`Strong delivery: ${Math.round(avgCompletion)}% avg sprint completion`);
  else if (deliveryScore < 60) insights.push(`Delivery needs attention: ${Math.round(avgCompletion)}% avg completion rate`);

  if (qualityScore >= 80) insights.push("Low bug escape rate — quality is well-controlled");
  else if (qualityScore < 50) insights.push("High bug escape rate — consider shifting quality left");

  if (prEfficiencyScore >= 85) insights.push(`Fast PR cycle time: avg ${avgCycleTime.toFixed(1)}d — excellent review flow`);
  else if (prEfficiencyScore < 50) insights.push(`Slow PR cycle time: avg ${avgCycleTime.toFixed(1)}d — review bottleneck detected`);

  if (copilot) {
    if (copilot.acceptanceRate >= 30) insights.push(`Copilot acceptance rate ${copilot.acceptanceRate}% — strong AI adoption`);
    else if (copilot.acceptanceRate < 20) insights.push(`Copilot acceptance rate ${copilot.acceptanceRate}% — opportunity to improve AI usage`);
    if (copilot.activeUsers > 0) insights.push(`${copilot.activeUsers} active Copilot users contributing to productivity`);
  } else {
    insights.push("Connect GitHub Copilot data to unlock the full AI Productivity Index");
  }

  if (trend === "improving") insights.push("Positive trend: team productivity is improving over time");
  else if (trend === "declining") insights.push("Declining trend: productivity metrics have dropped recently");

  return {
    score,
    trend,
    components: { deliveryScore, qualityScore, velocityScore, prEfficiencyScore, copilotAdoptionScore },
    insights,
  };
}

function parseCopilot(inputs: Record<string, string | boolean>): CopilotMetrics | null {
  const num = (k: string) => {
    const v = inputs[k];
    return typeof v === "string" && v.trim() !== "" ? Number(v) : 0;
  };
  const acceptanceRate = num("copilotAcceptanceRate");
  if (!(acceptanceRate > 0)) return null;
  return {
    source: "manual",
    acceptanceRate,
    activeUsers: num("copilotActiveUsers"),
    totalSuggestions: num("copilotTotalSuggestions"),
    acceptedSuggestions: num("copilotAcceptedSuggestions"),
    linesAccepted: num("copilotLinesAccepted"),
    weekLabel: new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  };
}

// Mirrors A page.tsx orgStats: aggregates completed sprints (excludes the
// in-progress current sprint unless it is the only one).
export function computeOrgStats(sprints: SprintADOMetrics[]): OrgStats | null {
  const completed = sprints.slice(0, -1);
  const recent = completed.length > 0 ? completed : sprints;
  if (recent.length === 0) return null;
  return {
    avgCompletion: Math.round(recent.reduce((s, sp) => s + sp.completionRate, 0) / recent.length),
    avgCycleTime: (recent.reduce((s, sp) => s + sp.avgPRCycleTimeDays, 0) / recent.length).toFixed(1),
    totalPRs: recent.reduce((s, sp) => s + sp.prCount, 0),
    avgBugEscape: Math.round(recent.reduce((s, sp) => s + sp.bugEscapeRate, 0) / recent.length),
    sprintCount: recent.length,
  };
}

// The ADO reads (iterations, work items, PRs) are the slow part and are stable
// minute-to-minute, so per-team sprint metrics are memoised. Copilot input is
// applied on top of cached sprints, so changing it re-scores without re-fetching.
type CachedSprints = { sprints: SprintADOMetrics[]; trackedRepos: string[]; fetchedAt: number };
const SPRINT_TTL_MS = 10 * 60 * 1000;
const sprintCache = new Map<string, CachedSprints>();

async function getSprints(
  organization: string,
  project: string,
  team: string,
  auth: string,
): Promise<{ sprints: SprintADOMetrics[]; trackedRepos: string[] }> {
  // Keyed by caller identity too — team metrics must not leak across users who
  // read with different ADO credentials.
  const key = `${authFingerprint(auth)}|${organization}|${project}|${team}`;
  const hit = sprintCache.get(key);
  if (hit && Date.now() - hit.fetchedAt < SPRINT_TTL_MS) {
    return { sprints: hit.sprints, trackedRepos: hit.trackedRepos };
  }

  const dash = await fetchTeamDashboard({ organization, project, team }, 6, auth);
  const repos = await resolveRepoIds(organization, project, productivityRepoNames(), auth);

  const sprints: SprintADOMetrics[] = [];
  for (const it of dash.iterations) {
    let prCount = 0;
    let avgPRCycleTimeDays = 0;
    let medianPRCycleTimeDays = 0;
    if (repos.length > 0 && it.startDate && it.endDate) {
      const prs = await fetchPRsFromAllRepos(organization, project, repos, it.startDate, it.endDate, auth);
      prCount = prs.length;
      const ct = calcPRCycleTime(prs);
      avgPRCycleTimeDays = ct.avg;
      medianPRCycleTimeDays = ct.median;
    }
    sprints.push({
      sprintName: it.iterationName,
      startDate: it.startDate,
      endDate: it.endDate,
      totalWorkItems: it.totalWorkItems,
      completedWorkItems: it.completedWorkItems,
      completionRate: Math.round(it.completionRate),
      velocity: it.velocity,
      bugCount: it.bugCount,
      newBugs: it.newBugs,
      resolvedBugs: it.resolvedBugs,
      bugEscapeRate: it.totalWorkItems > 0 ? Math.round((it.bugCount / it.totalWorkItems) * 100) : 0,
      prCount,
      avgPRCycleTimeDays,
      medianPRCycleTimeDays,
    });
  }

  const entry: CachedSprints = { sprints, trackedRepos: repos.map((r) => r.name), fetchedAt: Date.now() };
  sprintCache.set(key, entry);
  return entry;
}

function teamFromInputs(inputs: Record<string, string | boolean>): string | null {
  const t = inputs.team;
  return typeof t === "string" && t.trim() !== "" ? t.trim() : null;
}

// Impure handler. Reads recent iterations for the chosen team (from the run
// input, else ADO_DEFAULT_TEAM), real PR cycle time for the repos in
// ADO_PRODUCTIVITY_REPOS, and the optional manual Copilot metrics, then computes
// the weighted index over completed sprints. Sprint reads are cached per team.
export async function runProductivity(
  inputs: Record<string, string | boolean>,
  adoPat?: string,
): Promise<ProductivityOutput> {
  if (!(await adoReadable(adoPat))) throw new Error("ado_not_configured");
  const organization = process.env.ADO_ORG ?? "vfuk-digital";
  const project = process.env.ADO_PROJECT ?? "Digital";
  const teamName = teamFromInputs(inputs) ?? process.env.ADO_DEFAULT_TEAM ?? "VOXI Digital";
  const auth = await adoReadAuthHeader(adoPat);

  const { sprints, trackedRepos } = await getSprints(organization, project, teamName, auth);

  const copilot = parseCopilot(inputs);
  const index = computeAIProductivityIndex(sprints, copilot);
  const orgStats = computeOrgStats(sprints);
  const productivityGainPct = Math.max(0, Math.round((index.score - 50) * 0.3));

  return {
    index,
    sprints,
    copilot,
    orgStats,
    productivityGainPct,
    team: teamName,
    trackedRepos,
    digestConfigured: Boolean(process.env.TEAMS_WEBHOOK_URL),
  };
}
