import { NextResponse } from "next/server";
import { adoReadable } from "@/lib/ado";
import { canCreate, WORK_ITEM_TYPES } from "@/lib/ado-workitems";

export async function GET(req: Request) {
  const typeParam = new URL(req.url).searchParams.get("type")?.trim() ?? "";
  const type = WORK_ITEM_TYPES.includes(typeParam as (typeof WORK_ITEM_TYPES)[number])
    ? typeParam
    : "User Story";
  const userPat = req.headers.get("x-ado-pat")?.trim() || undefined;
  if (!(await adoReadable(userPat))) {
    return NextResponse.json({ canCreate: false, reason: "ado_not_configured" });
  }
  try {
    return NextResponse.json({ canCreate: await canCreate(type, userPat) });
  } catch {
    // Probe failed for a non-permission reason — don't block the user on it.
    return NextResponse.json({ canCreate: true });
  }
}
