# Playground DB Persistence — Design

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Scope:** Persist AI Playground custom personas + chat threads to Postgres, keyed per ADO user, and restore the open session across route changes.

## Problem

`components/Playground.tsx` keeps three kinds of state:

- **Custom personas** → `localStorage["pg:personas"]`
- **Chat threads** (history) → `localStorage["pg:threads"]` (capped 30)
- **Active session** (selected persona, open thread, in-flight messages) → React component state

Because the active session is component-local, navigating away from `/playground` and back unmounts the component and drops the open chat — the sidebar list rehydrates from localStorage, but nothing is auto-opened. localStorage is also per-browser, so history does not follow a user across devices.

## Goals

1. Custom personas persisted to DB.
2. Chat history (threads) persisted to DB.
3. Per-user, keyed on ADO identity.
4. Survive route changes (no lost state).
5. Restore the current open session (thread + persona + history) on return.

## Non-goals

- No new auth system. Reuse existing ADO identity.
- No migration of pre-existing localStorage data for signed-in users (start fresh in DB).
- No persistence of unsent draft text or in-flight/streaming runs.
- No per-message row modeling or full-text search over messages.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Identity key | `userKey = adoPatIdentity ?? adoIdentity` (from `useApp()`). Neither present → **no server save**; keep current localStorage/in-memory behavior unchanged. |
| Session restore scope | Open thread + selected persona + full message history. **Not** unsent draft, **not** in-flight run. |
| Existing localStorage data | Ignored for signed-in users. DB starts empty and is source of truth. |
| Message storage | One `jsonb` blob per thread (mirrors current `ChatMsg[]` shape). |
| Sync model | DB is source of truth when `userKey` present; write-through on change. Anonymous users unchanged (localStorage). |

## Identity

`useApp()` exposes two real ADO identities:

