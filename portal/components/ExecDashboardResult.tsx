"use client";

import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Loader2, Sparkles } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import type { ExecDashboardOutput } from "@/lib/inline/exec-dashboard";
import type { IterationMetrics, TeamDashboard } from "@/lib/ado-metrics";

const STATUS_COLOR = { green: "var(--live)", amber: "var(--soon)", red: "var(--red)" } as const;

function Tile({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="card rounded-xl p-3 text-center">
      <p className="text-lg font-bold" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </p>
      <p className="text-[0.6rem] text-muted mt-0.5">{label}</p>
    </div>
  );
}

function completionColor(rate: number): string {
  return rate >= 80 ? "var(--live)" : rate >= 60 ? "var(--soon)" : "var(--red)";
}

// ── AI Insights panel ────────────────────────────────────────────────────────

type TokenUsage = { prompt: number; response: number; total: number };

function AiInsightsPanel({
  loading,
  insight,
  tokens,
  label,
}: {
  loading: boolean;
  insight: string | null;
  tokens: TokenUsage | null;
  label: string;
}) {
  if (!loading && !insight) return null;
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating {label}…</span>
        </div>
      )}
      {insight && !loading && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--soon)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {label}
              </span>
              <span
                className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--panel-2)", color: "var(--muted)", border: "1px solid var(--hairline)" }}
              >
                Copilot
              </span>
            </div>
            {tokens && (
              <span className="text-[0.6rem] font-mono" style={{ color: "var(--muted)" }}>
                ~{tokens.total.toLocaleString()} tokens
              </span>
            )}
          </div>
          <Markdown source={insight} />
        </>
      )}
    </div>
  );
}

// ── Team card ────────────────────────────────────────────────────────────────

