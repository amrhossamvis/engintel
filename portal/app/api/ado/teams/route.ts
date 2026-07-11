import { NextResponse } from "next/server";
import { loadTeamMap } from "@/lib/team-map";

/**
 * Squad directory for the Backlog Breakdown team selector — reads
 * docs/triage/team-map.yaml (same source Bug Triage routes against).
 * No ADO auth needed: this is static local data, not an Azure DevOps call.
 */
export async function GET() {
  try {
    const { teams } = await loadTeamMap();
    const names = [...new Set(teams.map((t) => (t.name ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ teams: names });
  } catch {
    return NextResponse.json({ teams: [] });
  }
}
