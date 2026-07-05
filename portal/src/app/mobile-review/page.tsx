import { ComingSoon } from '@/components/ComingSoon';
import { ScanSearch } from 'lucide-react';

export default function MobileReviewPage() {
  return (
    <ComingSoon
      title="Mobile Code Review Assistant"
      description="AI first-pass review for Swift, Kotlin, and React Native PRs. Flags platform-specific anti-patterns — force-unwraps, ARC issues, coroutine scope leaks, ANR-prone patterns, and bridge performance problems."
      icon={<ScanSearch className="w-7 h-7 text-white" />}
      gradient="from-teal-600 to-green-600"
      features={[
        "Swift force-unwrap chains and ARC retain cycle detection",
        "Kotlin null safety violations and coroutine scope leak analysis",
        "React Native bridge performance anti-pattern flagging",
        "iOS main thread violation and viewDidLoad misuse detection",
        "Android ANR-prone pattern and Fragment backstack error flagging",
        "PR risk score based on size, complexity, and test coverage delta",
        "Inline review comments posted directly on Azure DevOps and GitHub PRs",
      ]}
    />
  );
}
