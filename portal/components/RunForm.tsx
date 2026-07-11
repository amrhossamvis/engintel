"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Clock, Play, Settings, X } from "lucide-react";
import type { Capability, Field } from "@/lib/capabilities";
import { CapIcon } from "./icons";
import { useApp } from "./AppProvider";
import { initialsOf } from "./session";
import { Portal } from "./Portal";

type ClassificationNode = { name: string; path: string };

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Find the best-matching ADO area node for a team name. Splits on " - "
 * (team names like "MVA - Alex" name a tribe and a sub-squad, whose area is
 * typically nested "...\MVA\Alex", not a single node named "MVA - Alex")
 * and requires every part to appear as its own path SEGMENT somewhere in the
 * candidate's full path — not just a substring of the leaf name. Checking
 * only the leaf previously let an unrelated node merely named "MVA" (e.g.
 * under a completely different team) win over the real "...\MVA\Alex" node,
 * since "mva" is a substring of "mvaalex" regardless of where it sits in the
 * tree. Ranks candidates so an exact-segment match beats a partial one, and
 * a match on the node's own leaf (the most specific part, last in the split)
 * beats one that only matched on the tribe segment.
 */
function findAreaMatch(teamName: string, nodes: ClassificationNode[]): ClassificationNode | null {
  const parts = teamName
    .split(/\s*-\s*/)
    .map((p) => slug(p))
    .filter(Boolean);
  if (!parts.length) return null;
  const leafPart = parts[parts.length - 1];

  let best: { node: ClassificationNode; score: number } | null = null;
  for (const node of nodes) {
    const segments = node.path.split("\\").map(slug);
    let score = 0;
    let allMatched = true;
    for (const part of parts) {
      if (segments.includes(part)) score += 2;
      else if (segments.some((s) => s.includes(part) || part.includes(s))) score += 1;
      else {
        allMatched = false;
        break;
      }
    }
    if (!allMatched) continue;
    const leafSlug = segments[segments.length - 1];
    if (leafSlug === leafPart) score += 3;
    if (!best || score > best.score) best = { node, score };
  }
  return best?.node ?? null;
}

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
  const { ready, login, adoIdentity, adoPat, queueJob, openMonitor, closeLaunch } = useApp();
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

  // Auto-fill the area path from the selected team, when both fields exist
  // on this capability's form and the area path is still empty — never
  // overrides a value the user has already set or typed over.
  const teamField = cap.fields.find((f) => f.type === "team-select");
  const areaField = cap.fields.find((f) => f.type === "ado-area-path");
  const [areaNodes, setAreaNodes] = useState<ClassificationNode[]>([]);
  const selectedTeam = teamField ? String(values[teamField.key] ?? "").trim() : "";
  /** Tracks the value we last auto-filled, so re-selecting a team can still update it — only a value that differs from this (i.e. one the user typed themselves) is left alone. */
  const lastAutoFilledArea = useRef<string | null>(null);

  useEffect(() => {
    if (!areaField) return;
    let cancelled = false;
    fetch(`/api/ado/classification?kind=areas`, { headers: adoPat ? { "x-ado-pat": adoPat } : {} })
      .then((r) => r.json())
      .then((d: { nodes?: ClassificationNode[] }) => {
        if (!cancelled) setAreaNodes(d.nodes ?? []);
      })
      .catch(() => {
        if (!cancelled) setAreaNodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [areaField, adoPat]);

  useEffect(() => {
    if (!teamField || !areaField || !selectedTeam) return;
    const currentValue = String(values[areaField.key] ?? "").trim();
    // Only stand down if the current value is something other than what we
    // last auto-filled — that means the user typed over it themselves, so a
    // fresh team selection shouldn't clobber their explicit choice. A value
    // that still matches our last auto-fill (or no value at all) is fair
    // game to update for the newly selected team.
    if (currentValue && currentValue !== lastAutoFilledArea.current) return;

    const match = findAreaMatch(selectedTeam, areaNodes);
    if (match) {
      if (match.path !== currentValue) {
        lastAutoFilledArea.current = match.path;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form state from an external source (ADO area tree) once the team selection resolves, not a render-triggered loop
        setValues((s) => ({ ...s, [areaField.key]: match.path }));
      }
    } else if (currentValue && currentValue === lastAutoFilledArea.current) {
      // The newly selected team has no area match, and the current value is
      // just a leftover auto-fill from a previous team (not something the
      // user typed) — clear it rather than leaving a stale value that looks
      // like it applies to the new team but doesn't.
      lastAutoFilledArea.current = null;
      setValues((s) => ({ ...s, [areaField.key]: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes `values` to avoid re-firing on every keystroke; re-derives only when team/areaNodes change
  }, [selectedTeam, areaNodes, teamField, areaField]);

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
                adoPat={adoPat}
                areaNodes={f.type === "ado-area-path" ? areaNodes : undefined}
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
  adoPat,
  areaNodes,
}: {
  field: Field;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  adoPat?: string;
  /** Pre-fetched area-path nodes, passed down when the parent form already loaded them for auto-fill. Avoids a duplicate fetch for the "ado-area-path" field specifically. */
  areaNodes?: ClassificationNode[];
}) {
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [iterationNodes, setIterationNodes] = useState<ClassificationNode[]>([]);
  const [fetchedAreaNodes, setFetchedAreaNodes] = useState<ClassificationNode[]>([]);

  useEffect(() => {
    if (field.type !== "team-select") return;
    let cancelled = false;
    fetch("/api/ado/teams")
      .then((r) => r.json())
      .then((d: { teams?: string[] }) => {
        if (!cancelled) setTeamOptions(d.teams ?? []);
      })
      .catch(() => {
        if (!cancelled) setTeamOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [field.type]);

  useEffect(() => {
    if (field.type !== "ado-iteration-path") return;
    let cancelled = false;
    fetch(`/api/ado/classification?kind=iterations`, { headers: adoPat ? { "x-ado-pat": adoPat } : {} })
      .then((r) => r.json())
      .then((d: { nodes?: ClassificationNode[] }) => {
        if (!cancelled) setIterationNodes(d.nodes ?? []);
      })
      .catch(() => {
        if (!cancelled) setIterationNodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [field.type, adoPat]);

  useEffect(() => {
    if (field.type !== "ado-area-path" || areaNodes) return; // parent already provides these when it fetched them itself
    let cancelled = false;
    fetch(`/api/ado/classification?kind=areas`, { headers: adoPat ? { "x-ado-pat": adoPat } : {} })
      .then((r) => r.json())
      .then((d: { nodes?: ClassificationNode[] }) => {
        if (!cancelled) setFetchedAreaNodes(d.nodes ?? []);
      })
      .catch(() => {
        if (!cancelled) setFetchedAreaNodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [field.type, adoPat, areaNodes]);

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

  const listId = `dl-${field.key}`;

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
      ) : field.type === "team-select" ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm focus:border-red transition-colors"
        >
          <option value="">— none (generic instructions) —</option>
          {teamOptions.map((t) => (
            <option key={t} value={t}>
              {t}
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
      ) : field.type === "ado-area-path" || field.type === "ado-iteration-path" ? (
        <>
          <input
            list={listId}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full rounded-xl bg-[var(--canvas)] border border-[var(--hairline)] px-3.5 py-3 text-sm placeholder:text-faint focus:border-red transition-colors"
          />
          <datalist id={listId}>
            {(field.type === "ado-area-path" ? areaNodes ?? fetchedAreaNodes : iterationNodes).map((n) => (
              <option key={n.path} value={n.path} />
            ))}
          </datalist>
        </>
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
