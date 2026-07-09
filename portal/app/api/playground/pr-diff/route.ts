import { NextResponse } from "next/server";
import { adoReadAuthHeader, adoReadable, parsePrUrl } from "@/lib/ado";

export const runtime = "nodejs";

type GitHubPr = { owner: string; repo: string; prNumber: string };

/** Parse a GitHub PR URL: github.com/{owner}/{repo}/pull/{number} */
function parseGitHubPrUrl(url: string): GitHubPr | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const m = u.pathname.match(/\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2], prNumber: m[3] };
  } catch {
    return null;
  }
}

/** Fetch the diff of an Azure DevOps PR using the REST API. */
async function fetchAdoPrDiff(
  org: string,
  project: string,
  repo: string,
  prId: string,
  adoPat: string,
): Promise<{ diff: string } | { error: string }> {
  if (!adoPat) {
    // Check if there's a service PAT or az login available
    const canAuth = await adoReadable();
    if (!canAuth) {
      return { error: "No ADO authentication available. Please configure your ADO PAT in Settings." };
    }
  }
  const auth = await adoReadAuthHeader(adoPat || undefined);

  // 1. Get the PR details to find source/target refs
  const prUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests/${prId}?api-version=7.1-preview.1`;
  const prRes = await fetch(prUrl, { headers: { Authorization: auth }, cache: "no-store" });
  if (!prRes.ok) {
    const status = prRes.status;
    if (status === 401 || status === 403) {
      return { error: `ADO authentication failed (${status}). Check your ADO PAT in Settings — it needs Code (Read) scope.` };
    }
    return { error: `Failed to fetch PR details (${status})` };
  }
  const prData = await prRes.json();
  const sourceRef = prData.sourceRefName; // e.g. refs/heads/feature-branch
  const targetRef = prData.targetRefName; // e.g. refs/heads/main

  // 2. Get the diff (iterations approach — get all changes from the PR)
  const iterUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests/${prId}/iterations?api-version=7.1-preview.1`;
  const iterRes = await fetch(iterUrl, { headers: { Authorization: auth }, cache: "no-store" });
  if (!iterRes.ok) {
    return { error: `Failed to fetch PR iterations (${iterRes.status})` };
  }
  const iterData = await iterRes.json();
  const iterations = iterData.value ?? [];
  const lastIter = iterations.length;

  if (lastIter === 0) {
    return { error: "PR has no iterations (no changes)" };
  }

  // 3. Get changes from the last iteration
  const changesUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/pullrequests/${prId}/iterations/${lastIter}/changes?api-version=7.1-preview.1`;
  const changesRes = await fetch(changesUrl, { headers: { Authorization: auth }, cache: "no-store" });
  if (!changesRes.ok) {
    return { error: `Failed to fetch PR changes (${changesRes.status})` };
  }
  const changesData = await changesRes.json();
  const changeEntries = changesData.changeEntries ?? [];

  // 4. For each changed file, fetch the content diff using the commits comparison
  const sourceCommit = iterations[lastIter - 1]?.sourceRefCommit?.commitId;
  const targetCommit = iterations[lastIter - 1]?.targetRefCommit?.commitId;

  if (!sourceCommit || !targetCommit) {
    // Fallback: just list changed files with their change types
    const summary = changeEntries
      .map((e: { item: { path: string }; changeType: string }) => `${e.changeType}: ${e.item?.path ?? "unknown"}`)
      .join("\n");
    return { diff: `## PR #${prId}: ${prData.title}\nSource: ${sourceRef} → Target: ${targetRef}\n\n### Changed Files:\n${summary}` };
  }

  // 5. Use the diffs endpoint to get actual file diffs
  const diffUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/diffs/commits?baseVersion=${targetCommit}&targetVersion=${sourceCommit}&api-version=7.1-preview.1`;
  const diffRes = await fetch(diffUrl, { headers: { Authorization: auth }, cache: "no-store" });

  let fileDiffs = "";
  if (diffRes.ok) {
    const diffData = await diffRes.json();
    const changes = diffData.changes ?? [];
    // Get content for each changed file (limit to avoid huge payloads)
    const filesToFetch = changes
      .filter((c: { item: { gitObjectType?: string; isFolder?: boolean } }) => !c.item?.isFolder && c.item?.gitObjectType !== "tree")
      .slice(0, 50); // max 50 files

    const fileContents: string[] = [];
    for (const change of filesToFetch) {
      const path = change.item?.path ?? "";
      const changeType = change.changeType ?? "edit";

      if (changeType === "delete") {
        fileContents.push(`\n--- a${path}\n+++ /dev/null\n[file deleted]`);
        continue;
      }

      // Fetch the new version of the file
      const fileUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/items?path=${encodeURIComponent(path)}&versionDescriptor.version=${sourceCommit}&versionDescriptor.versionType=commit&api-version=7.1-preview.1`;
      const fileRes = await fetch(fileUrl, { headers: { Authorization: auth }, cache: "no-store" });
      if (fileRes.ok) {
        const content = await fileRes.text();
        // Truncate very large files
        const truncated = content.length > 5000 ? content.slice(0, 5000) + "\n... [truncated]" : content;
        fileContents.push(`\n--- ${changeType === "add" ? "/dev/null" : `a${path}`}\n+++ b${path}\n${truncated}`);
      }
    }
    fileDiffs = fileContents.join("\n");
  }

  const header = `## PR #${prId}: ${prData.title}\n**Source:** ${sourceRef} → **Target:** ${targetRef}\n**Description:** ${prData.description ?? "N/A"}\n`;
  const changedFilesList = changeEntries
    .map((e: { item: { path: string }; changeType: string }) => `- ${e.changeType}: ${e.item?.path ?? "unknown"}`)
    .join("\n");

  return {
    diff: `${header}\n### Changed Files:\n${changedFilesList}\n\n### File Contents:\n${fileDiffs}`,
  };
}

