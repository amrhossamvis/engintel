/**
 * Central registry for all app gradient themes.
 *
 * This is the SINGLE source of truth for colors.
 * - The hub page (page.tsx) uses `gradient` for the thin card accent line (bg-gradient-to-r)
 * - AppHeader uses `headerGradient` for the full app header background (bg-gradient-to-br)
 *
 * To change an app's color: edit it here only.
 */

export type AppTheme = {
  /** Color stops used for the hub card accent line and gradient text (no direction prefix) */
  gradient: string;
  /** Full Tailwind gradient class used for the AppHeader background */
  headerGradient: string;
  /** Icon background color class used on the hub card */
  iconBg: string;
};

export const APP_THEMES: Record<string, AppTheme> = {
  '/story-extractor': {
    gradient:       'from-violet-600 via-purple-600 to-indigo-700',
    headerGradient: 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700',
    iconBg:         'bg-violet-100 text-violet-700',
  },
  '/bug-analyzer': {
    gradient:       'from-rose-500 via-red-500 to-orange-600',
    headerGradient: 'bg-gradient-to-br from-rose-500 via-red-500 to-orange-600',
    iconBg:         'bg-rose-100 text-rose-600',
  },
  '/exec-dashboard': {
    gradient:       'from-slate-700 via-slate-600 to-gray-700',
    headerGradient: 'bg-gradient-to-br from-slate-700 via-slate-600 to-gray-700',
    iconBg:         'bg-slate-100 text-slate-600',
  },
  '/ai-productivity': {
    gradient:       'from-fuchsia-600 via-pink-600 to-rose-600',
    headerGradient: 'bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600',
    iconBg:         'bg-fuchsia-100 text-fuchsia-600',
  },
  '/delivery-intel': {
    gradient:       'from-blue-600 via-blue-500 to-cyan-600',
    headerGradient: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-600',
    iconBg:         'bg-blue-100 text-blue-600',
  },
  '/pr-review': {
    gradient:       'from-cyan-600 via-teal-500 to-emerald-600',
    headerGradient: 'bg-gradient-to-br from-cyan-600 via-teal-500 to-emerald-600',
    iconBg:         'bg-cyan-100 text-cyan-600',
  },
  '/quality-predictor': {
    gradient:       'from-amber-500 via-orange-500 to-yellow-600',
    headerGradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600',
    iconBg:         'bg-amber-100 text-amber-600',
  },
  '/release-scorer': {
    gradient:       'from-pink-600 via-rose-500 to-red-600',
    headerGradient: 'bg-gradient-to-br from-pink-600 via-rose-500 to-red-600',
    iconBg:         'bg-pink-100 text-pink-600',
  },
  '/dependency-radar': {
    gradient:       'from-indigo-600 via-blue-600 to-violet-700',
    headerGradient: 'bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-700',
    iconBg:         'bg-indigo-100 text-indigo-600',
  },
  '/test-gap': {
    gradient:       'from-green-600 via-emerald-500 to-teal-600',
    headerGradient: 'bg-gradient-to-br from-green-600 via-emerald-500 to-teal-600',
    iconBg:         'bg-green-100 text-green-600',
  },
  '/knowledge-copilot': {
    gradient:       'from-teal-600 via-cyan-600 to-sky-700',
    headerGradient: 'bg-gradient-to-br from-teal-600 via-cyan-600 to-sky-700',
    iconBg:         'bg-teal-100 text-teal-600',
  },
  '/onboarding': {
    gradient:       'from-purple-600 via-fuchsia-600 to-pink-700',
    headerGradient: 'bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-700',
    iconBg:         'bg-purple-100 text-purple-600',
  },

  // ── Mobile Guild Specific ──────────────────────────────────────────────────
  '/mobile-crash': {
    gradient:       'from-red-600 via-rose-600 to-pink-700',
    headerGradient: 'bg-gradient-to-br from-red-600 via-rose-600 to-pink-700',
    iconBg:         'bg-red-100 text-red-600',
  },
  '/mobile-release': {
    gradient:       'from-violet-600 via-purple-600 to-indigo-700',
    headerGradient: 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700',
    iconBg:         'bg-violet-100 text-violet-700',
  },
  '/mobile-cicd': {
    gradient:       'from-sky-600 via-cyan-500 to-blue-700',
    headerGradient: 'bg-gradient-to-br from-sky-600 via-cyan-500 to-blue-700',
    iconBg:         'bg-sky-100 text-sky-600',
  },
  '/mobile-review': {
    gradient:       'from-teal-600 via-emerald-500 to-green-600',
    headerGradient: 'bg-gradient-to-br from-teal-600 via-emerald-500 to-green-600',
    iconBg:         'bg-teal-100 text-teal-600',
  },
  '/mobile-test-gap': {
    gradient:       'from-amber-500 via-yellow-500 to-orange-600',
    headerGradient: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600',
    iconBg:         'bg-amber-100 text-amber-600',
  },
  '/mobile-onboarding': {
    gradient:       'from-fuchsia-600 via-purple-600 to-violet-700',
    headerGradient: 'bg-gradient-to-br from-fuchsia-600 via-purple-600 to-violet-700',
    iconBg:         'bg-fuchsia-100 text-fuchsia-600',
  },

  // ── Community & Platform ───────────────────────────────────────────────────
  '/feedback': {
    gradient:       'from-blue-600 via-blue-500 to-cyan-600',
    headerGradient: 'bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-600',
    iconBg:         'bg-blue-100 text-blue-600',
  },
  '/idea-box': {
    gradient:       'from-violet-600 via-purple-600 to-indigo-700',
    headerGradient: 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700',
    iconBg:         'bg-violet-100 text-violet-600',
  },
  '/playground': {
    gradient:       'from-orange-500 via-amber-500 to-yellow-500',
    headerGradient: 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500',
    iconBg:         'bg-amber-100 text-amber-600',
  },
};

/** Fallback theme for unknown routes */
export const DEFAULT_THEME: AppTheme = {
  gradient:       'from-gray-700 to-gray-900',
  headerGradient: 'bg-gradient-to-br from-gray-700 to-gray-900',
  iconBg:         'bg-gray-100 text-gray-600',
};

/**
 * Resolve the theme for a given pathname.
 * Matches on the first path segment so sub-routes (e.g. /bug-analyzer/results)
 * inherit the parent app's theme automatically.
 */
export function resolveAppTheme(pathname: string): AppTheme {
  const root = '/' + pathname.split('/').filter(Boolean)[0];
  return APP_THEMES[root] ?? DEFAULT_THEME;
}
