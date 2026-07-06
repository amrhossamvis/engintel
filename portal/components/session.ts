export type Theme = "dark" | "light";

/** Stable per-browser key, persisted in localStorage. Distinguishes submitters without auth. */
export function clientKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem("forge_ck");
  if (!k) {
    k = crypto.randomUUID();
    window.localStorage.setItem("forge_ck", k);
  }
  return k;
}

/** Initials from a display name, e.g. "Mohamed Elzanaty" → "ME". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
