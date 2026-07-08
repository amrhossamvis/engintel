import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { removePersona } from "@/lib/playground-server";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ ok: false }, { status: 200 });
  const { id } = await params;
  const user = new URL(req.url).searchParams.get("user")?.trim() ?? "";
  if (!user) return NextResponse.json({ ok: false }, { status: 200 });
  await ensureSchema();
  await removePersona(user, id);
  return NextResponse.json({ ok: true });
}
