"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Capability, Execution } from "@/lib/capabilities";
import type { Theme } from "./session";

export type TokenStatus = "idle" | "checking" | "valid" | "invalid";

export type JobStatus = "queued" | "running" | "done" | "failed";

export type JobStep = { name: string; state: string; result?: string };

export type BreakdownItem = { type: string; id: number; title: string; parent: number; url: string };

export type WikiPage = { title: string; url: string };

export type Job = {
  id: number;
  runId: number;
  capId: string;
  capName: string;
  icon: string;
  status: JobStatus;
  stage: number; // index into STAGES (simulation only)
  steps: JobStep[]; // real ADO steps (live runs)
  currentStep: string | null;
  log: string[];
  values: Record<string, string | boolean>;
  live: boolean; // true = real ADO run, false = local simulation
  webUrl?: string;
  /** when status==='failed': 'blocked' = review ok but PR not mergeable; 'error' = real failure */
  outcome?: "blocked" | "error" | null;
  blockingCount?: number | null;
  mergeConfidence?: number | null;
  /** Work Item Breakdown result, parsed from the BREAKDOWN SUMMARY marker */
  createdCount?: number | null;
  linkedCount?: number | null;
  dryRun?: boolean;
  items?: BreakdownItem[] | null;
  /** Wiki Weaver result, parsed from the WIKI SUMMARY / WIKI PAGES markers */
  wikiPages?: WikiPage[] | null;
  wikiDryRun?: boolean;
  locus?: Execution;
  output?: unknown;
};

export const STAGES = [
  "Queued on ADO agent pool",
  "Checkout repo + install Copilot CLI",
  "Build context bundle",
  "Run GitHub Copilot CLI",
  "Parse findings + post to Azure DevOps",
];

