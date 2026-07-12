"use client";

import { CircleAlert, TriangleAlert, Info } from "lucide-react";
import type { SprintHealthOutput } from "@/lib/sprint-health";

const HEALTH_COLOR = { GREEN: "var(--live)", AMBER: "var(--soon)", RED: "var(--red)" } as const;
const SEVERITY_COLOR = { HIGH: "var(--red)", MEDIUM: "var(--soon)", LOW: "var(--muted)" } as const;

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

export function SprintHealthResult({ output }: { output: SprintHealthOutput }) {
  const color = HEALTH_COLOR[output.health];
  const s = output.summary;

  return (
    <div className="mt-6 space-y-5">
      <div className="card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="kicker">{output.team}</p>
            <h3 className="font-display text-lg font-semibold leading-tight">{output.iterationName}</h3>
          </div>
          <span
            className="rounded-full px-3 py-1 text-sm font-mono"
            style={{ color, background: "var(--panel-2)" }}
          >
            {output.healthScore} · {output.health}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile value={`${output.deliveryConfidence}%`} label="Delivery confidence" color={color} />
          <Tile value={output.daysRemaining ?? "—"} label="Days remaining" />
          <Tile value={`${s.done}/${s.committed}`} label="Done / committed" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Tile value={s.inProgress} label="In progress" />
        <Tile value={s.notStarted} label="Not started" />
        <Tile value={s.blocked} label="Blocked" color={s.blocked > 0 ? "var(--red)" : undefined} />
        <Tile value={s.stale} label="Stale" color={s.stale > 0 ? "var(--soon)" : undefined} />
        <Tile value={s.openPrs} label="Open PRs" />
        <Tile value={s.agingPrs} label="Aging PRs" color={s.agingPrs > 0 ? "var(--soon)" : undefined} />
        <Tile value={s.likelySpillover} label="Likely spillover" color={s.likelySpillover > 0 ? "var(--red)" : undefined} />
        <Tile value={s.scopeAddedAfterStart} label="Scope added" />
      </div>

      {output.topRisks.length > 0 && (
        <div className="card rounded-2xl p-5">
          <p className="kicker mb-3">Top risks</p>
          <ul className="space-y-2.5">
            {output.topRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" style={{ color: SEVERITY_COLOR[r.severity] }} />
                <span>
                  <span
                    className="font-mono text-[0.62rem] uppercase tracking-wider mr-1.5"
                    style={{ color: SEVERITY_COLOR[r.severity] }}
                  >
                    {r.severity}
                  </span>
                  {r.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.atRiskItems.length > 0 && (
        <div className="card rounded-2xl p-5">
          <p className="kicker mb-3">At-risk work items</p>
          <div className="overflow-x-auto rounded-xl border border-[var(--hairline)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--hairline)]" style={{ background: "var(--panel-2)" }}>
                  {["ID", "Title", "Risk", "Reason", "Action"].map((h) => (
                    <th key={h} className="py-2 px-2.5 font-medium text-muted text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.atRiskItems.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--hairline)] last:border-0">
                    <td className="py-2 px-2.5 text-muted font-mono">#{item.id}</td>
                    <td className="py-2 px-2.5 text-ink">{item.title}</td>
                    <td className="py-2 px-2.5 text-muted">{item.risk}</td>
                    <td className="py-2 px-2.5 text-muted">{item.reason}</td>
                    <td className="py-2 px-2.5 text-muted">{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {output.recommendedActions.length > 0 && (
        <div className="card rounded-2xl p-5">
          <p className="kicker mb-3">Recommended actions</p>
          <ul className="space-y-2 text-sm">
            {output.recommendedActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CircleAlert className="h-4 w-4 mt-0.5 shrink-0 text-muted" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.warnings.length > 0 && (
        <div className="rounded-xl border p-3.5 text-xs" style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}>
          {output.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-muted">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
