/**
 * Fetch wrapper that automatically prepends the Next.js basePath to relative URLs.
 * Use `apiFetch("/api/foo", opts)` instead of `fetch("/api/foo", opts)`.
 *
 * This is needed because Next.js `basePath` only auto-prefixes Link/router navigation,
 * NOT manual fetch() calls.
 */

const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.__NEXT_ROUTER_BASEPATH ??
  "";

export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof input === "string" && input.startsWith("/")) {
    return fetch(`${BASE_PATH}${input}`, init);
  }
  return fetch(input, init);
}
