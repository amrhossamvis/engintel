import { NextResponse } from "next/server";
import { adoReadable } from "@/lib/ado";
import { searchParents } from "@/lib/ado-workitems";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const userPat = req.headers.get("x-ado-pat")?.trim() || undefined;
  if (!q) return NextResponse.json({ items: [] });
  if (!(await adoReadable(userPat))) {
    return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
  }
  try {
    return NextResponse.json({ items: await searchParents(q, userPat) });
  } catch {
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
