import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;

  let voterKey: string | undefined;
  try {
    voterKey = (await req.json())?.voterKey;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!voterKey) return NextResponse.json({ error: "missing_voter" }, { status: 400 });

  const exists = await db().query("SELECT 1 FROM ideas WHERE id = $1", [id]);
  if (!exists.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const had = await db().query("SELECT 1 FROM votes WHERE idea_id = $1 AND voter_key = $2", [id, voterKey]);
  if (had.rowCount) {
    await db().query("DELETE FROM votes WHERE idea_id = $1 AND voter_key = $2", [id, voterKey]);
  } else {
    await db().query("INSERT INTO votes (idea_id, voter_key) VALUES ($1,$2)", [id, voterKey]);
  }

  const count = await db().query("SELECT COUNT(*)::int AS n FROM votes WHERE idea_id = $1", [id]);
  return NextResponse.json({ voted: !had.rowCount, voteCount: count.rows[0].n });
}
