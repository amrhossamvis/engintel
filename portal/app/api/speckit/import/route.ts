import { writeArtifact } from "@/lib/speckit-session";

export const runtime = "nodejs";

type Body = {
  sessionId: string;
  filename: string;
  content: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { sessionId, filename, content } = body;

  if (!sessionId || sessionId.length < 8) {
    return Response.json({ error: "invalid_session" }, { status: 400 });
  }
  if (!filename || !content) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    await writeArtifact(sessionId, filename, content);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "write_failed" }, { status: 500 });
  }
}

