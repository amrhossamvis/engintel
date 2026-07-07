import { adoReadAuthHeader } from "@/lib/ado";

export type IterationMetrics = {
  iterationName: string;
  iterationPath: string;
  startDate: string | null;
  endDate: string | null;
  totalWorkItems: number;
  completedWorkItems: number;
  completionRate: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  velocity: number;
  bugCount: number;
  activeBugs: number;
  resolvedBugs: number;
  newBugs: number;
};

export type TeamDashboard = {
  team: { organization: string; project: string; team: string };
  iterations: IterationMetrics[];
  healthScore: number;
  healthStatus: "green" | "amber" | "red";
  currentIteration: IterationMetrics | null;
  avgCompletionRate: number;
  avgVelocity: number;
};

const CLOSED = new Set(["Closed", "Done", "Resolved", "Completed"]);
const ACTIVE = new Set(["Active", "In Progress", "Committed"]);
const NEW = new Set(["New", "To Do"]);

// Ported verbatim from A portal/src/app/api/exec-dashboard/route.ts
// computeHealthScore. Uses the last 3 (completed) iterations.
export function computeHealthScore(iterations: IterationMetrics[]): {
  score: number;
  status: "green" | "amber" | "red";
} {
  if (iterations.length === 0) return { score: 75, status: "green" };

  const recent = iterations.slice(-3);

  // Factor 1: completion rate (50% weight)
  const avgCompletionRate = recent.reduce((s, i) => s + i.completionRate, 0) / recent.length;
  const completionScore = Math.min(100, (avgCompletionRate / 80) * 100);

  // Factor 2: velocity stability (25% weight)
  let velocityScore = 80;
  if (recent.length >= 2) {
    const nonZero = recent.map((i) => i.velocity).filter((v) => v > 0);
    if (nonZero.length >= 2) {
      const trend = nonZero[nonZero.length - 1] / nonZero[0];
      if (trend < 0.5) velocityScore = 30;
      else if (trend < 0.7) velocityScore = 50;
      else if (trend <= 1.3) velocityScore = 85;
      else velocityScore = 100;
    }
  }

  // Factor 3: bug health (25% weight)
  const totalBugs = recent.reduce((s, i) => s + i.bugCount, 0);
  const resolvedBugs = recent.reduce((s, i) => s + i.resolvedBugs, 0);
  let bugScore = 80;
  if (totalBugs > 0) {
    bugScore = Math.min(100, Math.round((resolvedBugs / totalBugs) * 100 + 20));
  }

  const score = Math.round(completionScore * 0.5 + velocityScore * 0.25 + bugScore * 0.25);
  const status = score >= 65 ? "green" : score >= 40 ? "amber" : "red";
  return { score, status };
}

type WorkItem = { fields: Record<string, unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoGet(url: string, auth: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`ado_${res.status}`);
  return res.json();
}

// Impure — reads ADO REST for one team's recent iterations. Not unit-tested.
export async function fetchTeamDashboard(
  team: { organization: string; project: string; team: string },
  sprintCount = 6,
  auth?: string,
): Promise<TeamDashboard> {
  const { organization: org, project } = team;
  const t = encodeURIComponent(team.team);
  const base = `https://dev.azure.com/${org}/${project}`;
  const authHeader = auth ?? (await adoReadAuthHeader());

  const iterData = await adoGet(
    `${base}/${t}/_apis/work/teamsettings/iterations?api-version=7.0`,
    authHeader,
  ).catch((e: Error) => {
    if (e.message === "ado_404")
      throw new Error(`team_not_found: "${team.team}" in ${org}/${project} — check ADO_DEFAULT_TEAM`);
    throw e;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
  const iterationsRaw: any[] = (iterData.value ?? []).slice(-sprintCount);

  const iterations: IterationMetrics[] = [];
  for (const it of iterationsRaw) {
    const wiql = {
      query:
        `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${it.path}' ` +
        `AND [System.WorkItemType] IN ('User Story','Bug','Product Backlog Item','Task','Feature')`,
    };
    const wiqlRes = await fetch(`${base}/_apis/wit/wiql?api-version=7.0`, {
      method: "POST",
      headers: { Authorization: authHeader, "content-type": "application/json" },
      body: JSON.stringify(wiql),
    });
    if (!wiqlRes.ok) throw new Error(`ado_wiql_${wiqlRes.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
    const ids: number[] = ((await wiqlRes.json()).workItems ?? []).map((w: any) => w.id);

    let items: WorkItem[] = [];
    if (ids.length) {
      const batch = ids.slice(0, 200).join(",");
      const wi = await adoGet(
        `${base}/_apis/wit/workitems?ids=${batch}&fields=System.WorkItemType,System.State,` +
          `Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.Effort&api-version=7.0`,
        authHeader,
      );
      items = wi.value ?? [];
    }

    const state = (w: WorkItem) => String(w.fields["System.State"]);
    const total = items.length;
    const completed = items.filter((w) => CLOSED.has(state(w))).length;
    const bugs = items.filter((w) => w.fields["System.WorkItemType"] === "Bug");
    const sp = (w: WorkItem) =>
      Number(w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? w.fields["Microsoft.VSTS.Scheduling.Effort"] ?? 0);
    const completedSp = items.filter((w) => CLOSED.has(state(w))).reduce((s, w) => s + sp(w), 0);

    iterations.push({
      iterationName: it.name,
      iterationPath: it.path,
      startDate: it.attributes?.startDate ?? null,
      endDate: it.attributes?.finishDate ?? null,
      totalWorkItems: total,
      completedWorkItems: completed,
      completionRate: total ? (completed / total) * 100 : 0,
      totalStoryPoints: items.reduce((s, w) => s + sp(w), 0),
      completedStoryPoints: completedSp,
      velocity: completedSp,
      bugCount: bugs.length,
      activeBugs: bugs.filter((w) => ACTIVE.has(state(w))).length,
      resolvedBugs: bugs.filter((w) => CLOSED.has(state(w))).length,
      newBugs: bugs.filter((w) => NEW.has(state(w))).length,
    });
  }

  // Health + averages use completed sprints only — the last (in-progress) sprint
  // is excluded so a half-done current sprint doesn't drag the score down.
  const completedIterations = iterations.slice(0, -1);
  const health = computeHealthScore(completedIterations);
  const avgCompletionRate = completedIterations.length
    ? Math.round(completedIterations.reduce((s, i) => s + i.completionRate, 0) / completedIterations.length)
    : 0;
  const avgVelocity = completedIterations.length
    ? Math.round(completedIterations.reduce((s, i) => s + i.velocity, 0) / completedIterations.length)
    : 0;

  return {
    team,
    iterations,
    healthScore: health.score,
    healthStatus: health.status,
    currentIteration: iterations[iterations.length - 1] ?? null,
    avgCompletionRate,
    avgVelocity,
  };
}
