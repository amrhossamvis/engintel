'use client';

import Link from 'next/link';
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
};

const initiatives: Initiative[] = [
  {
    id: 'story-extractor',
    title: 'Story Extractor',
    shortTitle: 'Story Extractor',
    description: 'AI-powered reverse engineering of iOS source code into structured Agile user stories with acceptance criteria, powered by Claude Sonnet via GitHub Copilot.',
    icon: <Layers className="w-6 h-6" />,
    href: '/story-extractor',
    status: 'active',
    category: 'Agile & Backlog',
  },
  {
    id: 'bug-analyzer',
    title: 'Bug Analyzer',
    shortTitle: 'Bug Analyzer',
    description: 'AI-powered bug classification, regression detection, and automated RCA generation from Azure DevOps.',
    icon: <Bug className="w-6 h-6" />,
    href: '/bug-analyzer',
    status: 'active',
    category: 'Quality & Testing',
  },
  {
    id: 'exec-dashboard',
    title: 'Executive Engineering Dashboard',
    shortTitle: 'Exec Dashboard',
    description: 'Real-time engineering health visibility for leadership — delivery, quality, and AI adoption metrics.',
    icon: <LayoutDashboard className="w-6 h-6" />,
    href: '/exec-dashboard',
    status: 'active',
    category: 'Leadership Intelligence',
  },
  {
    id: 'ai-productivity',
    title: 'AI Productivity Index',
    shortTitle: 'AI Productivity',
    description: 'Measure and prove AI ROI by correlating Copilot usage with engineering productivity outcomes.',
    icon: <Brain className="w-6 h-6" />,
    href: '/ai-productivity',
    status: 'active',
    category: 'AI Value Measurement',
  },
  {
    id: 'delivery-intel',
    title: 'Delivery Intelligence Platform',
    shortTitle: 'Delivery Intel',
    description: 'Automated sprint health scoring, velocity tracking, and executive-ready delivery reports.',
    icon: <BarChart3 className="w-6 h-6" />,
    href: '/delivery-intel',
    status: 'coming-soon',
    category: 'Delivery Excellence',
  },
  {
    id: 'pr-review',
    title: 'PR Review Intelligence',
    shortTitle: 'PR Review',
    description: 'Automated first-pass PR analysis with risk scoring, standards compliance, and stale PR alerts.',
    icon: <GitPullRequest className="w-6 h-6" />,
    href: '/pr-review',
    status: 'coming-soon',
    category: 'Engineering Productivity',
  },
  {
    id: 'quality-predictor',
    title: 'Sprint Quality Predictor',
    shortTitle: 'Quality Predictor',
    description: 'Predict sprint quality risk before testing begins using code churn, complexity, and defect patterns.',
    icon: <TestTube2 className="w-6 h-6" />,
    href: '/quality-predictor',
    status: 'coming-soon',
    category: 'Quality & Testing',
  },
  {
    id: 'release-scorer',
    title: 'Release Risk Scorer',
    shortTitle: 'Release Scorer',
    description: 'Data-driven release readiness scores before every deployment to prevent production incidents.',
    icon: <Shield className="w-6 h-6" />,
    href: '/release-scorer',
    status: 'coming-soon',
    category: 'Delivery Excellence',
  },
  {
    id: 'dependency-radar',
    title: 'Dependency & Blocker Radar',
    shortTitle: 'Dependency Radar',
    description: 'Auto-detect cross-team dependencies and predict blockers before they cause delivery delays.',
    icon: <Network className="w-6 h-6" />,
    href: '/dependency-radar',
    status: 'coming-soon',
    category: 'Delivery Excellence',
  },
  {
    id: 'test-gap',
    title: 'Test Gap Analyzer',
    shortTitle: 'Test Gaps',
    description: 'Identify highest-value testing gaps by combining complexity, defect history, and change frequency.',
    icon: <TestTube2 className="w-6 h-6" />,
    href: '/test-gap',
    status: 'coming-soon',
    category: 'Quality & Testing',
  },
  {
    id: 'knowledge-copilot',
    title: 'Engineering Knowledge Copilot',
    shortTitle: 'Knowledge Copilot',
    description: 'AI assistant that answers engineering questions from your docs, code, and architecture decisions.',
    icon: <BookOpen className="w-6 h-6" />,
    href: '/knowledge-copilot',
    status: 'coming-soon',
    category: 'Knowledge Management',
  },
  {
    id: 'onboarding',
    title: 'Developer Onboarding Accelerator',
    shortTitle: 'Onboarding',
    description: 'AI-assisted onboarding with personalized learning paths, codebase orientation, and contextual Q&A.',
    icon: <GraduationCap className="w-6 h-6" />,
    href: '/onboarding',
    status: 'coming-soon',
    category: 'Engineering Productivity',
  },
];

function StatusBadge({ status }: { status: string }) {
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
      Coming Soon
    </span>
  );
}

export default function HubPage() {
  const activeCount = initiatives.filter(i => i.status === 'active').length;
  const totalCount = initiatives.length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
        {/* Animated background elements */}
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
                A unified platform of AI-powered tools for delivery excellence, quality prediction, 
                productivity measurement, and engineering knowledge management.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-white/70">
                    <span className="text-white font-semibold">{activeCount}</span> active / <span className="text-white font-semibold">{totalCount}</span> initiatives
                  </span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <span className="text-white/60">Powered by Azure DevOps + GitHub Copilot CLI</span>
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
            </div>
          </div>
        </div>
      </header>

      {/* Initiative Grid */}
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Initiatives</h2>
          <p className="text-sm text-gray-500 mt-1">Click on active tools to launch them. Others are in development.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {initiatives.map((initiative) => {
            const isActive = initiative.status === 'active';
            const theme = APP_THEMES[initiative.href];

            return (
              <Link
                key={initiative.id}
                href={initiative.href}
                className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
              >
                {/* Top gradient accent — sourced from APP_THEMES */}
                <div className={`h-1 bg-gradient-to-r ${theme?.gradient}`} />

                <div className="p-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme?.iconBg}`}>
                      {initiative.icon}
                    </div>
                    <StatusBadge status={initiative.status} />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 group-hover:text-gray-700 transition-colors">
                    {initiative.shortTitle}
                  </h3>
                  <p className="text-sm leading-relaxed mb-4 text-gray-600">
                    {initiative.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      {initiative.category}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all bg-gradient-to-r ${theme?.gradient} bg-clip-text text-transparent`}>
                      {isActive ? 'Launch' : 'View'} <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer */}
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
              Built with Next.js, TypeScript, Azure DevOps API & GitHub Copilot CLI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
