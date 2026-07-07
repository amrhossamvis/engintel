import { IdeaDetail } from "@/components/ideas/IdeaDetail";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IdeaDetail id={id} />;
}
