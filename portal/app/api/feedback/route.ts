import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { CAPABILITIES } from "@/lib/capabilities";
import {
  FEEDBACK_TYPES,
  MAX_MESSAGE,
  MAX_NAME,
  ratingRequired,
  type FeedbackItem,
  type FeedbackStats,
  type RatingDistribution,
} from "@/lib/feedback";

const EMPTY_STATS: FeedbackStats = { total: 0, avgRating: null, bugReports: 0, featureRequests: 0 };
const EMPTY_DIST: RatingDistribution = [0, 0, 0, 0, 0];

export async function GET(req: Request) {
  if (!dbConfigured())
    return NextResponse.json({ items: [], stats: EMPTY_STATS, distribution: EMPTY_DIST });
  await ensureSchema();

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const app = url.searchParams.get("app") ?? "";

  const where: string[] = [];
  const args: unknown[] = [];
  if (FEEDBACK_TYPES.includes(type as (typeof FEEDBACK_TYPES)[number])) {
    args.push(type);
    where.push(`type = $${args.length}`);
  }
  if (app === "general") {
    where.push(`capability_id IS NULL`);
  } else if (app && CAPABILITIES.some((c) => c.id === app)) {
    args.push(app);
    where.push(`capability_id = $${args.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db().query(
    `SELECT id, capability_id, type, rating, message, status, contact_ok,
            author_name, is_anonymous, created_at
     FROM feedback ${whereSql}
     ORDER BY created_at DESC
     LIMIT 500`,
    args,
  );

  // Stats/distribution honour the same filters as the list, so the KPIs, the bars
  // and the "N entries" counter always describe the same slice of feedback.
  const agg = await db().query(
    `SELECT
       COUNT(*)::int AS total,
       AVG(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating,
       COUNT(*) FILTER (WHERE type = 'bug')::int AS bug_reports,
       COUNT(*) FILTER (WHERE type = 'feature')::int AS feature_requests
     FROM feedback ${whereSql}`,
    args,
  );
  const distWhere = where.length
    ? `WHERE ${where.join(" AND ")} AND rating BETWEEN 1 AND 5`
    : `WHERE rating BETWEEN 1 AND 5`;
  const dist = await db().query(
    `SELECT rating, COUNT(*)::int AS n FROM feedback ${distWhere} GROUP BY rating`,
    args,
  );

  const items: FeedbackItem[] = rows.rows.map((r) => ({
    id: r.id,
    capabilityId: r.capability_id,
    type: r.type,
    rating: r.rating,
    message: r.message,
    status: r.status,
    contactOk: r.contact_ok,
    authorName: r.is_anonymous ? null : r.author_name,
    isAnonymous: r.is_anonymous,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const a = agg.rows[0];
  const stats: FeedbackStats = {
    total: a.total,
    avgRating: a.avg_rating === null ? null : Number(a.avg_rating),
    bugReports: a.bug_reports,
    featureRequests: a.feature_requests,
  };
  const distribution: RatingDistribution = [0, 0, 0, 0, 0];
  for (const d of dist.rows) distribution[d.rating - 1] = d.n;

  return NextResponse.json({ items, stats, distribution });
}

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();

  let body: {
    type?: string;
    rating?: number | null;
    message?: string;
    capabilityId?: string | null;
    contactOk?: boolean;
    authorKey?: string;
    authorName?: string;
    isAnonymous?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const type = body.type as (typeof FEEDBACK_TYPES)[number];
  if (!FEEDBACK_TYPES.includes(type))
    return NextResponse.json({ error: "bad_type" }, { status: 400 });

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "missing_message" }, { status: 400 });

  let rating: number | null = null;
  if (body.rating != null) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
      return NextResponse.json({ error: "bad_rating" }, { status: 400 });
    rating = body.rating;
  }
  if (ratingRequired(type) && rating === null)
    return NextResponse.json({ error: "rating_required" }, { status: 400 });

  let capabilityId: string | null = null;
  if (body.capabilityId) {
    if (!CAPABILITIES.some((c) => c.id === body.capabilityId))
      return NextResponse.json({ error: "bad_capability" }, { status: 400 });
    capabilityId = body.capabilityId;
  }

  const isAnonymous = Boolean(body.isAnonymous);
  // Can't follow up on anonymous feedback.
  const contactOk = isAnonymous ? false : Boolean(body.contactOk);
  const authorName = isAnonymous ? null : body.authorName?.trim().slice(0, MAX_NAME) || null;

  const res = await db().query(
    `INSERT INTO feedback
       (capability_id, type, rating, message, contact_ok, author_key, author_name, is_anonymous)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      capabilityId,
      type,
      rating,
      message.slice(0, MAX_MESSAGE),
      contactOk,
      body.authorKey ?? null,
      authorName,
      isAnonymous,
    ],
  );
  return NextResponse.json({ id: res.rows[0].id }, { status: 201 });
}
