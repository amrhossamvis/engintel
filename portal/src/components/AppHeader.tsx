import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  /** Tailwind gradient or bg class, e.g. "bg-[#e60000]" or "bg-gradient-to-r from-blue-500 to-indigo-600" */
  gradient?: string;
};

export const AppHeader = ({
  title,
  subtitle,
  actions,
  icon,
  gradient = 'bg-[#e60000]',
}: AppHeaderProps) => {
  return (
    <header className={`${gradient} text-white sticky top-0 z-20 shadow-sm`}>
      <div className="container mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mb-3 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Hub
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              {icon || <Zap className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </header>
  );
};
