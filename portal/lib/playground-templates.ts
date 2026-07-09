export type PgVarType = "text" | "textarea" | "select";

export type PgVariable = {
  key: string;
  label: string;
  type: PgVarType;
  placeholder?: string;
  options?: string[];
};

export type PgTemplate = {
  id: string;
  name: string;
  /** filter chip + grouping — who the template is for */
  category: string;
  /** lucide icon key, mapped in components/icons.ts */
  icon: string;
  description: string;
  /** the role the model holds for the whole conversation, e.g. "a senior QA engineer" */
  persona: string;
  variables: PgVariable[];
  /** first-message body; {{key}} placeholders are filled from variable values */
  prompt: string;
};

/**
 * Template library for the AI Playground. Each template is a persona (a role the
 * model holds for the whole chat) plus a pre-written opening prompt with fill-in
 * variables, so non-technical folks (PM / QA / delivery / business) can run
 * Copilot without prompt-engineering. Output only — nothing is written back to
 * Azure DevOps. Follow-up turns keep the persona and prior context.
 */
export const PG_TEMPLATES: PgTemplate[] = [
  // ── Product / PM ─────────────────────────────────────────────────────────
  {
    id: "idea-to-stories",
    name: "User Story Writer",
    category: "Story Generation",
    icon: "BookOpen",
    description: "Turn a rough feature idea into clear user stories with acceptance criteria.",
    persona: "an expert Agile product owner",
    variables: [
      {
        key: "idea",
        label: "Feature idea",
        type: "textarea",
        placeholder: "Let customers save a payment method during checkout so they don't re-enter it next time…",
      },
    ],
    prompt: `Given the feature idea below, write clear user stories in the format "As a [user], I want to [action] so that [benefit]."

For each story include 3-5 acceptance criteria as a bullet list. Group related stories under a short epic heading. Keep it concise and testable — no implementation detail.

Feature idea:
{{idea}}`,
  },
  {
    id: "story-quality",
    name: "Story Reviewer",
    category: "Story Generation",
    icon: "BadgeCheck",
    description: "Check a story for clarity and flag anything vague or untestable (INVEST).",
    persona: "a senior Agile coach",
    variables: [
      {
        key: "story",
        label: "User story + acceptance criteria",
        type: "textarea",
        placeholder: "As a user I want to reset my password…",
      },
    ],
    prompt: `Review the user story below against the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable).

For each criterion give a PASS/WEAK/FAIL verdict and a one-line reason. Then list every vague, ambiguous, or untestable phrase and rewrite it concretely. End with an improved version of the story and its acceptance criteria.

Story:
{{story}}`,
  },
  {
    id: "prd-to-tickets",
    name: "Backlog Builder",
    category: "Story Generation",
    icon: "Layers",
    description: "Break a requirements doc into epics, features, and ready-to-work stories.",
    persona: "a delivery lead",
    variables: [
      {
        key: "prd",
        label: "Requirements / PRD text",
        type: "textarea",
        placeholder: "Paste the requirements document or feature spec…",
      },
    ],
    prompt: `Read the requirements below and extract an actionable backlog as a hierarchy: Epics → Features → User Stories.

Use a nested bullet list. Each story must be independently deliverable and phrased "As a … I want … so that …". Flag anything ambiguous or missing as an open question at the end. Do not invent requirements that aren't implied by the text.

Requirements:
{{prd}}`,
  },

  // ── QA / Test ────────────────────────────────────────────────────────────
  {
    id: "test-cases",
    name: "Test Case Writer",
    category: "Test Generation",
    icon: "FlaskConical",
    description: "Generate positive, negative, and edge test cases from a story.",
    persona: "a senior QA engineer",
    variables: [
      {
        key: "story",
        label: "Story / acceptance criteria",
        type: "textarea",
        placeholder: "As a user I want to log in with email and password…",
      },
    ],
    prompt: `From the story and acceptance criteria below, write a set of test cases covering positive paths, negative paths, and edge cases.

Present them as a table with columns: ID, Title, Type (Positive/Negative/Edge), Steps, Expected Result. Be specific about inputs. Include boundary and error-handling cases the acceptance criteria imply.

Story:
{{story}}`,
  },
  {
    id: "bug-polish",
    name: "Bug Report Writer",
    category: "Bug Analysis",
    icon: "Bug",
    description: "Turn messy notes into a clean, structured bug report.",
    persona: "a QA lead",
    variables: [
      {
        key: "raw",
        label: "Rough bug notes",
        type: "textarea",
        placeholder: "app crashes sometimes when I tap save on the profile screen, android only I think…",
      },
    ],
    prompt: `Rewrite the rough notes below into a clean bug report with these sections: Title (one line), Environment, Steps to Reproduce (numbered), Expected Result, Actual Result, Severity (with a one-line justification), and Notes/Assumptions.

If key details are missing, list them under "Needs clarification" rather than guessing.

Rough notes:
{{raw}}`,
  },
  {
    id: "test-data",
    name: "Test Data Maker",
    category: "Test Generation",
    icon: "Sparkles",
    description: "Create realistic fake sample data as a table, JSON, or CSV.",
    persona: "a test-data generator that only outputs clearly-fake sample data",
    variables: [
      {
        key: "spec",
        label: "What data do you need?",
        type: "textarea",
        placeholder: "20 users with name, email, country (mixed locales), signup date, and plan tier…",
      },
      {
        key: "format",
        label: "Output format",
        type: "select",
        options: ["Markdown table", "JSON", "CSV"],
      },
    ],
    prompt: `Produce realistic, clearly-fake sample data matching the description below. Use obviously fictional names and example.com email addresses — never real personal data.

Output as: {{format}}. Only output the data (plus a header row/keys). No commentary.

Data needed:
{{spec}}`,
  },

  // ── Delivery / Management ────────────────────────────────────────────────
  {
    id: "sprint-summary",
    name: "Sprint Status Writer",
    category: "Delivery",
    icon: "BarChart3",
    description: "Turn standup or work-item notes into an exec-ready status update.",
    persona: "a delivery manager",
    variables: [
      {
        key: "notes",
        label: "Standup notes / work item dump",
        type: "textarea",
        placeholder: "Paste standup notes, item statuses, blockers…",
      },
    ],
    prompt: `From the raw notes below, write a concise sprint status update for leadership.

Sections: Headline (one sentence on overall health), Shipped, In Progress, Blocked/At Risk (with owner and what's needed), and Next. Keep it factual and skimmable — bullets, no filler. Do not invent status that isn't in the notes.

Notes:
{{notes}}`,
  },
  {
    id: "retro-synth",
    name: "Retro Summarizer",
    category: "Delivery",
    icon: "Activity",
    description: "Group retro notes into themes with concrete action items.",
    persona: "an Agile facilitator",
    variables: [
      {
        key: "notes",
        label: "Retro sticky notes",
        type: "textarea",
        placeholder: "Paste all the retro notes / stickies, one per line…",
      },
    ],
    prompt: `Synthesize the retrospective notes below.

Group them into 3-6 themes. For each theme give a short title, a one-line summary, and how many notes support it. Then propose a prioritized list of concrete action items — each with a suggested owner role and a way to tell if it worked. Keep it constructive.

Retro notes:
{{notes}}`,
  },

  // ── Business / Stakeholder ───────────────────────────────────────────────
  {
    id: "biz-intent",
    name: "Feature Drafter",
    category: "Business",
    icon: "ScanSearch",
    description: "Turn a plain-language business ask into a structured feature outline.",
    persona: "a product strategist",
    variables: [
      {
        key: "intent",
        label: "Business intent (plain language)",
        type: "textarea",
        placeholder: "We want to reduce checkout abandonment for returning customers…",
      },
    ],
    prompt: `Turn the business intent below into a structured feature outline: Problem, Goal, Target Users, Proposed Capability (2-3 sentences), Success Metrics, and Open Questions.

Keep it business-readable — no technical jargon. This is a draft for discussion, not a commitment.

Business intent:
{{intent}}`,
  },
  {
    id: "jargon-translator",
    name: "Plain-English Translator",
    category: "Business",
    icon: "Wand2",
    description: "Rewrite a technical update in plain English for stakeholders.",
    persona: "a translator between engineering and business",
    variables: [
      {
        key: "text",
        label: "Technical update",
        type: "textarea",
        placeholder: "Paste the technical status / release note / engineering update…",
      },
    ],
    prompt: `Rewrite the technical update below in plain English a non-technical stakeholder can understand.

Lead with what it means for the business/customer. Explain any unavoidable terms in a few words. Keep it short. End with a one-line "Why it matters".

Technical update:
{{text}}`,
  },

  // ── Engineering ──────────────────────────────────────────────────────────
  {
    id: "pr-review",
    name: "Mobile Code Reviewer",
    category: "Code Review",
    icon: "GitPullRequest",
    description: "First-pass review of a mobile pull request diff.",
    persona: "a senior mobile engineer reviewing a pull request",
    variables: [
      { key: "pr_title", label: "PR title", type: "text", placeholder: "e.g. Fix login crash on iOS 17" },
      { key: "platform", label: "Platform", type: "text", placeholder: "iOS / Android / React Native" },
      { key: "diff", label: "PR diff", type: "textarea", placeholder: "Paste the git diff here…" },
    ],
    prompt: `Analyze the following diff for:
- Memory leaks
- Force-unwraps (Swift) or null safety issues (Kotlin)
- ANR-prone patterns
- Performance bottlenecks
- Missing error handling
- Security concerns

Rate overall risk as Low / Medium / High and provide specific line-level comments.

PR title: {{pr_title}}
Platform: {{platform}}

Diff:
\`\`\`
{{diff}}
\`\`\``,
  },
  {
    id: "rca-generator",
    name: "Crash Analyzer",
    category: "Bug Analysis",
    icon: "Radar",
    description: "Turn a crash stack trace into a clear root-cause analysis.",
    persona: "a senior mobile engineer specializing in crash analysis",
    variables: [
      { key: "stack_trace", label: "Stack trace", type: "textarea", placeholder: "Paste the crash stack trace…" },
      { key: "app_version", label: "App version", type: "text", placeholder: "e.g. 5.12.1" },
      { key: "platform", label: "Platform", type: "text", placeholder: "iOS / Android" },
    ],
    prompt: `Given the following stack trace, produce a structured RCA with:
- Root Cause
- Contributing Factors
- Affected User Estimate
- Immediate Fix Recommendation
- Long-term Prevention Steps

App version: {{app_version}}
Platform: {{platform}}

Stack trace:
\`\`\`
{{stack_trace}}
\`\`\``,
  },
  {
    id: "bug-classify",
    name: "Bug Triager",
    category: "Bug Analysis",
    icon: "TriangleAlert",
    description: "Classify a bug by severity, type, and affected platform.",
    persona: "an expert mobile engineering QA analyst",
    variables: [
      { key: "bug_description", label: "Bug description", type: "textarea", placeholder: "Paste the bug title and description here…" },
    ],
    prompt: `Classify the following bug report and return a structured analysis with:
- Severity: P1 / P2 / P3 / P4
- Type: crash / ui / performance / logic / network
- Platform: iOS / Android / Both / Unknown
- Root cause hypothesis (one line)
- Recommended priority action

Bug report:
{{bug_description}}`,
  },

  // ── General ──────────────────────────────────────────────────────────────
  {
    id: "doc-summary",
    name: "Document Summarizer",
    category: "General",
    icon: "Sparkles",
    description: "Get a TL;DR, key points, and action items from a long doc.",
    persona: "a sharp analyst",
    variables: [
      {
        key: "doc",
        label: "Document text",
        type: "textarea",
        placeholder: "Paste the long document, meeting transcript, or thread…",
      },
    ],
    prompt: `Summarize the document below.

Output: a 2-3 sentence TL;DR, then Key Points (bullets), then Decisions (if any), then Action Items (with owner if stated). Be faithful to the source — do not add information that isn't there.

Document:
{{doc}}`,
  },
  {
    id: "free-form",
    name: "Free Chat",
    category: "General",
    icon: "Wand2",
    description: "Blank canvas — write your own prompt and chat freely.",
    persona: "a helpful, expert AI assistant",
    variables: [],
    prompt: "",
  },

  // ── TMF Compliance ────────────────────────────────────────────────────
  {
    id: "tmf-reviewer",
    name: "TMF Open API Reviewer",
    category: "API Compliance",
    icon: "ShieldCheck",
    description: "Validate a PR against TM Forum Open API standards and get a structured compliance report.",
    persona: "a senior API architect specializing in TM Forum (TMF) Open API standards with deep expertise in TMF620, TMF622, TMF629, TMF633, TMF641, TMF645, TMF688 and the TMF ODA component model",
    variables: [
      {
        key: "prUrl",
        label: "Pull Request URL (ADO or GitHub)",
        type: "text",
        placeholder: "https://dev.azure.com/org/project/_git/repo/pullrequest/12345 or https://github.com/org/repo/pull/123",
      },
      {
        key: "tmfSpec",
        label: "TMF Spec (if known)",
        type: "text",
        placeholder: "e.g., TMF620 Product Catalog, TMF622 Product Ordering",
      },
    ],
    prompt: `I need you to review the pull request at the following URL for TM Forum (TMF) Open API compliance.

**PR URL:** {{prUrl}}
**TMF Spec (if known):** {{tmfSpec}}

Please fetch/read the PR diff from the link above. Then validate it against TMF Open API compliance requirements and provide a structured report covering ALL of the following areas:

## 1. API Specification Compliance
- Does the API conform to the relevant TMF Open API spec? Identify which TMF spec number applies.
- Are resource names, field names, and data types aligned with the TMF standard schema?
- Is the API version correctly reflected in the URI (e.g., /tmf-api/{resourceName}/v{version})?

## 2. Resource Model & Schema
- Are mandatory fields from the TMF standard resource model present (id, href, @type, @baseType, @schemaLocation)?
- Are extensions to the base schema properly namespaced and documented, not breaking core compliance?
- Do enumerations and reference data match TMF-defined values where applicable?

## 3. HTTP Methods & Status Codes
- Do CRUD operations map correctly to REST verbs (GET, POST, PATCH, DELETE) as per TMF guidelines?
- Are correct HTTP status codes returned (200, 201, 202, 204, 400, 404, 409, 422, etc.)?
- Is partial update behavior (PATCH) implemented per TMF JSON Merge Patch conventions?

## 4. Filtering, Sorting & Pagination
- Are query parameters like fields, offset, limit, and attribute filtering implemented per TMF API design guidelines?
- Is pagination handled consistently with TMF's recommended headers/response structure?

## 5. Error Handling
- Do error responses follow the TMF standard error structure (code, reason, message, status, referenceError)?
- Are error codes consistent across endpoints?

## 6. Event Notification (if applicable)
- If this PR touches event-driven behavior, does it comply with TMF688 Event Management API patterns (event structure, eventType, event payload wrapping)?

## 7. Security & Authentication
- Are authentication/authorization mechanisms aligned with TMF/ODA security guidelines (OAuth2, scopes)?
- Is sensitive data properly excluded from logs/responses?

## 8. Documentation & Versioning
- Is the OpenAPI/Swagger definition updated and consistent with the code changes?
- Are breaking changes flagged, with proper versioning applied?

## Output Format
For each section, mark: ✅ Compliant / ⚠️ Partial / ❌ Non-compliant, with a one-line justification and a suggested fix if non-compliant.

End with:
- **Overall Compliance Verdict**: (Compliant / Partially Compliant / Non-compliant)
- **Blocking Issues** (prioritized list of items that must be fixed before merge)`,
  },
];

