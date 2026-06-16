'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import {
  Brain, Loader2, RefreshCw, AlertTriangle, Settings,
  TrendingUp, TrendingDown, Minus, GitPullRequest, Bug,
  Zap, Target, Users, ChevronDown, ChevronUp, Info, CheckCircle2, GitBranch, BookOpen,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type SprintADOMetrics = {
  sprintName: string; startDate: string | null; endDate: string | null;
  totalWorkItems: number; completedWorkItems: number; completionRate: number; velocity: number;
  bugCount: number; newBugs: number; resolvedBugs: number; bugEscapeRate: number;
  prCount: number; avgPRCycleTimeDays: number; medianPRCycleTimeDays: number;
};
type CopilotMetrics = {
  source: 'github_api' | 'manual'; acceptanceRate: number; activeUsers: number;
  totalSuggestions: number; acceptedSuggestions: number; linesAccepted: number; weekLabel: string;
};
type AIProductivityIndex = {
  score: number; trend: 'improving' | 'stable' | 'declining';
  components: { deliveryScore: number; qualityScore: number; velocityScore: number; prEfficiencyScore: number; copilotAdoptionScore: number; };
  insights: string[];
};
type TeamConfig = { organization: string; project: string; team: string };
type TeamProductivityData = {
  team: TeamConfig; sprints: SprintADOMetrics[]; index: AIProductivityIndex;
  trackedRepos: string[]; error?: string;
};
type AIProductivityResponse = {
  teams: TeamProductivityData[]; orgSprints: SprintADOMetrics[];
  copilot: CopilotMetrics | null; orgIndex: AIProductivityIndex;
  resolvedRepos: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: '#10b981' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', ring: '#f59e0b' };
  return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', ring: '#ef4444' };
}
function scoreLabel(s: number) {
  if (s >= 85) return 'Excellent'; if (s >= 70) return 'Good';
  if (s >= 55) return 'Fair'; if (s >= 40) return 'Needs Work'; return 'Critical';
}
function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function ScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={12} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={c.ring} strokeWidth={12}
          strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold ${c.text}`}>{score}</span>
        <span className="text-xs text-gray-500 font-medium">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-800">{score}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SprintTable({ sprints }: { sprints: SprintADOMetrics[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Sprint','Items','Done','Completion','Velocity (SP)','Bugs','Bug Escape','PRs','Avg Cycle'].map(h => (
              <th key={h} className={`py-3 px-4 font-medium text-gray-600 ${h === 'Sprint' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint, idx) => {
            const isCurrent = idx === sprints.length - 1;
            return (
              <tr key={`${sprint.sprintName}-${idx}`} className={`border-b border-gray-100 hover:bg-gray-50 ${isCurrent ? 'bg-blue-50/40' : ''}`}>
                <td className="py-2.5 px-4 font-medium text-gray-900">
                  {sprint.sprintName}
                  {isCurrent && <span className="ml-2 text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">IN PROGRESS</span>}
                </td>
                <td className="text-right py-2.5 px-4 text-gray-700">{sprint.totalWorkItems}</td>
                <td className="text-right py-2.5 px-4 text-gray-700">{sprint.completedWorkItems}</td>
                <td className="text-right py-2.5 px-4">
                  <span className={`font-semibold ${sprint.completionRate >= 80 ? 'text-emerald-600' : sprint.completionRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {sprint.completionRate}%
                  </span>
                </td>
                <td className="text-right py-2.5 px-4 text-blue-600 font-medium">{sprint.velocity}</td>
                <td className="text-right py-2.5 px-4 text-gray-700">{sprint.bugCount}</td>
                <td className="text-right py-2.5 px-4">
                  <span className={`font-medium ${sprint.bugEscapeRate > 20 ? 'text-red-600' : sprint.bugEscapeRate > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {sprint.bugEscapeRate}%
                  </span>
                </td>
                <td className="text-right py-2.5 px-4 text-gray-700">{sprint.prCount}</td>
                <td className="text-right py-2.5 px-4">
                  <span className={`font-medium ${sprint.avgPRCycleTimeDays > 5 ? 'text-red-600' : sprint.avgPRCycleTimeDays > 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {sprint.avgPRCycleTimeDays > 0 ? `${sprint.avgPRCycleTimeDays}d` : '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIProductivityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIProductivityResponse | null>(null);
  const [error, setError] = useState('');
  const [sprintCount, setSprintCount] = useState(6);
  const [showCopilotInput, setShowCopilotInput] = useState(false);
  const [showOrgTable, setShowOrgTable] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // Repo pool (from Settings) + selection
  const [repoPool, setRepoPool] = useState<string[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  // Copilot manual input
  const [copilotAcceptanceRate, setCopilotAcceptanceRate] = useState('');
  const [copilotActiveUsers, setCopilotActiveUsers] = useState('');
  const [copilotTotalSuggestions, setCopilotTotalSuggestions] = useState('');
  const [copilotAcceptedSuggestions, setCopilotAcceptedSuggestions] = useState('');
  const [copilotLinesAccepted, setCopilotLinesAccepted] = useState('');

  useEffect(() => {
    // Load copilot metrics
    const saved = localStorage.getItem('copilot_metrics');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.acceptanceRate) setCopilotAcceptanceRate(String(p.acceptanceRate));
        if (p.activeUsers) setCopilotActiveUsers(String(p.activeUsers));
        if (p.totalSuggestions) setCopilotTotalSuggestions(String(p.totalSuggestions));
        if (p.acceptedSuggestions) setCopilotAcceptedSuggestions(String(p.acceptedSuggestions));
        if (p.linesAccepted) setCopilotLinesAccepted(String(p.linesAccepted));
      } catch { /* ignore */ }
    }
    // Load repo pool from settings
    try {
      const pool: string[] = JSON.parse(localStorage.getItem('ado_repos') || '[]');
      setRepoPool(pool);
      // Load previously selected repos (default: all)
      const savedSelected = localStorage.getItem('ai_productivity_selected_repos');
      if (savedSelected) {
        const parsed: string[] = JSON.parse(savedSelected);
        // Only keep repos that still exist in the pool
        setSelectedRepos(parsed.filter(r => pool.includes(r)));
      } else {
        setSelectedRepos(pool); // default: all selected
      }
    } catch { /* ignore */ }
  }, []);

  const toggleRepo = (repo: string) => {
    setSelectedRepos(prev =>
      prev.includes(repo) ? prev.filter(r => r !== repo) : [...prev, repo]
    );
  };

  const fetchData = async () => {
    const patToken = localStorage.getItem('ado_pat_token') || '';
    let teams: TeamConfig[] = [];
    try { teams = JSON.parse(localStorage.getItem('ado_teams') || '[]'); } catch { /* ignore */ }

    if (!patToken) { setError('PAT token not configured. Go to Settings.'); return; }
    if (teams.length === 0) { setError('No teams configured. Go to Settings.'); return; }

    // Save copilot + selected repos
    localStorage.setItem('copilot_metrics', JSON.stringify({
      acceptanceRate: Number(copilotAcceptanceRate) || 0,
      activeUsers: Number(copilotActiveUsers) || 0,
      totalSuggestions: Number(copilotTotalSuggestions) || 0,
      acceptedSuggestions: Number(copilotAcceptedSuggestions) || 0,
      linesAccepted: Number(copilotLinesAccepted) || 0,
    }));
    localStorage.setItem('ai_productivity_selected_repos', JSON.stringify(selectedRepos));

    setLoading(true); setError('');

    const copilotInput = copilotAcceptanceRate ? {
      acceptanceRate: Number(copilotAcceptanceRate),
      activeUsers: Number(copilotActiveUsers) || 0,
      totalSuggestions: Number(copilotTotalSuggestions) || 0,
      acceptedSuggestions: Number(copilotAcceptedSuggestions) || 0,
      linesAccepted: Number(copilotLinesAccepted) || 0,
    } : undefined;

    try {
      const res = await fetch('/api/ai-productivity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patToken, teams, sprintCount,
          selectedRepos,  // pass selected repos from pool
          copilotInput,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      setData(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  };

  // Auto-fetch only when we have PAT + teams configured
  useEffect(() => {
    const pat = localStorage.getItem('ado_pat_token') || '';
    let teams: TeamConfig[] = [];
    try { teams = JSON.parse(localStorage.getItem('ado_teams') || '[]'); } catch { /* ignore */ }
    if (pat && teams.length > 0) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chart data
  const trendChartData = (data?.orgSprints || []).map(s => ({
    name: s.sprintName,
    'Completion %': s.completionRate,
    'Bug Escape %': s.bugEscapeRate,
    'PR Cycle (days)': s.avgPRCycleTimeDays,
    'PRs Merged': s.prCount,
  }));

  const radarData = data ? [
    { metric: 'Delivery', score: data.orgIndex.components.deliveryScore },
    { metric: 'Quality', score: data.orgIndex.components.qualityScore },
    { metric: 'Velocity', score: data.orgIndex.components.velocityScore },
    { metric: 'PR Flow', score: data.orgIndex.components.prEfficiencyScore },
    { metric: 'AI Adoption', score: data.orgIndex.components.copilotAdoptionScore },
  ] : [];

  const orgStats = (() => {
    if (!data) return null;
    const completed = data.orgSprints.slice(0, -1);
    const recent = completed.length > 0 ? completed : data.orgSprints;
    if (recent.length === 0) return null;
    return {
      avgCompletion: Math.round(recent.reduce((s, sp) => s + sp.completionRate, 0) / recent.length),
      avgCycleTime: (recent.reduce((s, sp) => s + sp.avgPRCycleTimeDays, 0) / recent.length).toFixed(1),
      totalPRs: recent.reduce((s, sp) => s + sp.prCount, 0),
      avgBugEscape: Math.round(recent.reduce((s, sp) => s + sp.bugEscapeRate, 0) / recent.length),
      sprintCount: recent.length,
    };
  })();

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AppHeader
        title="AI Productivity Index"
        subtitle="Measure and prove AI ROI by correlating Copilot usage with engineering outcomes"
        icon={<Brain className="w-5 h-5 text-white" />}
        gradient="bg-gradient-to-r from-purple-600 to-violet-700"
        actions={
          <div className="flex items-center gap-3">
            <select value={sprintCount} onChange={e => setSprintCount(Number(e.target.value))}
              className="rounded-full bg-white/10 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none">
              {[3,6,9,12].map(n => <option key={n} value={n} className="text-black">Last {n} sprints</option>)}
            </select>
            <button onClick={fetchData} disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
            </button>
            <button onClick={() => router.push('/ai-productivity/about')}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition">
              <BookOpen className="w-4 h-4" /><span className="hidden sm:inline">Methodology</span>
            </button>
            <button onClick={() => router.push('/settings')}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition">
              <Settings className="w-4 h-4" /><span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        }
      />

      <main className="container mx-auto px-6 py-8 space-y-6">

        {/* ── Repo selector ─────────────────────────────────────────────────── */}
        {repoPool.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-900">Repositories for PR Metrics</span>
              <span className="text-xs text-gray-400 ml-1">({selectedRepos.length} of {repoPool.length} selected)</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setSelectedRepos(repoPool)} className="text-xs text-blue-600 hover:underline">All</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => setSelectedRepos([])} className="text-xs text-gray-500 hover:underline">None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {repoPool.map(repo => {
                const active = selectedRepos.includes(repo);
                return (
                  <button key={repo} onClick={() => toggleRepo(repo)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      active
                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <GitBranch className="w-3 h-3" />
                    {repo}
                  </button>
                );
              })}
            </div>
            {data?.resolvedRepos && data.resolvedRepos.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                Last run used: {data.resolvedRepos.join(', ')}
              </p>
            )}
          </div>
        )}

        {repoPool.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              No repositories configured. <button onClick={() => router.push('/settings')} className="font-medium underline">Go to Settings</button> to add your repo pool (e.g. MVA-iOS, MVA-Android, mvax-api). PR metrics will be unavailable until then.
            </p>
          </div>
        )}

        {/* ── Copilot Input ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowCopilotInput(!showCopilotInput)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">GitHub Copilot Data</p>
                <p className="text-xs text-gray-500">
                  {copilotAcceptanceRate
                    ? `Acceptance rate: ${copilotAcceptanceRate}% · ${copilotActiveUsers || 0} active users`
                    : 'Enter Copilot metrics from your Power BI telemetry report to unlock the full index'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {copilotAcceptanceRate && <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Manual input</span>}
              {showCopilotInput ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>
          {showCopilotInput && (
            <div className="border-t border-gray-100 p-5 bg-purple-50/30">
              <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Open the GitHub Copilot telemetry report in your Teams tab and enter the values below.
                  Saved in your browser. <strong>Classic GitHub PAT</strong> with <code>manage_billing:copilot</code> will automate this — see <code>GITHUB_PAT_FIX.md</code>.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                {[
                  { label: 'Acceptance Rate (%)', val: copilotAcceptanceRate, set: setCopilotAcceptanceRate, ph: '32', req: true },
                  { label: 'Active Users', val: copilotActiveUsers, set: setCopilotActiveUsers, ph: '45' },
                  { label: 'Total Suggestions', val: copilotTotalSuggestions, set: setCopilotTotalSuggestions, ph: '12500' },
                  { label: 'Accepted Suggestions', val: copilotAcceptedSuggestions, set: setCopilotAcceptedSuggestions, ph: '4000' },
                  { label: 'Lines Accepted', val: copilotLinesAccepted, set: setCopilotLinesAccepted, ph: '8200' },
                ].map(({ label, val, set, ph, req }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <input type="number" min="0" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={fetchData} disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-700 hover:to-violet-700 transition disabled:opacity-50 shadow-sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Calculate Index
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <button onClick={() => router.push('/settings')} className="mt-2 text-sm font-medium text-red-700 underline">Go to Settings →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Calculating AI Productivity Index...</p>
            <p className="text-gray-400 text-sm mt-1">Fetching all teams in parallel — sprint data, PR metrics across {selectedRepos.length} repo{selectedRepos.length !== 1 ? 's' : ''}</p>
          </div>
        )}

        {/* ── Dashboard ─────────────────────────────────────────────────────── */}
        {data && (
          <>
            {/* Banner */}
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Showing:</span>
              <span className="text-sm font-semibold text-gray-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                {data.teams.length} team{data.teams.length !== 1 ? 's' : ''} · org-level aggregate
              </span>
              {data.resolvedRepos.length > 0 && (
                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                  {data.resolvedRepos.length} repo{data.resolvedRepos.length !== 1 ? 's' : ''}: {data.resolvedRepos.join(', ')}
                </span>
              )}
              {data.teams.filter(t => t.error).length > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {data.teams.filter(t => t.error).length} team(s) failed
                </span>
              )}
            </div>

            {/* Row 1: Score + Breakdown + Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Productivity Index</span>
                </div>
                <ScoreGauge score={data.orgIndex.score} size={180} />
                <div className="flex items-center gap-2 mt-3">
                  <TrendIcon trend={data.orgIndex.trend} />
                  <span className="text-sm font-medium text-gray-600 capitalize">{data.orgIndex.trend}</span>
                </div>
                {data.copilot
                  ? <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Copilot data included</div>
                  : <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full"><Info className="w-3 h-3" />ADO metrics only</div>
                }
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {data.orgSprints.length} sprints · {data.teams.length} team{data.teams.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Breakdown</h3>
                <div className="space-y-4">
                  <ScoreBar label="Delivery (completion rate)" score={data.orgIndex.components.deliveryScore} color="#8b5cf6" />
                  <ScoreBar label="Quality (bug escape rate)" score={data.orgIndex.components.qualityScore} color="#06b6d4" />
                  <ScoreBar label="Velocity (stability)" score={data.orgIndex.components.velocityScore} color="#3b82f6" />
                  <ScoreBar label="PR Flow (cycle time)" score={data.orgIndex.components.prEfficiencyScore} color="#10b981" />
                  <ScoreBar
                    label={data.copilot ? `AI Adoption (${data.copilot.acceptanceRate}% acceptance)` : 'AI Adoption (not connected)'}
                    score={data.orgIndex.components.copilotAdoptionScore} color="#f59e0b" />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                  Weights: Delivery 25% · Quality 20% · Velocity 20% · PR 15% · AI 20%
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Key Insights</h3>
                <div className="space-y-3">
                  {data.orgIndex.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-purple-600">{i + 1}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Copilot metrics */}
            {data.copilot && (
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl border border-purple-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">GitHub Copilot Metrics</h3>
                  <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full capitalize">
                    {data.copilot.source === 'manual' ? 'Manual input' : 'GitHub API'}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{data.copilot.weekLabel}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Acceptance Rate', value: `${data.copilot.acceptanceRate}%`, sub: 'of suggestions accepted' },
                    { label: 'Active Users', value: String(data.copilot.activeUsers), sub: 'engineers using Copilot' },
                    { label: 'Total Suggestions', value: data.copilot.totalSuggestions.toLocaleString(), sub: 'AI code suggestions' },
                    { label: 'Accepted', value: data.copilot.acceptedSuggestions.toLocaleString(), sub: 'suggestions used' },
                    { label: 'Lines Accepted', value: data.copilot.linesAccepted.toLocaleString(), sub: 'lines of AI-written code' },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="bg-white rounded-xl p-4 border border-purple-100">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="text-2xl font-bold text-purple-700">{value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: Summary cards */}
            {orgStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-purple-500" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Completion</span></div>
                  <p className="text-3xl font-bold text-gray-900">{orgStats.avgCompletion}%</p>
                  <p className="text-xs text-gray-400 mt-1">per sprint · {data.teams.length} teams</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2"><GitPullRequest className="w-4 h-4 text-emerald-500" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">PR Cycle Time</span></div>
                  <p className="text-3xl font-bold text-gray-900">{orgStats.avgCycleTime}d</p>
                  <p className="text-xs text-gray-400 mt-1">avg creation → merge</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-blue-500" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">PRs Merged</span></div>
                  <p className="text-3xl font-bold text-gray-900">{orgStats.totalPRs}</p>
                  <p className="text-xs text-gray-400 mt-1">across {orgStats.sprintCount} sprints</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-2"><Bug className="w-4 h-4 text-red-500" /><span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bug Escape Rate</span></div>
                  <p className="text-3xl font-bold text-gray-900">{orgStats.avgBugEscape}%</p>
                  <p className="text-xs text-gray-400 mt-1">bugs / total items</p>
                </div>
              </div>
            )}

            {/* Row 4: Trend charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Delivery & Quality Trend</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip /><Legend />
                      <Line type="monotone" dataKey="Completion %" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Bug Escape %" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">PR Throughput & Cycle Time</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Bar yAxisId="left" dataKey="PRs Merged" fill="#8b5cf6" radius={[4,4,0,0]} />
                      <Line yAxisId="right" type="monotone" dataKey="PR Cycle (days)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Row 5: Radar + Executive summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Productivity Radar</h3>
                <p className="text-xs text-gray-500 mb-4">All five dimensions of the AI Productivity Index</p>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Executive Summary</h3>
                    <span className="text-xs text-gray-400 ml-auto">{new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className={`rounded-xl p-4 border mb-4 ${scoreColor(data.orgIndex.score).bg} ${scoreColor(data.orgIndex.score).border}`}>
                    <p className={`text-4xl font-bold ${scoreColor(data.orgIndex.score).text} mb-1`}>{data.orgIndex.score} / 100</p>
                    <p className="text-sm font-medium text-gray-700">AI Productivity Index — {scoreLabel(data.orgIndex.score)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Trend: <span className="font-medium capitalize">{data.orgIndex.trend}</span>
                      {data.copilot && ` · Copilot acceptance: ${data.copilot.acceptanceRate}%`}
                      {` · ${data.teams.length} team${data.teams.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {data.orgIndex.insights.slice(0, 3).map((insight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-600">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    {data.teams.length} team{data.teams.length !== 1 ? 's' : ''} · {data.orgSprints.length} sprints
                    {data.resolvedRepos.length > 0 && ` · ${data.resolvedRepos.length} repos`}
                    {data.copilot ? ' · Copilot included' : ' · Add Copilot data above for full index'}
                  </p>
                </div>
              </div>
            </div>

            {/* Row 6: Per-team breakdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Users className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Per-Team Breakdown</h3>
                <span className="text-xs text-gray-400">({data.teams.length} teams)</span>
              </div>
              {data.teams.map(teamData => {
                const key = `${teamData.team.organization}/${teamData.team.project}/${teamData.team.team}`;
                const isExpanded = expandedTeam === key;
                const c = scoreColor(teamData.index.score);
                const avgCompletion = teamData.sprints.length > 1
                  ? Math.round(teamData.sprints.slice(0,-1).reduce((s,sp) => s + sp.completionRate, 0) / (teamData.sprints.length - 1))
                  : 0;
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <button onClick={() => setExpandedTeam(isExpanded ? null : key)}
                      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{teamData.team.team}</p>
                          <p className="text-xs text-gray-500">{teamData.team.organization} / {teamData.team.project}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {teamData.error
                          ? <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">{teamData.error}</span>
                          : (
                            <>
                              <div className="hidden md:flex items-center gap-4 text-right">
                                <div>
                                  <p className="text-xs text-gray-400">Sprints</p>
                                  <p className="text-sm font-bold text-gray-800">{teamData.sprints.length}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Avg Completion</p>
                                  <p className="text-sm font-bold text-gray-800">{avgCompletion}%</p>
                                </div>
                                {teamData.trackedRepos.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-400">Repos</p>
                                    <p className="text-xs font-medium text-gray-600">{teamData.trackedRepos.length} tracked</p>
                                  </div>
                                )}
                              </div>
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                                <TrendIcon trend={teamData.index.trend} />
                                {teamData.index.score}
                              </div>
                            </>
                          )
                        }
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {isExpanded && !teamData.error && teamData.sprints.length > 0 && (
                      <div className="border-t border-gray-200 p-5 space-y-4">
                        {teamData.trackedRepos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {teamData.trackedRepos.map(r => (
                              <span key={r} className="inline-flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                <GitBranch className="w-3 h-3" />{r}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            { label: 'Delivery', score: teamData.index.components.deliveryScore, color: '#8b5cf6' },
                            { label: 'Quality', score: teamData.index.components.qualityScore, color: '#06b6d4' },
                            { label: 'Velocity', score: teamData.index.components.velocityScore, color: '#3b82f6' },
                            { label: 'PR Flow', score: teamData.index.components.prEfficiencyScore, color: '#10b981' },
                            { label: 'AI Adoption', score: teamData.index.components.copilotAdoptionScore, color: '#f59e0b' },
                          ].map(({ label, score, color }) => (
                            <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">{label}</p>
                              <p className="text-xl font-bold" style={{ color }}>{score}</p>
                              <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <SprintTable sprints={teamData.sprints} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Row 7: Org aggregate table */}
            {data.orgSprints.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button onClick={() => setShowOrgTable(!showOrgTable)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-900">Org-Level Sprint Aggregate</span>
                    <span className="text-xs text-gray-400">({data.orgSprints.length} sprints · all teams combined)</span>
                  </div>
                  {showOrgTable ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {showOrgTable && (
                  <div className="border-t border-gray-200">
                    <SprintTable sprints={data.orgSprints} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
