/**
 * Server-only PR Reviewer — direct-REST port of
 * ado_copilot_pr_preview_application_claude.py. One Copilot chat call with
 * PR metadata, linked work items, repo coding guidelines, and every changed
 * file's diff/snapshot inlined directly into the message (no file-bundle the
 * CLI would read from disk). Blocks only on high-severity, high-confidence
 * findings — surfaced as a successful ("done") run with outcome: "blocked",
 * not a thrown error, so the structured merge-confidence/blocking-count data
 * survives to the UI.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { runCopilotChat } from "@/lib/copilot";
import { parsePrUrl } from "@/lib/ado";
import {
  deletePrComment,
  getLatestPrIterationId,
  getPrChangedFiles,
  getPrLinkedWorkItemIds,
  getPullRequestRecord,
  getWorkItemRecord,
  listPrThreads,
  loadPrFileContexts,
  postPrGeneralComment,
  postPrInlineComment,
  type PrFileContext,
} from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { docsRoot, extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";

const REVIEW_MARKER = "[COPILOT-POC-REVIEW]";
const INLINE_MARKER = "[COPILOT-POC-INLINE]";
const REVIEW_REF_PATTERN = /\[REVIEW-REF:\s*R(\d+)/i;
const REVIEWABLE_EXTENSIONS = [".java", ".kt", ".groovy", ".properties", ".py", ".js", ".ts", ".tsx", ".cs"];
const IGNORED_EXTENSIONS = [".xml", ".sql", ".yaml", ".yml", ".json"];
const MAX_FINDINGS = 100;
const SUPPRESS_LOW_SEVERITY_MIN_CONFIDENCE = 0.85;

type Finding = { filePath: string; severity: string; title: string; comment: string; line: number; confidence: number };
type ReviewSummary = {
  mergeConfidencePercent: number;
  businessCompliance: string;
  testAssessment: string;
  overview: string;
  workItemAlignment: string;
  topRisks: string[];
};

function isReviewable(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  if (IGNORED_EXTENSIONS.some((ext) => lowered.endsWith(ext))) return false;
  return REVIEWABLE_EXTENSIONS.some((ext) => lowered.endsWith(ext));
}

function sanitizeRepoName(repo: string): string {
  const normalized = repo.replace(/\\/g, "/").replace(/\/+$/, "");
  const name = normalized.split("/").pop() ?? normalized;
  return name.toLowerCase().endsWith(".git") ? name.slice(0, -4) : name;
}

async function loadCodingGuidelines(repoName: string, emit: (line: string) => void): Promise<string> {
  const dir = path.join(docsRoot(), "coding-guidelines");
  const repoFile = path.join(dir, `coding-guidelines-${sanitizeRepoName(repoName)}.md`);
  const genericFile = path.join(dir, "coding-guidelines-generic.md");
  for (const [file, label] of [[repoFile, "repo-specific"], [genericFile, "generic"]] as const) {
    try {
      const content = await fs.readFile(file, "utf-8");
      emit(`[ado] loaded ${label} coding guidelines: ${path.basename(file)}`);
      return content;
    } catch {
      continue;
    }
  }
  emit("[ado] no coding guidelines found (repo-specific or generic) — reviewing without them");
  return "";
}

function buildSystemPrompt(codingGuidelines: string): string {
  const lowSeverityPolicy = `Merge-confidence and low-severity policy:
- Suppression threshold: ${SUPPRESS_LOW_SEVERITY_MIN_CONFIDENCE.toFixed(2)} (${Math.round(SUPPRESS_LOW_SEVERITY_MIN_CONFIDENCE * 100)}%).
- Decide mergeConfidencePercent first based on real blocking risk, business/work-item alignment, test confidence, and visible code correctness.
- Do not lower mergeConfidencePercent because of low-severity observations only.
- If the PR is otherwise safe to merge with mergeConfidencePercent >= ${Math.round(SUPPRESS_LOW_SEVERITY_MIN_CONFIDENCE * 100)}, do not return low-severity findings in the findings array.
- Low-severity findings must never be treated as merge blockers.`;

  return `You are reviewing an Azure DevOps pull request.

Use ONLY the provided PR metadata, linked work items, coding guidelines, unified diffs, and file
snapshots. Reason using both the changed hunks in the diff and the wider full-file context when
available.

Important expectations:
- Avoid false positives that disappear when wider context is considered.
- Prefer findings that are directly tied to changed code.
- Use linked work items to judge business alignment and missing acceptance-criteria coverage. If
  none are available, explicitly state that business compliance could not be fully assessed.
- Be conservative and return high-confidence findings only. Do not invent issues.

${lowSeverityPolicy}

Rules for findings:
- Use the exact file path shown in the file blocks.
- Line numbers must refer to the NEW file version. Prefer changed lines from the diff.
- Do not return style-only or nit comments. findings must be [] when there are none.
- Do not include markdown fences. Output valid JSON only.

Output format:
{
  "summary": {
    "mergeConfidencePercent": 0,
    "businessCompliance": "high|medium|low|unknown",
    "testAssessment": "...",
    "overview": "2-4 sentence overall review summary",
    "workItemAlignment": "...",
    "topRisks": ["..."]
  },
  "findings": [
    { "filePath": "/path/File.java", "severity": "high|medium|low", "title": "...", "comment": "...", "line": 123, "confidence": 0.0 }
  ]
}

## Repository coding guidelines

${codingGuidelines || "No repository-specific or generic coding guidelines were loaded."}`;
}

function buildUserMessage(
  prTitle: string,
  workItems: { id: number; type: string; title: string; description: string; acceptanceCriteria: string }[],
  files: PrFileContext[],
): string {
  const workItemsSection = workItems.length
    ? workItems
        .map((w) => `\n### Work Item ${w.id}\n- Type: ${w.type}\n- Title: ${w.title}\n\n${w.description}\n\nAcceptance Criteria:\n${w.acceptanceCriteria}`)
        .join("\n")
    : "No linked Azure DevOps work items were found.";

  const filesSection = files
    .map(
      (f) =>
        `\n## File: ${f.path}\nChange type: ${f.changeType}\nChanged target lines: ${[...f.changedLines].slice(0, 300).join(", ") || "none detected"}\n\n### Diff\n${f.text || "No unified diff available."}\n\n### New file content\n${f.newContent.slice(0, 60_000)}`,
    )
    .join("\n");

  return `PR title: ${prTitle}\n\n## Linked work items\n${workItemsSection}\n\n## Changed files (${files.length})\n${filesSection}`;
}

function buildInlineComment(finding: Finding, reviewRef: string): string {
  return (
    `${INLINE_MARKER} [REVIEW-REF: ${reviewRef}]\n\n**${finding.title || "Finding"}**\n\n${finding.comment || "n/a"}\n\n` +
    `_Severity: ${finding.severity || "unknown"}, confidence: ${finding.confidence.toFixed(2)}_`
  );
}

function buildSummaryComment(
  prId: string,
  prTitle: string,
  workItems: { id: number; type: string; title: string }[],
  files: PrFileContext[],
  summary: ReviewSummary,
  inlinePosted: number,
  reviewRef: string,
): string {
  const lines = [
    `${REVIEW_MARKER} [REVIEW-REF: ${reviewRef}]`,
    "",
    `Automated review for PR ${prId}`,
    `**Review reference:** ${reviewRef}`,
    `**PR title:** ${prTitle}`,
    `**Merge confidence:** ${Math.max(0, Math.min(100, summary.mergeConfidencePercent))}%`,
    `**Business compliance:** ${summary.businessCompliance || "unknown"}`,
    `**Unit test assessment:** ${summary.testAssessment || "Not provided"}`,
    `**Overall assessment:** ${summary.overview || "No overall assessment returned."}`,
    `**Work item alignment:** ${summary.workItemAlignment || "No work-item alignment summary returned."}`,
    `**Inline comments posted:** ${inlinePosted}`,
    "",
    "**Reviewed files:**",
    ...files.map((f) => `- ${f.path} (changeType=${f.changeType}, changedLines=${f.changedLines.size})`),
    "",
  ];
  lines.push(
    workItems.length
      ? "**Linked work items considered:**"
      : "**Linked work items:** None found. Business compliance could not be fully assessed.",
  );
  for (const w of workItems) lines.push(`- #${w.id} [${w.type}] ${w.title}`);
  if (summary.topRisks.length) {
    lines.push("", "**Top risks:**");
    for (const r of summary.topRisks) lines.push(`- ${r}`);
  }
  return lines.join("\n");
}

export async function runPrReview(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const prUrl = typeof inputs.prUrl === "string" ? inputs.prUrl.trim() : "";
  if (!prUrl) throw new Error("A pull request URL is required.");
  const dryRun = Boolean(inputs.dryRun);
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
  const reviewRef = `R${String(nextReviewNumber + 1).padStart(3, "0")}-PR${prId}-IT${iterationId}`;
  emit(`[ado] review reference: ${reviewRef}`);

  if (!dryRun) {
    emit("[ado] deleting previous overall review comments (keeping inline history)…");
    let deleted = 0;
    for (const t of threads) {
      for (const c of t.comments) {
        if (c.content.includes(REVIEW_MARKER) && !c.content.includes(INLINE_MARKER)) {
          try {
            await deletePrComment(repo, prId, t.id, c.id, adoAuth);
            deleted += 1;
          } catch {
            continue;
          }
        }
      }
    }
    emit(`[ado] deleted ${deleted} previous overall review comment(s)`);
  } else {
    emit("[ado] dry run — skipping deletion of previous overall review comments");
  }

  emit("[ado] loading changed files…");
  const allFiles = await getPrChangedFiles(repo, prId, iterationId, adoAuth);
  const reviewableFiles = allFiles.filter((f) => isReviewable(f.path)).slice(0, 30);
  if (reviewableFiles.length === 0) {
    emit("[done] no reviewable changed files found after applying ignore rules");
    return { webUrl: pr.webUrl };
  }

  emit(`[ado] fetching old/new content + diffs for ${reviewableFiles.length} file(s)…`);
  const fileContexts = await loadPrFileContexts(repo, prId, reviewableFiles, pr.sourceCommit, pr.targetCommit, adoAuth);
  if (fileContexts.length === 0) {
    emit("[done] no reviewable file contexts after filtering");
    return { webUrl: pr.webUrl };
  }

  emit("[ado] loading linked work items…");
  const linkedIds = await getPrLinkedWorkItemIds(repo, prId, adoAuth);
  const workItems: { id: number; type: string; title: string; description: string; acceptanceCriteria: string }[] = [];
  for (const id of linkedIds) {
    try {
      const wi = await getWorkItemRecord(id, adoAuth, false);
      workItems.push({ id: wi.id, type: wi.type, title: wi.title, description: wi.description, acceptanceCriteria: wi.acceptanceCriteria });
    } catch {
      continue;
    }
  }
  emit(`[ado] ${workItems.length} linked work item(s)`);

  emit("[ado] loading repository coding guidelines…");
  const codingGuidelines = await loadCodingGuidelines(repo, emit);

  emit("[copilot] streaming model response …");
  const raw = await runCopilotChat(
    buildSystemPrompt(codingGuidelines),
    buildUserMessage(pr.title, workItems, fileContexts),
    githubToken,
  );

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot response could not be parsed into the expected JSON object.");
  const parsedResponse = loadCopilotJson(jsonStr) as { summary?: Record<string, unknown>; findings?: Record<string, unknown>[] };
  const summaryData = parsedResponse.summary ?? {};
  const summary: ReviewSummary = {
    mergeConfidencePercent: Math.max(0, Math.min(100, Number(summaryData.mergeConfidencePercent ?? 0))),
    businessCompliance: String(summaryData.businessCompliance ?? "unknown"),
    testAssessment: String(summaryData.testAssessment ?? ""),
    overview: String(summaryData.overview ?? ""),
    workItemAlignment: String(summaryData.workItemAlignment ?? ""),
    topRisks: Array.isArray(summaryData.topRisks) ? summaryData.topRisks.map(String) : [],
  };

  let findings: Finding[] = (parsedResponse.findings ?? [])
    .map((f) => ({
      filePath: String(f.filePath ?? ""),
      severity: String(f.severity ?? ""),
      title: String(f.title ?? ""),
      comment: String(f.comment ?? ""),
      line: Number(f.line ?? 0),
      confidence: Number(f.confidence ?? 0),
    }))
    .filter((f) => f.confidence >= 0.7 && f.line > 0);

  findings = findings.filter((f) => {
    const matched = fileContexts.find((fc) => fc.path === f.filePath);
    if (!matched || matched.changedLines.size === 0) return true;
    return matched.changedLines.has(f.line);
  });
  findings.sort((a, b) => b.confidence - a.confidence);
  findings = findings.slice(0, MAX_FINDINGS);
  emit(`[copilot] ${findings.length} finding(s) after filtering`);

  let inlinePosted = 0;
  if (dryRun) {
    emit("[ado] dry run — skipping comment posting");
  } else {
    for (const finding of findings) {
      const matched = fileContexts.find((fc) => fc.path === finding.filePath);
      if (!matched) continue;
      const maxLine = matched.newContent.split("\n").length;
      if (finding.line < 1 || finding.line > maxLine) continue;
      try {
        await postPrInlineComment(repo, prId, matched.path, finding.line, matched.changeTrackingId, iterationId, buildInlineComment(finding, reviewRef), adoAuth);
        inlinePosted += 1;
      } catch {
        continue;
      }
    }
    await postPrGeneralComment(
      repo,
      prId,
      buildSummaryComment(String(prId), pr.title, workItems, fileContexts, summary, inlinePosted, reviewRef),
      adoAuth,
    );
  }

  const blockingFindings = findings.filter((f) => f.severity.toLowerCase() === "high" && f.confidence >= 0.7);
  emit(`[done] review complete — reference ${reviewRef}, ${inlinePosted} inline comment(s) posted, ${blockingFindings.length} blocking`);

  if (blockingFindings.length > 0) {
    return {
      webUrl: pr.webUrl,
      outcome: "blocked",
      blockingCount: blockingFindings.length,
      mergeConfidence: summary.mergeConfidencePercent,
    };
  }

  return { webUrl: pr.webUrl, mergeConfidence: summary.mergeConfidencePercent };
}
