/**
 * Lightweight JSON file persistence for Ideas and Feedback.
 * Stores data in portal/data/ directory (gitignored, same as story-persistence).
 * The deploy script preserves this directory across git reset --hard.
 * Uses synchronous fs for simplicity in Next.js API routes.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readDB<T>(name: string, defaultValue: T): T {
  ensureDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T;
  } catch {
    return defaultValue;
  }
}

export function writeDB<T>(name: string, data: T): void {
  ensureDir();
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}
