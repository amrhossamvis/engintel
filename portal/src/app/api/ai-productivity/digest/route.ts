import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type DigestPayload = {
  webhookUrl: string;
  score: number;
  trend: string;
  components: {
    deliveryScore: number;
    qualityScore: number;
    velocityScore: number;
    prEfficiencyScore: number;
    copilotAdoptionScore: number;
  };
  orgStats: {
    avgCompletion: number;
    avgCycleTime: string;
    avgBugEscape: number;
    totalPRs: number;
    sprintCount: number;
  } | null;
  copilot: {
    acceptanceRate: number;
    activeUsers: number;
    totalSuggestions: number;
    acceptedSuggestions: number;
    linesAccepted: number;
  } | null;
  baseline: {
    label: string;
    score: number;
    savedAt: string;
  } | null;
  insights: string[];
  teamCount: number;
  productivityGainPct: number;
};

function ragColor(score: number): string {
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Warning';
  return 'Attention';
}

function ragEmoji(score: number): string {
  if (score >= 75) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

function scoreLabel(s: number): string {
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 55) return 'Fair';
  if (s >= 40) return 'Needs Work';
  return 'Critical';
}

function trendArrow(trend: string): string {
  if (trend === 'improving') return '↑ Improving';
  if (trend === 'declining') return '↓ Declining';
  return '→ Stable';
}

