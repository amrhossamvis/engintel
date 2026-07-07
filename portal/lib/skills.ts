export type SkillSort = "new" | "popular" | "trending" | "hot";

/** Weekly install counts, oldest→newest, fixed length for sparklines. */
export const ACTIVITY_WEEKS = 8;

export type SkillListItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  guild: string | null;
  tag: string | null;
  installCmd: string;
  repoUrl: string | null;
  authorName: string | null;
  stars: number | null;
  installCount: number;
  activity: number[];
  createdAt: string;
};

export type SkillDetail = SkillListItem & {
  summary: string | null;
  readme: string | null;
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** owner/repo parsed from a github.com URL, or null for any other host. */
export function parseGithubRepo(repoUrl: string | null | undefined): { owner: string; repo: string } | null {
  if (!repoUrl) return null;
  const m = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/** Install command shown on cards + detail. Repo-aware; falls back to slug. */
export function buildInstallCmd(repoUrl: string | null | undefined, slug: string): string {
  const gh = parseGithubRepo(repoUrl);
  if (gh) return `npx skills add https://github.com/${gh.owner}/${gh.repo} --skill ${slug}`;
  if (repoUrl) return `npx skills add ${repoUrl} --skill ${slug}`;
  return `npx skills add ${slug}`;
}
