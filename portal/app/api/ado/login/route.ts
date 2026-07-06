import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { azWhoami } from "@/lib/ado";

const pExecFile = promisify(execFile);

// Interactive `az login` opens the host's browser and blocks until the user
// finishes — give it room. Only meaningful when the server shares the user's
// machine (the localhost dev hub), which is exactly this prototype.
export const maxDuration = 120;

export async function POST() {
  try {
    await pExecFile("az", ["login", "--only-show-errors"], { timeout: 110_000 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "login_failed";
    if (/ENOENT/.test(message)) {
      return NextResponse.json({ ok: false, error: "az_not_found" });
    }
    return NextResponse.json({ ok: false, error: "login_failed", message });
  }
  const name = await azWhoami();
  return NextResponse.json({ ok: !!name, name });
}
