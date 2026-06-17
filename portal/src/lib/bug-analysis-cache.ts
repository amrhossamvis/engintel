/**
 * Bug Analysis Persistence Cache
 *
 * Stores analysis results per query (keyed by queryId) in a JSON file on disk.
 * Each entry is keyed by bug ID so we can look up, update, or skip individual bugs.
 *
 * File location: portal/data/bug-analysis-cache/<queryId>.json
 *
 * The portal/data/ directory is excluded from git (.gitignore) so cache files
 * survive deployments without being committed to the repository.
 */

import fs from 'fs';
import path from 'path';
import { BugAnalysisResult } from '@/types';

// Store inside portal/data/ — same location as story-persistence, excluded from git
const CACHE_DIR = path.join(process.cwd(), 'data', 'bug-analysis-cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(queryId: string): string {
  // Sanitise the queryId so it's safe as a filename
  const safe = queryId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

/** Load the full cache for a query. Returns a map of bugId → result. */
export function loadCache(queryId: string): Map<number, BugAnalysisResult> {
  ensureCacheDir();
  const filePath = cacheFilePath(queryId);
  if (!fs.existsSync(filePath)) return new Map();

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const obj: Record<string, BugAnalysisResult> = JSON.parse(raw);
    const map = new Map<number, BugAnalysisResult>();
    for (const [key, value] of Object.entries(obj)) {
      map.set(Number(key), value);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Persist the full cache for a query (merges with existing entries). */
export function saveCache(queryId: string, results: BugAnalysisResult[]): void {
  ensureCacheDir();
  const filePath = cacheFilePath(queryId);

  // Load existing data so we don't lose entries not in this batch
  const existing = loadCache(queryId);
  for (const result of results) {
    existing.set(result.id, result);
  }

  const obj: Record<string, BugAnalysisResult> = {};
  Array.from(existing.entries()).forEach(([id, result]) => {
    obj[String(id)] = result;
  });

  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
}

/** Persist a single bug result (upsert). */
export function saveSingleResult(queryId: string, result: BugAnalysisResult): void {
  saveCache(queryId, [result]);
}

/** Delete a single bug from the cache (forces re-analysis next run). */
export function evictFromCache(queryId: string, bugId: number): void {
  ensureCacheDir();
  const filePath = cacheFilePath(queryId);
  if (!fs.existsSync(filePath)) return;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const obj: Record<string, BugAnalysisResult> = JSON.parse(raw);
    delete obj[String(bugId)];
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // Ignore
  }
}

/** List all queryIds that have a cache file. */
export function listCachedQueryIds(): string[] {
  ensureCacheDir();
  return fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}
