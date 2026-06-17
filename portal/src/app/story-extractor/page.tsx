'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, RefreshCw, Zap, AlertCircle, BookMarked,
  Clock, Layers, ChevronRight, Sparkles, Database,
  RotateCcw, Copy, Check, BookOpen, Settings, FileSpreadsheet,
} from 'lucide-react';
import StoryModuleSelector from '@/components/StoryModuleSelector';
import StoryFileManifest from '@/components/StoryFileManifest';
import StoryCard from '@/components/StoryCard';
import { AppHeader } from '@/components/AppHeader';
import { StoryModuleRecord, StoryUserStory, StoryAnalysisStatus } from '@/types';
import { exportStoriesToExcel } from '@/lib/story-excel';

const STATUS_STEPS: Record<StoryAnalysisStatus, { label: string; step: number }> = {
  idle: { label: 'Ready', step: 0 },
  discovering: { label: 'Discovering files…', step: 1 },
  parsing: { label: 'Parsing source code…', step: 2 },
  analyzing: { label: 'Claude is analyzing…', step: 3 },
  complete: { label: 'Analysis complete', step: 4 },
  error: { label: 'Error occurred', step: 0 },
};

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="31.4" strokeDashoffset="10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[480px] text-center px-8">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
          <Layers size={32} className="text-gray-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-100 border border-red-200 flex items-center justify-center">
          <Sparkles size={11} className="text-red-500" />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Backlog Canvas</h2>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        Select a module from the left panel and click{' '}
        <span className="text-gray-700 font-medium">Analyze Module</span> to extract Agile user
        stories from the iOS source code.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-sm">
        {[
          { icon: <Database size={14} />, label: 'Local Cache', desc: 'Results persist between sessions' },
          { icon: <Cpu size={14} />, label: 'Claude Sonnet 4.5', desc: 'Powered by GitHub Copilot' },
          { icon: <BookMarked size={14} />, label: 'ADO Ready', desc: 'One-click copy to clipboard' },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
            <div className="flex justify-center mb-1.5 text-gray-400">{item.icon}</div>
            <div className="text-[11px] font-semibold text-gray-600 mb-0.5">{item.label}</div>
            <div className="text-[10px] text-gray-400 leading-tight">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CacheStatusBadge({ lastAnalyzedAt }: { lastAnalyzedAt: string }) {
  const date = new Date(lastAnalyzedAt);
  const formatted = date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <Database size={11} className="text-emerald-600" />
      <span className="text-[11px] text-emerald-700 font-medium">Loaded from Local Cache</span>
      <span className="text-[11px] text-emerald-400">·</span>
      <Clock size={10} className="text-emerald-500" />
      <span className="text-[11px] text-emerald-600">Last Synced {formatted}</span>
    </div>
  );
}

export default function StoryExtractorPage() {
  const [modules, setModules] = useState<string[]>([]);
  const [analyzedModules, setAnalyzedModules] = useState<Set<string>>(new Set());
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moduleFiles, setModuleFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<StoryAnalysisStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<StoryModuleRecord | null>(null);
  const [totalChars, setTotalChars] = useState<number>(0);
  const [isCached, setIsCached] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Read PAT + iOS path + GitHub PAT from localStorage (set in Settings)
  const getSettings = () => ({
    patToken: typeof window !== 'undefined' ? localStorage.getItem('ado_pat_token') || '' : '',
    iosPath: typeof window !== 'undefined' ? localStorage.getItem('story_ios_path') || 'MVA-iOS/VFUK-iOS/Modules' : 'MVA-iOS/VFUK-iOS/Modules',
    githubPat: typeof window !== 'undefined' ? localStorage.getItem('github_pat_token') || '' : '',
  });

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const { patToken, iosPath } = getSettings();
      try {
        const [discoverRes, recordsRes] = await Promise.all([
          fetch('/api/story-extractor/discover', {
            headers: { 'x-ios-path': iosPath, 'x-ado-pat': patToken },
          }),
          fetch('/api/story-extractor/record'),
        ]);
        const discoverData = await discoverRes.json();
        const recordsData = await recordsRes.json();

        if (discoverData.success) {
          setModules(discoverData.modules);
        } else {
          setModulesError(discoverData.error || 'Failed to discover modules');
        }
        if (recordsData.success) {
          setAnalyzedModules(new Set(recordsData.moduleNames));
        }
      } catch {
        setModulesError('Failed to connect to server');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const handleModuleSelect = useCallback(async (mod: string) => {
    if (!mod) {
      setSelectedModule(null);
      setModuleFiles([]);
      setRecord(null);
      setIsCached(false);
      setError(null);
      setStatus('idle');
      return;
    }

    setSelectedModule(mod);
    setRecord(null);
    setIsCached(false);
    setError(null);
    setStatus('discovering');
    setStatusMessage('Loading file manifest…');

    const { patToken, iosPath } = getSettings();
    const filesRes = await fetch(`/api/story-extractor/files?module=${encodeURIComponent(mod)}`, {
      headers: { 'x-ios-path': iosPath, 'x-ado-pat': patToken },
    });
    const filesData = await filesRes.json();
    if (filesData.success) setModuleFiles(filesData.files);
    else setModuleFiles([]);

    const cacheRes = await fetch(`/api/story-extractor/record?module=${encodeURIComponent(mod)}`);
    const cacheData = await cacheRes.json();
    if (cacheData.success && cacheData.record) {
      setRecord(cacheData.record);
      setIsCached(true);
      setStatus('complete');
      setStatusMessage('Loaded from cache');
    } else {
      setStatus('idle');
      setStatusMessage('');
    }
  }, []);

  const runAnalysis = useCallback(async (forceReanalyze = false) => {
    if (!selectedModule) return;

    setError(null);
    setIsCached(false);

    if (!forceReanalyze) {
      setStatus('discovering');
      setStatusMessage('Checking local cache…');
      const cacheRes = await fetch(`/api/story-extractor/record?module=${encodeURIComponent(selectedModule)}`);
      const cacheData = await cacheRes.json();
      if (cacheData.success && cacheData.record) {
        setRecord(cacheData.record);
        setIsCached(true);
        setStatus('complete');
        setStatusMessage('Loaded from cache');
        return;
      }
    }

    const { patToken, iosPath, githubPat } = getSettings();

    setStatus('parsing');
    setStatusMessage(`Parsing ${selectedModule} source files…`);
    const parseRes = await fetch('/api/story-extractor/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(patToken ? { 'x-ado-pat': patToken } : {}),
      },
      body: JSON.stringify({ moduleName: selectedModule, iosPath }),
    });
    const parseData = await parseRes.json();

    if (!parseData.success || !parseData.data) {
      setError(parseData.error || 'Failed to parse module code');
      setStatus('error');
      return;
    }

    setModuleFiles(parseData.data.files);
    setTotalChars(parseData.data.totalChars);

    const batches: string[] = parseData.data.batches ?? [parseData.data.codeContent];
    const totalBatches: number = batches.length;

    setStatus('analyzing');

    // ── Batch loop ────────────────────────────────────────────────────────────
    let accumulatedStories: StoryUserStory[] = [];
    let accumulatedEpicName = '';

    for (let i = 0; i < totalBatches; i++) {
      setStatusMessage(
        totalBatches > 1
          ? `Analyzing batch ${i + 1} of ${totalBatches} with Claude Sonnet…`
          : `Sending ${parseData.data.totalFiles} files to Claude Sonnet…`
      );

      const analyzeRes = await fetch('/api/story-extractor/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify({
          moduleName: selectedModule,
          codeContent: batches[i],
          batchIndex: i,
          totalBatches,
          existingStories: accumulatedStories,
          existingEpicName: accumulatedEpicName,
        }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeData.success) {
        setError(analyzeData.error || `Analysis failed on batch ${i + 1}`);
        setStatus('error');
        return;
      }

      accumulatedStories = analyzeData.mergedStories ?? accumulatedStories;
      accumulatedEpicName = analyzeData.epicName || accumulatedEpicName;

      // On the final batch the server persists and returns the full record
      if (analyzeData.isFinalBatch && analyzeData.record) {
        setRecord(analyzeData.record);
        setIsCached(false);
        setStatus('complete');
        setStatusMessage(
          totalBatches > 1
            ? `Analysis complete — ${accumulatedStories.length} stories from ${totalBatches} batches`
            : 'Analysis complete'
        );
        setAnalyzedModules((prev) => new Set(Array.from(prev).concat(selectedModule)));
        return;
      }
    }
    // ── End batch loop ────────────────────────────────────────────────────────

    // Fallback (should not normally reach here)
    setStatus('complete');
    setStatusMessage('Analysis complete');
  }, [selectedModule]);

  const handleStoryUpdate = useCallback(async (updated: StoryUserStory) => {
    if (!record || !selectedModule) return;
    const updatedStories = record.userStories.map((s) => (s.id === updated.id ? updated : s));
    const updatedRecord: StoryModuleRecord = { ...record, userStories: updatedStories };
    setRecord(updatedRecord);
    await fetch('/api/story-extractor/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleName: selectedModule, data: { lastAnalyzedAt: record.lastAnalyzedAt, epicName: record.epicName, userStories: updatedStories } }),
    });
  }, [record, selectedModule]);

  function handleCopyAll() {
    if (!record) return;
    const text = record.userStories
      .map((s, i) =>
        `USER STORY ${String(i + 1).padStart(2, '0')}\n` +
        `──────────────────────────────────────────\n` +
        `Title: ${s.title}\n\nDescription:\n${s.description}\n\nAcceptance Criteria:\n` +
        s.acceptanceCriteria.map((c, j) => `  ${j + 1}. ${c}`).join('\n') +
        `\n──────────────────────────────────────────`
      ).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    });
  }

  const isBusy = status === 'discovering' || status === 'parsing' || status === 'analyzing' || isLoading;

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 flex flex-col">
      <AppHeader
        title="Story Extractor"
        subtitle="Claude Sonnet 4.5 · GitHub Copilot API"
        icon={<Zap className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-red-600 to-rose-700"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = '/settings'}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={() => window.location.href = '/story-extractor/about'}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Methodology</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        {/* LEFT PANEL */}
        <aside className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-white overflow-y-auto shadow-sm">
          <div className="px-4 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Scope &amp; Files
              </span>
            </div>
          </div>

          <div className="px-4 space-y-4 py-4">
            {/* Module Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                Target Module
              </label>
              {modulesError ? (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-red-600 leading-relaxed font-medium">{modulesError}</p>
                    <button
                      onClick={() => window.location.href = '/settings'}
                      className="text-[11px] text-red-500 underline mt-1 hover:text-red-700"
                    >
                      Configure iOS path in Settings →
                    </button>
                  </div>
                </div>
              ) : (
                <StoryModuleSelector
                  modules={modules}
                  selectedModule={selectedModule}
                  onSelect={handleModuleSelect}
                  disabled={isBusy}
                  analyzedModules={analyzedModules}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => runAnalysis(false)}
                disabled={!selectedModule || isBusy}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2.5
                  rounded-xl text-sm font-semibold transition-all duration-200
                  ${!selectedModule || isBusy
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    : 'bg-[#e60000] hover:bg-[#c30000] text-white shadow-sm border border-red-600/20 active:scale-[0.98]'}
                `}
              >
                {isBusy && status !== 'idle' ? (
                  <><Spinner size={14} /><span>{STATUS_STEPS[status]?.label || 'Processing…'}</span></>
                ) : (
                  <><Cpu size={14} /><span>Analyze Module</span></>
                )}
              </button>

              <button
                onClick={() => runAnalysis(true)}
                disabled={!selectedModule || isBusy}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2.5
                  rounded-xl text-sm font-medium transition-all duration-200 border
                  ${!selectedModule || isBusy
                    ? 'bg-transparent text-gray-300 cursor-not-allowed border-gray-200'
                    : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-300 hover:border-gray-400 active:scale-[0.98]'}
                `}
              >
                <RotateCcw size={13} />
                <span>Force Re-Analyze</span>
              </button>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className={`
                flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] border
                ${status === 'error'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : status === 'complete'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-blue-50 border-blue-200 text-blue-600'}
              `}>
                {isBusy ? <Spinner size={11} />
                  : status === 'error' ? <AlertCircle size={11} />
                  : status === 'complete' ? <Check size={11} />
                  : null}
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Error Detail */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-red-500" />
                  <span className="text-[11px] font-semibold text-red-600">Analysis Error</span>
                </div>
                <p className="text-[10px] text-red-500 leading-relaxed font-mono break-all">{error}</p>
              </div>
            )}

            {/* File Manifest */}
            {moduleFiles.length > 0 && (
              <div className="pt-1">
                <StoryFileManifest files={moduleFiles} totalChars={totalChars || undefined} />
              </div>
            )}

            {/* Module Stats */}
            {record && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Module Stats
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                    <div className="text-lg font-bold text-gray-800 font-mono">{record.userStories.length}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Stories</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                    <div className="text-lg font-bold text-gray-800 font-mono">
                      {record.userStories.reduce((acc, s) => acc + s.acceptanceCriteria.length, 0)}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Criteria</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#fafafa]">
          {!selectedModule ? (
            <EmptyState />
          ) : !record && !isBusy ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[480px] text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                <BookMarked size={24} className="text-gray-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-700 mb-2">{selectedModule}</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                No analysis found for this module. Click{' '}
                <span className="text-gray-700 font-medium">Analyze Module</span> to extract user stories.
              </p>
              <button
                onClick={() => runAnalysis(false)}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-[#e60000] hover:bg-[#c30000] text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-[0.98]"
              >
                <Cpu size={14} /> Analyze Module
              </button>
            </div>
          ) : isBusy ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[480px] gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                  <Cpu size={24} className="text-[#e60000]" />
                </div>
                <div className="absolute inset-0 rounded-2xl border-2 border-red-400/40 animate-ping" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-gray-700">{STATUS_STEPS[status]?.label || 'Processing…'}</p>
                <p className="text-xs text-gray-500">{statusMessage}</p>
              </div>
              <div className="flex items-center gap-2">
                {(['discovering', 'parsing', 'analyzing'] as StoryAnalysisStatus[]).map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-all duration-300
                      ${STATUS_STEPS[status]?.step > i ? 'bg-[#e60000]'
                        : STATUS_STEPS[status]?.step === i + 1 ? 'bg-red-400 animate-pulse'
                        : 'bg-gray-300'}`}
                    />
                    {i < 2 && <div className={`w-8 h-px ${STATUS_STEPS[status]?.step > i + 1 ? 'bg-red-400' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>
            </div>
          ) : record ? (
            <div className="p-6 space-y-5 max-w-4xl mx-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  {isCached && record.lastAnalyzedAt && (
                    <CacheStatusBadge lastAnalyzedAt={record.lastAnalyzedAt} />
                  )}
                  <div className="flex items-center gap-2">
                    <ChevronRight size={16} className="text-[#e60000]" />
                    <h1 className="text-xl font-bold text-gray-900">{record.epicName}</h1>
                  </div>
                  <div className="flex items-center gap-3 pl-6">
                    <span className="text-xs text-gray-500">
                      <span className="text-gray-700 font-medium">{record.moduleName}</span> module
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      <span className="text-gray-700 font-medium">{record.userStories.length}</span> user stories
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      <span className="text-gray-700 font-medium">
                        {record.userStories.reduce((acc, s) => acc + s.acceptanceCriteria.length, 0)}
                      </span>{' '}acceptance criteria
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyAll}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 border
                      ${allCopied
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 shadow-sm'}`}
                  >
                    {allCopied ? <><Check size={12} />All Copied!</> : <><Copy size={12} />Copy All Stories</>}
                  </button>
                  <button
                    onClick={() => exportStoriesToExcel(record.userStories, record.moduleName, record.epicName)}
                    title="Export all stories to Excel"
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 border bg-white border-gray-300 text-gray-600 hover:text-green-700 hover:border-green-400 shadow-sm"
                  >
                    <FileSpreadsheet size={12} />Export to Excel
                  </button>
                </div>
              </div>

              <div className="h-px bg-gray-200" />

              <div className="space-y-3">
                {record.userStories.map((story, idx) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    index={idx}
                    onUpdate={handleStoryUpdate}
                    moduleName={record.moduleName}
                    epicName={record.epicName}
                  />
                ))}
              </div>

              <div className="pt-4 pb-2 flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-mono">Generated by Claude Sonnet 4.5 via GitHub Copilot</span>
                {record.lastAnalyzedAt && (
                  <span className="flex items-center gap-1">
                    <RefreshCw size={9} />
                    {new Date(record.lastAnalyzedAt).toLocaleString('en-GB')}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
