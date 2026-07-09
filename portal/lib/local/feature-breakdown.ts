/**
 * Server-only Feature/Epic Breakdown + User Story Roll-up — direct-REST port
 * of ado_copilot_workitem_breakdown.py. One Copilot chat call generates the
 * breakdown (or roll-up) plan from the parent work item, discussion history,
 * existing children, parent Epic background, PO recommendations, and any
 * attached .docx design documents inlined directly into the message, then
 * creates (or re-parents) the resulting work items in Azure DevOps.
 *
 * Supported input work item types, mirroring the Python original:
 * - Epic: creates child Features, each with child User Stories.
 * - Feature: creates child User Stories only (skips titles that already
 *   exist as children, to avoid duplicating a re-run).
 * - User Story: reads the input story plus every linked User Story, creates
 *   a new Epic + Feature that summarize them, and re-parents the existing
 *   stories under the new Feature ("roll-up").
 */

import { runCopilotChat } from "@/lib/copilot";
import { extractDocxText } from "@/lib/docx";
import { adoTarget, parseWorkItemId } from "@/lib/ado";
import {
  addWorkItemComment,
  createWorkItemRecord,
  downloadAttachment,
  getDiscussionHistory,
  getWorkItemRecord,
  relinkWorkItemParent,
  workItemIdFromRelationUrl,
  type CreatedWorkItemRecord,
  type WorkItemRecord,
} from "@/lib/ado-workitem-client";
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

const BREAKDOWN_MARKER = "[COPILOT-BREAKDOWN]";
const ROLLUP_MARKER = "[COPILOT-ROLLUP]";
const MAX_COMMENT_CHARS = 12_000;
const MAX_PARENT_HISTORY_CHARS = 15_000;
const AREA_OF_VALUE_FIELD = "VFDigitalAgile.AreaofValue";
const HIERARCHY_FORWARD = "System.LinkTypes.Hierarchy-Forward";
const HIERARCHY_REVERSE = "System.LinkTypes.Hierarchy-Reverse";
const DOCX_DESIGN_KEYWORDS = ["design", "blueprint", "blue print", "lld", "solution", "architecture", "technical", "spec", "specification"];
const LAUNCH_DARKLY_KEYWORDS = [
  "launchdarkly",
  "launch darkly",
  "feature flag",
  "feature-flag",
  "featureflag",
  "rollout",
  "targeting",
  "targeted audience",
  "percentage of users",
  "variant allocation",
];
const BUSINESS_TERMS = [
  "journey", "experience", "screen", "page", "checkout", "purchase", "redeem",
  "enrol", "enroll", "view", "manage", "change", "submit", "update", "select",
  "confirm", "content", "offer", "variant", "eligibility", "customer", "user",
  "segment", "flow", "card", "step", "entry point", "redirection", "navigation",
];

type StorySpec = { title: string; description: string; acceptanceCriteria: string };
type FeatureSpec = { title: string; description: string; acceptanceCriteria: string; userStories: StorySpec[] };
type EpicSpec = { title: string; description: string; acceptanceCriteria: string };
type BreakdownPlan = { parentType: "epic" | "feature"; parentTitle: string; features: FeatureSpec[]; userStories: StorySpec[] };
type StoryRollupPlan = { parentType: string; sourceStoryTitle: string; epic: EpicSpec; feature: FeatureSpec };
type LinkedItem = { id: number; type: string; title: string; parentId: number };
type DocxAttachment = { filename: string; text: string };
type EmitFn = (line: string) => void;

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "\n... [truncated]";
}

