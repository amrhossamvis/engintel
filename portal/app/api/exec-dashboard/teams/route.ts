import { NextRequest, NextResponse } from "next/server";
import { adoReadAuthHeader, adoReadable, basicFromPat } from "@/lib/ado";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const org = (searchParams.get("organization") ?? process.env.ADO_ORG ?? "vfuk-digital").trim();
  const project = (searchParams.get("project") ?? process.env.ADO_PROJECT ?? "Digital").trim();
  const headerPat = request.headers.get("x-ado-pat")?.trim() || "";

  // Allow both auth modes used across this portal:
  // - per-user PAT (legacy hub behavior)
  // - host az login / service PAT fallback (new portal behavior)
  if (!(await adoReadable(headerPat || undefined))) {
    return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
  }

  try {
    const auth = headerPat ? basicFromPat(headerPat) : await adoReadAuthHeader();
    const allTeams: string[] = [];
    const top = 100;
    let skip = 0;

    while (true) {
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects/${encodeURIComponent(project)}/teams?$top=${top}&$skip=${skip}&api-version=7.0`;
      const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json({ error: `ado_${res.status}` }, { status: 502 });
      }

      const payload = (await res.json()) as { value?: Array<{ name?: string }> };
      const page = (payload.value ?? [])
        .map((t) => String(t.name ?? "").trim())
        .filter(Boolean);
      allTeams.push(...page);

      if (page.length < top) break;
      skip += top;
    }

    const teams = [...new Set(allTeams)].sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
