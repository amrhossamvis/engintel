'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import {
  Brain, ArrowLeft, Target, GitPullRequest, Bug, Zap,
  TrendingUp, Info, CheckCircle2, AlertTriangle, BookOpen,
  BarChart3, Users, GitBranch, Calculator,
} from 'lucide-react';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Term({ term, definition, example }: { term: string; definition: string; example?: string }) {
  return (
    <div className="border-l-2 border-purple-200 pl-4 py-1">
      <p className="text-sm font-semibold text-gray-900 mb-1">{term}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{definition}</p>
      {example && (
        <p className="text-xs text-gray-400 mt-1 italic">Example: {example}</p>
      )}
    </div>
  );
}

function FormulaBox({ label, formula, note }: { label: string; formula: string; note?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <code className="text-sm font-mono text-purple-700 block">{formula}</code>
      {note && <p className="text-xs text-gray-500 mt-2">{note}</p>}
    </div>
  );
}

export default function AIProductivityAboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AppHeader
        title="AI Productivity Index — Methodology"
        subtitle="How the index is calculated, what each metric means, and how to interpret your score"
        icon={<BookOpen className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-purple-600 to-violet-700"
        actions={
          <button onClick={() => router.push('/ai-productivity')}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        }
      />

      <main className="container mx-auto px-6 py-10 max-w-4xl space-y-8">

        {/* Overview */}
        <Section title="What is the AI Productivity Index?" icon={<Brain className="w-4 h-4 text-purple-600" />}>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The <strong>AI Productivity Index</strong> is a composite score (0–100) that measures how effectively your engineering
            organisation is leveraging AI tools and delivering software. It combines five dimensions of engineering performance
            into a single, executive-ready number that can be tracked over time.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The index is designed to answer the question leadership always asks: <em>"Is AI making us more productive?"</em> —
            by correlating GitHub Copilot adoption data with real delivery and quality outcomes from Azure DevOps.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Data Sources', value: 'Azure DevOps + GitHub Copilot', icon: <GitBranch className="w-4 h-4 text-purple-500" /> },
              { label: 'Update Frequency', value: 'On-demand (manual refresh)', icon: <TrendingUp className="w-4 h-4 text-blue-500" /> },
              { label: 'Scope', value: 'Per team + org aggregate', icon: <Users className="w-4 h-4 text-emerald-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* The Five Dimensions */}
        <Section title="The Five Dimensions" icon={<BarChart3 className="w-4 h-4 text-purple-600" />}>
          <p className="text-sm text-gray-600 mb-6">
            Each dimension contributes a weighted score (0–100) to the composite index. When Copilot data is not connected,
            its weight is redistributed proportionally across the other four dimensions.
          </p>

          <div className="space-y-6">
            {/* Delivery */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-purple-50 border-b border-gray-200">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-gray-900">1. Delivery Score</span>
                <span className="ml-auto text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Weight: 25% (30% without Copilot)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">Measures how consistently the team completes what it commits to in a sprint.</p>
                <FormulaBox
                  label="Formula"
                  formula="Delivery Score = avg(completionRate) across completed sprints"
                  note="Completion rate = completedWorkItems / totalWorkItems × 100. Capped at 100."
                />
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <p className="font-bold text-emerald-700 text-base">≥80</p>
                    <p className="text-emerald-600">Strong delivery</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="font-bold text-amber-700 text-base">60–79</p>
                    <p className="text-amber-600">Acceptable</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="font-bold text-red-700 text-base">&lt;60</p>
                    <p className="text-red-600">Needs attention</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-cyan-50 border-b border-gray-200">
                <Bug className="w-4 h-4 text-cyan-600" />
                <span className="text-sm font-semibold text-gray-900">2. Quality Score</span>
                <span className="ml-auto text-xs font-medium text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full">Weight: 20% (25% without Copilot)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">Measures how well the team controls defects relative to total work. Lower bug escape rate = higher quality score.</p>
                <FormulaBox
                  label="Formula"
                  formula="Quality Score = max(0, 100 − (avgBugEscapeRate / 30) × 100)"
                  note="Bug escape rate = bugs / totalWorkItems × 100. A 0% rate scores 100; 30%+ scores 0."
                />
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <p className="font-bold text-emerald-700 text-base">≥80</p>
                    <p className="text-emerald-600">Low bug escape</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="font-bold text-amber-700 text-base">50–79</p>
                    <p className="text-amber-600">Moderate</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="font-bold text-red-700 text-base">&lt;50</p>
                    <p className="text-red-600">High bug rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Velocity */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border-b border-gray-200">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">3. Velocity Score</span>
                <span className="ml-auto text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Weight: 20% (25% without Copilot)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">Measures whether the team's story point throughput is stable or growing over time. Rewards consistency and improvement.</p>
                <FormulaBox
                  label="Formula"
                  formula="trend = lastVelocity / firstVelocity"
                  note="≥1.1 → 100 (growing) | 0.9–1.1 → 80 (stable) | 0.7–0.9 → 60 (slight decline) | <0.7 → 40 (declining)"
                />
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> If story points are not used (velocity = 0 across all sprints), this dimension defaults to 75 (neutral).
                    Consider enabling story point estimation in your ADO process.
                  </p>
                </div>
              </div>
            </div>

            {/* PR Flow */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border-b border-gray-200">
                <GitPullRequest className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-900">4. PR Flow Score</span>
                <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Weight: 15% (20% without Copilot)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Measures how fast pull requests move from creation to merge. Slow PR cycle time indicates review bottlenecks
                  that slow down delivery. Requires repos to be configured in Settings.
                </p>
                <FormulaBox
                  label="Cycle Time Calculation"
                  formula="cycleTime = (closedDate − creationDate) in days, averaged across all merged PRs"
                  note="Only completed (merged) PRs within the sprint date range are counted."
                />
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {[
                    { range: '<1d', score: '100', color: 'emerald' },
                    { range: '1–2d', score: '85', color: 'emerald' },
                    { range: '2–5d', score: '65', color: 'amber' },
                    { range: '5–10d', score: '40', color: 'orange' },
                    { range: '>10d', score: '20', color: 'red' },
                  ].map(({ range, score, color }) => (
                    <div key={range} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-2`}>
                      <p className={`font-bold text-${color}-700 text-sm`}>{score}</p>
                      <p className={`text-${color}-600`}>{range}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700">
                    <strong>No repos configured?</strong> PR Flow defaults to 75 (neutral). Add your repositories in Settings
                    to unlock this dimension with real data.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Adoption */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-amber-50 border-b border-gray-200">
                <Brain className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-gray-900">5. AI Adoption Score</span>
                <span className="ml-auto text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Weight: 20% (0% if not connected)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Measures how effectively engineers are using GitHub Copilot. The acceptance rate is the primary signal —
                  it reflects how often engineers find AI suggestions useful enough to keep.
                </p>
                <FormulaBox
                  label="Formula"
                  formula="AI Adoption Score = min(100, acceptanceRate)"
                  note="Acceptance rate is entered manually from your Power BI Copilot telemetry report, or fetched via GitHub API."
                />
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <p className="font-bold text-emerald-700 text-base">≥30%</p>
                    <p className="text-emerald-600">Strong adoption</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="font-bold text-amber-700 text-base">20–29%</p>
                    <p className="text-amber-600">Moderate</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="font-bold text-red-700 text-base">&lt;20%</p>
                    <p className="text-red-600">Low adoption</p>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <p className="text-xs text-purple-700">
                    <strong>Industry benchmark:</strong> GitHub reports an average Copilot acceptance rate of 25–35% across enterprise customers.
                    Teams above 35% are considered high adopters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Composite Score */}
        <Section title="Composite Score Calculation" icon={<Calculator className="w-4 h-4 text-purple-600" />}>
          <div className="space-y-4">
            <FormulaBox
              label="With Copilot data"
              formula="Score = Delivery×0.25 + Quality×0.20 + Velocity×0.20 + PRFlow×0.15 + AIAdoption×0.20"
            />
            <FormulaBox
              label="Without Copilot data"
              formula="Score = Delivery×0.30 + Quality×0.25 + Velocity×0.25 + PRFlow×0.20"
              note="AI Adoption weight is redistributed proportionally when Copilot data is not connected."
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs mt-4">
              {[
                { range: '85–100', label: 'Excellent', color: 'emerald' },
                { range: '70–84', label: 'Good', color: 'blue' },
                { range: '55–69', label: 'Fair', color: 'amber' },
                { range: '40–54', label: 'Needs Work', color: 'orange' },
                { range: '0–39', label: 'Critical', color: 'red' },
              ].map(({ range, label, color }) => (
                <div key={range} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
                  <p className={`font-bold text-${color}-700 text-sm`}>{range}</p>
                  <p className={`text-${color}-600 mt-0.5`}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Trend */}
        <Section title="Trend Detection" icon={<TrendingUp className="w-4 h-4 text-purple-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            The trend indicator (Improving / Stable / Declining) compares the average completion rate of the first half
            of your sprint history against the second half. Requires at least 4 completed sprints.
          </p>
          <FormulaBox
            label="Algorithm"
            formula="firstHalfAvg = avg(completionRate, sprints[0..N/2])\nsecondHalfAvg = avg(completionRate, sprints[N/2..N])\n\nImproving if secondHalfAvg > firstHalfAvg + 5\nDeclining if secondHalfAvg < firstHalfAvg − 5\nStable otherwise"
          />
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">
              <strong>Current sprint excluded:</strong> The in-progress sprint is always excluded from trend and score calculations
              (it appears in the table with an "IN PROGRESS" badge). Only completed sprints are used for scoring.
            </p>
          </div>
        </Section>

        {/* Glossary */}
        <Section title="Glossary of Terms" icon={<BookOpen className="w-4 h-4 text-purple-600" />}>
          <div className="space-y-4">
            <Term
              term="Sprint / Iteration"
              definition="A fixed time-box (typically 2 weeks) in which a team commits to delivering a set of work items. Sourced from Azure DevOps team iterations."
            />
            <Term
              term="Work Items"
              definition="User Stories, Bugs, Tasks, Features, and Product Backlog Items assigned to a sprint in Azure DevOps. The index counts all types."
            />
            <Term
              term="Completion Rate"
              definition="The percentage of work items in a sprint that reached a completed state (Closed, Done, Resolved, or Completed) by the end of the sprint."
              example="20 items committed, 16 completed → 80% completion rate"
            />
            <Term
              term="Velocity"
              definition="The total story points (or effort points) completed in a sprint. Used to measure throughput stability over time. Requires story point estimation in ADO."
              example="Sprint 1: 34 SP, Sprint 2: 38 SP, Sprint 3: 36 SP → stable velocity"
            />
            <Term
              term="Bug Escape Rate"
              definition="The proportion of work items in a sprint that are bugs. A high rate suggests quality issues are being discovered late or that the team is carrying significant technical debt."
              example="5 bugs out of 25 total items → 20% bug escape rate"
            />
            <Term
              term="PR Cycle Time"
              definition="The average number of days from when a pull request is created to when it is merged (closed). Measures review flow efficiency. Calculated from ADO Git repositories."
              example="PR created Monday, merged Wednesday → 2 days cycle time"
            />
            <Term
              term="Copilot Acceptance Rate"
              definition="The percentage of GitHub Copilot code suggestions that engineers accepted (kept in their code). The primary measure of AI tool effectiveness."
              example="1,000 suggestions shown, 320 accepted → 32% acceptance rate"
            />
            <Term
              term="Active Copilot Users"
              definition="The number of engineers who used GitHub Copilot at least once in the reporting period. Measures breadth of AI adoption across the team."
            />
            <Term
              term="Lines Accepted"
              definition="The total number of lines of code written by GitHub Copilot that engineers kept. A proxy for AI-generated code contribution to the codebase."
            />
            <Term
              term="Org-Level Aggregate"
              definition="Sprint metrics summed across all configured teams. Work items and bugs are totalled; PR cycle time is weighted by PR count per team to avoid bias from teams with fewer PRs."
            />
            <Term
              term="Resolved Repos"
              definition="The ADO repository names from your configured pool that were successfully matched by name in the ADO project. Shown in the dashboard banner after each run."
            />
          </div>
        </Section>

        {/* Data Sources */}
        <Section title="Data Sources & Limitations" icon={<Info className="w-4 h-4 text-purple-600" />}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Azure DevOps (automatic)</p>
                <p className="text-sm text-gray-600">Sprint iterations, work item states, story points, bug counts, and PR data are fetched directly from the ADO REST API using your PAT token. Data is always current as of the time of the last refresh.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">GitHub Copilot (manual input)</p>
                <p className="text-sm text-gray-600">Copilot metrics are entered manually from your Power BI telemetry report (available in your Teams tab). A Classic GitHub PAT with <code className="text-xs bg-gray-100 px-1 rounded">manage_billing:copilot</code> scope can automate this — see <code className="text-xs bg-gray-100 px-1 rounded">GITHUB_PAT_FIX.md</code>.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Known Limitations</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Story points must be estimated in ADO for velocity to be meaningful (0 SP = neutral score)</li>
                  <li>PR cycle time requires at least one repo configured in Settings</li>
                  <li>Copilot data is org-level (not per-team) — the same acceptance rate applies to all teams</li>
                  <li>Work items without area paths may not be scoped correctly to a team</li>
                  <li>The index reflects completed sprints only — in-progress sprint data is shown but excluded from scoring</li>
                  <li>Correlation ≠ causation: a high index reflects good engineering practices, not necessarily AI causation</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* Interpreting */}
        <Section title="How to Interpret & Use the Index" icon={<Zap className="w-4 h-4 text-purple-600" />}>
          <div className="space-y-4 text-sm text-gray-700">
            <p><strong>Use it as a trend indicator, not an absolute truth.</strong> A score of 72 today vs 65 last month is more meaningful than the absolute number. Focus on direction.</p>
            <p><strong>Diagnose with the breakdown.</strong> If the overall score is low, check which dimension is dragging it down. A low Quality score points to bug management; a low PR Flow score points to review bottlenecks.</p>
            <p><strong>Connect Copilot data to unlock the full picture.</strong> Without Copilot data, the index measures delivery and quality only. Adding Copilot metrics enables the AI ROI correlation that makes this tool unique.</p>
            <p><strong>Compare teams, not just time.</strong> The per-team breakdown lets you identify which teams are high performers and which need support — and whether AI adoption correlates with better outcomes.</p>
            <p><strong>Present the trend, not the score.</strong> For executive audiences, the trend (Improving / Stable / Declining) and the direction of change are more compelling than the raw number.</p>
          </div>
        </Section>

        {/* Back button */}
        <div className="flex justify-center pb-4">
          <button onClick={() => router.push('/ai-productivity')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-700 hover:to-violet-700 transition shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Back to AI Productivity Dashboard
          </button>
        </div>

      </main>
    </div>
  );
}
