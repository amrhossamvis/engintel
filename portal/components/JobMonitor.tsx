"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Loader,
  Terminal,
  X,
} from "lucide-react";
import { STAGES, useApp, type BreakdownItem, type Job, type WikiPage } from "./AppProvider";
import { CapIcon } from "./icons";
import { ExecDashboardResult } from "./ExecDashboardResult";
import type { ExecDashboardOutput } from "@/lib/inline/exec-dashboard";
import { ProductivityResult } from "./ProductivityResult";
import type { ProductivityOutput } from "@/lib/productivity";
import { SprintHealthResult } from "./SprintHealthResult";
import type { SprintHealthOutput } from "@/lib/sprint-health";
import { getCapability } from "@/lib/capabilities";
import { Portal } from "./Portal";
import { WikiWeaverReview } from "./WikiWeaverReview";
import { PrImpactResult } from "./PrImpactResult";
import type { PrImpactOutput } from "@/lib/local/pr-impact-analyzer";

type StepVisual = "done" | "active" | "failed" | "idle";

function StepRow({ label, st }: { label: string; st: StepVisual }) {
  const border = st === "idle" ? "var(--hairline-strong)" : st === "failed" ? "var(--red-bright)" : "var(--red)";
  const bg = st === "done" ? "var(--red)" : st === "failed" ? "var(--red-bright)" : "transparent";
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className="grid place-items-center h-5 w-5 rounded-full border shrink-0"
        style={{ borderColor: border, background: bg }}
      >
        {st === "done" ? (
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        ) : st === "failed" ? (
          <X className="h-3 w-3 text-white" strokeWidth={3} />
        ) : st === "active" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-red blink" />
        ) : null}
      </span>
      <span style={{ color: st === "idle" ? "var(--muted)" : "var(--ink)" }}>{label}</span>
    </li>
  );
}

export function JobMonitor() {
  const { monitorJobId, jobs, closeMonitor } = useApp();
  const job = jobs.find((j) => j.id === monitorJobId) ?? null;
  return (
    <Portal>
      <AnimatePresence>
        {job && <Inner key={job.id} job={job} onClose={closeMonitor} />}
      </AnimatePresence>
    </Portal>
  );
}

