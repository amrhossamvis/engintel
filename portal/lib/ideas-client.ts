import type { IdeaDetail, IdeaListItem, IdeaStats, SortKey } from "@/lib/ideas";

export function voterKey(adoIdentity: string | null): string {
  if (adoIdentity) return adoIdentity;
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("hub_uid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("hub_uid", id);
  }
  return id;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

export async function fetchIdeas(opts: {
  sort: SortKey;
  domain: string;
  q: string;
  voter: string;
}): Promise<{ ideas: IdeaListItem[]; stats: IdeaStats }> {
  const p = new URLSearchParams({ sort: opts.sort, voter: opts.voter });
  if (opts.domain) p.set("domain", opts.domain);
  if (opts.q) p.set("q", opts.q);
  return json<{ ideas: IdeaListItem[]; stats: IdeaStats }>(await fetch(`/api/ideas?${p}`));
}

export async function createIdea(input: {
  title: string;
  body: string;
  proposedSolution: string | null;
  domain: string;
  impact: string | null;
  tags: string[];
  authorKey: string;
  authorName: string | null;
  isAnonymous: boolean;
}): Promise<{ id: string }> {
  return json<{ id: string }>(
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function toggleVote(
  id: string,
  voterKey: string,
): Promise<{ voted: boolean; voteCount: number }> {
  return json<{ voted: boolean; voteCount: number }>(
    await fetch(`/api/ideas/${id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voterKey }),
    }),
  );
}

export async function fetchIdea(id: string, voter: string): Promise<IdeaDetail> {
  return json<IdeaDetail>(await fetch(`/api/ideas/${id}?voter=${encodeURIComponent(voter)}`));
}

export async function addComment(
  id: string,
  input: { body: string; authorKey: string; authorName: string | null; isAnonymous: boolean },
): Promise<{ id: string }> {
  return json<{ id: string }>(
    await fetch(`/api/ideas/${id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function patchIdea(
  id: string,
  input: {
    title?: string;
    body?: string;
    proposedSolution?: string | null;
    domain?: string;
    status?: string;
    impact?: string | null;
    tags?: string[];
    pinned?: boolean;
  },
): Promise<{ ok: boolean }> {
  return json<{ ok: boolean }>(
    await fetch(`/api/ideas/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteIdea(id: string): Promise<{ ok: boolean }> {
  return json<{ ok: boolean }>(await fetch(`/api/ideas/${id}`, { method: "DELETE" }));
}
