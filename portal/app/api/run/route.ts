import { NextResponse } from "next/server";
import {
  adoConfigured,
  azAdoBearer,
  basicFromPat,
  pipelineBranchFor,
  pipelineIdFor,
  runPipeline,
} from "@/lib/ado";

type Body = {
  capabilityId: string;
  inputs: Record<string, string | boolean>;
  githubToken: string;
  adoPat?: string;
};

/**
 * Build the templateParameters for each capability from its form inputs.
 * Every capability now runs "local" or "hub-inline" — no catalog entry has
 * execution: "pipeline" anymore. This route (and the ADO Pipeline
 * trigger/status infrastructure it calls into) is currently unreachable dead
 * code, kept only in case a future capability needs it again.
 */
function buildParams(): { params: Record<string, string | boolean> } | { error: string } {
  return { error: "not_configured" };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { capabilityId, githubToken, adoPat } = body;
  if (!githubToken || githubToken.trim().length < 8) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  // ADO auth precedence: the caller's own PAT (multi-user hub) → the host's
  // `az login` user (local dev) → the server service PAT (env, via runPipeline).
  const adoAuth = adoPat?.trim()
    ? basicFromPat(adoPat.trim())
    : ((await azAdoBearer()) ?? undefined);

  const pipelineId = pipelineIdFor(capabilityId);
  if (!pipelineId || (!adoConfigured() && !adoAuth)) {
    // No pipeline mapping or no ADO auth at all → client falls back to simulation.
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const built = buildParams();
  if ("error" in built) {
    const status = built.error === "not_configured" ? 501 : 400;
    return NextResponse.json({ error: built.error }, { status });
  }

  try {
    // Pass secrets the pipeline script needs at runtime:
    // - COPILOT_GITHUB_TOKEN for AI calls
    // - ADO_PAT / GIT_PAT for git clone/push operations
    const secrets: Record<string, string> = { COPILOT_GITHUB_TOKEN: githubToken };
    if (adoPat?.trim()) {
      secrets.ADO_PAT = adoPat.trim();
      secrets.GIT_PAT = adoPat.trim();
    }

    const run = await runPipeline(
      pipelineId,
      built.params,
      secrets,
      adoAuth,
      pipelineBranchFor(capabilityId),
    );
    return NextResponse.json({ ...run, pipelineId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ado_error";
    return NextResponse.json({ error: "ado_error", message }, { status: 502 });
  }
}
