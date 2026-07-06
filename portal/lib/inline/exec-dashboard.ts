import { adoReadable, adoReadAuthHeader, authFingerprint } from "@/lib/ado";
import { fetchTeamDashboard, type TeamDashboard } from "@/lib/ado-metrics";

export type ExecDashboardOutput = {
  teams: TeamDashboard[];
  summary: {
    totalTeams: number;
    healthyTeams: number;
    atRiskTeams: number;
    criticalTeams: number;
    avgHealthScore: number;
    orgHealthStatus: "green" | "amber" | "red";
  };
};

// ADO reads are the slow part and stable minute-to-minute — memoise per team.
type Cached = { dash: TeamDashboard; fetchedAt: number };
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, Cached>();

function teamFromInputs(inputs: Record<string, string | boolean>): string | null {
  const t = inputs.team;
  return typeof t === "string" && t.trim() !== "" ? t.trim() : null;
}

async function getDashboard(
  organization: string,
  project: string,
  team: string,
  auth: string,
): Promise<TeamDashboard> {
  // Keyed by caller identity too — team metrics must not leak across users who
  // read with different ADO credentials.
  const key = `${authFingerprint(auth)}|${organization}|${project}|${team}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.dash;
  const dash = await fetchTeamDashboard({ organization, project, team }, 6, auth);
  cache.set(key, { dash, fetchedAt: Date.now() });
  return dash;
}

// Single team from env default or the run input. Multi-team org rollup is
// deferred (needs a teams config UI); the summary still reports RAG counts.
export async function runExecDashboard(
  inputs: Record<string, string | boolean> = {},
  adoPat?: string,
): Promise<ExecDashboardOutput> {
  if (!(await adoReadable(adoPat))) throw new Error("ado_not_configured");
  const organization = process.env.ADO_ORG ?? "vfuk-digital";
  const project = process.env.ADO_PROJECT ?? "Digital";
  const team = teamFromInputs(inputs) ?? process.env.ADO_DEFAULT_TEAM ?? "VOXI Digital";
  const auth = await adoReadAuthHeader(adoPat);

  const dash = await getDashboard(organization, project, team, auth);
  const teams = [dash];

  const healthyTeams = teams.filter((t) => t.healthStatus === "green").length;
  const atRiskTeams = teams.filter((t) => t.healthStatus === "amber").length;
  const criticalTeams = teams.filter((t) => t.healthStatus === "red").length;
  const avgHealthScore = Math.round(teams.reduce((s, t) => s + t.healthScore, 0) / teams.length);
  const orgHealthStatus = avgHealthScore >= 70 ? "green" : avgHealthScore >= 45 ? "amber" : "red";

  return {
    teams,
    summary: { totalTeams: teams.length, healthyTeams, atRiskTeams, criticalTeams, avgHealthScore, orgHealthStatus },
  };
}
