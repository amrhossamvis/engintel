/**
 * Server-only shared helpers for the breakdown-family capabilities (Business
 * Intent Builder, Feature/Epic Breakdown + Story Roll-up). Ported from the
 * common utility functions in ado_copilot_business_intent_item_creation.py
 * and ado_copilot_workitem_breakdown.py, which both duplicate the same
 * title-cleanup / description-formatting / JSON-repair logic in Python —
 * factored into one module here instead of copy-pasted twice.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { adoFetchJson } from "@/lib/ado-http";

const BANNED_TITLE_ENDINGS = ["breakdown display", "display", "screen", "page"];

const SECTION_HEADERS = [
  "Dependencies / References:",
  "High-Level Implementation Guidelines:",
  "Authoritative Guidance Reviewed:",
  "Risks / Considerations:",
  "Testing / Validation:",
  "Rollout / Rollback:",
  "Benefit Hypothesis:",
  "Background / Context:",
  "Technical Recommendations:",
  "Business Capability:",
  "Business Value:",
  "Impacted Segments:",
  "Out of Scope:",
  "Accessibility:",
  "Remaining Effort:",
  "Assumptions:",
  "Dependencies:",
  "References:",
  "Background:",
  "Problem:",
  "Solution:",
  "Segments:",
  "Segment:",
  "Context:",
  "Scope:",
];

/** Docs rulebook root: `../docs` relative to the app's cwd (see Dockerfile). */
export function docsRoot(): string {
  return path.join(process.cwd(), "..", "docs");
}

/**
 * Resolve a team's breakdown instruction file (team-specific, falling back to
 * generic), mirroring discover_instruction_file()'s "team file wins, else
 * generic" rule from the Python originals.
 */
export async function discoverInstructionFile(
  teamName: string,
  kind: "epic-breakdown" | "feature-breakdown" | "user-story-rollup" | "tech-epic-breakdown" | "tech-feature-breakdown",
): Promise<{ path: string; content: string }> {
  const suffix = (teamName || "generic").trim().toLowerCase() || "generic";
  const dir = path.join(docsRoot(), "breakdown-instructions");
  const candidates =
    kind === "tech-epic-breakdown" || kind === "tech-feature-breakdown"
      ? [`${kind}-instructions-${suffix}.md`, `${kind}-instructions.md`]
      : [`${kind}-instructions-${suffix}.md`, `${kind}-instructions-generic.md`];

  for (const filename of candidates) {
    const filePath = path.join(dir, filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { path: filePath, content };
    } catch {
      continue;
    }
  }
  throw new Error(
    `Could not find instruction file for '${kind}' team '${suffix}' (or a generic fallback) under ${dir}.`,
  );
}

