"use client";

import { motion } from "motion/react";
import { ArrowRight, CalendarClock, Clock, Info, Lock, Workflow } from "lucide-react";
import type { Capability } from "@/lib/capabilities";
import { CapIcon } from "./icons";
import { CapabilityBadges } from "./CapabilityBadges";
import { useApp } from "./AppProvider";

export function CapabilityCard({
  cap,
  index,
  onLaunchAction,
}: {
  cap: Capability;
  index: number;
  onLaunchAction: (cap: Capability) => void;
}) {
  const { openDetail } = useApp();
  const live = cap.status === "live";
  const idx = String(index + 1).padStart(2, "0");

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 * index, ease: [0.16, 1, 0.3, 1] }}
      className="card rounded-2xl p-6 flex flex-col min-h-[15.5rem]"
      data-live={live}
      onMouseMove={handleMove}
    >
      <div className="accent-bar" />

      {/* signature index watermark */}
      <span
        className="pointer-events-none absolute -bottom-3 right-2 font-display font-extrabold leading-none select-none"
        style={{ fontSize: "5.5rem", color: "var(--ink)", opacity: 0.035 }}
      >
        {idx}
      </span>

      <div className="flex items-start justify-between">
        <div
          className="grid place-items-center h-12 w-12 rounded-2xl border"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--panel-2)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          <CapIcon name={cap.icon} className="h-[1.4rem] w-[1.4rem]" style={{ color: "var(--red)" }} />
        </div>

        <div className="flex flex-col items-end gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase tracking-wider text-live">
              <span className="pulse h-1.5 w-1.5 rounded-full bg-live text-live" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase tracking-wider text-soon">
              <Lock className="h-3 w-3" strokeWidth={2} />
              Soon
            </span>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="kicker">{cap.category}</p>
        <h3 className="font-display text-xl font-semibold mt-1.5 leading-tight">{cap.name}</h3>
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase tracking-wider text-muted mt-1.5">
          <Workflow className="h-3 w-3 shrink-0" strokeWidth={1.8} style={{ color: "var(--red)" }} />
          {cap.codename}
        </p>
        <p className="text-sm text-[var(--ink-dim)] mt-2 leading-relaxed line-clamp-2">
          {cap.tagline}
        </p>
        <div className="mt-3">
          <CapabilityBadges provider={cap.provider} execution={cap.execution} />
        </div>
      </div>

      <div className="mt-auto pt-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted">
            {!live && cap.targetRelease ? (
              <>
                <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.8} />
                {cap.targetRelease}
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
                {cap.estDuration}
              </>
            )}
          </span>
          <button
            onClick={() => openDetail(cap)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink transition-colors"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.8} />
            Details
          </button>
        </div>

        <button
          disabled={!live}
          onClick={() => onLaunchAction(cap)}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink disabled:text-faint disabled:cursor-not-allowed enabled:hover:text-red transition-colors"
          style={{ color: live ? undefined : "var(--faint)" }}
        >
          {live ? "Launch" : "In development"}
          {live && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
