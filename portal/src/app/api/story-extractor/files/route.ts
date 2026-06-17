import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set([
  'Tests', 'Test', 'Specs', 'Mocks', 'Stubs',
  '__Snapshots__', 'Snapshots', 'Assets.xcassets',
  'DerivedData', 'build', '.build', 'Pods', 'Carthage',
]);

const SKIP_EXTENSIONS = new Set([
  '.xcassets', '.xcodeproj', '.xcworkspace', '.plist', '.json',
  '.png', '.jpg', '.jpeg', '.pdf', '.strings', '.stringsdict',
  '.storyboard', '.xib', '.nib', '.lproj', '.md', '.txt', '.sh',
]);

const CODE_EXTENSIONS = new Set(['.swift', '.m', '.h']);

const ADO_ORG = 'vfuk-digital';
const ADO_PROJECT = 'Digital';

function collectSwiftFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectSwiftFiles(fullPath, baseDir));
    } else if (entry.isFile() && CODE_EXTENSIONS.has(ext)) {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results.sort();
}

async function listFilesFromADO(
  repoName: string,
  moduleScopePath: string,
  patToken: string
): Promise<{ success: boolean; files: string[]; error?: string }> {
  const authHeader = `Basic ${Buffer.from(':' + patToken).toString('base64')}`;
  const url =
    `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/git/repositories/${encodeURIComponent(repoName)}/items` +
    `?scopePath=${encodeURIComponent(moduleScopePath)}&recursionLevel=Full&api-version=7.0`;

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      files: [],
      error: `ADO API error ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = await res.json();
  const items: Array<{ gitObjectType: string; path: string }> = data.value ?? [];

  // Filter to code files only, return relative paths within the module
  const files = items
    .filter((item) => {
      if (item.gitObjectType !== 'blob') return false;
      const fileName = item.path.split('/').pop() ?? '';
      if (fileName.startsWith('.')) return false;
      const ext = path.extname(fileName).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      if (!CODE_EXTENSIONS.has(ext)) return false;
      // Skip test/mock directories
      const segments = item.path.split('/');
      return !segments.some((seg) => SKIP_DIRS.has(seg));
    })
    .map((item) => {
      // Make path relative to the module root
      const modulePrefix = moduleScopePath.endsWith('/')
        ? moduleScopePath
        : moduleScopePath + '/';
      return item.path.startsWith(modulePrefix)
        ? item.path.slice(modulePrefix.length)
        : item.path;
    })
    .sort();

  return { success: true, files };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moduleName = searchParams.get('module');
  // Read credentials from headers (never from URL query params)
  const iosPath = request.headers.get('x-ios-path') || 'MVA-iOS/VFUK-iOS/Modules';
  const patToken = request.headers.get('x-ado-pat') || '';

  if (!moduleName) {
    return NextResponse.json(
      { success: false, files: [], error: 'Missing module parameter' },
      { status: 400 }
    );
  }

  // Parse iosPath: first segment = repo name, full path = scopePath within repo
  const parts = iosPath.split('/');
  const repoName = parts[0];
  const pathInRepo = '/' + iosPath; // e.g. "/MVA-iOS/VFUK-iOS/Modules"
  const moduleScopePath = `${pathInRepo}/${moduleName}`; // e.g. "/MVA-iOS/VFUK-iOS/Modules/Auth"

  // Try local filesystem first
  const localBase = path.resolve(process.cwd(), '..', iosPath);
  const localModulePath = path.join(localBase, moduleName);
  if (fs.existsSync(localModulePath)) {
    try {
      const files = collectSwiftFiles(localModulePath, localModulePath);
      return NextResponse.json({ success: true, files, source: 'local' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, files: [], error: `Local read failed: ${message}` },
        { status: 500 }
      );
    }
  }

  // Fall back to ADO Git API
  if (!patToken) {
    return NextResponse.json(
      {
        success: false,
        files: [],
        error:
          `Module not found on this server and no ADO PAT token provided. ` +
          `Please configure your ADO PAT token and iOS Source Path in Settings.`,
      },
      { status: 200 }
    );
  }

  try {
    const result = await listFilesFromADO(repoName, moduleScopePath, patToken);
    return NextResponse.json({ ...result, source: 'ado' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, files: [], error: `ADO fetch failed: ${message}` },
      { status: 500 }
    );
  }
}
