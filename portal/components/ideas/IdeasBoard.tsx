"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronUp, Lightbulb, Plus, Rocket, Search } from "lucide-react";
import { DOMAINS, type IdeaListItem, type IdeaStats, type SortKey } from "@/lib/ideas";
import { fetchIdeas, toggleVote, voterKey } from "@/lib/ideas-client";
import { useApp } from "@/components/AppProvider";
import { IdeaCard } from "./IdeaCard";
import { SubmitIdeaModal } from "./SubmitIdeaModal";

const ZERO: IdeaStats = { total: 0, votes: 0, inPipeline: 0, shipped: 0 };

export function IdeasBoard() {
  const { adoIdentity } = useApp();
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaListItem[]>([]);
  const [stats, setStats] = useState<IdeaStats>(ZERO);
  const [sort, setSort] = useState<SortKey>("votes");
  const [domain, setDomain] = useState("");
  const [q, setQ] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const vk = useMemo(() => voterKey(adoIdentity), [adoIdentity]);

  const load = useCallback(() => {
    fetchIdeas({ sort, domain, q, voter: vk })
      .then((d) => {
        setIdeas(d.ideas);
        setStats(d.stats);
      })
      .catch(() => {
        setIdeas([]);
        setStats(ZERO);
      });
  }, [sort, domain, q, vk]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0); // debounce search
    return () => clearTimeout(t);
  }, [load, q]);

  async function onVote(id: string) {
    const prev = ideas;
    setIdeas((xs) =>
      xs.map((i) =>
        i.id === id ? { ...i, hasVoted: !i.hasVoted, voteCount: i.voteCount + (i.hasVoted ? -1 : 1) } : i,
      ),
    );
    try {
      await toggleVote(id, vk);
      load();
    } catch {
      setIdeas(prev); // rollback
    }
  }

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
      <section className="pt-10 pb-10">
        <p className="kicker flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-red" /> Nun · Ideas
        </p>
        <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2rem,5vw,3.25rem)] leading-[1]">
          Where ideas <span className="text-red">surface</span>.
        </h1>
        <p className="text-[var(--ink-dim)] text-lg mt-4 max-w-xl">
          Submit an idea, upvote what matters, watch it move from raw thought to shipped.
        </p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile icon={<Lightbulb className="h-4 w-4" />} label="Total Ideas" value={stats.total} />
        <StatTile icon={<ChevronUp className="h-4 w-4" />} label="Total Votes" value={stats.votes} />
        <StatTile icon={<Rocket className="h-4 w-4" />} label="In Pipeline" value={stats.inPipeline} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4" />} label="Shipped" value={stats.shipped} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex items-center gap-2 flex-1 min-w-[12rem] rounded-lg border border-[var(--hairline)] px-3 py-2">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ideas…"
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="votes">Most Voted</option>
          <option value="new">Newest</option>
        </select>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All Domains</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSubmitOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%)" }}
        >
          <Plus className="h-4 w-4" /> Submit Idea
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {ideas.length === 0 ? (
          <div className="panel rounded-2xl p-10 text-center text-muted">
            No ideas yet. Be the first to surface one.
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onVoteAction={onVote}
              onOpenAction={(id) => router.push(`/ideas/${id}`)}
              onTagAction={setQ}
            />
          ))
        )}
      </div>

      <SubmitIdeaModal
        open={submitOpen}
        onCloseAction={() => setSubmitOpen(false)}
        onCreatedAction={() => {
          setSubmitOpen(false);
          load();
        }}
      />
    </main>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="panel rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted text-xs">
        {icon}
        {label}
      </div>
      <div className="font-mono text-2xl mt-2">{value}</div>
    </div>
  );
}
