import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";

export const runtime = "nodejs";

const COPILOT_COMMAND = process.env.COPILOT_COMMAND?.trim() || "copilot";
const MAX_PROMPT_CHARS = 20000;
const RUN_TIMEOUT_MS = 120000;
/** Cap concurrent Copilot processes — each is heavy + burns AI credits. */
const MAX_CONCURRENT = Number(process.env.PLAYGROUND_MAX_CONCURRENT ?? 3);

let activeRuns = 0;

/**
 * Playground runs a FREE-FORM, user-supplied prompt through the Copilot CLI on
 * the host that serves this app. Copilot ships shell / file-write / URL / MCP
 * tools — so this is a pure text-generation surface and must stay locked down:
 *
 *  - NEVER add `--allow-all-tools` (or COPILOT_ALLOW_ALL): it is what enables
 *    non-interactive tool execution. Without it, tool calls that need approval
 *    cannot run in this no-TTY context, so shell/write are effectively blocked.
 *  - `--disable-builtin-mcps` drops the GitHub MCP tool surface we don't need.
 *  - Each run gets an isolated temp dir as cwd, removed afterwards, so file
 *    tools (if any) can't reach the repo or other runs' scratch.
 */
const COPILOT_HARDENING_ARGS = ["--disable-builtin-mcps"];

/** Optional lockdown: when set, context folders must live under this root. */
const ALLOWED_ROOT = process.env.PLAYGROUND_ALLOWED_ROOT?.trim();

/** Strip ANSI escape / control sequences the Copilot CLI emits. */
function stripAnsi(s: string): string {
  return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

/**
 * Validate a user-supplied context folder. Returns the resolved absolute path
 * granted to Copilot via `--add-dir` (read-only), or an error code. Read access
 * only — cwd stays the throwaway temp dir, so writes never reach this folder.
 */
async function resolveContextDir(
  raw: string,
): Promise<{ path: string } | { error: string }> {
  if (!isAbsolute(raw)) return { error: "context_not_absolute" };

  // realpath resolves symlinks so the root check can't be escaped by a symlink
  // inside ALLOWED_ROOT pointing elsewhere (`resolve()` is purely lexical).
  let real: string;
  try {
    real = await realpath(resolve(raw));
  } catch {
    return { error: "context_not_found" };
  }

  if (ALLOWED_ROOT) {
    let realRoot: string;
    try {
      realRoot = await realpath(resolve(ALLOWED_ROOT));
    } catch {
      return { error: "context_root_missing" };
    }
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      return { error: "context_outside_root" };
    }
  }

  const s = await stat(real);
  if (!s.isDirectory()) return { error: "context_not_dir" };
  return { path: real };
}

type Body = { prompt: string; githubToken: string; contextDir?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  const githubToken = String(body.githubToken ?? "");
  if (!githubToken || githubToken.trim().length < 8) {
    return Response.json({ error: "missing_token" }, { status: 400 });
  }
  if (!prompt) {
    return Response.json({ error: "empty_prompt" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: "prompt_too_long" }, { status: 400 });
  }
  if (activeRuns >= MAX_CONCURRENT) {
    return Response.json({ error: "too_many_runs" }, { status: 429 });
  }

  let contextArgs: string[] = [];
  let finalPrompt = prompt;
  const rawContext = String(body.contextDir ?? "").trim();
  if (rawContext) {
    const ctx = await resolveContextDir(rawContext);
    if ("error" in ctx) return Response.json({ error: ctx.error }, { status: 400 });
    contextArgs = ["--add-dir", ctx.path];
    finalPrompt =
      `You have read-only access to the folder: ${ctx.path}\n` +
      `Read the relevant files there as context before answering the request below.\n\n` +
      prompt;
  }

  activeRuns += 1;
  const workdir = await mkdtemp(join(tmpdir(), "pg-"));

  const child = spawn(COPILOT_COMMAND, [...COPILOT_HARDENING_ARGS, ...contextArgs, "-sp", finalPrompt], {
    cwd: workdir,
    env: {
      ...process.env,
      COPILOT_GITHUB_TOKEN: githubToken,
      GH_TOKEN: githubToken,
      GITHUB_TOKEN: githubToken,
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const push = (text: string) => {
        if (!closed && text) controller.enqueue(encoder.encode(stripAnsi(text)));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        activeRuns = Math.max(0, activeRuns - 1);
        void rm(workdir, { recursive: true, force: true }).catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const timer = setTimeout(() => {
        push("\n\n[timed out after 120s — killed]\n");
        child.kill("SIGKILL");
      }, RUN_TIMEOUT_MS);

      child.stdout.on("data", (d: Buffer) => push(d.toString()));
      child.stderr.on("data", (d: Buffer) => push(d.toString()));
      child.on("error", (e) => {
        const msg =
          (e as NodeJS.ErrnoException).code === "ENOENT"
            ? `Copilot CLI not found (command: ${COPILOT_COMMAND}). Install it with: npm install -g @github/copilot`
            : `Failed to start Copilot CLI: ${e.message}`;
        push(`\n[error] ${msg}\n`);
        finish();
      });
      child.on("close", (code) => {
        if (code && code !== 0) push(`\n[exit ${code}]\n`);
        finish();
      });

      // Client disconnect (AbortController) → kill the child.
      req.signal.addEventListener("abort", () => {
        child.kill("SIGKILL");
        finish();
      });
    },
    cancel() {
      child.kill("SIGKILL");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
