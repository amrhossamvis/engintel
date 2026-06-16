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
const MAX_CONTENT_CHARS = 400_000;

const ADO_ORG = 'vfuk-digital';
const ADO_PROJECT = 'Digital';

interface FileEntry {
  relativePath: string;
  absolutePath?: string; // only for local
  adoPath?: string;      // full ADO path for remote fetch
}

function collectCodeFiles(dir: string, baseDir: string): FileEntry[] {
  const results: FileEntry[] = [];
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
      results.push(...collectCodeFiles(fullPath, baseDir));
    } else if (entry.isFile() && CODE_EXTENSIONS.has(ext)) {
      results.push({
        relativePath: path.relative(baseDir, fullPath),
        absolutePath: fullPath,
      });
    }
  }
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function listAndFetchFromADO(
  repoName: string,
  moduleScopePath: string,
  patToken: string
): Promise<{ success: boolean; data?: { files: string[]; codeContent: string; totalFiles: number; totalChars: number }; error?: string }> {
  const authHeader = `Basic ${Buffer.from(':' + patToken).toString('base64')}`;

  // Step 1: list all files in the module
  const listUrl =
    `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/git/repositories/${encodeURIComponent(repoName)}/items` +
    `?scopePath=${encodeURIComponent(moduleScopePath)}&recursionLevel=Full&api-version=7.0`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  if (!listRes.ok) {
    const text = await listRes.text();
    return { success: false, error: `ADO list error ${listRes.status}: ${text.slice(0, 300)}` };
  }

  const listData = await listRes.json();
  const items: Array<{ gitObjectType: string; path: string }> = listData.value ?? [];

  const modulePrefix = moduleScopePath.endsWith('/') ? moduleScopePath : moduleScopePath + '/';

  const fileEntries: FileEntry[] = items
    .filter((item) => {
      if (item.gitObjectType !== 'blob') return false;
      const fileName = item.path.split('/').pop() ?? '';
      if (fileName.startsWith('.')) return false;
      const ext = path.extname(fileName).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      if (!CODE_EXTENSIONS.has(ext)) return false;
      const segments = item.path.split('/');
      return !segments.some((seg) => SKIP_DIRS.has(seg));
    })
    .map((item) => ({
      relativePath: item.path.startsWith(modulePrefix)
        ? item.path.slice(modulePrefix.length)
        : item.path,
      adoPath: item.path,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  if (fileEntries.length === 0) {
    return { success: false, error: 'No Swift or Objective-C source files found in module.' };
  }

  // Step 2: fetch file contents
  const chunks: string[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const entry of fileEntries) {
    if (totalChars >= MAX_CONTENT_CHARS) { truncated = true; break; }

    const fileUrl =
      `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/git/repositories/${encodeURIComponent(repoName)}/items` +
      `?path=${encodeURIComponent(entry.adoPath!)}&api-version=7.0`;

    try {
      const fileRes = await fetch(fileUrl, {
        headers: { Authorization: authHeader, Accept: 'text/plain' },
      });
      if (!fileRes.ok) continue;
      const content = await fileRes.text();
      const fileBlock = `\n\n// ===== FILE: ${entry.relativePath} =====\n${content}`;
      if (totalChars + fileBlock.length > MAX_CONTENT_CHARS) {
        const remaining = MAX_CONTENT_CHARS - totalChars;
        chunks.push(fileBlock.slice(0, remaining));
        totalChars = MAX_CONTENT_CHARS;
        truncated = true;
        break;
      }
      chunks.push(fileBlock);
      totalChars += fileBlock.length;
    } catch {
      // skip unreadable files
    }
  }

  const truncationNote = truncated
    ? `\n\n// [NOTE: Content truncated at ${MAX_CONTENT_CHARS.toLocaleString()} characters to fit context window]`
    : '';

  return {
    success: true,
    data: {
      files: fileEntries.map((f) => f.relativePath),
      codeContent: chunks.join('').trim() + truncationNote,
      totalFiles: fileEntries.length,
      totalChars,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { moduleName, iosPath } = await request.json();

    if (!moduleName) {
      return NextResponse.json({ success: false, error: 'Missing moduleName' }, { status: 400 });
    }

    const resolvedIosPath = iosPath || 'MVA-iOS/VFUK-iOS/Modules';
    // Read PAT from header (consistent with discover and files routes)
    const resolvedPatToken = request.headers.get('x-ado-pat') || '';

    // Parse iosPath: first segment = repo name, full path = scopePath within repo
    const parts = resolvedIosPath.split('/');
    const repoName = parts[0];
    const pathInRepo = '/' + resolvedIosPath; // e.g. "/MVA-iOS/VFUK-iOS/Modules"
    const moduleScopePath = `${pathInRepo}/${moduleName}`; // e.g. "/MVA-iOS/VFUK-iOS/Modules/Auth"

    // Try local filesystem first
    const localBase = path.resolve(process.cwd(), '..', resolvedIosPath);
    const localModulePath = path.join(localBase, moduleName);

    if (fs.existsSync(localModulePath)) {
      const fileEntries = collectCodeFiles(localModulePath, localModulePath);
      if (fileEntries.length === 0) {
        return NextResponse.json(
          { success: false, error: `No Swift or Objective-C source files found in module: ${moduleName}` },
          { status: 200 }
        );
      }

      const chunks: string[] = [];
      let totalChars = 0;
      let truncated = false;

      for (const entry of fileEntries) {
        if (totalChars >= MAX_CONTENT_CHARS) { truncated = true; break; }
        try {
          const content = fs.readFileSync(entry.absolutePath!, 'utf-8');
          const fileBlock = `\n\n// ===== FILE: ${entry.relativePath} =====\n${content}`;
          if (totalChars + fileBlock.length > MAX_CONTENT_CHARS) {
            const remaining = MAX_CONTENT_CHARS - totalChars;
            chunks.push(fileBlock.slice(0, remaining));
            totalChars = MAX_CONTENT_CHARS;
            truncated = true;
            break;
          }
          chunks.push(fileBlock);
          totalChars += fileBlock.length;
        } catch { /* skip unreadable files */ }
      }

      const truncationNote = truncated
        ? `\n\n// [NOTE: Content truncated at ${MAX_CONTENT_CHARS.toLocaleString()} characters to fit context window]`
        : '';

      return NextResponse.json({
        success: true,
        source: 'local',
        data: {
          files: fileEntries.map((f) => f.relativePath),
          codeContent: chunks.join('').trim() + truncationNote,
          totalFiles: fileEntries.length,
          totalChars,
        },
      });
    }

    // Fall back to ADO Git API
    if (!resolvedPatToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Local module path not found and no PAT token provided. ` +
            `Please configure your ADO PAT token in Settings.`,
        },
        { status: 200 }
      );
    }

    const result = await listAndFetchFromADO(repoName, moduleScopePath, resolvedPatToken);
    return NextResponse.json({ ...result, source: 'ado' });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Failed to parse module code: ${message}` },
      { status: 500 }
    );
  }
}
