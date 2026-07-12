/**
 * Server-only UI TestData ID Reviewer — direct-REST port of
 * ado_copilot_ui_testdata_id_reviewer.py. Reviews UI component changes in a
 * PR for missing testdata IDs (data-testid, test-id, etc.), one Copilot chat
 * call with every changed file's diff/snapshot inlined directly into the
 * message instead of a file-bundle the CLI would read from disk.
 */

import { runCopilotChat } from "@/lib/copilot";
import { parsePrUrl } from "@/lib/ado";
import {
  deletePrComment,
  getLatestPrIterationId,
  getPrChangedFiles,
  getPullRequestRecord,
  listPrThreads,
  loadPrFileContexts,
  postPrGeneralComment,
  postPrInlineComment,
  type PrFileContext,
} from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";

const REVIEW_MARKER = "[COPILOT-TESTDATA-REVIEW]";
const INLINE_MARKER = "[COPILOT-TESTDATA-INLINE]";
const REVIEW_REF_PATTERN = /\[REVIEW-REF:\s*TD(\d+)/i;
const UI_COMPONENT_EXTENSIONS = [".tsx", ".jsx", ".vue", ".html", ".ts", ".js"];
const IGNORED_EXTENSIONS = [".xml", ".sql", ".yaml", ".yml", ".json", ".md", ".txt"];

type TestDataFinding = {
  filePath: string;
  elementType: string;
  line: number;
  elementContext: string;
  suggestion: string;
  confidence: number;
};

function isUiComponentFile(path: string): boolean {
  const lowered = path.toLowerCase();
  if (IGNORED_EXTENSIONS.some((ext) => lowered.endsWith(ext))) return false;
  return UI_COMPONENT_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

function buildSystemPrompt(): string {
  return `You are reviewing UI component changes in a pull request for missing testdata IDs.

Use ONLY the provided file snapshots and diffs.

Your task:
1. Identify all interactive/testable UI elements in new or modified components
2. Check if each element has a testdata ID attribute (data-testid, test-id, testDataId, etc.)
3. Flag elements that are missing testdata IDs with high confidence
4. Provide specific, actionable suggestions for testdata ID naming

Important expectations:
- Focus on user-interactive elements (buttons, inputs, links, forms, modals)
- Ignore pure presentation elements without test value
- Be conservative with confidence scores — only high-confidence findings
- Only flag elements that are actually in changed/new code (line numbers refer to the NEW file version)
- findings must be [] when there are no meaningful issues
- Do not include markdown fences. Output valid JSON only.

Output format:
{
  "summary": {
    "totalUIComponentsReviewed": 0,
    "totalElementsAnalyzed": 0,
    "elementsMissingTestdata": 0,
    "confidenceAverage": 0.0,
    "overview": "..."
  },
  "findings": [
    { "filePath": "/path/Component.tsx", "elementType": "button", "line": 42, "elementContext": "...", "suggestion": "data-testid=\\"...\\"", "confidence": 0.95 }
  ]
}`;
}

function buildUserMessage(prTitle: string, files: PrFileContext[]): string {
  const fileBlocks = files
    .map(
      (f) =>
        `\n## File: ${f.path}\nChange type: ${f.changeType}\nChanged target lines: ${[...f.changedLines].slice(0, 300).join(", ") || "none detected"}\n\n### Diff\n${f.text || "No unified diff available."}\n\n### New file content\n${f.newContent.slice(0, 60_000)}`,
    )
    .join("\n");
  return `PR title: ${prTitle}\nUI component files analyzed: ${files.length}\n${fileBlocks}`;
}

function buildInlineComment(finding: TestDataFinding, reviewRef: string): string {
  return (
    `${INLINE_MARKER} [REVIEW-REF: ${reviewRef}]\n\n` +
    `**Missing TestData ID for ${finding.elementType} element**\n\n` +
    `Element Context: ${finding.elementContext}\n\n**Suggested Fix:**\n${finding.suggestion}\n\n` +
    `_Confidence: ${finding.confidence.toFixed(2)}_\n\n` +
    `Adding testdata IDs enables reliable automated testing and improves test maintainability.`
  );
}

function buildSummaryComment(
  prId: string,
  prTitle: string,
  files: PrFileContext[],
  summary: { totalUIComponentsReviewed: number; totalElementsAnalyzed: number; elementsMissingTestdata: number; confidenceAverage: number; overview: string },
  findings: TestDataFinding[],
  reviewRef: string,
): string {
  const lines = [
    `${REVIEW_MARKER} [REVIEW-REF: ${reviewRef}]`,
    "",
    `Automated TestData ID coverage review for PR ${prId}`,
    `**Review reference:** ${reviewRef}`,
    `**PR title:** ${prTitle}`,
    `**UI components reviewed:** ${summary.totalUIComponentsReviewed}`,
    `**Total elements analyzed:** ${summary.totalElementsAnalyzed}`,
    `**Elements missing testdata IDs:** ${summary.elementsMissingTestdata}`,
    `**Average confidence:** ${summary.confidenceAverage.toFixed(2)}`,
    `**Overall assessment:** ${summary.overview || "Analysis complete."}`,
    `**Inline comments posted:** ${findings.length}`,
    "",
    "**Analyzed files:**",
    ...files.map((f) => `- ${f.path} (changeType=${f.changeType}, changedLines=${f.changedLines.size})`),
    "",
  ];
  if (findings.length > 0) {
    lines.push("**Issues Identified:**");
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. **${f.elementType}** in \`${f.filePath}\``, `   - Line: ${f.line}`, `   - Suggestion: ${f.suggestion}`, "");
    });
  } else {
    lines.push("No missing testdata IDs detected in UI components.");
  }
  return lines.join("\n");
}

