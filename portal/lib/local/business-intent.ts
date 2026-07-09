/**
 * Server-only Business Intent Builder — direct-REST port of
 * ado_copilot_business_intent_item_creation.py. Takes a plain-language
 * business intent plus delivery metadata, asks Copilot for a complete
 * Epic -> Feature -> User Story plan (one chat call, JSON response), then
 * creates the whole hierarchy in Azure DevOps.
 */

import { runCopilotChat, runCopilotPrompt } from "@/lib/copilot";
import {
  addWorkItemComment,
  createWorkItemRecord,
  type CreatedWorkItemRecord,
} from "@/lib/ado-workitem-client";
import { adoTarget } from "@/lib/ado";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import {
  MAX_CHILDREN,
  acceptanceCriteriaTextToAdoHtml,
  cleanupTitle,
  descriptionTextToAdoHtml,
  discoverInstructionFile,
  extractJsonObject,
  loadCopilotJson,
  normalizeAcceptanceCriteriaText,
  normalizeDescriptionText,
  resolveCallerIdentity,
} from "@/lib/local/breakdown-shared";

const AREA_OF_VALUE_FIELD = "VFDigitalAgile.AreaofValue";
const DEFAULT_AREA_OF_VALUE = "Business";
const DEFAULT_WORK_ITEM_TAGS = "AI-Breakdowns";
const BUSINESS_INTENT_MARKER = "[COPILOT-BUSINESS-INTENT]";

type StorySpec = { title: string; description: string; acceptanceCriteria: string };
type FeatureSpec = { title: string; description: string; acceptanceCriteria: string; userStories: StorySpec[] };
type EpicSpec = { title: string; description: string; acceptanceCriteria: string };
type BusinessIntentPlan = { parentType: string; epic: EpicSpec; features: FeatureSpec[] };

function buildInstructionSystemPrompt(teamGuidelines: string): string {
  return `You are converting a business intent into a complete Azure DevOps Epic hierarchy.

Read the business intent and team guidelines provided by the user. The business intent is the
source of truth. Use the team guidelines below as the mandatory Epic, Feature, and User Story
quality and ownership guideline. Do not invent unsupported business scope. Keep assumptions
conservative and explicit. Return valid JSON only, without markdown fences or explanatory text.

Rules:
- Source type is Business Intent. There is no existing Azure DevOps parent work item.
- Generate exactly one new Epic.
- Generate child Features under the Epic.
- Generate child User Stories under every Feature.
- The Epic title must be concise, business-focused, and derived from the intent.
- The Epic description must contain structured sections for Background, Problem or Opportunity, Solution or Outcome, Business Value, Scope, Out of Scope, and Benefit Hypothesis. Include assumptions or dependencies only when supported.
- Epic acceptance criteria must define high-level, testable completion outcomes without repeating every child story.
- Every Feature must represent one distinct, meaningful business capability and contain at least one User Story.
- Feature descriptions must use readable business sections and clearly state scope boundaries.
- Every User Story must be independently understandable, delivery-ready, testable, and traceable to its Feature and the source intent.
- Use the selected team's naming, ownership, slicing, rollout, feature-flag, analytics, accessibility, and quality rules from the team guidelines below.
- Preserve the business intent and keep the hierarchy MVP-first. Do not add speculative future scope.
- Acceptance criteria must use separate Gherkin scenarios or clear testable completion scenarios appropriate to the item type.
- Keep the total number of Features plus User Stories within ${MAX_CHILDREN} items.
- All newline characters inside JSON string values must be escaped as \\n.

Output JSON schema:
{
  "parentType": "Business Intent",
  "epic": { "title": "...", "description": "...", "acceptanceCriteria": "..." },
  "features": [
    {
      "title": "...", "description": "...", "acceptanceCriteria": "...",
      "userStories": [ { "title": "...", "description": "...", "acceptanceCriteria": "..." } ]
    }
  ]
}

## Team guidelines (mandatory)

${teamGuidelines}`;
}

function parseBusinessIntentPlan(raw: string): BusinessIntentPlan {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot output did not contain a JSON object");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsing untrusted model output
  const root = loadCopilotJson(jsonStr) as any;
  const epicRoot = root.epic ?? {};

  const features: FeatureSpec[] = (root.features ?? []).map((f: Record<string, unknown>) => ({
    title: cleanupTitle(String(f.title ?? "") || "Untitled Feature"),
    description: normalizeDescriptionText(String(f.description ?? "")),
    acceptanceCriteria: normalizeAcceptanceCriteriaText(String(f.acceptanceCriteria ?? "")),
    userStories: ((f.userStories as Record<string, unknown>[]) ?? []).map((s) => ({
      title: cleanupTitle(String(s.title ?? "") || "Untitled User Story"),
      description: normalizeDescriptionText(String(s.description ?? "")),
      acceptanceCriteria: normalizeAcceptanceCriteriaText(String(s.acceptanceCriteria ?? "")),
    })),
  }));

  const plan: BusinessIntentPlan = {
    parentType: String(root.parentType ?? "Business Intent").trim(),
    epic: {
      title: cleanupTitle(String(epicRoot.title ?? "") || "Untitled Epic"),
      description: normalizeDescriptionText(String(epicRoot.description ?? "")),
      acceptanceCriteria: normalizeAcceptanceCriteriaText(String(epicRoot.acceptanceCriteria ?? "")),
    },
    features,
  };
  validateBusinessIntentPlan(plan);
  return plan;
}

