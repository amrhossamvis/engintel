export type FieldType = "url" | "text" | "textarea" | "select" | "toggle";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  default?: string | boolean;
};

export type Status = "live" | "soon";

export type Guild = "mobile" | "web" | "java" | "full-stack" | "product" | "testing" | "cross-guild";
export type Provider = "ado" | "github" | "jira" | "datadog" | "internal";
export type Execution = "pipeline" | "hub-inline" | "local";
export type Source = "native" | "hub-a";

// Fixed taxonomy (NOT derived) so empty guilds still render as views.
export const GUILDS: Guild[] = ["mobile", "web", "java", "full-stack", "product", "testing", "cross-guild"];

export type Capability = {
  id: string;
  name: string;
  /** SDLC phase this capability lives in — Plan, Design, Development, Testing, Release, Monitoring */
  codename: string;
  /** what the SDLC phase is, shown in the detail view */
  codenameWho: string;
  /** why this capability belongs to that phase, shown in the detail view */
  codenameWhy: string;
  tagline: string;
  description: string;
  category: string;
  status: Status;
  /** target release quarter for 'soon' capabilities (e.g. "Q3 2026") */
  targetRelease?: string;
  icon: string; // lucide icon key, mapped in components/icons.ts
  /** env var the capability reads as the per-run identity token (copilot runs only) */
  tokenEnv?: string;
  /** estimated GitHub Copilot AI credits burned per run */
  estCredits: number;
  /** typical wall-clock for a run, shown in UI */
  estDuration: string;
  /** ADO pipeline this maps to (cicd/pipelines/*.yml) — pipeline execution only */
  pipeline?: string;
  script?: string;
  fields: Field[];

  guild: Guild;
  provider: Provider[];
  execution: Execution;
  source: Source;
  credGate: "copilot" | "none";
};

// AI-Powered SDLC Transformation phases, grouped Planning & Analysis / Build & Quality / Delivery & Operations.
const PHASE = {
  plan: "Plan — the Planning & Analysis phase: backlog analysis and prioritization, requirements validation and enrichment, and early gap, risk and dependency detection — so work starts with less rework and a ready, aligned backlog.",
  design:
    "Design — the Planning & Analysis phase where validated requirements are shaped and enriched into a solution before build.",
  development:
    "Development — the Build & Quality phase: AI-assisted development, code optimization and documentation/knowledge generation — cutting cycle time and manual review effort while lifting code quality.",
  testing:
    "Testing — the Build & Quality phase: test design and lifecycle quality enforcement — lifting coverage while cutting manual test effort.",
  release:
    "Release — the Delivery & Operations phase: release risk assessment and dependency/version management — so ships go out with confidence.",
  monitoring:
    "Monitoring — the Delivery & Operations phase: monitoring, anomaly detection and incident recovery — cutting production incidents and MTTR while raising reliability.",
} as const;

