import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { azWhoami } from "@/lib/ado";
import { DOMAINS, IMPACTS, STATUSES, normalizeTags } from "@/lib/ideas";
import type { Comment, IdeaDetail } from "@/lib/ideas";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;
  const voter = new URL(req.url).searchParams.get("voter") ?? "";

  const rows = await db().query(
    `SELECT i.id, i.title, i.body, i.proposed_solution, i.domain, i.status, i.impact, i.tags,
            i.author_name, i.is_anonymous, i.pinned, i.created_at,
            COUNT(DISTINCT v.voter_key)::int AS vote_count,
            COUNT(DISTINCT c.id)::int AS comment_count,
            BOOL_OR(v.voter_key = $2) AS has_voted
     FROM ideas i
     LEFT JOIN votes v ON v.idea_id = i.id
     LEFT JOIN comments c ON c.idea_id = i.id
     WHERE i.id = $1
     GROUP BY i.id`,
    [id, voter],
  );
  if (!rows.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const r = rows.rows[0];

  const cRows = await db().query(
    `SELECT id, author_name, is_anonymous, body, created_at
     FROM comments WHERE idea_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  const comments: Comment[] = cRows.rows.map((c) => ({
    id: c.id,
    authorName: c.is_anonymous ? null : c.author_name,
    isAnonymous: c.is_anonymous,
    body: c.body,
    createdAt: new Date(c.created_at).toISOString(),
  }));

  const detail: IdeaDetail = {
    id: r.id,
    title: r.title,
    body: r.body,
    proposedSolution: r.proposed_solution,
    domain: r.domain,
    status: r.status,
    impact: r.impact,
    tags: r.tags ?? [],
    authorName: r.is_anonymous ? null : r.author_name,
    isAnonymous: r.is_anonymous,
    pinned: r.pinned,
    voteCount: r.vote_count,
    commentCount: r.comment_count,
    hasVoted: Boolean(r.has_voted),
    createdAt: new Date(r.created_at).toISOString(),
    comments,
    isAdmin: await isAdmin(),
  };
  return NextResponse.json(detail);
}

// Identity is derived server-side from the host `az login` user, never from the
// request body — a client-supplied key would be trivially spoofable.
async function isAdmin(): Promise<boolean> {
  const allow = (process.env.IDEAS_ADMINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true; // open in prototype
  const who = (await azWhoami())?.toLowerCase();
  return Boolean(who && allow.includes(who));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;

  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    title?: string;
    body?: string;
    proposedSolution?: string | null;
    domain?: string;
    status?: string;
    impact?: string | null;
    tags?: unknown;
    pinned?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "empty_title" }, { status: 400 });
    args.push(title);
    sets.push(`title = $${args.length}`);
  }
  if (body.body !== undefined) {
    const text = body.body.trim();
    if (!text) return NextResponse.json({ error: "empty_body" }, { status: 400 });
    args.push(text);
    sets.push(`body = $${args.length}`);
  }
  if (body.proposedSolution !== undefined) {
    args.push(body.proposedSolution?.trim() || null);
    sets.push(`proposed_solution = $${args.length}`);
  }
  if (body.domain !== undefined) {
    if (!DOMAINS.includes(body.domain as (typeof DOMAINS)[number]))
      return NextResponse.json({ error: "bad_domain" }, { status: 400 });
    args.push(body.domain);
    sets.push(`domain = $${args.length}`);
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number]))
      return NextResponse.json({ error: "bad_status" }, { status: 400 });
    args.push(body.status);
    sets.push(`status = $${args.length}`);
  }
  if (body.impact !== undefined) {
    if (body.impact !== null && !IMPACTS.includes(body.impact as (typeof IMPACTS)[number]))
      return NextResponse.json({ error: "bad_impact" }, { status: 400 });
    args.push(body.impact);
    sets.push(`impact = $${args.length}`);
  }
  if (body.tags !== undefined) {
    args.push(normalizeTags(body.tags));
    sets.push(`tags = $${args.length}`);
  }
  if (body.pinned !== undefined) {
    args.push(Boolean(body.pinned));
    sets.push(`pinned = $${args.length}`);
  }
  if (sets.length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  args.push(id);
  const res = await db().query(
    `UPDATE ideas SET ${sets.join(", ")}, updated_at = now() WHERE id = $${args.length}`,
    args,
  );
  if (!res.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();
  const { id } = await params;

  if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const res = await db().query("DELETE FROM ideas WHERE id = $1", [id]);
  if (!res.rowCount) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
