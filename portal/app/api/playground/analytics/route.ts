import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";

export async function POST(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, reason: "no_db" }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as {
    templateId?: string;
    userKey?: string;
    threadId?: string;
    turns?: number;
    rating?: number;
    feedbackText?: string;
    durationMs?: number;
  } | null;

  const templateId = body?.templateId?.trim();
  const userKey = body?.userKey?.trim();
  if (!templateId || !userKey) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const rating = body?.rating != null ? Math.min(5, Math.max(1, Math.round(body.rating))) : null;
  const turns = Math.max(1, body?.turns ?? 1);
  const durationMs = body?.durationMs != null ? Math.max(0, Math.round(body.durationMs)) : null;
  const feedbackText = body?.feedbackText?.trim()?.slice(0, 1000) || null;
  const threadId = body?.threadId?.trim() || null;

  await ensureSchema();
  await db().query(
    `INSERT INTO pg_template_analytics (template_id, user_key, thread_id, turns, rating, feedback_text, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [templateId, userKey, threadId, turns, rating, feedbackText, durationMs],
  );

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, stats: [] }, { status: 200 });
  }

  await ensureSchema();

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { rows } = await db().query(
    `SELECT
       template_id,
       COUNT(*)::int AS total_runs,
       COUNT(rating)::int AS rated_runs,
       ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
       ROUND(AVG(turns)::numeric, 1)::float AS avg_turns,
       ROUND(AVG(duration_ms)::numeric, 0)::int AS avg_duration_ms,
       COUNT(DISTINCT user_key)::int AS unique_users
     FROM pg_template_analytics
     WHERE created_at >= $1
     GROUP BY template_id
     ORDER BY total_runs DESC`,
    [since],
  );

  return NextResponse.json({ ok: true, stats: rows, days });
}

