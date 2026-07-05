'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { resolveAppTheme } from '@/lib/app-config';
import { FeedbackWidget } from './FeedbackWidget';

// Pages that should NOT show the feedback widget
const NO_FEEDBACK_PATHS = ['/feedback', '/idea-box', '/playground', '/login', '/settings'];

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  /** Optional override — leave unset to auto-resolve from the current route */
  gradient?: string;
};

export const AppHeader = ({
  title,
  subtitle,
  actions,
  icon,
  gradient,
}: AppHeaderProps) => {
  const pathname = usePathname();
  const resolvedGradient = gradient ?? resolveAppTheme(pathname).headerGradient;
  const showFeedback = !NO_FEEDBACK_PATHS.some(p => pathname.startsWith(p));

  return (
    <>
      <header className={`${resolvedGradient} text-white sticky top-0 z-20 shadow-sm`}>
        <div className="container mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mb-3 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Hub
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm shrink-0">
                {icon || <Zap className="w-5 h-5 text-white" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight leading-tight">{title}</h1>
                {subtitle && <p className="text-xs sm:text-sm text-white/80 mt-0.5 leading-snug line-clamp-2">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2 sm:gap-3">{actions}</div>}
          </div>
        </div>
      </header>

      {/* Floating feedback widget — shown on all tool pages */}
      {showFeedback && (
        <FeedbackWidget
          appId={pathname.split('/').filter(Boolean)[0] ?? 'unknown'}
          appName={title}
        />
      )}
    </>
  );
};
