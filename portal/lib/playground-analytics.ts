/**
 * Client-side analytics store for Playground template usage.
 * Works as the primary store when no DATABASE_URL is configured,
 * and as a local cache regardless.
 */

export type AnalyticsEntry = {
  id: string;
  templateId: string;
  userKey: string;
  threadId: string | null;
  turns: number;
  rating: number | null;
  feedbackText: string | null;
  durationMs: number | null;
  createdAt: string; // ISO timestamp
};

export type TemplateStat = {
  template_id: string;
  total_runs: number;
  rated_runs: number;
  avg_rating: number | null;
  avg_turns: number | null;
  avg_duration_ms: number | null;
  unique_users: number;
};

const STORAGE_KEY = "pg:analytics";

function loadEntries(): AnalyticsEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: AnalyticsEntry[]): void {
  try {
    // Keep at most 500 entries to avoid bloating localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch {
    // storage full — discard oldest
  }
}

export function recordAnalytics(entry: Omit<AnalyticsEntry, "id" | "createdAt">): void {
  const full: AnalyticsEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const existing = loadEntries();
  saveEntries([full, ...existing]);

  // Also try the server endpoint (fire-and-forget)
  fetch("/api/playground/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: entry.templateId,
      userKey: entry.userKey,
      threadId: entry.threadId,
      turns: entry.turns,
      rating: entry.rating,
      feedbackText: entry.feedbackText,
      durationMs: entry.durationMs,
    }),
  }).catch(() => {});
}

export function getLocalStats(days: number = 30): TemplateStat[] {
  const entries = loadEntries();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const filtered = entries.filter((e) => e.createdAt >= since);

  // Group by template_id
  const groups = new Map<string, AnalyticsEntry[]>();
  for (const e of filtered) {
    const list = groups.get(e.templateId) ?? [];
    list.push(e);
    groups.set(e.templateId, list);
  }

  const stats: TemplateStat[] = [];
  for (const [templateId, items] of groups) {
    const rated = items.filter((e) => e.rating != null);
    const avgRating = rated.length > 0
      ? Math.round((rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length) * 100) / 100
      : null;
    const avgTurns = Math.round((items.reduce((s, e) => s + e.turns, 0) / items.length) * 10) / 10;
    const durItems = items.filter((e) => e.durationMs != null);
    const avgDuration = durItems.length > 0
      ? Math.round(durItems.reduce((s, e) => s + (e.durationMs ?? 0), 0) / durItems.length)
      : null;
    const uniqueUsers = new Set(items.map((e) => e.userKey)).size;

    stats.push({
      template_id: templateId,
      total_runs: items.length,
      rated_runs: rated.length,
      avg_rating: avgRating,
      avg_turns: avgTurns,
      avg_duration_ms: avgDuration,
      unique_users: uniqueUsers,
    });
  }

  return stats.sort((a, b) => b.total_runs - a.total_runs);
}

