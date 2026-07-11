/**
 * Server-only loader for docs/triage/team-map.yaml — the org's squad
 * directory (name, area, contacts, owned services). Originally local to
 * Bug Triage; extracted so Backlog Breakdown can also use it, for its team
 * selector and area-path auto-match.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { docsRoot } from "@/lib/local/breakdown-shared";

export type TeamMapTeam = {
  name?: string;
  area?: string;
  section?: string;
  teams_channel?: string;
  eng_manager?: string;
  lead_dev?: string;
  po?: string;
  services?: string[];
};
export type TilRoute = { team?: string; use_when?: string; area_path?: string; distribution_list?: string; source_section?: string };
export type TeamMap = { teams: TeamMapTeam[]; tilRouting: TilRoute[] };

export async function loadTeamMap(): Promise<TeamMap> {
  const filePath = path.join(docsRoot(), "triage", "team-map.yaml");
  const content = await fs.readFile(filePath, "utf-8");
  const doc = (loadYaml(content) ?? {}) as Record<string, unknown>;
  return {
    teams: (doc.teams as TeamMapTeam[]) ?? [],
    tilRouting: (doc.til_routing as TilRoute[]) ?? [],
  };
}
