import type { CustomPersona } from "@/lib/playground-templates";

export type ChatMsg = { id: number; role: "user" | "assistant"; content: string };

export type Thread = {
  id: string;
  templateId: string;
  title: string;
  messages: ChatMsg[];
  contextDir: string;
  updatedAt: number;
};

export type SessionPointer = { threadId: string | null; personaId: string | null };

export type PlaygroundState = {
  personas: CustomPersona[];
  threads: Thread[];
  session: SessionPointer | null;
};

const THREADS_KEY = "pg:threads";
const PERSONAS_KEY = "pg:personas";
export const MAX_THREADS = 30;

// ── localStorage backend (anonymous users; behavior unchanged from before) ──

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked — just won't persist
  }
}

/** Prepend-or-replace a thread and cap the list, newest-first. Shared by both backends' local mirror. */
export function upsertThreadList(prev: Thread[], t: Thread): Thread[] {
  return [t, ...prev.filter((x) => x.id !== t.id)].slice(0, MAX_THREADS);
}

// ── DB backend (ADO-identified users) ──

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function put(url: string, body: unknown): void {
  void api(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function del(url: string): void {
  void api(url, { method: "DELETE" });
}

// Coalesce the burst of saveThread calls that the streaming transcript fires,
// one trailing write per thread id.
const threadTimers = new Map<string, ReturnType<typeof setTimeout>>();
const THREAD_DEBOUNCE_MS = 400;

// ── Public API ──

export async function loadState(userKey: string | null): Promise<PlaygroundState> {
  if (userKey) {
    const data = await api<PlaygroundState>(
      `/api/playground/state?user=${encodeURIComponent(userKey)}`,
    );
    return data ?? { personas: [], threads: [], session: null };
  }
  return {
    personas: readLocal<CustomPersona>(PERSONAS_KEY),
    threads: readLocal<Thread>(THREADS_KEY),
    session: null,
  };
}

export function saveThread(userKey: string | null, thread: Thread): void {
  const existing = threadTimers.get(thread.id);
  if (existing) clearTimeout(existing);
  threadTimers.set(
    thread.id,
    setTimeout(() => {
      threadTimers.delete(thread.id);
      if (userKey) {
        put("/api/playground/threads", { userKey, thread });
      } else {
        writeLocal(THREADS_KEY, upsertThreadList(readLocal<Thread>(THREADS_KEY), thread));
      }
    }, THREAD_DEBOUNCE_MS),
  );
}

export function deleteThread(userKey: string | null, id: string): void {
  const t = threadTimers.get(id);
  if (t) {
    clearTimeout(t);
    threadTimers.delete(id);
  }
  if (userKey) {
    del(`/api/playground/threads/${encodeURIComponent(id)}?user=${encodeURIComponent(userKey)}`);
  } else {
    writeLocal(THREADS_KEY, readLocal<Thread>(THREADS_KEY).filter((x) => x.id !== id));
  }
}

export function savePersona(userKey: string | null, persona: CustomPersona): void {
  if (userKey) {
    put("/api/playground/personas", { userKey, persona });
  } else {
    const prev = readLocal<CustomPersona>(PERSONAS_KEY);
    const next = prev.some((x) => x.id === persona.id)
      ? prev.map((x) => (x.id === persona.id ? persona : x))
      : [persona, ...prev];
    writeLocal(PERSONAS_KEY, next);
  }
}

export function deletePersona(userKey: string | null, id: string): void {
  if (userKey) {
    del(`/api/playground/personas/${encodeURIComponent(id)}?user=${encodeURIComponent(userKey)}`);
  } else {
    writeLocal(PERSONAS_KEY, readLocal<CustomPersona>(PERSONAS_KEY).filter((x) => x.id !== id));
  }
}

export function saveSession(userKey: string | null, s: SessionPointer): void {
  // Anonymous session restore is out of scope — localStorage users keep today's behavior.
  if (userKey) put("/api/playground/session", { userKey, ...s });
}
