'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import {
  LayoutDashboard,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Bug,
  Target,
  Settings,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import ReactMarkdown from 'react-markdown';

type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

type IterationMetrics = {
  iterationName: string;
  startDate: string | null;
  endDate: string | null;
  totalWorkItems: number;
  completedWorkItems: number;
  completionRate: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  velocity: number;
  bugCount: number;
  activeBugs: number;
  resolvedBugs: number;
  newBugs: number;
};

type TeamDashboardData = {
  team: TeamConfig;
  iterations: IterationMetrics[];
  healthScore: number;
  healthStatus: 'green' | 'amber' | 'red';
  currentIteration: IterationMetrics | null;
  error?: string;
};

type DashboardResponse = {
  teams: TeamDashboardData[];
  summary: {
    totalTeams: number;
    healthyTeams: number;
    atRiskTeams: number;
    criticalTeams: number;
    avgHealthScore: number;
    orgHealthStatus: 'green' | 'amber' | 'red';
  };
};

function HealthBadge({ status, score }: { status: string; score: number }) {
  const config = {
    green: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> },
    amber: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', icon: <AlertTriangle className="w-4 h-4" /> },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: <XCircle className="w-4 h-4" /> },
  };
  const c = config[status as keyof typeof config] || config.amber;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {c.icon} {score}%
    </span>
  );
}

