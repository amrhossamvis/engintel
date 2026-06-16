import { ComingSoon } from '@/components/ComingSoon';
import { TestTube2 } from 'lucide-react';

export default function QualityPredictorPage() {
  return (
    <ComingSoon
      title="Sprint Quality Predictor"
      description="Predict sprint quality risk before testing begins using code churn, complexity, and defect patterns."
      icon={<TestTube2 className="w-7 h-7 text-white" />}
      gradient="from-amber-500 to-orange-600"
      features={[
        "Historical bug data extraction and pattern analysis",
        "Code churn analysis per sprint (files changed, lines modified, PR size)",
        "Risk scoring algorithm (weighted complexity signals)",
        "Current sprint risk score vs. historical average dashboard",
        "Alert system for sprints exceeding risk threshold",
      ]}
    />
  );
}
