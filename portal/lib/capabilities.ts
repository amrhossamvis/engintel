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
  /** Egyptian-pantheon codename — a nod to what the capability does */
  codename: string;
  /** who the deity was — the mythology, shown in the detail view */
  codenameWho: string;
  /** why the deity fits this capability, shown in the detail view */
  codenameWhy: string;
  tagline: string;
  description: string;
  category: string;
  status: Status;
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

export const CAPABILITIES: Capability[] = [
  {
    id: "pr-review",
    name: "PR Reviewer",
    codename: "Maat",
    codenameWho:
      "Goddess of truth, justice, order and balance. She judged whether a soul was worthy by weighing its heart against the Feather of Truth.",
    codenameWhy:
      "A PR reviewer does the same: it weighs code against engineering guidelines, coding standards and best practices before deciding whether it's worthy to merge.",
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
    id: "bug-triage",
    name: "Bug Triage",
    codename: "Anubis",
    codenameWho:
      "God of the dead and guide of souls through the afterlife. He oversaw the judgment process and led each soul to the truth.",
    codenameWhy:
      "Triage follows a bug's trail — signals, logs and history — back to its true origin and owning team, much like Anubis guides souls to their final judgment.",
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
    id: "feature-breakdown",
    name: "Feature Breakdown",
    codename: "Ptah",
    codenameWho:
      "Creator god, patron of craftsmen, architects and builders. Myth says he created the world through thought and speech.",
    codenameWhy:
      "This agent takes a large epic or feature and shapes it into implementable stories and tasks — turning ideas into structured work.",
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
    codename: "Atum",
    codenameWho:
      "The self-created creator god who rose alone from the primordial waters of Nun and brought the universe and the first gods into being from nothing, by his own will.",
    codenameWhy:
      "This agent starts from nothing but a business intent — no existing work item — and brings a whole Epic → Feature → Story universe into being. Atum's creation from pure will mirrors turning raw intent into a complete backlog.",
    tagline: "Business intent → full Epic hierarchy",
    description:
      "Takes a plain-language business intent plus delivery metadata and generates a complete Epic with child Features and User Stories — applying team-specific breakdown rules. Creates the whole hierarchy in ADO, assigned to you.",
    category: "Agile & Backlog",
    status: "live",
    icon: "Sparkles",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 350,
    estDuration: "4–8 min",
    pipeline: "cicd/pipelines/business-intent.yml",
    script: "ado_copilot_business_intent_item_creation.py",
    guild: "product",
    provider: ["ado"],
    execution: "pipeline",
    source: "native",
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
    id: "sprint-health",
    name: "Sprint Health Coach",
    codename: "Sekhmet",
    codenameWho:
      "Warrior goddess of both destruction and healing. Though fierce, she was also worshipped as a goddess of medicine and recovery.",
    codenameWhy:
      "The Sprint Health agent diagnoses delivery issues, surfaces blockers and prescribes corrective actions to keep the team healthy and productive.",
    tagline: "Live delivery-health signals",
    description:
      "Scans the team backlog and iteration for WIP overload, stale items, blocked work and PR wait times, then coaches the squad with prioritised actions.",
    category: "Delivery Intelligence",
    status: "soon",
    icon: "Activity",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 180,
    estDuration: "2–5 min",
    pipeline: "cicd/pipelines/sprint-health.yml",
    script: "ado_sprint_health_coach.py",
    guild: "cross-guild",
    provider: ["ado"],
    execution: "pipeline",
    source: "native",
    credGate: "copilot",
    fields: [
      {
        key: "backlogUrl",
        label: "Team backlog URL",
        type: "url",
        placeholder: "https://dev.azure.com/vfuk-digital/Digital/_backlogs/backlog/MVA-Alex",
        required: true,
      },
      {
        key: "iteration",
        label: "Iteration path (optional)",
        type: "text",
        placeholder: "Digital\\PI 41\\41.1",
      },
    ],
  },
  {
    id: "testcase-ado",
    name: "Test Case Generator",
    codename: "Thoth",
    codenameWho:
      "God of wisdom, knowledge, writing and science. He served as the divine scribe and keeper of all knowledge.",
    codenameWhy:
      "Test case generation is about understanding requirements and documenting them as structured tests — making Thoth the perfect scribe for the job.",
    tagline: "Test cases from a work item",
    description:
      "Generates structured test cases from a user story or feature, ready to import into Azure Test Plans.",
    category: "Quality & Testing",
    status: "soon",
    icon: "FlaskConical",
    tokenEnv: "COPILOT_GITHUB_TOKEN",
    estCredits: 150,
    estDuration: "2–4 min",
    pipeline: "cicd/pipelines/testcase-generation.yml",
    script: "ado_testcase_generator.py",
    guild: "testing",
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
    ],
  },
  {
    id: "testcase-figma",
    name: "Figma Test Cases",
    codename: "Seshat",
    codenameWho:
      "Goddess of writing, architecture, record-keeping and measurement — often regarded as Thoth's counterpart, who 'stretched the cord' to lay out every temple.",
    codenameWhy:
      "This agent translates UI designs into test scenarios, so Seshat's bond with architecture, documentation and design makes her the ideal choice.",
    tagline: "Test cases from a Figma design",
    description:
      "Reads a Figma frame plus its linked work item and produces UI test cases covering states, edge cases and data variations.",
    category: "Quality & Testing",
    status: "soon",
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
    codename: "Horus",
    codenameWho:
      "God of the sky, symbolised by the all-seeing Eye of Horus — a sign of protection and vision.",
    codenameWhy:
      "This agent scans the UI for missing test IDs, accessibility attributes and automation gaps — the all-seeing eye over the interface.",
    tagline: "Audit test-data IDs in the UI",
    description:
      "Reviews UI changes for missing or inconsistent automation test-data identifiers and flags gaps before they reach the automation suite.",
    category: "Quality & Testing",
    status: "soon",
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
    id: "exec-dashboard",
    name: "Executive Dashboard",
    codename: "Ra",
    codenameWho:
      "The sun god and king of the gods, who sailed across the sky each day seeing all that happened in the Two Lands.",
    codenameWhy:
      "An executive dashboard is the all-seeing eye over delivery — sprint health, velocity and bugs across every team, viewed from above.",
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
    id: "ai-productivity", name: "AI Productivity Index", codename: "Hapi",
    codenameWho: "God of the Nile flood, bringer of the year's abundance.",
    codenameWhy: "Measures the flood of engineering output — the yield of the delivery year.",
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
    id: "mobile-crash", name: "Mobile Crash Intelligence", codename: "Set",
    codenameWho: "God of chaos, storms and sudden violent disorder.",
    codenameWhy: "Crashes are chaos erupting in production; this tames Set's storm into signal.",
    tagline: "Turn crash chaos into ranked, actionable signal",
    description: "Coming soon. Intended locus: hub-inline analytics over crash feeds + ADO.",
    category: "Mobile Quality", icon: "TriangleAlert",
    guild: "mobile", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "app-store-release-risk", name: "App Store Release Risk Scorer", codename: "Shai",
    codenameWho: "God of fate and destiny, who fixed each life's fortune.",
    codenameWhy: "Scores the fate of a store release before it ships.",
    tagline: "Predict release risk before you submit to the store",
    description: "Coming soon. Intended locus: hub-inline scoring over ADO + store signals.",
    category: "Mobile Delivery", icon: "Rocket",
    guild: "mobile", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "mobile-cicd", name: "Mobile CI/CD Intelligence", codename: "Khepri",
    codenameWho: "The scarab of the rising sun, self-renewal and becoming.",
    codenameWhy: "CI/CD is continuous rebirth of the build, each run a new dawn.",
    tagline: "Health and flakiness insight across mobile pipelines",
    description: "Coming soon. Intended locus: hub-inline analytics over ADO + GitHub Actions.",
    category: "Mobile Delivery", icon: "GitBranch",
    guild: "mobile", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "mobile-code-review", name: "Mobile Code Review Assistant", codename: "Wadjet",
    codenameWho: "The cobra guardian, the watchful protective eye of the pharaoh.",
    codenameWhy: "Guards the merge with a watchful eye over mobile code.",
    tagline: "AI review tuned for mobile codebases",
    description: "Coming soon. Intended locus: pipeline (posts review comments) once built.",
    category: "Mobile Quality", icon: "ShieldCheck",
    guild: "mobile", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "mobile-test-gap", name: "Mobile Test Gap Analyzer", codename: "Nephthys",
    codenameWho: "Goddess of the hidden, the unseen and what is mourned.",
    codenameWhy: "Reveals the coverage gaps no one saw.",
    tagline: "Find the untested seams in mobile code",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Mobile Quality", icon: "TestTube",
    guild: "mobile", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "mobile-onboarding", name: "Mobile Onboarding Accelerator", codename: "Bes",
    codenameWho: "Protector of households, mothers and newcomers.",
    codenameWhy: "Shields and speeds the new mobile joiner.",
    tagline: "Get new mobile engineers productive faster",
    description: "Coming soon. Intended locus: hub-inline guide over ADO + GitHub.",
    category: "Mobile Enablement", icon: "Smartphone",
    guild: "mobile", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "delivery-intel", name: "Delivery Intelligence Platform", codename: "Wepwawet",
    codenameWho: "The opener of the ways, the scout who clears the path ahead.",
    codenameWhy: "Maps and clears the delivery path before the team walks it.",
    tagline: "End-to-end delivery flow and bottleneck insight",
    description: "Coming soon. Intended locus: hub-inline analytics over ADO.",
    category: "Delivery Intelligence", icon: "Compass",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "release-risk", name: "Release Risk Scorer", codename: "Meskhenet",
    codenameWho: "Goddess present at birth who foretold each newborn's destiny.",
    codenameWhy: "Predicts a release's fate at the moment of its birth.",
    tagline: "Score the risk of any release before it goes out",
    description: "Coming soon. Intended locus: hub-inline scoring over ADO.",
    category: "Delivery Intelligence", icon: "Gauge",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "dependency-radar", name: "Dependency & Blocker Radar", codename: "Sobek",
    codenameWho: "The crocodile god lurking in the Nile, watching the waters.",
    codenameWhy: "Spots blockers and threats before they surface.",
    tagline: "Surface cross-team blockers and risky dependencies early",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Delivery Intelligence", icon: "Radar",
    guild: "cross-guild", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "test-gap", name: "Test Gap Analyzer", codename: "Neith",
    codenameWho: "The weaver of the world, goddess of wisdom and war.",
    codenameWhy: "Spots the holes in the test-coverage weave.",
    tagline: "Rank the highest-value testing gaps across the stack",
    description: "Coming soon. Intended locus: hub-inline analysis over ADO.",
    category: "Quality & Testing", icon: "TestTube2",
    guild: "testing", provider: ["ado"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "dev-onboarding", name: "Developer Onboarding Accelerator", codename: "Hathor",
    codenameWho: "Goddess of welcome, joy and nurture.",
    codenameWhy: "Greets and grows the new developer.",
    tagline: "A guided path for new engineers to first commit",
    description: "Coming soon. Intended locus: hub-inline guide over ADO + GitHub.",
    category: "Enablement", icon: "UserPlus",
    guild: "cross-guild", provider: ["ado", "github"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "knowledge-copilot", name: "Engineering Knowledge Copilot", codename: "Imhotep",
    codenameWho: "The deified engineer-sage, patron of knowledge and medicine.",
    codenameWhy: "The wisdom copilot — the engineer who became a god of knowledge.",
    tagline: "Ask engineering questions, get grounded answers",
    description: "Coming soon. Intended locus: hub-inline chat over internal knowledge + LLM.",
    category: "Enablement", icon: "BookMarked",
    guild: "cross-guild", provider: ["internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
  },
  {
    id: "story-extractor", name: "Story Extractor", codename: "Sia",
    codenameWho: "The personification of perception and insight, the mind of Ra.",
    codenameWhy: "Extracts meaning and structured stories from raw documents.",
    tagline: "Turn documents into structured, ready-to-refine stories",
    description:
      "Coming soon (real feature — full port scheduled in the Story Extractor dedicated plan, 4d). Intended locus: hub-inline / pipeline for work-item creation.",
    category: "Agile & Backlog", icon: "ScanText",
    guild: "product", provider: ["ado", "internal"],
    execution: "hub-inline", source: "hub-a", credGate: "none",
    estCredits: 0, estDuration: "—", status: "soon", fields: [],
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
