"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, Pencil, Pin, Send, Trash2 } from "lucide-react";
import {
  type IdeaDetail as Detail,
  IMPACTS,
  STATUSES,
  TRENDING_VOTES,
  relativeTime,
  statusMeta,
} from "@/lib/ideas";
import { addComment, deleteIdea, fetchIdea, patchIdea, toggleVote, voterKey } from "@/lib/ideas-client";
import { useApp } from "@/components/AppProvider";
import { DomainBadge, ImpactBadge, StatusBadge, TagChips, TrendingBadge } from "./badges";
import { EditIdeaModal } from "./EditIdeaModal";

export function IdeaDetail({ id }: { id: string }) {
  const { adoIdentity } = useApp();
  const router = useRouter();
  const vk = useMemo(() => voterKey(adoIdentity), [adoIdentity]);
  const [idea, setIdea] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);

  const load = useCallback(() => {
    fetchIdea(id, vk)
      .then(setIdea)
      .catch(() => setMissing(true));
  }, [id, vk]);

  useEffect(() => {
    load();
  }, [load]);

  async function onVote() {
    if (!idea) return;
    try {
      const r = await toggleVote(id, vk);
      setIdea({ ...idea, hasVoted: r.voted, voteCount: r.voteCount });
    } catch {
      /* keep UI as-is on failure */
    }
  }

  async function postComment() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(id, {
        body: text.trim(),
        authorKey: vk,
        authorName: anon ? null : adoIdentity,
        isAnonymous: anon,
      });
      setText("");
      setAnon(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function applyAdmin(patch: Parameters<typeof patchIdea>[1]) {
    if (adminBusy) return;
    setAdminBusy(true);
    try {
      await patchIdea(id, patch);
      load();
    } finally {
      setAdminBusy(false);
    }
  }

  async function onDelete() {
    setAdminBusy(true);
    try {
      await deleteIdea(id);
      router.push("/ideas");
    } catch {
      setAdminBusy(false);
      setConfirmDel(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center text-muted">
        Idea not found.{" "}
        <Link href="/ideas" className="text-red">
          Back to board
        </Link>
      </main>
    );
  }
  if (!idea) return <main className="mx-auto max-w-3xl px-6 py-20 text-center text-muted">Loading…</main>;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
      <header className="py-6">
        <Link href="/ideas" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to board
        </Link>
      </header>

      <div className="flex gap-5">
        <button
          onClick={onVote}
          aria-pressed={idea.hasVoted}
          className="shrink-0 grid place-items-center h-16 w-14 rounded-xl border"
          style={{
            borderColor: idea.hasVoted ? "var(--red)" : "var(--hairline)",
            background: idea.hasVoted ? "rgba(230,0,0,0.12)" : "transparent",
            color: idea.hasVoted ? "var(--red)" : "var(--ink)",
          }}
        >
          <ChevronUp className="h-4 w-4" />
          <span className="font-mono text-lg leading-none mt-1">{idea.voteCount}</span>
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-2xl leading-tight">
            {idea.pinned && <Pin className="inline h-4 w-4 mr-1.5 text-soon" />}
            {idea.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {idea.voteCount >= TRENDING_VOTES && <TrendingBadge />}
            <StatusBadge status={idea.status} />
            {idea.impact && <ImpactBadge impact={idea.impact} />}
            <DomainBadge domain={idea.domain} />
          </div>
          {idea.tags.length > 0 && <div className="mt-3"><TagChips tags={idea.tags} /></div>}
          <p className="text-[var(--ink-dim)] mt-4 whitespace-pre-wrap">{idea.body}</p>
          {idea.proposedSolution && (
            <div className="mt-5">
              <p className="kicker mb-1.5">Proposed solution</p>
              <p className="text-[var(--ink-dim)] whitespace-pre-wrap">{idea.proposedSolution}</p>
            </div>
          )}
          <p className="text-xs font-mono text-muted mt-4">
            {idea.isAnonymous ? "Anonymous" : (idea.authorName ?? "Someone")} · {relativeTime(idea.createdAt)}
          </p>
        </div>
      </div>

      {idea.isAdmin && (
        <section className="mt-8 panel rounded-xl p-4">
          <p className="kicker mb-3">Admin</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted flex items-center gap-2">
              Status
              <select
                value={idea.status}
                disabled={adminBusy}
                onChange={(e) => applyAdmin({ status: e.target.value })}
                className="rounded-lg border border-[var(--hairline)] bg-transparent px-2 py-1 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta(s).label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted flex items-center gap-2">
              Impact
              <select
                value={idea.impact ?? ""}
                disabled={adminBusy}
                onChange={(e) => applyAdmin({ impact: e.target.value || null })}
                className="rounded-lg border border-[var(--hairline)] bg-transparent px-2 py-1 text-sm"
              >
                <option value="">—</option>
                {IMPACTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => applyAdmin({ pinned: !idea.pinned })}
              disabled={adminBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-sm"
            >
              <Pin className="h-3.5 w-3.5" /> {idea.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={() => setEditOpen(true)}
              disabled={adminBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-sm"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {confirmDel ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="text-muted">Delete?</span>
                <button onClick={onDelete} disabled={adminBusy} className="text-red font-semibold">
                  Yes
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-muted">
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                disabled={adminBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-sm text-red"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display font-semibold text-lg mb-4">Comments ({idea.comments.length})</h2>

        <div className="flex flex-col gap-3 mb-6">
          {idea.comments.map((c) => (
            <div key={c.id} className="panel rounded-xl p-4">
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              <p className="text-xs font-mono text-muted mt-2">
                {c.isAnonymous ? "Anonymous" : (c.authorName ?? "Someone")} · {relativeTime(c.createdAt)}
              </p>
            </div>
          ))}
          {idea.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
        </div>

        <div className="panel rounded-xl p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Add a comment…"
            className="w-full bg-transparent outline-none text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              Post anonymously
            </label>
            <button
              onClick={postComment}
              disabled={!text.trim() || busy}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%)" }}
            >
              <Send className="h-3.5 w-3.5" /> {busy ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </section>

      <EditIdeaModal
        idea={idea}
        open={editOpen}
        onCloseAction={() => setEditOpen(false)}
        onSavedAction={() => {
          setEditOpen(false);
          load();
        }}
      />
    </main>
  );
}
