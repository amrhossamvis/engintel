/**
 * Server-only GitHub Copilot client. Never import from a "use client" file.
 *
 * Calls the GitHub Copilot chat-completions API directly over HTTPS — no CLI
 * binary, no subprocess. Every local-execution capability uses this as its
 * single call surface for AI generation, replacing the `copilot -sp <prompt>`
 * subprocess pattern the equivalent Python pipeline scripts used.
 *
 * Token resolution: callers always pass their own githubToken (per-request,
 * from the hub's Settings page) — matches the bring-your-own-token principle
 * already used for every other capability.
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

const COPILOT_API_BUSINESS = "https://api.business.githubcopilot.com";
const COPILOT_API_PERSONAL = "https://api.githubcopilot.com";
const DEFAULT_MODEL = "gpt-4o";

// Cache session tokens to avoid exchanging on every request (they last ~30 min)
const sessionTokenCache = new Map<string, { token: string; expiresAt: number }>();

// Cache which tokens are business vs personal (avoid repeated probing)
const tokenTypeCache = new Map<string, "business" | "personal">();

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
 *
 * - Personal accounts: exchange PAT for session token → api.githubcopilot.com
 * - Business/EMU accounts: PATs (ghp_) are NOT accepted by the business endpoint.
 *   Only OAuth tokens (gho_) work. These come from an OAuth device flow.
 *   So for business accounts, the token MUST be a gho_ OAuth token.
 *
 * Token type detection:
 *   - gho_ prefix → OAuth token → try business endpoint first
 *   - ghp_ prefix → classic PAT → try session exchange (personal), error if EMU
 */
async function resolveApiConfig(githubToken: string): Promise<{
  apiBase: string;
  bearerToken: string;
}> {
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

  if (githubToken.startsWith("gho_")) {
    tokenTypeCache.set(githubToken, "business");
    return { apiBase: COPILOT_API_BUSINESS, bearerToken: githubToken };
  }

  const sessionToken = await tryGetSessionToken(githubToken);
  if (sessionToken) {
    tokenTypeCache.set(githubToken, "personal");
    return { apiBase: COPILOT_API_PERSONAL, bearerToken: sessionToken };
  }

  throw new Error(
    "GitHub Enterprise/Business accounts require an OAuth token (gho_), not a Classic PAT (ghp_). " +
      "Please sign in with an OAuth token in Settings.",
  );
}

async function chatCompletion(
  messages: { role: "system" | "user"; content: string }[],
  githubToken: string,
  model: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  if (!githubToken || githubToken.trim().length < 8) {
    throw new Error("A GitHub Copilot token is required.");
  }

  const { apiBase, bearerToken } = await resolveApiConfig(githubToken.trim());

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
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages }),
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
 * Call Copilot with a single user prompt. Returns the assistant's response as
 * a plain string.
 */
export async function runCopilotPrompt(
  prompt: string,
  githubToken: string,
  model: string = DEFAULT_MODEL,
): Promise<string> {
  return chatCompletion([{ role: "user", content: prompt }], githubToken, model, 4096, 0.3);
}

/**
 * Same as runCopilotPrompt but with a separate system prompt. Uses a larger
 * token budget — most callers use this for structured JSON generation.
 */
export async function runCopilotChat(
  systemPrompt: string,
  userMessage: string,
  githubToken: string,
  model: string = DEFAULT_MODEL,
): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    githubToken,
    model,
    16384,
    0.2,
  );
}
