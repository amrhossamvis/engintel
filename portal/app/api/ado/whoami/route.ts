import { NextResponse } from "next/server";
import { azWhoami } from "@/lib/ado";

/** Who the hub will queue pipelines as — the host's Azure CLI (`az login`) user. */
export async function GET() {
  const name = await azWhoami();
  return NextResponse.json({ signedIn: !!name, name });
}