export const CAPABILITIES: Capability[] = [
  {
    id: "bug-triage",
    name: "Bug Triage",
    codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy:
      "It picks up production signals — logs, history and linked PRs — diagnoses the failing service and routes the bug to its owning team, shortening incident recovery.",
    tagline: "Diagnose the service and route the bug to its owning team",
    description:
      "Pulls bug context, screenshots, history and linked PRs, correlates DataDog logs, then diagnoses the affected service and owning team and posts the triage back to the work item.",
    category: "Quality & Review",
    status: "live",
    icon: "Bug",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 200,
    estDuration: "3–5 min",
    pipeline: "cicd/pipelines/bug-triage.yml",
    script: "ado_copilot_bug_triage.py",
    guild: "cross-guild",
    provider: ["ado", "datadog"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "bugUrl",
        label: "Bug URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4184017",
        help: "The bug id is parsed from the link.",
        required: true,
      },
    ],
  },
  {
    id: "exec-dashboard",
    name: "Executive Dashboard",
    codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy:
      "It reads completed sprints and scores delivery health — the monitoring view of velocity, completion and bugs across teams.",
    tagline: "Delivery health at a glance — score, trend, bugs, current sprint",
    description:
      "Reads a team's last 6 ADO sprints and computes a health score (RAG) from completion, velocity stability and bug resolution, with delivery/bug trend charts, sprint history and current-sprint stats. Completed sprints only. Read-only. Enter your team below.",
    category: "Delivery Intelligence",
    status: "live",
    icon: "LayoutDashboard",
    estCredits: 0,
    estDuration: "5–15 sec",
    guild: "cross-guild",
    provider: ["ado"],
    execution: "hub-inline",
    source: "hub-a",
    credGate: "none",
    fields: [
      { key: "team", label: "ADO team", type: "text", default: "VOXI Digital", placeholder: "VOXI Digital", help: "The Azure DevOps team whose sprints are scored." },
    ],
  },
  {
    id: "ai-productivity", name: "AI Productivity Index", codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy: "It rolls delivery, quality, velocity, PR speed and AI adoption into one monitoring index, with a £ ROI estimate.",
    tagline: "One 0–100 score for delivery, quality, velocity, PR speed and AI adoption",
    description:
      "Scores a team's last 6 ADO sprints into one 0–100 index across delivery, quality, velocity, PR speed and Copilot adoption — plus a £ ROI estimate. Read-only. Enter your team; Copilot fields optional.",
    category: "Delivery Intelligence", icon: "Activity",
    guild: "cross-guild", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "5–15 sec", status: "live",
    fields: [
      { key: "team", label: "ADO team", type: "text", default: "VOXI Digital", placeholder: "VOXI Digital", help: "The Azure DevOps team whose sprints are scored." },
      { key: "copilotAcceptanceRate", label: "Copilot acceptance rate % (optional)", type: "text" },
      { key: "copilotActiveUsers", label: "Copilot active users (optional)", type: "text" },
      { key: "copilotTotalSuggestions", label: "Copilot total suggestions (optional)", type: "text" },
      { key: "copilotAcceptedSuggestions", label: "Copilot accepted suggestions (optional)", type: "text" },
      { key: "copilotLinesAccepted", label: "Copilot lines accepted (optional)", type: "text" },
    ],
  },
  {
    id: "pr-review",
    name: "PR Reviewer",
    codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy:
      "It weighs every pull request against engineering guidelines, coding standards and best practices before merge — cutting manual code-review effort while lifting code quality.",
    tagline: "AI review on every pull request",
    description:
      "Reads the PR diff, linked work items and repo coding guidelines, then posts inline + summary review comments. Blocks merge only on high-severity, high-confidence findings.",
    category: "Quality & Review",
    status: "live",
    icon: "GitPullRequest",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 120,
    estDuration: "2–4 min",
    pipeline: "cicd/pipelines/pr-reviewer.yml",
    script: "ado_copilot_pr_preview_application_claude.py",
    guild: "cross-guild",
    provider: ["github", "ado"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "prUrl",
        label: "Pull Request URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_git/repo/pullrequest/12345",
        help: "Org, project, repo and PR id are parsed from the link.",
        required: true,
      },
      {
        key: "dryRun",
        label: "Dry run (no comments posted)",
        type: "toggle",
        default: false,
      },
    ],
  },
  {
    id: "feature-breakdown",
    name: "Feature Breakdown",
    codename: "Plan",
    codenameWho: PHASE.plan,
    codenameWhy:
      "It decomposes an epic or feature into implementable stories and tasks with acceptance criteria — backlog readiness before build begins.",
    tagline: "Epic → Feature → Story decomposition",
    description:
      "Reverse-engineers an epic or feature into a structured backlog with acceptance criteria, applying team-specific breakdown instructions. Creates child work items in ADO.",
    category: "Agile & Backlog",
    status: "live",
    icon: "Layers",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 350,
    estDuration: "4–8 min",
    pipeline: "cicd/pipelines/workitem-breakdown.yml",
    script: "ado_copilot_workitem_breakdown.py",
    guild: "product",
    provider: ["ado"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "workItemUrl",
        label: "Work Item URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4184017",
        required: true,
      },
      {
        key: "areaPath",
        label: "Area path (optional — defaults to the work item's own area)",
        type: "text",
        placeholder: "Digital\\Consumer\\VOXI\\VOXI Digital",
      },
      {
        key: "isTechBreakdown",
        label: "Technical breakdown (tech epic/feature)",
        type: "toggle",
        default: false,
      },
      {
        key: "additionalInstructions",
        label: "Additional instructions (optional)",
        type: "textarea",
        placeholder:
          "Team prefix, naming conventions, scope rules, exclusions… applied on top of the generic breakdown rulebook.",
      },
      {
        key: "createParentComment",
        label: "Post summary comment on parent",
        type: "toggle",
        default: true,
      },
      {
        key: "dryRun",
        label: "Dry run (preview, no work items created)",
        type: "toggle",
        default: false,
      },
    ],
  },
  {
    id: "business-intent",
    name: "Business Intent Builder",
    codename: "Plan",
    codenameWho: PHASE.plan,
    codenameWhy:
      "It turns a plain-language business intent into a complete Epic → Feature → Story hierarchy — aligning business and engineering before a line is written.",
    tagline: "Business intent → full Epic hierarchy",
    description:
      "Takes a plain-language business intent plus delivery metadata and generates a complete Epic with child Features and User Stories — applying team-specific breakdown rules. Creates the whole hierarchy in ADO, assigned to you.",
    category: "Agile & Backlog",
    status: "live",
    icon: "Sparkles",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 350,
    estDuration: "1–3 min",
    guild: "product",
    provider: ["ado"],
    execution: "local",
    source: "hub-a",
    credGate: "copilot",
    fields: [
      {
        key: "businessIntent",
        label: "Business intent",
        type: "textarea",
        placeholder:
          "Describe the business outcome you want. e.g. Let VOXI customers pause and resume their plan self-serve from the app…",
        required: true,
      },
      {
        key: "areaPath",
        label: "Area path",
        type: "text",
        placeholder: "Digital\\Consumer\\VOXI\\VOXI Digital",
        help: "Where the Epic and its children are created. Required — there is no source work item to inherit from.",
        required: true,
      },
      {
        key: "iterationPath",
        label: "Iteration path",
        type: "text",
        placeholder: "Digital\\PI 41\\41.1",
        help: "Sprint / iteration the generated items land in. Required.",
        required: true,
      },
      {
        key: "teamName",
        label: "Team breakdown rules",
        type: "select",
        options: ["generic", "mva", "titans", "intensive-care", "voxi"],
        default: "generic",
        help: "Which team's Epic breakdown rulebook to apply — naming, slicing, ownership, rollout, feature-flag, analytics, accessibility and quality rules. Pick your team to shape the generated hierarchy to how your squad works; leave on 'generic' for the default rules. If the selected team has no rulebook yet, it falls back to generic.",
      },
      {
        key: "addGeneratedHierarchyComment",
        label: "Post summary comment on the Epic",
        type: "toggle",
        default: true,
      },
      {
        key: "dryRun",
        label: "Dry run (preview, no work items created)",
        type: "toggle",
        default: false,
      },
    ],
  },
  {
    id: "workitem-wiki-doc",
    name: "Wiki Weaver",
    codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy:
      "It turns a delivery hierarchy already in ADO into living, readable documentation — the documentation/knowledge-generation half of the Development phase.",
    tagline: "Epic/Feature/Story hierarchy → one wiki page, business + tech",
    description:
      "Takes a User Story, Feature or Epic link (or just the id), climbs to the top-level parent, reads its description/acceptance criteria/comments/attached design docs, then reads every child item sharing the same area path — including linked PRs for stories — and publishes one fully detailed wiki page covering business and technical documentation.",
    category: "Enablement",
    status: "live",
    icon: "BookOpen",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 400,
    estDuration: "5–10 min",
    pipeline: "cicd/pipelines/workitem-doc-generator.yml",
    script: "ado_copilot_workitem_doc_generator.py",
    guild: "cross-guild",
    provider: ["ado"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "workItemRef",
        label: "Work item URL or ID",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4126111",
        help: "User Story, Feature or Epic — accepts an edit-view link, a sprint-backlog link (?workitem=), or just the bare number.",
        required: true,
      },
      {
        key: "docLevel",
        label: "Documentation depth",
        type: "select",
        options: ["Feature", "Epic"],
        default: "Feature",
        help: "Feature documents the nearest Feature and its stories only. Epic climbs to the full Epic and everything beneath it. Ignored when the input is already an Epic.",
      },
      {
        key: "docType",
        label: "Documentation type",
        type: "select",
        options: ["Business", "Tech", "Both"],
        default: "Both",
        help: "Business covers outcomes and acceptance criteria in plain language. Tech covers implementation detail from linked PRs. Both produces one page with both sections.",
      },
      {
        key: "wikiParentUrl",
        label: "Wiki parent URL (optional)",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_wiki/wikis/Digital%20X.wiki/80/Digital",
        help: "Paste an ADO wiki page URL to publish the new page underneath. Leave blank to publish under the default parent (Digital X.wiki › Digital) with a name generated from the top parent item.",
      },
      {
        key: "postSummaryComment",
        label: "Post link-back comment on the parent item",
        type: "toggle",
        default: true,
      },
      {
        key: "dryRun",
        label: "Dry run (preview, no wiki page published)",
        type: "toggle",
        default: false,
      },
    ],
  },
  {
    id: "sprint-health",
    name: "Sprint Health Coach",
    codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy:
      "It watches live delivery signals mid-flight — WIP, stale items, blockers and PR wait — detecting anomalies early and coaching the squad to stay healthy.",
    tagline: "Live delivery-health signals",
    description:
      "Scans the team backlog and iteration for WIP overload, stale items, blocked work and PR wait times, then coaches the squad with prioritised actions. Read-only — no AI call, no ADO writes.",
    category: "Delivery Intelligence",
    status: "live",
    icon: "Activity",
    estCredits: 0,
    estDuration: "5–15 sec",
    guild: "cross-guild",
    provider: ["ado"],
    execution: "hub-inline",
    source: "hub-a",
    credGate: "none",
    fields: [
      {
        key: "backlogUrl",
        label: "Team backlog URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_backlogs/backlog/MVA-Alex",
        help: "A team backlog or sprint-taskboard URL — the team name is parsed from it.",
        required: true,
      },
      {
        key: "iteration",
        label: "Iteration (optional)",
        type: "text",
        placeholder: "41.1",
        help: "Leave blank to score the team's current sprint.",
      },
    ],
  },
  {
    id: "testcase-ado",
    name: "Test Case & Automation Generator",
    codename: "Testing",
    codenameWho: PHASE.testing,
    codenameWhy:
      "It generates structured test cases and automation code straight from a work item — test design and scripting lifted off manual effort, ready to run.",
    tagline: "P1/Critical test cases from a work item",
    description:
      "Generates structured P1/Critical test cases from a user story's description and acceptance criteria, then creates them as Test Case work items linked back to the source item.",
    category: "Quality & Testing",
    status: "live",
    icon: "FlaskConical",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 150,
    estDuration: "1–2 min",
    guild: "testing",
    provider: ["ado"],
    execution: "local",
    source: "hub-a",
    credGate: "copilot",
    fields: [
      {
        key: "workItemUrl",
        label: "Work Item URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4184017",
        help: "Accepts an edit-view link or the bare work item number.",
        required: true,
      },
    ],
  },
  {
    id: "testcase-figma",
    name: "Figma Test Cases",
    codename: "Testing",
    codenameWho: PHASE.testing,
    codenameWhy:
      "It reads a design frame and its linked work item to produce UI test cases covering states, edge cases and data variations — coverage without the manual effort.",
    tagline: "Test cases from a Figma design",
    description:
      "Reads a Figma frame plus its linked work item and produces UI test cases covering states, edge cases and data variations.",
    category: "Quality & Testing",
    status: "soon",
    targetRelease: "Q4 2026",
    icon: "Frame",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 220,
    estDuration: "3–6 min",
    pipeline: "cicd/pipelines/testcase-generation.yml",
    script: "ado-figma_testcase_generator.py",
    guild: "testing",
    provider: ["ado", "internal"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "figmaUrl",
        label: "Figma frame URL",
        type: "url",
        placeholder: "https://www.figma.com/design/<file>/<frame>",
        required: true,
      },
      {
        key: "workItemUrl",
        label: "Linked work item URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4184017",
      },
    ],
  },
  {
    id: "ui-testdata",
    name: "UI Test Data Reviewer",
    codename: "Testing",
    codenameWho: PHASE.testing,
    codenameWhy:
      "It audits the UI for missing automation test-data IDs so the suite has stable hooks — quality enforced before tests are written.",
    tagline: "Audit test-data IDs in the UI",
    description:
      "Reviews UI changes for missing or inconsistent automation test-data identifiers and flags gaps before they reach the automation suite.",
    category: "Quality & Testing",
    status: "soon",
    targetRelease: "Q3 2026",
    icon: "ScanSearch",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 90,
    estDuration: "1–3 min",
    pipeline: "cicd/pipelines/ui-testdata-review.yml",
    script: "ado_copilot_ui_testdata_id_reviewer.py",
    guild: "testing",
    provider: ["ado"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "prUrl",
        label: "Pull Request URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_git/repo/pullrequest/12345",
        required: true,
      },
    ],
  },
  {
    id: "mobile-crash", name: "Mobile Crash Intelligence", codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy: "It turns post-release crash feeds into ranked, actionable signal — anomaly detection and faster recovery for the mobile team.",
    tagline: "Turn crash chaos into ranked, actionable signal",
    description: "Coming soon. Intended locus: hub-inline analytics over crash feeds + ADO.",
    category: "Mobile Quality", icon: "TriangleAlert",
    guild: "mobile", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q2 2027", fields: [],
  },
  {
    id: "app-store-release-risk", name: "App Store Release Risk Scorer", codename: "Release",
    codenameWho: PHASE.release,
    codenameWhy: "It scores the risk of a store submission before you ship — release confidence, eyes open.",
    tagline: "Predict release risk before you submit to the store",
    description: "Coming soon. Intended locus: hub-inline scoring over ADO + store signals.",
    category: "Mobile Delivery", icon: "Rocket",
    guild: "mobile", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q2 2027", fields: [],
  },
  {
    id: "mobile-cicd", name: "Mobile CI/CD Intelligence", codename: "Release",
    codenameWho: PHASE.release,
    codenameWhy: "It surfaces pipeline health and flakiness across mobile CI/CD so builds ship reliably.",
    tagline: "Health and flakiness insight across mobile pipelines",
    description: "Coming soon. Intended locus: hub-inline analytics over ADO + GitHub Actions.",
    category: "Mobile Delivery", icon: "GitBranch",
    guild: "mobile", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q2 2027", fields: [],
  },
  {
    id: "mobile-code-review", name: "Mobile Code Review Assistant", codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy: "It reviews mobile changes against platform conventions before they merge — code quality without the manual effort.",
    tagline: "AI review tuned for mobile codebases",
    description: "Coming soon. Intended locus: pipeline (posts review comments) once built.",
    category: "Mobile Quality", icon: "ShieldCheck",
    guild: "mobile", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q3 2027", fields: [],
  },
  {
    id: "mobile-test-gap", name: "Mobile Test Gap Analyzer", codename: "Testing",
    codenameWho: PHASE.testing,
    codenameWhy: "It finds the untested seams in mobile code so coverage lands where it matters.",
    tagline: "Find the untested seams in mobile code",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Mobile Quality", icon: "TestTube",
    guild: "mobile", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q3 2027", fields: [],
  },
  {
    id: "mobile-onboarding", name: "Mobile Onboarding Accelerator", codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy: "It ramps new mobile engineers to their first productive commit faster — documentation and knowledge generation in action.",
    tagline: "Get new mobile engineers productive faster",
    description: "Coming soon. Intended locus: hub-inline guide over ADO + GitHub.",
    category: "Mobile Enablement", icon: "Smartphone",
    guild: "mobile", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q3 2027", fields: [],
  },
  {
    id: "delivery-intel", name: "Delivery Intelligence Platform", codename: "Monitoring",
    codenameWho: PHASE.monitoring,
    codenameWhy: "It maps end-to-end delivery flow and surfaces the bottlenecks slowing the team.",
    tagline: "End-to-end delivery flow and bottleneck insight",
    description: "Coming soon. Intended locus: hub-inline analytics over ADO.",
    category: "Delivery Intelligence", icon: "Compass",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q4 2026", fields: [],
  },
  {
    id: "release-risk", name: "Release Risk Scorer", codename: "Release",
    codenameWho: PHASE.release,
    codenameWhy: "It scores the risk of any release before it goes out, from ADO delivery signals — release confidence at the gate.",
    tagline: "Score the risk of any release before it goes out",
    description: "Coming soon. Intended locus: hub-inline scoring over ADO.",
    category: "Delivery Intelligence", icon: "Gauge",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q1 2027", fields: [],
  },
  {
    id: "dependency-radar", name: "Dependency & Blocker Radar", codename: "Release",
    codenameWho: PHASE.release,
    codenameWhy: "It surfaces cross-team blockers and risky dependencies early — dependency and version management before they stall delivery.",
    tagline: "Surface cross-team blockers and risky dependencies early",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Delivery Intelligence", icon: "Radar",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q1 2027", fields: [],
  },
  {
    id: "test-gap", name: "Test Gap Analyzer", codename: "Testing",
    codenameWho: PHASE.testing,
    codenameWhy: "It ranks the highest-value testing gaps across the stack.",
    tagline: "Rank the highest-value testing gaps across the stack",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Quality & Testing", icon: "TestTube2",
    guild: "testing", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q4 2026", fields: [],
  },
  {
    id: "dev-onboarding", name: "Developer Onboarding Accelerator", codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy: "It gives new engineers a guided path to their first commit — documentation and knowledge generation that cuts cycle time.",
    tagline: "A guided path for new engineers to first commit",
    description: "Coming soon. Intended locus: hub-inline guide over ADO + GitHub.",
    category: "Enablement", icon: "UserPlus",
    guild: "cross-guild", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q3 2027", fields: [],
  },
  {
    id: "knowledge-copilot", name: "Engineering Knowledge Copilot", codename: "Development",
    codenameWho: PHASE.development,
    codenameWhy: "It answers engineering questions with grounded, source-backed answers — documentation and knowledge generation on demand.",
    tagline: "Ask engineering questions, get grounded answers",
    description: "Coming soon. Intended locus: hub-inline chat over internal knowledge + LLM.",
    category: "Enablement", icon: "BookMarked",
    guild: "cross-guild", provider: ["internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q1 2027", fields: [],
  },
  {
    id: "story-extractor", name: "Story Extractor", codename: "Plan",
    codenameWho: PHASE.plan,
    codenameWhy: "It turns raw documents into structured, ready-to-refine stories — backlog readiness from the top.",
    tagline: "Turn documents into structured, ready-to-refine stories",
    description:
      "Coming soon (real feature — full port scheduled in the Story Extractor dedicated plan, 4d). Intended locus: hub-inline / pipeline for work-item creation.",
    category: "Agile & Backlog", icon: "ScanText",
    guild: "product", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", targetRelease: "Q3 2026", fields: [],
  },
];

export const CATEGORIES = Array.from(
  new Set(CAPABILITIES.map((c) => c.category)),
);

export function getCapability(id: string) {
  return CAPABILITIES.find((c) => c.id === id);
}

/** Shared tools available to every guild. */
export function commonCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.guild === "cross-guild");
}

/** A guild's own dedicated tools (excludes shared cross-guild tools). */
export function ownCapabilitiesForGuild(guild: Guild): Capability[] {
  return CAPABILITIES.filter((c) => c.guild === guild);
}

export function guildHasOwnCapabilities(guild: Guild): boolean {
  return CAPABILITIES.some((c) => c.guild === guild);
}