export default function ExecDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [sprintCount, setSprintCount] = useState(6);
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiTokens, setAiTokens] = useState<Record<string, { prompt: number; response: number; total: number }>>({});
  const [orgInsight, setOrgInsight] = useState('');
  const [orgInsightLoading, setOrgInsightLoading] = useState(false);
  const [orgInsightTokens, setOrgInsightTokens] = useState<{ prompt: number; response: number; total: number } | null>(null);

  const getGithubPat = () =>
    typeof window !== 'undefined' ? localStorage.getItem('github_pat_token') || '' : '';

  const generateInsights = async (teamData: TeamDashboardData, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const teamKey = `${teamData.team.organization}/${teamData.team.project}/${teamData.team.team}`;
    setAiLoading((prev) => ({ ...prev, [teamKey]: true }));

    try {
      const githubPat = getGithubPat();
      const response = await fetch('/api/exec-dashboard/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify({
          teamName: teamData.team.team,
          iterations: teamData.iterations,
          healthScore: teamData.healthScore,
          healthStatus: teamData.healthStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate insights');
      const result = await response.json();
      setAiInsights((prev) => ({ ...prev, [teamKey]: result.insight }));
      if (result.tokens) {
        setAiTokens((prev) => ({ ...prev, [teamKey]: result.tokens }));
      }
    } catch (err: any) {
      setAiInsights((prev) => ({ ...prev, [teamKey]: `Error: ${err.message}` }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [teamKey]: false }));
    }
  };

  const generateOrgInsights = async () => {
    if (!data) return;
    setOrgInsightLoading(true);
    try {
      const githubPat = getGithubPat();
      const response = await fetch('/api/exec-dashboard/insights/org', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify({
          teams: data.teams.map(t => ({
            teamName: t.team.team,
            healthScore: t.healthScore,
            healthStatus: t.healthStatus,
            iterations: t.iterations,
          })),
          summary: data.summary,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate org insights');
      const result = await response.json();
      setOrgInsight(result.insight);
      if (result.tokens) setOrgInsightTokens(result.tokens);
    } catch (err: any) {
      setOrgInsight(`Error: ${err.message}`);
    } finally {
      setOrgInsightLoading(false);
    }
  };

  const fetchDashboard = async () => {
    const patToken = localStorage.getItem('ado_pat_token') || '';
    const teamsJson = localStorage.getItem('ado_teams') || '[]';
    
    let teams: TeamConfig[] = [];
    try { teams = JSON.parse(teamsJson); } catch { /* ignore */ }

    if (!patToken) {
      setError('PAT token not configured. Go to Settings to add your Azure DevOps PAT token.');
      return;
    }
    if (teams.length === 0) {
      setError('No teams configured. Go to Settings to add your ADO teams.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/exec-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patToken, teams, sprintCount }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch dashboard data');
      }

      const result: DashboardResponse = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getShortIterationName = (name: string) => {
    // Extract short name like "41.2" from longer path
    const parts = name.split('\\');
    return parts[parts.length - 1] || name;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AppHeader
        title="Executive Dashboard"
        subtitle="Engineering health, velocity, and quality at a glance"
        icon={<LayoutDashboard className="w-5 h-5 text-white" />}
        actions={
          <div className="flex items-center gap-3">
            <select
              value={sprintCount}
              onChange={(e) => setSprintCount(Number(e.target.value))}
              className="rounded-full bg-white/10 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none"
            >
              <option value={3} className="text-black">Last 3 sprints</option>
              <option value={6} className="text-black">Last 6 sprints</option>
              <option value={9} className="text-black">Last 9 sprints</option>
              <option value={12} className="text-black">Last 12 sprints</option>
            </select>
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            <button
              onClick={() => router.push('/exec-dashboard/about')}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Methodology</span>
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        }
      />

      <main className="container mx-auto px-6 py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <button
                  onClick={() => router.push('/settings')}
                  className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
                >
                  Go to Settings →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-600 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Fetching sprint data from Azure DevOps...</p>
            <p className="text-gray-400 text-sm mt-1">This may take a moment for multiple teams</p>
          </div>
        )}

        {/* Dashboard Content */}
        {data && (
          <>
            {/* Current Sprint Banner */}
            {(() => {
              const firstTeamWithData = data.teams.find(t => t.currentIteration);
              if (!firstTeamWithData?.currentIteration) return null;
              return (
                <div className="flex items-center gap-2 mb-4 px-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Sprint:</span>
                  <span className="text-sm font-semibold text-gray-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    {getShortIterationName(firstTeamWithData.currentIteration.iterationName)}
                  </span>
                  <span className="text-[10px] text-gray-400">in progress</span>
                </div>
              );
            })()}

            {/* Organization Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Org Health</span>
                  <HealthBadge status={data.summary.orgHealthStatus} score={data.summary.avgHealthScore} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.summary.avgHealthScore}%</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Teams</span>
                  <Users className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.summary.totalTeams}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Healthy</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-emerald-900">{data.summary.healthyTeams}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">At Risk</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-900">{data.summary.atRiskTeams}</p>
              </div>
              <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Critical</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-900">{data.summary.criticalTeams}</p>
              </div>
            </div>

            {/* Org-Wide AI Analysis */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Organization-Wide AI Analysis</h3>
                    <p className="text-xs text-gray-500">Cross-team insights, comparisons, and executive recommendations</p>
                  </div>
                </div>
                <button
                  onClick={generateOrgInsights}
                  disabled={orgInsightLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-sm"
                >
                  {orgInsightLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing all teams...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> {orgInsight ? 'Refresh Org Analysis' : 'Generate Org Analysis'}</>
                  )}
                </button>
              </div>
              {(orgInsight || orgInsightLoading) && (
                <div className="border-t border-purple-100 bg-gradient-to-br from-purple-50/30 to-indigo-50/30 px-6 py-5">
                  {orgInsightLoading && !orgInsight && (
                    <div className="flex items-center gap-3 text-purple-700 py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Analyzing {data.summary.totalTeams} teams across the organization...</span>
                    </div>
                  )}
                  {orgInsight && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-semibold text-gray-900">Executive Summary</span>
                          <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Copilot CLI</span>
                        </div>
                        {orgInsightTokens && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            ~{orgInsightTokens.total.toLocaleString()} tokens (↑{orgInsightTokens.prompt.toLocaleString()} ↓{orgInsightTokens.response.toLocaleString()})
                          </span>
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2:first-child]:mt-0 [&_h2]:border-b [&_h2]:border-purple-200/50 [&_h2]:pb-1
                        [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:my-1.5 [&_p]:text-sm
                        [&_ul]:space-y-1 [&_ul]:my-1.5 [&_ul]:pl-0 [&_ul]:list-none
                        [&_li]:text-gray-700 [&_li]:text-sm [&_li]:pl-4 [&_li]:relative [&_li]:before:content-['▸'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-purple-400
                        [&_strong]:text-gray-900 [&_strong]:font-semibold
                        [&_em]:text-purple-700
                      ">
                        <ReactMarkdown>{orgInsight}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Team Cards */}
            <div className="space-y-6">
              {data.teams.map((teamData) => {
                const teamKey = `${teamData.team.organization}/${teamData.team.project}/${teamData.team.team}`;
                const isExpanded = expandedTeam === teamKey;

                return (
                  <div key={teamKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Team Header */}
                    <div
                      className="p-6 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => setExpandedTeam(isExpanded ? null : teamKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{teamData.team.team}</h3>
                            <p className="text-sm text-gray-500">
                              {teamData.team.organization} / {teamData.team.project}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {teamData.error ? (
                            <span className="text-sm text-red-600">{teamData.error}</span>
                          ) : (
                            <>
                              <div className="text-right hidden lg:block">
                                <p className="text-xs text-gray-500">Avg Completion</p>
                                <p className="text-sm font-bold text-gray-900">
                                  {(teamData as any).avgCompletionRate ?? '—'}%
                                </p>
                              </div>
                              <div className="text-right hidden lg:block">
                                <p className="text-xs text-gray-500">Avg SP</p>
                                <p className="text-sm font-bold text-gray-900">
                                  {(teamData as any).avgVelocity ?? '—'}
                                </p>
                              </div>
                              <HealthBadge status={teamData.healthStatus} score={teamData.healthScore} />
                              <button
                                onClick={(e) => generateInsights(teamData, e)}
                                disabled={aiLoading[teamKey]}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-sm"
                              >
                                {aiLoading[teamKey] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                <span className="hidden sm:inline">{aiInsights[teamKey] ? 'Refresh' : 'AI Analysis'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Insights Panel — visible without expanding */}
                    {(aiInsights[teamKey] || aiLoading[teamKey]) && (
                      <div className="border-t border-purple-100 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 px-6 py-4">
                        {aiLoading[teamKey] && (
                          <div className="flex items-center gap-3 text-purple-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">Generating AI analysis...</span>
                          </div>
                        )}
                        {aiInsights[teamKey] && !aiLoading[teamKey] && (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-semibold text-gray-900">AI Sprint Analysis</span>
                                <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Copilot CLI</span>
                              </div>
                              {aiTokens[teamKey] && (
                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                  ~{aiTokens[teamKey].total.toLocaleString()} tokens (↑{aiTokens[teamKey].prompt.toLocaleString()} ↓{aiTokens[teamKey].response.toLocaleString()})
                                </span>
                              )}
                            </div>
                            <div className="prose prose-sm max-w-none
                              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2:first-child]:mt-0 [&_h2]:border-b [&_h2]:border-purple-200/50 [&_h2]:pb-1
                              [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:my-1.5 [&_p]:text-sm
                              [&_ul]:space-y-1 [&_ul]:my-1.5 [&_ul]:pl-0 [&_ul]:list-none
                              [&_li]:text-gray-700 [&_li]:text-sm [&_li]:pl-4 [&_li]:relative [&_li]:before:content-['▸'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-purple-400
                              [&_strong]:text-gray-900 [&_strong]:font-semibold
                              [&_em]:text-purple-700
                            ">
                              <ReactMarkdown>{aiInsights[teamKey]}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expanded Detail */}
                    {isExpanded && !teamData.error && (
                      <div className="border-t border-gray-200 p-6 space-y-6">
                        {/* Delivery Trend Chart */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Delivery Trend</h4>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={teamData.iterations.map((i) => ({
                                name: getShortIterationName(i.iterationName),
                                'Items Completed': i.completedWorkItems,
                                'Story Points': i.velocity,
                                'Completion %': i.completionRate,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
                                <Tooltip />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="Items Completed" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 4 }} />
                                <Line yAxisId="left" type="monotone" dataKey="Story Points" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                                <Line yAxisId="right" type="monotone" dataKey="Completion %" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Bug Trend Chart */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Bug Trend</h4>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={teamData.iterations.map((i) => ({
                                name: getShortIterationName(i.iterationName),
                                active: i.activeBugs,
                                resolved: i.resolvedBugs,
                                new: i.newBugs,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="new" fill="#fbbf24" name="New" stackId="a" />
                                <Bar dataKey="active" fill="#f87171" name="Active" stackId="a" />
                                <Bar dataKey="resolved" fill="#34d399" name="Resolved" stackId="a" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Sprint Table */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Sprint History</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-medium text-gray-600">Sprint</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Items</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Completed</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Rate</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Velocity</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Bugs</th>
                                </tr>
                              </thead>
                              <tbody>
                                {teamData.iterations.map((iter, idx) => {
                                  const isCurrent = idx === teamData.iterations.length - 1;
                                  return (
                                    <tr key={iter.iterationName} className={`border-b border-gray-100 hover:bg-gray-50 ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                                      <td className="py-2 px-3 font-medium text-gray-900">
                                        {getShortIterationName(iter.iterationName)}
                                        {isCurrent && <span className="ml-2 text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">IN PROGRESS</span>}
                                      </td>
                                      <td className="text-right py-2 px-3 text-gray-700">{iter.totalWorkItems}</td>
                                      <td className="text-right py-2 px-3 text-gray-700">{iter.completedWorkItems}</td>
                                      <td className="text-right py-2 px-3">
                                        <span className={`font-semibold ${
                                          iter.completionRate >= 80 ? 'text-emerald-600' :
                                          iter.completionRate >= 60 ? 'text-amber-600' : 'text-red-600'
                                        }`}>
                                          {iter.completionRate}%
                                        </span>
                                      </td>
                                      <td className="text-right py-2 px-3 text-blue-600">
                                        <span className="font-semibold">{iter.completedWorkItems} items</span>
                                        <span className="text-gray-400 mx-1">·</span>
                                        <span className="text-gray-600">{iter.velocity} SP</span>
                                      </td>
                                      <td className="text-right py-2 px-3 text-gray-700">{iter.bugCount}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Current Sprint Summary */}
                        {teamData.currentIteration && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <h4 className="text-sm font-semibold text-gray-900">Current Sprint: {getShortIterationName(teamData.currentIteration.iterationName)}</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <Target className="w-4 h-4 text-blue-500" />
                                  <span className="text-xs font-medium text-gray-500">Work Items</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                  {teamData.currentIteration.completedWorkItems}/{teamData.currentIteration.totalWorkItems}
                                </p>
                              </div>
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs font-medium text-gray-500">Story Points</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                  {teamData.currentIteration.velocity} <span className="text-sm font-normal text-gray-500">SP</span>
                                </p>
                              </div>
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <CheckCircle2 className="w-4 h-4 text-purple-500" />
                                  <span className="text-xs font-medium text-gray-500">Completion</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                  {teamData.currentIteration.completionRate}%
                                </p>
                              </div>
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <Bug className="w-4 h-4 text-red-500" />
                                  <span className="text-xs font-medium text-gray-500">Bugs</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                  {teamData.currentIteration.bugCount}
                                  <span className="text-sm font-normal text-gray-500 ml-1">
                                    ({teamData.currentIteration.activeBugs} active)
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* No Teams State (shouldn't happen but just in case) */}
            {data.teams.length === 0 && (
              <div className="text-center py-20">
                <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No team data available</p>
                <button
                  onClick={() => router.push('/settings')}
                  className="mt-4 text-sm font-medium text-blue-600 underline"
                >
                  Configure teams in Settings
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
