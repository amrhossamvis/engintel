import { ComingSoon } from '@/components/ComingSoon';
import { BookOpen } from 'lucide-react';

export default function KnowledgeCopilotPage() {
  return (
    <ComingSoon
      title="Engineering Knowledge Copilot"
      description="AI assistant that answers engineering questions from your docs, code, and architecture decisions."
      icon={<BookOpen className="w-7 h-7 text-white" />}
      gradient="from-emerald-500 to-teal-600"
      features={[
        "Index top Confluence spaces and key README files",
        "RAG (Retrieval Augmented Generation) pipeline with embedding search",
        "Chat interface (Teams bot or web app)",
        "Source attribution (show where the answer came from)",
        "Feedback mechanism (thumbs up/down for answer quality)",
      ]}
    />
  );
}
