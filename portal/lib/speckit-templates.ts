/**
 * Embedded Spec Kit prompt templates for the Spec-Driven Development wizard.
 *
 * These are distilled from github/spec-kit's command templates, adapted for
 * use with the Copilot CLI in our playground. Each step produces a markdown
 * artifact that feeds into subsequent steps as context.
 */

export type SpecKitStep =
  | "constitution"
  | "specify"
  | "clarify"
  | "plan"
  | "tasks";

export type StepMeta = {
  id: SpecKitStep;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  inputLabel: string;
  inputPlaceholder: string;
  outputFile: string;
  /** Which prior artifacts this step needs as context */
  dependsOn: string[];
};

export const SPECKIT_STEPS: StepMeta[] = [
  {
    id: "constitution",
    label: "Constitution",
    shortLabel: "Principles",
    description:
      "Define the project's governing principles — code quality, testing standards, UX consistency, and performance requirements.",
    icon: "Shield",
    inputLabel: "Project principles & guidelines",
    inputPlaceholder:
      "Create principles focused on code quality, testing standards, user experience consistency, and performance requirements…",
    outputFile: "constitution.md",
    dependsOn: [],
  },
  {
    id: "specify",
    label: "Specify",
    shortLabel: "Spec",
    description:
      "Describe what you want to build in plain language. Focus on the what and why — not the tech stack.",
    icon: "FileText",
    inputLabel: "Feature description",
    inputPlaceholder:
      "Build an application that helps me organize my photos in separate albums. Albums are grouped by date and can be re-organized by drag and drop…",
    outputFile: "spec.md",
    dependsOn: ["constitution.md"],
  },
  {
    id: "clarify",
    label: "Clarify",
    shortLabel: "Clarify",
    description:
      "Identify underspecified areas and ask targeted clarification questions to strengthen the spec.",
    icon: "HelpCircle",
    inputLabel: "Additional context or answers (optional)",
    inputPlaceholder:
      "Leave blank to let the AI identify gaps, or paste answers to previous clarification questions…",
    outputFile: "clarifications.md",
    dependsOn: ["constitution.md", "spec.md"],
  },
  {
    id: "plan",
    label: "Plan",
    shortLabel: "Plan",
    description:
      "Provide your tech stack and architecture preferences — the AI creates a technical implementation plan.",
    icon: "Map",
    inputLabel: "Tech stack & architecture",
    inputPlaceholder:
      "Use Next.js with TypeScript, Tailwind CSS, PostgreSQL via Prisma. Deploy on Vercel. REST API with OpenAPI spec…",
    outputFile: "plan.md",
    dependsOn: ["constitution.md", "spec.md", "clarifications.md"],
  },
  {
    id: "tasks",
    label: "Tasks",
    shortLabel: "Tasks",
    description:
      "Break the plan into actionable, dependency-ordered tasks ready for implementation.",
    icon: "ListChecks",
    inputLabel: "Additional constraints (optional)",
    inputPlaceholder:
      "Leave blank to generate from the plan, or add constraints like 'TDD required', 'max 2-hour tasks'…",
    outputFile: "tasks.md",
    dependsOn: ["constitution.md", "spec.md", "plan.md"],
  },
];

/**
 * Build the system prompt for a given step, incorporating any prior artifacts
 * as context. The artifacts map contains filename → content from the session.
 */
export function buildStepPrompt(
  step: SpecKitStep,
  userInput: string,
  artifacts: Record<string, string>,
): string {
  const preamble = STEP_PROMPTS[step];

  // Include prior artifacts as inline context
  const contextParts: string[] = [];
  const meta = SPECKIT_STEPS.find((s) => s.id === step)!;
  for (const dep of meta.dependsOn) {
    const content = artifacts[dep];
    if (content?.trim()) {
      contextParts.push(
        `--- ${dep} ---\n${content.trim()}\n--- end ${dep} ---`,
      );
    }
  }

  const contextBlock =
    contextParts.length > 0
      ? `\n\n## Prior Artifacts (use as context)\n\n${contextParts.join("\n\n")}`
      : "";

  const userBlock = userInput.trim()
    ? `\n\n## User Input\n\n${userInput.trim()}`
    : "";

  return `${preamble}${contextBlock}${userBlock}`;
}

