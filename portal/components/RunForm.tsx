"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock, Play, Settings, X } from "lucide-react";
import type { Capability, Field } from "@/lib/capabilities";
import { CapIcon } from "./icons";
import { useApp } from "./AppProvider";
import { initialsOf } from "./session";
import { Portal } from "./Portal";

export function RunForm() {
  const { launchCap, closeLaunch } = useApp();
  return (
    <Portal>
      <AnimatePresence>
        {launchCap && <Inner key={launchCap.id} cap={launchCap} onClose={closeLaunch} />}
      </AnimatePresence>
    </Portal>
  );
}

function Inner({ cap, onClose }: { cap: Capability; onClose: () => void }) {
  const { ready, login, adoIdentity, queueJob, openMonitor, closeLaunch } = useApp();
  const runAs = adoIdentity ?? login ?? "your token";
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of cap.fields) init[f.key] = f.default ?? (f.type === "toggle" ? false : "");
    return init;
  });

  const missing = useMemo(
    () =>
      cap.fields
        .filter((f) => f.required && !String(values[f.key] ?? "").trim())
        .map((f) => f.label),
    [cap.fields, values],
  );
  const canRun = missing.length === 0 && (cap.credGate === "none" || ready);

  function run() {
    if (!canRun) return;
    const id = queueJob(cap, values);
    closeLaunch();
    openMonitor(id);
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
      <motion.aside
        className="fixed right-0 top-0 z-[61] h-full w-full max-w-[34rem] panel border-l overflow-y-auto"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
      >
        <div className="sticky top-0 z-10 panel border-b px-7 py-5 flex items-start justify-between">
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
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-lg hover:bg-white/5 text-muted hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-7 py-6">
          <p className="text-sm text-[var(--ink-dim)] leading-relaxed">{cap.description}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-[0.7rem] font-mono text-muted">
            <Meta label={cap.estDuration} icon={<Clock className="h-3 w-3" />} />
            {cap.pipeline ? <Meta label={cap.pipeline.split("/").pop() ?? cap.pipeline} /> : null}
          </div>

          <div className="mt-7 space-y-5">
            {cap.fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                value={values[f.key]}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            ))}

            {ready ? (
              <div className="rounded-xl border border-[var(--hairline)] p-3.5 flex items-center gap-3">
                <span
                  className="grid place-items-center h-9 w-9 rounded-full text-xs font-semibold text-white shrink-0"
                  style={{ background: "linear-gradient(160deg,#5aa8ff,#3a6fd8)" }}
                >
                  {initialsOf(runAs)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Running as {runAs}</p>
                  <p className="text-xs text-live font-mono flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5" /> Copilot token ready
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="text-xs text-muted hover:text-ink transition-colors shrink-0"
                >
                  Change
                </Link>
              </div>
            ) : (
              <Link
                href="/settings"
                onClick={closeLaunch}
                className="block w-full rounded-xl border border-dashed border-[var(--hairline-strong)] p-4 hover:border-red transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-red shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Connect your Copilot token</p>
                    <p className="text-xs text-muted">
                      Add it once in Settings — every run uses your own token.
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {missing.length > 0 && (
              <ul className="text-xs text-soon space-y-1">
                {missing.map((m) => (
                  <li key={m}>• {m} is required</li>
                ))}
              </ul>
            )}

            <button
              onClick={run}
              disabled={!canRun}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(180deg, var(--red-bright), var(--red))",
                boxShadow: canRun ? "0 12px 30px -10px var(--red-glow)" : "none",
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              Queue run
            </button>
          </div>
        </div>
      </motion.aside>
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

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "toggle") {
    const on = Boolean(value);
    return (
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="w-full flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] px-3.5 py-3 text-left"
      >
        <span className="text-sm">{field.label}</span>
        <span
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ background: on ? "var(--red)" : "var(--hairline-strong)" }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: on ? "1.375rem" : "0.125rem" }}
          />
        </span>
      </button>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {field.label}
        {field.required && <span className="text-red ml-1">*</span>}
      </label>
      {field.type === "select" ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm focus:border-red transition-colors"
        >
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm placeholder:text-faint focus:border-red transition-colors resize-none"
        />
      ) : (
        <input
          type={field.type === "url" ? "url" : "text"}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm placeholder:text-faint focus:border-red transition-colors"
        />
      )}
      {field.help && <p className="text-xs text-muted mt-1.5">{field.help}</p>}
    </div>
  );
}
