/**
 * copilot-api.ts
 *
 * Calls the GitHub Copilot REST API directly — no local CLI binary required.
 * Works in Docker / remote deployments.
 *
 * Token resolution order:
 *   1. Explicit `githubToken` argument (passed from request header `x-github-pat`)
 *   2. `GITHUB_TOKEN` environment variable (set in Docker / CI)
 *   3. `gh auth token` CLI fallback (local dev only)
 *
 * The GitHub Copilot API does NOT accept classic PATs directly.
 * We exchange the PAT/OAuth token for a short-lived Copilot session token first.
 */

import { execSync } from 'child_process';

const COPILOT_API_BASE = 'https://api.githubcopilot.com';
const DEFAULT_MODEL = 'gpt-4o';

// Cache session tokens to avoid exchanging on every request (they last ~30 min)
const sessionTokenCache = new Map<string, { token: string; expiresAt: number }>();

function resolveGitHubToken(explicit?: string): string {
  // 1. Explicit token from caller
  if (explicit && explicit.trim()) return explicit.trim();

  // 2. Environment variable (Docker / server deployment)
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();

  // 3. gh CLI fallback (local dev)
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (token) return token;
  } catch {
    // gh not available — fall through to error
  }

  throw new Error(
    'No GitHub token available. Please set your GitHub PAT in Settings, ' +
    'or set the GITHUB_TOKEN environment variable, ' +
    'or run: gh auth login'
  );
}

/**
 * Exchange a GitHub PAT/OAuth token for a short-lived Copilot session token.
 * Classic PATs and fine-grained PATs both work via this exchange.
 */
async function getCopilotSessionToken(githubToken: string): Promise<string> {
  const cached = sessionTokenCache.get(githubToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    method: 'GET',
    headers: {
      Authorization: `token ${githubToken}`,
      'Accept': 'application/json',
      'Editor-Version': 'vscode/1.85.0',
      'Editor-Plugin-Version': 'copilot/1.138.0',
      'User-Agent': 'GithubCopilot/1.138.0',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get Copilot session token (${response.status}): ${text.slice(0, 300)}. ` +
      'Make sure your GitHub token has Copilot access (GitHub Copilot subscription required).'
    );
  }

  const data = await response.json();
  const sessionToken = data.token as string;
  const expiresAt = (data.expires_at as number) * 1000; // convert to ms

  sessionTokenCache.set(githubToken, { token: sessionToken, expiresAt });
  return sessionToken;
}

/**
 * Call the GitHub Copilot chat completions API with a plain text prompt.
 * Returns the assistant's response as a plain string.
 *
 * @param prompt      The user prompt to send
 * @param githubToken Optional GitHub PAT (from Settings / request header)
 * @param model       Model ID (defaults to gpt-4o)
 */
export async function runCopilotPrompt(
  prompt: string,
  githubToken?: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const rawToken = resolveGitHubToken(githubToken);
  const sessionToken = await getCopilotSessionToken(rawToken);

  const response = await fetch(`${COPILOT_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      'Editor-Version': 'vscode/1.85.0',
      'Editor-Plugin-Version': 'copilot/1.138.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'User-Agent': 'GithubCopilot/1.138.0',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Copilot API error ${response.status}: ${text.slice(0, 400)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content as string | undefined;
  if (!content) {
    throw new Error(`Unexpected Copilot API response: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return content.trim();
}

/**
 * Same as runCopilotPrompt but with a separate system prompt.
 */
export async function runCopilotChat(
  systemPrompt: string,
  userMessage: string,
  githubToken?: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const rawToken = resolveGitHubToken(githubToken);
  const sessionToken = await getCopilotSessionToken(rawToken);

  const response = await fetch(`${COPILOT_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      'Editor-Version': 'vscode/1.85.0',
      'Editor-Plugin-Version': 'copilot/1.138.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'User-Agent': 'GithubCopilot/1.138.0',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Copilot API error ${response.status}: ${text.slice(0, 400)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content as string | undefined;
  if (!content) {
    throw new Error(`Unexpected Copilot API response: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return content.trim();
}
