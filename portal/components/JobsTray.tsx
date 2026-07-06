"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Layers, Loader } from "lucide-react";
import { STAGES, useApp, type Job } from "./AppProvider";
import { CapIcon } from "./icons";

export function JobsTray() {
  const { jobs, activeJobs, openMonitor } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid place-items-center h-10 w-10 rounded-xl border border-[var(--hairline)] hover:bg-white/5 transition-colors"
        aria-label="Jobs"
      >
        <Layers className="h-[1.05rem] w-[1.05rem]" />
        {activeJobs.length > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 grid place-items-center min-w-5 h-5 px-1 rounded-full text-[0.62rem] font-mono font-semibold text-white"
            style={{ background: "var(--red)", boxShadow: "0 0 0 2px var(--canvas)" }}
          >
            {activeJobs.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              className="panel absolute right-0 top-12 z-50 w-80 rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" }}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
            >
              <div className="px-4 py-3 border-b border-[var(--hairline)] flex items-center justify-between">
                <span className="kicker">Pipeline jobs</span>
                <span className="text-[0.7rem] font-mono text-muted">
                  {activeJobs.length} active
                </span>
              </div>

              {jobs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted">No runs yet.</p>
                  <p className="text-xs text-faint mt-1">Launch a capability to queue a job.</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      <button
                        onClick={() => {
                          openMonitor(j.id);
                          setOpen(false);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                      >
                        <div
                          className="grid place-items-center h-9 w-9 rounded-xl border shrink-0"
                          style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
                        >
                          <CapIcon
                            name={j.icon}
                            className="h-4 w-4"
                            style={{ color: "var(--red)" }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{j.capName}</p>
                            <Status job={j} />
                          </div>
                          <p className="text-[0.68rem] font-mono text-muted truncate mt-0.5">
                            #{j.runId} · {progressLabel(j)}
                          </p>
                          <div className="meter-track h-1 mt-2">
                            <div
                              className="meter-fill"
                              style={{ width: `${jobPct(j)}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function jobPct(j: Job) {
  if (j.status === "done") return 100;
  if (j.status === "failed") return 100;
  if (j.status === "queued") return 6;
  if (j.steps.length) {
    const total = j.steps.length;
    const finished = j.steps.filter((s) => s.result && s.result !== "skipped").length;
    return Math.max(8, Math.round((finished / total) * 100));
  }
  return Math.round(((j.stage + 1) / STAGES.length) * 100);
}

function progressLabel(j: Job) {
  if (j.status === "done") return "complete";
  if (j.status === "failed") return j.outcome === "blocked" ? "changes requested" : "failed";
  if (j.status === "queued") return "queued";
  return j.currentStep ?? STAGES[j.stage];
}

function Status({ job }: { job: Job }) {
  if (job.status === "done")
    return <CircleCheck className="h-3.5 w-3.5 text-live shrink-0" />;
  if (job.status === "failed")
    return (
      <CircleAlert
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: job.outcome === "blocked" ? "var(--soon)" : "var(--red)" }}
      />
    );
  return <Loader className="h-3.5 w-3.5 text-soon animate-spin shrink-0" />;
}
