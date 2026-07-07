import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookMarked,
  BookOpen,
  Bug,
  Compass,
  FlaskConical,
  Frame,
  Gauge,
  GitBranch,
  GitPullRequest,
  Layers,
  LayoutDashboard,
  Radar,
  Rocket,
  ScanSearch,
  ScanText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TestTube,
  TestTube2,
  TriangleAlert,
  UserPlus,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  GitPullRequest,
  Bug,
  Layers,
  Activity,
  FlaskConical,
  Frame,
  LayoutDashboard,
  ScanSearch,
  Sparkles,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Wand2,
  TriangleAlert,
  Rocket,
  GitBranch,
  ShieldCheck,
  TestTube,
  Smartphone,
  Compass,
  Gauge,
  Radar,
  TestTube2,
  UserPlus,
  BookMarked,
  ScanText,
};

/** Icon keys users can pick from when authoring a custom persona. */
export const ICON_KEYS: string[] = Object.keys(MAP);

export function CapIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = MAP[name] ?? Layers;
  return <Icon className={className} style={style} strokeWidth={1.6} />;
}
