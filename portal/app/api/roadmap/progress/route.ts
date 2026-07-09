import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";

// GET /api/roadmap/progress?user=<key> → { done: string[] }
export async function GET(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, done: [] }, { status: 200 });
  }
  const userKey = new URL(req.url).searchParams.get("user")?.trim();
  if (!userKey) {
    return NextResponse.json({ error: "missing_user" }, { status: 400 });
  }

  await ensureSchema();
  const { rows } = await db().query(
    `SELECT node_id FROM roadmap_progress WHERE user_key = $1`,
    [userKey],
  );
  return NextResponse.json({ ok: true, done: rows.map((r) => r.node_id as string) });
}

// POST { userKey, nodeId, trackId, done } → upsert (done=true) or delete (done=false)
export async function POST(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json({ ok: false, reason: "no_db" }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as {
    userKey?: string;
    nodeId?: string;
    trackId?: string;
    done?: boolean;
  } | null;

  const userKey = body?.userKey?.trim();
  const nodeId = body?.nodeId?.trim();
  if (!userKey || !nodeId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const trackId = body?.trackId?.trim() || null;

  await ensureSchema();
  if (body?.done) {
    await db().query(
      `INSERT INTO roadmap_progress (user_key, node_id, track_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_key, node_id) DO UPDATE SET track_id = EXCLUDED.track_id, updated_at = now()`,
      [userKey, nodeId, trackId],
    );
  } else {
    await db().query(
      `DELETE FROM roadmap_progress WHERE user_key = $1 AND node_id = $2`,
      [userKey, nodeId],
    );
  }

  return NextResponse.json({ ok: true });
}
