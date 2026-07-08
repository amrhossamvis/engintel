import { NextResponse } from "next/server";
import { adoReadable } from "@/lib/ado";
import { getClassificationNodes } from "@/lib/ado-workitems";

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") === "iterations" ? "iterations" : "areas";
  const userPat = req.headers.get("x-ado-pat")?.trim() || undefined;
  if (!(await adoReadable(userPat))) {
    return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
  }
  try {
    return NextResponse.json({ nodes: await getClassificationNodes(kind, userPat) });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
