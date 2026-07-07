import { NextResponse } from "next/server";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { getPlaygroundState } from "@/lib/playground-server";

const EMPTY = { personas: [], threads: [], session: null };

export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user")?.trim() ?? "";
  if (!user || !dbConfigured()) return NextResponse.json(EMPTY);
  await ensureSchema();
  return NextResponse.json(await getPlaygroundState(user));
}
