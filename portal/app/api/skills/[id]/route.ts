import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;

  const res = await db().query(`DELETE FROM skills WHERE id = $1 RETURNING id`, [id]);
  if (res.rowCount === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
