import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { azWhoami } from "@/lib/ado";
import { FEEDBACK_STATUSES } from "@/lib/feedback";

// Identity is derived server-side from the host `az login` user, never from the
// request body — a client-supplied key would be trivially spoofable.
async function isAdmin(): Promise<boolean> {
  const allow = (process.env.FEEDBACK_ADMINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true; // open in prototype
  const who = (await azWhoami())?.toLowerCase();
  return Boolean(who && allow.includes(who));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const status = body.status;
  if (!status || !FEEDBACK_STATUSES.includes(status as (typeof FEEDBACK_STATUSES)[number]))
    return NextResponse.json({ error: "bad_status" }, { status: 400 });

  const res = await db().query(`UPDATE feedback SET status = $1 WHERE id = $2`, [status, id]);
  if (!res.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