- `adoPatIdentity: string | null` — per-user bring-your-own PAT (correct for a shared/Docker hub, one identity per user's browser).
- `adoIdentity: string | null` — host `az login` identity (Option B, local single-host).

`userKey = adoPatIdentity ?? adoIdentity`. Either present → real identity → persist. `null` → no PAT/auth → skip all server calls, fall back to existing localStorage path.

## Data model

Appended to the inlined `SCHEMA_SQL` in `lib/db.ts` (same idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` convention as existing tables). Also add to `db/schema.sql` for parity.

```sql
CREATE TABLE IF NOT EXISTS pg_personas (
  id          text PRIMARY KEY,              -- client-minted "custom-<uuid>"
  user_key    text NOT NULL,
  name        text NOT NULL,
  category    text NOT NULL,
  icon        text NOT NULL,
  description text NOT NULL,
  persona     text NOT NULL,
  variables   jsonb NOT NULL DEFAULT '[]',   -- PgVariable[]
  prompt      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pg_personas_user ON pg_personas(user_key, created_at DESC);

CREATE TABLE IF NOT EXISTS pg_threads (
  id          text PRIMARY KEY,              -- client-minted thread id
  user_key    text NOT NULL,
  template_id text NOT NULL,
  title       text NOT NULL,
  context_dir text NOT NULL DEFAULT '',
  messages    jsonb NOT NULL DEFAULT '[]',   -- ChatMsg[]
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pg_threads_user ON pg_threads(user_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS pg_session (
  user_key   text PRIMARY KEY,
  thread_id  text,
  persona_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Notes:
- `id` is client-minted (existing personas use `custom-<uuid>`, threads mint an id in `send()`), so upsert is `ON CONFLICT (id) DO UPDATE`.
- `pg_personas` / `pg_threads` rows are owned by `user_key`; every mutating query filters on it so one user cannot touch another's rows.
- 30-thread cap enforced server-side on thread upsert: after upsert, delete this user's threads beyond the 30 most recent by `updated_at`.

## API routes

Follow the `app/api/ideas` pattern: `dbConfigured()` guard returns empty, `ensureSchema()` before queries, parameterized SQL, `NextResponse.json`.

| Route | Method | Purpose |
|---|---|---|
| `/api/playground/state` | GET `?user=<key>` | One round-trip on mount → `{ personas, threads, session }` |
| `/api/playground/personas` | PUT | Upsert one persona (body carries `userKey` + persona) |
| `/api/playground/personas/[id]` | DELETE `?user=<key>` | Delete one persona (scoped to user) |
| `/api/playground/threads` | PUT | Upsert one thread; trims user to 30 newest |
| `/api/playground/threads/[id]` | DELETE `?user=<key>` | Delete one thread |
| `/api/playground/session` | PUT | Upsert `{ threadId, personaId }` for user |

Rules:
- Missing/blank `user` → 200 no-op (client should not call, but the route is defensive at this boundary).
- `dbConfigured()` false → GET returns `{ personas: [], threads: [], session: null }`; mutations 200 no-op.
- Server trusts `userKey` as the identity (same trust model as existing `author_key` / `voter_key` — no server-side ADO re-validation on these routes, consistent with `ideas`/`skills`).

## Client — `lib/playground-store.ts`

New module isolating persistence so `Playground.tsx` (1571 lines) gets a minimal, testable diff. Backend chosen by whether `userKey` is present.

Surface (shapes reuse existing `CustomPersona`, `Thread`, `ChatMsg`):

```ts
type PlaygroundState = {
  personas: CustomPersona[];
  threads: Thread[];
  session: { threadId: string | null; personaId: string | null } | null;
};

loadState(userKey: string | null): Promise<PlaygroundState>
saveThread(userKey: string | null, thread: Thread): void      // debounced ~500ms per thread id
deleteThread(userKey: string | null, id: string): void
savePersona(userKey: string | null, persona: CustomPersona): void
deletePersona(userKey: string | null, id: string): void
saveSession(userKey: string | null, s: { threadId, personaId }): void
```

Backend behavior:
- `userKey` present → DB via `fetch` to the routes above.
- `userKey` null → localStorage, byte-for-byte the current behavior (`pg:threads`, `pg:personas`; no session key — anonymous restore is out of scope and unchanged).

`saveThread` is debounced because the existing "mirror messages into thread" effect fires on every streamed token; without debounce each token would POST.

## Playground.tsx wiring

- Read `userKey` from `useApp()` (`adoPatIdentity ?? adoIdentity`).
- Replace the two localStorage hydrate effects with a single mount effect: `loadState(userKey)` → `setThreads`, `setCustomPersonas`, then apply `session` → `openThread(session.threadId)` and select `session.personaId`.
- Replace the two localStorage write effects: thread-mirror effect → `store.saveThread`; personas write effect → `store.savePersona` on save / `store.deletePersona` on delete (mutation-driven, not a bulk write effect).
- `openThread`, `selectTemplate`, `newChat` → also call `store.saveSession`.
- `deleteThread` → `store.deleteThread`.
- Guard: only apply session restore once per mount (a `restored` ref) so re-renders don't reopen.

## Edge cases

- **DB not configured / down** → routes return empty or no-op; client behaves as anonymous (localStorage). Non-breaking.
- **`userKey` becomes non-null mid-session** (user connects PAT after landing) → re-run `loadState`; DB empty → blank slate (matches "start fresh"). Local unsaved chat is dropped (acceptable; documented).
- **Concurrent tabs, same user** → last-write-wins per thread id. Acceptable for single-user.
- **Persona referenced by a thread but deleted** → existing `openThread` already falls back to the default template when `templateId` is not found; unchanged.

## Testing

- `lib/playground-store.test.ts` (vitest, matches existing `*.test.ts`): backend selection by `userKey`; localStorage fallback shape; debounce coalescing; 30-thread trim helper.
- API: smoke over the `dbConfigured()` guard path (returns empty when unconfigured), mirroring existing smoke tests.
- Manual acceptance: connect PAT → create persona → chat a few turns → navigate to `/ideas` → back to `/playground` → same thread open, same persona, full history; disconnect PAT → anonymous localStorage still works.

## Acceptance criteria

1. With an ADO identity: personas and threads persist to Postgres and reload after a full browser restart on the same identity.
2. Navigating away from `/playground` and back restores the open thread, its persona, and message history.
3. Without an ADO identity: behavior is identical to today (localStorage), no server calls made.
4. DB unconfigured: no errors, anonymous-equivalent behavior.
5. A user's queries only ever read/write rows with their own `user_key`.
6. Typecheck + lint clean; new tests pass.

## Files

**New**
- `lib/playground-store.ts`
- `lib/playground-store.test.ts`
- `app/api/playground/state/route.ts`
- `app/api/playground/personas/route.ts`
- `app/api/playground/personas/[id]/route.ts`
- `app/api/playground/threads/route.ts`
- `app/api/playground/threads/[id]/route.ts`
- `app/api/playground/session/route.ts`

**Modified**
- `lib/db.ts` (append 3 tables to `SCHEMA_SQL`)
- `db/schema.sql` (parity)
- `components/Playground.tsx` (wire store + session restore)
