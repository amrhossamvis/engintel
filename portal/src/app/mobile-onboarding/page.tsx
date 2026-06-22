import { ComingSoon } from '@/components/ComingSoon';
import { UserCheck } from 'lucide-react';

export default function MobileOnboardingPage() {
  return (
    <ComingSoon
      title="Mobile Onboarding Accelerator"
      description="AI-guided onboarding for iOS, Android, and React Native engineers. RAG over internal docs, Fastlane lanes, and architecture decisions. Reduces time-to-first-PR from 2 weeks to 3 days."
      icon={<UserCheck className="w-7 h-7 text-white" />}
      gradient="from-fuchsia-600 to-violet-700"
      features={[
        "Personalized learning paths for iOS, Android, and React Native engineers",
        "Automated environment setup verification (Xcode, Android SDK, RN Metro)",
        "Fastlane match and code signing configuration guide",
        "AI codebase orientation — auto-generated tour of repository structure",
        "Contextual Q&A via RAG over internal docs, ADRs, and READMEs",
        "Architecture decision record search and explanation",
        "Manager dashboard for onboarding progress tracking",
      ]}
    />
  );
}
