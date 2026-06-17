'use client';

import { useState, useEffect, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import {
  Key, Save, CheckCircle, Plus, Trash2, Settings, Users, GitBranch,
  Layers, Github, Search, ChevronDown, Loader2, RefreshCw, AlertCircle,
  Eye, EyeOff, ChevronRight, ExternalLink, X, Shield, Cpu,
} from 'lucide-react';

export type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

type Section = 'credentials' | 'teams' | 'repos' | 'advanced';

const NAV: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'credentials', label: 'Credentials', icon: <Shield className="w-4 h-4" /> },
  { id: 'teams',       label: 'Teams',       icon: <Users className="w-4 h-4" /> },
  { id: 'repos',       label: 'Repositories', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'advanced',    label: 'Advanced',    icon: <Cpu className="w-4 h-4" /> },
];

/* ── tiny helpers ── */
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
      {children}
    </div>
  );
}
function CardRow({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-5">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</p>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{children}</p>;
}
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-gray-300'}`} />
  );
}

export default function GlobalSettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('credentials');

  const [patToken, setPatToken]   = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [iosPath, setIosPath]     = useState('');
  const [teams, setTeams]         = useState<TeamConfig[]>([]);
  const [repos, setRepos]         = useState<string[]>([]);
  const [saved, setSaved]         = useState(false);

  const [showPat, setShowPat]       = useState(false);
  const [showGhPat, setShowGhPat]   = useState(false);

  // Team picker
  const [availableTeams, setAvailableTeams]     = useState<string[]>([]);
  const [teamsLoading, setTeamsLoading]         = useState(false);
  const [teamsError, setTeamsError]             = useState('');
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [teamSearch, setTeamSearch]             = useState('');
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Repo picker
  const [availableRepos, setAvailableRepos] = useState<string[]>([]);
  const [reposLoading, setReposLoading]     = useState(false);
  const [reposError, setReposError]         = useState('');
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoSearch, setRepoSearch]         = useState('');
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  /* ── load from localStorage ── */
  useEffect(() => {
    setPatToken(localStorage.getItem('ado_pat_token') || '');
    setGithubPat(localStorage.getItem('github_pat_token') || '');
    setIosPath(localStorage.getItem('story_ios_path') || 'MVA-iOS/VFUK-iOS/Modules');
    try { setTeams(JSON.parse(localStorage.getItem('ado_teams') || '[]')); } catch { /* */ }
    try { setRepos(JSON.parse(localStorage.getItem('ado_repos') || '[]')); } catch { /* */ }
  }, []);

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownIndex(null); setTeamSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false); setRepoSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── save ── */
  const handleSave = () => {
    localStorage.setItem('ado_pat_token', patToken);
    localStorage.setItem('github_pat_token', githubPat);
    localStorage.setItem('story_ios_path', iosPath);
    localStorage.setItem('ado_teams', JSON.stringify(teams));
    localStorage.setItem('ado_repos', JSON.stringify(repos));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  /* ── teams ── */
  const fetchTeams = async (token?: string) => {
    const pat = token ?? patToken;
    if (!pat.trim()) { setTeamsError('Enter your ADO PAT token first.'); return; }
    setTeamsLoading(true); setTeamsError('');
    try {
      const res  = await fetch('/api/ado-teams?organization=vfuk-digital&project=Digital', { headers: { 'x-ado-pat': pat } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAvailableTeams(data.teams || []);
    } catch (e: any) { setTeamsError(e.message); }
    finally { setTeamsLoading(false); }
  };
  const addTeam = () => {
    setTeams([...teams, { organization: 'vfuk-digital', project: 'Digital', team: '' }]);
    if (!availableTeams.length && !teamsLoading) fetchTeams();
  };
  const updateTeam = (i: number, field: keyof TeamConfig, val: string) => {
    const u = [...teams]; u[i] = { ...u[i], [field]: val }; setTeams(u);
  };
  const removeTeam = (i: number) => setTeams(teams.filter((_, idx) => idx !== i));
  const selectTeam = (i: number, name: string) => { updateTeam(i, 'team', name); setOpenDropdownIndex(null); setTeamSearch(''); };
  const filteredTeams = availableTeams.filter(t => t.toLowerCase().includes(teamSearch.toLowerCase()));

  /* ── repos ── */
  const fetchRepos = async (token?: string) => {
    const pat = token ?? patToken;
    if (!pat.trim()) { setReposError('Enter your ADO PAT token first.'); return; }
    setReposLoading(true); setReposError('');
    try {
      const res  = await fetch('/api/ado-repos?organization=vfuk-digital&project=Digital', { headers: { 'x-ado-pat': pat } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAvailableRepos(data.repos || []);
    } catch (e: any) { setReposError(e.message); }
    finally { setReposLoading(false); }
  };
  const selectRepo = (name: string) => {
    if (!repos.includes(name)) setRepos([...repos, name]);
    setRepoDropdownOpen(false); setRepoSearch('');
  };
  const removeRepo = (r: string) => setRepos(repos.filter(x => x !== r));
  const filteredRepos = availableRepos.filter(r => r.toLowerCase().includes(repoSearch.toLowerCase()) && !repos.includes(r));

  /* ── badge counts for nav ── */
  const badges: Record<Section, string | undefined> = {
    credentials: (patToken ? 1 : 0) + (githubPat ? 1 : 0) > 0 ? `${(patToken ? 1 : 0) + (githubPat ? 1 : 0)}/2` : undefined,
    teams:       teams.length > 0 ? String(teams.length) : undefined,
    repos:       repos.length > 0 ? String(repos.length) : undefined,
    advanced:    undefined,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Settings"
        subtitle="Manage credentials, teams, and repositories used across all initiatives"
        icon={<Settings className="w-5 h-5 text-white" />}
        gradient="bg-gray-900"
      />

      <div className="container mx-auto px-6 py-10 max-w-5xl">
        <div className="flex gap-8 items-start">

          {/* ── Sidebar nav ── */}
          <aside className="w-52 shrink-0 sticky top-8">
            <nav className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {NAV.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition border-l-2 ${
                    activeSection === id
                      ? 'border-gray-900 bg-gray-50 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {icon}
                    {label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {badges[id] && (
                      <span className="text-[10px] font-semibold bg-gray-900 text-white px-1.5 py-0.5 rounded-full leading-none">
                        {badges[id]}
                      </span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 transition-opacity ${activeSection === id ? 'opacity-100' : 'opacity-0'}`} />
                  </span>
                </button>
              ))}
            </nav>

            {/* Save button in sidebar */}
            <button
              onClick={handleSave}
              className={`mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
            </button>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0 space-y-5">

            {/* ════ CREDENTIALS ════ */}
            {activeSection === 'credentials' && (
              <>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Credentials</h2>
                  <p className="text-sm text-gray-500">Tokens are stored in your browser&apos;s local storage only — never sent to any server.</p>
                </div>

                <SectionCard>
                  {/* ADO PAT */}
                  <CardRow>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Key className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Azure DevOps PAT</p>
                          <p className="text-xs text-gray-400">Required for all ADO features</p>
                        </div>
                      </div>
                      <StatusDot ok={!!patToken} />
                    </div>
                    <div className="relative">
                      <input
                        type={showPat ? 'text' : 'password'}
                        value={patToken}
                        onChange={e => setPatToken(e.target.value)}
                        placeholder="Paste your ADO Personal Access Token"
                        className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPat(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Collapsible help */}
                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium list-none flex items-center gap-1 select-none">
                        <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                        How to get your ADO PAT token
                      </summary>
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1.5">
                        <ol className="list-decimal list-inside space-y-1 text-amber-700">
                          <li>Go to{' '}
                            <a href="https://dev.azure.com/vfuk-digital/_usersSettings/tokens" target="_blank" rel="noreferrer"
                              className="underline inline-flex items-center gap-0.5 hover:text-amber-900">
                              ADO → User Settings → Personal Access Tokens <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                          <li>Click <strong>New Token</strong>, set expiry, select <code className="font-mono">vfuk-digital</code></li>
                          <li>Scopes: <code className="font-mono">Code (Read)</code> + <code className="font-mono">Work Items (Read)</code></li>
                          <li>Click <strong>Create</strong> and copy — it won&apos;t be shown again</li>
                        </ol>
                      </div>
                    </details>
                  </CardRow>

                  {/* GitHub PAT */}
                  <CardRow>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Github className="w-4 h-4 text-gray-700" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">GitHub Token</p>
                          <p className="text-xs text-gray-400">Required for Copilot AI features</p>
                        </div>
                      </div>
                      <StatusDot ok={!!githubPat} />
                    </div>
                    <div className="relative">
                      <input
                        type={showGhPat ? 'text' : 'password'}
                        value={githubPat}
                        onChange={e => setGithubPat(e.target.value)}
                        placeholder="gho_… or ghp_…"
                        className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGhPat(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showGhPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium list-none flex items-center gap-1 select-none">
                        <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                        How to get your GitHub token
                      </summary>
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-blue-800">
                          <p className="font-semibold">🏢 Vodafone Enterprise account (recommended)</p>
                          <p className="text-blue-700">Install the GitHub CLI, then run:</p>
                          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                            {[['macOS','brew install gh'],['Windows','Download MSI'],['Linux','see docs']].map(([os, cmd]) => (
                              <div key={os} className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                                <p className="text-[10px] text-blue-500 font-semibold mb-0.5">{os}</p>
                                <code className="font-mono text-blue-900">{cmd}</code>
                              </div>
                            ))}
                          </div>
                          <code className="block bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-blue-900 select-all text-[11px]">
                            gh auth login --hostname github.com --git-protocol https --web
                          </code>
                          <code className="block bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-blue-900 select-all text-[11px]">
                            gh auth token
                          </code>
                          <p className="text-blue-600">Token starts with <strong>gho_</strong></p>
                        </div>
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">
                          <p className="font-semibold">👤 Personal GitHub account</p>
                          <p className="mt-1">Create a Classic PAT at{' '}
                            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer"
                              className="text-blue-500 underline inline-flex items-center gap-0.5">
                              github.com/settings/tokens <ExternalLink className="w-3 h-3" />
                            </a>{' '}
                            with the <code className="font-mono font-semibold">copilot</code> scope. Token starts with <strong>ghp_</strong>.
                          </p>
                        </div>
                      </div>
                    </details>
                  </CardRow>
                </SectionCard>
              </>
            )}

            {/* ════ TEAMS ════ */}
            {activeSection === 'teams' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-1">Teams</h2>
                    <p className="text-sm text-gray-500">ADO teams tracked across all initiatives. Org &amp; project are fixed to <code className="font-mono text-gray-700">vfuk-digital / Digital</code>.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => fetchTeams()}
                      disabled={teamsLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      {teamsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {availableTeams.length > 0 ? `${availableTeams.length} loaded` : 'Load list'}
                    </button>
                    <button
                      onClick={addTeam}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Team
                    </button>
                  </div>
                </div>

                {teamsError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{teamsError}</span>
                  </div>
                )}

                <SectionCard>
                  {teams.length === 0 ? (
                    <CardRow>
                      <div className="text-center py-10">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <Users className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">No teams yet</p>
                        <p className="text-xs text-gray-400 mb-4">Click &quot;Add Team&quot; to pick from your ADO project.</p>
                        <button
                          onClick={addTeam}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition"
                        >
                          <Plus className="w-4 h-4" /> Add Team
                        </button>
                      </div>
                    </CardRow>
                  ) : (
                    <div ref={teamDropdownRef}>
                      {teams.map((team, index) => (
                        <div key={index} className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 last:border-0">
                          {/* index badge */}
                          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>

                          {/* breadcrumb prefix */}
                          <span className="text-xs text-gray-400 font-mono whitespace-nowrap hidden sm:block">
                            vfuk-digital / Digital /
                          </span>

                          {/* dropdown */}
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (openDropdownIndex === index) { setOpenDropdownIndex(null); setTeamSearch(''); }
                                else {
                                  setOpenDropdownIndex(index); setTeamSearch('');
                                  if (!availableTeams.length && !teamsLoading) fetchTeams();
                                }
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                            >
                              <span className={team.team ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                                {team.team || 'Select a team…'}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openDropdownIndex === index ? 'rotate-180' : ''}`} />
                            </button>

                            {openDropdownIndex === index && (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-gray-100">
                                  <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                                    <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <input autoFocus type="text" value={teamSearch}
                                      onChange={e => setTeamSearch(e.target.value)}
                                      placeholder="Search teams…"
                                      className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
                                  </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                  {teamsLoading ? (
                                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                                    </div>
                                  ) : filteredTeams.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-gray-400">
                                      {availableTeams.length === 0 ? 'Click "Load list" to fetch teams.' : 'No match.'}
                                    </p>
                                  ) : filteredTeams.map(name => (
                                    <button key={name} type="button" onClick={() => selectTeam(index, name)}
                                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition ${team.team === name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                                      {name}
                                    </button>
                                  ))}
                                </div>
                                {!teamsLoading && teamSearch && !availableTeams.includes(teamSearch) && (
                                  <div className="border-t border-gray-100 p-2">
                                    <button type="button" onClick={() => selectTeam(index, teamSearch)}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition">
                                      <span className="text-gray-400">Use &quot;</span>
                                      <span className="font-medium text-gray-800">{teamSearch}</span>
                                      <span className="text-gray-400">&quot; as-is</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <button onClick={() => removeTeam(index)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ════ REPOS ════ */}
            {activeSection === 'repos' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-1">Repository Pool</h2>
                    <p className="text-sm text-gray-500">ADO repositories available for selection in AI Productivity Index and PR metric features.</p>
                  </div>
                  <button
                    onClick={() => fetchRepos()}
                    disabled={reposLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 shrink-0"
                  >
                    {reposLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {availableRepos.length > 0 ? `${availableRepos.length} loaded` : 'Load list'}
                  </button>
                </div>

                {reposError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{reposError}</span>
                  </div>
                )}

                <SectionCard>
                  <CardRow>
                    {/* Dropdown */}
                    <Label>Add repository</Label>
                    <div className="relative" ref={repoDropdownRef}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!repoDropdownOpen && !availableRepos.length && !reposLoading) fetchRepos();
                          setRepoDropdownOpen(o => !o);
                          setRepoSearch('');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      >
                        <span className="text-gray-400 flex items-center gap-2">
                          <Search className="w-3.5 h-3.5" />
                          Search and select a repository…
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${repoDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {repoDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <input autoFocus type="text" value={repoSearch}
                                onChange={e => setRepoSearch(e.target.value)}
                                placeholder="Search repositories…"
                                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {reposLoading ? (
                              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                              </div>
                            ) : filteredRepos.length === 0 ? (
                              <p className="py-6 text-center text-sm text-gray-400">
                                {availableRepos.length === 0
                                  ? 'Click "Load list" to fetch repositories.'
                                  : repos.length === availableRepos.length
                                    ? 'All repositories have been added.'
                                    : 'No match.'}
                              </p>
                            ) : filteredRepos.map(name => (
                              <button key={name} type="button" onClick={() => selectRepo(name)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex items-center gap-2">
                                <GitBranch className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                {name}
                              </button>
                            ))}
                          </div>
                          {!reposLoading && repoSearch && !availableRepos.includes(repoSearch) && (
                            <div className="border-t border-gray-100 p-2">
                              <button type="button" onClick={() => selectRepo(repoSearch)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition">
                                <span className="text-gray-400">Use &quot;</span>
                                <span className="font-medium text-gray-800">{repoSearch}</span>
                                <span className="text-gray-400">&quot; as-is</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardRow>

                  {/* Selected repos */}
                  <CardRow>
                    <Label>Selected repositories {repos.length > 0 && <span className="normal-case font-normal text-gray-400">({repos.length})</span>}</Label>
                    {repos.length === 0 ? (
                      <div className="flex items-center gap-3 py-4 text-sm text-gray-400">
                        <GitBranch className="w-5 h-5 text-gray-300" />
                        No repositories added yet.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {repos.map(repo => (
                          <span key={repo}
                            className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-800 text-xs font-medium pl-2.5 pr-1.5 py-1.5 rounded-full">
                            <GitBranch className="w-3 h-3 text-gray-500" />
                            {repo}
                            <button onClick={() => removeRepo(repo)}
                              className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-400 transition">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </CardRow>
                </SectionCard>
              </>
            )}

            {/* ════ ADVANCED ════ */}
            {activeSection === 'advanced' && (
              <>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Advanced</h2>
                  <p className="text-sm text-gray-500">Fine-grained configuration for specific initiatives.</p>
                </div>

                <SectionCard>
                  <CardRow>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">iOS Source Path</p>
                        <p className="text-xs text-gray-400">Used by Story Extractor</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={iosPath}
                      onChange={e => setIosPath(e.target.value)}
                      placeholder="MVA-iOS/VFUK-iOS/Modules"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent transition font-mono"
                    />
                    <Hint>
                      Format: <code className="font-mono">{'{repo}/{path/to/modules}'}</code> — first segment is the repo name, rest is the internal path.
                    </Hint>
                    <div className="mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-500 leading-relaxed">
                      <span className="text-gray-400">Repo: </span>
                      <span>https://dev.azure.com/vfuk-digital/Digital/_git/</span>
                      <span className="font-semibold text-gray-700">{iosPath.split('/')[0] || 'MVA-iOS'}</span>
                      <br />
                      <span className="text-gray-400">Path: </span>
                      <span className="text-gray-700">/{iosPath || 'MVA-iOS/VFUK-iOS/Modules'}</span>
                    </div>
                  </CardRow>
                </SectionCard>
              </>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
