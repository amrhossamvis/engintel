'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bug,
  BarChart3,
  Brain,
  BookOpen,
  GitPullRequest,
  LayoutDashboard,
  Shield,
  TestTube2,
  Network,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Settings,
  Zap,
  Layers,
  Flame,
  Rocket,
  Wrench,
  ScanSearch,
  FlaskConical,
  UserCheck,
  Smartphone,
  LogOut,
  CheckCircle2,
  MessageSquare,
  Lightbulb,
} from 'lucide-react';
import { APP_THEMES } from '@/lib/app-config';

type Initiative = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'active' | 'coming-soon';
  category: string;
  quarter?: string;
};

type CategoryGroup = {
  id: string;
  label: string;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
  emoji: string;
  initiatives: Initiative[];
};

// ─────────────────────────────────────────────────────────────────────────────
// ALL INITIATIVES
// ─────────────────────────────────────────────────────────────────────────────

const allInitiatives: Initiative[] = [

  // ── Mobile Guild ──────────────────────────────────────────────────────────
  {
    id: 'bug-analyzer',
    title: 'Bug Analyzer',
    shortTitle: 'Bug Analyzer',
    description: 'AI classifies every ADO bug by type, severity, and mobile platform. Traces each bug to the originating commit and generates structured RCA automatically.',
    icon: <Bug className="w-6 h-6" />,
    href: '/bug-analyzer',
    status: 'active',
    category: 'Mobile Guild',
  },
  {
    id: 'mobile-crash',
    title: 'Mobile Crash Intelligence',
    shortTitle: 'Crash Intelligence',
    description: 'Firebase Crashlytics → AI crash pattern analysis. Groups crashes by platform, OS version, and device model. Correlates with commits and generates incident reports.',
    icon: <Flame className="w-6 h-6" />,
    href: '/mobile-crash',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q2 2026',
  },
  {
    id: 'mobile-release',
    title: 'App Store Release Risk Scorer',
    shortTitle: 'Release Risk Scorer',
    description: 'AI-powered Go/No-Go for iOS App Store & Google Play submissions. Evaluates Fastlane results, crash rates, open bugs, and code churn into a 0–100 readiness score.',
    icon: <Rocket className="w-6 h-6" />,
    href: '/mobile-release',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q2 2026',
  },
  {
    id: 'mobile-cicd',
    title: 'Mobile CI/CD Intelligence',
    shortTitle: 'CI/CD Intelligence',
    description: 'AI monitoring for Fastlane, GitHub Actions, and Azure Pipelines. Detects flaky tests, diagnoses build failures, and generates weekly pipeline health reports.',
    icon: <Wrench className="w-6 h-6" />,
    href: '/mobile-cicd',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q3 2026',
  },
  {
    id: 'mobile-review',
    title: 'Mobile Code Review Assistant',
    shortTitle: 'Code Review Assistant',
    description: 'AI first-pass review for Swift, Kotlin, and React Native PRs. Flags force-unwraps, ARC issues, coroutine scope leaks, ANR-prone patterns, and bridge performance problems.',
    icon: <ScanSearch className="w-6 h-6" />,
    href: '/mobile-review',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q3 2026',
  },
  {
    id: 'mobile-test-gap',
    title: 'Mobile Test Gap Analyzer',
    shortTitle: 'Mobile Test Gaps',
    description: 'AI identifies untested UI flows across XCTest, Espresso, and Detox. Prioritizes gaps by production crash history and generates test case suggestions.',
    icon: <FlaskConical className="w-6 h-6" />,
    href: '/mobile-test-gap',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q3 2026',
  },
  {
    id: 'mobile-onboarding',
    title: 'Mobile Onboarding Accelerator',
    shortTitle: 'Mobile Onboarding',
    description: 'AI-guided onboarding for iOS, Android, and React Native engineers. RAG over internal docs, Fastlane lanes, and architecture decisions. Days to first PR.',
    icon: <UserCheck className="w-6 h-6" />,
    href: '/mobile-onboarding',
    status: 'coming-soon',
    category: 'Mobile Guild',
    quarter: 'Q4 2026',
  },

  // ── Delivery Excellence ───────────────────────────────────────────────────
  {
    id: 'exec-dashboard',
    title: 'Executive Engineering Dashboard',
    shortTitle: 'Exec Dashboard',
    description: 'Real-time engineering health visibility for leadership — RAG status, delivery trends, quality metrics, and AI-generated executive summaries on demand.',
    icon: <LayoutDashboard className="w-6 h-6" />,
    href: '/exec-dashboard',
    status: 'active',
    category: 'Delivery Excellence',
  },
  {
    id: 'delivery-intel',
    title: 'Delivery Intelligence Platform',
    shortTitle: 'Delivery Intel',
    description: 'Automated sprint health scoring, velocity tracking, risk prediction, and executive-ready delivery reports. Eliminates 80% of manual reporting effort.',
    icon: <BarChart3 className="w-6 h-6" />,
    href: '/delivery-intel',
    status: 'coming-soon',
    category: 'Delivery Excellence',
    quarter: 'Q2 2026',
  },
  {
    id: 'release-scorer',
    title: 'Release Risk Scorer',
    shortTitle: 'Release Scorer',
    description: 'Data-driven release readiness scores before every deployment. Evaluates test results, code churn, open bugs, and historical patterns to prevent production incidents.',
    icon: <Shield className="w-6 h-6" />,
    href: '/release-scorer',
    status: 'coming-soon',
    category: 'Delivery Excellence',
    quarter: 'Q3 2026',
  },
  {
    id: 'dependency-radar',
    title: 'Dependency & Blocker Radar',
    shortTitle: 'Dependency Radar',
    description: 'Auto-detect cross-team dependencies and predict blockers before they cause delivery delays. Visual dependency graph with escalation alerts.',
    icon: <Network className="w-6 h-6" />,
    href: '/dependency-radar',
    status: 'coming-soon',
    category: 'Delivery Excellence',
    quarter: 'Q3 2026',
  },

  // ── Quality & Testing ─────────────────────────────────────────────────────
  {
    id: 'quality-predictor',
    title: 'Sprint Quality Predictor',
    shortTitle: 'Quality Predictor',
    description: 'Predict sprint quality risk before testing begins using code churn, complexity, and historical defect patterns. Shift left on quality.',
    icon: <TestTube2 className="w-6 h-6" />,
    href: '/quality-predictor',
    status: 'coming-soon',
    category: 'Quality & Testing',
    quarter: 'Q2 2026',
  },
  {
    id: 'test-gap',
    title: 'Test Gap Analyzer',
    shortTitle: 'Test Gap Analyzer',
    description: 'Identify highest-value testing gaps by combining code complexity, defect history, and change frequency. Ranked by production incident risk.',
    icon: <TestTube2 className="w-6 h-6" />,
    href: '/test-gap',
    status: 'coming-soon',
    category: 'Quality & Testing',
    quarter: 'Q3 2026',
  },

  // ── Engineering Productivity ──────────────────────────────────────────────
  {
    id: 'story-extractor',
    title: 'Story Extractor',
    shortTitle: 'Story Extractor',
    description: 'AI reverse-engineers iOS source code into structured Agile user stories with acceptance criteria. Days of backlog work → minutes.',
    icon: <Layers className="w-6 h-6" />,
    href: '/story-extractor',
    status: 'active',
    category: 'Engineering Productivity',
  },
  {
    id: 'pr-review',
    title: 'PR Review Intelligence',
    shortTitle: 'PR Review',
    description: 'Automated first-pass PR analysis with risk scoring, standards compliance checking, and stale PR alerts. Reduces review cycle time by 35%.',
    icon: <GitPullRequest className="w-6 h-6" />,
    href: '/pr-review',
    status: 'coming-soon',
    category: 'Engineering Productivity',
    quarter: 'Q2 2026',
  },
  {
    id: 'onboarding',
    title: 'Developer Onboarding Accelerator',
    shortTitle: 'Onboarding',
    description: 'AI-assisted onboarding with personalized learning paths, codebase orientation, and contextual Q&A. Reduces time-to-productivity from 3 months to 6 weeks.',
    icon: <GraduationCap className="w-6 h-6" />,
    href: '/onboarding',
    status: 'coming-soon',
    category: 'Engineering Productivity',
    quarter: 'Q4 2026',
  },

  // ── Platform & Community ─────────────────────────────────────────────────
  {
    id: 'feedback',
    title: 'Feedback Dashboard',
    shortTitle: 'Feedback',
    description: 'Rate every tool, report bugs, request features, and share praise — directly from within the app. Structured feedback with satisfaction scores and trend tracking.',
    icon: <MessageSquare className="w-6 h-6" />,
    href: '/feedback',
    status: 'active',
    category: 'Platform & Community',
  },
  {
    id: 'idea-box',
    title: 'Idea Box',
    shortTitle: 'Idea Box',
    description: 'Submit tool ideas, vote on what matters most, and watch them move from concept to shipped. Community-owned backlog with status tracking and comments.',
    icon: <Lightbulb className="w-6 h-6" />,
    href: '/idea-box',
    status: 'active',
    category: 'Platform & Community',
  },
  {
    id: 'playground',
    title: 'AI Playground',
    shortTitle: 'AI Playground',
    description: 'Explore GitHub Copilot CLI and Azure OpenAI with pre-built prompt templates. Experiment, learn, and prototype new AI workflows in a safe sandbox.',
    icon: <FlaskConical className="w-6 h-6" />,
    href: '/playground',
    status: 'active',
    category: 'Platform & Community',
  },

  // ── AI Value & Knowledge ──────────────────────────────────────────────────
  {
    id: 'ai-productivity',
    title: 'AI Productivity Index',
    shortTitle: 'AI Productivity',
    description: 'Measure and prove AI ROI by correlating Copilot usage with engineering outcomes — PR throughput, cycle time, defect rate, and velocity.',
    icon: <Brain className="w-6 h-6" />,
    href: '/ai-productivity',
    status: 'active',
    category: 'AI Value & Knowledge',
  },
  {
    id: 'knowledge-copilot',
    title: 'Engineering Knowledge Copilot',
    shortTitle: 'Knowledge Copilot',
    description: 'AI assistant that answers engineering questions from your internal docs, code, and architecture decisions. 500+ daily queries, 85% satisfaction rate.',
    icon: <BookOpen className="w-6 h-6" />,
    href: '/knowledge-copilot',
    status: 'coming-soon',
    category: 'AI Value & Knowledge',
    quarter: 'Q3 2026',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY GROUPS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_GROUPS: Omit<CategoryGroup, 'initiatives'>[] = [
  {
    id: 'mobile',
    label: 'Mobile Guild',
    description: 'AI tools built exclusively for iOS, Android, and React Native engineers — covering crashes, releases, CI/CD, code review, testing, and onboarding.',
    color: 'text-violet-700',
    borderColor: 'border-violet-200',
    bgColor: 'bg-violet-50',
    emoji: '📱',
  },
  {
    id: 'delivery',
    label: 'Delivery Excellence',
    description: 'Real-time delivery intelligence, sprint health scoring, release risk assessment, and dependency tracking for engineering leaders.',
    color: 'text-blue-700',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
    emoji: '🚀',
  },
  {
    id: 'quality',
    label: 'Quality & Testing',
    description: 'Predictive quality scoring, test gap identification, and defect pattern analysis to shift quality left.',
    color: 'text-amber-700',
    borderColor: 'border-amber-200',
    bgColor: 'bg-amber-50',
    emoji: '🧪',
  },
  {
    id: 'productivity',
    label: 'Engineering Productivity',
    description: 'Story generation, PR review automation, and onboarding acceleration to free engineers for high-value work.',
    color: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    bgColor: 'bg-emerald-50',
    emoji: '⚡',
  },
  {
    id: 'ai-value',
    label: 'AI Value & Knowledge',
    description: 'Measure AI ROI with data and surface institutional knowledge through intelligent Q&A.',
    color: 'text-fuchsia-700',
    borderColor: 'border-fuchsia-200',
    bgColor: 'bg-fuchsia-50',
    emoji: '🧠',
  },
];

function buildGroups(): CategoryGroup[] {
  return CATEGORY_GROUPS.map(group => ({
    ...group,
    // Only include coming-soon tools in the category sections
    initiatives: allInitiatives.filter(
      i => i.category === group.label && i.status === 'coming-soon'
    ),
  })).filter(g => g.initiatives.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, quarter }: { status: string; quarter?: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      {quarter ?? 'Coming Soon'}
    </span>
  );
}

function LiveCard({ initiative }: { initiative: Initiative }) {
  const theme = APP_THEMES[initiative.href];

  return (
    <Link
      href={initiative.href}
      className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-2xl hover:shadow-gray-100 hover:-translate-y-1 cursor-pointer"
    >
      {/* Top gradient accent — thicker for live cards */}
      <div className={`h-1.5 bg-gradient-to-r ${theme?.gradient ?? 'from-gray-400 to-gray-600'}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme?.iconBg ?? 'bg-gray-100 text-gray-600'}`}>
            {initiative.icon}
          </div>
          <StatusBadge status={initiative.status} />
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold mb-2 text-gray-900 group-hover:text-gray-700 transition-colors leading-snug">
          {initiative.shortTitle}
        </h3>
        <p className="text-sm leading-relaxed mb-4 text-gray-500">
          {initiative.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-emerald-100">
          <span className="text-xs font-medium text-gray-400">
            {initiative.category}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all bg-gradient-to-r ${theme?.gradient ?? 'from-gray-500 to-gray-700'} bg-clip-text text-transparent`}>
            Launch <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function InitiativeCard({ initiative }: { initiative: Initiative }) {
  const theme = APP_THEMES[initiative.href];

  return (
    <Link
      href={initiative.href}
      className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Top gradient accent */}
      <div className={`h-1 bg-gradient-to-r ${theme?.gradient ?? 'from-gray-400 to-gray-600'}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme?.iconBg ?? 'bg-gray-100 text-gray-600'}`}>
            {initiative.icon}
          </div>
          <StatusBadge status={initiative.status} quarter={initiative.quarter} />
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold mb-2 text-gray-900 group-hover:text-gray-700 transition-colors leading-snug">
          {initiative.shortTitle}
        </h3>
        <p className="text-sm leading-relaxed mb-4 text-gray-500">
          {initiative.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400">
            {initiative.category}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all bg-gradient-to-r ${theme?.gradient ?? 'from-gray-500 to-gray-700'} bg-clip-text text-transparent`}>
            Preview <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CategorySection({ group }: { group: CategoryGroup }) {
  return (
    <section className="mb-12">
      {/* Category header */}
      <div className={`flex items-start gap-4 mb-6 p-4 rounded-2xl border ${group.borderColor} ${group.bgColor}`}>
        <div className="text-3xl leading-none mt-0.5">{group.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className={`text-lg font-bold ${group.color}`}>{group.label}</h2>
            <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
              {group.initiatives.length} upcoming
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{group.description}</p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {group.initiatives.map(initiative => (
          <InitiativeCard key={initiative.id} initiative={initiative} />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HubPage() {
  const router = useRouter();
  const groups = buildGroups();
  const liveInitiatives = allInitiatives.filter(i => i.status === 'active');
  const activeCount = liveInitiatives.length;
  const totalCount = allInitiatives.length;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-red-500 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative container mx-auto px-6 py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Engineering Intelligence Hub</h1>
                  <p className="text-sm text-white/60">AI-Powered Engineering Ecosystem</p>
                </div>
              </div>
              <p className="text-lg text-white/80 leading-relaxed mb-6">
                A unified platform of AI-powered tools for mobile engineering, delivery excellence,
                quality prediction, productivity, and AI value measurement.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-white/70">
                    <span className="text-white font-semibold">{activeCount}</span> live &nbsp;/&nbsp; <span className="text-white font-semibold">{totalCount}</span> total initiatives
                  </span>
                </div>
                <div className="h-4 w-px bg-white/20 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-violet-400" />
                  <span className="text-white/60">iOS · Android · React Native · Fastlane</span>
                </div>
                <div className="h-4 w-px bg-white/20 hidden sm:block" />
                <span className="text-white/60">Azure DevOps · GitHub Copilot CLI · Azure OpenAI</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all duration-200"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-5 py-3 text-sm font-medium text-white hover:bg-red-500/20 hover:border-red-400/40 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="container mx-auto px-6 py-12">

        {/* ── LIVE NOW SECTION ── */}
        <section className="mb-16">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-emerald-700">Live Now</h2>
              <span className="inline-flex items-center gap-1 ml-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeCount} tools
              </span>
            </div>
            <div className="flex-1 h-px bg-emerald-100" />
          </div>

          {/* Live cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {liveInitiatives.map(initiative => (
              <LiveCard key={initiative.id} initiative={initiative} />
            ))}
          </div>
        </section>

        {/* ── DIVIDER ── */}
        <div className="flex items-center gap-4 mb-12">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-3">Roadmap</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── Quick category nav ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-12">
          {CATEGORY_GROUPS.map(group => {
            const pending = allInitiatives.filter(
              i => i.category === group.label && i.status === 'coming-soon'
            ).length;
            if (pending === 0) return null;
            return (
              <a
                key={group.id}
                href={`#${group.id}`}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border ${group.borderColor} ${group.bgColor} hover:shadow-sm transition-all text-center cursor-pointer`}
              >
                <span className="text-xl">{group.emoji}</span>
                <span className={`text-xs font-bold ${group.color} leading-tight`}>{group.label}</span>
                <span className="text-xs text-gray-400">{pending} upcoming</span>
              </a>
            );
          })}
        </div>

        {/* ── Category sections (pending only) ── */}
        {groups.map(group => (
          <div key={group.id} id={group.id}>
            <CategorySection group={group} />
          </div>
        ))}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Engineering Intelligence Hub</span>
            </div>
            <p className="text-xs text-gray-400">
              Built with Next.js · TypeScript · Azure DevOps API · GitHub Copilot CLI · Azure OpenAI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