const STEP_PROMPTS: Record<SpecKitStep, string> = {
  constitution: `You are an expert software architect and engineering leader. Your task is to create a project constitution — a set of governing principles and development guidelines.

## Instructions

Create a constitution document with the following sections:

1. **Project Principles** (3-7 principles, each with a name, description, and rationale):
   - Each principle must be declarative and testable
   - Use MUST/SHOULD language where appropriate
   - Cover: code quality, testing standards, UX consistency, performance, security, accessibility

2. **Development Standards**:
   - Code style and formatting expectations
   - Testing requirements (coverage, types of tests)
   - Documentation standards
   - Code review expectations

3. **Governance**:
   - How decisions are made
   - How principles can be amended
   - Compliance review expectations

Output the constitution as clean Markdown. Be concrete and actionable — avoid vague platitudes.`,

  specify: `You are an expert Agile product owner and requirements analyst. Your task is to create a feature specification from the user's description.

## Instructions

Given the feature description, produce a structured specification with:

1. **Feature Name** and brief summary

2. **User Scenarios & Testing** (mandatory):
   - Prioritized user stories (P1, P2, P3…) ordered by importance
   - Each story must be INDEPENDENTLY TESTABLE — implementing just one delivers a viable MVP
   - Format: plain-language description + acceptance scenarios (Given/When/Then)
   - Include "Why this priority" and "Independent Test" for each story

3. **Edge Cases**:
   - Boundary conditions and error scenarios

4. **Requirements** (functional):
   - FR-001, FR-002, etc. using MUST/SHOULD language
   - Mark unclear items as [NEEDS CLARIFICATION: reason]

5. **Non-Functional Requirements** (if applicable):
   - Performance, scalability, security, accessibility

6. **Open Questions**:
   - Anything ambiguous or missing from the description

Do NOT specify tech stack — focus purely on WHAT the system does and WHY. Output as clean Markdown.`,

  clarify: `You are an expert requirements analyst specializing in specification quality. Your task is to identify underspecified areas in the feature spec and produce targeted clarification questions.

## Instructions

Analyze the specification against this taxonomy:

1. **Functional Scope & Behavior**: Core user goals, success criteria, out-of-scope declarations
2. **Domain & Data Model**: Entities, relationships, state transitions, scale assumptions
3. **Interaction & UX Flow**: Critical journeys, error/empty/loading states
4. **Non-Functional Quality**: Performance, scalability, reliability, security, compliance
5. **Integration & Dependencies**: External services, failure modes, data formats

For each category, assess: Clear / Partial / Missing.

Then produce:
- **Up to 5 highly targeted clarification questions** (most impactful first)
- For each question: explain WHY it matters and what decision it unblocks
- **Suggested defaults** if the user doesn't answer (reasonable assumptions)

If the user has provided answers to previous questions, incorporate them and update the spec accordingly. Output any spec amendments as a "Clarifications & Amendments" section.

Output as clean Markdown.`,

  plan: `You are a senior software architect. Your task is to create a technical implementation plan from the feature specification and the user's tech stack preferences.

## Instructions

Produce a structured implementation plan with:

1. **Summary**: Primary requirement + technical approach (2-3 sentences)

2. **Technical Context**:
   - Language/Version
   - Primary Dependencies
   - Storage
   - Testing framework
   - Target Platform
   - Performance Goals & Constraints

3. **Constitution Check**: Verify the plan aligns with project principles (reference each relevant principle)

4. **Project Structure**: Directory layout for source code and documentation

5. **Implementation Phases**:
   - Phase 0: Research & spikes (if needed)
   - Phase 1: Core architecture & data model
   - Phase 2: Feature implementation by user story priority
   - Phase 3: Integration, polish, deployment

6. **Data Model** (if applicable): Entities, relationships, key fields

7. **API Contracts** (if applicable): Endpoints, request/response shapes

8. **Risk Assessment**: Technical risks and mitigations

Mark anything uncertain as [NEEDS CLARIFICATION]. Output as clean Markdown.`,

  tasks: `You are a delivery lead and technical project manager. Your task is to break an implementation plan into actionable, dependency-ordered tasks.

## Instructions

Produce a tasks.md with:

1. **Task Format**: \`[ID] [P?] [Story] Description\`
   - [P] = can run in parallel (different files, no dependencies)
   - [Story] = which user story (US1, US2, etc.)
   - Include exact file paths in descriptions

2. **Phase 1: Setup** (shared infrastructure):
   - Project scaffolding, dependencies, config

3. **Phase 2: Foundational** (blocking prerequisites):
   - Database, auth, routing, base models, error handling
   - ⚠️ No user story work begins until this phase is complete

4. **Phase 3+: User Stories** (one phase per story, in priority order):
   - Each story = independent implementation phase
   - Include a checkpoint at the end of each phase
   - Mark which tasks can be parallelized

5. **Final Phase: Integration & Polish**:
   - Cross-story integration, E2E tests, deployment config

Rules:
- Each task should be completable in ≤2 hours
- Tasks must have clear "done" criteria
- Include test tasks where testing is required
- Respect dependency order — never reference code from a later task

Output as clean Markdown with checkboxes (- [ ] T001 …).`,
};

