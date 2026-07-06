import { parseGithubRepo } from "@/lib/skills";

type Fetched = { readme: string | null; stars: number | null };

/**
 * Best-effort snapshot from a public github.com repo: SKILL.md body + star count.
 * Any failure (private repo, no SKILL.md, rate limit, non-github host) returns
 * nulls — publishing must never depend on the source being reachable.
 */
export async function fetchGithubSkill(repoUrl: string | null | undefined): Promise<Fetched> {
  const gh = parseGithubRepo(repoUrl);
  if (!gh) return { readme: null, stars: null };

  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let stars: number | null = null;
  let defaultBranch = "main";
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (repoRes.ok) {
      const data = (await repoRes.json()) as { stargazers_count?: number; default_branch?: string };
      stars = typeof data.stargazers_count === "number" ? data.stargazers_count : null;
      if (data.default_branch) defaultBranch = data.default_branch;
    }
  } catch {
    // metadata unreachable — leave stars null
  }

  let readme: string | null = null;
  for (const path of ["SKILL.md", "skill.md", "README.md"]) {
    try {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${defaultBranch}/${path}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (raw.ok) {
        readme = await raw.text();
        break;
      }
    } catch {
      // try next candidate path
    }
  }

  return { readme, stars };
}
