import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

type SprintADOMetrics = {
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  // Delivery
  totalWorkItems: number;
  completedWorkItems: number;
  completionRate: number;
  velocity: number; // completed story points
  // Quality
  bugCount: number;
  newBugs: number;
  resolvedBugs: number;
  bugEscapeRate: number; // bugs / total work items
  // PR metrics
  prCount: number;
  avgPRCycleTimeDays: number;
  medianPRCycleTimeDays: number;
};

type CopilotMetrics = {
  source: 'github_api' | 'manual';
  acceptanceRate: number;       // 0-100
  activeUsers: number;
  totalSuggestions: number;
  acceptedSuggestions: number;
  linesAccepted: number;
  weekLabel: string;            // e.g. "Jun 2026"
};

type TeamProductivityData = {
  team: TeamConfig;
  sprints: SprintADOMetrics[];
  index: AIProductivityIndex;
  trackedRepos: string[];   // repo names used for PR metrics
  error?: string;
};

type AIProductivityResponse = {
  teams: TeamProductivityData[];
  orgSprints: SprintADOMetrics[];
  copilot: CopilotMetrics | null;
  orgIndex: AIProductivityIndex;
  resolvedRepos: string[];  // actual repo names that were found & used
};

type AIProductivityIndex = {
  score: number;           // 0-100 composite
  trend: 'improving' | 'stable' | 'declining';
  components: {
    deliveryScore: number;
    qualityScore: number;
    velocityScore: number;
    prEfficiencyScore: number;
    copilotAdoptionScore: number;
  };
  insights: string[];
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

function adoAuth(pat: string) {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
}

// ─── ADO helpers (reused from exec-dashboard pattern) ─────────────────────────

async function fetchIterations(org: string, project: string, team: string, auth: string) {
  const url = `https://dev.azure.com/${org}/${project}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=7.0`;
  const res = await axios.get(url, { headers: { Authorization: auth } });
  return res.data.value || [];
}

async function fetchTeamAreaPaths(org: string, project: string, team: string, auth: string): Promise<string[]> {
  try {
    const url = `https://dev.azure.com/${org}/${project}/${encodeURIComponent(team)}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`;
    const res = await axios.get(url, { headers: { Authorization: auth } });
    return (res.data.values || []).map((v: any) => v.value);
  } catch {
    return [];
  }
}

async function fetchWorkItemsByIteration(
  org: string, project: string, iterationPath: string,
  areaPaths: string[], auth: string
): Promise<number[]> {
  const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
  let areaFilter = '';
  if (areaPaths.length === 1) areaFilter = `AND [System.AreaPath] UNDER '${areaPaths[0]}'`;
  else if (areaPaths.length > 1) {
    areaFilter = `AND (${areaPaths.map(ap => `[System.AreaPath] UNDER '${ap}'`).join(' OR ')})`;
  }
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${iterationPath}' AND [System.WorkItemType] IN ('User Story', 'Bug', 'Product Backlog Item', 'Task', 'Feature') ${areaFilter} AND [System.TeamProject] = '${project}' ORDER BY [System.Id]`;
  try {
    const res = await axios.post(wiqlUrl, { query }, { headers: { Authorization: auth, 'Content-Type': 'application/json' } });
    return (res.data.workItems || []).map((wi: any) => wi.id);
  } catch {
    return [];
  }
}

async function fetchWorkItemDetails(org: string, project: string, ids: number[], auth: string): Promise<any[]> {
  if (ids.length === 0) return [];
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    try {
      const url = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${batch.join(',')}&fields=System.WorkItemType,System.State,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.Effort,System.CreatedDate&api-version=7.0`;
      const res = await axios.get(url, { headers: { Authorization: auth } });
      results.push(...(res.data.value || []));
    } catch { /* skip */ }
  }
  return results;
}

// ─── PR metrics ───────────────────────────────────────────────────────────────

async function resolveRepoIds(
  org: string, project: string, repoNames: string[], auth: string
): Promise<{ id: string; name: string }[]> {
  // If no repo names provided, skip PR fetching entirely — don't enumerate all repos
  if (repoNames.length === 0) return [];
  try {
    const url = `https://dev.azure.com/${org}/${project}/_apis/git/repositories?api-version=7.0`;
    const res = await axios.get(url, { headers: { Authorization: auth } });
    const allRepos: any[] = res.data.value || [];
    // Match by name (case-insensitive)
    const matched = allRepos.filter(r =>
      repoNames.some(n => r.name.toLowerCase() === n.toLowerCase())
    );
    return matched.map(r => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

async function fetchPRsForDateRange(
  org: string, project: string, repoId: string,
  minDate: string, maxDate: string, auth: string
): Promise<any[]> {
  try {
    // ADO PR API: searchCriteria.minTime filters by CREATION date, not closedDate.
    // A PR created before the sprint but merged during it would be missed if we use
    // sprint start as minTime. Use 90 days before sprint end as a wide net, then
    // filter client-side by closedDate within the sprint window.
    const sprintEnd = new Date(maxDate);
    const wideMinDate = new Date(sprintEnd);
    wideMinDate.setDate(wideMinDate.getDate() - 90);
    const wideMinDateStr = wideMinDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const baseUrl = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoId}/pullrequests`;
    const res = await axios.get(baseUrl, {
      headers: { Authorization: auth },
      params: {
        'searchCriteria.status': 'completed',
        'searchCriteria.minTime': wideMinDateStr,
        '$top': 500,
        'api-version': '7.0',
      },
    });
    const prs: any[] = res.data.value || [];

    // Filter to PRs whose closedDate falls within the sprint window
    const sprintStart = new Date(minDate).getTime();
    const sprintEndMs = sprintEnd.getTime();
    return prs.filter(pr => {
      if (!pr.closedDate) return false;
      const closed = new Date(pr.closedDate).getTime();
      return closed >= sprintStart && closed <= sprintEndMs;
    });
  } catch {
    return [];
  }
}

async function fetchPRsFromAllRepos(
  org: string, project: string,
  repos: { id: string; name: string }[],
  minDate: string, maxDate: string, auth: string
): Promise<any[]> {
  if (repos.length === 0) return [];
  const results = await Promise.all(
    repos.map(r => fetchPRsForDateRange(org, project, r.id, minDate, maxDate, auth))
  );
  return results.flat();
}

function calcPRCycleTime(prs: any[]): { avg: number; median: number } {
  if (prs.length === 0) return { avg: 0, median: 0 };
  const times = prs
    .filter(pr => pr.creationDate && pr.closedDate)
    .map(pr => {
      const created = new Date(pr.creationDate).getTime();
      const closed = new Date(pr.closedDate).getTime();
      return (closed - created) / (1000 * 60 * 60 * 24); // days
    })
    .filter(t => t >= 0);
  if (times.length === 0) return { avg: 0, median: 0 };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { avg: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10 };
}

// ─── AI Productivity Index calculation ────────────────────────────────────────

function computeAIProductivityIndex(
  sprints: SprintADOMetrics[],
  copilot: CopilotMetrics | null
): AIProductivityIndex {
  if (sprints.length === 0) {
    return {
      score: 0, trend: 'stable',
      components: { deliveryScore: 0, qualityScore: 0, velocityScore: 0, prEfficiencyScore: 0, copilotAdoptionScore: 0 },
      insights: ['No sprint data available'],
    };
  }

  const completed = sprints.filter((_, i) => i < sprints.length - 1); // exclude current in-progress
  const recent = completed.length > 0 ? completed : sprints;

  // 1. Delivery score (completion rate avg, 0-100)
  const avgCompletion = recent.reduce((s, sp) => s + sp.completionRate, 0) / recent.length;
  const deliveryScore = Math.min(100, Math.round(avgCompletion));

  // 2. Quality score (inverse bug escape rate)
  const avgBugEscape = recent.reduce((s, sp) => s + sp.bugEscapeRate, 0) / recent.length;
  // 0% bug escape = 100, 30%+ = 0
  const qualityScore = Math.max(0, Math.round(100 - (avgBugEscape / 30) * 100));

  // 3. Velocity score (stability — is velocity consistent or growing?)
  let velocityScore = 75;
  if (recent.length >= 2) {
    const velocities = recent.map(s => s.velocity).filter(v => v > 0);
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
  // <1 day = 100, 1-2 days = 85, 2-5 days = 65, 5-10 days = 40, >10 = 20
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
    // acceptance rate 0-100 → score 0-100
    // Also factor in active users (if available)
    copilotAdoptionScore = Math.min(100, Math.round(copilot.acceptanceRate));
  }

  // Composite: weighted average
  // If no copilot data, redistribute its weight to other factors
  let score: number;
  if (copilot) {
    score = Math.round(
      deliveryScore * 0.25 +
      qualityScore * 0.20 +
      velocityScore * 0.20 +
      prEfficiencyScore * 0.15 +
      copilotAdoptionScore * 0.20
    );
  } else {
    score = Math.round(
      deliveryScore * 0.30 +
      qualityScore * 0.25 +
      velocityScore * 0.25 +
      prEfficiencyScore * 0.20
    );
  }

  // Trend: compare first half vs second half of sprints
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recent.length >= 4) {
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);
    const firstAvg = firstHalf.reduce((s, sp) => s + sp.completionRate, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, sp) => s + sp.completionRate, 0) / secondHalf.length;
    if (secondAvg > firstAvg + 5) trend = 'improving';
    else if (secondAvg < firstAvg - 5) trend = 'declining';
  }

  // Insights
  const insights: string[] = [];
  if (deliveryScore >= 80) insights.push(`Strong delivery: ${Math.round(avgCompletion)}% avg sprint completion`);
  else if (deliveryScore < 60) insights.push(`Delivery needs attention: ${Math.round(avgCompletion)}% avg completion rate`);

  if (qualityScore >= 80) insights.push('Low bug escape rate — quality is well-controlled');
  else if (qualityScore < 50) insights.push('High bug escape rate — consider shifting quality left');

  if (prEfficiencyScore >= 85) insights.push(`Fast PR cycle time: avg ${avgCycleTime.toFixed(1)}d — excellent review flow`);
  else if (prEfficiencyScore < 50) insights.push(`Slow PR cycle time: avg ${avgCycleTime.toFixed(1)}d — review bottleneck detected`);

  if (copilot) {
    if (copilot.acceptanceRate >= 30) insights.push(`Copilot acceptance rate ${copilot.acceptanceRate}% — strong AI adoption`);
    else if (copilot.acceptanceRate < 20) insights.push(`Copilot acceptance rate ${copilot.acceptanceRate}% — opportunity to improve AI usage`);
    if (copilot.activeUsers > 0) insights.push(`${copilot.activeUsers} active Copilot users contributing to productivity`);
  } else {
    insights.push('Connect GitHub Copilot data to unlock the full AI Productivity Index');
  }

  if (trend === 'improving') insights.push('📈 Positive trend: team productivity is improving over time');
  else if (trend === 'declining') insights.push('📉 Declining trend: productivity metrics have dropped recently');

  return {
    score,
    trend,
    components: {
      deliveryScore,
      qualityScore,
      velocityScore,
      prEfficiencyScore,
      copilotAdoptionScore,
    },
    insights,
  };
}

// ─── Per-team data fetcher ────────────────────────────────────────────────────

async function getTeamProductivityData(
  teamConfig: TeamConfig,
  patToken: string,
  sprintCount: number,
  resolvedRepos: { id: string; name: string }[]  // pre-resolved from the shared pool
): Promise<TeamProductivityData> {
  const { organization, project, team } = teamConfig;
  const auth = adoAuth(patToken);

  try {
    // 1. Fetch iterations
    const allIterations = await fetchIterations(organization, project, team, auth);
    const now = new Date();

    let currentIdx = -1;
    for (let i = 0; i < allIterations.length; i++) {
      const s = allIterations[i].attributes?.startDate;
      const e = allIterations[i].attributes?.finishDate;
      if (s && e && new Date(s) <= now && new Date(e) >= now) { currentIdx = i; break; }
    }
    if (currentIdx === -1) {
      for (let i = allIterations.length - 1; i >= 0; i--) {
        if (allIterations[i].attributes?.startDate && new Date(allIterations[i].attributes.startDate) <= now) {
          currentIdx = i; break;
        }
      }
    }
    if (currentIdx === -1) currentIdx = allIterations.length - 1;

    const endIdx = currentIdx + 1;
    const startIdx = Math.max(0, endIdx - sprintCount);
    const recentIterations = allIterations.slice(startIdx, endIdx);

    // 2. Area paths
    const areaPaths = await fetchTeamAreaPaths(organization, project, team, auth);

    // 3. Build sprint metrics — PR data comes from all selected repos
    const sprints: SprintADOMetrics[] = [];
    const completedStates = ['Closed', 'Done', 'Resolved', 'Completed'];
    const newStates = ['New', 'To Do'];

    for (const iteration of recentIterations) {
      const workItemIds = await fetchWorkItemsByIteration(
        organization, project, iteration.path, areaPaths, auth
      );
      const workItems = await fetchWorkItemDetails(organization, project, workItemIds, auth);

      const bugs = workItems.filter((wi: any) => wi.fields['System.WorkItemType'] === 'Bug');
      const completedItems = workItems.filter((wi: any) => completedStates.includes(wi.fields['System.State']));
      const completedSP = completedItems.reduce((sum: number, wi: any) =>
        sum + (wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || wi.fields['Microsoft.VSTS.Scheduling.Effort'] || 0), 0);

      let prCount = 0, avgPRCycleTimeDays = 0, medianPRCycleTimeDays = 0;
      if (resolvedRepos.length > 0 && iteration.attributes?.startDate && iteration.attributes?.finishDate) {
        const prs = await fetchPRsFromAllRepos(
          organization, project, resolvedRepos,
          iteration.attributes.startDate, iteration.attributes.finishDate, auth
        );
        prCount = prs.length;
        const ct = calcPRCycleTime(prs);
        avgPRCycleTimeDays = ct.avg;
        medianPRCycleTimeDays = ct.median;
      }

      const totalItems = workItems.length;
      sprints.push({
        sprintName: iteration.name.split('\\').pop() || iteration.name,
        startDate: iteration.attributes?.startDate || null,
        endDate: iteration.attributes?.finishDate || null,
        totalWorkItems: totalItems,
        completedWorkItems: completedItems.length,
        completionRate: totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0,
        velocity: completedSP,
        bugCount: bugs.length,
        newBugs: bugs.filter((b: any) => newStates.includes(b.fields['System.State'])).length,
        resolvedBugs: bugs.filter((b: any) => completedStates.includes(b.fields['System.State'])).length,
        bugEscapeRate: totalItems > 0 ? Math.round((bugs.length / totalItems) * 100) : 0,
        prCount,
        avgPRCycleTimeDays,
        medianPRCycleTimeDays,
      });
    }

    return {
      team: teamConfig,
      sprints,
      index: computeAIProductivityIndex(sprints, null),
      trackedRepos: resolvedRepos.map(r => r.name),
    };
  } catch (error: any) {
    console.error(`[AI Productivity] Error for team ${team}:`, error.message);
    return {
      team: teamConfig,
      sprints: [],
      index: computeAIProductivityIndex([], null),
      trackedRepos: [],
      error: error.message || 'Failed to fetch team data',
    };
  }
}

// ─── Aggregate sprints across teams ──────────────────────────────────────────

function aggregateSprints(teamResults: TeamProductivityData[]): SprintADOMetrics[] {
  // Collect all unique sprint names (by position — last N sprints)
  const successfulTeams = teamResults.filter(t => !t.error && t.sprints.length > 0);
  if (successfulTeams.length === 0) return [];

  // Use the team with the most sprints as the reference for sprint names/dates
  const reference = successfulTeams.reduce((a, b) => a.sprints.length >= b.sprints.length ? a : b);
  const sprintCount = reference.sprints.length;

  const aggregated: SprintADOMetrics[] = [];

  for (let i = 0; i < sprintCount; i++) {
    // Collect the i-th sprint from each team (aligned by position)
    const sprintSlices = successfulTeams
      .map(t => {
        // Align from the end so the last sprint is always "current"
        const offset = t.sprints.length - sprintCount;
        return t.sprints[i + offset];
      })
      .filter(Boolean);

    if (sprintSlices.length === 0) continue;

    const refSprint = reference.sprints[i];
    const totalItems = sprintSlices.reduce((s, sp) => s + sp.totalWorkItems, 0);
    const completedItems = sprintSlices.reduce((s, sp) => s + sp.completedWorkItems, 0);
    const totalBugs = sprintSlices.reduce((s, sp) => s + sp.bugCount, 0);
    const totalPRs = sprintSlices.reduce((s, sp) => s + sp.prCount, 0);
    const totalVelocity = sprintSlices.reduce((s, sp) => s + sp.velocity, 0);

    // Avg PR cycle time across teams (weighted by PR count)
    const weightedCycleTime = sprintSlices.reduce((s, sp) => s + sp.avgPRCycleTimeDays * sp.prCount, 0);
    const avgPRCycleTimeDays = totalPRs > 0
      ? Math.round((weightedCycleTime / totalPRs) * 10) / 10
      : 0;

    aggregated.push({
      sprintName: refSprint.sprintName,
      startDate: refSprint.startDate,
      endDate: refSprint.endDate,
      totalWorkItems: totalItems,
      completedWorkItems: completedItems,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      velocity: totalVelocity,
      bugCount: totalBugs,
      newBugs: sprintSlices.reduce((s, sp) => s + sp.newBugs, 0),
      resolvedBugs: sprintSlices.reduce((s, sp) => s + sp.resolvedBugs, 0),
      bugEscapeRate: totalItems > 0 ? Math.round((totalBugs / totalItems) * 100) : 0,
      prCount: totalPRs,
      avgPRCycleTimeDays,
      medianPRCycleTimeDays: sprintSlices.reduce((s, sp) => s + sp.medianPRCycleTimeDays, 0) / sprintSlices.length,
    });
  }

  return aggregated;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patToken,
      teams,
      sprintCount = 6,
      selectedRepos = [],   // names from the shared repo pool; empty = use all
      copilotInput,
    } = body as {
      patToken: string;
      teams: TeamConfig[];
      sprintCount?: number;
      selectedRepos?: string[];
      copilotInput?: {
        acceptanceRate: number;
        activeUsers: number;
        totalSuggestions?: number;
        acceptedSuggestions?: number;
        linesAccepted?: number;
      };
    };

    if (!patToken) return NextResponse.json({ error: 'PAT token required' }, { status: 400 });
    if (!teams || teams.length === 0) return NextResponse.json({ error: 'At least one team required' }, { status: 400 });

    // ── Resolve repo IDs once (shared across all teams, same ADO project) ────
    const firstTeam = teams[0];
    const auth = adoAuth(patToken);
    const resolvedRepos = await resolveRepoIds(
      firstTeam.organization, firstTeam.project, selectedRepos, auth
    );

    // ── Fetch all teams in parallel ──────────────────────────────────────────
    const teamResults = await Promise.all(
      teams.map(t => getTeamProductivityData(t, patToken, sprintCount, resolvedRepos))
    );

    // ── Copilot data ─────────────────────────────────────────────────────────
    let copilot: CopilotMetrics | null = null;
    if (copilotInput && copilotInput.acceptanceRate > 0) {
      copilot = {
        source: 'manual',
        acceptanceRate: copilotInput.acceptanceRate,
        activeUsers: copilotInput.activeUsers || 0,
        totalSuggestions: copilotInput.totalSuggestions || 0,
        acceptedSuggestions: copilotInput.acceptedSuggestions || 0,
        linesAccepted: copilotInput.linesAccepted || 0,
        weekLabel: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      };
    }

    // ── Aggregate org-level sprints ──────────────────────────────────────────
    const orgSprints = aggregateSprints(teamResults);

    // ── Org-level index (uses aggregated sprints + copilot) ──────────────────
    const orgIndex = computeAIProductivityIndex(orgSprints, copilot);

    const response: AIProductivityResponse = {
      teams: teamResults,
      orgSprints,
      copilot,
      orgIndex,
      resolvedRepos: resolvedRepos.map(r => r.name),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[AI Productivity] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
