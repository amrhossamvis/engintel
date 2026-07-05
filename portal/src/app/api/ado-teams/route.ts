import { NextRequest, NextResponse } from 'next/server';
import { ADOService } from '@/lib/ado-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organization = searchParams.get('organization') || 'vfuk-digital';
  const project = searchParams.get('project') || 'Digital';
  const patToken = req.headers.get('x-ado-pat');

  if (!patToken) {
    return NextResponse.json({ error: 'Missing PAT token' }, { status: 401 });
  }

  try {
    const ado = new ADOService(patToken);
    const teams = await ado.listAllTeams(organization, project);
    const teamNames = teams
      .map((t: any) => t.name as string)
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));

    return NextResponse.json({ teams: teamNames });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch teams' }, { status: 500 });
  }
}
