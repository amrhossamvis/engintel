import { db } from "@/lib/db";
import { MAX_THREADS } from "@/lib/playground-store";
import type { PlaygroundState, SessionPointer, Thread } from "@/lib/playground-store";
import type { CustomPersona, PgVariable } from "@/lib/playground-templates";

type PersonaRow = {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  persona: string;
  variables: PgVariable[];
  prompt: string;
  created_at: string;
};

type ThreadRow = {
  id: string;
  template_id: string;
  title: string;
  context_dir: string;
  messages: Thread["messages"];
  updated_at: string;
};

function toPersona(r: PersonaRow): CustomPersona {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    icon: r.icon,
    description: r.description,
    persona: r.persona,
    variables: r.variables ?? [],
    prompt: r.prompt,
    custom: true,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function toThread(r: ThreadRow): Thread {
  return {
    id: r.id,
    templateId: r.template_id,
    title: r.title,
    messages: r.messages ?? [],
    contextDir: r.context_dir,
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function getPlaygroundState(userKey: string): Promise<PlaygroundState> {
  const [p, t, s] = await Promise.all([
    db().query<PersonaRow>(
      `SELECT id, name, category, icon, description, persona, variables, prompt, created_at
       FROM pg_personas WHERE user_key = $1 ORDER BY created_at DESC`,
      [userKey],
    ),
    db().query<ThreadRow>(
      `SELECT id, template_id, title, context_dir, messages, updated_at
       FROM pg_threads WHERE user_key = $1 ORDER BY updated_at DESC LIMIT $2`,
      [userKey, MAX_THREADS],
    ),
    db().query<{ thread_id: string | null; persona_id: string | null }>(
      `SELECT thread_id, persona_id FROM pg_session WHERE user_key = $1`,
      [userKey],
    ),
  ]);
  const session: SessionPointer | null = s.rows[0]
    ? { threadId: s.rows[0].thread_id, personaId: s.rows[0].persona_id }
    : null;
  return { personas: p.rows.map(toPersona), threads: t.rows.map(toThread), session };
}

export async function upsertPersona(userKey: string, p: CustomPersona): Promise<void> {
  await db().query(
    `INSERT INTO pg_personas
       (id, user_key, name, category, icon, description, persona, variables, prompt, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, now())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, category = EXCLUDED.category, icon = EXCLUDED.icon,
       description = EXCLUDED.description, persona = EXCLUDED.persona,
       variables = EXCLUDED.variables, prompt = EXCLUDED.prompt, updated_at = now()
     WHERE pg_personas.user_key = EXCLUDED.user_key`,
    [
      p.id,
      userKey,
      p.name,
      p.category,
      p.icon,
      p.description,
      p.persona,
      JSON.stringify(p.variables ?? []),
      p.prompt,
    ],
  );
}

export async function removePersona(userKey: string, id: string): Promise<void> {
  await db().query(`DELETE FROM pg_personas WHERE id = $1 AND user_key = $2`, [id, userKey]);
}

export async function upsertThread(userKey: string, t: Thread): Promise<void> {
  await db().query(
    `INSERT INTO pg_threads (id, user_key, template_id, title, context_dir, messages, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET
       template_id = EXCLUDED.template_id, title = EXCLUDED.title,
       context_dir = EXCLUDED.context_dir, messages = EXCLUDED.messages, updated_at = now()
     WHERE pg_threads.user_key = EXCLUDED.user_key`,
    [t.id, userKey, t.templateId, t.title, t.contextDir, JSON.stringify(t.messages ?? [])],
  );
  // Cap the user's history at MAX_THREADS, dropping the oldest.
  await db().query(
    `DELETE FROM pg_threads WHERE user_key = $1 AND id NOT IN (
       SELECT id FROM pg_threads WHERE user_key = $1 ORDER BY updated_at DESC LIMIT $2)`,
    [userKey, MAX_THREADS],
  );
}

export async function removeThread(userKey: string, id: string): Promise<void> {
  await db().query(`DELETE FROM pg_threads WHERE id = $1 AND user_key = $2`, [id, userKey]);
}

export async function upsertSession(
  userKey: string,
  threadId: string | null,
  personaId: string | null,
): Promise<void> {
  await db().query(
    `INSERT INTO pg_session (user_key, thread_id, persona_id, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_key) DO UPDATE SET
       thread_id = EXCLUDED.thread_id, persona_id = EXCLUDED.persona_id, updated_at = now()`,
    [userKey, threadId, personaId],
  );
}
