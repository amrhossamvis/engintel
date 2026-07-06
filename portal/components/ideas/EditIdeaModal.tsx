"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { DOMAINS, IMPACTS, MAX_TAGS, normalizeTags, type IdeaDetail } from "@/lib/ideas";
import { patchIdea } from "@/lib/ideas-client";
import { Portal } from "@/components/Portal";

export function EditIdeaModal({
  idea,
  open,
  onCloseAction,
  onSavedAction,
}: {
  idea: IdeaDetail;
  open: boolean;
  onCloseAction: () => void;
  onSavedAction: () => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [body, setBody] = useState(idea.body);
  const [solution, setSolution] = useState(idea.proposedSolution ?? "");
  const [domain, setDomain] = useState(idea.domain);
  const [impact, setImpact] = useState(idea.impact ?? "");
  const [tagsRaw, setTagsRaw] = useState(idea.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = title.trim().length > 2 && body.trim().length > 2;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchIdea(idea.id, {
        title: title.trim(),
        body: body.trim(),
        proposedSolution: solution.trim() || null,
        domain,
        impact: impact || null,
        tags: normalizeTags(tagsRaw.split(",")),
      });
      onSavedAction();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center p-4 scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCloseAction}
        >
          <motion.div
            className="panel rounded-2xl w-full max-w-lg p-6"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-xl">Edit idea</h2>
              <button onClick={onCloseAction} aria-label="Close" className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="block text-xs text-muted mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm mb-4"
            />

            <label className="block text-xs text-muted mb-1">The problem</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm mb-4 resize-none"
            />

            <label className="block text-xs text-muted mb-1">Proposed solution (optional)</label>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm mb-4 resize-none"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-muted mb-1">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm"
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Impact</label>
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {IMPACTS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="block text-xs text-muted mb-1">Tags (comma-separated)</label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder={`up to ${MAX_TAGS}`}
              className="w-full rounded-lg border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm mb-5"
            />

            {err && <p className="text-sm text-red mb-3">Could not save: {err}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onCloseAction} className="rounded-lg border border-[var(--hairline)] px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!valid || busy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%)" }}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </Portal>
  );
}
