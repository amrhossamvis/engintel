import { ComingSoon } from '@/components/ComingSoon';
import { GraduationCap } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <ComingSoon
      title="Developer Onboarding Accelerator"
      description="AI-assisted onboarding with personalized learning paths, codebase orientation, and contextual Q&A."
      icon={<GraduationCap className="w-7 h-7 text-white" />}
      gradient="from-fuchsia-500 to-purple-700"
      features={[
        "Structured onboarding checklist per team (automated tracking)",
        "Repository overview generator (auto-generated from codebase analysis)",
        "Environment setup scripts with verification",
        "FAQ bot trained on common new-joiner questions",
        "Progress dashboard for managers",
      ]}
    />
  );
}
