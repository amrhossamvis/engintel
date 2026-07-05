'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import {
  LayoutDashboard, ArrowLeft, BookOpen, Info, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Bug, Target, Users, Brain,
  Zap, Shield, BarChart3, Calculator,
} from 'lucide-react';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
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
    <div className="border-l-2 border-slate-300 pl-4 py-1">
      <p className="text-sm font-semibold text-gray-900 mb-1">{term}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{definition}</p>
      {example && <p className="text-xs text-gray-400 mt-1 italic">Example: {example}</p>}
    </div>
  );
}

function FormulaBox({ label, formula, note }: { label: string; formula: string; note?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <code className="text-sm font-mono text-slate-700 block whitespace-pre-wrap">{formula}</code>
      {note && <p className="text-xs text-gray-500 mt-2">{note}</p>}
    </div>
  );
}

export default function ExecDashboardAboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AppHeader
        title="Executive Dashboard — Methodology"
        subtitle="How health scores are calculated, what each metric means, and how to interpret the dashboard"
        icon={<BookOpen className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-slate-700 to-gray-900"
        actions={
          <button onClick={() => router.push('/exec-dashboard')}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        }
      />

      <main className="container mx-auto px-6 py-10 max-w-4xl space-y-8">

        {/* Overview */}
        <Section title="What is the Executive Dashboard?" icon={<LayoutDashboard className="w-4 h-4 text-slate-600" />}>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The <strong>Executive Engineering Dashboard</strong> provides real-time engineering health visibility for senior leadership —
            without requiring any manual reporting from teams. It automatically aggregates sprint data from Azure DevOps across all
            configured teams and computes a single <strong>Health Score</strong> per team and for the organisation as a whole.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            It answers the question leadership always asks: <em>"Are our teams healthy? Who is at risk? What should I be worried about?"</em> —
            with data-driven answers updated on demand.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Data Source', value: 'Azure DevOps (all teams)', icon: <BarChart3 className="w-4 h-4 text-slate-500" /> },
              { label: 'AI Analysis', value: 'GitHub Copilot CLI', icon: <Brain className="w-4 h-4 text-purple-500" /> },
              { label: 'Scope', value: 'Per team + org summary', icon: <Users className="w-4 h-4 text-blue-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Health Score */}
        <Section title="Team Health Score" icon={<Calculator className="w-4 h-4 text-slate-600" />}>
          <p className="text-sm text-gray-600 mb-6">
            Each team receives a <strong>Health Score (0–100)</strong> computed from three factors using the last 3 completed sprints.
            The current in-progress sprint is always excluded from scoring.
          </p>

          <div className="space-y-5">
            {/* Factor 1 */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-gray-200">
                <Target className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-gray-900">Factor 1: Completion Rate</span>
                <span className="ml-auto text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">Weight: 50%</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">The average percentage of work items completed across the last 3 completed sprints.</p>
                <FormulaBox
                  label="Formula"
                  formula="completionScore = min(100, (avgCompletionRate / 80) × 100)"
                  note="Scaled so that 80% real completion = 100 score. Teams rarely complete 100% due to scope changes — 80% is the healthy baseline."
                />
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    <p className="font-bold text-emerald-700 text-base">≥80%</p>
                    <p className="text-emerald-600">Score: 100</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <p className="font-bold text-amber-700 text-base">50%</p>
                    <p className="text-amber-600">Score: ~63</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="font-bold text-red-700 text-base">&lt;40%</p>
                    <p className="text-red-600">Score: &lt;50</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Factor 2 */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-blue-50 border-b border-gray-200">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Factor 2: Velocity Stability</span>
                <span className="ml-auto text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Weight: 25%</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">Whether the team's story point throughput is stable, growing, or declining across recent sprints.</p>
                <FormulaBox
                  label="Formula"
                  formula="trend = lastVelocity / firstVelocity (across last 3 sprints)\n\n<0.5  → 30 (severe decline)\n0.5–0.7 → 50 (declining)\n0.7–1.3 → 85 (stable)\n>1.3  → 100 (growing)"
                  note="Defaults to 80 if velocity data is unavailable (story points not used)."
                />
              </div>
            </div>

            {/* Factor 3 */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-red-50 border-b border-gray-200">
                <Bug className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-gray-900">Factor 3: Bug Health</span>
                <span className="ml-auto text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Weight: 25%</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700">Whether the team is resolving bugs or accumulating them. Measures the ratio of resolved bugs to total bugs.</p>
                <FormulaBox
                  label="Formula"
                  formula="bugScore = min(100, (resolvedBugs / totalBugs) × 100 + 20)"
                  note="+20 baseline ensures teams with no bugs don't score 0. A team resolving all bugs scores 100+, capped at 100."
                />
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> This measures bug resolution rate, not bug count. A team with many bugs but resolving them quickly scores better than a team with few bugs that are all active.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Composite */}
          <div className="mt-6">
            <FormulaBox
              label="Composite Health Score"
              formula="healthScore = completionScore × 0.50 + velocityScore × 0.25 + bugScore × 0.25"
            />
          </div>
        </Section>

        {/* RAG Status */}
        <Section title="RAG Status (Red / Amber / Green)" icon={<Shield className="w-4 h-4 text-slate-600" />}>
          <p className="text-sm text-gray-600 mb-4">
            Each team and the organisation as a whole is assigned a RAG status based on the health score.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-700 mb-1">Green</p>
              <p className="text-sm font-semibold text-emerald-800 mb-2">Score ≥ 65</p>
              <p className="text-xs text-emerald-700">Team is healthy. Delivery is on track, velocity is stable, bugs are being resolved.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-amber-700 mb-1">Amber</p>
              <p className="text-sm font-semibold text-amber-800 mb-2">Score 40–64</p>
              <p className="text-xs text-amber-700">Team is at risk. One or more factors need attention. Monitor closely and consider intervention.</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <TrendingDown className="w-6 h-6 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700 mb-1">Red</p>
              <p className="text-sm font-semibold text-red-800 mb-2">Score &lt; 40</p>
              <p className="text-xs text-red-700">Team is in critical state. Immediate leadership attention required. Escalate and investigate.</p>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">
              <strong>Org Health Status</strong> is determined by the average health score across all teams using the same thresholds:
              avg ≥ 70 → Green, avg 45–69 → Amber, avg &lt; 45 → Red.
            </p>
          </div>
        </Section>

        {/* AI Analysis */}
        <Section title="AI Sprint Analysis (Copilot CLI)" icon={<Brain className="w-4 h-4 text-slate-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            Each team card has an <strong>"AI Analysis"</strong> button that sends the team's sprint data to GitHub Copilot CLI
            for a narrative analysis. There is also an <strong>"Org Analysis"</strong> that analyses all teams together.
          </p>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Per-Team AI Analysis includes:</p>
              </div>
              <div className="p-4 space-y-1 text-sm text-gray-600">
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Sprint-by-sprint delivery narrative (what improved, what declined)</li>
                  <li>Velocity trend interpretation</li>
                  <li>Bug health assessment and risk flags</li>
                  <li>Specific recommendations for the team</li>
                  <li>Confidence level in the health score</li>
                </ul>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-purple-50 p-4 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Org-Wide AI Analysis includes:</p>
              </div>
              <div className="p-4 space-y-1 text-sm text-gray-600">
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Cross-team comparison and benchmarking</li>
                  <li>Identification of systemic issues affecting multiple teams</li>
                  <li>Top 3 risks for leadership attention</li>
                  <li>Executive-ready summary paragraph</li>
                  <li>Recommended actions for engineering leadership</li>
                </ul>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-700">
                <strong>AI analysis is on-demand, not automatic.</strong> Click the button to generate. Each generation uses Copilot CLI tokens.
                The analysis is not saved between sessions — refresh the page and it will need to be regenerated.
              </p>
            </div>
          </div>
        </Section>

        {/* Data */}
        <Section title="Data Fetched from Azure DevOps" icon={<Zap className="w-4 h-4 text-slate-600" />}>
          <p className="text-sm text-gray-600 mb-4">Per team, per sprint, the dashboard fetches:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Work Items', desc: 'User Stories, Bugs, Tasks, Features, PBIs assigned to the sprint via WIQL query scoped to the team\'s area paths.' },
              { label: 'Completion Rate', desc: 'Items in Closed / Done / Resolved / Completed state ÷ total items × 100.' },
              { label: 'Story Points (Velocity)', desc: 'Sum of Microsoft.VSTS.Scheduling.StoryPoints or Effort for completed items.' },
              { label: 'Bug Counts', desc: 'Total bugs, active bugs (Active/In Progress), resolved bugs (Closed/Done), and new bugs (New/To Do).' },
              { label: 'Iterations', desc: 'Team sprint iterations fetched from /teamsettings/iterations, filtered to the last N sprints ending at or before today.' },
              { label: 'Area Paths', desc: 'Team area path configuration from /teamsettings/teamfieldvalues, used to scope WIQL queries to the correct team.' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-800 mb-1">{label}</p>
                <p className="text-xs text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Glossary */}
        <Section title="Glossary of Terms" icon={<BookOpen className="w-4 h-4 text-slate-600" />}>
          <div className="space-y-4">
            <Term term="Health Score"
              definition="A composite 0–100 score measuring team delivery health based on completion rate (50%), velocity stability (25%), and bug resolution rate (25%). Computed from the last 3 completed sprints."
              example="Completion 75% → score 94, Velocity stable → 85, Bugs 60% resolved → 80. Health = 94×0.5 + 85×0.25 + 80×0.25 = 88" />
            <Term term="RAG Status"
              definition="Red / Amber / Green traffic light status derived from the health score. Green ≥65, Amber 40–64, Red <40." />
            <Term term="Completion Rate"
              definition="The percentage of work items in a sprint that reached a completed state (Closed, Done, Resolved, Completed)."
              example="16 completed out of 20 total → 80% completion rate" />
            <Term term="Velocity"
              definition="The total story points completed in a sprint. Used to measure throughput stability. Requires story point estimation in ADO." />
            <Term term="Velocity Stability"
              definition="Whether velocity is growing, stable, or declining. Measured by comparing the last sprint's velocity to the first sprint's velocity in the window." />
            <Term term="Active Bugs"
              definition="Bugs in Active, In Progress, or Committed state — bugs that are known but not yet resolved." />
            <Term term="Resolved Bugs"
              definition="Bugs in Closed, Done, Resolved, or Completed state — bugs that have been fixed." />
            <Term term="New Bugs"
              definition="Bugs in New or To Do state — bugs that have been logged but not yet picked up." />
            <Term term="Current Sprint"
              definition="The sprint whose date range includes today. Shown with an 'IN PROGRESS' badge. Excluded from health score calculation but shown in the sprint history table." />
            <Term term="Avg Completion Rate"
              definition="The average completion rate across all completed sprints (excluding the current in-progress sprint)." />
            <Term term="Avg SP (Story Points)"
              definition="The average velocity (completed story points) across all completed sprints." />
            <Term term="Org Health Status"
              definition="The RAG status for the entire organisation, derived from the average health score across all configured teams." />
            <Term term="AI Analysis"
              definition="A narrative analysis generated by GitHub Copilot CLI based on the team's sprint data. On-demand, not automatic. Includes delivery narrative, risk flags, and recommendations." />
            <Term term="Token Count"
              definition="The number of tokens consumed by the Copilot CLI AI analysis. Shown as ↑prompt ↓response. Useful for monitoring AI usage costs." />
          </div>
        </Section>

        {/* Limitations */}
        <Section title="Limitations & Best Practices" icon={<Info className="w-4 h-4 text-slate-600" />}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Known Limitations</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Story points must be estimated in ADO for velocity to be meaningful (0 SP = neutral score)</li>
                  <li>Health score uses last 3 completed sprints — teams with fewer sprints get a less reliable score</li>
                  <li>Work items without area paths may not be scoped correctly to a team</li>
                  <li>AI analysis is not saved between sessions and must be regenerated after page refresh</li>
                  <li>The dashboard does not track individual engineer performance — only team-level metrics</li>
                  <li>Completion rate includes all work item types (Tasks, Stories, Bugs) — teams that track tasks differently may see skewed rates</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Best Practices for Accurate Data</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Ensure all teams use consistent work item states (Closed/Done for completed, not custom states)</li>
                  <li>Estimate story points on all User Stories and PBIs for meaningful velocity tracking</li>
                  <li>Keep team area paths up to date in ADO team settings</li>
                  <li>Close completed work items before the sprint ends for accurate completion rates</li>
                  <li>Use the dashboard weekly — trends are more valuable than single-point snapshots</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* Interpreting */}
        <Section title="How to Interpret & Present the Dashboard" icon={<Minus className="w-4 h-4 text-slate-600" />}>
          <div className="space-y-4 text-sm text-gray-700">
            <p><strong>Focus on trends, not snapshots.</strong> A team that was Red last month and is now Amber is improving — that's a positive story even if the score isn't Green yet.</p>
            <p><strong>Investigate Amber before it becomes Red.</strong> The dashboard is most valuable as an early warning system. An Amber team with declining velocity needs a conversation now, not after it misses a sprint.</p>
            <p><strong>Use AI Analysis for the narrative.</strong> The health score tells you what; the AI analysis tells you why and what to do. Generate it before leadership meetings for a ready-made talking point.</p>
            <p><strong>Don't use it for performance management.</strong> The dashboard measures team health, not individual performance. Avoid using it to compare engineers or make HR decisions.</p>
            <p><strong>Present the org summary first.</strong> In leadership meetings, start with the org-level RAG status and summary cards, then drill into specific teams that need attention.</p>
          </div>
        </Section>

        {/* Back */}
        <div className="flex justify-center pb-4">
          <button onClick={() => router.push('/exec-dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-slate-700 to-gray-800 text-white text-sm font-medium hover:from-slate-800 hover:to-gray-900 transition shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Executive Dashboard
          </button>
        </div>

      </main>
    </div>
  );
}
