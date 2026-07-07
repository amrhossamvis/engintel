"use client";

import { ChevronUp, MessageSquare, Pin } from "lucide-react";
import { type IdeaListItem, TRENDING_VOTES, relativeTime } from "@/lib/ideas";
import { DomainBadge, ImpactBadge, StatusBadge, TagChips, TrendingBadge } from "./badges";

export function IdeaCard({
  idea,
  onVoteAction,
  onOpenAction,
  onTagAction,
}: {
  idea: IdeaListItem;
  onVoteAction: (id: string) => void;
  onOpenAction: (id: string) => void;
  onTagAction?: (tag: string) => void;
}) {
  return (
    <div className="card rounded-2xl p-5 flex gap-4" data-live="true">
      <button
        onClick={() => onVoteAction(idea.id)}
        aria-pressed={idea.hasVoted}
        className="shrink-0 grid place-items-center h-16 w-14 rounded-xl border transition-colors"
        style={{
          borderColor: idea.hasVoted ? "var(--red)" : "var(--hairline)",
          background: idea.hasVoted ? "rgba(230,0,0,0.12)" : "transparent",
          color: idea.hasVoted ? "var(--red)" : "var(--ink)",
        }}
      >
        <ChevronUp className="h-4 w-4" />
        <span className="font-mono text-lg leading-none mt-1">{idea.voteCount}</span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <button onClick={() => onOpenAction(idea.id)} className="text-left">
            <h3 className="font-display font-semibold text-lg leading-snug hover:text-red transition-colors">
              {idea.pinned && <Pin className="inline h-3.5 w-3.5 mr-1.5 text-soon" />}
              {idea.title}
            </h3>
          </button>
        </div>
        <p className="text-[var(--ink-dim)] text-sm mt-1.5 line-clamp-2">{idea.body}</p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {idea.voteCount >= TRENDING_VOTES && <TrendingBadge />}
          <StatusBadge status={idea.status} />
          {idea.impact && <ImpactBadge impact={idea.impact} />}
          <DomainBadge domain={idea.domain} />
        </div>

        {idea.tags.length > 0 && (
          <div className="mt-2.5">
            <TagChips tags={idea.tags} onSelectAction={onTagAction} />
          </div>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs font-mono text-muted">
          <span>{idea.isAnonymous ? "Anonymous" : (idea.authorName ?? "Someone")}</span>
          <span>·</span>
          <span>{relativeTime(idea.createdAt)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> {idea.commentCount}
          </span>
        </div>
      </div>
    </div>
  );
}
