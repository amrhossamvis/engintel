'use client';

import { AppHeader } from '@/components/AppHeader';
import { Zap, Cpu, Database, BookMarked, Code2, Layers, GitBranch, CheckSquare } from 'lucide-react';

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
            your configured PAT token and iOS source path.
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
                title: 'Source Code Parsing',
                desc: 'All .swift, .m, and .h files within the selected module are fetched from ADO via the Git API and concatenated into a single context payload. Content is capped at 400,000 characters to stay within the model\'s context window.',
              },
              {
                step: '03',
                icon: <Cpu size={16} className="text-[#e60000]" />,
                title: 'AI Analysis via GitHub Copilot',
                desc: 'The source code is sent to Claude Sonnet 4.5 through the GitHub Copilot chat completions endpoint. The model is instructed to act as an expert Agile Product Owner and extract user-facing behaviors — ignoring boilerplate, memory management, and syntax details.',
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
                  <span className="text-[10px] font-bold text-gray-500 font-mono">{item.step}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.icon}
                    <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
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
          <ul className="space-y-2 text-xs text-gray-500">
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
                <code className="ml-auto text-[11px] text-[#e60000] bg-red-50 border border-red-100 px-2 py-0.5 rounded font-mono">
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
