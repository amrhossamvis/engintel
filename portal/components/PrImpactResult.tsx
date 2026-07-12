"use client";

import { Radar, ShieldAlert } from "lucide-react";
import type { PrImpactOutput } from "@/lib/local/pr-impact-analyzer";

export function PrImpactResult({ output }: { output: PrImpactOutput }) {
  const endpoints = Array.isArray(output.impactedEndpoints) ? output.impactedEndpoints : [];
  const summary = output.summary;

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-xl border border-[var(--hairline)] p-3.5" style={{ background: "var(--panel-2)" }}>
        <p className="kicker mb-2">Endpoint impact summary</p>
        {output.prCommentPosted ? (
          <p className="text-xs text-muted mb-2">
            Posted to PR comment thread{output.impactRef ? ` (${output.impactRef})` : ""}.
          </p>
        ) : (
          <p className="text-xs text-soon mb-2">
            Could not post PR comment{output.prCommentError ? `: ${output.prCommentError}` : ""}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted">
          <div>
            <span className="block text-[0.68rem] uppercase tracking-wider">Primary repo</span>
            <span className="text-ink">{summary.primaryRepo}</span>
          </div>
          <div>
            <span className="block text-[0.68rem] uppercase tracking-wider">Overall confidence</span>
            <span className="text-ink">{Math.round(summary.overallConfidence * 100)}%</span>
          </div>
          <div>
            <span className="block text-[0.68rem] uppercase tracking-wider">Impacted endpoints</span>
            <span className="text-ink">{summary.totalEndpoints}</span>
          </div>
          <div>
            <span className="block text-[0.68rem] uppercase tracking-wider">Cross-repo signals</span>
            <span className="text-ink">{summary.crossRepoSignals}</span>
          </div>
        </div>
      </div>

      {endpoints.length > 0 ? (
        <ul className="rounded-xl border border-[var(--hairline)] p-3 max-h-96 overflow-y-auto space-y-2.5">
          {endpoints.map((ep) => (
            <li key={`${ep.method}:${ep.path}`} className="rounded-lg border border-[var(--hairline)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-muted uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Radar className="h-3.5 w-3.5" />
                    {ep.method}
                  </p>
                  <p className="text-sm text-ink break-all">{ep.path}</p>
                </div>
                <span className="text-xs font-mono text-muted shrink-0">{Math.round(ep.confidenceScore * 100)}%</span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[0.72rem] font-mono uppercase tracking-wider text-muted">
                <span>{ep.confidenceLabel} confidence</span>
                <span>•</span>
                <span>{ep.impactLevel} impact</span>
              </div>

              {ep.monitoringRecommendations.length > 0 && (
                <div className="mt-2">
                  <p className="text-[0.68rem] uppercase tracking-wider text-muted mb-1 inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Monitoring focus
                  </p>
                  <ul className="space-y-1">
                    {ep.monitoringRecommendations.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="text-xs text-[var(--ink-dim)]">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-[var(--hairline)] p-3 text-xs text-muted">
          No API-facing endpoints were confidently detected from this PR context.
        </div>
      )}
    </div>
  );
}
