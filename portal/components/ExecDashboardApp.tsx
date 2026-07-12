"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, Loader2, RefreshCw, Settings } from "lucide-react";
import { ExecDashboardResult } from "./ExecDashboardResult";
import { useApp } from "./AppProvider";
import type { ExecDashboardOutput } from "@/lib/inline/exec-dashboard";
import type { TeamDashboard } from "@/lib/ado-metrics";

type TeamConfig = {
  organization: string;
  project: string;
  team: string;
};

type TeamWithError = TeamDashboard & { error?: string };
type DashboardResponse = Omit<ExecDashboardOutput, "teams"> & { teams: TeamWithError[] };

const STORAGE_KEY = "ado_teams";
const DEFAULT_ORG = process.env.NEXT_PUBLIC_ADO_ORG || "vfuk-digital";
const DEFAULT_PROJECT = process.env.NEXT_PUBLIC_ADO_PROJECT || "Digital";

function readTeamsFromStorage(): TeamConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const team = String((row as { team?: unknown }).team ?? "").trim();
        if (!team) return null;
        return {
          organization: String((row as { organization?: unknown }).organization ?? DEFAULT_ORG).trim() || DEFAULT_ORG,
          project: String((row as { project?: unknown }).project ?? DEFAULT_PROJECT).trim() || DEFAULT_PROJECT,
          team,
        };
      })
      .filter((row): row is TeamConfig => Boolean(row));
  } catch {
    return [];
  }
}

export function ExecDashboardApp() {
  const { adoPat } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [teamErrors, setTeamErrors] = useState<Array<{ team: string; message: string }>>([]);
  const [data, setData] = useState<ExecDashboardOutput | null>(null);
  const [sprintCount, setSprintCount] = useState(6);
  const [configuredTeams, setConfiguredTeams] = useState<TeamConfig[]>([]);

  const currentSprintName = useMemo(() => {
    if (!data) return "";
    const team = data.teams.find((t) => t.currentIteration?.iterationName);
    return team?.currentIteration?.iterationName ?? "";
  }, [data]);

  const fetchDashboard = useCallback(async () => {
    const teams = readTeamsFromStorage();
    setConfiguredTeams(teams);

    if (teams.length === 0) {
      setData(null);
      setError("No teams configured. Add at least one team in Settings.");
      return;
    }

    setLoading(true);
    setError("");
    setTeamErrors([]);
    try {
      const res = await fetch("/api/exec-dashboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adoPat ? { "x-ado-pat": adoPat } : {}),
        },
        body: JSON.stringify({ teams, sprintCount }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to fetch executive dashboard data");
      }

      const parsed = payload as DashboardResponse;
      const failed = parsed.teams
        .filter((t) => typeof t.error === "string" && t.error.trim().length > 0)
        .map((t) => ({ team: t.team.team, message: t.error as string }));
      const okTeams = parsed.teams.filter((t) => !t.error);

      if (okTeams.length === 0) {
        setData(null);
        setTeamErrors(failed);
        setError("No data was retrieved for the configured teams. Check team names and ADO access.");
        return;
      }

      setTeamErrors(failed);
      setData({
        teams: okTeams,
        summary: parsed.summary,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch executive dashboard data";
      setData(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [adoPat, sprintCount]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-6 py-6 md:px-8 md:py-7">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--panel-2)]">
              <LayoutDashboard className="h-5 w-5 text-red" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight">Executive Dashboard</h2>
              <p className="text-sm text-muted">Engineering health, velocity, and quality at a glance.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sprintCount}
              onChange={(e) => setSprintCount(Number(e.target.value))}
              className="rounded-lg border border-[var(--hairline-strong)] bg-[var(--panel)] px-3 py-2 text-sm"
              aria-label="Sprint range"
            >
              <option value={3}>Last 3 sprints</option>
              <option value={6}>Last 6 sprints</option>
              <option value={9}>Last 9 sprints</option>
              <option value={12}>Last 12 sprints</option>
            </select>
            <button
              onClick={() => void fetchDashboard()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--hairline-strong)] bg-[var(--panel)] px-3.5 py-2 text-sm font-medium hover:border-red transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--hairline-strong)] bg-[var(--panel)] px-3.5 py-2 text-sm font-medium hover:border-red transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          Teams loaded: <span className="text-ink">{configuredTeams.length}</span>
        </p>

        {currentSprintName && (
          <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--panel-2)] px-4 py-2.5 text-sm">
            <span className="text-muted uppercase tracking-wider text-[0.65rem] font-mono">Current sprint</span>
            <span className="ml-2.5 font-medium">{currentSprintName}</span>
            <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-soon">in progress</span>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-[var(--red)]/35 bg-[rgba(230,0,0,0.08)] p-4">
            <div className="flex items-start gap-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-red mt-0.5 shrink-0" />
              <div>
                <p className="text-ink">{error}</p>
                <Link href="/settings" className="mt-1.5 inline-block text-xs text-info hover:underline">
                  Open Settings
                </Link>
              </div>
            </div>
          </div>
        )}

        {teamErrors.length > 0 && (
          <div className="mt-5 rounded-xl border border-[var(--soon)]/35 bg-[color-mix(in_srgb,var(--soon)_10%,transparent)] p-4">
            <p className="text-sm text-ink font-medium">Some teams could not be loaded:</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              {teamErrors.map((t) => (
                <li key={`${t.team}-${t.message}`}>• {t.team}: {t.message}</li>
              ))}
            </ul>
          </div>
        )}

        {loading && !data && (
          <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[var(--hairline)] bg-[var(--panel)] py-16">
            <Loader2 className="h-10 w-10 animate-spin text-muted" />
            <p className="mt-4 text-sm text-muted">Fetching sprint data from Azure DevOps…</p>
          </div>
        )}

        {data && !error && <ExecDashboardResult output={data} />}
      </div>
    </div>
  );
}
