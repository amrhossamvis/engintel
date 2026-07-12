/**
 * Server-only Figma Test Case Generator — direct-REST port of
 * ado-figma_testcase_generator.py. Fetches a Figma design's frames/comments,
 * generates P1/Critical UI/UX test cases (one Copilot call), then creates
 * them as ADO Test Case work items, optionally linked to a work item.
 */

import { runCopilotPrompt } from "@/lib/copilot";
import { getWorkItemRecord } from "@/lib/ado-workitem-client";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";
import { createTestCases, parseTestCasesFromJson } from "@/lib/local/testcase-shared";

const MAX_TEST_CASES = 20;
const MAX_RETRIES_FILE = 4;
const MAX_RETRIES_COMMENTS = 3;

type FigmaFrame = { name: string; type: string; description: string; components: string[]; interactions: string[] };

function extractFigmaFileKey(url: string): string {
  const m = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!m) throw new Error(`Could not extract Figma file key from URL: ${url}`);
  return m[1];
}

async function figmaGet(url: string, token: string, maxRetries: number, emit: (line: string) => void): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: { "X-Figma-Token": token } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < maxRetries - 1) {
      const waitSeconds = 60 * (attempt + 1);
      emit(`[figma] rate limit hit — waiting ${waitSeconds}s (retry ${attempt + 2}/${maxRetries})…`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
      continue;
    }
    if (res.status === 429) return null;
    throw new Error(`Figma API failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return null;
}

function extractFrames(node: Record<string, unknown>, frames: FigmaFrame[], depth = 0): void {
  if (depth > 5) return;
  const type = String(node.type ?? "");
  const name = String(node.name ?? "");
  if (["FRAME", "COMPONENT", "COMPONENT_SET"].includes(type)) {
    const components: string[] = [];
    for (const child of (node.children as Record<string, unknown>[]) ?? []) {
      const childName = String(child.name ?? "");
      const childType = String(child.type ?? "");
      if (childName && childType) components.push(`${childType}: ${childName}`);
    }
    const interactions: string[] = [];
    for (const reaction of (node.reactions as Record<string, unknown>[]) ?? []) {
      const actionType = String((reaction.action as Record<string, unknown> | undefined)?.type ?? "");
      if (actionType) interactions.push(`Action: ${actionType}`);
    }
    frames.push({
      name,
      type,
      description: String(node.description ?? ""),
      components: components.slice(0, 20),
      interactions: interactions.slice(0, 10),
    });
  }
  for (const child of (node.children as Record<string, unknown>[]) ?? []) extractFrames(child, frames, depth + 1);
}

function buildPrompt(
  fileName: string,
  lastModified: string,
  frames: FigmaFrame[],
  designNotes: string,
  workItem: { id: number; title: string; description: string; acceptanceCriteria: string } | null,
): string {
  const framesSection = frames
    .slice(0, 20)
    .map((f) => {
      let s = `\n### Frame: ${f.name}\nType: ${f.type}\n`;
      if (f.description) s += `Description: ${f.description}\n`;
      if (f.components.length) s += "Components:\n" + f.components.slice(0, 10).map((c) => `  - ${c}`).join("\n") + "\n";
      if (f.interactions.length) s += "Interactions:\n" + f.interactions.map((i) => `  - ${i}`).join("\n") + "\n";
      return s;
    })
    .join("");

  const workItemSection = workItem
    ? `\nLINKED USER STORY:\nID: ${workItem.id}\nTitle: ${workItem.title}\nDescription: ${workItem.description}\nAcceptance Criteria: ${workItem.acceptanceCriteria}\n`
    : "";

  return `You are a QA expert specializing in UI/UX testing. Generate ONLY CRITICAL/P1 severity test cases for the following Figma design.

FIGMA DESIGN:
File: ${fileName}
Last Modified: ${lastModified}

DESIGN FRAMES/SCREENS:
${framesSection}

DESIGN NOTES/COMMENTS:
${designNotes || "No design notes available"}
${workItemSection}

Generate CRITICAL/P1 UI/UX test cases that cover:
1. Visual design accuracy (layout, spacing, alignment, colors, fonts)
2. Component functionality (buttons, inputs, dropdowns, etc.)
3. User interactions (clicks, navigation, form submission)
4. Responsive design (different screen sizes)
5. Accessibility (screen readers, keyboard navigation, ARIA labels)
6. Visual consistency across screens
7. Error states and validation messages
8. Loading states and animations

For each test case, provide a unique test ID (TC_UI_001, ...), a clear title, a detailed
description, preconditions, step-by-step test steps, the expected result, severity (always
"critical"), and type ("ui", "functional", "visual", "accessibility", or "responsive").

Important rules:
- EVERY test case severity MUST be set to "critical". DO NOT include high/medium/low.
- DO NOT include explanations outside JSON. DO NOT wrap the output in markdown fences.
- Output must be a valid JSON object and nothing else.

Output format:
{
  "workItemId": ${workItem?.id ?? 0},
  "workItemTitle": "${(workItem?.title ?? fileName).replace(/"/g, '\\"')}",
  "figmaFileName": "${fileName.replace(/"/g, '\\"')}",
  "summary": "brief summary of critical UI/UX test strategy",
  "testCases": [
    {
      "testId": "TC_UI_001",
      "title": "...",
      "description": "...",
      "preconditions": "...",
      "steps": ["Step 1: ...", "Step 2: ..."],
      "expectedResult": "...",
      "severity": "critical",
      "type": "ui|functional|visual|accessibility|responsive"
    }
  ]
}

Generate ${MAX_TEST_CASES} CRITICAL UI/UX test cases. Be thorough and visual-specific.`;
}

