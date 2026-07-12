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

function wiqlQuote(value: string): string {
  return value.replace(/'/g, "''");
}

async function fetchWorkItemsByIds(base: string, ids: number[], auth: string): Promise<WorkItem[]> {
  if (ids.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) {
    chunks.push(ids.slice(i, i + 200));
  }

  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const wi = await adoGet(
        `${base}/_apis/wit/workitems?ids=${chunk.join(",")}&fields=System.WorkItemType,System.State,` +
          `Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.Effort&api-version=7.0`,
        auth,
      ).catch(() => ({ value: [] }));
      return (wi.value ?? []) as WorkItem[];
    }),
  );

  return pages.flat();
}

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
  const allIterations: any[] = iterData.value ?? [];

  // Match legacy behavior: choose a sprint window ending at the current iteration
  // (or the latest started one), not simply the last N rows from team settings.
  const now = new Date();
  let currentIterationIndex = -1;

  for (let i = 0; i < allIterations.length; i++) {
    const it = allIterations[i];
    const startDate = it.attributes?.startDate;
    const endDate = it.attributes?.finishDate;
    if (!startDate || !endDate) continue;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start <= now && end >= now) {
      currentIterationIndex = i;
      break;
    }
  }

  if (currentIterationIndex === -1) {
    for (let i = allIterations.length - 1; i >= 0; i--) {
      const startDate = allIterations[i]?.attributes?.startDate;
      if (startDate && new Date(startDate) <= now) {
        currentIterationIndex = i;
        break;
      }
    }
  }

  if (currentIterationIndex === -1) {
    currentIterationIndex = Math.max(0, allIterations.length - 1);
  }

  const endIndex = currentIterationIndex + 1;
  const startIndex = Math.max(0, endIndex - sprintCount);
  const iterationsRaw = allIterations.slice(startIndex, endIndex);

  // Legacy parity: scope iteration WIQL to the team's configured area paths.
  const teamAreasUrl = `${base}/${t}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`;
  const teamAreas = await adoGet(teamAreasUrl, authHeader).catch(() => ({ value: [] }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
  const areaPaths: string[] = (teamAreas.value ?? []).map((v: any) => String(v.value ?? "")).filter(Boolean);

  let areaFilter = "";
  if (areaPaths.length === 1) {
    areaFilter = ` AND [System.AreaPath] UNDER '${wiqlQuote(areaPaths[0])}'`;
  } else if (areaPaths.length > 1) {
    const cond = areaPaths.map((p) => `[System.AreaPath] UNDER '${wiqlQuote(p)}'`).join(" OR ");
    areaFilter = ` AND (${cond})`;
  }

  const iterations: IterationMetrics[] = await Promise.all(
    iterationsRaw.map(async (it) => {
      const wiql = {
        query:
          `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${wiqlQuote(String(it.path ?? ""))}' ` +
          `AND [System.WorkItemType] IN ('User Story','Bug','Product Backlog Item','Task','Feature')` +
          `${areaFilter} ` +
          `AND [System.TeamProject] = '${wiqlQuote(project)}' ORDER BY [System.Id]`,
      };
      const wiqlRes = await fetch(`${base}/_apis/wit/wiql?api-version=7.0`, {
        method: "POST",
        headers: { Authorization: authHeader, "content-type": "application/json" },
        body: JSON.stringify(wiql),
      });
      if (!wiqlRes.ok) throw new Error(`ado_wiql_${wiqlRes.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
      const ids: number[] = ((await wiqlRes.json()).workItems ?? []).map((w: any) => w.id);

      const items = await fetchWorkItemsByIds(base, ids, authHeader);

      const state = (w: WorkItem) => String(w.fields["System.State"]);
      const total = items.length;
      const completed = items.filter((w) => CLOSED.has(state(w))).length;
      const bugs = items.filter((w) => w.fields["System.WorkItemType"] === "Bug");
      const sp = (w: WorkItem) =>
        Number(w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? w.fields["Microsoft.VSTS.Scheduling.Effort"] ?? 0);
      const completedSp = items.filter((w) => CLOSED.has(state(w))).reduce((s, w) => s + sp(w), 0);

      return {
        iterationName: it.name,
        iterationPath: it.path,
        startDate: it.attributes?.startDate ?? null,
        endDate: it.attributes?.finishDate ?? null,
        totalWorkItems: total,
        completedWorkItems: completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        totalStoryPoints: items.reduce((s, w) => s + sp(w), 0),
        completedStoryPoints: completedSp,
        velocity: completedSp,
        bugCount: bugs.length,
        activeBugs: bugs.filter((w) => ACTIVE.has(state(w))).length,
        resolvedBugs: bugs.filter((w) => CLOSED.has(state(w))).length,
        newBugs: bugs.filter((w) => NEW.has(state(w))).length,
      } as IterationMetrics;
    }),
  );

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
