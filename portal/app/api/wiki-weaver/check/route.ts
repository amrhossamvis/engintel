import { NextResponse } from "next/server";
import { adoReadable, adoReadAuthHeader } from "@/lib/ado";
import { checkWikiPageExists } from "@/lib/local/wiki-weaver";

type Body = {
  rootType: string;
  rootId: number;
  rootTitle: string;
  wikiParentUrl: string;
  adoPat?: string;
};

/**
 * Read-only pre-flight check the client calls before publish, so it can ask
 * the user to confirm an overwrite instead of silently replacing an existing
 * wiki page. No write happens here.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { rootType, rootId, rootTitle, wikiParentUrl, adoPat } = body;
  if (!rootType || !rootId || !rootTitle) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const trimmedPat = adoPat?.trim();
  if (!(await adoReadable(trimmedPat))) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  try {
    const adoAuth = await adoReadAuthHeader(trimmedPat);
    const result = await checkWikiPageExists({ rootType, rootId, rootTitle, wikiParentUrl: wikiParentUrl ?? "" }, adoAuth);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ado_error";
    return NextResponse.json({ error: "ado_error", message }, { status: 502 });
  }
}
