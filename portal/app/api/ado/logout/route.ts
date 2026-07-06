import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pExecFile = promisify(execFile);

/** Clear the host's Azure CLI session (`az logout`). */
export async function POST() {
  try {
    await pExecFile("az", ["logout", "--only-show-errors"], { timeout: 15_000 });
  } catch {
    // `az logout` errors when already signed out — treat as success.
  }
  return NextResponse.json({ ok: true });
}
