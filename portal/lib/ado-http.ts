/**
 * Server-only shared ADO fetch helper. Never import from a "use client" file.
 *
 * With invalid/expired/empty auth, dev.azure.com responds with a 302 redirect
 * to a Microsoft sign-in HTML page rather than a clean 401 JSON error. fetch()
 * follows redirects by default, so the final response looks like a 200-OK —
 * `!res.ok` never catches it, and a plain `res.json()` fails with a cryptic
 * "Unexpected token '<'" instead of a message that points at the real cause.
 * Every ADO call in the direct-REST capabilities goes through this so that
 * failure surfaces as a clear "check your PAT" error instead.
 */

export class AdoHttpError extends Error {}

async function parseJsonResponse(res: Response, url: string): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const looksLikeSignIn = /sign.?in|login\.microsoftonline/i.test(text) || res.url.includes("visualstudio.com/_signin");
    throw new AdoHttpError(
      looksLikeSignIn
        ? `Azure DevOps rejected the request's credentials (redirected to sign-in) for ${url}. Check your ADO PAT/az login.`
        : `Azure DevOps returned a non-JSON response (${res.status}) for ${url}: ${text.slice(0, 200)}`,
    );
  }
  return JSON.parse(text);
}

/** GET/POST/PATCH and parse JSON, with the redirect-to-sign-in failure mode surfaced clearly. */
export async function adoFetchJson(url: string, auth: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: auth, Accept: "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new AdoHttpError(`ADO request failed (${res.status}) for ${url}: ${text.slice(0, 300)}`);
  }
  return parseJsonResponse(res, url);
}

export async function adoPostJson(url: string, auth: string, body: unknown): Promise<unknown> {
  return adoFetchJson(url, auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function adoPatchJson(url: string, auth: string, operations: unknown[]): Promise<unknown> {
  return adoFetchJson(url, auth, {
    method: "PATCH",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify(operations),
  });
}
