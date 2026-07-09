"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BookOpen,
  Check,
  ExternalLink,
  GraduationCap,
  Map as MapIcon,
  MonitorPlay,
  RotateCcw,
  ScrollText,
  Sparkles,
} from "lucide-react";
import {
  ROADMAP_TRACKS,
  type ResourceType,
  type RoadmapResource,
  type RoadmapStage,
  type RoadmapTrack,
} from "@/lib/roadmap-data";
import { useApp } from "./AppProvider";

const KEY = "roadmap:done";
const SHARED_STAGES = new Set(["access", "responsible-ai"]);

function postProgress(userKey: string, nodeId: string, trackId: string | null, done: boolean) {
  return fetch("/api/roadmap/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userKey, nodeId, trackId, done }),
  }).catch(() => {});
}

function loadDone(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const RES_META: Record<ResourceType, { label: string; tint: string }> = {
  internal: { label: "In hub", tint: "var(--red)" },
  docs: { label: "Docs", tint: "var(--info)" },
  course: { label: "Course", tint: "var(--live)" },
  interactive: { label: "Interactive", tint: "var(--soon)" },
  video: { label: "Video", tint: "var(--muted)" },
  cert: { label: "Cert", tint: "var(--soon)" },
  blog: { label: "Blog", tint: "var(--muted)" },
};

/** "Stage 1 · Copilot Fundamentals" → "Copilot Fundamentals" (drops any parenthetical). */
function shortStage(title: string): string {
  const afterDot = title.includes("·") ? title.split("·").pop()!.trim() : title;
  return afterDot.replace(/\s*\(.*\)\s*$/, "").trim();
}

function ResourceLink({ r }: { r: RoadmapResource }) {
  const meta = RES_META[r.type];
  const internal = r.type === "internal";
  const inner = (
    <>
      <span
        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider shrink-0"
        style={{ color: meta.tint, background: "color-mix(in srgb, transparent 86%, currentColor)" }}
      >
        {meta.label}
      </span>
      <span className="text-sm text-ink-dim group-hover/res:text-ink transition-colors truncate">
        {r.label}
      </span>
      {r.free && <span className="text-[0.6rem] font-mono text-live shrink-0">FREE</span>}
      {internal ? (
        <Sparkles className="h-3 w-3 text-faint shrink-0 ml-auto" />
      ) : (
        <ExternalLink className="h-3 w-3 text-faint shrink-0 ml-auto" />
      )}
    </>
  );
  const cls =
    "group/res flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] px-2.5 py-2 hover:border-[var(--hairline-strong)] transition-colors";
  return internal ? (
    <Link href={r.url} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={r.url} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  );
}

function DoneCheck({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="checkbox"
      aria-checked={done}
      title={done ? "Done — click to unmark" : "Mark as done"}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors shrink-0"
      style={{
        color: done ? "#fff" : "var(--faint)",
        borderColor: done ? "var(--live)" : "var(--hairline-strong)",
        background: done ? "var(--live)" : "transparent",
      }}
    >
      {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function Roadmap() {
  const { adoIdentity, login } = useApp();
  const userKey = adoIdentity || login || null;

  const [trackId, setTrackId] = useState<string>(ROADMAP_TRACKS[0].id);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDone(loadDone());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(done));
    } catch {
      // storage blocked — progress just won't persist
    }
  }, [done, hydrated]);

  // When authenticated, the DB is the cross-device source of truth: pull the
  // user's saved nodes and union them in, then back-fill any local-only ticks.
  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    fetch(`/api/roadmap/progress?user=${encodeURIComponent(userKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { done?: string[] } | null) => {
        if (cancelled || !data?.done) return;
        const dbDone = new Set(data.done);
        setDone((prev) => {
          const merged = { ...prev };
          dbDone.forEach((id) => (merged[id] = true));
          return merged;
        });
        const local = loadDone();
        Object.keys(local)
          .filter((id) => local[id] && !dbDone.has(id))
          .forEach((id) => void postProgress(userKey, id, null, true));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const track: RoadmapTrack = useMemo(
    () => ROADMAP_TRACKS.find((t) => t.id === trackId) ?? ROADMAP_TRACKS[0],
    [trackId],
  );

  const allNodeIds = useMemo(
    () => track.stages.flatMap((s) => s.nodes.map((n) => n.id)),
    [track],
  );
  const doneCount = allNodeIds.filter((id) => done[id]).length;
  const pct = allNodeIds.length ? Math.round((doneCount / allNodeIds.length) * 100) : 0;

  function toggle(id: string) {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next }));
    if (userKey) void postProgress(userKey, id, trackId, next);
  }
  function resetTrack() {
    setDone((d) => {
      const next = { ...d };
      allNodeIds.forEach((id) => delete next[id]);
      return next;
    });
    if (userKey) allNodeIds.forEach((id) => void postProgress(userKey, id, trackId, false));
  }

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
      {/* hero */}
      <section className="pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="kicker flex items-center gap-2">
            <MapIcon className="h-3.5 w-3.5 text-red" />
            Roadmap · AI for Engineers
          </p>
          <h1 className="font-display font-extrabold tracking-tight mt-4 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.0]">
            From <span className="text-red">zero</span> to
            <br />
            AI-native engineer.
          </h1>
          <p className="text-[var(--ink-dim)] text-lg mt-5 max-w-xl leading-relaxed">
            Two paths. <span className="text-ink">Use</span> Copilot like a pro, or <span className="text-ink">build</span> AI
            into products. Pick a track, tick off nodes, keep your own pace.
          </p>
        </motion.div>
      </section>

      {/* track toggle + progress */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <div className="inline-flex rounded-xl border border-[var(--hairline)] p-1 bg-[var(--canvas-2)]">
          {ROADMAP_TRACKS.map((t) => {
            const active = t.id === trackId;
            return (
              <button
                key={t.id}
                onClick={() => setTrackId(t.id)}
                className="relative rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: active ? "#fff" : "var(--muted)" }}
              >
                {active && (
                  <motion.span
                    layoutId="track-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "linear-gradient(180deg, var(--red-bright), var(--red))" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t.title}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-xs text-muted">
              {doneCount}/{allNodeIds.length} done · {pct}%
            </p>
            <div className="meter-track h-1.5 w-40 mt-1">
              <motion.span
                className="meter-fill block"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          </div>
          <button
            onClick={resetTrack}
            title="Reset progress for this track"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--hairline)] text-muted hover:text-ink hover:border-[var(--hairline-strong)] transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* what this track is + stage overview — changes per tab so the difference is obvious */}
      <motion.div
        key={track.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="rounded-2xl border border-[var(--hairline)] bg-[var(--canvas-2)] p-5 mb-10"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <span className="font-display font-semibold text-ink">{track.title}</span>
          <span className="text-sm text-ink-dim">{track.audience}</span>
          <span className="font-mono text-xs text-faint">· {track.effort}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {track.stages.map((s, i) => {
            const shared = SHARED_STAGES.has(s.id);
            return (
              <span key={s.id} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-faint">→</span>}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  style={{
                    borderColor: shared ? "var(--hairline)" : "color-mix(in srgb, transparent 70%, var(--red))",
                    color: shared ? "var(--muted)" : "var(--ink-dim)",
                    background: shared ? "transparent" : "color-mix(in srgb, transparent 92%, var(--red))",
                  }}
                >
                  {shortStage(s.title)}
                  {shared && <span className="text-[0.55rem] font-mono uppercase tracking-wider text-faint">shared</span>}
                </span>
              </span>
            );
          })}
        </div>
      </motion.div>

      {/* stages */}
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--hairline)] hidden sm:block" />
        <div className="space-y-12">
          {track.stages.map((stage, si) => (
            <StageBlock key={`${track.id}-${stage.id}`} stage={stage} index={si} done={done} onToggle={toggle} />
          ))}
        </div>
      </div>

      {/* footer legend */}
      <div className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.7rem] font-mono text-muted border-t border-[var(--hairline)] pt-5">
        <span className="inline-flex items-center gap-1.5"><ScrollText className="h-3 w-3" /> Docs</span>
        <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> Courses</span>
        <span className="inline-flex items-center gap-1.5"><MonitorPlay className="h-3 w-3" /> Video</span>
        <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Interactive</span>
        <span className="flex-1" />
        <span>Progress saved on this device.</span>
      </div>
    </main>
  );
}

function StageBlock({
  stage,
  index,
  done,
  onToggle,
}: {
  stage: RoadmapStage;
  index: number;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const stageDone = stage.nodes.every((n) => done[n.id]);
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.05, 0.3) }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs shrink-0 transition-colors"
          style={{
            borderColor: stageDone ? "var(--live)" : "var(--hairline-strong)",
            background: stageDone ? "var(--live)" : "var(--panel)",
            color: stageDone ? "#fff" : "var(--red)",
          }}
        >
          {stageDone ? <Check className="h-4 w-4" strokeWidth={3} /> : index}
        </span>
        <h2 className="font-display font-bold text-lg tracking-tight">{stage.title}</h2>
      </div>

      <div className="sm:pl-12 grid gap-4 md:grid-cols-2">
        {stage.nodes.map((node) => {
          const isDone = !!done[node.id];
          return (
            <div
              key={node.id}
              className="card rounded-2xl p-5"
              data-live="false"
              style={{ opacity: isDone ? 0.72 : 1 }}
            >
              <div className="flex items-start gap-3">
                <DoneCheck done={isDone} onClick={() => onToggle(node.id)} />
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-display font-semibold text-[0.95rem] leading-snug"
                    style={{ textDecoration: isDone ? "line-through" : "none" }}
                  >
                    {node.title}
                  </h3>
                  <p className="text-sm text-muted mt-1.5 leading-relaxed">{node.why}</p>
                  <div className="mt-3 space-y-1.5">
                    {node.resources.map((r) => (
                      <ResourceLink key={r.url + r.label} r={r} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