function Inner({ job, onClose }: { job: Job; onClose: () => void }) {
  const logRef = useRef<HTMLDivElement>(null);
  const done = job.status === "done";
  // Pipeline-blocked runs report status "failed" (ADO exit code convention);
  // local-execution blocked runs report status "done" with outcome "blocked"
  // (a local job only fails on a thrown exception, and a blocked review is a
  // successful review, not an exception) — outcome alone covers both.
  const blocked = job.outcome === "blocked";
  const errored = job.status === "failed" && job.outcome !== "blocked";
  const failed = job.status === "failed";
  const isInline = getCapability(job.capId)?.execution === "hub-inline";
  const isLocalRun = getCapability(job.capId)?.execution === "local";
  const prImpactMeta =
    job.capId === "pr-impact-analyzer" && job.output && typeof job.output === "object"
      ? (job.output as { prCommentPosted?: boolean; prCommentError?: string })
      : null;
  // Local runs happen in-process on this server (no ADO pipeline), so the
  // 5-step ADO agent-pool progress list doesn't apply — same as hub-inline.
  const skipStepList = isInline || isLocalRun;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job.log.length]);

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
              <CapIcon name={job.icon} className="h-5 w-5" style={{ color: "var(--red)" }} />
            </div>
            <div>
              <p className="kicker">{skipStepList ? "Hub · in-app run" : `ADO Run #${job.runId}`}</p>
              <h2 className="font-display text-lg font-semibold leading-tight">{job.capName}</h2>
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
          <div className="flex items-center justify-between mb-5">
            <span className="kicker">{skipStepList ? "Status" : "Pipeline progress"}</span>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider"
              style={{ color: blocked ? "var(--soon)" : done ? "var(--live)" : errored ? "var(--red)" : "var(--soon)" }}
            >
              {blocked ? (
                <CircleAlert className="h-3.5 w-3.5" />
              ) : done ? (
                <CircleCheck className="h-3.5 w-3.5" />
              ) : failed ? (
                <CircleAlert className="h-3.5 w-3.5" />
              ) : (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              )}
              {blocked
                ? "changes requested"
                : errored
                  ? "failed"
                  : job.currentStep && !done
                    ? job.currentStep
                    : job.status}
            </span>
          </div>

          {!skipStepList && (
            <ol className="space-y-2.5 mb-6 max-h-56 overflow-y-auto pr-1">
              {job.steps.length > 0
                ? job.steps.map((s) => {
                    const st =
                      s.result === "succeeded"
                        ? "done"
                        : s.result === "failed" || s.result === "canceled"
                          ? "failed"
                          : s.state === "inProgress"
                            ? "active"
                            : "idle";
                    return <StepRow key={s.name} label={s.name} st={st} />;
                  })
                : STAGES.map((s, i) => {
                    const st = i < job.stage || done ? "done" : i === job.stage ? "active" : "idle";
                    return <StepRow key={s} label={s} st={st} />;
                  })}
            </ol>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-3.5 w-3.5 text-muted" />
            <span className="kicker">Live log</span>
          </div>
          <div
            ref={logRef}
            className="rounded-xl border border-[var(--hairline)] p-3.5 h-72 overflow-y-auto font-mono text-[0.72rem] leading-relaxed whitespace-pre-wrap break-words"
            style={{ background: "var(--log-bg)", color: "#cfcfd6" }}
          >
            {job.log.length === 0 ? (
              <span className="text-faint">
                {job.status === "queued" ? "waiting for agent…" : "fetching agent log…"}
              </span>
            ) : (
              job.log.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-faint select-none shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span>{l}</span>
                </div>
              ))
            )}
          </div>

          {(done || failed) && (
            <div
              className="mt-6 rounded-xl border p-4 flex items-start gap-3"
              style={{
                borderColor: `color-mix(in srgb, ${blocked ? "var(--soon)" : done ? "var(--live)" : "var(--red)"} 30%, transparent)`,
                background: `color-mix(in srgb, ${blocked ? "var(--soon)" : done ? "var(--live)" : "var(--red)"} 7%, transparent)`,
              }}
            >
              {blocked ? (
                <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--soon)" }} />
              ) : done ? (
                <CircleCheck className="h-5 w-5 text-live shrink-0 mt-0.5" />
              ) : (
                <CircleAlert className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--red)" }} />
              )}
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {done && job.wikiDraft
                    ? "Wiki page generated — review it below before publishing."
                    : done && job.wikiPages && job.wikiPages.length > 0
                    ? `${job.wikiDryRun ? "Dry run — wiki page would be published." : "Wiki page published to Azure DevOps."}`
                    : done && typeof job.createdCount === "number"
                    ? `${job.dryRun ? "Dry run — " : "Breakdown complete — "}${job.createdCount} work item(s) ${job.dryRun ? "would be created" : "created"} in Azure DevOps.${typeof job.linkedCount === "number" ? ` · ${job.linkedCount} story(ies) re-linked.` : ""}`
                    : blocked
                      ? "Review complete · changes requested — not ready to merge."
                      : done && job.capId === "pr-impact-analyzer"
                        ? prImpactMeta?.prCommentPosted
                          ? "Impact analysis complete — summary posted to the PR comment thread."
                          : "Impact analysis complete — could not post PR comment (see warning in log)."
                      : done && isInline
                        ? "Analysis complete."
                        : done
                          ? "Review complete — results posted to Azure DevOps."
                          : "Run failed — see the log above for the failing step."}
                </p>
                {blocked && (
                  <p className="text-xs text-muted mt-1">
                    Comments are posted on the PR.
                    {typeof job.blockingCount === "number" && ` ${job.blockingCount} blocking high-severity finding(s).`}
                    {typeof job.mergeConfidence === "number" && ` Merge confidence ${job.mergeConfidence}%.`}
                  </p>
                )}
                {done && job.wikiPages && job.wikiPages.length > 0 && (
                  <a
                    href={job.wikiPages[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline mt-1.5 text-xs font-mono"
                    style={{ color: "var(--live)" }}
                  >
                    Open wiki page <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {job.webUrl && (
                  <a
                    href={job.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline mt-1.5 text-xs font-mono"
                    style={{ color: blocked ? "var(--soon)" : done ? "var(--live)" : "var(--red)" }}
                  >
                    View in Azure DevOps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {done && job.items && job.items.length > 0 && <BreakdownTree items={job.items} />}

          {done && job.wikiDraft && <WikiWeaverReview draft={job.wikiDraft} />}

          {done && job.wikiPages && job.wikiPages.length > 1 && <WikiPageList pages={job.wikiPages} />}

          {job.locus === "hub-inline" && job.status === "done" && job.output && job.capId === "exec-dashboard" ? (
            <ExecDashboardResult output={job.output as ExecDashboardOutput} />
          ) : null}

          {job.locus === "hub-inline" && job.status === "done" && job.output && job.capId === "ai-productivity" ? (
            <ProductivityResult output={job.output as ProductivityOutput} />
          ) : null}

          {job.locus === "hub-inline" && job.status === "done" && job.output && job.capId === "sprint-health" ? (
            <SprintHealthResult output={job.output as SprintHealthOutput} />
          ) : null}

          {job.locus === "local" && job.status === "done" && job.output && job.capId === "pr-impact-analyzer" ? (
            <PrImpactResult output={job.output as PrImpactOutput} />
          ) : null}
        </div>
      </motion.aside>
    </>
  );
}

/** Renders the published wiki page(s) as a simple clickable list. */
function WikiPageList({ pages }: { pages: WikiPage[] }) {
  return (
    <div className="mt-5">
      <p className="kicker mb-2">Wiki pages published</p>
      <ul className="rounded-xl border border-[var(--hairline)] p-3 max-h-56 overflow-y-auto">
        {pages.map((p) => (
          <li key={p.url} className="flex items-center gap-2.5 py-1">
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink hover:underline inline-flex items-center gap-1 min-w-0"
            >
              <span className="truncate">{p.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renders the created/linked work items as a clickable Epic › Feature › Story tree. */
function BreakdownTree({ items }: { items: BreakdownItem[] }) {
  const ids = new Set(items.map((i) => i.id));
  const render = (it: BreakdownItem, depth: number): ReactNode[] => {
    const kids = items.filter((c) => c.parent === it.id);
    return [
      <li
        key={it.id}
        className="flex items-center gap-2.5 py-1"
        style={{ paddingLeft: `${depth * 1.15}rem` }}
      >
        <span className="text-[0.58rem] font-mono uppercase tracking-wider text-muted shrink-0 w-[4.5rem]">
          {it.type}
        </span>
        {it.url ? (
          <a
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-ink hover:underline inline-flex items-center gap-1 min-w-0"
          >
            <span className="truncate">{it.title}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted" />
          </a>
        ) : (
          <span className="text-xs text-ink truncate">{it.title}</span>
        )}
      </li>,
      ...kids.flatMap((k) => render(k, depth + 1)),
    ];
  };
  const roots = items.filter((i) => !ids.has(i.parent));
  return (
    <div className="mt-5">
      <p className="kicker mb-2">Created work items</p>
      <ul className="rounded-xl border border-[var(--hairline)] p-3 max-h-56 overflow-y-auto">
        {roots.flatMap((r) => render(r, 0))}
      </ul>
    </div>
  );
}
