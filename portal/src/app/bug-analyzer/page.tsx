'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BugAnalysisRequest } from '@/types';
import {
  Bug,
  Calendar,
  Key,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  BookOpen,
  List,
  PenLine,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

interface ADOSubQuery {
  id: string;
  name: string;
  queryUrl: string;
}

interface ADORelease {
  id: string;
  name: string;
  path: string;
}

type QueryInputMode = 'list' | 'custom';

// Keyword used to auto-select the default query within a release folder
const DEFAULT_QUERY_KEYWORD = 'regression bugs all';

export default function BugAnalyzerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<BugAnalysisRequest>({
    queryUrl: '',
    sprintStart: '',
    sprintEnd: '',
    patToken: '',
    useCopilot: true,
  });
  const [loading, setLoading] = useState(false);
  const [detectingDates, setDetectingDates] = useState(false);
  const [error, setError] = useState('');
  const [dateDetectionMessage, setDateDetectionMessage] = useState('');
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<{ id: string; offset: number; timer: number | null }>({
    id: '',
    offset: 0,
    timer: null,
  });

  // Query picker state
  const [queryInputMode, setQueryInputMode] = useState<QueryInputMode>('list');

  // Level 1: release folders
  const [releases, setReleases] = useState<ADORelease[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [releasesError, setReleasesError] = useState('');
  const [releasesLoaded, setReleasesLoaded] = useState(false);

  // Level 2: sub-queries for the selected release (with session cache)
  const subQueryCache = useRef<Map<string, ADOSubQuery[]>>(new Map());
  const [subQueries, setSubQueries] = useState<ADOSubQuery[]>([]);
  const [loadingSubQueries, setLoadingSubQueries] = useState(false);
  const [subQueriesError, setSubQueriesError] = useState('');

  // Selections
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [selectedSubQueryId, setSelectedSubQueryId] = useState('');

  const appendLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLogs((prev) => [...prev, `${timestamp} - ${message}`]);
  };

  const startProgressPolling = (requestId: string) => {
    if (progressRef.current.timer) window.clearInterval(progressRef.current.timer);
    progressRef.current = { id: requestId, offset: 0, timer: null };

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/progress?requestId=${encodeURIComponent(requestId)}&offset=${progressRef.current.offset}`
        );
        if (!response.ok) return;
        const data = await response.json();
        const newLogs: string[] = Array.isArray(data.logs) ? data.logs : [];
        newLogs.forEach((entry) => appendLog(entry));
        progressRef.current.offset =
          typeof data.nextOffset === 'number'
            ? data.nextOffset
            : progressRef.current.offset + newLogs.length;
        if (data.done) {
          if (progressRef.current.timer) {
            window.clearInterval(progressRef.current.timer);
            progressRef.current.timer = null;
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    poll();
    progressRef.current.timer = window.setInterval(poll, 1200);
  };

  // Load PAT from localStorage on mount, then auto-fetch releases
  useEffect(() => {
    const savedPatToken = localStorage.getItem('ado_pat_token') || '';
    setFormData((prev) => ({ ...prev, patToken: savedPatToken, useCopilot: true }));
  }, []);

  useEffect(() => {
    if (formData.patToken && queryInputMode === 'list' && !releasesLoaded && !loadingReleases) {
      loadReleases(formData.patToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.patToken]);

  const getGithubPat = () =>
    typeof window !== 'undefined' ? localStorage.getItem('github_pat_token') || '' : '';

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activityLogs]);

  // ── Level 1: load release folders (GET, depth=1, fast) ──────────────────────
  const loadReleases = async (pat?: string) => {
    const token = pat || formData.patToken;
    if (!token) {
      setReleasesError('Please configure your Azure DevOps PAT token in Settings first.');
      return;
    }
    setLoadingReleases(true);
    setReleasesError('');
    try {
      const response = await fetch('/api/ado-queries', {
        method: 'GET',
        headers: { 'x-ado-pat': token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load releases');
      const loaded: ADORelease[] = data.releases || [];
      setReleases(loaded);
      setReleasesLoaded(true);
      if (loaded.length === 0) setReleasesError('No MVA release folders found.');
    } catch (err: any) {
      setReleasesError(err.message || 'Failed to load releases from Azure DevOps.');
    } finally {
      setLoadingReleases(false);
    }
  };

  // ── Level 2: load sub-queries for a release (POST, depth=1, cached) ─────────
  const loadSubQueries = async (releaseId: string) => {
    // Return from cache if available
    if (subQueryCache.current.has(releaseId)) {
      const cached = subQueryCache.current.get(releaseId)!;
      setSubQueries(cached);
      autoSelectDefault(cached);
      return;
    }

    setLoadingSubQueries(true);
    setSubQueriesError('');
    setSubQueries([]);

    try {
      const response = await fetch('/api/ado-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patToken: formData.patToken, releaseId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load queries');

      const loaded: ADOSubQuery[] = data.queries || [];
      subQueryCache.current.set(releaseId, loaded); // cache for this session
      setSubQueries(loaded);
      autoSelectDefault(loaded);
    } catch (err: any) {
      setSubQueriesError(err.message || 'Failed to load queries for this release.');
    } finally {
      setLoadingSubQueries(false);
    }
  };

  const autoSelectDefault = (queries: ADOSubQuery[]) => {
    if (queries.length === 0) return;
    const defaultQ =
      queries.find((q) => q.name.toLowerCase().includes(DEFAULT_QUERY_KEYWORD)) || queries[0];
    setSelectedSubQueryId(defaultQ.id);
    setFormData((prev) => ({ ...prev, queryUrl: defaultQ.queryUrl }));
  };

  // ── Mode switch ──────────────────────────────────────────────────────────────
  const handleModeSwitch = (mode: QueryInputMode) => {
    setQueryInputMode(mode);
    setError('');
    setFormData((prev) => ({ ...prev, queryUrl: '' }));
    setSelectedReleaseId('');
    setSelectedSubQueryId('');
    setSubQueries([]);

    if (mode === 'list' && !releasesLoaded && formData.patToken) {
      loadReleases();
    }
  };

  // ── Release selected ─────────────────────────────────────────────────────────
  const handleReleaseSelect = (releaseId: string) => {
    setSelectedReleaseId(releaseId);
    setSelectedSubQueryId('');
    setSubQueries([]);
    setFormData((prev) => ({ ...prev, queryUrl: '' }));
    if (releaseId) loadSubQueries(releaseId);
  };

  // ── Sub-query selected ───────────────────────────────────────────────────────
  const handleSubQuerySelect = (subQueryId: string) => {
    setSelectedSubQueryId(subQueryId);
    const subQuery = subQueries.find((q) => q.id === subQueryId);
    if (subQuery) setFormData((prev) => ({ ...prev, queryUrl: subQuery.queryUrl }));
  };

  // ── Form submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setActivityLogs([]);
    appendLog('Starting analysis');

    const requestId = crypto.randomUUID();
    startProgressPolling(requestId);

    if (!formData.patToken) {
      setError('Please configure your Azure DevOps PAT token in Settings');
      appendLog('Missing PAT token; analysis stopped');
      setLoading(false);
      return;
    }

    if (!formData.queryUrl) {
      setError(
        queryInputMode === 'list'
          ? 'Please select a release and query from the list'
          : 'Please enter a Query URL'
      );
      appendLog('Missing query URL; analysis stopped');
      setLoading(false);
      return;
    }

    let resolvedSprintStart = formData.sprintStart;
    let resolvedSprintEnd = formData.sprintEnd;

    if (!resolvedSprintStart || !resolvedSprintEnd) {
      setDetectingDates(true);
      setDateDetectionMessage('');
      appendLog('Detecting sprint dates');
      try {
        const detectResponse = await fetch('/api/detect-dates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryUrl: formData.queryUrl, patToken: formData.patToken }),
        });
        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          if (detectData.sprintStart && detectData.sprintEnd) {
            resolvedSprintStart = detectData.sprintStart;
            resolvedSprintEnd = detectData.sprintEnd;
            setFormData((prev) => ({
              ...prev,
              sprintStart: detectData.sprintStart,
              sprintEnd: detectData.sprintEnd,
            }));
            setDateDetectionMessage(
              `✓ Detected sprint dates: ${detectData.sprintStart} to ${detectData.sprintEnd}`
            );
            appendLog(`Sprint dates detected: ${detectData.sprintStart} to ${detectData.sprintEnd}`);
          }
        }
      } catch {
        appendLog('Sprint date detection failed; continuing with manual input');
      } finally {
        setDetectingDates(false);
      }
    }

    const requestData = {
      ...formData,
      sprintStart: resolvedSprintStart,
      sprintEnd: resolvedSprintEnd,
      useCopilot: !!formData.useCopilot,
      requestId,
    };

    try {
      appendLog('Submitting analysis request');
      const githubPat = getGithubPat();
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        appendLog('Analysis request failed');
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      appendLog('Analysis completed');

      if (data.sprintStart && data.sprintEnd) {
        setFormData((prev) => ({
          ...prev,
          sprintStart: data.sprintStart,
          sprintEnd: data.sprintEnd,
        }));
      }

      sessionStorage.setItem('analysisResults', JSON.stringify(data.results));
      // Persist query context so the results page can re-analyze individual bugs
      sessionStorage.setItem('analysisQueryUrl', formData.queryUrl);
      sessionStorage.setItem('analysisSprintStart', requestData.sprintStart || '');
      sessionStorage.setItem('analysisSprintEnd', requestData.sprintEnd || '');
      appendLog('Opening results');
      router.push('/bug-analyzer/results');
    } catch (err: any) {
      appendLog(`Analysis error: ${err.message || 'Unknown error'}`);
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
      if (progressRef.current.timer) {
        window.clearInterval(progressRef.current.timer);
        progressRef.current.timer = null;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const detectSprintDates = async () => {
    if (!formData.queryUrl || !formData.patToken) {
      setError('Please select a query and ensure your PAT token is configured');
      return;
    }
    setDetectingDates(true);
    setDateDetectionMessage('');
    setError('');
    appendLog('Manual sprint date detection started');
    try {
      const response = await fetch('/api/detect-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryUrl: formData.queryUrl, patToken: formData.patToken }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        appendLog('Manual sprint date detection failed');
        throw new Error(errorData.error || 'Failed to detect sprint dates');
      }
      const data = await response.json();
      if (data.sprintStart && data.sprintEnd) {
        setFormData((prev) => ({
          ...prev,
          sprintStart: data.sprintStart,
          sprintEnd: data.sprintEnd,
        }));
        setDateDetectionMessage(
          `✓ Detected sprint dates: ${data.sprintStart} to ${data.sprintEnd} (from ${data.totalBugs} bugs)`
        );
        appendLog(`Sprint dates detected: ${data.sprintStart} to ${data.sprintEnd}`);
      } else {
        setDateDetectionMessage('⚠️ Could not auto-detect dates. Please enter them manually.');
        appendLog('Sprint dates not detected');
      }
    } catch (err: any) {
      appendLog(`Sprint date detection error: ${err.message || 'Unknown error'}`);
      setError(err.message || 'Failed to detect sprint dates');
    } finally {
      setDetectingDates(false);
    }
  };

  const selectedSubQuery = subQueries.find((q) => q.id === selectedSubQueryId);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      <AppHeader
        title="Bug Analyzer"
        subtitle="Progression insight from Azure DevOps in minutes"
        icon={<Bug className="w-5 h-5 text-white" />}
        actions={
          <button
            onClick={() => router.push('/bug-analyzer/about')}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Methodology</span>
          </button>
        }
      />

      <main className="container mx-auto px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-2xl font-semibold">Start a new analysis</h2>
              <p className="text-sm text-gray-600">
                Select a release query or provide a custom URL, then optionally set sprint dates.
              </p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── Query source toggle ── */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <Search className="w-4 h-4" />
                    Azure DevOps Query
                  </label>

                  {/* Mode switcher */}
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4 w-fit">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('list')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                        queryInputMode === 'list'
                          ? 'bg-[#e60000] text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      Pick from list
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('custom')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-l border-gray-200 ${
                        queryInputMode === 'custom'
                          ? 'bg-[#e60000] text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <PenLine className="w-4 h-4" />
                      Custom URL
                    </button>
                  </div>

                  {/* ── List mode ── */}
                  {queryInputMode === 'list' && (
                    <div className="space-y-3">

                      {/* Level 1: Release folder */}
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <select
                            value={selectedReleaseId}
                            onChange={(e) => handleReleaseSelect(e.target.value)}
                            disabled={loadingReleases}
                            className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition bg-white disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            <option value="">
                              {loadingReleases
                                ? 'Loading releases…'
                                : releases.length === 0 && releasesLoaded
                                ? 'No MVA releases found'
                                : releases.length === 0
                                ? 'Click refresh to load releases'
                                : 'Select a release…'}
                            </option>
                            {releases.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setReleasesLoaded(false);
                            subQueryCache.current.clear();
                            loadReleases();
                          }}
                          disabled={loadingReleases || !formData.patToken}
                          title="Refresh release list"
                          className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {loadingReleases ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>

                      {releasesError && (
                        <div className="flex items-start gap-2 p-3 bg-[#fef3f2] border border-[#fecaca] rounded-xl text-sm text-[#b42318]">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {releasesError}
                        </div>
                      )}

                      {/* Level 2: Query inside the selected release */}
                      {selectedReleaseId && (
                        <div className="relative">
                          {loadingSubQueries ? (
                            <div className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-500">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading queries…
                            </div>
                          ) : (
                            <>
                              <select
                                value={selectedSubQueryId}
                                onChange={(e) => handleSubQuerySelect(e.target.value)}
                                disabled={subQueries.length === 0}
                                className="w-full appearance-none px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition bg-white disabled:bg-gray-50 disabled:text-gray-400"
                              >
                                <option value="">
                                  {subQueries.length === 0 ? 'No queries found' : 'Select a query…'}
                                </option>
                                {subQueries.map((q) => (
                                  <option key={q.id} value={q.id}>
                                    {q.name}
                                    {q.name.toLowerCase().includes(DEFAULT_QUERY_KEYWORD) ? ' ★' : ''}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </>
                          )}
                        </div>
                      )}

                      {subQueriesError && (
                        <div className="flex items-start gap-2 p-3 bg-[#fef3f2] border border-[#fecaca] rounded-xl text-sm text-[#b42318]">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {subQueriesError}
                        </div>
                      )}

                      {/* Resolved URL preview */}
                      {selectedSubQuery && (
                        <div className="px-3 py-2 bg-[#f0fdf4] border border-[#a6f4c5] rounded-xl text-xs text-[#027a48] font-mono break-all">
                          {selectedSubQuery.queryUrl}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Custom URL mode ── */}
                  {queryInputMode === 'custom' && (
                    <input
                      type="text"
                      id="queryUrl"
                      name="queryUrl"
                      value={formData.queryUrl}
                      onChange={handleChange}
                      required
                      placeholder="https://dev.azure.com/org/project/_queries/query-edit/..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition"
                    />
                  )}
                </div>

                {/* ── PAT warning ── */}
                {!formData.patToken && (
                  <div className="bg-[#fff4e5] border border-[#ffd7a8] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-[#b45309] mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-[#7a2e0c] mb-1">
                          Configure credentials
                        </h3>
                        <p className="text-sm text-[#92400e] mb-2">
                          Add your Azure DevOps PAT token in Settings before running analysis.
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push('/settings')}
                          className="text-sm font-medium text-[#7a2e0c] underline hover:text-[#5a2107]"
                        >
                          Go to Settings →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sprint dates ── */}
                <div className="border border-gray-200 rounded-xl p-4 bg-[#fafafa]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#e60000]" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Sprint dates (optional)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={detectSprintDates}
                      disabled={detectingDates || !formData.queryUrl || !formData.patToken}
                      className="inline-flex items-center gap-2 rounded-full bg-[#e60000] px-4 py-2 text-sm font-medium text-white hover:bg-[#c30000] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {detectingDates ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Detecting…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Auto-detect
                        </>
                      )}
                    </button>
                  </div>

                  {dateDetectionMessage && (
                    <div
                      className={`mt-4 p-3 rounded-lg text-sm ${
                        dateDetectionMessage.startsWith('✓')
                          ? 'bg-[#ecfdf3] text-[#027a48] border border-[#a6f4c5]'
                          : 'bg-[#fff4e5] text-[#b45309] border border-[#ffd7a8]'
                      }`}
                    >
                      {dateDetectionMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label htmlFor="sprintStart" className="text-sm font-medium text-gray-700 mb-2 block">
                        Sprint start
                      </label>
                      <input
                        type="date"
                        id="sprintStart"
                        name="sprintStart"
                        value={formData.sprintStart}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="sprintEnd" className="text-sm font-medium text-gray-700 mb-2 block">
                        Sprint end
                      </label>
                      <input
                        type="date"
                        id="sprintEnd"
                        name="sprintEnd"
                        value={formData.sprintEnd}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-[#fef3f2] border border-[#fecaca] rounded-xl">
                    <p className="text-sm text-[#b42318]">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-[#e60000] text-white font-semibold rounded-xl hover:bg-[#c30000] focus:outline-none focus:ring-4 focus:ring-[#fca5a5] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Bug className="w-5 h-5" />
                      Analyze bugs
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Activity log</h3>
                <span className="text-xs text-gray-500">Live during analysis</span>
              </div>
              <div
                ref={logContainerRef}
                className="h-64 overflow-auto rounded-xl border border-gray-200 bg-[#fafafa] p-3 text-xs text-gray-700 font-mono"
              >
                {activityLogs.length === 0 ? (
                  <p className="text-gray-500">Logs will appear here when you start an analysis.</p>
                ) : (
                  activityLogs.map((entry, index) => (
                    <div key={`${entry}-${index}`}>{entry}</div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">What you will get</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#e60000] mt-0.5" />
                  Progression vs regression classification for each bug.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#e60000] mt-0.5" />
                  Linked pull requests, issue type detection, and origin hints.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-[#e60000] mt-0.5" />
                  Exportable results with a summary dashboard.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
