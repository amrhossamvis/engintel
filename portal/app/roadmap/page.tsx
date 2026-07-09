import type { Metadata } from "next";
import { Roadmap } from "@/components/Roadmap";

export const metadata: Metadata = {
  title: "Roadmap — AI for Engineers",
  description:
    "A guided path from getting your Copilot licence to building AI into products. Two tracks, self-paced.",
};

export default function RoadmapPage() {
  return <Roadmap />;
}
