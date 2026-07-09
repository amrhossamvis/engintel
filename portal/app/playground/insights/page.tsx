"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Star, Users, Zap, Clock, TrendingUp } from "lucide-react";
import { PG_TEMPLATES } from "@/lib/playground-templates";
import { getLocalStats, type TemplateStat } from "@/lib/playground-analytics";

function templateName(id: string): string {
  return PG_TEMPLATES.find((t) => t.id === id)?.name ?? id;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function RatingStars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= full ? "text-yellow-400 fill-yellow-400" : "text-[var(--hairline)]"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted">{value.toFixed(1)}</span>
    </span>
  );
}

export default function PlaygroundInsightsPage() {
  const [stats, setStats] = useState<TemplateStat[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    // Always read local analytics (works without a DB)
    const local = getLocalStats(days);

    // Also try the server endpoint (has aggregated multi-user data if DB exists)
    fetch(`/api/playground/analytics?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        const server: TemplateStat[] = data.stats ?? [];
        // Merge: prefer server data when available, fall back to local
        if (server.length > 0) {
          setStats(server);
        } else {
          setStats(local);
        }
      })
      .catch(() => {
        // Server unavailable — use local only
        setStats(local);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const totalRuns = stats.reduce((s, r) => s + r.total_runs, 0);
  const totalUsers = new Set(stats.map((r) => r.unique_users)).size > 0
    ? stats.reduce((s, r) => Math.max(s, r.unique_users), 0)
    : 0;
  const overallAvgRating = stats.filter((s) => s.avg_rating != null).length > 0
    ? stats.reduce((sum, s) => sum + (s.avg_rating ?? 0) * s.rated_runs, 0) /
      Math.max(1, stats.reduce((sum, s) => sum + s.rated_runs, 0))
    : null;

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-10">
      <Link
        href="/playground"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Playground
      </Link>

      <h1 className="font-display font-extrabold tracking-tight text-3xl mb-2">
        <BarChart3 className="inline h-7 w-7 mr-2 text-red" />
        Playground Insights
      </h1>
      <p className="text-muted text-sm mb-8">
        Usage analytics and satisfaction ratings across all playground templates.
      </p>

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-muted font-mono">Period:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              days === d
                ? "bg-red text-white"
                : "bg-[var(--panel-2)] text-muted hover:text-ink border border-[var(--hairline)]"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={<Zap className="h-5 w-5 text-red" />} label="Total Runs" value={totalRuns} />
        <SummaryCard icon={<Users className="h-5 w-5 text-blue-400" />} label="Unique Users" value={totalUsers} />
        <SummaryCard
          icon={<Star className="h-5 w-5 text-yellow-400" />}
          label="Avg Rating"
          value={overallAvgRating != null ? overallAvgRating.toFixed(1) : "—"}
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-live" />}
          label="Templates Used"
          value={stats.length}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-muted text-sm">Loading analytics…</div>
      ) : stats.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl" style={{ borderColor: "var(--hairline)" }}>
          <BarChart3 className="h-10 w-10 mx-auto text-muted mb-3" />
          <p className="text-muted text-sm">No analytics data yet.</p>
          <p className="text-faint text-xs mt-1">
            Data will appear once users start rating responses in the Playground.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--hairline)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--panel-2)] text-left text-xs font-mono text-muted">
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3 text-center">Runs</th>
                <th className="px-4 py-3 text-center">Users</th>
                <th className="px-4 py-3 text-center">Avg Turns</th>
                <th className="px-4 py-3 text-center">Avg Duration</th>
                <th className="px-4 py-3 text-center">Rating</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.template_id} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                  <td className="px-4 py-3 font-medium">{templateName(row.template_id)}</td>
                  <td className="px-4 py-3 text-center text-muted">{row.total_runs}</td>
                  <td className="px-4 py-3 text-center text-muted">{row.unique_users}</td>
                  <td className="px-4 py-3 text-center text-muted">{row.avg_turns?.toFixed(1) ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-muted">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {formatDuration(row.avg_duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RatingStars value={row.avg_rating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

