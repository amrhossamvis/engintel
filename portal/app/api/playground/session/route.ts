import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { upsertSession } from "@/lib/playground-server";

export async function PUT(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 200 });
  const body = (await req.json().catch(() => null)) as {
    userKey?: string;
    threadId?: string | null;
    personaId?: string | null;
  } | null;
  const userKey = body?.userKey?.trim();
  if (!userKey) return NextResponse.json({ ok: false }, { status: 200 });
  await ensureSchema();
  await upsertSession(userKey, body?.threadId ?? null, body?.personaId ?? null);
  return NextResponse.json({ ok: true });
}