export const PG_CATEGORIES: string[] = Array.from(
  new Set(PG_TEMPLATES.map((t) => t.category)),
);

/**
 * A user-authored persona. Same shape as a built-in template so it flows
 * through the whole chat path unchanged; `custom` marks it editable/deletable
 * and `createdAt` sorts the "My Personas" list newest-first. Persisted to
 * localStorage only — never sent to a server.
 */
export type CustomPersona = PgTemplate & {
  custom: true;
  createdAt: number;
};

/** A fresh, empty persona draft for the editor. `id` is assigned by the caller. */
export function blankPersona(): CustomPersona {
  return {
    id: "",
    name: "",
    category: "My Personas",
    icon: "Sparkles",
    description: "",
    persona: "",
    variables: [],
    prompt: "",
    custom: true,
    createdAt: 0,
  };
}

export function getTemplate(id: string): PgTemplate | undefined {
  return PG_TEMPLATES.find((t) => t.id === id);
}

/** Fill {{key}} placeholders in a prompt from variable values. */
export function fillPrompt(prompt: string, values: Record<string, string>): string {
  return prompt.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export type PgMessage = { role: "user" | "assistant"; content: string };

/**
 * The Copilot CLI runs one-shot per turn (no server-side session), so each turn
 * replays the whole conversation: a persona system line, the tagged transcript,
 * and a trailing "Assistant:" cue so the model only continues the next turn.
 */
export function buildConversationPrompt(persona: string, messages: PgMessage[]): string {
  const system =
    `You are ${persona}. Stay in this role for the entire conversation. ` +
    `Reply in clear Markdown. You may read files from a provided context folder if one is given, ` +
    `but never modify files, run shell commands, or make network requests — otherwise answer from the conversation text alone.`;
  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return `${system}\n\n${transcript}\n\nAssistant:`;
}
