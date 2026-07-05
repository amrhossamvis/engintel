'use client';

import { AppHeader } from '@/components/AppHeader';
import { Zap, Cpu, Database, BookMarked, Code2, Layers, GitBranch, CheckSquare, SplitSquareHorizontal } from 'lucide-react';

export default function StoryExtractorAboutPage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AppHeader
        title="Story Extractor — Methodology"
        subtitle="How AI reverse-engineers iOS source code into Agile user stories"
        icon={<Zap className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-red-600 to-rose-700"
      />

      <main className="container mx-auto px-6 py-12 max-w-4xl space-y-8">

        {/* Overview */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Layers size={18} className="text-[#e60000]" /> Overview
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Story Extractor is an AI-powered tool that reads iOS Swift and Objective-C source code
            and automatically reverse-engineers it into structured Agile user stories with acceptance
            criteria in Given/When/Then format. It uses <strong className="text-gray-900">Claude Sonnet 4.5</strong> via
            the <strong className="text-gray-900">GitHub Copilot API</strong> — no separate API keys required,
            just a valid <code className="text-[#e60000] text-xs bg-red-50 px-1.5 py-0.5 rounded border border-red-100">gh auth login</code> session.
            Source files are fetched directly from the <strong className="text-gray-900">Azure DevOps Git API</strong> using
            your configured PAT token and iOS source path. Large modules that exceed the 400K-character
            context limit are automatically split into batches and analyzed in sequence — ensuring{' '}
            <strong className="text-gray-900">no code is ever dropped</strong>, regardless of module size.
          </p>
        </section>

        {/* How it works */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <GitBranch size={18} className="text-[#e60000]" /> How It Works
          </h2>
          <div className="space-y-6">
            {[
              {
                step: '01',
                icon: <Layers size={16} className="text-blue-500" />,
                title: 'Module Discovery',
                desc: 'The tool calls the Azure DevOps Git Items API to list all directories at the configured iOS source path (e.g. MVA-iOS/VFUK-iOS/Modules). Each top-level directory is treated as a feature module.',
              },
              {
                step: '02',
                icon: <Code2 size={16} className="text-amber-500" />,
                title: 'Source Code Parsing & Batching',
                desc: 'All .swift, .m, and .h files within the selected module are fetched from ADO via the Git API and concatenated into file blocks. If the total content exceeds 400,000 characters, it is automatically split into multiple batches — each ≤ 400K chars — so that no code is ever dropped, regardless of module size.',
              },
              {
                step: '03',
                icon: <Cpu size={16} className="text-[#e60000]" />,
                title: 'AI Analysis via GitHub Copilot',
                desc: 'Each batch is sent sequentially to Claude Sonnet 4.5 through the GitHub Copilot chat completions endpoint. For multi-batch modules, the system prompt includes a batch-context note so the model knows it is analyzing a slice of a larger module. Results from all batches are merged and deduplicated by story title before being saved.',
              },
              {
                step: '04',
                icon: <CheckSquare size={16} className="text-emerald-500" />,
                title: 'Structured Output',
                desc: 'The model returns a raw JSON object containing an epicName and an array of userStories, each with a title, description in "As a... I want... So that..." format, and at least 3 acceptance criteria in Given/When/Then format.',
              },
              {
                step: '05',
                icon: <Database size={16} className="text-purple-500" />,
                title: 'Local Persistence',
                desc: 'Results are saved to a local JSON file (data/story-persistence.json) inside the portal. Subsequent visits to the same module load from cache instantly. You can force a re-analysis at any time.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                   <span className="text-xs font-bold text-gray-500 font-mono">{item.step}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.icon}
                    <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                  </div>
                   <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Large Module Batching */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <SplitSquareHorizontal size={18} className="text-[#e60000]" /> Large Module Batching
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Some feature modules contain hundreds of source files that far exceed a single model context window.
            The batching system ensures every line of code is analyzed — nothing is silently truncated.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: 'Batch Size',
                value: '400K chars',
                desc: 'Maximum characters per Copilot request',
                color: 'text-amber-600',
                bg: 'bg-amber-50 border-amber-200',
              },
              {
                label: 'Splitting Strategy',
                value: 'File-boundary',
                desc: 'Batches split on whole file blocks, never mid-file',
                color: 'text-blue-600',
                bg: 'bg-blue-50 border-blue-200',
              },
              {
                label: 'Deduplication',
                value: 'By title',
                desc: 'Stories with identical titles across batches are merged',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50 border-emerald-200',
              },
            ].map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
                <div className={`text-base font-bold font-mono mb-1 ${card.color}`}>{card.value}</div>
                <div className="text-xs font-semibold text-gray-700 mb-1">{card.label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{card.desc}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[
              {
                title: 'Automatic detection',
                desc: 'If a module\'s total source content fits within 400K characters it is sent as a single request — identical to the previous behaviour. Batching only activates when needed.',
              },
              {
                title: 'Sequential processing with carry-forward',
                desc: 'Batches are processed one at a time. After each batch, the accumulated stories and epicName are passed to the next request so the model has full context of what has already been extracted.',
              },
              {
                title: 'Batch-aware system prompt',
                desc: 'When batching is active, the system prompt includes a note: "This is batch N of M. Analyze ONLY the code in this batch." This prevents the model from hallucinating references to code it hasn\'t seen.',
              },
              {
                title: 'Single save on completion',
                desc: 'The merged result is only persisted to the local cache after the final batch completes, ensuring the stored record is always the full, deduplicated set of stories.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#e60000] shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-gray-800">{item.title} — </span>
                  <span className="text-xs text-gray-500">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Prompt Design */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Cpu size={18} className="text-[#e60000]" /> AI Prompt Design
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            The system prompt instructs Claude to act as an expert Agile Product Owner with the following constraints:
          </p>
          <ul className="space-y-2 text-sm text-gray-500">
            {[
              'Output ONLY raw JSON — no markdown fences, no preamble, no explanation.',
              'Every user story must have at minimum 3 acceptance criteria in Given/When/Then format.',
              'The epicName must be a concise, business-facing domain label.',
              'Extract as many distinct user stories as the code supports — do not merge unrelated behaviors.',
              'If a story involves an API call, mention the endpoint or operation in the acceptance criteria.',
              'Completely ignore technical boilerplate, memory layouts, syntax constraints, or variable declarations.',
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#e60000] shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {/* ADO Integration */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookMarked size={18} className="text-[#e60000]" /> ADO Integration
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Each story card has a <strong className="text-gray-900">Copy for ADO</strong> button that formats the story
            in a plain-text format ready to paste into Azure DevOps work items. The{' '}
            <strong className="text-gray-900">Copy All Stories</strong> button at the top of the canvas copies all
            stories in sequence. Stories can also be edited inline — changes are persisted to the local cache immediately.
          </p>
        </section>

        {/* Prerequisites */}
        <section className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckSquare size={18} className="text-[#e60000]" /> Prerequisites
          </h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              { label: 'GitHub CLI authenticated', cmd: 'gh auth login' },
              { label: 'GitHub Copilot subscription active', cmd: 'gh copilot --version' },
              { label: 'ADO PAT token configured in Settings', cmd: 'Settings → PAT Token' },
              { label: 'iOS source path configured in Settings', cmd: 'Settings → iOS Source Path' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{item.label}</span>
                <code className="ml-auto text-xs text-[#e60000] bg-red-50 border border-red-100 px-2 py-0.5 rounded font-mono">
                  {item.cmd}
                </code>
              </li>
            ))}
          </ul>
        </section>

      </main>
    </div>
  );
}
