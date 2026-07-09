/**
 * Server-only Test Case & Automation Generator — direct-REST port of
 * ado_testcase_generator.py. Generates P1/Critical test cases from a work
 * item's description/acceptance criteria (one Copilot call), then creates
 * them as ADO Test Case work items linked back to the source item.
 */

import { runCopilotPrompt } from "@/lib/copilot";
import { getWorkItemRecord } from "@/lib/ado-workitem-client";
import { adoTarget } from "@/lib/ado";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";
import { createTestCases, parseTestCasesFromJson } from "@/lib/local/testcase-shared";

const MAX_TEST_CASES = 20;

function buildPrompt(workItemId: number, type: string, title: string, description: string, acceptanceCriteria: string): string {
  return `You are a QA expert. Generate ONLY CRITICAL/P1 severity test cases for the following user story.

USER STORY ID: ${workItemId}
TYPE: ${type}
TITLE: ${title}

DESCRIPTION:
${description}

ACCEPTANCE CRITERIA:
${acceptanceCriteria}

CRITICAL REQUIREMENT: Generate ONLY critical/P1 severity test cases that cover:
1. All critical acceptance criteria
2. Critical positive scenarios (happy path - must work)
3. Critical negative scenarios (must handle errors correctly)
4. Critical edge cases and boundary conditions that could cause system failure
5. Critical data validation scenarios

Filtering Guidelines:
- Focus ONLY on test cases that are CRITICAL to the functionality
- Exclude nice-to-have or low-impact scenarios
- Each test case MUST have severity = "critical"
- Only include test cases that test essential business logic

For each test case, provide a unique test ID (TC_001, TC_002, ...), a clear title, a detailed
description, preconditions, step-by-step test steps, the expected result, severity (always
"critical"), and type ("positive", "negative", or "edge_case").

Important rules:
- Do NOT refuse just because content may be partial.
- EVERY test case severity MUST be set to "critical". DO NOT include high/medium/low.
- DO NOT include explanations outside JSON. DO NOT wrap the output in markdown fences.
- Output must be a valid JSON object and nothing else.

Output format:
{
  "workItemId": ${workItemId},
  "workItemTitle": "${title.replace(/"/g, '\\"')}",
  "summary": "brief summary of CRITICAL test strategy",
  "testCases": [
    {
      "testId": "TC_001",
      "title": "...",
      "description": "...",
      "preconditions": "...",
      "steps": ["Step 1: ...", "Step 2: ..."],
      "expectedResult": "...",
      "severity": "critical",
      "type": "positive|negative|edge_case"
    }
  ]
}

Generate ${MAX_TEST_CASES} CRITICAL test cases only. Be thorough and practical.`;
}

export async function runTestCaseGenerator(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const workItemUrlOrId = typeof inputs.workItemUrl === "string" ? inputs.workItemUrl.trim() : "";
  if (!workItemUrlOrId) throw new Error("A work item URL or ID is required.");
  const idMatch = workItemUrlOrId.match(/(\d+)\s*$/) ?? workItemUrlOrId.match(/(?:_workitems\/edit|workitem=|workItems\/)(\d+)/i);
  const workItemId = Number((idMatch?.[1] ?? workItemUrlOrId).trim());
  if (!Number.isFinite(workItemId)) throw new Error(`Could not resolve a work item id from: ${workItemUrlOrId}`);

  emit(`[ado] fetching work item #${workItemId}…`);
  const workItem = await getWorkItemRecord(workItemId, adoAuth, false);
  emit(`[ado] Work Item: #${workItem.id} [${workItem.type}] ${workItem.title}`);
  emit(`[ado]   - Has Description: ${Boolean(workItem.description.trim())}`);
  emit(`[ado]   - Has Acceptance Criteria: ${Boolean(workItem.acceptanceCriteria.trim())}`);

  emit("[copilot] building test case generation prompt (P1/CRITICAL only)…");
  const prompt = buildPrompt(workItem.id, workItem.type, workItem.title, workItem.description, workItem.acceptanceCriteria);

  emit("[copilot] streaming model response …");
  const raw = await runCopilotPrompt(prompt, githubToken);

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot response could not be parsed into the expected JSON object.");
  const parsed = loadCopilotJson(jsonStr) as { testCases?: Record<string, unknown>[] };
  const allCases = parseTestCasesFromJson(parsed);
  const critical = allCases.filter((tc) => tc.severity === "critical");
  emit(`[copilot] generated ${allCases.length} test case(s), ${critical.length} P1/CRITICAL after filtering`);

  const items = await createTestCases(critical, workItem.id, adoAuth, emit);
  emit(`[done] created ${items.length} test case(s)`);

  const { org, project } = adoTarget();
  return {
    webUrl: `https://dev.azure.com/${org}/${project}/_workitems/edit/${workItem.id}`,
    createdCount: items.length,
    items,
  };
}
