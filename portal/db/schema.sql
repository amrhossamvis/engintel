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
  proposed_solution text,
  tags          text[] NOT NULL DEFAULT '{}',
  ado_work_item_id integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

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
