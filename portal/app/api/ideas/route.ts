import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { DOMAINS, IMPACTS, normalizeTags, type IdeaListItem, type IdeaStats } from "@/lib/ideas";

const EMPTY_STATS: IdeaStats = { total: 0, votes: 0, inPipeline: 0, shipped: 0 };

export async function GET(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ ideas: [], stats: EMPTY_STATS });
  await ensureSchema();

  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") === "new" ? "new" : "votes";
  const domain = url.searchParams.get("domain") ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const voter = url.searchParams.get("voter") ?? "";

  const where: string[] = [];
  const args: unknown[] = [voter];
  if (domain && DOMAINS.includes(domain as (typeof DOMAINS)[number])) {
    args.push(domain);
    where.push(`i.domain = $${args.length}`);
  }
  if (q) {
    args.push(`%${q}%`);
    where.push(
      `(i.title ILIKE $${args.length} OR i.body ILIKE $${args.length}
        OR EXISTS (SELECT 1 FROM unnest(i.tags) t WHERE t ILIKE $${args.length}))`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "new"
      ? "ORDER BY i.pinned DESC, i.created_at DESC"
      : "ORDER BY i.pinned DESC, vote_count DESC, i.created_at DESC";

  const rows = await db().query(
    `SELECT i.id, i.title, i.body, i.domain, i.status, i.impact, i.tags,
            i.author_name, i.is_anonymous, i.pinned, i.created_at,
            COUNT(DISTINCT v.voter_key)::int AS vote_count,
            COUNT(DISTINCT c.id)::int AS comment_count,
            BOOL_OR(v.voter_key = $1) AS has_voted
     FROM ideas i
     LEFT JOIN votes v ON v.idea_id = i.id
     LEFT JOIN comments c ON c.idea_id = i.id
     ${whereSql}
     GROUP BY i.id
     ${orderSql}`,
    args,
  );

  const stats = await db().query(
    `SELECT
       (SELECT COUNT(*)::int FROM ideas) AS total,
       (SELECT COUNT(*)::int FROM votes) AS votes,
       (SELECT COUNT(*)::int FROM ideas
          WHERE status IN ('under_review','planned','in_progress','in_pipeline')) AS in_pipeline,
       (SELECT COUNT(*)::int FROM ideas WHERE status = 'shipped') AS shipped`,
  );

  const ideas: IdeaListItem[] = rows.rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
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
  }));

  const s = stats.rows[0];
  return NextResponse.json({
    ideas,
    stats: { total: s.total, votes: s.votes, inPipeline: s.in_pipeline, shipped: s.shipped },
  });
}

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();

  let body: {
    title?: string;
    body?: string;
    proposedSolution?: string;
    domain?: string;
    impact?: string;
    tags?: unknown;
    authorKey?: string;
    authorName?: string;
    isAnonymous?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  const domain = body.domain?.trim();
  if (!title || !text || !domain) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (!DOMAINS.includes(domain as (typeof DOMAINS)[number]))
    return NextResponse.json({ error: "bad_domain" }, { status: 400 });
  const impact =
    body.impact && IMPACTS.includes(body.impact as (typeof IMPACTS)[number]) ? body.impact : null;
  const proposed = body.proposedSolution?.trim() || null;
  const tags = normalizeTags(body.tags);
  const isAnonymous = Boolean(body.isAnonymous);

  const res = await db().query(
    `INSERT INTO ideas
       (title, body, proposed_solution, domain, impact, tags, author_key, author_name, is_anonymous)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [title, text, proposed, domain, impact, tags, body.authorKey ?? null, body.authorName ?? null, isAnonymous],
  );
  return NextResponse.json({ id: res.rows[0].id }, { status: 201 });
}
