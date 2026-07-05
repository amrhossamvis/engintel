'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import {
  Bug, ArrowLeft, BookOpen, Info, CheckCircle2, AlertTriangle,
  GitPullRequest, Zap, Search, Calendar, FileText, Brain,
  TrendingUp, Shield,
} from 'lucide-react';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
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
    <div className="border-l-2 border-red-200 pl-4 py-1">
      <p className="text-sm font-semibold text-gray-900 mb-1">{term}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{definition}</p>
      {example && <p className="text-xs text-gray-400 mt-1 italic">Example: {example}</p>}
    </div>
  );
}

function StepBox({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-sm font-bold text-red-600">{step}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function BugAnalyzerAboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AppHeader
        title="Bug Analyzer — Methodology"
        subtitle="How bug classification works, what each result means, and how to interpret the output"
        icon={<BookOpen className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-red-600 to-rose-700"
        actions={
          <button onClick={() => router.push('/bug-analyzer')}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Analyzer
          </button>
        }
      />

      <main className="container mx-auto px-6 py-10 max-w-4xl space-y-8">

        {/* Overview */}
        <Section title="What is the Bug Analyzer?" icon={<Bug className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            The <strong>Bug Analyzer</strong> is an AI-powered tool that classifies bugs from Azure DevOps into
            <strong> progressions</strong> and <strong>regressions</strong>, generates automated Root Cause Analysis (RCA),
            and produces exportable sprint reports — replacing hours of manual bug triage with a single automated run.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            It answers the question every engineering manager asks at the end of a sprint: <em>"Which bugs are new issues we introduced, and which are old problems resurfacing?"</em>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { label: 'Data Source', value: 'Azure DevOps Query URL', icon: <Search className="w-4 h-4 text-red-500" /> },
              { label: 'AI Engine', value: 'GitHub Copilot CLI', icon: <Brain className="w-4 h-4 text-purple-500" /> },
              { label: 'Output', value: 'Excel report + dashboard', icon: <FileText className="w-4 h-4 text-blue-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-gray-500">{label}</p></div>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section title="How It Works — Step by Step" icon={<Zap className="w-4 h-4 text-red-600" />}>
          <div className="space-y-5">
            <StepBox step={1} title="Fetch bugs from ADO query"
              description="You provide an Azure DevOps query URL that returns a list of bugs. The analyzer fetches all bugs in that query using your PAT token, including their title, state, tags, linked PRs, and history." />
            <StepBox step={2} title="Auto-detect sprint dates"
              description="If you don't provide sprint dates, the tool inspects the bug creation dates and iteration paths to automatically infer the sprint start and end dates. You can also set them manually." />
            <StepBox step={3} title="Fetch linked pull requests"
              description="For each bug, the tool fetches any linked pull requests from ADO Git repositories. PR titles, descriptions, and commit messages are used as context for classification." />
            <StepBox step={4} title="AI classification via Copilot CLI"
              description="Each bug is sent to GitHub Copilot CLI with its title, description, tags, state, and linked PR context. Copilot classifies it as a Progression or Regression and identifies the issue type." />
            <StepBox step={5} title="Root Cause Analysis generation"
              description="For regressions and high-severity bugs, Copilot CLI generates a structured RCA including probable root cause, contributing factors, and recommended actions." />
            <StepBox step={6} title="Export results"
              description="All classified bugs are compiled into an Excel report with a summary sheet, per-bug details, and RCA entries. The results dashboard shows classification breakdown, trends, and key metrics." />
          </div>
        </Section>

        {/* Classification */}
        <Section title="Bug Classification: Progression vs Regression" icon={<TrendingUp className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-600 mb-6">
            Every bug is classified into one of two categories. This is the core output of the analyzer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="border border-emerald-200 rounded-xl overflow-hidden">
              <div className="bg-emerald-50 p-4 border-b border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-900">Progression</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-gray-700">A bug that represents <strong>new functionality being built</strong> — it was introduced as part of deliberate development work in this sprint.</p>
                <p className="text-xs text-gray-500 mt-2">Signals: linked to a feature PR, first occurrence, tagged as new feature, created during active development of a new area.</p>
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-700"><strong>Interpretation:</strong> Expected during active development. High progression count = team is building a lot. Monitor but don't alarm.</p>
                </div>
              </div>
            </div>
            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-900">Regression</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-gray-700">A bug that represents <strong>previously working functionality breaking</strong> — something that used to work has stopped working due to a code change.</p>
                <p className="text-xs text-gray-500 mt-2">Signals: linked to a refactor/fix PR, re-opened bug, affects stable area, title contains "broke", "stopped working", "used to work".</p>
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700"><strong>Interpretation:</strong> Requires immediate attention. High regression count = quality risk. Triggers RCA generation automatically.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">
              <strong>How Copilot decides:</strong> The AI considers the bug title, description, linked PR context (feature vs fix), tags, state history, and the sprint date range.
              It uses a structured prompt that asks it to reason about whether the bug represents new work or broken existing work.
              Classification confidence improves when bugs have linked PRs and descriptive titles.
            </p>
          </div>
        </Section>

        {/* Issue Types */}
        <Section title="Issue Type Detection" icon={<Search className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            In addition to Progression/Regression, each bug is assigned an <strong>issue type</strong> that describes the nature of the defect.
            This helps teams identify patterns (e.g. "we keep having UI bugs" or "most regressions are in the API layer").
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { type: 'UI / Visual', desc: 'Layout, styling, rendering issues' },
              { type: 'Functional', desc: 'Feature not working as expected' },
              { type: 'Performance', desc: 'Slowness, timeouts, memory issues' },
              { type: 'Crash / Stability', desc: 'App crashes, ANRs, fatal errors' },
              { type: 'Data / Logic', desc: 'Wrong calculations, incorrect data' },
              { type: 'Integration', desc: 'API failures, third-party issues' },
              { type: 'Security', desc: 'Auth, permissions, data exposure' },
              { type: 'Configuration', desc: 'Environment, build, deployment' },
              { type: 'Unknown', desc: 'Insufficient context to classify' },
            ].map(({ type, desc }) => (
              <div key={type} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-800 mb-0.5">{type}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* RCA */}
        <Section title="Root Cause Analysis (RCA)" icon={<Brain className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            For regressions and high-severity bugs, the analyzer generates a structured RCA using GitHub Copilot CLI.
            The RCA is included in the Excel export and the results dashboard.
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">RCA Structure</p>
              <div className="space-y-2">
                {[
                  { field: 'Probable Root Cause', desc: 'The most likely technical reason the bug occurred, based on the bug description and linked PR context.' },
                  { field: 'Contributing Factors', desc: 'Secondary conditions that made the bug more likely — e.g. missing tests, complex code area, recent refactor.' },
                  { field: 'Impact Assessment', desc: 'Which users or features are affected, and the severity of the impact.' },
                  { field: 'Recommended Actions', desc: 'Specific steps to fix the bug and prevent recurrence — code changes, test additions, process improvements.' },
                ].map(({ field, desc }) => (
                  <div key={field} className="flex items-start gap-3">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-gray-800">{field}: </span>
                      <span className="text-xs text-gray-600">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-700">
                <strong>Quality of RCA depends on bug detail.</strong> Bugs with descriptive titles, linked PRs, and reproduction steps produce significantly better RCAs than bugs with titles like "App crash" or "Bug fix".
                Encourage engineers to write detailed bug descriptions for best results.
              </p>
            </div>
          </div>
        </Section>

        {/* Sprint Dates */}
        <Section title="Sprint Date Detection" icon={<Calendar className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            Sprint dates are used to scope the analysis — only bugs created or modified within the sprint window are considered "in-sprint" bugs.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Auto-detection</p>
                <p className="text-sm text-gray-600">
                  When no dates are provided, the tool fetches the iteration path from the first bug in the query and looks up the sprint start/end dates from ADO team settings.
                  Falls back to inspecting bug creation dates if iteration data is unavailable.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Manual override</p>
                <p className="text-sm text-gray-600">
                  You can always set sprint dates manually using the date pickers. This is useful when running analysis for a past sprint or when auto-detection fails.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* PR Linking */}
        <Section title="Pull Request Linking" icon={<GitPullRequest className="w-4 h-4 text-red-600" />}>
          <p className="text-sm text-gray-700 mb-4">
            Linked pull requests are the most valuable signal for accurate classification. The analyzer fetches PRs linked to each bug via ADO work item relations.
          </p>
          <div className="space-y-3 text-sm text-gray-700">
            <p>PR data used for classification includes:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 pl-2">
              <li>PR title and description — indicates whether it's a feature, fix, refactor, or hotfix</li>
              <li>Target branch — main/master PRs are higher risk than feature branches</li>
              <li>Commit messages — provide additional context about what changed</li>
              <li>PR size (files changed) — large PRs are higher regression risk</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
              <p className="text-xs text-amber-700">
                <strong>No linked PRs?</strong> Classification still works but relies solely on the bug title, description, and tags.
                Accuracy is lower. Encourage the team to link PRs to bugs in ADO for best results.
              </p>
            </div>
          </div>
        </Section>

        {/* Output */}
        <Section title="Output: Results Dashboard & Excel Export" icon={<FileText className="w-4 h-4 text-red-600" />}>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Results Dashboard</p>
              </div>
              <div className="p-4 space-y-2 text-sm text-gray-600">
                <p>The in-app results page shows:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Summary cards: total bugs, progressions, regressions, regression rate</li>
                  <li>Classification breakdown chart (pie/bar)</li>
                  <li>Issue type distribution</li>
                  <li>Per-bug table with classification, type, linked PRs, and RCA</li>
                  <li>Filterable and sortable bug list</li>
                </ul>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Excel Export</p>
              </div>
              <div className="p-4 space-y-2 text-sm text-gray-600">
                <p>The exported Excel file contains:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li><strong>Summary sheet:</strong> Sprint dates, total counts, regression rate, key metrics</li>
                  <li><strong>Bugs sheet:</strong> All bugs with ID, title, state, classification, issue type, linked PRs</li>
                  <li><strong>RCA sheet:</strong> Root cause analysis for regressions and high-severity bugs</li>
                  <li><strong>Trends sheet:</strong> Historical comparison if previous sprint data is available</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* Glossary */}
        <Section title="Glossary of Terms" icon={<BookOpen className="w-4 h-4 text-red-600" />}>
          <div className="space-y-4">
            <Term term="ADO Query URL"
              definition="The URL of an Azure DevOps work item query that returns bugs. Found in ADO by navigating to Boards → Queries, opening a query, and copying the URL from the browser address bar."
              example="https://dev.azure.com/org/project/_queries/query-edit/abc-123" />
            <Term term="PAT Token"
              definition="Personal Access Token — a credential that allows the analyzer to read work items, iterations, and repositories from Azure DevOps on your behalf. Requires Read access to Work Items and Code." />
            <Term term="Progression"
              definition="A bug introduced as part of new feature development. Expected during active development. Does not indicate a quality problem with existing functionality." />
            <Term term="Regression"
              definition="A bug where previously working functionality has broken. Indicates a quality risk. Triggers RCA generation and should be prioritised for investigation." />
            <Term term="Regression Rate"
              definition="The percentage of bugs in the sprint that are regressions. A high regression rate (>40%) is a warning sign of insufficient test coverage or risky code changes."
              example="3 regressions out of 10 total bugs → 30% regression rate" />
            <Term term="Issue Type"
              definition="A secondary classification describing the nature of the bug (UI, Functional, Performance, Crash, etc.). Used to identify patterns across sprints." />
            <Term term="RCA (Root Cause Analysis)"
              definition="A structured analysis of why a bug occurred, generated by GitHub Copilot CLI. Includes probable cause, contributing factors, impact, and recommended actions." />
            <Term term="Sprint Date Range"
              definition="The start and end dates of the sprint being analysed. Used to scope which bugs are considered 'in-sprint'. Can be auto-detected or set manually." />
            <Term term="Linked PR"
              definition="A pull request linked to a bug in Azure DevOps via work item relations. Provides context about what code change introduced or fixed the bug." />
            <Term term="Activity Log"
              definition="The real-time log shown during analysis. Displays each step as it happens — fetching bugs, detecting dates, classifying, generating RCA. Useful for debugging if analysis fails." />
          </div>
        </Section>

        {/* Limitations */}
        <Section title="Limitations & Best Practices" icon={<Shield className="w-4 h-4 text-red-600" />}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Known Limitations</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Classification accuracy depends on bug description quality — vague titles produce less reliable results</li>
                  <li>Copilot CLI has rate limits; very large queries (&gt;200 bugs) may be slow</li>
                  <li>RCA is AI-generated and should be reviewed by an engineer before sharing with stakeholders</li>
                  <li>Auto-detected sprint dates may be incorrect if bugs span multiple iterations</li>
                  <li>PR linking requires bugs to have explicit ADO work item relations — implicit links are not detected</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Best Practices</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Write descriptive bug titles: "Login button unresponsive after OAuth token refresh" beats "Login bug"</li>
                  <li>Always link PRs to bugs in ADO before running analysis</li>
                  <li>Use consistent tags (e.g. "regression", "new-feature") to improve classification accuracy</li>
                  <li>Run analysis at the end of each sprint for consistent historical tracking</li>
                  <li>Review and correct AI classifications in the results dashboard before exporting</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* Back */}
        <div className="flex justify-center pb-4">
          <button onClick={() => router.push('/bug-analyzer')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-medium hover:from-red-700 hover:to-rose-700 transition shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Bug Analyzer
          </button>
        </div>

      </main>
    </div>
  );
}
