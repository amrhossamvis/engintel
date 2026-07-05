import { NextRequest, NextResponse } from 'next/server';
import { runCopilotPrompt } from '@/lib/copilot-api';

type IterationMetrics = {
  iterationName: string;
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

export async function POST(request: NextRequest) {
  try {
    const githubToken = request.headers.get('x-github-pat') || undefined;
    const body = await request.json();
    const { teamName, iterations, healthScore, healthStatus } = body as {
      teamName: string;
      iterations: IterationMetrics[];
      healthScore: number;
      healthStatus: string;
    };

    if (!iterations || iterations.length === 0) {
      return NextResponse.json({ error: 'No iteration data provided' }, { status: 400 });
    }

    // Exclude current (in-progress) sprint from analysis — it skews results negatively
    const completedSprints = iterations.slice(0, -1);
    const currentSprint = iterations[iterations.length - 1];

    if (completedSprints.length === 0) {
      return NextResponse.json({ 
        insight: '## Not enough data\n\nNeed at least one completed sprint to analyze. The current sprint is still in progress.',
        generatedAt: new Date().toISOString(),
        tokens: { prompt: 0, response: 0, total: 0 },
      });
    }

    // Build a data summary for the AI prompt (completed sprints only)
    const sprintSummary = completedSprints.map((iter) => {
      return `- ${iter.iterationName}: ${iter.completedWorkItems}/${iter.totalWorkItems} items completed (${iter.completionRate}%), Velocity: ${iter.velocity} SP, Bugs: ${iter.bugCount} (${iter.activeBugs} active, ${iter.newBugs} new, ${iter.resolvedBugs} resolved)`;
    }).join('\n');

    // Calculate trends for the prompt
    const avgVelocity = Math.round(completedSprints.reduce((s, i) => s + i.velocity, 0) / completedSprints.length);
    const avgCompletion = Math.round(completedSprints.reduce((s, i) => s + i.completionRate, 0) / completedSprints.length);
    const bugsTrend = completedSprints.map(i => i.bugCount);

    const prompt = `You are an engineering delivery analyst. Analyze the following COMPLETED sprint metrics for team "${teamName}" and provide insights.

IMPORTANT: Only analyze completed sprints below. Do NOT factor in the current in-progress sprint.

COMPLETED SPRINT DATA (${completedSprints.length} sprints):
${sprintSummary}

SUMMARY:
- Health Score: ${healthScore}% (${healthStatus})
- Average Velocity: ${avgVelocity} SP
- Average Completion Rate: ${avgCompletion}%
- Bug Trend: ${bugsTrend.join(' → ')}
- Current Sprint In Progress: ${currentSprint.iterationName} (excluded from analysis)

Please provide a concise analysis in this EXACT format (use markdown):

## Sprint Health Summary
[2-3 sentences summarizing overall team performance and current trajectory]

## Key Observations
- [observation 1 about velocity/delivery trend]
- [observation 2 about quality/bug trend]
- [observation 3 about completion rate pattern]

## Risks & Concerns
- [risk 1 if any — or "No critical risks identified"]
- [risk 2 if applicable]

## Recommendations
- [actionable recommendation 1]
- [actionable recommendation 2]
- [actionable recommendation 3]

Be specific, data-driven, and concise. Reference actual numbers from the data. Use proper markdown formatting with line breaks between sections.`;

    const insight = await runCopilotPrompt(prompt, githubToken);

    // Estimate token usage (rough: ~4 chars per token for English text)
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(insight.length / 4);
    const totalTokens = promptTokens + responseTokens;

    return NextResponse.json({ 
      insight, 
      generatedAt: new Date().toISOString(),
      tokens: { prompt: promptTokens, response: responseTokens, total: totalTokens },
    });
  } catch (error: any) {
    console.error('[ExecDashboard/Insights] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI insights' },
      { status: 500 }
    );
  }
}
