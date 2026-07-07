import { db } from "@/lib/db";
import { ACTIVITY_WEEKS } from "@/lib/skills";

export type Activity = { activity: number[]; trend24: number; trend7d: number };

export function emptyActivity(): Activity {
  return { activity: new Array(ACTIVITY_WEEKS).fill(0), trend24: 0, trend7d: 0 };
}

/**
 * One-pass install activity for every skill: weekly buckets (oldest→newest) for
 * the sparkline, plus 24h / 7d counts for Trending / Hot ordering. The registry
 * is small, so aggregating all skills at once beats per-skill queries.
 */
export async function loadActivity(): Promise<Map<string, Activity>> {
  const map = new Map<string, Activity>();

  const weekly = await db().query<{ skill_id: string; weeks_ago: number; n: number }>(
    `SELECT skill_id,
            floor(extract(epoch from (now() - created_at)) / 604800)::int AS weeks_ago,
            count(*)::int AS n
     FROM skill_installs
     WHERE created_at > now() - ($1 || ' weeks')::interval
     GROUP BY 1, 2`,
    [ACTIVITY_WEEKS],
  );
  for (const r of weekly.rows) {
    if (r.weeks_ago < 0 || r.weeks_ago >= ACTIVITY_WEEKS) continue;
    let a = map.get(r.skill_id);
    if (!a) map.set(r.skill_id, (a = emptyActivity()));
    a.activity[ACTIVITY_WEEKS - 1 - r.weeks_ago] = r.n;
  }

  const trends = await db().query<{ skill_id: string; t24: number; t7: number }>(
    `SELECT skill_id,
            count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS t24,
            count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS t7
     FROM skill_installs
     WHERE created_at > now() - interval '7 days'
     GROUP BY 1`,
  );
  for (const r of trends.rows) {
    let a = map.get(r.skill_id);
    if (!a) map.set(r.skill_id, (a = emptyActivity()));
    a.trend24 = r.t24;
    a.trend7d = r.t7;
  }

  return map;
}
