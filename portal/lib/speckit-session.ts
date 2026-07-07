/**
 * Server-side session management for the Spec Kit wizard.
 *
 * Each wizard session gets a temp directory where artifacts (constitution.md,
 * spec.md, plan.md, tasks.md) are persisted between steps. Sessions are
 * cleaned up after a TTL or on explicit delete.
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SESSION_PREFIX = "speckit-session-";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Get or create a session directory. Returns the absolute path. */
export async function getSessionDir(sessionId: string): Promise<string> {
  // Sanitize session ID to prevent path traversal
  const safe = sessionId.replace(/[^a-zA-Z0-9\-_]/g, "");
  if (!safe || safe.length < 8) throw new Error("invalid_session_id");

  const dir = join(tmpdir(), `${SESSION_PREFIX}${safe}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Write an artifact file to the session directory. */
export async function writeArtifact(
  sessionId: string,
  filename: string,
  content: string,
): Promise<void> {
  const dir = await getSessionDir(sessionId);
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
  await writeFile(join(dir, safeName), content, "utf-8");
}

/** Read an artifact file from the session directory. Returns empty string if not found. */
export async function readArtifact(
  sessionId: string,
  filename: string,
): Promise<string> {
  try {
    const dir = await getSessionDir(sessionId);
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
    return await readFile(join(dir, safeName), "utf-8");
  } catch {
    return "";
  }
}

/** Read all artifacts from a session. Returns a map of filename → content. */
export async function readAllArtifacts(
  sessionId: string,
): Promise<Record<string, string>> {
  const dir = await getSessionDir(sessionId);
  const artifacts: Record<string, string> = {};
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.endsWith(".md")) {
        artifacts[file] = await readFile(join(dir, file), "utf-8");
      }
    }
  } catch {
    // empty session
  }
  return artifacts;
}

/** Delete a session directory. */
export async function deleteSession(sessionId: string): Promise<void> {
  const safe = sessionId.replace(/[^a-zA-Z0-9\-_]/g, "");
  if (!safe || safe.length < 8) return;
  const dir = join(tmpdir(), `${SESSION_PREFIX}${safe}`);
  await rm(dir, { recursive: true, force: true });
}

/** Clean up expired sessions (run periodically or on startup). */
export async function cleanExpiredSessions(): Promise<void> {
  const tmp = tmpdir();
  try {
    const entries = await readdir(tmp);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.startsWith(SESSION_PREFIX)) continue;
      const fullPath = join(tmp, entry);
      try {
        const s = await stat(fullPath);
        if (now - s.mtimeMs > SESSION_TTL_MS) {
          await rm(fullPath, { recursive: true, force: true });
        }
      } catch {
        // skip
      }
    }
  } catch {
    // can't read tmpdir — skip
  }
}

