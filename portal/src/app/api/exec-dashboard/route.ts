import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
  healthStatus: 'green' | 'amber' | 'red';
  currentIteration: IterationMetrics | null;
  avgCompletionRate: number;
  avgVelocity: number;
  error?: string;
};

function getAuthHeader(patToken: string): string {
  const base64Token = Buffer.from(`:${patToken}`).toString('base64');
  return `Basic ${base64Token}`;
}

async function fetchIterations(
  org: string,
  project: string,
  team: string,
  authHeader: string
): Promise<any[]> {
  const url = `https://dev.azure.com/${org}/${project}/${team}/_apis/work/teamsettings/iterations?api-version=7.0`;
  const response = await axios.get(url, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
  });
  return response.data.value || [];
}

async function fetchTeamAreaPaths(
  org: string,
  project: string,
  team: string,
  authHeader: string
): Promise<string[]> {
  // Fetch team's area path configuration
  const url = `https://dev.azure.com/${org}/${project}/${encodeURIComponent(team)}/_apis/work/teamsettings/teamfieldvalues?api-version=7.0`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    const values = response.data.values || [];
    const areaPaths = values.map((v: any) => v.value);
    return areaPaths;
  } catch (err: any) {
    console.error(`[ExecDashboard] fetchTeamAreaPaths error: ${err.response?.status} - ${err.message}`);
    return [];
  }
}

async function fetchWorkItemsByIterationPath(
  org: string,
  project: string,
  team: string,
  iterationPath: string,
  areaPaths: string[],
  authHeader: string
): Promise<number[]> {
  const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
  
  // Build area path filter
  let areaFilter = '';
  if (areaPaths.length === 1) {
    areaFilter = `AND [System.AreaPath] UNDER '${areaPaths[0]}'`;
  } else if (areaPaths.length > 1) {
    const areaConditions = areaPaths.map(ap => `[System.AreaPath] UNDER '${ap}'`).join(' OR ');
    areaFilter = `AND (${areaConditions})`;
  }
  
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${iterationPath}' AND [System.WorkItemType] IN ('User Story', 'Bug', 'Product Backlog Item', 'Task', 'Feature') ${areaFilter} AND [System.TeamProject] = '${project}' ORDER BY [System.Id]`;
  
  try {
    const response = await axios.post(wiqlUrl, { query }, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    });
    const ids = (response.data.workItems || []).map((wi: any) => wi.id);
    return ids;
  } catch (err: any) {
    console.error(`[ExecDashboard] WIQL error: ${err.response?.status} - ${err.response?.data?.message || err.message}`);
    return [];
  }
}

