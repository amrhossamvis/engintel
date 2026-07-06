import { NextResponse } from "next/server";
import { INLINE_HANDLERS } from "@/lib/inline";

// Some inline features do real ADO reads — allow headroom.
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ capabilityId: string }> },
) {
  const { capabilityId } = await params;
  const handler = INLINE_HANDLERS[capabilityId];
  if (!handler) return NextResponse.json({ error: "unknown_capability" }, { status: 404 });

  let inputs: Record<string, string | boolean> = {};
  try {
    inputs = (await req.json()) ?? {};
  } catch {
    // no body is fine for input-less dashboards
  }

  // Per-user ADO identity: the caller's PAT, kept out of the body so form inputs
  // stay clean. Absent → the handler falls back to `az login` / the service PAT.
  const adoPat = req.headers.get("x-ado-pat")?.trim() || undefined;

  try {
    const output = await handler(inputs, { adoPat });
    return NextResponse.json({ output });
  } catch (e) {
    const message = e instanceof Error ? e.message : "inline_error";
    if (message === "ado_not_configured")
      return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
    return NextResponse.json({ error: "inline_error", message }, { status: 502 });
  }
}
