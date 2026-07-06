import { NextResponse } from "next/server";
import { db, dbConfigured, ensureSchema } from "@/lib/db";
import { buildInstallCmd, slugify, type SkillListItem, type SkillSort } from "@/lib/skills";
import { fetchGithubSkill } from "@/lib/skills-fetch";
import { emptyActivity, loadActivity } from "@/lib/skills-activity";

export async function GET(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ skills: [] });
  await ensureSchema();

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const guild = url.searchParams.get("guild")?.trim() ?? "";
  const sortParam = url.searchParams.get("sort");
  const sort: SkillSort =
    sortParam === "popular" || sortParam === "trending" || sortParam === "hot"
      ? sortParam
      : "new";

  const where: string[] = [];
  const args: unknown[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push(
      `(name ILIKE $${args.length} OR description ILIKE $${args.length} OR slug ILIKE $${args.length})`,
    );
  }
  if (guild) {
    args.push(guild);
    where.push(`guild = $${args.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "popular"
      ? "ORDER BY install_count DESC, created_at DESC"
      : "ORDER BY created_at DESC";

  const rows = await db().query(
    `SELECT id, name, slug, description, guild, tag, install_cmd, repo_url,
            author_name, stars, install_count, created_at
     FROM skills
     ${whereSql}
     ${orderSql}`,
    args,
  );

  const activity = await loadActivity();

  const skills: SkillListItem[] = rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    guild: r.guild,
    tag: r.tag,
    installCmd: r.install_cmd,
    repoUrl: r.repo_url,
    authorName: r.author_name,
    stars: r.stars,
    installCount: r.install_count,
    activity: (activity.get(r.id) ?? emptyActivity()).activity,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Trending / Hot rank by recent install velocity, tie-broken by total installs.
  if (sort === "trending" || sort === "hot") {
    const metric = (id: string) => {
      const a = activity.get(id) ?? emptyActivity();
      return sort === "trending" ? a.trend24 : a.trend7d;
    };
    skills.sort((x, y) => metric(y.id) - metric(x.id) || y.installCount - x.installCount);
  }

  return NextResponse.json({ skills });
}

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 501 });
  await ensureSchema();

  let body: {
    name?: string;
    description?: string;
    summary?: string;
    tag?: string;
    guild?: string;
    repoUrl?: string;
    installCmd?: string;
    readme?: string;
    authorKey?: string;
    authorName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const name = body.name?.trim();
  const description = body.description?.trim();
  if (!name || !description)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const repoUrl = body.repoUrl?.trim() || null;
  const slug = slugify(name);
  const installCmd = body.installCmd?.trim() || buildInstallCmd(repoUrl, slug);

  // Author-supplied content wins; otherwise pull a snapshot from a public repo.
  let readme = body.readme?.trim() || null;
  let stars: number | null = null;
  if (!readme || repoUrl) {
    const fetched = await fetchGithubSkill(repoUrl);
    readme = readme ?? fetched.readme;
    stars = fetched.stars;
  }

  try {
    const res = await db().query(
      `INSERT INTO skills
         (name, slug, description, summary, tag, guild, install_cmd, repo_url, readme, stars, author_key, author_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        name,
        slug,
        description,
        body.summary?.trim() || null,
        body.tag?.trim() || null,
        body.guild ?? null,
        installCmd,
        repoUrl,
        readme,
        stars,
        body.authorKey ?? null,
        body.authorName?.trim() || "VOIS Engineer",
      ],
    );
    return NextResponse.json({ id: res.rows[0].id, slug }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /duplicate key/.test(e.message))
      return NextResponse.json({ error: "duplicate_slug" }, { status: 409 });
    throw e;
  }
}