async function fetchWorkItemDetails(
  org: string,
  project: string,
  ids: number[],
  authHeader: string
): Promise<any[]> {
  if (ids.length === 0) return [];
  
  // ADO API has a limit of 200 IDs per request
  const batchSize = 200;
  const results: any[] = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const url = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${batch.join(',')}&fields=System.WorkItemType,System.State,System.Title,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.Effort,System.CreatedDate&api-version=7.0`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      });
      results.push(...(response.data.value || []));
    } catch {
      // Skip failed batches
    }
  }
  
  return results;
}

function computeHealthScore(iterations: IterationMetrics[]): { score: number; status: 'green' | 'amber' | 'red' } {
  if (iterations.length === 0) return { score: 75, status: 'green' };
  
  // Use the last 3 completed iterations for trend analysis
  const recent = iterations.slice(-3);
  
  // Factor 1: Completion rate (50% weight)
  // Normalize: 50% completion is baseline "ok" for teams with mixed states
  const avgCompletionRate = recent.reduce((sum, i) => sum + i.completionRate, 0) / recent.length;
  // Scale so that 50% real completion = 70 score, 80%+ = 100
  const completionScore = Math.min(100, (avgCompletionRate / 80) * 100);
  
  // Factor 2: Velocity stability (25% weight) — is velocity stable or declining?
  let velocityScore = 80; // Default "stable"
  if (recent.length >= 2) {
    const velocities = recent.map(i => i.velocity);
    const nonZeroVelocities = velocities.filter(v => v > 0);
    if (nonZeroVelocities.length >= 2) {
      const first = nonZeroVelocities[0];
      const last = nonZeroVelocities[nonZeroVelocities.length - 1];
      const trend = last / first;
      // Score: declining (<0.7) = 40, stable (0.7-1.3) = 80, growing (>1.3) = 100
      if (trend < 0.5) velocityScore = 30;
      else if (trend < 0.7) velocityScore = 50;
      else if (trend <= 1.3) velocityScore = 85;
      else velocityScore = 100;
    }
  }
  
  // Factor 3: Bug health (25% weight) — are bugs being resolved?
  const totalBugs = recent.reduce((sum, i) => sum + i.bugCount, 0);
  const resolvedBugs = recent.reduce((sum, i) => sum + i.resolvedBugs, 0);
  let bugScore = 80; // Default healthy
  if (totalBugs > 0) {
    const resolveRatio = resolvedBugs / totalBugs;
    // Good if most bugs are resolved; bad if they're all active
    bugScore = Math.min(100, Math.round(resolveRatio * 100 + 20)); // +20 baseline
  }
  
  const score = Math.round(completionScore * 0.5 + velocityScore * 0.25 + bugScore * 0.25);
    
  let status: 'green' | 'amber' | 'red';
  if (score >= 65) status = 'green';
  else if (score >= 40) status = 'amber';
  else status = 'red';
  
  return { score, status };
}

async function getTeamMetrics(
  teamConfig: TeamConfig,
  patToken: string,
  sprintCount: number
): Promise<TeamDashboardData> {
  const authHeader = getAuthHeader(patToken);
  const { organization, project, team } = teamConfig;
  
  try {
    // 1. Fetch all iterations
    const allIterations = await fetchIterations(organization, project, team, authHeader);
        
    // Find current iteration by date
    const now = new Date();
    let currentIterationIndex = -1;
    
    for (let i = 0; i < allIterations.length; i++) {
      const iter = allIterations[i];
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
    
    // If we couldn't find current by date, find the last iteration with dates not in the future
    if (currentIterationIndex === -1) {
      for (let i = allIterations.length - 1; i >= 0; i--) {
        const iter = allIterations[i];
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
    
    // Take sprints ending at current iteration (not future ones)
    const endIndex = currentIterationIndex + 1;
    const startIndex = Math.max(0, endIndex - sprintCount);
    const recentIterations = allIterations.slice(startIndex, endIndex);
    
    // Fetch team's area paths to scope WIQL queries
    const areaPaths = await fetchTeamAreaPaths(organization, project, team, authHeader);
    
    const iterationMetrics: IterationMetrics[] = [];
    
    for (const iteration of recentIterations) {
      // 2. Fetch work items for this iteration using WIQL scoped to team's area paths
      const workItemIds = await fetchWorkItemsByIterationPath(
        organization, project, team, iteration.path, areaPaths, authHeader
      );
      
      // 3. Get work item details
      const workItems = await fetchWorkItemDetails(organization, project, workItemIds, authHeader);
            
      // 4. Calculate metrics
      const bugs = workItems.filter((wi: any) => wi.fields['System.WorkItemType'] === 'Bug');
      const completedStates = ['Closed', 'Done', 'Resolved', 'Completed'];
      const activeStates = ['Active', 'In Progress', 'Committed'];
      const newStates = ['New', 'To Do'];
      
      const completedItems = workItems.filter((wi: any) => 
        completedStates.includes(wi.fields['System.State'])
      );
      
      const totalStoryPoints = workItems.reduce((sum: number, wi: any) => {
        const sp = wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 
                   wi.fields['Microsoft.VSTS.Scheduling.Effort'] || 0;
        return sum + sp;
      }, 0);
      
      const completedStoryPoints = completedItems.reduce((sum: number, wi: any) => {
        const sp = wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 
                   wi.fields['Microsoft.VSTS.Scheduling.Effort'] || 0;
        return sum + sp;
      }, 0);
      
      const metrics: IterationMetrics = {
        iterationName: iteration.name,
        iterationPath: iteration.path,
        startDate: iteration.attributes?.startDate || null,
        endDate: iteration.attributes?.finishDate || null,
        totalWorkItems: workItems.length,
        completedWorkItems: completedItems.length,
        completionRate: workItems.length > 0 ? Math.round((completedItems.length / workItems.length) * 100) : 0,
        totalStoryPoints,
        completedStoryPoints,
        velocity: completedStoryPoints,
        bugCount: bugs.length,
        activeBugs: bugs.filter((b: any) => activeStates.includes(b.fields['System.State'])).length,
        resolvedBugs: bugs.filter((b: any) => completedStates.includes(b.fields['System.State'])).length,
        newBugs: bugs.filter((b: any) => newStates.includes(b.fields['System.State'])).length,
      };
      
      iterationMetrics.push(metrics);
    }
    
    // 5. Compute health score (exclude current/in-progress sprint — only use completed ones)
    const completedIterations = iterationMetrics.slice(0, -1); // All except current
    const { score, status } = computeHealthScore(completedIterations);
    
    // Calculate averages from completed sprints only
    const avgCompletionRate = completedIterations.length > 0
      ? Math.round(completedIterations.reduce((sum, i) => sum + i.completionRate, 0) / completedIterations.length)
      : 0;
    const avgVelocity = completedIterations.length > 0
      ? Math.round(completedIterations.reduce((sum, i) => sum + i.velocity, 0) / completedIterations.length)
      : 0;
    
    // Current iteration is the last one we fetched (since we sliced up to current)
    const currentIteration = iterationMetrics[iterationMetrics.length - 1] || null;
    
    return {
      team: teamConfig,
      iterations: iterationMetrics,
      healthScore: score,
      healthStatus: status,
      currentIteration,
      avgCompletionRate,
      avgVelocity,
    };
  } catch (error: any) {
    console.error(`[ExecDashboard] Error for team ${team}:`, error.message);
    return {
      team: teamConfig,
      iterations: [],
      healthScore: 0,
      healthStatus: 'red',
      currentIteration: null,
      avgCompletionRate: 0,
      avgVelocity: 0,
      error: error.message || 'Failed to fetch team data',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patToken, teams, sprintCount = 6 } = body as {
      patToken: string;
      teams: TeamConfig[];
      sprintCount?: number;
    };

    if (!patToken) {
      return NextResponse.json({ error: 'PAT token is required' }, { status: 400 });
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({ error: 'At least one team must be configured' }, { status: 400 });
    }

    // Fetch metrics for all teams in parallel
    const results = await Promise.all(
      teams.map((team) => getTeamMetrics(team, patToken, sprintCount))
    );

    // Calculate organization-level summary
    const successfulTeams = results.filter((r) => !r.error);
    const avgHealthScore = successfulTeams.length > 0
      ? Math.round(successfulTeams.reduce((sum, r) => sum + r.healthScore, 0) / successfulTeams.length)
      : 0;
    
    let orgHealthStatus: 'green' | 'amber' | 'red';
    if (avgHealthScore >= 70) orgHealthStatus = 'green';
    else if (avgHealthScore >= 45) orgHealthStatus = 'amber';
    else orgHealthStatus = 'red';

    return NextResponse.json({
      teams: results,
      summary: {
        totalTeams: teams.length,
        healthyTeams: successfulTeams.filter((r) => r.healthStatus === 'green').length,
        atRiskTeams: successfulTeams.filter((r) => r.healthStatus === 'amber').length,
        criticalTeams: successfulTeams.filter((r) => r.healthStatus === 'red').length,
        avgHealthScore,
        orgHealthStatus,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
