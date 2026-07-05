import { ComingSoon } from '@/components/ComingSoon';
import { Rocket } from 'lucide-react';

export default function MobileReleasePage() {
  return (
    <ComingSoon
      title="App Store Release Risk Scorer"
      description="AI-powered Go/No-Go for iOS App Store & Google Play submissions. Evaluates Fastlane results, crash rates, open bugs, and code churn into a 0–100 release readiness score."
      icon={<Rocket className="w-7 h-7 text-white" />}
      gradient="from-violet-600 to-indigo-700"
      features={[
        "Fastlane test result aggregation and lane health check",
        "Firebase crash rate trend analysis per release candidate",
        "Open critical bug count from Azure DevOps",
        "Code churn analysis for the last 2 weeks",
        "Historical release comparison — this release vs. last 10",
        "AI Go/No-Go recommendation with plain-English reasoning",
        "App Store review guideline risk factor detection",
      ]}
    />
  );
}