function normalizeTitleForCompare(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

// --- LaunchDarkly soft-enforcement + description fallback -------------------------

function storyMentionsFlag(story: StorySpec): boolean {
  const haystack = `${story.title} ${story.description} ${story.acceptanceCriteria}`.toLowerCase();
  return LAUNCH_DARKLY_KEYWORDS.some((k) => haystack.includes(k));
}

function storyIsFlagOnly(story: StorySpec): boolean {
  if (!storyMentionsFlag(story)) return false;
  const haystack = `${story.title} ${story.description} ${story.acceptanceCriteria}`.toLowerCase();
  const score = BUSINESS_TERMS.filter((t) => haystack.includes(t)).length;
  return score <= 1;
}

function mergeStoryIntoFirst(first: StorySpec, extra: StorySpec): StorySpec {
  const description = extra.description.trim()
    ? [first.description.trim(), extra.description.trim()].filter(Boolean).join("\n\n")
    : first.description;
  const acceptanceCriteria = extra.acceptanceCriteria.trim()
    ? [first.acceptanceCriteria.trim(), extra.acceptanceCriteria.trim()].filter(Boolean).join("\n\n")
    : first.acceptanceCriteria;
  return { ...first, description, acceptanceCriteria };
}

function poDisablesLaunchDarkly(poNotes: string): boolean {
  const notes = (poNotes || "").toLowerCase();
  if (!notes) return false;
  const patterns = [
    /do not add\s+launch\s*darkly/i, /don't add\s+launch\s*darkly/i, /no\s+launch\s*darkly/i,
    /without\s+launch\s*darkly/i, /exclude\s+launch\s*darkly/i,
    /do not add\s+feature flag/i, /don't add\s+feature flag/i, /no\s+feature flag/i,
    /without\s+feature flag/i, /exclude\s+feature flag/i,
  ];
  return patterns.some((p) => p.test(notes));
}

function softEnforceLaunchDarklyRules(stories: StorySpec[], scopeName: string, poNotes: string, emit: EmitFn): StorySpec[] {
  if (!stories.length) return stories;
  const ldDisabled = poDisablesLaunchDarkly(poNotes);
  if (ldDisabled) emit(`[breakdown] LaunchDarkly enforcement skipped for '${scopeName}' — PO recommendations explicitly disabled it`);

  const result = [stories[0]];
  for (let i = 1; i < stories.length; i++) {
    const story = stories[i];
    if (storyIsFlagOnly(story) && !ldDisabled) {
      result[0] = mergeStoryIntoFirst(result[0], story);
      emit(`[breakdown] merged standalone LaunchDarkly-like story '${story.title}' into the first story under '${scopeName}'`);
      continue;
    }
    result.push(story);
  }
  return result;
}

function ensureStoryDescription(story: StorySpec, scopeName: string, emit: EmitFn): StorySpec {
  if (story.description.trim()) return story;
  const fallbackTitle = story.title.trim() || "this story";
  const description = normalizeDescriptionText(
    `As a user\nI want ${fallbackTitle.toLowerCase()}\nSo that the intended feature scope can be delivered\n\n` +
      `Business Value:\n- Supports delivery of the agreed scope for ${scopeName}\n\n` +
      `Background / Context:\n- Derived from the parent work item and generated breakdown output\n\n` +
      `Scope:\n- Implement the story outcome described by the title\n\n` +
      `Accessibility:\n- Not explicitly identified in parent context`,
  );
  emit(`[breakdown] story '${story.title}' under '${scopeName}' had no description — generated a fallback`);
  return { ...story, description };
}

function softenStoryDescriptions(stories: StorySpec[], scopeName: string, emit: EmitFn): StorySpec[] {
  return stories.map((s) => ensureStoryDescription(s, scopeName, emit));
}

// --- Copilot system prompts ---------------------------------------------------

const EPIC_RULES = `You are generating a breakdown plan for an Azure DevOps Epic.

Use ONLY the parent work item details, acceptance criteria, comments/history, team guidelines, and PO recommendations provided by the user. Do not invent unsupported business scope. Do not include markdown fences. Output valid JSON only.

Rules:
- Parent type is Epic.
- Create child Features first.
- For each child Feature, create child User Stories.
- Every Feature must represent a meaningful business capability slice.
- Every User Story must belong to exactly one created Feature.
- Follow the parent description, parent acceptance criteria, and parent discussion as closely as possible.
- Cover the full parent scope end to end, but keep the split logical and balanced: neither aggressive over-splitting nor under-splitting.
- Split by functional journey, user outcome, or business capability, not by technical layers only.
- User Stories must be small, testable, and aligned to the feature they belong to.
- Every user story must have its own description.
- The first user story under every feature should normally include the LaunchDarkly feature flag as part of that story's business scope; never create a standalone LaunchDarkly-only story unless explicit PO guidance or parent context says otherwise.
- Use strong, testable acceptance criteria in Gherkin style.
- Titles must follow the team naming convention from the team guidelines below.
- Do not end titles with redundant suffixes such as Display, Breakdown Display, Screen, or Page unless essential.
- Description text must be structured with section headers and bullet points, not one long paragraph.
- For every business Feature or Epic description, use these exact plain-text sections in this order: Background:, Problem:, Solution:, Business Value:, Scope:, Out of Scope:, Benefit Hypothesis:.
- Acceptance criteria must be separated into distinct Gherkin scenarios, not one flattened block.
- Include accessibility, analytics, and error handling only when the parent context implies them.
- Do not mention implementation classes, APIs, or database details unless explicitly present in the parent context.
- Return JSON only.

Output JSON format:
{
  "parentType": "Epic",
  "parentTitle": "original parent title",
  "features": [
    {
      "title": "feature title", "description": "feature description", "acceptanceCriteria": "feature acceptance criteria",
      "userStories": [ { "title": "story title", "description": "story description", "acceptanceCriteria": "gherkin acceptance criteria" } ]
    }
  ]
}`;

const FEATURE_RULES = `You are generating a breakdown plan for an Azure DevOps Feature.

Use ONLY the parent work item details, acceptance criteria, comments/history, team guidelines, PO recommendations, existing child User Stories, and parent Epic background provided by the user. Do not invent unsupported business scope. Do not include markdown fences. Output valid JSON only.

Rules:
- Parent type is Feature.
- Create ONLY child User Stories.
- Do not create child Features.
- If existing child User Stories are listed, never duplicate them; only create stories for scope not already covered, and return an empty userStories array if the parent scope is already fully covered.
- If parent Epic background is provided, use it only as background to stay aligned with its intent; do not expand scope beyond the Feature.
- Preserve the business intent of the parent feature.
- Follow the parent description, parent acceptance criteria, and parent discussion as closely as possible.
- Cover the full parent scope end to end, but keep the split logical and balanced: neither aggressive over-splitting nor under-splitting.
- Split by functional slices or user journeys, not by technical layers only.
- User Stories must be small, testable, and independently valuable where possible.
- Every user story must have its own description.
- The first user story should normally include the LaunchDarkly feature flag as part of that story's business scope; never create a standalone LaunchDarkly-only story unless explicit PO guidance or parent context says otherwise.
- Use strong, testable acceptance criteria in Gherkin style.
- Story titles must follow the team naming convention from the team guidelines below.
- Do not end titles with redundant suffixes such as Display, Breakdown Display, Screen, or Page unless essential.
- Description text must be structured with section headers and bullet points, not one long paragraph.
- For every business Feature or Epic description, use these exact plain-text sections in this order: Background:, Problem:, Solution:, Business Value:, Scope:, Out of Scope:, Benefit Hypothesis:.
- Acceptance criteria must be separated into distinct Gherkin scenarios, not one flattened block.
- Include accessibility, error handling, and analytics only when the parent context implies them.
- Do not mention implementation classes, APIs, or database details unless explicitly present in the parent context.
- Return JSON only.

Output JSON format:
{
  "parentType": "Feature",
  "parentTitle": "original parent title",
  "userStories": [ { "title": "story title", "description": "story description", "acceptanceCriteria": "gherkin acceptance criteria" } ]
}`;

const TECH_EPIC_RULES = `You are generating a technical breakdown plan for an Azure DevOps Technical Epic.

Use ONLY the parent work item details, acceptance criteria, comments/history, generic technical guideline, and PO recommendations provided by the user. PO recommendations/restrictions must be treated as highest-priority instructions unless they directly contradict the parent work item. Do not invent unsupported technical scope. Do not include markdown fences. Output valid JSON only.

Rules:
- Parent type is Epic.
- Treat the parent Epic as a Technical Epic.
- Create child Technical Features first.
- For each child Technical Feature, create child Technical User Stories.
- Every Technical Feature must represent a meaningful technical capability, migration slice, compatibility boundary, or operational outcome.
- Every Technical User Story must belong to exactly one created Technical Feature.
- Follow the parent description, parent acceptance criteria, and parent discussion as the source of truth.
- Follow the generic technical breakdown guidelines below.
- If the parent mentions a named technology, platform, framework, language, runtime, library, protocol, cloud service, security standard, or vendor product, use authoritative technical guidance as described in the guidelines below.
- Keep the split MVP-first and balanced: avoid tiny low-value tasks and avoid broad vague stories.
- Split by meaningful technical outcome, migration phase, compatibility boundary, security remediation, operational readiness, deployment safety, testing readiness, or rollback readiness.
- Technical User Stories must be small, testable, and aligned to the Technical Feature they belong to.
- Every Technical User Story must have its own description.
- Use technical acceptance criteria that validate compatibility, testing, rollout, rollback, observability, security, or operational readiness where relevant.
- Titles must follow the technical naming convention from the guidelines below.
- Description text must be structured with technical sections and bullet points, not one long paragraph.
- Acceptance criteria must be separated into distinct Gherkin scenarios or clear technical validation blocks.
- Include assumptions only when needed and prefix each assumption line with "Assumption:".
- Do not add unrelated modernization, refactoring, tooling, observability, or platform work unless it is necessary to satisfy the parent Epic.
- Return JSON only.

Output JSON format:
{
  "parentType": "Epic",
  "parentTitle": "original parent title",
  "features": [
    {
      "title": "technical feature title", "description": "technical feature description", "acceptanceCriteria": "technical feature acceptance criteria",
      "userStories": [ { "title": "technical user story title", "description": "technical user story description", "acceptanceCriteria": "technical acceptance criteria" } ]
    }
  ]
}`;

const TECH_FEATURE_RULES = `You are generating a technical breakdown plan for an Azure DevOps Technical Feature.

Use ONLY the parent work item details, acceptance criteria, comments/history, generic technical guideline, and PO recommendations provided by the user. PO recommendations/restrictions must be treated as highest-priority instructions unless they directly contradict the parent work item. Do not invent unsupported technical scope. Do not include markdown fences. Output valid JSON only.

Rules:
- Parent type is Feature.
- Treat the parent Feature as a Technical Feature.
- Create ONLY child Technical User Stories.
- Do not create child Features.
- If existing child User Stories are listed, never duplicate them; only create stories for scope not already covered, and return an empty userStories array if the parent scope is already fully covered.
- If parent Epic background is provided, use it only as background to stay aligned with its intent; do not expand scope beyond the Feature.
- Preserve the technical intent of the parent Feature.
- Follow the parent description, parent acceptance criteria, and parent discussion as the source of truth.
- Follow the generic technical breakdown guidelines below.
- If the parent mentions a named technology, platform, framework, language, runtime, library, protocol, cloud service, security standard, or vendor product, use authoritative technical guidance as described in the guidelines below.
- Keep the split MVP-first and balanced: avoid tiny low-value tasks and avoid broad vague stories.
- Split by meaningful technical outcome, compatibility boundary, migration phase, security outcome, operational readiness, or delivery safety.
- Technical User Stories must be small, testable, and traceable to the parent Feature.
- Every Technical User Story must have its own description.
- Use technical acceptance criteria that validate compatibility, testing, rollout, rollback, observability, security, or operational readiness where relevant.
- Titles must follow the technical naming convention from the guidelines below.
- Description text must be structured with technical sections and bullet points, not one long paragraph.
- Acceptance criteria must be separated into distinct Gherkin scenarios or clear technical validation blocks.
- Include assumptions only when needed and prefix each assumption line with "Assumption:".
- Do not add unrelated modernization, refactoring, tooling, observability, or platform work unless it is necessary to satisfy the parent Feature.
- Return JSON only.

Output JSON format:
{
  "parentType": "Feature",
  "parentTitle": "original parent title",
  "userStories": [ { "title": "technical user story title", "description": "technical user story description", "acceptanceCriteria": "technical acceptance criteria" } ]
}`;

const ROLLUP_RULES = `You are generating a roll-up plan for existing Azure DevOps User Stories.

Use ONLY the provided input User Story details, linked User Story details, comments/history, team guidelines, and PO recommendations. Do not invent unsupported business scope. Do not generate new User Stories. Do not include markdown fences. Output valid JSON only.

Rules:
- Parent type is User Story.
- The existing input User Story and linked User Stories already exist and will be linked under a newly created Feature.
- Create exactly one new Feature that summarizes the existing listed User Stories.
- Create exactly one new Epic that summarizes the new Feature.
- The Feature and Epic must be grounded in the existing User Stories, not expanded into new delivery scope.
- Preserve the ownership scope defined in the team guidelines below; treat work owned by other teams or downstream/external systems as dependencies or out of scope, not as primary title slices.
- Treat A/B testing / experimentation as a release mechanism unless the listed User Stories explicitly make experimentation the main business scope.
- Use business-focused titles.
- Do not title the Feature or Epic using downstream system/team names unless that is business-visible and owned by the current team.
- Descriptions must be structured with section headers and bullet points, not one long paragraph.
- Acceptance criteria must describe roll-up completion at Feature/Epic level. Do not duplicate every detailed story acceptance criterion.
- Include assumptions only if required, and prefix each assumption line with "Assumption:".
- Return JSON only.

Output JSON format:
{
  "parentType": "User Story",
  "sourceStoryTitle": "input user story title",
  "epic": { "title": "new epic title", "description": "new epic description", "acceptanceCriteria": "new epic acceptance criteria" },
  "feature": { "title": "new feature title", "description": "new feature description", "acceptanceCriteria": "new feature acceptance criteria" }
}`;

function buildEpicSystemPrompt(teamGuidelines: string, isTech: boolean): string {
  return `${isTech ? TECH_EPIC_RULES : EPIC_RULES}\n\n## Team guidelines (mandatory)\n\n${teamGuidelines}`;
}
function buildFeatureSystemPrompt(teamGuidelines: string, isTech: boolean): string {
  return `${isTech ? TECH_FEATURE_RULES : FEATURE_RULES}\n\n## Team guidelines (mandatory)\n\n${teamGuidelines}`;
}
function buildRollupSystemPrompt(teamGuidelines: string): string {
  return `${ROLLUP_RULES}\n\n## Team guidelines (mandatory)\n\n${teamGuidelines}`;
}

// --- user message sections ---------------------------------------------------

function areaOfValueOf(wi: WorkItemRecord): string {
  return String(wi.fields[AREA_OF_VALUE_FIELD] ?? "").trim();
}

function buildParentSection(parent: WorkItemRecord, areaPath: string, teamName: string, isTechBreakdown: boolean): string {
  return `# Parent Work Item\n\n- ID: ${parent.id}\n- Type: ${parent.type}\n- State: ${parent.state}\n- Title: ${parent.title}\n- Area Path: ${areaPath}\n- Iteration Path: ${parent.iterationPath}\n- Team: ${teamName}\n- Breakdown Mode: ${isTechBreakdown ? "Technical" : "Functional"}\n- Area of Value: ${areaOfValueOf(parent)}\n\n## Description\n${parent.description}\n\n## Acceptance Criteria\n${parent.acceptanceCriteria}`;
}

function buildPoNotesSection(poNotes: string): string {
  return poNotes.trim()
    ? `# PO Recommendations / Notes / Restrictions\n\nTreat the below as high-priority guidance unless it conflicts with the source work item content.\n\n${poNotes.trim()}`
    : "No PO recommendations / notes / restrictions provided.";
}

function buildExistingChildrenSection(stories: WorkItemRecord[]): string {
  if (!stories.length) {
    return "# Existing Child User Stories\n\nNo User Stories currently exist under this Feature. Generate the full breakdown.";
  }
  const lines = [
    "# Existing Child User Stories (DO NOT DUPLICATE)",
    "",
    "These User Stories already exist under the parent Feature. Do not regenerate, rephrase, or duplicate them. Only generate User Stories that cover scope not already addressed below. If the parent scope is already fully covered, return an empty userStories array.",
    "",
  ];
  stories.forEach((s, i) => lines.push(`${i + 1}. [${s.state}] ${s.title}`));
  return lines.join("\n");
}

function buildParentEpicSection(epic: WorkItemRecord): string {
  return `# Parent Epic (Background Context)\n\nThis Feature belongs to the Epic below. Use it as background to keep the generated User Stories aligned with the Epic intent. Do not break the Epic down; only break down the Feature.\n\n- ID: ${epic.id}\n- Title: ${epic.title}\n- State: ${epic.state}\n\n## Description\n${epic.description}\n\n## Acceptance Criteria\n${epic.acceptanceCriteria}`;
}

function buildDesignDocumentsSection(attachments: DocxAttachment[]): string {
  if (!attachments.length) return "No readable .docx design document attachments were found on the parent work item.";
  const parts = [
    "# Attached Word Design Documents",
    "",
    "Use these documents as supporting design context. The parent work item and explicit PO recommendations remain higher-priority when there is a conflict.",
    "Do not invent requirements that are not supported by either the work item or these documents.",
    "",
  ];
  attachments.forEach((a, i) => parts.push(`# Document ${i + 1}: ${a.filename}`, "", a.text || "No readable text was extracted.", ""));
  return parts.join("\n").trim();
}

function buildLinkedUserStoriesSection(stories: (WorkItemRecord & { discussion: string })[]): string {
  if (!stories.length) return "No linked User Stories found.";
  const parts = ["# Linked / Listed User Stories", ""];
  stories.forEach((s, i) => {
    parts.push(
      `## ${i + 1}. User Story ${s.id}: ${s.title}`,
      "",
      `- State: ${s.state}`,
      `- Area Path: ${s.areaPath}`,
      `- Iteration Path: ${s.iterationPath}`,
      `- Tags: ${s.tags}`,
      `- Area of Value: ${areaOfValueOf(s)}`,
      "",
      "### Description",
      s.description || "No description provided.",
      "",
      "### Acceptance Criteria",
      s.acceptanceCriteria || "No acceptance criteria provided.",
      "",
      "### Discussion / History",
      s.discussion || "No comments/history found.",
      "",
    );
  });
  return parts.join("\n").trim();
}

function buildBreakdownUserMessage(
  parent: WorkItemRecord,
  areaPath: string,
  teamName: string,
  isTechBreakdown: boolean,
  discussion: string,
  poNotes: string,
  existingChildren: WorkItemRecord[],
  parentEpic: WorkItemRecord | null,
  docxAttachments: DocxAttachment[],
): string {
  const sections = [
    buildParentSection(parent, areaPath, teamName, isTechBreakdown),
    "",
    "## Discussion / History",
    discussion || "No work item comments/history found.",
    "",
    buildPoNotesSection(poNotes),
  ];
  if (parent.type.trim().toLowerCase() === "feature") {
    sections.push("", buildExistingChildrenSection(existingChildren));
    if (parentEpic) sections.push("", buildParentEpicSection(parentEpic));
  }
  sections.push("", buildDesignDocumentsSection(docxAttachments));
  return sections.join("\n");
}

function buildRollupUserMessage(
  parent: WorkItemRecord,
  areaPath: string,
  teamName: string,
  discussion: string,
  poNotes: string,
  linkedStories: (WorkItemRecord & { discussion: string })[],
  docxAttachments: DocxAttachment[],
): string {
  return [
    buildParentSection(parent, areaPath, teamName, false),
    "",
    "## Discussion / History",
    discussion || "No work item comments/history found.",
    "",
    buildPoNotesSection(poNotes),
    "",
    buildLinkedUserStoriesSection(linkedStories),
    "",
    buildDesignDocumentsSection(docxAttachments),
  ].join("\n");
}

// --- plan parsing --------------------------------------------------------------

function parseBreakdownPlan(raw: string, allowEmptyUserStories: boolean, poNotes: string, emit: EmitFn): BreakdownPlan {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot output did not contain a valid JSON object");
  const root = loadCopilotJson(jsonStr) as Record<string, unknown>;
  const parentType = String(root.parentType ?? "").trim().toLowerCase();
  const parentTitle = String(root.parentTitle ?? "").trim();

  const features: FeatureSpec[] = ((root.features as Record<string, unknown>[]) ?? []).map((f) => ({
    title: cleanupTitle(String(f.title ?? "") || "Untitled Feature"),
    description: normalizeDescriptionText(String(f.description ?? "")),
    acceptanceCriteria: normalizeAcceptanceCriteriaText(String(f.acceptanceCriteria ?? "")),
    userStories: ((f.userStories as Record<string, unknown>[]) ?? []).map((s) => ({
      title: cleanupTitle(String(s.title ?? "") || "Untitled User Story"),
      description: normalizeDescriptionText(String(s.description ?? "")),
      acceptanceCriteria: normalizeAcceptanceCriteriaText(String(s.acceptanceCriteria ?? "")),
    })),
  }));

  const userStories: StorySpec[] = ((root.userStories as Record<string, unknown>[]) ?? []).map((s) => ({
    title: cleanupTitle(String(s.title ?? "") || "Untitled User Story"),
    description: normalizeDescriptionText(String(s.description ?? "")),
    acceptanceCriteria: normalizeAcceptanceCriteriaText(String(s.acceptanceCriteria ?? "")),
  }));

  if (!["epic", "feature"].includes(parentType)) throw new Error(`Unsupported parentType in Copilot output: ${root.parentType}`);

  let finalFeatures = features;
  let finalUserStories = userStories;

  if (parentType === "feature") {
    if (features.length) throw new Error("Feature breakdown output must not include nested features");
    if (!userStories.length && !allowEmptyUserStories) throw new Error("Feature breakdown output must include at least one user story");
    finalUserStories = softEnforceLaunchDarklyRules(
      softenStoryDescriptions(userStories, parentTitle || "Feature", emit),
      parentTitle || "Feature",
      poNotes,
      emit,
    );
  }

  if (parentType === "epic") {
    if (!features.length) throw new Error("Epic breakdown output must include at least one feature");
    finalFeatures = features.map((f) => {
      if (!f.userStories.length) throw new Error(`Epic breakdown feature '${f.title}' must contain at least one user story`);
      const softened = softenStoryDescriptions(f.userStories, f.title, emit);
      return { ...f, userStories: softEnforceLaunchDarklyRules(softened, f.title, poNotes, emit) };
    });
  }

  const total = finalUserStories.length + finalFeatures.reduce((n, f) => n + 1 + f.userStories.length, 0);
  if (total > MAX_CHILDREN) throw new Error(`Breakdown plan too large (${total} items). MAX_CHILDREN=${MAX_CHILDREN}`);

  return { parentType: parentType as "epic" | "feature", parentTitle, features: finalFeatures, userStories: finalUserStories };
}

function parseStoryRollupPlan(raw: string, emit: EmitFn): StoryRollupPlan {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot output did not contain a valid JSON object");
  const root = loadCopilotJson(jsonStr) as Record<string, unknown>;
  const parentType = String(root.parentType ?? "").trim();
  const sourceStoryTitle = String(root.sourceStoryTitle ?? root.parentTitle ?? "").trim();
  const epicRoot = (root.epic as Record<string, unknown>) ?? {};
  const featureRoot = (root.feature as Record<string, unknown>) ?? {};

  if (parentType.trim().toLowerCase() !== "user story") throw new Error(`Unsupported parentType in User Story roll-up output: ${parentType}`);

  const epicTitle = cleanupTitle(String(epicRoot.title ?? "") || "Untitled Epic");
  const featureTitle = cleanupTitle(String(featureRoot.title ?? "") || "Untitled Feature");
  if (!epicTitle.trim()) throw new Error("User Story roll-up output must include epic.title");
  if (!featureTitle.trim()) throw new Error("User Story roll-up output must include feature.title");

  let epicDescription = normalizeDescriptionText(String(epicRoot.description ?? ""));
  if (!epicDescription.trim()) {
    emit("[breakdown] generated Epic description is empty — using a fallback");
    epicDescription = normalizeDescriptionText(
      "Background:\n- Created by rolling up the selected and linked User Stories.\n\nScope:\n- Parent Epic for the linked User Story group.",
    );
  }
  let featureDescription = normalizeDescriptionText(String(featureRoot.description ?? ""));
  if (!featureDescription.trim()) {
    emit("[breakdown] generated Feature description is empty — using a fallback");
    featureDescription = normalizeDescriptionText(
      "Background:\n- Created by rolling up the selected and linked User Stories.\n\nScope:\n- Parent Feature for the linked User Story group.",
    );
  }

  return {
    parentType,
    sourceStoryTitle,
    epic: { title: epicTitle, description: epicDescription, acceptanceCriteria: normalizeAcceptanceCriteriaText(String(epicRoot.acceptanceCriteria ?? "")) },
    feature: {
      title: featureTitle,
      description: featureDescription,
      acceptanceCriteria: normalizeAcceptanceCriteriaText(String(featureRoot.acceptanceCriteria ?? "")),
      userStories: [],
    },
  };
}

async function parseBreakdownPlanWithRepair(
  raw: string,
  systemPrompt: string,
  githubToken: string,
  emit: EmitFn,
  allowEmptyUserStories: boolean,
  poNotes: string,
): Promise<BreakdownPlan> {
  try {
    return parseBreakdownPlan(raw, allowEmptyUserStories, poNotes, emit);
  } catch (firstError) {
    emit("[copilot] plan failed validation — asking Copilot to repair it once");
    // Reuse the full original system prompt (team guidelines included) and the
    // larger runCopilotChat token budget — a single truncated repairPrompt
    // message previously cut the previous response at 8000 chars, which could
    // silently drop the exact story/feature that needed fixing, causing the
    // repair attempt to fail with the identical validation error.
    const repairMessage =
      `The following response was supposed to be a breakdown JSON plan but failed validation: ${
        firstError instanceof Error ? firstError.message : firstError
      }\n\nRepair or regenerate the complete plan. Return valid JSON only using the same schema, starting with { and ending with }. ` +
      `Do not add markdown fences or prose. Escape newlines inside JSON strings.\n\nPrevious response:\n${raw}`;
    const repaired = await runCopilotChat(systemPrompt, repairMessage, githubToken);
    try {
      return parseBreakdownPlan(repaired, allowEmptyUserStories, poNotes, emit);
    } catch (secondError) {
      throw new Error(
        `Copilot did not return a valid breakdown plan after one repair attempt. First error: ${
          firstError instanceof Error ? firstError.message : firstError
        }. Retry error: ${secondError instanceof Error ? secondError.message : secondError}`,
      );
    }
  }
}

async function parseStoryRollupPlanWithRepair(
  raw: string,
  systemPrompt: string,
  githubToken: string,
  emit: EmitFn,
): Promise<StoryRollupPlan> {
  try {
    return parseStoryRollupPlan(raw, emit);
  } catch (firstError) {
    emit("[copilot] roll-up plan failed validation — asking Copilot to repair it once");
    const repairMessage =
      `The following response was supposed to be a User Story roll-up JSON plan but failed validation: ${
        firstError instanceof Error ? firstError.message : firstError
      }\n\nRepair or regenerate the complete plan. Return valid JSON only using the same schema, starting with { and ending with }. ` +
      `Do not add markdown fences or prose. Escape newlines inside JSON strings.\n\nPrevious response:\n${raw}`;
    const repaired = await runCopilotChat(systemPrompt, repairMessage, githubToken);
    try {
      return parseStoryRollupPlan(repaired, emit);
    } catch (secondError) {
      throw new Error(
        `Copilot did not return a valid roll-up plan after one repair attempt. First error: ${
          firstError instanceof Error ? firstError.message : firstError
        }. Retry error: ${secondError instanceof Error ? secondError.message : secondError}`,
      );
    }
  }
}

// --- context loaders -----------------------------------------------------------

function normalizeParentType(type: string): "Epic" | "Feature" | "User Story" {
  const lowered = (type || "").trim().toLowerCase();
  if (lowered === "epic") return "Epic";
  if (lowered === "feature") return "Feature";
  if (lowered === "user story") return "User Story";
  throw new Error(`Only Epic, Feature, and User Story are supported. The provided work item resolved to '${type}'.`);
}

async function getChildUserStories(parent: WorkItemRecord, auth: string, emit: EmitFn): Promise<WorkItemRecord[]> {
  const seen = new Set<number>();
  const children: WorkItemRecord[] = [];
  for (const relation of parent.relations) {
    if (relation.rel !== HIERARCHY_FORWARD) continue;
    const id = workItemIdFromRelationUrl(relation.url ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    try {
      const child = await getWorkItemRecord(id, auth, false);
      if (child.type.trim().toLowerCase() === "user story") children.push(child);
    } catch (ex) {
      emit(`[ado] failed to read child work item ${id}: ${ex instanceof Error ? ex.message : ex}`);
    }
  }
  return children;
}

async function getParentEpicOf(parent: WorkItemRecord, auth: string, emit: EmitFn): Promise<WorkItemRecord | null> {
  for (const relation of parent.relations) {
    if (relation.rel !== HIERARCHY_REVERSE) continue;
    const id = workItemIdFromRelationUrl(relation.url ?? "");
    if (!id) continue;
    try {
      const candidate = await getWorkItemRecord(id, auth, false);
      return candidate.type.trim().toLowerCase() === "epic" ? candidate : null;
    } catch (ex) {
      emit(`[ado] failed to read parent work item ${id}: ${ex instanceof Error ? ex.message : ex}`);
      return null;
    }
  }
  return null;
}

async function findLinkedUserStories(parent: WorkItemRecord, auth: string, emit: EmitFn): Promise<(WorkItemRecord & { discussion: string })[]> {
  const linkedIds: number[] = [parent.id];
  const seen = new Set<number>([parent.id]);
  for (const relation of parent.relations) {
    const id = workItemIdFromRelationUrl(relation.url ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    linkedIds.push(id);
  }

  const summaries: (WorkItemRecord & { discussion: string })[] = [];
  for (const id of linkedIds) {
    try {
      const wi = await getWorkItemRecord(id, auth, false);
      if (wi.type.trim().toLowerCase() === "user story") {
        const discussion = await getDiscussionHistory(id, auth);
        summaries.push({ ...wi, discussion });
      } else {
        emit(`[ado] skipping linked work item ${id} because type is '${wi.type}', not User Story`);
      }
    } catch (ex) {
      emit(`[ado] failed to read linked work item ${id}: ${ex instanceof Error ? ex.message : ex}`);
    }
  }
  return summaries;
}

async function loadDocxAttachments(parent: WorkItemRecord, auth: string, emit: EmitFn): Promise<DocxAttachment[]> {
  const candidates: { priority: number; filename: string; url: string }[] = [];
  for (const relation of parent.relations) {
    if (String(relation.rel ?? "").trim().toLowerCase() !== "attachedfile") continue;
    const attrs = (relation.attributes as Record<string, unknown> | undefined) ?? {};
    let filename = String(attrs.name ?? "").trim();
    if (!filename) {
      try {
        filename = decodeURIComponent(new URL(relation.url).pathname.split("/").pop() ?? "");
      } catch {
        filename = "";
      }
    }
    if (!filename.toLowerCase().endsWith(".docx")) continue;
    if (!relation.url) continue;
    const lowered = filename.toLowerCase();
    const priority = DOCX_DESIGN_KEYWORDS.some((k) => lowered.includes(k)) ? 0 : 1;
    candidates.push({ priority, filename, url: relation.url });
  }
  candidates.sort((a, b) => a.priority - b.priority || a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()));

  if (!candidates.length) {
    emit("[ado] no .docx attachments found on the parent work item — continuing without design document context");
    return [];
  }

  const results: DocxAttachment[] = [];
  for (const c of candidates.slice(0, 2)) {
    try {
      const bytes = await downloadAttachment(c.url, auth);
      const text = await extractDocxText(bytes);
      if (!text) {
        emit(`[ado] no readable text extracted from .docx attachment '${c.filename}'`);
        continue;
      }
      results.push({ filename: c.filename, text });
      emit(`[ado] loaded Word design context from attachment: ${c.filename}`);
    } catch (ex) {
      emit(`[ado] could not read .docx attachment '${c.filename}': ${ex instanceof Error ? ex.message : ex} — continuing without it`);
    }
  }
  if (candidates.length > 2) {
    emit(`[ado] found ${candidates.length} .docx attachments — only the two highest-priority documents were used`);
  }
  return results;
}

function resolveRollupAreaOfValue(parent: WorkItemRecord, linkedStories: WorkItemRecord[], emit: EmitFn): string {
  const parentAov = areaOfValueOf(parent);
  if (parentAov) return parentAov;

  const values: string[] = [];
  for (const s of linkedStories) {
    const v = areaOfValueOf(s);
    if (v && !values.includes(v)) values.push(v);
  }
  if (values.length) {
    if (values.length > 1) {
      emit(`[breakdown] multiple Area of Value values found across linked User Stories: ${values.join(", ")}. Using '${values[0]}'`);
    }
    return values[0];
  }
  emit("[breakdown] Area of Value is empty on the source User Story and all linked User Stories — using default 'Business'");
  return "Business";
}

// --- work item creation ----------------------------------------------------------

async function createFeatureChildren(
  parent: WorkItemRecord,
  areaPath: string,
  plan: BreakdownPlan,
  assignedTo: string | null,
  existingChildren: WorkItemRecord[],
  auth: string,
  emit: EmitFn,
): Promise<{ created: CreatedWorkItemRecord[]; skipped: StorySpec[] }> {
  const created: CreatedWorkItemRecord[] = [];
  const skipped: StorySpec[] = [];
  const tags = parent.tags || "AI-Breakdown";
  const areaOfValue = areaOfValueOf(parent);
  const seenTitles = new Set(existingChildren.map((s) => normalizeTitleForCompare(s.title)));

  for (const story of plan.userStories) {
    const normalized = normalizeTitleForCompare(story.title);
    if (seenTitles.has(normalized)) {
      skipped.push(story);
      emit(`[ado] skipping duplicate User Story '${story.title}' — a child with the same title already exists under Feature ${parent.id}`);
      continue;
    }
    const item = await createWorkItemRecord(
      {
        type: "User Story",
        title: story.title,
        descriptionHtml: descriptionTextToAdoHtml(story.description),
        acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(story.acceptanceCriteria),
        areaPath,
        tags,
        extraFields: { ...(areaOfValue ? { [AREA_OF_VALUE_FIELD]: areaOfValue } : {}), ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
        parentId: parent.id,
      },
      auth,
    );
    created.push(item);
    emit(`[ado] created User Story ${item.id}: ${item.title}`);
    seenTitles.add(normalized);
  }
  return { created, skipped };
}

async function createEpicChildren(
  parent: WorkItemRecord,
  areaPath: string,
  plan: BreakdownPlan,
  assignedTo: string | null,
  auth: string,
  emit: EmitFn,
): Promise<CreatedWorkItemRecord[]> {
  const created: CreatedWorkItemRecord[] = [];
  const tags = parent.tags || "AI-Breakdown";
  const areaOfValue = areaOfValueOf(parent);

  for (const feature of plan.features) {
    const createdFeature = await createWorkItemRecord(
      {
        type: "Feature",
        title: feature.title,
        descriptionHtml: descriptionTextToAdoHtml(feature.description),
        acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(feature.acceptanceCriteria),
        areaPath,
        tags,
        extraFields: { ...(areaOfValue ? { [AREA_OF_VALUE_FIELD]: areaOfValue } : {}), ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
        parentId: parent.id,
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
          tags,
          extraFields: { ...(areaOfValue ? { [AREA_OF_VALUE_FIELD]: areaOfValue } : {}), ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) },
          parentId: createdFeature.id,
        },
        auth,
      );
      created.push(createdStory);
      emit(`[ado] created User Story ${createdStory.id}: ${createdStory.title}`);
    }
  }
  return created;
}

async function createUserStoryRollup(
  parent: WorkItemRecord,
  areaPath: string,
  plan: StoryRollupPlan,
  linkedStories: WorkItemRecord[],
  areaOfValue: string,
  assignedTo: string | null,
  auth: string,
  emit: EmitFn,
): Promise<{ epic: CreatedWorkItemRecord; feature: CreatedWorkItemRecord; linked: LinkedItem[] }> {
  const tags = parent.tags || "AI-Rollup";
  const iterationPath = parent.iterationPath;
  const extraFields = { ...(areaOfValue ? { [AREA_OF_VALUE_FIELD]: areaOfValue } : {}), ...(assignedTo ? { "System.AssignedTo": assignedTo } : {}) };

  const epic = await createWorkItemRecord(
    {
      type: "Epic",
      title: plan.epic.title,
      descriptionHtml: descriptionTextToAdoHtml(plan.epic.description),
      acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(plan.epic.acceptanceCriteria),
      areaPath,
      iterationPath,
      tags,
      extraFields,
    },
    auth,
  );
  emit(`[ado] created Epic ${epic.id}: ${epic.title}`);

  const feature = await createWorkItemRecord(
    {
      type: "Feature",
      title: plan.feature.title,
      descriptionHtml: descriptionTextToAdoHtml(plan.feature.description),
      acceptanceCriteriaHtml: acceptanceCriteriaTextToAdoHtml(plan.feature.acceptanceCriteria),
      areaPath,
      iterationPath,
      tags,
      extraFields,
      parentId: epic.id,
    },
    auth,
  );
  emit(`[ado] created Feature ${feature.id}: ${feature.title} (parent ${epic.id})`);

  const linked: LinkedItem[] = [];
  for (const story of linkedStories) {
    await relinkWorkItemParent(story.id, feature.id, auth, {
      removeExistingParent: true,
      areaPath,
      iterationPath,
      extraFields: areaOfValue ? { [AREA_OF_VALUE_FIELD]: areaOfValue } : undefined,
    });
    linked.push({ id: story.id, type: story.type, title: story.title, parentId: feature.id });
    emit(`[ado] relinked User Story ${story.id}: ${story.title} under Feature ${feature.id}`);
  }

  return { epic, feature, linked };
}

// --- comments --------------------------------------------------------------------

function renderParentComment(
  parent: WorkItemRecord,
  createdItems: CreatedWorkItemRecord[],
  assignedTo: string | null,
  isTechBreakdown: boolean,
  existingChildren: WorkItemRecord[] | undefined,
  skippedTitles: string[],
): string {
  const lines = [BREAKDOWN_MARKER, "", `Parent work item: ${parent.id} - ${parent.title}`, `Parent type: ${parent.type}`, `Technical breakdown: ${isTechBreakdown}`];
  if (assignedTo) lines.push(`Assigned created items to: ${assignedTo}`);
  lines.push("", "Created items:");
  if (!createdItems.length) lines.push("- No items created");
  else for (const item of createdItems) lines.push(`- ${item.type} ${item.id}: ${item.title} (parent ${item.parentId})`);
  if (existingChildren?.length) {
    lines.push("", "Existing child User Stories (left untouched):");
    for (const s of existingChildren) lines.push(`- User Story ${s.id} [${s.state}]: ${s.title}`);
  }
  if (skippedTitles.length) {
    lines.push("", "Skipped as duplicates (not created):");
    for (const t of skippedTitles) lines.push(`- ${t}`);
  }
  return truncate(lines.join("\n").trim(), MAX_COMMENT_CHARS);
}

function renderRollupComment(
  sourceStory: WorkItemRecord,
  createdEpic: CreatedWorkItemRecord,
  createdFeature: CreatedWorkItemRecord,
  linkedStories: WorkItemRecord[],
  assignedTo: string | null,
): string {
  const lines = [
    ROLLUP_MARKER,
    "",
    `Source User Story: ${sourceStory.id} - ${sourceStory.title}`,
    `Created Epic: ${createdEpic.id} - ${createdEpic.title}`,
    `Created Feature: ${createdFeature.id} - ${createdFeature.title}`,
  ];
  if (assignedTo) lines.push(`Assigned created items to: ${assignedTo}`);
  lines.push("", "Linked existing User Stories under created Feature:");
  for (const s of linkedStories) lines.push(`- User Story ${s.id}: ${s.title}`);
  return truncate(lines.join("\n").trim(), MAX_COMMENT_CHARS);
}

// --- orchestration -----------------------------------------------------------------

export async function runFeatureBreakdown(inputs: Record<string, string | boolean>, ctx: LocalCtx): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const workItemUrl = typeof inputs.workItemUrl === "string" ? inputs.workItemUrl.trim() : "";
  if (!workItemUrl) throw new Error("A work item URL is required.");
  const workItemIdStr = parseWorkItemId(workItemUrl);
  if (!workItemIdStr) throw new Error(`Could not parse a work item id from: ${workItemUrl}`);
  const workItemId = Number(workItemIdStr);

  const areaPathOverride = typeof inputs.areaPath === "string" ? inputs.areaPath.trim() : "";
  const isTechBreakdown = Boolean(inputs.isTechBreakdown);
  const poNotes = typeof inputs.additionalInstructions === "string" ? inputs.additionalInstructions.trim() : "";
  const createParentComment = inputs.createParentComment !== false;
  const dryRun = Boolean(inputs.dryRun);
  const teamName = "generic";

  emit(`[ado] loading work item ${workItemId}…`);
  const parentRaw = await getWorkItemRecord(workItemId, adoAuth, true);
  const parentType = normalizeParentType(parentRaw.type);
  if (isTechBreakdown && parentType === "User Story") {
    throw new Error(
      "Technical breakdown supports only Epic and Feature work items. User Story roll-up still uses team-specific roll-up instructions.",
    );
  }

  const areaPath = areaPathOverride || parentRaw.areaPath;
  emit(`[ado] parent: ${parentType} ${parentRaw.id} — ${parentRaw.title}`);

  const discussion = await getDiscussionHistory(workItemId, adoAuth, MAX_PARENT_HISTORY_CHARS);
  const docxAttachments = await loadDocxAttachments(parentRaw, adoAuth, emit);

  const { org, project } = adoTarget();

  if (parentType === "User Story") {
    emit("[ado] loading linked User Stories for roll-up…");
    const linkedStories = await findLinkedUserStories(parentRaw, adoAuth, emit);
    if (!linkedStories.length) throw new Error("No User Stories were available for roll-up. The input User Story should at least be readable.");
    if (linkedStories.length > MAX_CHILDREN) throw new Error(`Too many linked User Stories (${linkedStories.length}). MAX_CHILDREN=${MAX_CHILDREN}`);
    emit(`[ado] resolved ${linkedStories.length} User Story item(s) for roll-up`);

    const areaOfValue = resolveRollupAreaOfValue(parentRaw, linkedStories, emit);

    const instructionFile = await discoverInstructionFile(teamName, "user-story-rollup");
    emit(`[bundle] loaded roll-up instructions (${instructionFile.path.split("/").pop()})`);

    const systemPrompt = buildRollupSystemPrompt(instructionFile.content);
    const userMessage = buildRollupUserMessage(parentRaw, areaPath, teamName, discussion, poNotes, linkedStories, docxAttachments);

    emit("[copilot] streaming model response …");
    const raw = await runCopilotChat(systemPrompt, userMessage, githubToken);
    const plan = await parseStoryRollupPlanWithRepair(raw, systemPrompt, githubToken, emit);
    emit(`[copilot] roll-up plan: Epic '${plan.epic.title}', Feature '${plan.feature.title}'`);

    if (dryRun) {
      emit("[done] dry run — no work items created or relinked");
      return { dryRun: true, createdCount: 2, linkedCount: linkedStories.length, items: [] };
    }

    const assignedTo = await resolveCallerIdentity(org, adoAuth);
    if (assignedTo) emit(`[ado] assigning created items to ${assignedTo}`);

    const { epic, feature, linked } = await createUserStoryRollup(parentRaw, areaPath, plan, linkedStories, areaOfValue, assignedTo, adoAuth, emit);

    if (createParentComment) {
      const comment = renderRollupComment(parentRaw, epic, feature, linkedStories, assignedTo);
      await addWorkItemComment(parentRaw.id, comment, adoAuth);
      await addWorkItemComment(feature.id, comment, adoAuth);
      await addWorkItemComment(epic.id, comment, adoAuth);
      emit("[ado] posted roll-up summary comment on source story, Feature, and Epic");
    }

    const epicUrl = `https://dev.azure.com/${org}/${project}/_workitems/edit/${epic.id}`;
    emit(`[done] created Epic ${epic.id} and Feature ${feature.id}, linked ${linked.length} User Story(ies)`);

    return {
      webUrl: epicUrl,
      dryRun: false,
      createdCount: 2,
      linkedCount: linked.length,
      items: [
        { type: "Epic", id: epic.id, title: epic.title, parent: 0, url: epicUrl },
        {
          type: "Feature",
          id: feature.id,
          title: feature.title,
          parent: epic.id,
          url: `https://dev.azure.com/${org}/${project}/_workitems/edit/${feature.id}`,
        },
        ...linked.map((l) => ({
          type: l.type,
          id: l.id,
          title: l.title,
          parent: l.parentId,
          url: `https://dev.azure.com/${org}/${project}/_workitems/edit/${l.id}`,
        })),
      ],
    };
  }

  let existingChildren: WorkItemRecord[] = [];
  let parentEpic: WorkItemRecord | null = null;
  if (parentType === "Feature") {
    emit("[ado] checking for existing child User Stories…");
    existingChildren = await getChildUserStories(parentRaw, adoAuth, emit);
    emit(
      existingChildren.length
        ? `[ado] Feature already has ${existingChildren.length} child User Story(ies) — breakdown will avoid duplicates`
        : "[ado] Feature has no existing child User Stories",
    );
    parentEpic = await getParentEpicOf(parentRaw, adoAuth, emit);
    if (parentEpic) emit(`[ado] resolved parent Epic ${parentEpic.id} — injecting as background context`);
  }

  const kind = isTechBreakdown
    ? parentType === "Epic"
      ? "tech-epic-breakdown"
      : "tech-feature-breakdown"
    : parentType === "Epic"
      ? "epic-breakdown"
      : "feature-breakdown";
  const instructionFile = await discoverInstructionFile(teamName, kind);
  emit(`[bundle] loaded ${kind} instructions (${instructionFile.path.split("/").pop()})`);

  const systemPrompt =
    parentType === "Epic" ? buildEpicSystemPrompt(instructionFile.content, isTechBreakdown) : buildFeatureSystemPrompt(instructionFile.content, isTechBreakdown);
  const userMessage = buildBreakdownUserMessage(parentRaw, areaPath, teamName, isTechBreakdown, discussion, poNotes, existingChildren, parentEpic, docxAttachments);

  emit("[copilot] streaming model response …");
  const raw = await runCopilotChat(systemPrompt, userMessage, githubToken);
  const allowEmptyUserStories = parentType === "Feature" && existingChildren.length > 0;
  const plan = await parseBreakdownPlanWithRepair(raw, systemPrompt, githubToken, emit, allowEmptyUserStories, poNotes);
  const storyCount = plan.userStories.length + plan.features.reduce((n, f) => n + f.userStories.length, 0);
  emit(`[copilot] plan: ${plan.features.length} Feature(s), ${storyCount} User Story(ies)`);

  if (dryRun) {
    const planned = plan.userStories.length + plan.features.length + plan.features.reduce((n, f) => n + f.userStories.length, 0);
    emit("[done] dry run — no work items created");
    return { dryRun: true, createdCount: planned, items: [] };
  }

  const assignedTo = await resolveCallerIdentity(org, adoAuth);
  if (assignedTo) emit(`[ado] assigning created items to ${assignedTo}`);

  let created: CreatedWorkItemRecord[] = [];
  let skipped: StorySpec[] = [];
  if (parentType === "Feature") {
    ({ created, skipped } = await createFeatureChildren(parentRaw, areaPath, plan, assignedTo, existingChildren, adoAuth, emit));
  } else {
    created = await createEpicChildren(parentRaw, areaPath, plan, assignedTo, adoAuth, emit);
  }

  if (createParentComment) {
    const comment = renderParentComment(
      parentRaw,
      created,
      assignedTo,
      isTechBreakdown,
      parentType === "Feature" ? existingChildren : undefined,
      skipped.map((s) => s.title),
    );
    await addWorkItemComment(parentRaw.id, comment, adoAuth);
    emit(`[ado] posted summary comment on parent ${parentRaw.id}`);
  }

  emit(`[done] created ${created.length} child work item(s)${skipped.length ? `, skipped ${skipped.length} duplicate(s)` : ""}`);

  const parentUrl = `https://dev.azure.com/${org}/${project}/_workitems/edit/${parentRaw.id}`;
  return {
    webUrl: parentUrl,
    dryRun: false,
    createdCount: created.length,
    skippedCount: skipped.length,
    items: created.map((c) => ({
      type: c.type,
      id: c.id,
      title: c.title,
      parent: c.parentId,
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/${c.id}`,
    })),
  };
}
