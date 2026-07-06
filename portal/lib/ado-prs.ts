/**
 * Server-only ADO pull-request reads for the productivity index. Basic-auth via
 * the service PAT, matching the sibling ado-metrics data source.
 */

export type Repo = { id: string; name: string };

type AdoPr = { creationDate?: string; closedDate?: string };

/** Repo names PR metrics are read from, from env. Empty → PR reads are skipped. */
export function productivityRepoNames(): string[] {
  return (process.env.ADO_PRODUCTIVITY_REPOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
async function adoGet(url: string, auth: string, params?: Record<string, string | number>): Promise<any> {
  const qs = params
    ? "&" + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const res = await fetch(`${url}${qs}`, { headers: { Authorization: auth }, cache: "no-store" });
  if (!res.ok) throw new Error(`ado_${res.status}`);
  return res.json();
}

/** Resolve repo names (case-insensitive) to ids. Empty names → no PR reads. */
export async function resolveRepoIds(
  org: string,
  project: string,
  repoNames: string[],
  auth: string,
): Promise<Repo[]> {
  if (repoNames.length === 0) return [];
  try {
    const data = await adoGet(
      `https://dev.azure.com/${org}/${project}/_apis/git/repositories?api-version=7.0`,
      auth,
    );
    const all: Array<{ id: string; name: string }> = data.value ?? [];
    return all
      .filter((r) => repoNames.some((n) => r.name.toLowerCase() === n.toLowerCase()))
      .map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

async function fetchPRsForDateRange(
  org: string,
  project: string,
  repoId: string,
  minDate: string,
  maxDate: string,
  auth: string,
): Promise<AdoPr[]> {
  try {
    // searchCriteria.minTime filters by CREATION date, not closedDate. A PR
    // created before the sprint but merged during it would be missed if we used
    // sprint start as minTime. Cast a 90-day-wide net, then filter client-side
    // to PRs whose closedDate lands inside the sprint window.
    const sprintEnd = new Date(maxDate);
    const wideMin = new Date(sprintEnd);
    wideMin.setDate(wideMin.getDate() - 90);
    const wideMinStr = wideMin.toISOString().split("T")[0];

    const data = await adoGet(
      `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoId}/pullrequests`,
      auth,
      {
        "searchCriteria.status": "completed",
        "searchCriteria.minTime": wideMinStr,
        $top: 500,
        "api-version": "7.0",
      },
    );
    const prs: AdoPr[] = data.value ?? [];
    const sprintStart = new Date(minDate).getTime();
    const sprintEndMs = sprintEnd.getTime();
    return prs.filter((pr) => {
      if (!pr.closedDate) return false;
      const closed = new Date(pr.closedDate).getTime();
      return closed >= sprintStart && closed <= sprintEndMs;
    });
  } catch {
    return [];
  }
}

export async function fetchPRsFromAllRepos(
  org: string,
  project: string,
  repos: Repo[],
  minDate: string,
  maxDate: string,
  auth: string,
): Promise<AdoPr[]> {
  if (repos.length === 0) return [];
  const results = await Promise.all(
    repos.map((r) => fetchPRsForDateRange(org, project, r.id, minDate, maxDate, auth)),
  );
  return results.flat();
}

export function calcPRCycleTime(prs: AdoPr[]): { avg: number; median: number } {
  if (prs.length === 0) return { avg: 0, median: 0 };
  const times = prs
    .filter((pr) => pr.creationDate && pr.closedDate)
    .map((pr) => (new Date(pr.closedDate as string).getTime() - new Date(pr.creationDate as string).getTime()) / (1000 * 60 * 60 * 24))
    .filter((t) => t >= 0);
  if (times.length === 0) return { avg: 0, median: 0 };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { avg: Math.round(avg * 10) / 10, median: Math.round(median * 10) / 10 };
}
