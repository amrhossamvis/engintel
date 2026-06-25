'use client';

import { useState, useEffect, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import {
  FlaskConical, Play, Copy, Check,
  Terminal, BookOpen, Bug, GitPullRequest, BarChart2,
  TestTube2, Wand2, RotateCcw, Clock, Info,
  ChevronRight, AlertCircle,
} from 'lucide-react';

type Variable = {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'code';
};

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  prompt: string;
  variables: Variable[];
  isOfficial: boolean;
  usageCount: number;
};

type RunResult = {
  response: string;
  latencyMs: number;
  promptLength: number;
  error?: string;
};

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'Bug Analysis':     { icon: <Bug className="w-4 h-4" />,          color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  'Story Generation': { icon: <BookOpen className="w-4 h-4" />,      color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200' },
  'Code Review':      { icon: <GitPullRequest className="w-4 h-4" />, color: 'text-cyan-600',    bg: 'bg-cyan-50 border-cyan-200' },
  'Delivery':         { icon: <BarChart2 className="w-4 h-4" />,      color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  'Test Generation':  { icon: <TestTube2 className="w-4 h-4" />,      color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  'Copilot CLI':      { icon: <Terminal className="w-4 h-4" />,       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  'Custom':           { icon: <Wand2 className="w-4 h-4" />,          color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200' },
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function MarkdownOutput({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="text-sm text-gray-800 leading-relaxed space-y-1 font-mono whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        if (line.startsWith('# '))  return <h2 key={i} className="text-base font-bold text-gray-900 mt-3 not-italic">{line.slice(2)}</h2>;
        if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-gray-800 mt-2 not-italic">{line.slice(3)}</h3>;
        if (line.startsWith('- **') || line.startsWith('- ')) return <p key={i} className="pl-3 text-gray-700">{line}</p>;
        if (line.startsWith('```')) return <div key={i} className="text-xs text-gray-400">{line}</div>;
        return <p key={i} className={line === '' ? 'h-2' : ''}>{line}</p>;
      })}
    </div>
  );
}

export default function PlaygroundPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/playground')
      .then(r => r.json())
      .then(d => {
        setTemplates(d.templates ?? []);
        if (d.templates?.length) selectTemplate(d.templates[0]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(t: Template) {
    setSelectedTemplate(t);
    setCustomPrompt(t.prompt);
    setVariables({});
    setResult(null);
  }

  function buildFilledPrompt() {
    return fillTemplate(customPrompt, variables);
  }

  async function runPrompt() {
    const filled = buildFilledPrompt();
    if (!filled.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          prompt: customPrompt,
          variables,
        }),
      });
      const data = await res.json();
      setResult(data);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } finally {
      setRunning(false);
    }
  }

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category)))];
  const filteredTemplates = activeCategory === 'All'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const isCopilotMode = selectedTemplate?.category === 'Copilot CLI';

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AppHeader
        title="AI Playground"
        subtitle="Explore GitHub Copilot capabilities — experiment with prompts, learn, and prototype"
        icon={<FlaskConical className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500"
      />

      <main className="container mx-auto px-6 py-8">

        {/* Copilot CLI badge */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 mb-6">
          <Terminal className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            <span className="font-semibold">Powered by GitHub Copilot CLI.</span> All prompts run through the same Copilot engine used across the hub. Results appear in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[280px_1fr_1fr] gap-6">

          {/* ── LEFT: Template Library ── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Template Library</h2>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        activeCategory === cat
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {meta
                        ? <span className="flex items-center gap-1">{meta.icon}{cat}</span>
                        : cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {filteredTemplates.map(t => {
                const meta = CATEGORY_META[t.category];
                const isSelected = selectedTemplate?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-amber-50 border-l-2 border-amber-500' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta?.bg ?? 'bg-gray-50 border-gray-200'}`}>
                        <span className={meta?.color ?? 'text-gray-500'}>{meta?.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-snug ${isSelected ? 'text-amber-700' : 'text-gray-800'}`}>{t.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{t.description}</p>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MIDDLE: Prompt Editor ── */}
          <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{selectedTemplate?.name ?? 'Prompt Editor'}</h2>
                {isCopilotMode && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <Terminal className="w-3 h-3" /> Copilot CLI Mode
                  </span>
                )}
              </div>
              <button
                onClick={() => selectedTemplate && selectTemplate(selectedTemplate)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                title="Reset to template defaults"
              >
                <RotateCcw className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Variables */}
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fill in Variables</label>
                  <div className="space-y-3">
                    {selectedTemplate.variables.map(v => (
                      <div key={v.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{v.label}</label>
                        {v.type === 'text' ? (
                          <input
                            value={variables[v.key] ?? ''}
                            onChange={e => setVariables(prev => ({ ...prev, [v.key]: e.target.value }))}
                            placeholder={v.placeholder}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        ) : (
                          <textarea
                            value={variables[v.key] ?? ''}
                            onChange={e => setVariables(prev => ({ ...prev, [v.key]: e.target.value }))}
                            placeholder={v.placeholder}
                            rows={v.type === 'code' ? 6 : 3}
                            className={`w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none ${v.type === 'code' ? 'font-mono text-xs bg-gray-50' : ''}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt preview / editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Prompt (editable)</label>
                  <span className="text-xs text-gray-400">{buildFilledPrompt().length} chars</span>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50"
                />
                {Object.keys(variables).length > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Filled prompt preview:</p>
                    <p className="text-xs font-mono text-amber-600 whitespace-pre-wrap line-clamp-4">{buildFilledPrompt()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Run button */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={runPrompt}
                disabled={running || !buildFilledPrompt().trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-200"
              >
                {running ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run with Copilot
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Output ── */}
          <div ref={outputRef} className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Output</h2>
              {result?.response && <CopyButton text={result.response} />}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {!result && !running && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                    <FlaskConical className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-gray-400 font-medium">Ready to run</p>
                  <p className="text-sm text-gray-300 mt-1">Select a template, fill in variables, and hit Run</p>
                </div>
              )}

              {running && (
                <div className="h-full flex flex-col items-center justify-center py-16">
                  <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Copilot is thinking…</p>
                </div>
              )}

              {result && !running && (
                <div className="space-y-4">
                  {/* Error state */}
                  {result.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 mb-1">Copilot CLI Error</p>
                        <p className="text-xs text-red-600 font-mono">{result.error}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Stats bar */}
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                          <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs text-emerald-700 font-medium">GitHub Copilot CLI</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs text-gray-600">{result.latencyMs}ms</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                          <Info className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-600">{result.promptLength} chars sent</span>
                        </div>
                      </div>

                      {/* Response */}
                      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <MarkdownOutput text={result.response} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Copilot CLI explainer for CLI mode */}
        {isCopilotMode && (
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-800">GitHub Copilot CLI Mode</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                Suggestions only — no execution
              </span>
            </div>
            <p className="text-sm text-emerald-700 leading-relaxed">
              These templates simulate <code className="bg-emerald-100 px-1 rounded text-xs">gh copilot suggest</code> and{' '}
              <code className="bg-emerald-100 px-1 rounded text-xs">gh copilot explain</code> behaviour.
              Copy the suggested command and run it in your own terminal after reviewing it carefully.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
