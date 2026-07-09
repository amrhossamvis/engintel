import { createHash } from "node:crypto";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _schemaReady: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var _schemaReadyHash: string | undefined;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!globalThis._pgPool) {
    globalThis._pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalThis._pgPool;
}

// Mirrors db/schema.sql. Inlined (not read from disk) so the bundler needs no
// runtime file trace — safe in local dev and in a built/Vercel deploy.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ideas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body          text NOT NULL,
  domain        text NOT NULL,
  status        text NOT NULL DEFAULT 'new',
  impact        text,
  author_key    text,
  author_name   text,
  is_anonymous  boolean NOT NULL DEFAULT false,
  pinned        boolean NOT NULL DEFAULT false,
  ado_work_item_id integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS proposed_solution text;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS votes (
  idea_id    uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  voter_key  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, voter_key)
);

CREATE TABLE IF NOT EXISTS comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id      uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  author_key   text,
  author_name  text,
  is_anonymous boolean NOT NULL DEFAULT false,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_votes_idea ON votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_comments_idea ON comments(idea_id);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id text,
  type          text NOT NULL,
  rating        smallint,
  message       text NOT NULL,
  status        text NOT NULL DEFAULT 'new',
  contact_ok    boolean NOT NULL DEFAULT false,
  author_key    text,
  author_name   text,
  is_anonymous  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_cap ON feedback(capability_id);

CREATE TABLE IF NOT EXISTS skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  description   text NOT NULL,
  guild         text,
  install_cmd   text NOT NULL,
  repo_url      text,
  readme        text,
  author_key    text,
  author_name   text,
  install_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skills_created ON skills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_installs ON skills(install_count DESC);

ALTER TABLE skills ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS stars integer;

CREATE TABLE IF NOT EXISTS skill_installs (
  skill_id   uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_installs ON skill_installs(skill_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pg_personas (
  id          text PRIMARY KEY,
  user_key    text NOT NULL,
  name        text NOT NULL,
  category    text NOT NULL,
  icon        text NOT NULL,
  description text NOT NULL,
  persona     text NOT NULL,
  variables   jsonb NOT NULL DEFAULT '[]',
  prompt      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pg_personas_user ON pg_personas(user_key, created_at DESC);

CREATE TABLE IF NOT EXISTS pg_threads (
  id          text PRIMARY KEY,
  user_key    text NOT NULL,
  template_id text NOT NULL,
  title       text NOT NULL,
  context_dir text NOT NULL DEFAULT '',
  messages    jsonb NOT NULL DEFAULT '[]',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pg_threads_user ON pg_threads(user_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS pg_session (
  user_key   text PRIMARY KEY,
  thread_id  text,
  persona_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pg_template_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   text NOT NULL,
  user_key      text NOT NULL,
  thread_id     text,
  turns         integer NOT NULL DEFAULT 1,
  rating        smallint,
  feedback_text text,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pg_analytics_template ON pg_template_analytics(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_analytics_user ON pg_template_analytics(user_key, created_at DESC);

-- One row per completed roadmap node, per user. Absence of a row = not done.
CREATE TABLE IF NOT EXISTS roadmap_progress (
  user_key   text NOT NULL,
  node_id    text NOT NULL,
  track_id   text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_key, node_id)
);
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_user ON roadmap_progress(user_key);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;

// One-shot data backfills. Unlike SCHEMA_SQL these are NOT idempotent in intent:
// re-running them would rewrite values a user legitimately set later, so each is
// recorded in schema_migrations and skipped forever after it first succeeds.
// Never edit an id or its SQL — add a new entry instead.
const DATA_MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  { id: "001_ideas_domain_web_guild", sql: `UPDATE ideas SET domain = 'Web Guild' WHERE domain = 'Web'` },
  { id: "002_ideas_domain_backend_guild", sql: `UPDATE ideas SET domain = 'Backend Guild' WHERE domain = 'Backend'` },
  { id: "003_ideas_status_in_progress", sql: `UPDATE ideas SET status = 'in_progress' WHERE status = 'in_pipeline'` },
];

/**
 * Apply each pending backfill exactly once. The INSERT lands in the same
 * transaction as the UPDATE, so a crash mid-migration rolls both back and the
 * next boot retries cleanly. ON CONFLICT DO NOTHING + rowCount makes a
 * concurrent second instance skip the UPDATE rather than double-apply it.
 */
async function runDataMigrations(pool: Pool): Promise<void> {
  for (const { id, sql } of DATA_MIGRATIONS) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount } = await client.query(
        `INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [id],
      );
      if (rowCount) await client.query(sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

const SCHEMA_HASH = createHash("sha1")
  .update(SCHEMA_SQL)
  .update(DATA_MIGRATIONS.map((m) => m.id).join(","))
  .digest("hex");

/**
 * Create tables and apply data backfills on first use. Cached per process so it
 * runs once. Keyed on the schema hash: the cache lives on `globalThis`, which
 * survives dev HMR, so editing SCHEMA_SQL or DATA_MIGRATIONS must invalidate it
 * or the new statements never run.
 */
export function ensureSchema(): Promise<void> {
  if (!globalThis._schemaReady || globalThis._schemaReadyHash !== SCHEMA_HASH) {
    globalThis._schemaReadyHash = SCHEMA_HASH;
    const pool = db();
    globalThis._schemaReady = pool
      .query(SCHEMA_SQL)
      .then(() => runDataMigrations(pool))
      .catch((err) => {
        // Don't cache the failure — a transient outage (DB not yet up) must not
        // poison every later request until the process restarts.
        globalThis._schemaReady = undefined;
        globalThis._schemaReadyHash = undefined;
        throw err;
      });
  }
  return globalThis._schemaReady;
}
