import { Flame } from "lucide-react";
import { type IdeaImpact, type IdeaStatus, impactMeta, statusMeta } from "@/lib/ideas";

function Pill({ label, token }: { label: string; token: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium border"
      style={{ color: token, borderColor: token, background: "color-mix(in srgb, currentColor 10%, transparent)" }}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: IdeaStatus }) {
  const m = statusMeta(status);
  return <Pill label={m.label} token={m.token} />;
}

export function ImpactBadge({ impact }: { impact: IdeaImpact }) {
  const m = impactMeta(impact);
  return <Pill label={m.label} token={m.token} />;
}

export function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium border border-[var(--hairline)] text-muted">
      {domain}
    </span>
  );
}

export function TrendingBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold border"
      style={{ color: "var(--red)", borderColor: "var(--red)", background: "rgba(230,0,0,0.1)" }}
    >
      <Flame className="h-3 w-3" /> Trending
    </span>
  );
}

export function TagChips({
  tags,
  onSelectAction,
}: {
  tags: string[];
  onSelectAction?: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  const cls =
    "inline-flex items-center rounded-md px-2 py-0.5 text-[0.68rem] font-mono text-muted bg-[var(--panel-2)] border border-[var(--hairline)]";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) =>
        onSelectAction ? (
          <button
            key={t}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAction(t);
            }}
            className={`${cls} hover:text-ink hover:border-[var(--hairline-strong)] transition-colors`}
          >
            #{t}
          </button>
        ) : (
          <span key={t} className={cls}>
            #{t}
          </span>
        ),
      )}
    </div>
  );
}