export function cleanupTitle(title: string): string {
  const text = (title ?? "").replace(/\s+/g, " ").trim().replace(/^[|\s-]+|[|\s-]+$/g, "");
  const parts = text.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Untitled";

  if (parts.length >= 3) {
    let last = parts[parts.length - 1];
    for (const ending of BANNED_TITLE_ENDINGS) {
      const pattern = new RegExp(`\\b${ending.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const candidate = last.replace(pattern, "").replace(/\s{2,}/g, " ").trim().replace(/^[|\s-]+|[|\s-]+$/g, "");
      if (candidate) last = candidate;
    }
    parts[parts.length - 1] = last;
    return parts.join(" | ");
  }

  let cleaned = text;
  for (const ending of BANNED_TITLE_ENDINGS) {
    const pattern = new RegExp(`\\b${ending.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim().replace(/^[|\s-]+|[|\s-]+$/g, "");
  return cleaned || "Untitled";
}

function canonicalizeSectionHeaders(text: string): string {
  const canonical = new Map(SECTION_HEADERS.map((h) => [h.slice(0, -1).toLowerCase(), h]));
  const labels = [...canonical.keys()].sort((a, b) => b.length - a.length);
  const alternatives = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?<![A-Za-z])(?:[-*•]\\s*)?(?:\\*\\*|__)?(${alternatives})(?:\\*\\*|__)?\\s*:?\\s*`, "gi");
  return text.replace(pattern, (_m, label: string) => `\n\n${canonical.get(label.toLowerCase())}\n`);
}

export function normalizeDescriptionText(text: string): string {
  let value = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\n/g, "\n").trim();
  if (!value) return "";

  value = canonicalizeSectionHeaders(value);
  value = value.replace(/\n{3,}/g, "\n\n");

  const lines: string[] = [];
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    lines.push(/^[-*•]/.test(line) ? "- " + line.replace(/^[-*•\s]+/, "") : line);
  }
  return lines.join("\n").trim().replace(/\n{3,}/g, "\n\n");
}

export function normalizeAcceptanceCriteriaText(text: string): string {
  let value = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\n/g, "\n").trim();
  if (!value) return "";
  value = value.replace(/\s+Scenario:/gi, "\n\nScenario:");
  for (const keyword of ["Given", "When", "Then", "And", "But"]) {
    value = value.replace(new RegExp(`\\s+${keyword}\\b`, "gi"), `\n${keyword}`);
  }
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textBlocksToHtml(text: string): string {
  if (!text.trim()) return "";
  const rendered: string[] = [];
  for (const block of text.split("\n\n").map((b) => b.trim()).filter(Boolean)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every((l) => l.startsWith("- "))) {
      rendered.push(`<ul>${lines.map((l) => `<li>${escapeHtml(l.slice(2).trim())}</li>`).join("")}</ul>`);
    } else if (lines.length === 1 && lines[0].endsWith(":")) {
      rendered.push(`<p><strong>${escapeHtml(lines[0])}</strong></p>`);
    } else if (lines[0].endsWith(":")) {
      const heading = `<p><strong>${escapeHtml(lines[0])}</strong></p>`;
      const rest = lines.slice(1);
      rendered.push(
        rest.length && rest.every((l) => l.startsWith("- "))
          ? heading + `<ul>${rest.map((l) => `<li>${escapeHtml(l.slice(2).trim())}</li>`).join("")}</ul>`
          : heading + `<p>${rest.map(escapeHtml).join("<br>")}</p>`,
      );
    } else {
      rendered.push(`<p>${lines.map(escapeHtml).join("<br>")}</p>`);
    }
  }
  return rendered.join("");
}

export function descriptionTextToAdoHtml(text: string): string {
  return textBlocksToHtml(normalizeDescriptionText(text));
}

export function acceptanceCriteriaTextToAdoHtml(text: string): string {
  const normalized = normalizeAcceptanceCriteriaText(text);
  return normalized
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.split("\n").map((l) => escapeHtml(l.trim())).filter(Boolean).join("<br>")}</p>`)
    .join("");
}

/** Extract the first balanced `{...}` JSON object from Copilot's raw text output. */
export function extractJsonObject(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "").replace(/^﻿/, "").trim();

  const fenceMatches = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidates = [...fenceMatches, cleaned];

  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return candidate.slice(start, i + 1).trim();
      }
    }
  }
  return null;
}

/** JSON.parse with a lenient retry, mirroring load_copilot_json()'s strict=False fallback. */
export function loadCopilotJson(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Copilot occasionally emits raw control characters inside string values.
    return JSON.parse(jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""));
  }
}

/**
 * Best-effort "who is running this" identity for auto-assignment — the
 * direct-REST equivalent of resolve_assigned_to_identity()'s pipeline-
 * requester lookup (BUILD_REQUESTEDFOR/EMAIL), which doesn't exist outside a
 * pipeline. Since local runs execute under the caller's own ADO auth, the
 * "requester" is simply whoever that auth resolves to.
 *
 * ADO's System.AssignedTo field needs a qualified identity ("Display
 * Name<email>", or an email/UPN alone) to resolve unambiguously — a bare
 * display name is rejected with "unknown identity". The Profile API
 * reliably returns both displayName and emailAddress; connectionData is a
 * fallback for orgs where that call fails, and its account/email property is
 * still preferred over the bare display name for the same reason. If no
 * qualified identifier can be resolved, return null (skip assignment)
 * rather than gambling on a bare name that's likely to be rejected.
 */
export async function resolveCallerIdentity(org: string, auth: string): Promise<string | null> {
  try {
    const profile = (await adoFetchJson(
      `https://vssps.dev.azure.com/${encodeURIComponent(org)}/_apis/profile/profiles/me?api-version=7.1`,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
    )) as any;
    const displayName = profile?.displayName ? String(profile.displayName) : "";
    const email = profile?.emailAddress ? String(profile.emailAddress) : "";
    if (email && displayName) return `${displayName}<${email}>`;
    if (email) return email;
  } catch {
    // fall through to connectionData
  }

  try {
    const data = (await adoFetchJson(
      `https://dev.azure.com/${encodeURIComponent(org)}/_apis/connectionData?api-version=7.1-preview`,
      auth,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ADO REST responses are untyped at this boundary
    )) as any;
    const name = data?.authenticatedUser?.providerDisplayName ?? data?.authenticatedUser?.customDisplayName;
    const account = data?.authenticatedUser?.properties?.Account?.$value;
    if (account && name) return `${name}<${account}>`;
    if (account) return String(account);
    return null;
  } catch {
    return null;
  }
}

export const MAX_CHILDREN = 30;
