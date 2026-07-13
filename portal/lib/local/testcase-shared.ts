/**
 * Server-only shared test-case creation logic for Test Case Generator and
 * Figma Test Case Generator — both Python originals build the same TCM.Steps
 * XML and Test Case work item shape, differing only in where the test case
 * content comes from (a work item vs a Figma design).
 */

import { createWorkItemRecord, linkWorkItems } from "@/lib/ado-workitem-client";
import { adoTarget } from "@/lib/ado";

export type TestCase = {
  testId: string;
  title: string;
  description: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  severity: string;
  type: string;
};

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildStepsXml(tc: TestCase): string {
  const steps = tc.steps
    .map((step, i) => {
      const isLast = i === tc.steps.length - 1;
      return (
        `<step id="${i + 1}" type="ActionStep">` +
        `<parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${xmlEscape(step)}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>` +
        `<parameterizedString isformatted="true">&lt;DIV&gt;&lt;P&gt;${isLast ? xmlEscape(tc.expectedResult) : ""}&lt;/P&gt;&lt;/DIV&gt;</parameterizedString>` +
        `<description/></step>`
      );
    })
    .join("");
  return `<steps id="0" last="${tc.steps.length}">${steps}</steps>`;
}

function buildDescriptionHtml(tc: TestCase, extraHtml = ""): string {
  let html =
    `<div><strong>Test Type:</strong> ${xmlEscape(tc.type.replace(/_/g, " "))}</div>` +
    `<div><strong>Severity:</strong> ${xmlEscape(tc.severity)}</div>` +
    `<div><strong>Test ID:</strong> ${xmlEscape(tc.testId)}</div>` +
    extraHtml +
    `<br/><div><strong>Description:</strong></div><div>${xmlEscape(tc.description)}</div>`;
  if (tc.preconditions) {
    html += `<br/><div><strong>Preconditions:</strong></div><div>${xmlEscape(tc.preconditions)}</div>`;
  }
  return html;
}

export function parseTestCasesFromJson(parsed: { testCases?: Record<string, unknown>[] }, defaultSeverity = "medium"): TestCase[] {
  return (parsed.testCases ?? []).map((tc) => ({
    testId: String(tc.testId ?? ""),
    title: String(tc.title ?? ""),
    description: String(tc.description ?? ""),
    preconditions: String(tc.preconditions ?? ""),
    steps: Array.isArray(tc.steps) ? tc.steps.map(String) : [],
    expectedResult: String(tc.expectedResult ?? ""),
    severity: String(tc.severity ?? defaultSeverity).toLowerCase(),
    type: String(tc.type ?? "positive"),
  }));
}

export type CreatedTestCaseItem = { type: string; id: number; title: string; parent: number; url: string };

/**
 * Create each test case as an ADO Test Case work item and link it to the
 * parent (work item id when linking to a User Story; undefined when the
 * Figma flow has no linked work item — the case is still created, just
 * unlinked).
 */
export async function createTestCases(
  cases: TestCase[],
  parentWorkItemId: number | undefined,
  auth: string,
  emit: (line: string) => void,
  extraDescriptionHtml: (tc: TestCase) => string = () => "",
): Promise<CreatedTestCaseItem[]> {
  const { org, project } = adoTarget();
  const items: CreatedTestCaseItem[] = [];

  for (const tc of cases) {
    const created = await createWorkItemRecord(
      {
        type: "Test Case",
        title: `${tc.testId}: ${tc.title}`,
        descriptionHtml: buildDescriptionHtml(tc, extraDescriptionHtml(tc)),
        extraFields: { "Microsoft.VSTS.TCM.Steps": buildStepsXml(tc) },
      },
      auth,
    );
    if (parentWorkItemId) {
      await linkWorkItems(created.id, parentWorkItemId, "System.LinkTypes.Related", auth, "Test case generated for this work item");
    }
    emit(`[ado] created Test Case #${created.id}: ${created.title}`);
    items.push({
      type: "Test Case",
      id: created.id,
      title: created.title,
      parent: parentWorkItemId ?? 0,
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/${created.id}`,
    });
  }
  return items;
}
