import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;

  let body: { body?: string; authorKey?: string; authorName?: string; isAnonymous?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const text = body.body?.trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const exists = await db().query("SELECT 1 FROM ideas WHERE id = $1", [id]);
  if (!exists.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = await db().query(
    `INSERT INTO comments (idea_id, author_key, author_name, is_anonymous, body)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [id, body.authorKey ?? null, body.authorName ?? null, Boolean(body.isAnonymous), text],
  );
  return NextResponse.json({ id: res.rows[0].id }, { status: 201 });
}
