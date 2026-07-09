import type { Metadata } from "next";
import { CopilotAccessDoc } from "@/components/CopilotAccessDoc";

export const metadata: Metadata = {
  title: "Get GitHub Copilot at VOIS",
  description:
    "Onboarding for GitHub Copilot at Vodafone — access types, request steps, and Cloud vs Standalone features.",
};

export default function CopilotAccessPage() {
  return <CopilotAccessDoc />;
}
