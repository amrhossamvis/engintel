import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { upsertThread } from "@/lib/playground-server";
import type { Thread } from "@/lib/playground-store";

export async function PUT(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 200 });
  const body = (await req.json().catch(() => null)) as {
    userKey?: string;
    thread?: Thread;
  } | null;
  const userKey = body?.userKey?.trim();
  const thread = body?.thread;
  if (!userKey || !thread?.id) return NextResponse.json({ ok: false }, { status: 200 });
  await ensureSchema();
  await upsertThread(userKey, thread);
  return NextResponse.json({ ok: true });
}
