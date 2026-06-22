import { ComingSoon } from '@/components/ComingSoon';
import { FlaskConical } from 'lucide-react';

export default function MobileTestGapPage() {
  return (
    <ComingSoon
      title="Mobile Test Gap Analyzer"
      description="AI identifies untested UI flows across XCTest, Espresso, and Detox. Prioritizes gaps by production crash history and generates test case suggestions with code snippets."
      icon={<FlaskConical className="w-7 h-7 text-white" />}
      gradient="from-amber-500 to-orange-600"
      features={[
        "XCTest suite analysis and screen-level coverage mapping (iOS)",
        "Espresso test coverage mapping for Android UI flows",
        "Detox E2E flow coverage analysis for React Native",
        "Bug Analyzer integration — correlates untested areas with crash history",
        "Prioritized test gap list ranked by production incident risk",
        "AI-generated test case suggestions with XCTest/Espresso/Detox code snippets",
        "Coverage trend tracking over time to measure improvement",
      ]}
    />
  );
}