function validateBusinessIntentPlan(plan: BusinessIntentPlan): void {
  if (!["business intent", "epic"].includes(plan.parentType.toLowerCase())) {
    throw new Error(`Business Intent output parentType must be 'Business Intent' or 'Epic'. Received: ${plan.parentType}`);
  }
  if (!plan.epic.title.trim()) throw new Error("Business Intent output must include epic.title");
  if (!plan.epic.description.trim()) throw new Error("Business Intent output must include epic.description");
  if (!plan.epic.acceptanceCriteria.trim()) throw new Error("Business Intent output must include epic.acceptanceCriteria");
  if (plan.features.length === 0) throw new Error("Business Intent output must include at least one Feature");

  let total = 0;
  const seenTitles = new Set<string>();
  for (const feature of plan.features) {
    total += 1;
    if (!feature.description.trim()) throw new Error(`Feature '${feature.title}' must include a description`);
    if (!feature.acceptanceCriteria.trim()) throw new Error(`Feature '${feature.title}' must include acceptance criteria`);
    if (feature.userStories.length === 0) throw new Error(`Feature '${feature.title}' must include at least one User Story`);
    const featureKey = feature.title.toLowerCase();
    if (seenTitles.has(featureKey)) throw new Error(`Duplicate generated title: ${feature.title}`);
    seenTitles.add(featureKey);

    for (const story of feature.userStories) {
      total += 1;
      if (!story.description.trim()) throw new Error(`User Story '${story.title}' must include a description`);
      if (!story.acceptanceCriteria.trim()) throw new Error(`User Story '${story.title}' must include acceptance criteria`);
      const storyKey = story.title.toLowerCase();
      if (seenTitles.has(storyKey)) throw new Error(`Duplicate generated title: ${story.title}`);
      seenTitles.add(storyKey);
    }
  }
  if (total > MAX_CHILDREN) throw new Error(`Generated hierarchy contains ${total} child items. Max is ${MAX_CHILDREN}.`);
}

async function parsePlanWithRepair(raw: string, githubToken: string, emit: (line: string) => void): Promise<BusinessIntentPlan> {
  try {
    return parseBusinessIntentPlan(raw);
  } catch (firstError) {
    emit("[copilot] plan failed validation — asking Copilot to repair it once");
    const repairPrompt =
      `The following response was supposed to be a Business Intent JSON plan but failed validation: ${
        firstError instanceof Error ? firstError.message : firstError
      }\n\nRepair or regenerate it. Return valid JSON only using the same schema, starting with { and ending with }. ` +
      `Do not add markdown fences or prose. Escape newlines inside JSON strings.\n\nPrevious response:\n${raw.slice(0, 8000)}`;
    const repaired = await runCopilotPrompt(repairPrompt, githubToken);
    try {
      return parseBusinessIntentPlan(repaired);
    } catch (secondError) {
      throw new Error(
        `Copilot did not return a valid Business Intent plan after one repair attempt. First error: ${
          firstError instanceof Error ? firstError.message : firstError
        }. Retry error: ${secondError instanceof Error ? secondError.message : secondError}`,
      );
    }
  }
}

