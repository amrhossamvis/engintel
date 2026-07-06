import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildStepPrompt,
  SPECKIT_STEPS,
  type SpecKitStep,
} from "@/lib/speckit-templates";
import {
  cleanExpiredSessions,
  readAllArtifacts,
  writeArtifact,
} from "@/lib/speckit-session";

export const runtime = "nodejs";

const COPILOT_COMMAND = process.env.COPILOT_COMMAND?.trim() || "copilot";
const MAX_PROMPT_CHARS = 40000; // higher limit for multi-artifact context
const RUN_TIMEOUT_MS = 180000; // 3 min — planning steps can be long
const MAX_CONCURRENT = Number(process.env.SPECKIT_MAX_CONCURRENT ?? 2);

const COPILOT_HARDENING_ARGS = ["--disable-builtin-mcps"];

let activeRuns = 0;

// Clean expired sessions on cold start
void cleanExpiredSessions();

function stripAnsi(s: string): string {
  return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

type Body = {
  step: SpecKitStep;
  userInput: string;
  sessionId: string;
  githubToken: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { step, userInput, sessionId, githubToken } = body;

  // Validate
  if (!githubToken || githubToken.trim().length < 8) {
    return Response.json({ error: "missing_token" }, { status: 400 });
  }
  if (!sessionId || sessionId.length < 8) {
    return Response.json({ error: "invalid_session" }, { status: 400 });
  }
  if (!SPECKIT_STEPS.find((s) => s.id === step)) {
    return Response.json({ error: "invalid_step" }, { status: 400 });
  }
  if (activeRuns >= MAX_CONCURRENT) {
    return Response.json({ error: "too_many_runs" }, { status: 429 });
  }

  // Load prior artifacts for context
  const artifacts = await readAllArtifacts(sessionId);

  // Build the full prompt
  const fullPrompt = buildStepPrompt(step, userInput, artifacts);
  if (fullPrompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: "prompt_too_long" }, { status: 400 });
  }

  activeRuns += 1;
  const workdir = await mkdtemp(join(tmpdir(), "sk-"));

  const child = spawn(
    COPILOT_COMMAND,
    [...COPILOT_HARDENING_ARGS, "-sp", fullPrompt],
    {
      cwd: workdir,
      env: {
        ...process.env,
        COPILOT_GITHUB_TOKEN: githubToken,
        GH_TOKEN: githubToken,
        GITHUB_TOKEN: githubToken,
      },
    },
  );

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stepMeta = SPECKIT_STEPS.find((s) => s.id === step)!;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const push = (text: string) => {
        if (!closed && text) {
          fullResponse += text;
          controller.enqueue(encoder.encode(stripAnsi(text)));
        }
      };
      const finish = async () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        activeRuns = Math.max(0, activeRuns - 1);
        void rm(workdir, { recursive: true, force: true }).catch(() => {});

        // Persist the output as an artifact for subsequent steps
        if (fullResponse.trim()) {
          try {
            await writeArtifact(sessionId, stepMeta.outputFile, fullResponse);
          } catch {
            // best-effort persist
          }
        }

        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const timer = setTimeout(() => {
        push("\n\n[timed out after 180s — killed]\n");
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
        void finish();
      });
      child.on("close", (code) => {
        if (code && code !== 0) push(`\n[exit ${code}]\n`);
        void finish();
      });

      req.signal.addEventListener("abort", () => {
        child.kill("SIGKILL");
        void finish();
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

/** GET endpoint to retrieve current session artifacts */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId || sessionId.length < 8) {
    return Response.json({ error: "invalid_session" }, { status: 400 });
  }
  const artifacts = await readAllArtifacts(sessionId);
  return Response.json({ artifacts });
}

