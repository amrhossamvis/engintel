"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Plus, X } from "lucide-react";
import { type IdeaListItem } from "@/lib/ideas";
import { fetchIdeas, toggleVote, voterKey } from "@/lib/ideas-client";
import { useApp } from "@/components/AppProvider";
import { IdeaCard } from "./IdeaCard";
import { SubmitIdeaModal } from "./SubmitIdeaModal";

export function NunDrawer() {
  const { adoIdentity } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ideas, setIdeas] = useState<IdeaListItem[]>([]);
  const [submitOpen, setSubmitOpen] = useState(false);

  const vk = useMemo(() => voterKey(adoIdentity), [adoIdentity]);

  const load = useCallback(() => {
    fetchIdeas({ sort: "votes", domain: "", q: "", voter: vk })
      .then((d) => setIdeas(d.ideas))
      .catch(() => setIdeas([]));
  }, [vk]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function vote(id: string) {
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
      setIdeas(prev);
    }
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            aria-label="Open ideas"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full grid place-items-center shadow-lg"
            style={{
              background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%, #b00000)",
              boxShadow: "0 0 20px rgba(230,0,0,0.45)",
            }}
          >
            <Lightbulb className="h-6 w-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="scrim"
              className="scrim fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              className="panel fixed right-0 top-0 h-full z-50 flex flex-col"
              style={{ width: "min(420px, 100vw)" }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.35 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[var(--hairline)]">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <p className="kicker flex items-center gap-1.5 mb-1">
                      <Lightbulb className="h-3.5 w-3.5 text-red" /> Nun · Ideas
                    </p>
                    <p className="font-display font-semibold text-base">Where ideas surface.</p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close ideas drawer"
                    className="text-muted hover:text-ink transition-colors mt-0.5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <button
                  onClick={() => setSubmitOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%)" }}
                >
                  <Plus className="h-4 w-4" /> Submit Idea
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                {ideas.length === 0 ? (
                  <p className="text-center text-muted text-sm py-10">
                    No ideas yet. Be the first to surface one.
                  </p>
                ) : (
                  ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onVoteAction={vote}
                      onOpenAction={(id) => {
                        router.push(`/ideas/${id}`);
                        setOpen(false);
                      }}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
