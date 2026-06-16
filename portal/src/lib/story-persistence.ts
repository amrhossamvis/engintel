import fs from 'fs';
import path from 'path';
import { StoryModuleRecord, StoryPersistenceStore } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PERSISTENCE_FILE = path.join(DATA_DIR, 'story-persistence.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): StoryPersistenceStore {
  ensureDataDir();
  if (!fs.existsSync(PERSISTENCE_FILE)) {
    const empty: StoryPersistenceStore = { modules: {} };
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
    return JSON.parse(raw) as StoryPersistenceStore;
  } catch {
    const empty: StoryPersistenceStore = { modules: {} };
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
}

function writeStore(store: StoryPersistenceStore): void {
  ensureDataDir();
  fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function getStoryModuleRecord(moduleName: string): StoryModuleRecord | null {
  const store = readStore();
  return store.modules[moduleName] ?? null;
}

export function saveStoryModuleRecord(
  moduleName: string,
  data: Omit<StoryModuleRecord, 'moduleName'>
): StoryModuleRecord {
  const store = readStore();
  const record: StoryModuleRecord = { moduleName, ...data };
  store.modules[moduleName] = record;
  writeStore(store);
  return record;
}

export function getAllStoryModuleRecords(): Record<string, StoryModuleRecord> {
  const store = readStore();
  return store.modules;
}

export function deleteStoryModuleRecord(moduleName: string): void {
  const store = readStore();
  delete store.modules[moduleName];
  writeStore(store);
}
