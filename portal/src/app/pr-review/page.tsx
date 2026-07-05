import { ComingSoon } from '@/components/ComingSoon';
import { GitPullRequest } from 'lucide-react';

export default function PRReviewPage() {
  return (
    <ComingSoon
      title="PR Review Intelligence"
      description="Automated first-pass PR analysis with risk scoring, standards compliance, and stale PR alerts."
      icon={<GitPullRequest className="w-7 h-7 text-white" />}
      gradient="from-cyan-500 to-sky-600"
      features={[
        "Azure DevOps PR webhook integration",
        "Automated PR size/risk scoring (lines changed, files affected, test coverage)",
        "AI review comments for common patterns",
        "Standards compliance check (configurable rules per team)",
        "PR age dashboard (identify review bottlenecks)",
      ]}
    />
  );
}
