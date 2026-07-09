/**
 * Server-only in-process job runner for "local"-execution capabilities — the
 * direct-REST replacement for ADO Pipeline execution. A capability handler
 * runs entirely inside this Node process (this app is self-hosted/Docker per
 * the README, not serverless, so multi-minute requests are fine), emitting
 * progress lines as it works. Job state lives in memory only: no new Postgres
 * dependency, matching how pipeline runs already treat ADO as the source of
 * truth rather than this app. Trade-off: a server restart mid-run loses that
 * job's live progress in the UI, though any ADO writes already made are not
 * undone.
 */

import { randomUUID } from "node:crypto";

export type LocalJobStatus = "running" | "done" | "failed";

/** Well-known result fields the UI already knows how to render, plus anything capability-specific. */
export type LocalJobResult = {
  webUrl?: string;
  [key: string]: unknown;
};

export type LocalCtx = {
  /** Resolved ADO auth header (caller's PAT → az login → service PAT), reused for the whole run. */
  adoAuth: string;
  githubToken: string;
  /** Append a line to the job's live log, shown in the UI's log panel. */
  emit: (line: string) => void;
};

export type LocalHandler = (
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
) => Promise<LocalJobResult | void>;

export type LocalJobState = {
  status: LocalJobStatus;
  log: string[];
  result?: LocalJobResult;
  error?: string;
};

const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map<string, LocalJobState>();

function scheduleCleanup(jobId: string): void {
  setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref();
}

/** Starts a handler in the background and returns its jobId immediately. */
export function startLocalJob(
  handler: LocalHandler,
  inputs: Record<string, string | boolean>,
  ctx: { adoAuth: string; githubToken: string },
): string {
  const jobId = randomUUID();
  const state: LocalJobState = { status: "running", log: [] };
  jobs.set(jobId, state);

  const emit = (line: string) => {
    state.log.push(line);
  };

  handler(inputs, { ...ctx, emit })
    .then((result) => {
      state.status = "done";
      state.result = result ?? {};
    })
    .catch((e) => {
      state.status = "failed";
      state.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => scheduleCleanup(jobId));

  return jobId;
}

export function getLocalJob(jobId: string): LocalJobState | undefined {
  return jobs.get(jobId);
}

// ---------------------------------------------------------------------------
// Handler registry — one entry per ported capability.
// ---------------------------------------------------------------------------

export const LOCAL_HANDLERS: Record<string, LocalHandler> = {};
