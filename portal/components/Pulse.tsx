"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Bug,
  MessageSquare,
  Sparkles,
  Star,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { CAPABILITIES } from "@/lib/capabilities";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  appLabel,
  statusMeta,
  typeMeta,
  type FeedbackItem,
  type FeedbackStats,
  type FeedbackStatus,
  type FeedbackType,
  type RatingDistribution,
} from "@/lib/feedback";
import { relativeTime } from "@/lib/ideas";

const TYPE_ICON: Record<FeedbackType, LucideIcon> = {
  bug: Bug,
  feature: Sparkles,
  general: MessageSquare,
  praise: ThumbsUp,
};

type Payload = {
  items: FeedbackItem[];
  stats: FeedbackStats;
  distribution: RatingDistribution;
};

const EMPTY: Payload = {
  items: [],
  stats: { total: 0, avgRating: null, bugReports: 0, featureRequests: 0 },
  distribution: [0, 0, 0, 0, 0],
};

export function Pulse() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [data, setData] = useState<Payload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (appFilter !== "all") params.set("app", appFilter);
    let live = true;
    fetch(`/api/feedback?${params.toString()}`)
      .then((r) => r.json())
      .then((d: Payload) => live && setData(d))
      .catch(() => live && setData(EMPTY))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [typeFilter, appFilter, reloadNonce]);

  async function changeStatus(id: string, status: FeedbackStatus) {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, status } : it)),
    }));
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setReloadNonce((n) => n + 1); // revert to server truth
    }
  }

  const { items, stats, distribution } = data;
  const maxBar = useMemo(() => Math.max(1, ...distribution), [distribution]);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      {/* contextual badge */}
      <div className="flex items-center justify-end pt-6 pb-1">
        <span className="kicker flex items-center gap-2">
          <span className="pulse h-1.5 w-1.5 rounded-full bg-live text-live" />
          Live telemetry
        </span>
      </div>

      {/* hero */}
      <section className="pt-10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="kicker flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-red" />
            Pulse · Feedback Telemetry
          </p>
          <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.0]">
            How every tool is
            <br />
            <span className="text-red">landing</span> with engineers.
          </h1>
          <p className="text-[var(--ink-dim)] text-lg mt-5 max-w-xl leading-relaxed">
            Every rating, bug and request sent back from across the hub — one signal for what to
            fix, ship and double down on next.
          </p>
        </motion.div>
      </section>

      {/* KPI row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={MessageSquare} label="Total Feedback" value={`${stats.total}`} tint="var(--red)" />
        <Kpi
          icon={Star}
          label="Avg Rating"
          value={stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
          suffix={stats.avgRating === null ? undefined : "/ 5"}
          tint="var(--soon)"
        />
        <Kpi icon={Bug} label="Bug Reports" value={`${stats.bugReports}`} tint="var(--info)" />
        <Kpi
          icon={Sparkles}
          label="Feature Requests"
          value={`${stats.featureRequests}`}
          tint="var(--live)"
        />
      </div>

      {/* distribution */}
      <div className="card rounded-2xl p-6 mt-5" data-live="false">
        <p className="kicker mb-5">Rating Distribution</p>
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = distribution[star - 1];
            return (
              <div key={star} className="flex items-center gap-4">
                <span className="flex items-center gap-1 w-16 shrink-0 font-mono text-xs text-muted">
                  {star}
                  <Star className="h-3 w-3" style={{ color: "var(--soon)" }} fill="var(--soon)" />
                </span>
                <span className="meter-track h-2.5 flex-1">
                  <motion.span
                    className="meter-fill block"
                    initial={{ width: 0 }}
                    animate={{ width: `${(n / maxBar) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
                <span className="text-sm text-muted w-7 text-right tabular-nums font-mono">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3 mt-10 mb-5">
        <Select value={typeFilter} onChange={setTypeFilter}>
          <option value="all">All Types</option>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeMeta(t).label}
            </option>
          ))}
        </Select>
        <Select value={appFilter} onChange={setAppFilter}>
          <option value="all">All Apps</option>
          <option value="general">General</option>
          {CAPABILITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="flex-1" />
        <span className="font-mono text-xs text-muted">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* list */}
      <div className="space-y-3">
        {loading ? (
          <Empty label="Loading telemetry…" />
        ) : items.length === 0 ? (
          <Empty label="No feedback yet — it lands here the moment an engineer sends some." />
        ) : (
          items.map((it, i) => (
            <Row key={it.id} it={it} index={i} onStatus={changeStatus} />
          ))
        )}
      </div>
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  suffix,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
  tint: string;
}) {
  return (
    <div className="card rounded-2xl p-5 relative overflow-hidden" data-live="false">
      <span
        className="absolute top-0 left-5 right-5 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tint}, transparent)` }}
      />
      <p className="kicker flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: tint }} />
        {label}
      </p>
      <p className="font-display text-[2.5rem] font-extrabold leading-none mt-3 flex items-baseline gap-1.5">
        {value}
        {suffix && <span className="text-base font-mono font-normal text-muted">{suffix}</span>}
      </p>
    </div>
  );
}

