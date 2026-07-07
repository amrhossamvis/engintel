import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { azWhoami } from "@/lib/ado";

// Identity is derived server-side from the host `az login` user, never from the
// request body. Mirrors the ideas admin gate: open when no admin list is set
// (prototype), enforced once SKILLS_ADMINS (or IDEAS_ADMINS) lists curators.
async function isAdmin(): Promise<boolean> {
  const allow = (process.env.SKILLS_ADMINS ?? process.env.IDEAS_ADMINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true;
  const who = (await azWhoami())?.toLowerCase();
  return Boolean(who && allow.includes(who));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await ensureSchema();
  const { id } = await params;

  const res = await db().query(`DELETE FROM skills WHERE id = $1 RETURNING id`, [id]);
  if (res.rowCount === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
