import { NextRequest, NextResponse } from "next/server";
import { runCopilotPrompt } from "@/lib/copilot-api";
import type { IterationMetrics } from "@/lib/ado-metrics";

// AI analysis can take a while — give it enough headroom.
export const maxDuration = 60;

type TeamData = {
  teamName: string;
  healthScore: number;
  healthStatus: string;
  iterations: IterationMetrics[];
};

type OrgSummary = {
  totalTeams: number;
  healthyTeams: number;
  atRiskTeams: number;
  criticalTeams: number;
  avgHealthScore: number;
  orgHealthStatus: string;
};

export async function POST(request: NextRequest) {
  try {
    const githubToken = request.headers.get("x-github-pat") || undefined;
    const body = await request.json();
    const { teams, summary } = body as { teams: TeamData[]; summary: OrgSummary };

    if (!teams || teams.length === 0) {
      return NextResponse.json({ error: "No team data provided" }, { status: 400 });
    }

    // Build compact per-team summaries (completed sprints only)
    const teamSummaries = teams
      .map((team) => {
        const completed = team.iterations.slice(0, -1); // exclude current sprint
        if (completed.length === 0) return `- ${team.teamName}: No completed sprint data`;

        const avgCompletion = Math.round(
          completed.reduce((s, i) => s + i.completionRate, 0) / completed.length,
        );
        const avgVelocity = Math.round(
          completed.reduce((s, i) => s + i.velocity, 0) / completed.length,
        );
        const totalBugs = completed.reduce((s, i) => s + i.bugCount, 0);
        const lastSprint = completed[completed.length - 1];

        return `- ${team.teamName}: Health ${team.healthScore}% (${team.healthStatus}), Avg Completion ${avgCompletion}%, Avg Velocity ${avgVelocity} SP, Total Bugs ${totalBugs}, Last Sprint Completion ${Math.round(lastSprint.completionRate)}%`;
      })
      .join("\n");

    const prompt = `You are a senior engineering director's AI advisor. Provide an executive-level analysis of the engineering organization's health across ALL teams.

IMPORTANT: Only analyze completed sprints. The current sprint is in progress and excluded.

ORGANIZATION SUMMARY:
- Total Teams: ${summary.totalTeams}
- Healthy: ${summary.healthyTeams}, At Risk: ${summary.atRiskTeams}, Critical: ${summary.criticalTeams}
- Average Health Score: ${summary.avgHealthScore}% (${summary.orgHealthStatus})

TEAM-BY-TEAM SUMMARY (completed sprints only):
${teamSummaries}

Provide a concise executive analysis in this EXACT format (use markdown):

## Organization Health Overview
[2-3 sentences on overall org health, trajectory, and key themes]

## Cross-Team Comparison
- [Which teams are performing well and why]
- [Which teams need attention and why]
- [Any patterns across teams]

## Key Risks
- [Top org-level risk 1]
- [Top org-level risk 2]

## Executive Recommendations
- [Strategic recommendation 1 for leadership action]
- [Strategic recommendation 2 for leadership action]
- [Strategic recommendation 3 for leadership action]

Be specific with team names and numbers. Focus on actionable insights for senior leadership. Keep it concise.`;

    const insight = await runCopilotPrompt(prompt, githubToken);

    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(insight.length / 4);
    const totalTokens = promptTokens + responseTokens;

    return NextResponse.json({
      insight,
      generatedAt: new Date().toISOString(),
      tokens: { prompt: promptTokens, response: responseTokens, total: totalTokens },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate org insights";
    console.error("[ExecDashboard/OrgInsights] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
