"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Clock, Lock, Pyramid, Sparkles, X } from "lucide-react";
import type { Capability } from "@/lib/capabilities";
import { CapIcon } from "./icons";
import { FeedbackButton } from "./FeedbackButton";
import { useApp } from "./AppProvider";
import { Portal } from "./Portal";

export function CapabilityModal() {
  const { detailCap, closeDetail } = useApp();
  return (
    <Portal>
      <AnimatePresence>
        {detailCap && <Inner key={detailCap.id} cap={detailCap} onClose={closeDetail} />}
      </AnimatePresence>
    </Portal>
  );
}

function Inner({ cap, onClose }: { cap: Capability; onClose: () => void }) {
  const { openLaunch } = useApp();
  const live = cap.status === "live";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function launch() {
    onClose();
    openLaunch(cap);
  }

  return (
    <>
      <motion.div
        className="scrim fixed inset-0 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[61] grid place-items-center px-6 pointer-events-none">
        <motion.div
          role="dialog"
          aria-modal="true"
          className="panel border rounded-2xl w-full max-w-lg overflow-hidden pointer-events-auto"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
        >
          <div className="px-7 py-5 border-b flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="grid place-items-center h-11 w-11 rounded-2xl border"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--panel-2)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
                }}
              >
                <CapIcon name={cap.icon} className="h-5 w-5" style={{ color: "var(--red)" }} />
              </div>
              <div>
                <p className="kicker">{cap.category}</p>
                <h2 className="font-display text-lg font-semibold leading-tight">{cap.name}</h2>
                <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-mono uppercase tracking-wider text-muted mt-1">
                  <Pyramid className="h-3 w-3 shrink-0" strokeWidth={1.8} style={{ color: "var(--red)" }} />
                  {cap.codename}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-muted hover:text-ink transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-7 py-6">
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

            <p className="text-sm text-[var(--ink-dim)] leading-relaxed mt-3">{cap.description}</p>

            <div
              className="mt-5 rounded-xl border px-4 py-3.5"
              style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
            >
              <p
                className="font-mono text-[0.65rem] uppercase tracking-[0.2em] inline-flex items-center gap-1.5"
                style={{ color: "var(--red)" }}
              >
                <Pyramid className="h-3 w-3 shrink-0" strokeWidth={1.8} />
                Why “{cap.codename}”?
              </p>
              <p className="text-[0.82rem] text-[var(--ink-dim)] leading-relaxed mt-2">
                <span className="text-ink font-medium">Who they were. </span>
                {cap.codenameWho}
              </p>
              <p className="text-[0.82rem] text-[var(--ink-dim)] leading-relaxed mt-2">
                <span className="text-ink font-medium">Why it fits. </span>
                {cap.codenameWhy}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-[0.7rem] font-mono text-muted">
              <Meta label={cap.estDuration} icon={<Clock className="h-3 w-3" />} />
              <Meta label={cap.category} icon={<Sparkles className="h-3 w-3" />} />
            </div>
          </div>

          <div className="px-7 py-5 border-t flex items-center justify-between gap-3">
            <FeedbackButton capabilityId={cap.id} capabilityTitle={cap.name} />
            <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              Close
            </button>
            <button
              disabled={!live}
              onClick={launch}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(180deg, var(--red-bright), var(--red))",
                boxShadow: live ? "0 12px 30px -10px var(--red-glow)" : "none",
              }}
            >
              {live ? "Launch" : "In development"}
              {live && <ArrowRight className="h-4 w-4" />}
            </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

function Meta({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-1">
      {icon}
      {label}
    </span>
  );
}