export async function runUiTestDataReviewer(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const prUrl = typeof inputs.prUrl === "string" ? inputs.prUrl.trim() : "";
  if (!prUrl) throw new Error("A pull request URL is required.");
  const parsed = parsePrUrl(prUrl);
  if (!parsed) throw new Error(`Could not parse a pull request URL from: ${prUrl}`);
  const { repo, prId } = parsed;

  emit(`[ado] loading PR ${prId} in ${repo}…`);
  const pr = await getPullRequestRecord(repo, prId, adoAuth);
  if (!pr.sourceCommit) throw new Error("Could not resolve the PR's source commit.");

  const iterationId = await getLatestPrIterationId(repo, prId, adoAuth);

  emit("[ado] computing next review reference…");
  const threads = await listPrThreads(repo, prId, adoAuth);
  let nextReviewNumber = 0;
  for (const t of threads) {
    for (const c of t.comments) {
      if (!c.content.includes(REVIEW_MARKER)) continue;
      const m = c.content.match(REVIEW_REF_PATTERN);
      if (m) nextReviewNumber = Math.max(nextReviewNumber, Number(m[1]));
    }
  }
  const reviewRef = `TD${String(nextReviewNumber + 1).padStart(3, "0")}-PR${prId}-IT${iterationId}`;
  emit(`[ado] review reference: ${reviewRef}`);

  emit("[ado] deleting previous bot comments…");
  let deleted = 0;
  for (const t of threads) {
    for (const c of t.comments) {
      if (c.content.includes(REVIEW_MARKER) || c.content.includes(INLINE_MARKER)) {
        try {
          await deletePrComment(repo, prId, t.id, c.id, adoAuth);
          deleted += 1;
        } catch {
          continue;
        }
      }
    }
  }
  emit(`[ado] deleted ${deleted} previous bot comment(s)`);

  emit("[ado] loading changed files…");
  const allFiles = await getPrChangedFiles(repo, prId, iterationId, adoAuth);
  const uiFiles = allFiles.filter((f) => isUiComponentFile(f.path));
  if (uiFiles.length === 0) {
    emit("[done] no UI component files found in this PR — nothing to review");
    return { webUrl: pr.webUrl, createdCount: 0, items: [] };
  }

  emit(`[ado] fetching old/new content + diffs for ${uiFiles.length} UI component file(s)…`);
  const fileContexts = await loadPrFileContexts(repo, prId, uiFiles, pr.sourceCommit, pr.targetCommit, adoAuth);
  if (fileContexts.length === 0) {
    emit("[done] no reviewable file contexts after filtering");
    return { webUrl: pr.webUrl, createdCount: 0, items: [] };
  }

  emit("[copilot] streaming model response …");
  const raw = await runCopilotChat(buildSystemPrompt(), buildUserMessage(pr.title, fileContexts), githubToken);

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot response could not be parsed into the expected JSON object.");
  const parsedResponse = loadCopilotJson(jsonStr) as {
    summary?: Record<string, unknown>;
    findings?: Record<string, unknown>[];
  };
  const summaryData = parsedResponse.summary ?? {};
  const summary = {
    totalUIComponentsReviewed: Number(summaryData.totalUIComponentsReviewed ?? 0),
    totalElementsAnalyzed: Number(summaryData.totalElementsAnalyzed ?? 0),
    elementsMissingTestdata: Number(summaryData.elementsMissingTestdata ?? 0),
    confidenceAverage: Number(summaryData.confidenceAverage ?? 0),
    overview: String(summaryData.overview ?? ""),
  };

  let findings: TestDataFinding[] = (parsedResponse.findings ?? []).map((f) => ({
    filePath: String(f.filePath ?? ""),
    elementType: String(f.elementType ?? ""),
    line: Number(f.line ?? 0),
    elementContext: String(f.elementContext ?? ""),
    suggestion: String(f.suggestion ?? ""),
    confidence: Number(f.confidence ?? 0),
  }));

  findings = findings.filter((f) => {
    const matched = fileContexts.find((fc) => fc.path === f.filePath);
    if (!matched || matched.changedLines.size === 0) return true;
    return matched.changedLines.has(f.line);
  });
  findings.sort((a, b) => b.confidence - a.confidence);
  emit(`[copilot] ${findings.length} finding(s) after filtering to changed lines`);

  let inlinePosted = 0;
  for (const finding of findings) {
    const matched = fileContexts.find((fc) => fc.path === finding.filePath);
    if (!matched) continue;
    const maxLine = matched.newContent.split("\n").length;
    if (finding.line < 1 || finding.line > maxLine) continue;
    try {
      await postPrInlineComment(
        repo,
        prId,
        matched.path,
        finding.line,
        matched.changeTrackingId,
        iterationId,
        buildInlineComment(finding, reviewRef),
        adoAuth,
      );
      inlinePosted += 1;
    } catch {
      continue;
    }
  }

  await postPrGeneralComment(repo, prId, buildSummaryComment(String(prId), pr.title, fileContexts, summary, findings, reviewRef), adoAuth);
  emit(`[done] review complete — reference ${reviewRef}, ${inlinePosted} inline comment(s) posted`);

  return {
    webUrl: pr.webUrl,
    createdCount: inlinePosted,
    items: [],
  };
}
