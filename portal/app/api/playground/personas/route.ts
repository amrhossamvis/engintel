import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { upsertPersona } from "@/lib/playground-server";
import type { CustomPersona } from "@/lib/playground-templates";

export async function PUT(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 200 });
  const body = (await req.json().catch(() => null)) as {
    userKey?: string;
    persona?: CustomPersona;
  } | null;
  const userKey = body?.userKey?.trim();
  const persona = body?.persona;
  if (!userKey || !persona?.id) return NextResponse.json({ ok: false }, { status: 200 });
  await ensureSchema();
  await upsertPersona(userKey, persona);
  return NextResponse.json({ ok: true });
}
