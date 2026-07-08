import { NextResponse } from "next/server";
import { azAdoBearer, basicFromPat, getRunDetail, getRunStatus } from "@/lib/ado";

/** Map ADO run state/result → the UI's job status. */
function normalize(state: string, result?: string): "running" | "done" | "failed" {
  if (state === "completed") {
    if (result === "succeeded") return "done";
    return "failed";
  }
  return "running";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pipelineId = Number(searchParams.get("pipelineId"));
  const runId = Number(searchParams.get("runId"));

  if (!Number.isFinite(pipelineId) || !Number.isFinite(runId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // ADO auth precedence, mirroring /api/run: the caller's own PAT (multi-user hub) →
  // the host's `az login` user (local dev) → the server service PAT (env, via getRunStatus/getRunDetail).
  const adoPat = req.headers.get("x-ado-pat")?.trim() || undefined;
  const auth = adoPat ? basicFromPat(adoPat) : ((await azAdoBearer()) ?? undefined);

  try {
    const [run, detail] = await Promise.all([
      getRunStatus(pipelineId, runId, auth),
      getRunDetail(runId, auth).catch(() => null),
    ]);

    const status = normalize(run.state, run.result);
    const logText = (detail?.logTail ?? []).join("\n");
    // A "failed" build can mean the review succeeded but found blocking
    // findings (exit 2 = merge gate), vs an actual execution error (exit 1).
    let outcome: "blocked" | "error" | null = null;
    let blockingCount: number | null = null;
    let mergeConfidence: number | null = null;
    if (status === "failed") {
      if (/BLOCKING FINDINGS DETECTED/i.test(logText)) {
        outcome = "blocked";
        blockingCount = Number(logText.match(/Blocking High-Severity Findings:\s*(\d+)/i)?.[1]) || null;
        mergeConfidence = Number(logText.match(/Merge Confidence:\s*(\d+)%/i)?.[1]) || null;
      } else {
        outcome = "error";
      }
    }

    // Work Item Breakdown emits a `BREAKDOWN SUMMARY:` marker on success (capability-agnostic;
    // null for runs that don't print it, e.g. PR Review).
    let createdCount: number | null = null;
    let linkedCount: number | null = null;
    let dryRun = false;
    const marker = logText.match(/BREAKDOWN SUMMARY:[^\n]*/i);
    if (marker) {
      createdCount = Number(marker[0].match(/created=(\d+)/i)?.[1] ?? "") || 0;
      linkedCount = Number(marker[0].match(/linked=(\d+)/i)?.[1] ?? "") || null;
      dryRun = /dryRun=1/i.test(marker[0]);
    }

    // `BREAKDOWN ITEMS: [...]` is a compact one-line JSON of the created/linked work items.
    // Build a clickable ADO url per item from the org/project env.
    type BreakdownItem = { type: string; id: number; title: string; parent: number; url: string };
    let items: BreakdownItem[] | null = null;
    const itemsMarker = logText.match(/BREAKDOWN ITEMS:\s*(\[.*\])\s*$/im);
    if (itemsMarker) {
      const org = process.env.ADO_ORG;
      const project = process.env.ADO_PROJECT;
      try {
        const parsed = JSON.parse(itemsMarker[1]) as Omit<BreakdownItem, "url">[];
        items = parsed.map((it) => ({
          ...it,
          url:
            org && project
              ? `https://dev.azure.com/${org}/${project}/_workitems/edit/${it.id}`
              : "",
        }));
      } catch {
        items = null;
      }
    }

    // Wiki Weaver emits a `WIKI SUMMARY:` marker on success (capability-agnostic; null otherwise).
    let wikiDryRun = false;
    const wikiMarker = logText.match(/WIKI SUMMARY:[^\n]*/i);
    if (wikiMarker) wikiDryRun = /dryRun=1/i.test(wikiMarker[0]);

    // `WIKI PAGES: [...]` is a compact one-line JSON of the published page(s).
    type WikiPage = { title: string; url: string };
    let wikiPages: WikiPage[] | null = null;
    const wikiPagesMarker = logText.match(/WIKI PAGES:\s*(\[.*\])\s*$/im);
    if (wikiPagesMarker) {
      try {
        wikiPages = JSON.parse(wikiPagesMarker[1]);
      } catch {
        wikiPages = null;
      }
    }

    return NextResponse.json({
      status,
      result: run.result,
      webUrl: run.webUrl,
      steps: detail?.steps ?? [],
      currentStep: detail?.currentStep ?? null,
      logTail: detail?.logTail ?? [],
      outcome,
      blockingCount,
      mergeConfidence,
      createdCount,
      linkedCount,
      dryRun,
      items,
      wikiDryRun,
      wikiPages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ado_error";
    return NextResponse.json({ error: "ado_error", message }, { status: 502 });
  }
}
