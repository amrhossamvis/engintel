"use client";

import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Flag, Printer, Send } from "lucide-react";
import type { ProductivityOutput, SprintADOMetrics } from "@/lib/productivity";

type BaselineSnapshot = {
  savedAt: string;
  label: string;
  score: number;
  avgCompletion: number;
  avgCycleTime: number;
  avgBugEscape: number;
  copilotAcceptanceRate: number | null;
};

const BASELINE_KEY = "ai_productivity_baseline";

function rag(score: number): string {
  if (score >= 75) return "var(--live)";
  if (score >= 50) return "var(--soon)";
  return "var(--red)";
}

function scoreLabel(s: number): string {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 55) return "Fair";
  if (s >= 40) return "Needs Work";
  return "Critical";
}

function ScoreGauge({ score, size = 148 }: { score: number; size?: number }) {
  const color = rag(score);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--panel-2)" strokeWidth={12} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[0.7rem] text-muted font-medium">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono">{score}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--panel-2)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: rag(score) }} />
      </div>
    </div>
  );
}

function SprintTable({ sprints }: { sprints: SprintADOMetrics[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--hairline)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--hairline)]" style={{ background: "var(--panel-2)" }}>
            {["Sprint", "Items", "Done", "Compl.", "Vel.", "Bugs", "Escape", "PRs", "Cycle"].map((h) => (
              <th key={h} className={`py-2 px-2.5 font-medium text-muted ${h === "Sprint" ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sprints.map((s, idx) => {
            const isCurrent = idx === sprints.length - 1;
            return (
              <tr key={`${s.sprintName}-${idx}`} className="border-b border-[var(--hairline)] last:border-0">
                <td className="py-2 px-2.5 text-ink">
                  {s.sprintName}
                  {isCurrent && (
                    <span className="ml-1.5 text-[0.55rem] font-mono uppercase tracking-wider text-soon">wip</span>
                  )}
                </td>
                <td className="text-right py-2 px-2.5 text-muted">{s.totalWorkItems}</td>
                <td className="text-right py-2 px-2.5 text-muted">{s.completedWorkItems}</td>
                <td className="text-right py-2 px-2.5 font-mono" style={{ color: rag(s.completionRate) }}>
                  {s.completionRate}%
                </td>
                <td className="text-right py-2 px-2.5 font-mono text-ink">{s.velocity}</td>
                <td className="text-right py-2 px-2.5 text-muted">{s.bugCount}</td>
                <td
                  className="text-right py-2 px-2.5 font-mono"
                  style={{ color: s.bugEscapeRate > 20 ? "var(--red)" : s.bugEscapeRate > 10 ? "var(--soon)" : "var(--live)" }}
                >
                  {s.bugEscapeRate}%
                </td>
                <td className="text-right py-2 px-2.5 text-muted">{s.prCount}</td>
                <td
                  className="text-right py-2 px-2.5 font-mono"
                  style={{ color: s.avgPRCycleTimeDays > 5 ? "var(--red)" : s.avgPRCycleTimeDays > 2 ? "var(--soon)" : "var(--live)" }}
                >
                  {s.avgPRCycleTimeDays > 0 ? `${s.avgPRCycleTimeDays}d` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ROICalculator({ gainPct }: { gainPct: number }) {
  const [engineers, setEngineers] = useState("50");
  const [hourlyRate, setHourlyRate] = useState("75");
  const [hoursPerYear, setHoursPerYear] = useState("1800");

  const eng = Number(engineers) || 0;
  const rate = Number(hourlyRate) || 0;
  const hours = Number(hoursPerYear) || 0;
  const g = gainPct / 100;

  const annualSalaryPool = eng * rate * hours;
  const annualROI = Math.round(annualSalaryPool * g);
  const hoursSaved = Math.round(eng * hours * g);
  const perEngineer = eng > 0 ? Math.round(annualROI / eng) : 0;

  const fmt = (n: number) =>
    n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `£${(n / 1_000).toFixed(0)}K` : `£${n}`;

  const inputs: [string, string, (v: string) => void][] = [
    ["Engineers", engineers, setEngineers],
    ["Rate £/hr", hourlyRate, setHourlyRate],
    ["Hours/yr", hoursPerYear, setHoursPerYear],
  ];
  const outputs: [string, string][] = [
    ["Annual ROI", fmt(annualROI)],
    ["Hours saved/yr", hoursSaved.toLocaleString()],
    ["Value/engineer", fmt(perEngineer)],
    ["Salary pool", fmt(annualSalaryPool)],
  ];

  return (
    <div className="card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="kicker">ROI calculator</p>
        <span className="text-xs font-mono" style={{ color: gainPct > 0 ? "var(--live)" : "var(--muted)" }}>
          {gainPct > 0 ? `+${gainPct}% gain` : "no gain"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {inputs.map(([label, value, set]) => (
          <label key={label} className="block">
            <span className="block text-[0.65rem] text-muted mb-1">{label}</span>
            <input
              type="number"
              min="0"
              value={value}
              onChange={(e) => set(e.target.value)}
              className="w-full rounded-lg bg-[var(--canvas)] border border-[var(--hairline)] px-2.5 py-1.5 text-xs focus:border-red transition-colors"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {outputs.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--hairline)] p-2.5" style={{ background: "var(--panel-2)" }}>
            <p className="text-[0.65rem] text-muted">{label}</p>
            <p className="text-lg font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-[0.65rem] text-faint">Engineers × Rate × Hours/Year × Productivity Gain %.</p>
    </div>
  );
}

function DeltaBadge({ value, inverse = false, suffix = "" }: { value: number; inverse?: boolean; suffix?: string }) {
  const positive = inverse ? value < 0 : value > 0;
  if (Math.abs(value) < 0.5) return <span className="text-[0.65rem] text-muted">no change</span>;
  return (
    <span className="text-[0.65rem] font-semibold" style={{ color: positive ? "var(--live)" : "var(--red)" }}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

function BaselinePanel({
  score,
  orgStats,
  copilotAcceptanceRate,
  baseline,
  onChange,
}: {
  score: number;
  orgStats: ProductivityOutput["orgStats"];
  copilotAcceptanceRate: number | null;
  baseline: BaselineSnapshot | null;
  onChange: (b: BaselineSnapshot | null) => void;
}) {
  const [label, setLabel] = useState("");

  const save = () => {
    const snap: BaselineSnapshot = {
      savedAt: new Date().toISOString(),
      label: label || new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      score,
      avgCompletion: orgStats?.avgCompletion ?? 0,
      avgCycleTime: Number(orgStats?.avgCycleTime ?? 0),
      avgBugEscape: orgStats?.avgBugEscape ?? 0,
      copilotAcceptanceRate,
    };
    localStorage.setItem(BASELINE_KEY, JSON.stringify(snap));
    onChange(snap);
  };

  const clear = () => {
    localStorage.removeItem(BASELINE_KEY);
    onChange(null);
  };

  if (!baseline) {
    return (
      <div className="card rounded-2xl p-4 space-y-3">
        <p className="kicker">Baseline comparison</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Pre-Copilot)"
            className="flex-1 rounded-lg bg-[var(--canvas)] border border-[var(--hairline)] px-2.5 py-1.5 text-xs focus:border-red transition-colors"
          />
          <button
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap"
            style={{ background: "var(--red)" }}
          >
            <Flag className="h-3.5 w-3.5" /> Set baseline
          </button>
        </div>
      </div>
    );
  }

  const rows: [string, number, number, string, boolean][] = [
    ["Index", baseline.score, score, "", false],
    ["Completion", baseline.avgCompletion, orgStats?.avgCompletion ?? 0, "%", false],
    ["Bug escape", baseline.avgBugEscape, orgStats?.avgBugEscape ?? 0, "%", true],
    ["PR cycle", baseline.avgCycleTime, Number(orgStats?.avgCycleTime ?? 0), "d", true],
  ];

  return (
    <div className="card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="kicker">Baseline · {baseline.label}</p>
        <button onClick={clear} className="text-[0.65rem] text-red hover:underline">
          Clear
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([name, base, current, suffix, inverse]) => (
          <div key={name} className="rounded-lg border border-[var(--hairline)] p-2.5" style={{ background: "var(--panel-2)" }}>
            <p className="text-[0.65rem] text-muted mb-1">{name}</p>
            <p className="text-sm text-ink">
              <span className="text-muted">
                {base}
                {suffix}
              </span>{" "}
              →{" "}
              <span className="font-semibold">
                {current}
                {suffix}
              </span>
            </p>
            <DeltaBadge value={current - base} inverse={inverse} suffix={suffix} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductivityResult({ output }: { output: ProductivityOutput }) {
  const { index, sprints, orgStats, copilot } = output;
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [digest, setDigest] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [digestError, setDigestError] = useState("");

  useEffect(() => {
    // Hydrate the persisted baseline on mount — done in an effect (not a lazy
    // initializer) so server and first client render agree before localStorage reads.
    try {
      const raw = localStorage.getItem(BASELINE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store on mount
      if (raw) setBaseline(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const gainPct =
    baseline != null
      ? Math.max(0, Math.round((index.score - baseline.score) * 0.5))
      : output.productivityGainPct;

  const c = index.components;
  const radarData = [
    { metric: "Delivery", score: c.deliveryScore },
    { metric: "Quality", score: c.qualityScore },
    { metric: "Velocity", score: c.velocityScore },
    { metric: "PR Flow", score: c.prEfficiencyScore },
    { metric: "AI Adoption", score: c.copilotAdoptionScore },
  ];
  const trendData = sprints.map((s) => ({
    name: s.sprintName,
    "Completion %": s.completionRate,
    "Bug Escape %": s.bugEscapeRate,
    "Copilot %": copilot ? copilot.acceptanceRate : undefined,
  }));

  const exportCSV = () => {
    if (!sprints.length) return;
    const headers = ["Sprint", "Total Items", "Completed", "Completion %", "Velocity", "Bugs", "Bug Escape %", "PRs", "Avg Cycle (days)"];
    const rows = sprints.map((s) => [
      s.sprintName,
      s.totalWorkItems,
      s.completedWorkItems,
      s.completionRate,
      s.velocity,
      s.bugCount,
      s.bugEscapeRate,
      s.prCount,
      s.avgPRCycleTimeDays,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-productivity-index-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendDigest = async () => {
    setDigest("sending");
    setDigestError("");
    try {
      const res = await fetch("/api/ai-productivity/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: index.score,
          trend: index.trend,
          components: index.components,
          orgStats,
          copilot,
          baseline: baseline ? { label: baseline.label, score: baseline.score, savedAt: baseline.savedAt } : null,
          insights: index.insights,
          teamCount: 1,
          productivityGainPct: gainPct,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error === "teams_webhook_not_configured" ? "Teams webhook not configured" : e.error || "Failed");
      }
      setDigest("sent");
      setTimeout(() => setDigest("idle"), 5000);
    } catch (err) {
      setDigest("error");
      setDigestError(err instanceof Error ? err.message : "Unknown error");
      setTimeout(() => setDigest("idle"), 8000);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="card rounded-2xl p-5">
        <div className="flex items-center gap-5">
          <ScoreGauge score={index.score} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="kicker">AI Productivity Index</span>
              <span className="text-xs font-mono text-muted">
                {index.trend} · {sprints.length} sprints
              </span>
            </div>
            <ScoreBar label="Delivery" score={c.deliveryScore} />
            <ScoreBar label="Quality" score={c.qualityScore} />
            <ScoreBar label="Velocity" score={c.velocityScore} />
            <ScoreBar label="PR efficiency" score={c.prEfficiencyScore} />
            <ScoreBar label="Copilot adoption" score={c.copilotAdoptionScore} />
          </div>
        </div>
      </div>

      {orgStats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Completion", `${orgStats.avgCompletion}%`],
            ["PR cycle", `${orgStats.avgCycleTime}d`],
            ["Bug escape", `${orgStats.avgBugEscape}%`],
            ["PRs merged", String(orgStats.totalPRs)],
          ].map(([label, value]) => (
            <div key={label} className="card rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-ink">{value}</p>
              <p className="text-[0.6rem] text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card rounded-2xl p-4">
        <p className="kicker mb-3">Index shape</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--hairline-strong)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Radar dataKey="score" stroke="var(--red)" fill="var(--red)" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {trendData.length >= 2 && (
        <div className="card rounded-2xl p-4">
          <p className="kicker mb-3">Sprint trend</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="Completion %" stroke="var(--live)" fill="var(--live)" fillOpacity={0.15} strokeWidth={2} />
                <Line type="monotone" dataKey="Bug Escape %" stroke="var(--red)" strokeWidth={1.5} dot={{ r: 2 }} />
                {copilot && (
                  <Line type="monotone" dataKey="Copilot %" stroke="var(--soon)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card rounded-2xl p-4">
        <p className="kicker mb-3">Per-sprint breakdown</p>
        <SprintTable sprints={sprints} />
      </div>

      <ROICalculator gainPct={gainPct} />

      <BaselinePanel
        score={index.score}
        orgStats={orgStats}
        copilotAcceptanceRate={copilot?.acceptanceRate ?? null}
        baseline={baseline}
        onChange={setBaseline}
      />

      {index.insights.length > 0 && (
        <div className="card rounded-2xl p-4">
          <p className="kicker mb-2">Insights</p>
          <ul className="list-disc pl-5 text-xs text-muted space-y-1">
            {index.insights.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          onClick={sendDigest}
          disabled={digest === "sending" || !output.digestConfigured}
          title={output.digestConfigured ? undefined : "Set TEAMS_WEBHOOK_URL to enable"}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--red)" }}
        >
          <Send className="h-3.5 w-3.5" />
          {!output.digestConfigured
            ? "Teams not configured"
            : digest === "sending"
              ? "Sending…"
              : digest === "sent"
                ? "Sent to Teams"
                : "Send digest"}
        </button>
        {digest === "error" && <span className="text-xs text-red">{digestError}</span>}
      </div>
    </div>
  );
}
