import { ComingSoon } from '@/components/ComingSoon';
import { Shield } from 'lucide-react';

export default function ReleaseScorerPage() {
  return (
    <ComingSoon
      title="Release Risk Scorer"
      description="Data-driven release readiness scores before every deployment to prevent production incidents."
      icon={<Shield className="w-7 h-7 text-white" />}
      gradient="from-rose-500 to-pink-600"
      features={[
        "CI/CD pipeline integration (test results, code coverage, build status)",
        "Change volume and complexity analysis from Git/ADO",
        "Scoring algorithm (test pass rate + coverage + change volume + defect density)",
        "Release dashboard with historical comparison",
        "Alert when risk score exceeds threshold",
      ]}
    />
  );
}
