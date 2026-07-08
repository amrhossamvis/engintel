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
 * Enterprise/Business accounts (EMU):
 *   - `copilot_internal/v2/token` returns 404 for EMU accounts
 *   - Use the PAT directly as Bearer token
 *   - API base: https://api.business.githubcopilot.com
 *
 * Personal/Individual accounts:
 *   - Exchange PAT for session token via copilot_internal/v2/token
 *   - API base: https://api.githubcopilot.com
 */

import { execSync } from "child_process";

const COPILOT_API_BUSINESS = "https://api.business.githubcopilot.com";
const COPILOT_API_PERSONAL = "https://api.githubcopilot.com";
const DEFAULT_MODEL = "gpt-4o";

// Cache session tokens to avoid exchanging on every request (they last ~30 min)
const sessionTokenCache = new Map<string, { token: string; expiresAt: number }>();

// Cache which tokens are business vs personal (avoid repeated probing)
const tokenTypeCache = new Map<string, "business" | "personal">();

function resolveGitHubToken(explicit?: string): string {
  // 1. Explicit token from caller
  if (explicit && explicit.trim()) return explicit.trim();

  // 2. Environment variable (Docker / server deployment)
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();

  // 3. gh CLI fallback (local dev)
  try {
    const token = execSync("gh auth token", { encoding: "utf-8", timeout: 5000 }).trim();
    if (token) return token;
  } catch {
    // gh not available — fall through to error
  }

  throw new Error(
    "No GitHub token available. Please set your GitHub PAT in Settings, " +
      "or set the GITHUB_TOKEN environment variable, " +
      "or run: gh auth login",
  );
}

/**
 * Try to exchange a PAT for a Copilot session token (personal accounts).
 * Returns null if the account is Enterprise/Business (EMU) — use PAT directly instead.
 */
async function tryGetSessionToken(githubToken: string): Promise<string | null> {
  const cached = sessionTokenCache.get(githubToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch("https://api.github.com/copilot_internal/v2/token", {
    method: "GET",
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.85.0",
      "Editor-Plugin-Version": "copilot/1.138.0",
      "User-Agent": "GithubCopilot/1.138.0",
    },
  });

  // 404 = EMU/Business account — session token exchange not supported
  if (response.status === 404) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get Copilot session token (${response.status}): ${text.slice(0, 300)}. ` +
        "Make sure your GitHub token has Copilot access (GitHub Copilot subscription required).",
    );
  }

  const data = await response.json();
  const sessionToken = data.token as string;
  const expiresAt = (data.expires_at as number) * 1000;

  sessionTokenCache.set(githubToken, { token: sessionToken, expiresAt });
  return sessionToken;
}

/**
 * Resolve the correct API base URL and auth token for the account type.
 */
async function resolveApiConfig(githubToken: string): Promise<{
  apiBase: string;
  bearerToken: string;
}> {
  // Check cache first
  const cached = tokenTypeCache.get(githubToken);
  if (cached === "business") {
    return { apiBase: COPILOT_API_BUSINESS, bearerToken: githubToken };
  }
  if (cached === "personal") {
    const sessionToken = await tryGetSessionToken(githubToken);
    if (sessionToken) {
      return { apiBase: COPILOT_API_PERSONAL, bearerToken: sessionToken };
    }
  }

  // OAuth tokens (gho_) work directly on the business endpoint
  if (githubToken.startsWith("gho_")) {
    tokenTypeCache.set(githubToken, "business");
    return { apiBase: COPILOT_API_BUSINESS, bearerToken: githubToken };
  }

  // Classic PAT (ghp_) or other: try session token exchange (personal accounts)
  const sessionToken = await tryGetSessionToken(githubToken);
  if (sessionToken) {
    tokenTypeCache.set(githubToken, "personal");
    return { apiBase: COPILOT_API_PERSONAL, bearerToken: sessionToken };
  }

  // Session token exchange returned null (404) → EMU/Business account with a PAT
  throw new Error(
    "GitHub Enterprise/Business accounts require an OAuth token (gho_), not a Classic PAT (ghp_). " +
      'Please run "gh auth login" on the server to authenticate with your enterprise account, ' +
      "then leave the GitHub PAT field empty in Settings to use the gh CLI token automatically.",
  );
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
  model: string = DEFAULT_MODEL,
): Promise<string> {
  const rawToken = resolveGitHubToken(githubToken);
  const { apiBase, bearerToken } = await resolveApiConfig(rawToken);

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      "Editor-Version": "vscode/1.85.0",
      "Editor-Plugin-Version": "copilot/1.138.0",
      "Copilot-Integration-Id": "vscode-chat",
      "User-Agent": "GithubCopilot/1.138.0",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
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
