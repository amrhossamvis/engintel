import { NextResponse } from "next/server";
import { validateAdoPat } from "@/lib/ado";

/**
 * Validate a per-user Azure DevOps PAT against the org's connectionData endpoint.
 * 200 with { valid, name } — the UI confirms the identity, mirroring GitHub token validation.
 */
export async function POST(req: Request) {
  let pat = "";
  try {
    pat = (await req.json())?.pat ?? "";
  } catch {
    return NextResponse.json({ valid: false, error: "bad_request" }, { status: 400 });
  }
  const result = await validateAdoPat(pat);
  return NextResponse.json(result);
}