type AppState = {
  theme: Theme;
  setTheme: (t: Theme) => void;

  githubToken: string;
  setGithubToken: (v: string) => void;
  tokenStatus: TokenStatus;
  login: string | null;
  validateToken: (token: string) => void;

  // Per-user Azure DevOps PAT — bring-your-own identity for a shared/Docker hub
  // where the server has no `az login`. Sent per request, stored in this browser.
  adoPat: string;
  setAdoPat: (v: string) => void;
  adoPatStatus: TokenStatus;
  adoPatIdentity: string | null;
  validateAdoPat: (pat: string) => void;

  // ADO access (Option B): the host's Azure CLI (`az login`) identity
  adoIdentity: string | null;
  adoChecking: boolean;
  adoLoggingIn: boolean;
  adoLoggingOut: boolean;
  recheckAdo: () => void;
  /** Run `az login` on the host (opens the local browser). Returns false if `az` is missing. */
  loginAdo: () => Promise<boolean>;
  /** Run `az logout` on the host and clear the identity. */
  logoutAdo: () => Promise<void>;

  /** GitHub Copilot token validated → a run can be queued */
  ready: boolean;

  jobs: Job[];
  activeJobs: Job[];
  queueJob: (cap: Capability, values: Record<string, string | boolean>) => number;

  launchCap: Capability | null;
  openLaunch: (cap: Capability) => void;
  closeLaunch: () => void;
  detailCap: Capability | null;
  openDetail: (cap: Capability) => void;
  closeDetail: () => void;
  monitorJobId: number | null;
  openMonitor: (id: number) => void;
  closeMonitor: () => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [githubToken, setGithubTokenState] = useState("");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
  const [login, setLogin] = useState<string | null>(null);
  const [adoPat, setAdoPatState] = useState("");
  const [adoPatStatus, setAdoPatStatus] = useState<TokenStatus>("idle");
  const [adoPatIdentity, setAdoPatIdentity] = useState<string | null>(null);
  const [adoIdentity, setAdoIdentity] = useState<string | null>(null);
  const [adoChecking, setAdoChecking] = useState(false);
  const [adoLoggingIn, setAdoLoggingIn] = useState(false);
  const [adoLoggingOut, setAdoLoggingOut] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [launchCap, setLaunchCap] = useState<Capability | null>(null);
  const [detailCap, setDetailCap] = useState<Capability | null>(null);
  const [monitorJobId, setMonitorJobId] = useState<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    // One-time hydration from browser storage on mount (SSR-safe — a lazy
    // initializer would read localStorage during SSR and mismatch on hydrate).
    /* eslint-disable react-hooks/set-state-in-effect */
    const th = (localStorage.getItem("theme") as Theme) ?? "dark";
    setThemeState(th);
    document.documentElement.dataset.theme = th;
    // GitHub token persists across refresh/restart (localStorage). Trade-off:
    // written to disk on this machine. Acceptable for the local dev hub.
    const tok = localStorage.getItem("gh_token") ?? "";
    setGithubTokenState(tok);
    if (tok) validateToken(tok);
    const pat = localStorage.getItem("ado_pat") ?? "";
    setAdoPatState(pat);
    if (pat) validateAdoPat(pat);
    recheckAdo();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /** Ask the server who `az login` is signed in as. */
  function recheckAdo() {
    setAdoChecking(true);
    fetch("/api/ado/whoami")
      .then((r) => r.json())
      .then((d) => setAdoIdentity(d.name ?? null))
      .catch(() => setAdoIdentity(null))
      .finally(() => setAdoChecking(false));
  }

  /** Spawn `az login` on the host. false = `az` not installed (caller shows install steps). */
  async function loginAdo(): Promise<boolean> {
    setAdoLoggingIn(true);
    try {
      const res = await fetch("/api/ado/login", { method: "POST" });
      const data = await res.json();
      if (data.error === "az_not_found") return false;
      setAdoIdentity(data.name ?? null);
      return true;
    } catch {
      return true; // az exists but login failed/cancelled — not an install problem
    } finally {
      setAdoLoggingIn(false);
    }
  }

  async function logoutAdo() {
    setAdoLoggingOut(true);
    try {
      await fetch("/api/ado/logout", { method: "POST" });
      setAdoIdentity(null);
    } finally {
      setAdoLoggingOut(false);
    }
  }

  async function validateToken(token: string) {
    if (!token || token.trim().length < 8) {
      setTokenStatus("idle");
      setLogin(null);
      return;
    }
    setTokenStatus("checking");
    try {
      const res = await fetch("/api/github/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.valid) {
        setTokenStatus("valid");
        setLogin(data.login ?? null);
      } else {
        setTokenStatus("invalid");
        setLogin(null);
      }
    } catch {
      setTokenStatus("invalid");
      setLogin(null);
    }
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("theme", t);
  }
  function setGithubToken(v: string) {
    setGithubTokenState(v);
    if (v) localStorage.setItem("gh_token", v);
    else localStorage.removeItem("gh_token");
    if (!v) {
      setTokenStatus("idle");
      setLogin(null);
    }
  }

  async function validateAdoPat(pat: string) {
    if (!pat || pat.trim().length < 8) {
      setAdoPatStatus("idle");
      setAdoPatIdentity(null);
      return;
    }
    setAdoPatStatus("checking");
    try {
      const res = await fetch("/api/ado/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat }),
      });
      const data = await res.json();
      if (data.valid) {
        setAdoPatStatus("valid");
        setAdoPatIdentity(data.name ?? null);
      } else {
        setAdoPatStatus("invalid");
        setAdoPatIdentity(null);
      }
    } catch {
      setAdoPatStatus("invalid");
      setAdoPatIdentity(null);
    }
  }
  function setAdoPat(v: string) {
    setAdoPatState(v);
    if (v) localStorage.setItem("ado_pat", v);
    else localStorage.removeItem("ado_pat");
    if (!v) {
      setAdoPatStatus("idle");
      setAdoPatIdentity(null);
    }
  }
  function patch(id: number, fn: (j: Job) => Job) {
    setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j)));
  }
  function appendLog(id: number, line: string) {
    patch(id, (j) => ({ ...j, log: [...j.log, line] }));
  }

  /** Local simulation — used when ADO isn't configured (501 from /api/run). */
  function simulate(id: number, runId: number) {
    const lines = [
      `[agent] pool=macos-latest run=#${runId}`,
      `[setup] node 22 · python 3.13 · @github/copilot ready`,
      `[bundle] wrote 00_instructions.md 01_context.md`,
      `[copilot] streaming model response …`,
      `[post] writing results to dev.azure.com/vfuk-digital`,
      `[done] exit=0`,
    ];
    patch(id, (j) => ({ ...j, status: "running" }));
    let i = 0;
    const tick = setInterval(() => {
      const stage = Math.min(STAGES.length - 1, Math.floor((i / lines.length) * STAGES.length));
      patch(id, (j) => ({ ...j, log: [...j.log, lines[i]], stage }));
      i += 1;
      if (i >= lines.length) {
        clearInterval(tick);
        patch(id, (j) => ({ ...j, stage: STAGES.length - 1 }));
        setTimeout(() => patch(id, (j) => ({ ...j, status: "done" })), 500);
      }
    }, 650);
  }

  /** Poll a real ADO run until it reaches a terminal state. */
  function poll(id: number, pipelineId: number, runId: number) {
    let polls = 0;
    const tick = setInterval(async () => {
      polls += 1;
      if (polls > 150) {
        clearInterval(tick);
        appendLog(id, "[warn] stopped polling after 10 min");
        return;
      }
      try {
        const r = await fetch(`/api/run/status?pipelineId=${pipelineId}&runId=${runId}`, {
          headers: adoPat ? { "x-ado-pat": adoPat } : {},
        });
        const data = await r.json();
        patch(id, (j) => ({
          ...j,
          steps: Array.isArray(data.steps) && data.steps.length ? data.steps : j.steps,
          currentStep: data.currentStep ?? j.currentStep,
          log: Array.isArray(data.logTail) && data.logTail.length ? data.logTail : j.log,
        }));
        if (data.status === "done" || data.status === "failed") {
          clearInterval(tick);
          patch(id, (j) => ({
            ...j,
            status: data.status,
            webUrl: data.webUrl ?? j.webUrl,
            outcome: data.outcome ?? null,
            blockingCount: data.blockingCount ?? null,
            mergeConfidence: data.mergeConfidence ?? null,
            createdCount: data.createdCount ?? null,
            linkedCount: data.linkedCount ?? null,
            dryRun: Boolean(data.dryRun),
            items: Array.isArray(data.items) ? data.items : null,
            wikiPages: Array.isArray(data.wikiPages) ? data.wikiPages : null,
            wikiDryRun: Boolean(data.wikiDryRun),
          }));
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);
  }

  function queueJob(cap: Capability, values: Record<string, string | boolean>) {
    seq.current += 1;
    const id = seq.current;
    const localRunId = 100000 + Math.floor(Math.random() * 800000);
    const job: Job = {
      id,
      runId: localRunId,
      capId: cap.id,
      capName: cap.name,
      icon: cap.icon,
      status: "queued",
      stage: 0,
      steps: [],
      currentStep: null,
      log: [],
      values,
      live: false,
    };
    setJobs((js) => [job, ...js]);

    if (cap.execution === "hub-inline") {
      void (async () => {
        try {
          const res = await fetch(`/api/inline/${cap.id}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(adoPat ? { "x-ado-pat": adoPat } : {}),
            },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) {
            const detail = data.message ? `${data.error}: ${data.message}` : (data.error ?? res.status);
            patch(id, (j) => ({
              ...j,
              status: "failed",
              log: [...j.log, `[inline] error: ${detail}`],
            }));
            return;
          }
          patch(id, (j) => ({
            ...j,
            status: "done",
            locus: "hub-inline",
            output: data.output,
            log: [...j.log, `[inline] completed`],
          }));
        } catch (e) {
          patch(id, (j) => ({
            ...j,
            status: "failed",
            log: [...j.log, `[inline] ${e instanceof Error ? e.message : "error"}`],
          }));
        }
      })();
      return id;
    }

    (async () => {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capabilityId: cap.id,
            inputs: values,
            githubToken,
            adoPat,
          }),
        });

        if (res.status === 501) {
          setTimeout(() => simulate(id, localRunId), 900);
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          patch(id, (j) => ({
            ...j,
            status: "failed",
            log: [...j.log, `[error] ${data.error ?? res.status}${data.message ? " · " + data.message : ""}`],
          }));
          return;
        }

        patch(id, (j) => ({
          ...j,
          live: true,
          runId: data.runId,
          status: "running",
          webUrl: data.webUrl,
          log: [...j.log, `[ado] queued run #${data.runId} on pipeline ${data.pipelineId}`],
        }));
        poll(id, data.pipelineId, data.runId);
      } catch {
        setTimeout(() => simulate(id, localRunId), 900);
      }
    })();

    return id;
  }

  const ready = tokenStatus === "valid";
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme,
        githubToken,
        setGithubToken,
        tokenStatus,
        login,
        validateToken,
        adoPat,
        setAdoPat,
        adoPatStatus,
        adoPatIdentity,
        validateAdoPat,
        adoIdentity,
        adoChecking,
        adoLoggingIn,
        adoLoggingOut,
        recheckAdo,
        loginAdo,
        logoutAdo,
        ready,
        jobs,
        activeJobs,
        queueJob,
        launchCap,
        openLaunch: setLaunchCap,
        closeLaunch: () => setLaunchCap(null),
        detailCap,
        openDetail: setDetailCap,
        closeDetail: () => setDetailCap(null),
        monitorJobId,
        openMonitor: setMonitorJobId,
        closeMonitor: () => setMonitorJobId(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
