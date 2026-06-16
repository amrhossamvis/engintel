'use client';

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Key, Save, CheckCircle, Plus, Trash2, Settings, Users, GitBranch, Layers, Github } from 'lucide-react';

export type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

export default function GlobalSettingsPage() {
  const [patToken, setPatToken] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [iosPath, setIosPath] = useState('');
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [newRepo, setNewRepo] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('ado_pat_token') || '';
    const savedGithubPat = localStorage.getItem('github_pat_token') || '';
    const savedIosPath = localStorage.getItem('story_ios_path') || 'MVA-iOS/VFUK-iOS/Modules';
    const savedTeams = localStorage.getItem('ado_teams');
    const savedRepos = localStorage.getItem('ado_repos');
    setPatToken(savedToken);
    setGithubPat(savedGithubPat);
    setIosPath(savedIosPath);
    if (savedTeams) {
      try { setTeams(JSON.parse(savedTeams)); } catch { /* ignore */ }
    }
    if (savedRepos) {
      try { setRepos(JSON.parse(savedRepos)); } catch { /* ignore */ }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('ado_pat_token', patToken);
    localStorage.setItem('github_pat_token', githubPat);
    localStorage.setItem('story_ios_path', iosPath);
    localStorage.setItem('ado_teams', JSON.stringify(teams));
    localStorage.setItem('ado_repos', JSON.stringify(repos));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const addTeam = () => {
    setTeams([...teams, { organization: 'vfuk-digital', project: 'Digital', team: '' }]);
  };
  const updateTeam = (index: number, field: keyof TeamConfig, value: string) => {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    setTeams(updated);
  };
  const removeTeam = (index: number) => setTeams(teams.filter((_, i) => i !== index));

  const addRepo = () => {
    const trimmed = newRepo.trim();
    if (trimmed && !repos.includes(trimmed)) {
      setRepos([...repos, trimmed]);
      setNewRepo('');
    }
  };
  const removeRepo = (repo: string) => setRepos(repos.filter(r => r !== repo));
  const handleRepoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addRepo(); }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AppHeader
        title="Global Settings"
        subtitle="Configure credentials, teams, and repositories shared across all initiatives"
        icon={<Settings className="w-5 h-5 text-white" />}
        gradient="bg-gray-900"
      />

      <main className="container mx-auto px-6 py-12 max-w-3xl space-y-8">

        {/* PAT Token */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Azure DevOps PAT Token</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Used by all initiatives that connect to Azure DevOps. Stored in your browser&apos;s local storage only.
          </p>
          <input
            type="password"
            value={patToken}
            onChange={(e) => setPatToken(e.target.value)}
            placeholder="Enter your Azure DevOps Personal Access Token"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
            <p className="font-semibold">🔑 How to get your ADO PAT token</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-700">
              <li>Go to <a href="https://dev.azure.com/vfuk-digital/_usersSettings/tokens" target="_blank" rel="noreferrer" className="underline hover:text-amber-900">dev.azure.com/vfuk-digital → User Settings → Personal Access Tokens</a></li>
              <li>Click <span className="font-semibold">New Token</span></li>
              <li>Set expiry, select <span className="font-semibold">vfuk-digital</span> organization</li>
              <li>Under <span className="font-semibold">Scopes</span>, select: <span className="font-mono">Code (Read)</span> and <span className="font-mono">Work Items (Read)</span></li>
              <li>Click <span className="font-semibold">Create</span> and copy the token — it won&apos;t be shown again</li>
            </ol>
          </div>
        </div>

        {/* GitHub Token */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Github className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">GitHub Token <span className="text-sm font-normal text-gray-500">(Copilot AI features)</span></h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Your personal GitHub token for Copilot API. Each user must provide their own token — AI usage is billed against your individual Copilot quota.
          </p>
          <input
            type="password"
            value={githubPat}
            onChange={(e) => setGithubPat(e.target.value)}
            placeholder="gho_  or  ghp_  token"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
          />
          <div className="mt-3 space-y-2 text-xs text-gray-500">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <p className="font-semibold text-blue-800">🏢 Vodafone Enterprise account (recommended)</p>
              <p className="text-blue-700">Don&apos;t have <span className="font-mono font-semibold">gh</span> installed? Install it first:</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-blue-500 font-semibold mb-0.5">macOS</p>
                  <code className="font-mono text-blue-900 text-[11px] select-all">brew install gh</code>
                </div>
                <div className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-blue-500 font-semibold mb-0.5">Windows</p>
                  <a href="https://github.com/cli/cli/releases/latest" target="_blank" rel="noreferrer" className="font-mono text-blue-600 text-[11px] underline">Download MSI</a>
                </div>
                <div className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-[10px] text-blue-500 font-semibold mb-0.5">Linux</p>
                  <a href="https://github.com/cli/cli/blob/trunk/docs/install_linux.md" target="_blank" rel="noreferrer" className="font-mono text-blue-600 text-[11px] underline">see docs</a>
                </div>
              </div>
              <p className="text-blue-600 text-[11px]">💡 <span className="font-semibold">Windows corporate laptop?</span> Download the <a href="https://github.com/cli/cli/releases/latest" target="_blank" rel="noreferrer" className="underline">gh MSI installer</a> from GitHub releases — no admin rights or package manager needed. Or use <code className="font-mono">scoop install gh</code> if Scoop is available.</p>
              <p>Then authenticate and get your token:</p>
              <code className="block bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-blue-900 select-all">
                gh auth login --hostname github.com --git-protocol https --web
              </code>
              <code className="block bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-blue-900 select-all">
                gh auth token
              </code>
              <p className="text-blue-600">The token starts with <span className="font-mono font-bold">gho_</span> — paste it above.</p>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="font-semibold text-gray-700">👤 Personal GitHub account</p>
              <p className="mt-1">Create a Classic PAT at{' '}
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer"
                  className="text-blue-500 underline hover:text-blue-700">github.com/settings/tokens</a>{' '}
                with the <span className="font-mono font-semibold text-gray-700">copilot</span> scope. Token starts with <span className="font-mono font-bold">ghp_</span>.
              </p>
            </div>
          </div>
        </div>

        {/* iOS Source Path */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">iOS Source Path <span className="text-sm font-normal text-gray-500">(Story Extractor)</span></h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Path to the iOS modules directory inside the Azure DevOps repository. Format:{' '}
            <span className="font-mono text-gray-800">{'{repo}/{internal/path/to/modules}'}</span>
            <br />
            <span className="text-xs text-gray-400">The first segment is the repository name; the rest is the path inside that repo.</span>
          </p>
          <input
            type="text"
            value={iosPath}
            onChange={(e) => setIosPath(e.target.value)}
            placeholder="MVA-iOS/VFUK-iOS/Modules"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e60000] focus:border-transparent transition font-mono text-sm"
          />
          <p className="text-xs text-gray-400 mt-2">
            Repo:{' '}
            <span className="font-mono">https://dev.azure.com/vfuk-digital/Digital/_git/</span>
            <span className="font-mono font-semibold text-gray-600">{iosPath.split('/')[0] || 'MVA-iOS'}</span>
            {'  '}·{'  '}Scope path:{' '}
            <span className="font-mono text-gray-600">/{iosPath || 'MVA-iOS/VFUK-iOS/Modules'}</span>
          </p>
        </div>

        {/* Teams */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
            </div>
            <button onClick={addTeam}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition">
              <Plus className="w-4 h-4" /> Add Team
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-2">ADO teams to track across all initiatives.</p>
          <p className="text-xs text-gray-400 mb-6">
            Organization: <span className="font-mono font-medium text-gray-600">vfuk-digital</span> &nbsp;|&nbsp;
            Project: <span className="font-mono font-medium text-gray-600">Digital</span> &nbsp;(fixed)
          </p>

          {teams.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No teams configured yet. Click &quot;Add Team&quot; to get started.</p>
            </div>
          )}

          <div className="space-y-3">
            {teams.map((team, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-400 font-mono whitespace-nowrap">vfuk-digital / Digital /</span>
                <input
                  type="text"
                  value={team.team}
                  onChange={(e) => updateTeam(index, 'team', e.target.value)}
                  placeholder="Team name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button onClick={() => removeTeam(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Repos pool */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <GitBranch className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Repository Pool</h2>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            Add all ADO repositories your teams work on. These will be available for selection in the AI Productivity Index
            and other initiatives that track PR metrics.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Example: <span className="font-mono text-gray-600">MVA-iOS</span>, <span className="font-mono text-gray-600">MVA-Android</span>, <span className="font-mono text-gray-600">mvax-api</span>
          </p>

          {/* Add repo input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newRepo}
              onChange={e => setNewRepo(e.target.value)}
              onKeyDown={handleRepoKeyDown}
              placeholder="Repository name (e.g. MVA-iOS)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addRepo}
              disabled={!newRepo.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {repos.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No repositories added yet.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {repos.map(repo => (
                <div key={repo} className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-800 text-sm font-medium px-3 py-1.5 rounded-full">
                  <GitBranch className="w-3 h-3 text-gray-500" />
                  {repo}
                  <button onClick={() => removeRepo(repo)} className="ml-1 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition">
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save All Settings</>}
          </button>
        </div>
      </main>
    </div>
  );
}
