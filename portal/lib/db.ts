import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _schemaReady: Promise<void> | undefined;
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

UPDATE ideas SET domain = 'Web Guild' WHERE domain = 'Web';
UPDATE ideas SET domain = 'Backend Guild' WHERE domain = 'Backend';
UPDATE ideas SET status = 'in_progress' WHERE status = 'in_pipeline';

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
`;

/** Create tables on first use. Cached per process so it runs once. */
export function ensureSchema(): Promise<void> {
  if (!globalThis._schemaReady) {
    globalThis._schemaReady = db()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        // Don't cache the failure — a transient outage (DB not yet up) must not
        // poison every later request until the process restarts.
        globalThis._schemaReady = undefined;
        throw err;
      });
  }
  return globalThis._schemaReady;
}
