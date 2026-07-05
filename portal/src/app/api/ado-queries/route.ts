import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Known folder ID for the MVA Releases folder — discovered via path-walk and hardcoded
// to eliminate the multi-step tree traversal on every request.
// If this ever changes, delete this constant and the fallback path-walk will rediscover it.
const KNOWN_RELEASES_FOLDER_ID = '8b25a552-4a4c-42f6-8ce6-1d0f7afd10b8';

// Server-side in-process cache for the Releases folder ID.
// Used as a fallback if the known ID ever stops working.
// Key: `${organization}/${project}/${folderPath}`
const folderIdCache = new Map<string, string>([
  [`vfuk-digital/Digital/Shared Queries/My Vodafone/MVA/MVA Queries/Releases`, KNOWN_RELEASES_FOLDER_ID],
]);

// ADO only allows $depth 0–2. The target path is 5 levels deep, so we
// walk the tree in multiple passes (each capped at depth=2).
async function findFolderByPath(
  authHeader: string,
  organization: string,
  project: string,
  targetSegments: string[]
): Promise<string | null> {
  const rootUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/queries?$depth=2&$expand=minimal&api-version=7.0`;
  const rootResponse = await axios.get(rootUrl, {
    headers: { Authorization: authHeader },
  });

  let currentNode: any = rootResponse.data;
  let segmentIndex = 0;

  while (segmentIndex < targetSegments.length) {
    const segment = targetSegments[segmentIndex].toLowerCase();
    const children: any[] = currentNode.children || currentNode.value || [];
    const match = children.find(
      (c: any) => (c.name || '').toLowerCase() === segment && c.isFolder !== false
    );

    if (!match) return null;
    segmentIndex++;

    if (segmentIndex < targetSegments.length) {
      const folderUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/queries/${match.id}?$depth=2&$expand=minimal&api-version=7.0`;
      const folderResponse = await axios.get(folderUrl, {
        headers: { Authorization: authHeader },
      });
      currentNode = folderResponse.data;
    } else {
      return match.id;
    }
  }

  return null;
}

// GET — list release folders only (fast, depth=1)
// POST — fetch sub-queries for a specific release folder
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patToken = request.headers.get('x-ado-pat') || '';
    const folderPath = searchParams.get('folderPath') || 'Shared Queries/My Vodafone/MVA/MVA Queries/Releases';

    if (!patToken) {
      return NextResponse.json({ error: 'PAT token is required (x-ado-pat header)' }, { status: 400 });
    }

    const authHeader = `Basic ${Buffer.from(`:${patToken}`).toString('base64')}`;
    const organization = 'vfuk-digital';
    const project = 'Digital';

    // Use cached/known folder ID — skips the expensive path-walk entirely
    const cacheKey = `${organization}/${project}/${folderPath}`;
    let folderId = folderIdCache.get(cacheKey) ?? null;

    if (!folderId) {
      // Fallback: walk the tree and cache the result for future calls
      const segments = folderPath.split('/').map((s) => s.trim()).filter(Boolean);
      folderId = await findFolderByPath(authHeader, organization, project, segments);
      if (!folderId) {
        return NextResponse.json({ error: `Could not find folder: ${folderPath}` }, { status: 404 });
      }
      folderIdCache.set(cacheKey, folderId);
    }

    // depth=1 — only direct children (the release sub-folders), no grandchildren
    const folderUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/queries/${folderId}?$depth=1&$expand=minimal&api-version=7.0`;
    const folderResponse = await axios.get(folderUrl, { headers: { Authorization: authHeader } });

    const children: any[] = folderResponse.data.children || [];

    const releases = children
      .filter((c: any) => c.isFolder === true && c.name?.toUpperCase().startsWith('MVA'))
      .map((c: any) => ({ id: c.id, name: c.name, path: c.path || '' }))
      .sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
      );

    return NextResponse.json({ releases });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Failed to fetch releases';
    return NextResponse.json({ error: message }, { status });
  }
}

// POST body: { patToken, releaseId }  — fetch queries inside a specific release folder
export async function POST(request: NextRequest) {
  try {
    const { patToken, releaseId } = await request.json();

    if (!patToken) {
      return NextResponse.json({ error: 'PAT token is required' }, { status: 400 });
    }
    if (!releaseId) {
      return NextResponse.json({ error: 'releaseId is required' }, { status: 400 });
    }

    const authHeader = `Basic ${Buffer.from(`:${patToken}`).toString('base64')}`;
    const organization = 'vfuk-digital';
    const project = 'Digital';

    // depth=1 — only the direct query children of this release folder
    const folderUrl = `https://dev.azure.com/${organization}/${project}/_apis/wit/queries/${releaseId}?$depth=1&$expand=minimal&api-version=7.0`;
    const folderResponse = await axios.get(folderUrl, { headers: { Authorization: authHeader } });

    const children: any[] = folderResponse.data.children || [];

    const queries = children
      .filter((c: any) => c.isFolder !== true)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        queryUrl: `https://dev.azure.com/${organization}/${project}/_queries/query-edit/${c.id}/`,
      }));

    return NextResponse.json({ queries });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || 'Failed to fetch queries';
    return NextResponse.json({ error: message }, { status });
  }
}
