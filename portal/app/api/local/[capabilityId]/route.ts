import { NextResponse } from "next/server";
import { adoReadable, adoReadAuthHeader } from "@/lib/ado";
import { LOCAL_HANDLERS, startLocalJob } from "@/lib/local";

type Body = {
  inputs: Record<string, string | boolean>;
  githubToken: string;
  adoPat?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ capabilityId: string }> },
) {
  const { capabilityId } = await params;
  const handler = LOCAL_HANDLERS[capabilityId];
  if (!handler) return NextResponse.json({ error: "unknown_capability" }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { inputs, githubToken, adoPat } = body;
  if (!githubToken || githubToken.trim().length < 8) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const trimmedPat = adoPat?.trim();
  if (!(await adoReadable(trimmedPat))) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  const adoAuth = await adoReadAuthHeader(trimmedPat);
  const jobId = startLocalJob(handler, inputs, { adoAuth, githubToken: githubToken.trim() });
  return NextResponse.json({ jobId });
}