function Row({
  it,
  index,
  onStatus,
}: {
  it: FeedbackItem;
  index: number;
  onStatus: (id: string, status: FeedbackStatus) => void;
}) {
  const tm = typeMeta(it.type);
  const sm = statusMeta(it.status);
  const TypeIcon = TYPE_ICON[it.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="card rounded-2xl p-5"
      data-live="false"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tint={tm.token} icon={<TypeIcon className="h-3 w-3" />}>
            {tm.label}
          </Badge>
          <select
            value={it.status}
            onChange={(e) => onStatus(it.id, e.target.value as FeedbackStatus)}
            aria-label="Change status"
            className="rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer outline-none appearance-none"
            style={{
              color: sm.token,
              borderColor: `color-mix(in srgb, ${sm.token} 30%, transparent)`,
              background: `color-mix(in srgb, ${sm.token} 15%, transparent)`,
            }}
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusMeta(s).label}
              </option>
            ))}
          </select>
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-muted rounded-full border border-[var(--hairline)] px-2.5 py-0.5">
            {appLabel(it.capabilityId)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {it.rating !== null && (
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  style={{ color: i <= it.rating! ? "var(--soon)" : "var(--hairline-strong)" }}
                  fill={i <= it.rating! ? "var(--soon)" : "none"}
                />
              ))}
            </span>
          )}
          <span className="font-mono text-xs text-muted whitespace-nowrap">
            {relativeTime(it.createdAt)}
          </span>
        </div>
      </div>
      <p className="text-[0.95rem] text-[var(--ink-dim)] leading-relaxed mt-3">{it.message}</p>
      <p className="font-mono text-[0.7rem] text-muted mt-3 flex items-center gap-1.5">
        {it.isAnonymous ? "Anonymous" : it.authorName ?? "Unattributed"}
        {it.contactOk && (
          <span className="text-live">· open to follow-up</span>
        )}
      </p>
    </motion.div>
  );
}

function Badge({
  tint,
  icon,
  children,
}: {
  tint: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: tint, background: `color-mix(in srgb, ${tint} 15%, transparent)` }}
    >
      {icon}
      {children}
    </span>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-xl border bg-[var(--panel)] px-3.5 pr-8 text-sm font-medium outline-none focus:border-[var(--red)] transition-colors cursor-pointer"
      style={{ borderColor: "var(--hairline)" }}
    >
      {children}
    </select>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="card rounded-2xl py-16 grid place-items-center gap-3 text-center" data-live="false">
      <div
        className="grid place-items-center h-12 w-12 rounded-2xl"
        style={{ background: "rgba(230,0,0,0.1)" }}
      >
        <MessageSquare className="h-6 w-6 text-red" />
      </div>
      <p className="text-sm text-muted max-w-xs">{label}</p>
    </div>
  );
}