export async function POST(req: NextRequest) {
  let body: DigestPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { webhookUrl, score, trend, components, orgStats, copilot, baseline, insights, teamCount, productivityGainPct } = body;

  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid or missing Teams webhook URL' }, { status: 400 });
  }

  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const baselineDelta = baseline ? score - baseline.score : null;
  const baselineText = baseline
    ? `${baselineDelta !== null && baselineDelta >= 0 ? '+' : ''}${baselineDelta} vs baseline (${baseline.label})`
    : 'No baseline set';

  // Build Adaptive Card for Teams
  const adaptiveCard = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            // Header
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'ColumnSet',
                  columns: [
                    {
                      type: 'Column',
                      width: 'stretch',
                      items: [
                        {
                          type: 'TextBlock',
                          text: `${ragEmoji(score)} AI Productivity Index — Monthly Digest`,
                          weight: 'Bolder',
                          size: 'Large',
                          color: 'Default',
                        },
                        {
                          type: 'TextBlock',
                          text: now,
                          isSubtle: true,
                          spacing: 'None',
                        },
                      ],
                    },
                    {
                      type: 'Column',
                      width: 'auto',
                      items: [
                        {
                          type: 'TextBlock',
                          text: String(score),
                          weight: 'Bolder',
                          size: 'ExtraLarge',
                          color: score >= 75 ? 'Good' : score >= 50 ? 'Warning' : 'Attention',
                          horizontalAlignment: 'Right',
                        },
                        {
                          type: 'TextBlock',
                          text: scoreLabel(score),
                          isSubtle: true,
                          horizontalAlignment: 'Right',
                          spacing: 'None',
                        },
                      ],
                    },
                  ],
                },
              ],
            },

            // Trend + baseline
            {
              type: 'FactSet',
              facts: [
                { title: 'Trend', value: trendArrow(trend) },
                { title: 'Teams', value: `${teamCount} team${teamCount !== 1 ? 's' : ''}` },
                { title: 'Baseline', value: baselineText },
                ...(productivityGainPct > 0 ? [{ title: 'Productivity Gain', value: `+${productivityGainPct}% estimated` }] : []),
              ],
            },

            // Score breakdown
            {
              type: 'TextBlock',
              text: '**Score Breakdown**',
              weight: 'Bolder',
              spacing: 'Medium',
            },
            {
              type: 'FactSet',
              facts: [
                { title: `${ragEmoji(components.deliveryScore)} Delivery`, value: `${components.deliveryScore}/100` },
                { title: `${ragEmoji(components.qualityScore)} Quality`, value: `${components.qualityScore}/100` },
                { title: `${ragEmoji(components.velocityScore)} Velocity`, value: `${components.velocityScore}/100` },
                { title: `${ragEmoji(components.prEfficiencyScore)} PR Flow`, value: `${components.prEfficiencyScore}/100` },
                { title: `${ragEmoji(components.copilotAdoptionScore)} AI Adoption`, value: `${components.copilotAdoptionScore}/100` },
              ],
            },

            // Org stats
            ...(orgStats ? [
              {
                type: 'TextBlock',
                text: '**Delivery Metrics**',
                weight: 'Bolder',
                spacing: 'Medium',
              },
              {
                type: 'ColumnSet',
                columns: [
                  {
                    type: 'Column',
                    width: 'stretch',
                    items: [
                      { type: 'TextBlock', text: `${orgStats.avgCompletion}%`, weight: 'Bolder', size: 'Large', color: orgStats.avgCompletion >= 80 ? 'Good' : orgStats.avgCompletion >= 60 ? 'Warning' : 'Attention' },
                      { type: 'TextBlock', text: 'Avg Completion', isSubtle: true, spacing: 'None', size: 'Small' },
                    ],
                  },
                  {
                    type: 'Column',
                    width: 'stretch',
                    items: [
                      { type: 'TextBlock', text: `${orgStats.avgCycleTime}d`, weight: 'Bolder', size: 'Large', color: Number(orgStats.avgCycleTime) <= 2 ? 'Good' : Number(orgStats.avgCycleTime) <= 5 ? 'Warning' : 'Attention' },
                      { type: 'TextBlock', text: 'PR Cycle Time', isSubtle: true, spacing: 'None', size: 'Small' },
                    ],
                  },
                  {
                    type: 'Column',
                    width: 'stretch',
                    items: [
                      { type: 'TextBlock', text: `${orgStats.avgBugEscape}%`, weight: 'Bolder', size: 'Large', color: orgStats.avgBugEscape <= 10 ? 'Good' : orgStats.avgBugEscape <= 20 ? 'Warning' : 'Attention' },
                      { type: 'TextBlock', text: 'Bug Escape Rate', isSubtle: true, spacing: 'None', size: 'Small' },
                    ],
                  },
                  {
                    type: 'Column',
                    width: 'stretch',
                    items: [
                      { type: 'TextBlock', text: String(orgStats.totalPRs), weight: 'Bolder', size: 'Large' },
                      { type: 'TextBlock', text: 'PRs Merged', isSubtle: true, spacing: 'None', size: 'Small' },
                    ],
                  },
                ],
              },
            ] : []),

            // Copilot
            ...(copilot ? [
              {
                type: 'TextBlock',
                text: '**GitHub Copilot**',
                weight: 'Bolder',
                spacing: 'Medium',
              },
              {
                type: 'FactSet',
                facts: [
                  { title: 'Acceptance Rate', value: `${copilot.acceptanceRate}%` },
                  { title: 'Active Users', value: String(copilot.activeUsers) },
                  { title: 'Lines Accepted', value: copilot.linesAccepted.toLocaleString() },
                ],
              },
            ] : []),

            // Insights
            ...(insights.length > 0 ? [
              {
                type: 'TextBlock',
                text: '**Key Insights**',
                weight: 'Bolder',
                spacing: 'Medium',
              },
              ...insights.slice(0, 3).map((insight, i) => ({
                type: 'TextBlock',
                text: `${i + 1}. ${insight}`,
                wrap: true,
                spacing: i === 0 ? 'Small' : 'None',
                size: 'Small',
              })),
            ] : []),

            // Footer
            {
              type: 'TextBlock',
              text: 'Generated by EnginTel · AI Productivity Index',
              isSubtle: true,
              size: 'Small',
              spacing: 'Medium',
              separator: true,
            },
          ],
        },
      },
    ],
  };

  try {
    const teamsRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adaptiveCard),
    });

    if (!teamsRes.ok) {
      const text = await teamsRes.text();
      return NextResponse.json(
        { error: `Teams webhook returned ${teamsRes.status}: ${text}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, sentAt: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to reach Teams webhook: ${msg}` }, { status: 502 });
  }
}
