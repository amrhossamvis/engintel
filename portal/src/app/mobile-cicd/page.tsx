import { ComingSoon } from '@/components/ComingSoon';
import { Wrench } from 'lucide-react';

export default function MobileCicdPage() {
  return (
    <ComingSoon
      title="Mobile CI/CD Intelligence"
      description="AI monitoring for Fastlane, GitHub Actions, and Azure Pipelines. Detects flaky tests, diagnoses build failures with mobile-specific context, and generates weekly pipeline health reports."
      icon={<Wrench className="w-7 h-7 text-white" />}
      gradient="from-sky-600 to-blue-700"
      features={[
        "Fastlane lane failure diagnosis with actionable root cause",
        "GitHub Actions and Azure Pipelines build log analysis",
        "Flaky test detection and tracking across iOS, Android, and RN",
        "Build time regression alerts with historical comparison",
        "Xcode code signing and provisioning profile issue detection",
        "Gradle multi-flavor and ProGuard configuration diagnostics",
        "Weekly pipeline health report with ranked optimization recommendations",
      ]}
    />
  );
}