async function createHierarchy(
  plan: BusinessIntentPlan,
  areaPath: string,
  iterationPath: string,
  assignedTo: string | null,
  auth: string,
  emit: (line: string) => void,
): Promise<{ epic: CreatedWorkItemRecord; created: CreatedWorkItemRecord[] }> {
  const epic = await createWorkItemRecord(
    {
      type: "Epic",
      title: plan.epic.title,
      descriptionHtml: descriptionTextToAdoHtml(plan.epic.description),
      acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(plan.epic.acceptanceCriteria),
      areaPath,
      iterationPath,
      tags: DEFAULT_WORK_ITEM_TAGS,
      extraFields: { [AREA_OF_VALUE_FIELD]: DEFAULT_AREA_OF_VALUE, ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
    },
    auth,
  );
  emit(`[ado] created Epic ${epic.id}: ${epic.title}`);

  const created: CreatedWorkItemRecord[] = [];
  for (const feature of plan.features) {
    const createdFeature = await createWorkItemRecord(
      {
        type: "Feature",
        title: feature.title,
        descriptionHtml: descriptionTextToAdoHtml(feature.description),
        acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(feature.acceptanceCriteria),
        areaPath,
        iterationPath,
        tags: DEFAULT_WORK_ITEM_TAGS,
        extraFields: { [AREA_OF_VALUE_FIELD]: DEFAULT_AREA_OF_VALUE, ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
        parentId: epic.id,
      },
      auth,
    );
    created.push(createdFeature);
    emit(`[ado] created Feature ${createdFeature.id}: ${createdFeature.title}`);

    for (const story of feature.userStories) {
      const createdStory = await createWorkItemRecord(
        {
          type: "User Story",
          title: story.title,
          descriptionHtml: descriptionTextToAdoHtml(story.description),
          acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(story.acceptanceCriteria),
          areaPath,
          iterationPath,
          tags: DEFAULT_WORK_ITEM_TAGS,
          extraFields: { [AREA_OF_VALUE_FIELD]: DEFAULT_AREA_OF_VALUE, ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
          parentId: createdFeature.id,
        },
        auth,
      );
      created.push(createdStory);
      emit(`[ado] created User Story ${createdStory.id}: ${createdStory.title}`);
    }
  }

  return { epic, created };
}

function renderEpicComment(
  epic: CreatedWorkItemRecord,
  businessIntent: string,
  areaPath: string,
  iterationPath: string,
  createdItems: CreatedWorkItemRecord[],
  assignedTo: string | null,
): string {
  const lines = [
    BUSINESS_INTENT_MARKER,
    "",
    "Source: Business Intent Builder",
    `Created Epic: ${epic.id} - ${epic.title}`,
    `Area Path: ${areaPath}`,
    `Iteration Path: ${iterationPath}`,
  ];
  if (assignedTo) lines.push(`Assigned created items to: ${assignedTo}`);
  lines.push("", "Business intent:", businessIntent.slice(0, 3000), "", "Created child items:");
  for (const item of createdItems) lines.push(`- ${item.type} ${item.id}: ${item.title} (parent ${item.parentId})`);
  return lines.join("\n").trim().slice(0, 12000);
}

export async function runBusinessIntent(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const businessIntent = typeof inputs.businessIntent === "string" ? inputs.businessIntent.trim() : "";
  const areaPath = typeof inputs.areaPath === "string" ? inputs.areaPath.trim() : "";
  const iterationPath = typeof inputs.iterationPath === "string" ? inputs.iterationPath.trim() : "";
  const teamName = (typeof inputs.teamName === "string" ? inputs.teamName.trim() : "") || "generic";
  const addComment = inputs.addGeneratedHierarchyComment !== false;
  const dryRun = Boolean(inputs.dryRun);

  if (!businessIntent) throw new Error("A business intent is required.");
  if (!areaPath) throw new Error("Area path is required.");
  if (!iterationPath) throw new Error("Iteration path is required.");

  emit(`[setup] node ready · direct-REST Copilot · team=${teamName}`);

  const instructionFile = await discoverInstructionFile(teamName, "epic-breakdown");
  emit(`[bundle] assembled instructions + business intent + team guidelines (${instructionFile.path.split("/").pop()})`);

  const systemPrompt = buildInstructionSystemPrompt(instructionFile.content);
  const userMessage = [
    `Area Path: ${areaPath}`,
    `Iteration Path: ${iterationPath}`,
    `Team: ${teamName}`,
    `Maximum generated child items: ${MAX_CHILDREN}`,
    "",
    "Business Intent:",
    businessIntent,
  ].join("\n");

  emit("[copilot] streaming model response …");
  const raw = await runCopilotChat(systemPrompt, userMessage, githubToken);

  const plan = await parsePlanWithRepair(raw, githubToken, emit);
  emit(`[copilot] plan: 1 Epic, ${plan.features.length} Feature(s), ${plan.features.reduce((n, f) => n + f.userStories.length, 0)} User Story(ies)`);

  if (dryRun) {
    emit("[done] dry run — no work items created");
    return {
      dryRun: true,
      createdCount: 1 + plan.features.length + plan.features.reduce((n, f) => n + f.userStories.length, 0),
      items: [],
    };
  }

  const { org } = adoTarget();
  const assignedTo = await resolveCallerIdentity(org, adoAuth);
  if (assignedTo) emit(`[ado] assigning created items to ${assignedTo}`);

  const { epic, created } = await createHierarchy(plan, areaPath, iterationPath, assignedTo, adoAuth, emit);

  if (addComment) {
    await addWorkItemComment(epic.id, renderEpicComment(epic, businessIntent, areaPath, iterationPath, created, assignedTo), adoAuth);
    emit(`[ado] posted summary comment on Epic ${epic.id}`);
  }

  const epicUrl = `https://dev.azure.com/${org}/${adoTarget().project}/_workitems/edit/${epic.id}`;
  emit(`[done] created ${1 + created.length} work item(s)`);

  return {
    webUrl: epicUrl,
    dryRun: false,
    createdCount: 1 + created.length,
    items: [
      { type: "Epic", id: epic.id, title: epic.title, parent: 0, url: epicUrl },
      ...created.map((c) => ({
        type: c.type,
        id: c.id,
        title: c.title,
        parent: c.parentId,
        url: `https://dev.azure.com/${org}/${adoTarget().project}/_workitems/edit/${c.id}`,
      })),
    ],
  };
}
