import { db, dbConfigured, ensureSchema } from "@/lib/db";
import type { SkillDetail } from "@/lib/skills";
import { emptyActivity, loadActivity } from "@/lib/skills-activity";

export async function getSkillBySlug(slug: string): Promise<SkillDetail | null> {
  if (!dbConfigured()) return null;
  await ensureSchema();

  const res = await db().query(
    `SELECT id, name, slug, description, summary, tag, guild, install_cmd,
            repo_url, readme, author_name, stars, install_count, created_at
     FROM skills WHERE slug = $1`,
    [slug],
  );
  const r = res.rows[0];
  if (!r) return null;

  const activity = (await loadActivity()).get(r.id) ?? emptyActivity();

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    summary: r.summary,
    tag: r.tag,
    guild: r.guild,
    installCmd: r.install_cmd,
    repoUrl: r.repo_url,
    readme: r.readme,
    authorName: r.author_name,
    stars: r.stars,
    installCount: r.install_count,
    activity: activity.activity,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
