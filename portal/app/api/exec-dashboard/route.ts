import { NextRequest, NextResponse } from "next/server";
import { adoReadAuthHeader, adoReadable } from "@/lib/ado";

export const maxDuration = 60;

type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

type IterationMetrics = {
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

type TeamDashboardData = {
  team: TeamConfig;
  iterations: IterationMetrics[];
  healthScore: number;
  healthStatus: "green" | "amber" | "red";
  currentIteration: IterationMetrics | null;
  avgCompletionRate: number;
  avgVelocity: number;
  error?: string;
};

type WorkItem = { fields: Record<string, unknown> };

function wiqlQuote(value: string): string {
  return value.replace(/'/g, "''");
}

async function adoJson(url: string, authHeader: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ado_${res.status}`);
  return res.json();
}

async function fetchIterations(
  org: string,
  project: string,
  team: string,
  authHeader: string,
): Promise<Array<Record<string, unknown>>> {
  const encodedTeam = encodeURIComponent(team);
  const url = `https://dev.azure.com/${org}/${project}/${encodedTeam}/_apis/work/teamsettings/iterations?api-version=7.0`;
  const data = (await adoJson(url, authHeader)) as { value?: Array<Record<string, unknown>> };
  return data.value ?? [];
}

async function fetchTeamAreaPaths(
  org: string,
  project: string,
  team: string,
  authHeader: string,
): Promise<string[]> {
  const encodedTeam = encodeURIComponent(team);
  const url = `https://dev.azure.com/${org}/${project}/${encodedTeam}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`;
  try {
    const data = (await adoJson(url, authHeader)) as {
      values?: Array<{ value?: unknown }>;
      value?: Array<{ value?: unknown }>;
    };
    const rows = data.values ?? data.value ?? [];
    return rows.map((v) => String(v.value ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchWorkItemsByIterationPath(
  org: string,
  project: string,
  _team: string,
  iterationPath: string,
  areaPaths: string[],
  authHeader: string,
): Promise<number[]> {
  const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`;

  let areaFilter = "";
  if (areaPaths.length === 1) {
    areaFilter = `AND [System.AreaPath] UNDER '${wiqlQuote(areaPaths[0])}'`;
  } else if (areaPaths.length > 1) {
    const areaConditions = areaPaths
      .map((ap) => `[System.AreaPath] UNDER '${wiqlQuote(ap)}'`)
      .join(" OR ");
    areaFilter = `AND (${areaConditions})`;
  }

  const query =
    `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${wiqlQuote(iterationPath)}' ` +
    `AND [System.WorkItemType] IN ('User Story', 'Bug', 'Product Backlog Item', 'Task', 'Feature') ` +
    `${areaFilter} ` +
    `AND [System.TeamProject] = '${wiqlQuote(project)}' ORDER BY [System.Id]`;

  try {
    const res = await fetch(wiqlUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { workItems?: Array<{ id: number }> };
    return (data.workItems ?? []).map((wi) => wi.id);
  } catch {
    return [];
  }
}

async function fetchWorkItemDetails(
  org: string,
  project: string,
  ids: number[],
  authHeader: string,
): Promise<WorkItem[]> {
  if (ids.length === 0) return [];

  const batchSize = 200;
  const results: WorkItem[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const url =
      `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${batch.join(",")}` +
      `&fields=System.WorkItemType,System.State,System.Title,Microsoft.VSTS.Scheduling.StoryPoints,` +
      `Microsoft.VSTS.Scheduling.Effort,System.CreatedDate&api-version=7.0`;
    try {
      const data = (await adoJson(url, authHeader)) as { value?: WorkItem[] };
      results.push(...(data.value ?? []));
    } catch {
      // Skip failed batches to mirror hub behavior.
    }
  }

  return results;
}

function computeHealthScore(iterations: IterationMetrics[]): {
  score: number;
  status: "green" | "amber" | "red";
} {
  if (iterations.length === 0) return { score: 75, status: "green" };

  const recent = iterations.slice(-3);

  const avgCompletionRate = recent.reduce((sum, i) => sum + i.completionRate, 0) / recent.length;
  const completionScore = Math.min(100, (avgCompletionRate / 80) * 100);

  let velocityScore = 80;
  if (recent.length >= 2) {
    const velocities = recent.map((i) => i.velocity);
    const nonZeroVelocities = velocities.filter((v) => v > 0);
    if (nonZeroVelocities.length >= 2) {
      const first = nonZeroVelocities[0];
      const last = nonZeroVelocities[nonZeroVelocities.length - 1];
      const trend = last / first;
      if (trend < 0.5) velocityScore = 30;
      else if (trend < 0.7) velocityScore = 50;
      else if (trend <= 1.3) velocityScore = 85;
      else velocityScore = 100;
    }
  }

  const totalBugs = recent.reduce((sum, i) => sum + i.bugCount, 0);
  const resolvedBugs = recent.reduce((sum, i) => sum + i.resolvedBugs, 0);
  let bugScore = 80;
  if (totalBugs > 0) {
    const resolveRatio = resolvedBugs / totalBugs;
    bugScore = Math.min(100, Math.round(resolveRatio * 100 + 20));
  }

  const score = Math.round(completionScore * 0.5 + velocityScore * 0.25 + bugScore * 0.25);

  let status: "green" | "amber" | "red";
  if (score >= 65) status = "green";
  else if (score >= 40) status = "amber";
  else status = "red";

  return { score, status };
}

async function getTeamMetrics(
  teamConfig: TeamConfig,
  authHeader: string,
  sprintCount: number,
): Promise<TeamDashboardData> {
  const { organization, project, team } = teamConfig;

  try {
    const allIterations = await fetchIterations(organization, project, team, authHeader);

    const now = new Date();
    let currentIterationIndex = -1;

    for (let i = 0; i < allIterations.length; i++) {
      const iter = allIterations[i] as { attributes?: { startDate?: string; finishDate?: string } };
      const startDate = iter.attributes?.startDate;
      const endDate = iter.attributes?.finishDate;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start <= now && end >= now) {
          currentIterationIndex = i;
          break;
        }
      }
    }

    if (currentIterationIndex === -1) {
      for (let i = allIterations.length - 1; i >= 0; i--) {
        const iter = allIterations[i] as { attributes?: { startDate?: string } };
        const startDate = iter.attributes?.startDate;
        if (startDate && new Date(startDate) <= now) {
          currentIterationIndex = i;
          break;
        }
      }
    }

    if (currentIterationIndex === -1) {
      currentIterationIndex = allIterations.length - 1;
    }

    const endIndex = currentIterationIndex + 1;
    const startIndex = Math.max(0, endIndex - sprintCount);
    const recentIterations = allIterations.slice(startIndex, endIndex);

    const areaPaths = await fetchTeamAreaPaths(organization, project, team, authHeader);

    const iterationMetrics: IterationMetrics[] = [];

    for (const iteration of recentIterations) {
      const iter = iteration as {
        name?: string;
        path?: string;
        attributes?: { startDate?: string; finishDate?: string };
      };
      const workItemIds = await fetchWorkItemsByIterationPath(
        organization,
        project,
        team,
        String(iter.path ?? ""),
        areaPaths,
        authHeader,
      );

      const workItems = await fetchWorkItemDetails(organization, project, workItemIds, authHeader);

      const bugs = workItems.filter((wi) => wi.fields["System.WorkItemType"] === "Bug");
      const completedStates = ["Closed", "Done", "Resolved", "Completed"];
      const activeStates = ["Active", "In Progress", "Committed"];
      const newStates = ["New", "To Do"];

      const completedItems = workItems.filter((wi) => completedStates.includes(String(wi.fields["System.State"] ?? "")));

      const totalStoryPoints = workItems.reduce((sum, wi) => {
        const sp = Number(
          wi.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ??
            wi.fields["Microsoft.VSTS.Scheduling.Effort"] ??
            0,
        );
        return sum + sp;
      }, 0);

      const completedStoryPoints = completedItems.reduce((sum, wi) => {
        const sp = Number(
          wi.fields["Microsoft.VSTS.Scheduling.StoryPoints"] ??
            wi.fields["Microsoft.VSTS.Scheduling.Effort"] ??
            0,
        );
        return sum + sp;
      }, 0);

      const metrics: IterationMetrics = {
        iterationName: String(iter.name ?? ""),
        iterationPath: String(iter.path ?? ""),
        startDate: iter.attributes?.startDate ?? null,
        endDate: iter.attributes?.finishDate ?? null,
        totalWorkItems: workItems.length,
        completedWorkItems: completedItems.length,
        completionRate: workItems.length > 0 ? Math.round((completedItems.length / workItems.length) * 100) : 0,
        totalStoryPoints,
        completedStoryPoints,
        velocity: completedStoryPoints,
        bugCount: bugs.length,
        activeBugs: bugs.filter((b) => activeStates.includes(String(b.fields["System.State"] ?? ""))).length,
        resolvedBugs: bugs.filter((b) => completedStates.includes(String(b.fields["System.State"] ?? ""))).length,
        newBugs: bugs.filter((b) => newStates.includes(String(b.fields["System.State"] ?? ""))).length,
      };

      iterationMetrics.push(metrics);
    }

    const completedIterations = iterationMetrics.slice(0, -1);
    const { score, status } = computeHealthScore(completedIterations);

    const avgCompletionRate =
      completedIterations.length > 0
        ? Math.round(
            completedIterations.reduce((sum, i) => sum + i.completionRate, 0) /
              completedIterations.length,
          )
        : 0;
    const avgVelocity =
      completedIterations.length > 0
        ? Math.round(
            completedIterations.reduce((sum, i) => sum + i.velocity, 0) /
              completedIterations.length,
          )
        : 0;

    return {
      team: teamConfig,
      iterations: iterationMetrics,
      healthScore: score,
      healthStatus: status,
      currentIteration: iterationMetrics[iterationMetrics.length - 1] ?? null,
      avgCompletionRate,
      avgVelocity,
    };
  } catch (error) {
    return {
      team: teamConfig,
      iterations: [],
      healthScore: 0,
      healthStatus: "red",
      currentIteration: null,
      avgCompletionRate: 0,
      avgVelocity: 0,
      error: error instanceof Error ? error.message : "Failed to fetch team data",
    };
  }
}

function normalizeTeams(raw: unknown): TeamConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const team = String((row as { team?: unknown }).team ?? "").trim();
      if (!team) return null;
      const organization = String(
        (row as { organization?: unknown }).organization ?? process.env.ADO_ORG ?? "vfuk-digital",
      ).trim();
      const project = String(
        (row as { project?: unknown }).project ?? process.env.ADO_PROJECT ?? "Digital",
      ).trim();
      if (!organization || !project) return null;
      return { organization, project, team };
    })
    .filter((row): row is TeamConfig => Boolean(row));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const teams = normalizeTeams((body as { teams?: unknown }).teams);
    if (teams.length === 0) {
      return NextResponse.json({ error: "At least one team must be configured" }, { status: 400 });
    }

    const sprintCountRaw = Number((body as { sprintCount?: unknown }).sprintCount ?? 6);
    const sprintCount = Number.isFinite(sprintCountRaw)
      ? Math.max(3, Math.min(12, Math.round(sprintCountRaw)))
      : 6;

    const headerPat = request.headers.get("x-ado-pat")?.trim();
    const bodyPat = String((body as { patToken?: unknown }).patToken ?? "").trim();
    const userPat = headerPat || bodyPat || undefined;

    if (!(await adoReadable(userPat))) {
      return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
    }

    const authHeader = await adoReadAuthHeader(userPat);

    const results = await Promise.all(teams.map((team) => getTeamMetrics(team, authHeader, sprintCount)));

    const successfulTeams = results.filter((r) => !r.error);
    const avgHealthScore =
      successfulTeams.length > 0
        ? Math.round(
            successfulTeams.reduce((sum, t) => sum + t.healthScore, 0) / successfulTeams.length,
          )
        : 0;

    const orgHealthStatus: "green" | "amber" | "red" =
      avgHealthScore >= 70 ? "green" : avgHealthScore >= 45 ? "amber" : "red";

    return NextResponse.json({
      teams: results,
      summary: {
        totalTeams: teams.length,
        healthyTeams: successfulTeams.filter((t) => t.healthStatus === "green").length,
        atRiskTeams: successfulTeams.filter((t) => t.healthStatus === "amber").length,
        criticalTeams: successfulTeams.filter((t) => t.healthStatus === "red").length,
        avgHealthScore,
        orgHealthStatus,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
