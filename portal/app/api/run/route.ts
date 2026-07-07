import { NextResponse } from "next/server";
import {
  adoConfigured,
  azAdoBearer,
  basicFromPat,
  parsePrUrl,
  parseWorkItemId,
  pipelineIdFor,
  runPipeline,
} from "@/lib/ado";

type Body = {
  capabilityId: string;
  inputs: Record<string, string | boolean>;
  githubToken: string;
  adoPat?: string;
};

/** Build the templateParameters for each capability from its form inputs. */
function buildParams(
  capabilityId: string,
  inputs: Record<string, string | boolean>,
): { params: Record<string, string | boolean> } | { error: string } {
  switch (capabilityId) {
    case "pr-review":
    case "ui-testdata": {
      const parsed = parsePrUrl(String(inputs.prUrl ?? ""));
      if (!parsed) return { error: "bad_pr_url" };
      return {
        params: {
          adoRepo: parsed.repo,
          adoPrId: parsed.prId,
          dryRun: Boolean(inputs.dryRun),
        },
      };
    }
    case "bug-triage": {
      const bugId = parseWorkItemId(String(inputs.bugUrl ?? ""));
      if (!bugId) return { error: "bad_work_item_url" };
      return { params: { bugIds: bugId, dryRun: false } };
    }
    case "feature-breakdown": {
      const workItemUrl = String(inputs.workItemUrl ?? "").trim();
      if (!workItemUrl) return { error: "missing_work_item" };
      const areaPath = String(inputs.areaPath ?? "").trim();
      const additionalInstructions = String(inputs.additionalInstructions ?? "").trim();
      return {
        params: {
          workItemUrl,
          teamName: "generic",
          isTechBreakdown: Boolean(inputs.isTechBreakdown),
          createParentComment: Boolean(inputs.createParentComment),
          dryRun: Boolean(inputs.dryRun),
          // ADO rejects an empty string for an optional string templateParameter
          // ("not a valid String") — omit so the pipeline's `default: ''` applies.
          ...(areaPath ? { areaPath } : {}),
          ...(additionalInstructions ? { poRecommendations: additionalInstructions } : {}),
        },
      };
    }
    case "business-intent": {
      const businessIntent = String(inputs.businessIntent ?? "").trim();
      if (!businessIntent) return { error: "missing_business_intent" };
      const areaPath = String(inputs.areaPath ?? "").trim();
      const iterationPath = String(inputs.iterationPath ?? "").trim();
      if (!areaPath) return { error: "missing_area_path" };
      if (!iterationPath) return { error: "missing_iteration_path" };
      return {
        params: {
          businessIntent,
          areaPath,
          iterationPath,
          teamName: String(inputs.teamName ?? "generic").trim() || "generic",
          addGeneratedHierarchyComment: Boolean(inputs.addGeneratedHierarchyComment),
          dryRun: Boolean(inputs.dryRun),
        },
      };
    }
    case "sprint-health": {
      const backlogUrl = String(inputs.backlogUrl ?? "").trim();
      if (!backlogUrl) return { error: "missing_backlog" };
      return {
        params: { backlogUrl, iterationNumber: String(inputs.iteration ?? "") },
      };
    }
    case "testcase-ado": {
      const workItemId = parseWorkItemId(String(inputs.workItemUrl ?? ""));
      if (!workItemId) return { error: "bad_work_item_url" };
      return { params: { workItemId, dryRun: false } };
    }
    default:
      // e.g. testcase-figma has no live pipeline yet.
      return { error: "not_configured" };
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { capabilityId, inputs, githubToken, adoPat } = body;
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

  const built = buildParams(capabilityId, inputs);
  if ("error" in built) {
    const status = built.error === "not_configured" ? 501 : 400;
    return NextResponse.json({ error: built.error }, { status });
  }

  try {
    const run = await runPipeline(
      pipelineId,
      built.params,
      { COPILOT_GITHUB_TOKEN: githubToken },
      adoAuth,
    );
    return NextResponse.json({ ...run, pipelineId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ado_error";
    return NextResponse.json({ error: "ado_error", message }, { status: 502 });
  }
}
