import { ComingSoon } from '@/components/ComingSoon';
import { Network } from 'lucide-react';

export default function DependencyRadarPage() {
  return (
    <ComingSoon
      title="Dependency & Blocker Radar"
      description="Auto-detect cross-team dependencies and predict blockers before they cause delivery delays."
      icon={<Network className="w-7 h-7 text-white" />}
      gradient="from-indigo-500 to-blue-700"
      features={[
        "ADO work item link analysis (predecessor/successor, related items)",
        "Cross-team dependency identification algorithm",
        "Dependency graph visualization",
        "Alert system for at-risk dependencies (based on due dates and velocity)",
        "Weekly dependency report for program management",
      ]}
    />
  );
}
