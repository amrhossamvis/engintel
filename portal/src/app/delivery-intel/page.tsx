import { ComingSoon } from '@/components/ComingSoon';
import { BarChart3 } from 'lucide-react';

export default function DeliveryIntelPage() {
  return (
    <ComingSoon
      title="Delivery Intelligence Platform"
      description="Automated sprint health scoring, velocity tracking, and executive-ready delivery reports."
      icon={<BarChart3 className="w-7 h-7 text-white" />}
      gradient="from-blue-500 to-indigo-600"
      features={[
        "Sprint Health Score (RAG status) based on velocity, scope change, bug escape rate",
        "Cross-team portfolio delivery dashboard",
        "Risk prediction for sprints likely to miss commitments",
        "Auto-generated weekly executive summaries",
        "Capacity forecasting based on historical velocity",
      ]}
    />
  );
}
