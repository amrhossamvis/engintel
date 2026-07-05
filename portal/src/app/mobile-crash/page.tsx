import { ComingSoon } from '@/components/ComingSoon';
import { Flame } from 'lucide-react';

export default function MobileCrashPage() {
  return (
    <ComingSoon
      title="Mobile Crash Intelligence"
      description="Firebase Crashlytics → AI-powered crash pattern analysis, commit correlation, and automated incident reports for iOS, Android, and React Native."
      icon={<Flame className="w-7 h-7 text-white" />}
      gradient="from-red-600 to-pink-700"
      features={[
        "Firebase Crashlytics API integration for iOS, Android, and React Native",
        "AI crash pattern grouping and deduplication across OS versions and devices",
        "Commit correlation — traces each crash to the originating PR and author",
        "iOS symbolication and Android ProGuard trace de-obfuscation",
        "Crash rate trend analysis per release with regression detection",
        "AI-generated fix recommendations and automated incident reports",
      ]}
    />
  );
}