function TeamCard({
  t,
  githubPat,
}: {
  t: TeamDashboard;
  githubPat: string;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiTokens, setAiTokens] = useState<TokenUsage | null>(null);

  const cur = t.currentIteration;
  const trend = t.iterations.map((i) => ({
    name: i.iterationName,
    Completed: i.completedWorkItems,
    "Story Points": i.velocity,
    "Completion %": Math.round(i.completionRate),
  }));
  const bugs = t.iterations.map((i) => ({
    name: i.iterationName,
    New: i.newBugs,
    Active: i.activeBugs,
    Resolved: i.resolvedBugs,
  }));

  async function generateInsight() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/exec-dashboard/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubPat ? { "x-github-pat": githubPat } : {}),
        },
        body: JSON.stringify({
          teamName: t.team.team,
          iterations: t.iterations,
          healthScore: t.healthScore,
          healthStatus: t.healthStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate insights");
      const result = await res.json();
      setAiInsight(result.insight);
      if (result.tokens) setAiTokens(result.tokens);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setAiInsight(`**Error:** ${msg}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="card rounded-2xl p-5 space-y-4" data-exec-team={t.team.team}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{t.team.team}</h3>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-sm font-mono"
            style={{ color: STATUS_COLOR[t.healthStatus], background: "var(--panel-2)" }}
          >
            {t.healthScore} · {t.healthStatus}
          </span>
          <button
            onClick={generateInsight}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--panel-2)",
              color: "var(--soon)",
              border: "1px solid var(--hairline)",
            }}
            title="Generate AI sprint analysis"
          >
            {aiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {aiInsight ? "Refresh" : "AI Analysis"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile value={`${t.avgCompletionRate}%`} label="Avg completion" color={completionColor(t.avgCompletionRate)} />
        <Tile value={t.avgVelocity} label="Avg velocity (SP)" />
      </div>

      {cur && (
        <div>
          <p className="kicker mb-2">Current sprint · {cur.iterationName}</p>
          <div className="grid grid-cols-4 gap-2">
            <Tile value={`${cur.completedWorkItems}/${cur.totalWorkItems}`} label="Items" />
            <Tile value={cur.completedStoryPoints} label="Story pts" />
            <Tile value={`${Math.round(cur.completionRate)}%`} label="Complete" color={completionColor(cur.completionRate)} />
            <Tile value={cur.bugCount} label="Bugs" />
          </div>
        </div>
      )}

      {/* AI Insights panel */}
      <AiInsightsPanel
        loading={aiLoading}
        insight={aiInsight}
        tokens={aiTokens}
        label="AI Sprint Analysis"
      />

      <div>
        <p className="kicker mb-2">Delivery trend</p>
        <div className="h-52 exec-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted)" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="Completed" stroke="var(--red)" strokeWidth={2} dot={{ r: 2 }} />
              <Line yAxisId="left" type="monotone" dataKey="Story Points" stroke="var(--soon)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
              <Line yAxisId="right" type="monotone" dataKey="Completion %" stroke="var(--live)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="kicker mb-2">Bug trend</p>
        <div className="h-44 exec-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bugs}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="New" stackId="a" fill="var(--soon)" />
              <Bar dataKey="Active" stackId="a" fill="var(--red)" />
              <Bar dataKey="Resolved" stackId="a" fill="var(--live)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="kicker mb-2">Sprint history</p>
        <SprintHistory iterations={t.iterations} />
      </div>
    </div>
  );
}

function SprintHistory({ iterations }: { iterations: IterationMetrics[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--hairline)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--hairline)]" style={{ background: "var(--panel-2)" }}>
            {["Sprint", "Items", "Done", "Rate", "Vel (SP)", "Bugs"].map((h) => (
              <th key={h} className={`py-2 px-2.5 font-medium text-muted ${h === "Sprint" ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {iterations.map((i, idx) => {
            const isCurrent = idx === iterations.length - 1;
            const rate = Math.round(i.completionRate);
            return (
              <tr key={`${i.iterationName}-${idx}`} className="border-b border-[var(--hairline)] last:border-0">
                <td className="py-2 px-2.5 text-ink">
                  {i.iterationName}
                  {isCurrent && <span className="ml-1.5 text-[0.55rem] font-mono uppercase tracking-wider text-soon">wip</span>}
                </td>
                <td className="text-right py-2 px-2.5 text-muted">{i.totalWorkItems}</td>
                <td className="text-right py-2 px-2.5 text-muted">{i.completedWorkItems}</td>
                <td className="text-right py-2 px-2.5 font-mono" style={{ color: completionColor(rate) }}>
                  {rate}%
                </td>
                <td className="text-right py-2 px-2.5 font-mono text-ink">{i.velocity}</td>
                <td className="text-right py-2 px-2.5 text-muted">{i.bugCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function esc(v: string | number): string {
  return String(v).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] as string);
}

// The chart colors are CSS vars that won't resolve in the isolated report
// window, so replace them with the values computed on the live page.
const CHART_VARS = ["--red", "--soon", "--live", "--muted", "--hairline", "--panel-2", "--ink", "--red-bright"];

function chartsForTeams(root: HTMLElement | null): string[] {
  if (!root) return [];
  const cs = getComputedStyle(document.documentElement);
  const varMap = new Map(CHART_VARS.map((v) => [v, cs.getPropertyValue(v).trim()]));
  const resolve = (svg: string) => svg.replace(/var\((--[a-z-]+)\)/g, (m, name) => varMap.get(name) || m);
  return Array.from(root.querySelectorAll("[data-exec-team]")).map((teamEl) =>
    Array.from(teamEl.querySelectorAll(".exec-chart"))
      .map((c) => `<div class="chart">${resolve(c.innerHTML)}</div>`)
      .join(""),
  );
}

// Standalone printable report → browser "Save as PDF". Charts are captured from
// the live rendered SVGs (colors resolved); KPIs + sprint tables carry the rest.
function downloadPDF(output: ExecDashboardOutput, root: HTMLElement | null) {
  const s = output.summary;
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  const rag = (st: "green" | "amber" | "red") => ({ green: "#16a34a", amber: "#d97706", red: "#dc2626" })[st];
  const charts = chartsForTeams(root);

  const teamsHtml = output.teams
    .map((t, ti) => {
      const cur = t.currentIteration;
      const rows = t.iterations
        .map(
          (i, idx) =>
            `<tr><td>${esc(i.iterationName)}${idx === t.iterations.length - 1 ? " <em>(in progress)</em>" : ""}</td>` +
            `<td class="r">${i.totalWorkItems}</td><td class="r">${i.completedWorkItems}</td>` +
            `<td class="r">${Math.round(i.completionRate)}%</td><td class="r">${i.velocity}</td><td class="r">${i.bugCount}</td></tr>`,
        )
        .join("");
      const curHtml = cur
        ? `<p class="sub">Current sprint · ${esc(cur.iterationName)} — ${cur.completedWorkItems}/${cur.totalWorkItems} items · ${cur.completedStoryPoints} SP · ${Math.round(cur.completionRate)}% · ${cur.bugCount} bugs</p>`
        : "";
      return (
        `<div class="team"><h2>${esc(t.team.team)} <span class="badge" style="background:${rag(t.healthStatus)}">${t.healthScore} · ${t.healthStatus}</span></h2>` +
        `<p class="sub">Avg completion ${t.avgCompletionRate}% · Avg velocity ${t.avgVelocity} SP</p>${curHtml}` +
        `<table><thead><tr><th>Sprint</th><th class="r">Items</th><th class="r">Done</th><th class="r">Rate</th><th class="r">Vel (SP)</th><th class="r">Bugs</th></tr></thead><tbody>${rows}</tbody></table>` +
        (charts[ti] ?? "") +
        `</div>`
      );
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Executive Dashboard</title><style>
    *{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
    body{margin:32px;font-size:13px}h1{font-size:22px;margin:0 0 4px}
    .meta{color:#666;font-size:12px;margin-bottom:20px}
    .kpis{display:flex;gap:12px;margin-bottom:24px}
    .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;text-align:center;flex:1}
    .kpi b{display:block;font-size:20px}.kpi span{font-size:11px;color:#666}
    .team{margin-bottom:28px;page-break-inside:avoid}h2{font-size:16px;margin:0 0 4px}
    .badge{color:#fff;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;vertical-align:middle}
    .sub{color:#555;font-size:12px;margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
    th,td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left}.r{text-align:right}
    thead th{background:#f8f8f8}@media print{body{margin:0}}
    .chart{margin:12px 0;page-break-inside:avoid}.chart svg{max-width:100%;height:auto}
    .recharts-legend-wrapper{position:static!important;font-size:11px}
  </style></head><body>
    <h1>Executive Dashboard</h1><div class="meta">Generated ${esc(generated)}</div>
    <div class="kpis">
      <div class="kpi"><b style="color:${rag(s.orgHealthStatus)}">${s.avgHealthScore}</b><span>Org health</span></div>
      <div class="kpi"><b>${s.totalTeams}</b><span>Teams</span></div>
      <div class="kpi"><b style="color:#16a34a">${s.healthyTeams}</b><span>Healthy</span></div>
      <div class="kpi"><b style="color:#d97706">${s.atRiskTeams}</b><span>At risk</span></div>
      <div class="kpi"><b style="color:#dc2626">${s.criticalTeams}</b><span>Critical</span></div>
    </div>${teamsHtml}
    <script>window.addEventListener("load",function(){window.print()})<\/script>
  </body></html>`;

  // Blob URL instead of document.write — no injection into the app DOM. All
  // dynamic strings are escaped via esc(); the report auto-prints on load.
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    alert("Allow pop-ups to download the PDF report.");
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Root export ──────────────────────────────────────────────────────────────

export function ExecDashboardResult({ output }: { output: ExecDashboardOutput }) {
  const s = output.summary;
  const rootRef = useRef<HTMLDivElement>(null);

  // Org-level AI insight state
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgInsight, setOrgInsight] = useState<string | null>(null);
  const [orgTokens, setOrgTokens] = useState<TokenUsage | null>(null);

  // Read GitHub PAT from localStorage (set via Settings page)
  const githubPat =
    typeof window !== "undefined"
      ? (typeof window.localStorage?.getItem === "function"
          ? (window.localStorage.getItem("github_pat_token") ?? window.localStorage.getItem("gh_token") ?? "")
          : "")
      : "";

  async function generateOrgInsight() {
    setOrgLoading(true);
    try {
      const res = await fetch("/api/exec-dashboard/insights/org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubPat ? { "x-github-pat": githubPat } : {}),
        },
        body: JSON.stringify({
          teams: output.teams.map((t) => ({
            teamName: t.team.team,
            healthScore: t.healthScore,
            healthStatus: t.healthStatus,
            iterations: t.iterations,
          })),
          summary: output.summary,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate org insights");
      const result = await res.json();
      setOrgInsight(result.insight);
      if (result.tokens) setOrgTokens(result.tokens);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setOrgInsight(`**Error:** ${msg}`);
    } finally {
      setOrgLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-5" ref={rootRef}>
      {/* Org summary KPIs */}
      <div className="grid grid-cols-5 gap-2">
        <Tile value={`${s.avgHealthScore}`} label="Org health" color={STATUS_COLOR[s.orgHealthStatus]} />
        <Tile value={s.totalTeams} label="Teams" />
        <Tile value={s.healthyTeams} label="Healthy" color="var(--live)" />
        <Tile value={s.atRiskTeams} label="At risk" color="var(--soon)" />
        <Tile value={s.criticalTeams} label="Critical" color="var(--red)" />
      </div>

      {/* Org-level AI insight */}
      <div className="card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="kicker">Organisation AI Analysis</p>
          <button
            onClick={generateOrgInsight}
            disabled={orgLoading}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--panel-2)",
              color: "var(--soon)",
              border: "1px solid var(--hairline)",
            }}
          >
            {orgLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {orgInsight ? "Refresh" : "Generate Org Insights"}
          </button>
        </div>
        <AiInsightsPanel
          loading={orgLoading}
          insight={orgInsight}
          tokens={orgTokens}
          label="AI Organisation Analysis"
        />
        {!orgLoading && !orgInsight && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Click &ldquo;Generate Org Insights&rdquo; to get an AI-powered executive summary across all teams.
          </p>
        )}
      </div>

      {/* Per-team cards */}
      {output.teams.map((t) => (
        <TeamCard key={t.team.team} t={t} githubPat={githubPat} />
      ))}

      <div className="flex justify-end">
        <button
          onClick={() => downloadPDF(output, rootRef.current)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </button>
      </div>
    </div>
  );
}
