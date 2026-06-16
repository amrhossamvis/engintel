import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const EXCLUDED_NAMES = new Set([
  '.DS_Store', '.git', 'node_modules', '__MACOSX',
  'Pods', 'Carthage', 'DerivedData', 'build',
]);

const ADO_ORG = 'vfuk-digital';
const ADO_PROJECT = 'Digital';

async function discoverFromADO(
  repoName: string,
  pathInRepo: string,
  patToken: string
): Promise<{ success: boolean; modules: string[]; error?: string }> {
  const authHeader = `Basic ${Buffer.from(':' + patToken).toString('base64')}`;
  const url =
    `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/git/repositories/${encodeURIComponent(repoName)}/items` +
    `?scopePath=${encodeURIComponent(pathInRepo)}&recursionLevel=OneLevel&api-version=7.0`;

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      modules: [],
      error: `ADO API error ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = await res.json();
  const items: Array<{ gitObjectType: string; path: string }> = data.value ?? [];

  const modules = items
    .filter(
      (item) =>
        item.gitObjectType === 'tree' &&
        item.path !== pathInRepo &&
        !EXCLUDED_NAMES.has(item.path.split('/').pop() ?? '')
    )
    .map((item) => item.path.split('/').pop() ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return { success: true, modules };
}

export async function GET(request: NextRequest) {
  // Read credentials from headers (never from URL query params)
  const iosPath = request.headers.get('x-ios-path') || 'MVA-iOS/VFUK-iOS/Modules';
  const patToken = request.headers.get('x-ado-pat') || '';

  // Parse iosPath: first segment = repo name, full path (with leading /) = scopePath within repo
  const parts = iosPath.split('/');
  const repoName = parts[0]; // e.g. "MVA-iOS"
  const pathInRepo = '/' + iosPath; // e.g. "/MVA-iOS/VFUK-iOS/Modules" — ADO scopePath is absolute within repo

  // Try local filesystem first
  const localBase = path.resolve(process.cwd(), '..', iosPath);
  if (fs.existsSync(localBase)) {
    try {
      const entries = fs.readdirSync(localBase, { withFileTypes: true });
      const modules = entries
        .filter((d) => d.isDirectory() && !EXCLUDED_NAMES.has(d.name))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ success: true, modules, source: 'local', basePath: localBase });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, modules: [], error: `Local read failed: ${message}` },
        { status: 500 }
      );
    }
  }

  // Fall back to ADO Git API
  if (!patToken) {
    return NextResponse.json(
      {
        success: false,
        modules: [],
        error:
          `Local path not found (${localBase}) and no PAT token provided. ` +
          `Please configure your ADO PAT token and iOS Source Path in Settings.`,
      },
      { status: 200 }
    );
  }

  try {
    const result = await discoverFromADO(repoName, pathInRepo, patToken);
    return NextResponse.json({ ...result, source: 'ado' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, modules: [], error: `ADO fetch failed: ${message}` },
      { status: 500 }
    );
  }
}
