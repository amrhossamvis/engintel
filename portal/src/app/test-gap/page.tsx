import { ComingSoon } from '@/components/ComingSoon';
import { TestTube2 } from 'lucide-react';

export default function TestGapPage() {
  return (
    <ComingSoon
      title="Test Gap Analyzer"
      description="Identify highest-value testing gaps by combining complexity, defect history, and change frequency."
      icon={<TestTube2 className="w-7 h-7 text-white" />}
      gradient="from-lime-500 to-green-600"
      features={[
        "Code complexity analysis per file/module (cyclomatic complexity)",
        "Historical defect density mapping from Bug Analyzer data",
        "Change frequency analysis from Git history",
        "Risk score per module (complexity × change frequency × defect history ÷ test coverage)",
        "Ranked list of highest-value test gaps",
      ]}
    />
  );
}
