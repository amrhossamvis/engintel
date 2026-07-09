/**
 * Unified diff + changed-line extraction, used by PR Reviewer and UI TestData
 * ID Reviewer. Ported from ado_copilot_pr_preview_application_claude.py's
 * build_unified_diff / extract_changed_new_lines_from_diff, but sourced from
 * the `diff` package's structured hunks directly instead of re-parsing
 * serialized diff text.
 */

import { structuredPatch } from "diff";

export type FileDiff = {
  /** Human-readable unified diff text, for including in AI prompt context. */
  text: string;
  /** Target-side (new file) line numbers touched by this diff. */
  changedLines: Set<number>;
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... [truncated]";
}

/**
 * Build a unified diff between old/new file content and the target-side line
 * numbers it touches, capped the same way the Python original capped diff
 * text length and total changed-line count.
 */
export function diffFile(
  path: string,
  oldContent: string,
  newContent: string,
  maxDiffChars = 300_000,
  maxChangedLines = 2000,
): FileDiff {
  const patch = structuredPatch(`a${path}`, `b${path}`, oldContent, newContent, "", "", { context: 3 });

  const lines: string[] = [`--- a${path}`, `+++ b${path}`];
  const changedLines = new Set<number>();

  for (const hunk of patch.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    let currentNewLine = hunk.newStart;
    for (const line of hunk.lines) {
      lines.push(line);
      if (line.startsWith("+")) {
        if (changedLines.size < maxChangedLines) changedLines.add(currentNewLine);
        currentNewLine += 1;
      } else if (line.startsWith("-")) {
        // removed line — doesn't advance the new-file line counter
      } else {
        currentNewLine += 1;
      }
    }
  }

  const text = patch.hunks.length > 0 ? truncate(lines.join("\n"), maxDiffChars) : "";
  return { text, changedLines };
}