export async function runFigmaTestCaseGenerator(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const figmaUrl = typeof inputs.figmaUrl === "string" ? inputs.figmaUrl.trim() : "";
  if (!figmaUrl) throw new Error("A Figma frame URL is required.");
  const figmaToken = typeof inputs.figmaToken === "string" ? inputs.figmaToken.trim() : "";
  if (!figmaToken) throw new Error("A Figma personal access token is required.");
  const workItemUrlOrId = typeof inputs.workItemUrl === "string" ? inputs.workItemUrl.trim() : "";

  const fileKey = extractFigmaFileKey(figmaUrl);
  emit(`[figma] file key: ${fileKey}`);

  emit("[figma] fetching design file…");
  const fileData = await figmaGet(`https://api.figma.com/v1/files/${fileKey}`, figmaToken, MAX_RETRIES_FILE, emit);
  if (!fileData) throw new Error("Figma API rate limit exceeded — could not fetch the design file after retries.");
  const fileName = String(fileData.name ?? "Unnamed Design");
  const lastModified = String(fileData.lastModified ?? "");
  emit(`[figma] file: ${fileName}`);

  const frames: FigmaFrame[] = [];
  extractFrames((fileData.document as Record<string, unknown>) ?? {}, frames);
  emit(`[figma] found ${frames.length} frame(s)/screen(s)`);

  emit("[figma] fetching comments…");
  const commentsData = await figmaGet(`https://api.figma.com/v1/files/${fileKey}/comments`, figmaToken, MAX_RETRIES_COMMENTS, emit);
  const comments = (commentsData?.comments as Record<string, unknown>[] | undefined) ?? [];
  const designNotes = comments
    .slice(0, 10)
    .map((c) => `- ${String((c.user as Record<string, unknown> | undefined)?.handle ?? "Unknown")}: ${String(c.message ?? "")}`)
    .join("\n");

  let workItem: { id: number; title: string; description: string; acceptanceCriteria: string } | null = null;
  if (workItemUrlOrId) {
    const idMatch = workItemUrlOrId.match(/(\d+)\s*$/) ?? workItemUrlOrId.match(/(?:_workitems\/edit|workitem=|workItems\/)(\d+)/i);
    const workItemId = Number((idMatch?.[1] ?? workItemUrlOrId).trim());
    if (Number.isFinite(workItemId)) {
      emit(`[ado] fetching linked work item #${workItemId}…`);
      const wi = await getWorkItemRecord(workItemId, adoAuth, false);
      workItem = { id: wi.id, title: wi.title, description: wi.description, acceptanceCriteria: wi.acceptanceCriteria };
      emit(`[ado] Work Item: #${wi.id} [${wi.type}] ${wi.title}`);
    }
  } else {
    emit("[figma] no work item provided — test cases will be created unlinked");
  }

  emit("[copilot] building UI/UX test case generation prompt (P1/CRITICAL only)…");
  const prompt = buildPrompt(fileName, lastModified, frames, designNotes, workItem);

  emit("[copilot] streaming model response …");
  const raw = await runCopilotPrompt(prompt, githubToken);

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot response could not be parsed into the expected JSON object.");
  const parsed = loadCopilotJson(jsonStr) as { testCases?: Record<string, unknown>[] };
  const allCases = parseTestCasesFromJson(parsed, "critical");
  const critical = allCases.filter((tc) => tc.severity === "critical");
  emit(`[copilot] generated ${allCases.length} test case(s), ${critical.length} P1/CRITICAL after filtering`);

  const items = await createTestCases(critical, workItem?.id, adoAuth, emit, () =>
    `<br/><div><strong>Figma Design:</strong> <a href="${figmaUrl}">${figmaUrl}</a></div>`,
  );
  emit(`[done] created ${items.length} test case(s)`);

  return {
    webUrl: figmaUrl,
    createdCount: items.length,
    items,
  };
}