/** Fetch the diff of a GitHub PR using the REST API. */
async function fetchGitHubPrDiff(
  owner: string,
  repo: string,
  prNumber: string,
  githubToken: string,
): Promise<{ diff: string } | { error: string }> {
  // GitHub's pull diff endpoint returns a unified diff when Accept: application/vnd.github.diff
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.diff",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    return { error: `Failed to fetch GitHub PR diff (${res.status})` };
  }
  const diff = await res.text();

  // Also fetch PR metadata
  const metaRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
      cache: "no-store",
    },
  );
  let title = "";
  let description = "";
  if (metaRes.ok) {
    const meta = await metaRes.json();
    title = meta.title ?? "";
    description = meta.body ?? "";
  }

  // Truncate if too large
  const maxLen = 80000;
  const truncatedDiff = diff.length > maxLen ? diff.slice(0, maxLen) + "\n... [diff truncated]" : diff;

  return {
    diff: `## PR #${prNumber}: ${title}\n**Description:** ${description || "N/A"}\n\n### Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``,
  };
}

type Body = {
  prUrl: string;
  githubToken?: string;
  adoPat?: string;
};

/**
 * POST /api/playground/pr-diff
 * Fetches the PR diff from Azure DevOps or GitHub given a PR URL.
 * Returns { diff: string } on success or { error: string } on failure.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const prUrl = String(body.prUrl ?? "").trim();
  if (!prUrl) {
    return NextResponse.json({ error: "missing_pr_url" }, { status: 400 });
  }

  // Try ADO first
  const adoParsed = parsePrUrl(prUrl);
  if (adoParsed) {
    try {
      const result = await fetchAdoPrDiff(
        adoParsed.org,
        adoParsed.project,
        adoParsed.repo,
        adoParsed.prId,
        body.adoPat ?? "",
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      return NextResponse.json({ diff: result.diff });
    } catch (e) {
      return NextResponse.json(
        { error: `ADO fetch error: ${(e as Error).message}` },
        { status: 502 },
      );
    }
  }

  // Try GitHub
  const ghParsed = parseGitHubPrUrl(prUrl);
  if (ghParsed) {
    try {
      const result = await fetchGitHubPrDiff(
        ghParsed.owner,
        ghParsed.repo,
        ghParsed.prNumber,
        body.githubToken ?? "",
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }
      return NextResponse.json({ diff: result.diff });
    } catch (e) {
      return NextResponse.json(
        { error: `GitHub fetch error: ${(e as Error).message}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    { error: "Unrecognized PR URL format. Provide an Azure DevOps or GitHub pull request URL." },
    { status: 400 },
  );
}

