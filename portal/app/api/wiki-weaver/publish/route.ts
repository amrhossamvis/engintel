import { NextResponse } from "next/server";
import { adoReadable, adoReadAuthHeader } from "@/lib/ado";
import { publishGeneratedWikiPage } from "@/lib/local/wiki-weaver";

type Body = {
  content: string;
  rootType: string;
  rootId: number;
  rootTitle: string;
  wikiParentUrl: string;
  postSummaryComment: boolean;
  adoPat?: string;
};

/**
 * Publishes a Wiki Weaver draft the user has already reviewed. Separate from
 * the local-job system (lib/local) since this is a fast, synchronous write —
 * no Copilot call, no need for job polling.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { content, rootType, rootId, rootTitle, wikiParentUrl, postSummaryComment, adoPat } = body;
  if (!content?.trim() || !rootType || !rootId || !rootTitle) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const trimmedPat = adoPat?.trim();
  if (!(await adoReadable(trimmedPat))) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  try {
    const adoAuth = await adoReadAuthHeader(trimmedPat);
    const page = await publishGeneratedWikiPage(
      { content, rootType, rootId, rootTitle, wikiParentUrl: wikiParentUrl ?? "", postSummaryComment: Boolean(postSummaryComment) },
      adoAuth,
    );
    return NextResponse.json({ webUrl: page.url, title: page.title });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ado_error";
    return NextResponse.json({ error: "ado_error", message }, { status: 502 });
  }
}
