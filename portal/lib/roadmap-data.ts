// AI learning roadmap for the hub — content draft for review before any UI is built.
// Two tracks off a shared entry: most engineers take "Copilot Power User"; those
// building AI features take "AI Engineer". Links are canonical/official sources.

export type ResourceType =
  | "internal" // a page inside this hub
  | "docs"
  | "course"
  | "interactive"
  | "video"
  | "cert"
  | "blog";

export interface RoadmapResource {
  label: string;
  url: string;
  type: ResourceType;
  free?: boolean;
}

export interface RoadmapNode {
  id: string;
  title: string;
  /** One line: why an engineer should care / what they can do after. */
  why: string;
  resources: RoadmapResource[];
}

export interface RoadmapStage {
  id: string;
  title: string;
  nodes: RoadmapNode[];
}

export interface RoadmapTrack {
  id: string;
  title: string;
  audience: string;
  /** Rough time to work through the track. */
  effort: string;
  stages: RoadmapStage[];
}

// Vodafone-internal references (SharePoint).
const VF_VCIRCLE_GITHUB_COPILOT =
  "https://vodafone.sharepoint.com/sites/TheVCircleRoundtable/SitePages/GitHub-%26-GitHub-Copilot.aspx";
const VF_COPILOT_COMMUNITY_RECORDINGS =
  "https://vodafone.sharepoint.com/sites/vodafonegithubcopilotcommunity/Shared%20Documents/Forms/AllItems.aspx?id=/sites/vodafonegithubcopilotcommunity/Shared%20Documents/Apps/Viva%20Engage/GitHub%20Copilot%20Drop-in%20Recordings&p=true&ga=1";

// ── Shared nodes (referenced by both tracks) ────────────────────────────────
const ACCESS_STAGE: RoadmapStage = {
  id: "access",
  title: "Stage 0 · Access & Setup",
  nodes: [
    {
      id: "get-copilot-access",
      title: "Get your Copilot license (VOIS)",
      why: "Nothing else matters until you have a seat. Pick your path — GitHub Cloud vs Standalone — and raise the UAM request.",
      resources: [
        { label: "VOIS Copilot Access guide", url: "/docs/copilot-access", type: "internal" },
        { label: "VCircle: GitHub & Copilot at Vodafone", url: VF_VCIRCLE_GITHUB_COPILOT, type: "docs" },
      ],
    },
    {
      id: "ide-setup",
      title: "Install & sign in (IDE)",
      why: "Get Copilot running in VS Code / JetBrains / Visual Studio and authenticate via Vodafone SSO.",
      resources: [
        { label: "Set up Copilot in your IDE", url: "https://docs.github.com/en/copilot/managing-copilot/configure-personal-settings/installing-the-github-copilot-extension-in-your-environment", type: "docs" },
      ],
    },
    {
      id: "pick-llm",
      title: "Choose a Vodafone-approved LLM",
      why: "Copilot lets you pick the model. Use only Vodafone-approved LLMs for compliance.",
      resources: [
        { label: "Approved LLMs (internal)", url: "/docs/copilot-access#approved-llms", type: "internal" },
      ],
    },
  ],
};

const RESPONSIBLE_AI_STAGE: RoadmapStage = {
  id: "responsible-ai",
  title: "Responsible AI (required for everyone)",
  nodes: [
    {
      id: "no-secrets",
      title: "Never paste secrets or PII into prompts",
      why: "Prompts can be logged/processed. Keep credentials, customer data and PII out — always.",
      resources: [
        { label: "GitHub Copilot Trust Center", url: "https://resources.github.com/copilot-trust-center/", type: "docs" },
      ],
    },
    {
      id: "review-output",
      title: "Always review AI output",
      why: "Copilot suggests; you are accountable. Review for correctness, licensing and security before you ship.",
      resources: [
        { label: "Responsible use of Copilot", url: "https://docs.github.com/en/copilot/responsible-use-of-github-copilot-features", type: "docs" },
      ],
    },
    {
      id: "prompt-injection",
      title: "Understand prompt injection",
      why: "Untrusted content (issues, web pages, files) can hijack an AI. Know the risk when using agents/RAG.",
      resources: [
        { label: "roadmap.sh: prompt injection", url: "https://roadmap.sh/prompt-engineering", type: "interactive", free: true },
      ],
    },
  ],
};

// ── Track A · Copilot Power User ────────────────────────────────────────────
const TRACK_POWER_USER: RoadmapTrack = {
  id: "copilot-power-user",
  title: "Copilot Power User",
  audience: "Every engineer who wants to ship faster with AI",
  effort: "~1–2 weeks, part-time",
  stages: [
    ACCESS_STAGE,
    {
      id: "fundamentals",
      title: "Stage 1 · Copilot Fundamentals",
      nodes: [
        {
          id: "inline-suggestions",
          title: "Inline suggestions",
          why: "Accept, reject and cycle completions as you type — the core daily loop.",
          resources: [
            { label: "GitHub Skills: Getting Started with Copilot", url: "https://github.com/skills/getting-started-with-github-copilot", type: "interactive", free: true },
            { label: "MS Learn: Introduction to GitHub Copilot", url: "https://learn.microsoft.com/en-us/training/modules/introduction-to-github-copilot/", type: "course", free: true },
          ],
        },
        {
          id: "copilot-chat",
          title: "Copilot Chat",
          why: "Ask questions about your code, generate tests, explain errors — in-editor conversation.",
          resources: [
            { label: "MS Learn: Copilot Fundamentals path", url: "https://learn.microsoft.com/en-us/training/paths/copilot/", type: "course", free: true },
          ],
        },
        {
          id: "chat-modes",
          title: "Chat modes: Ask · Edit · Plan · Agent",
          why: "Each mode fits a different job — from a quick answer to multi-file changes. Know when to use which.",
          resources: [
            { label: "Copilot Chat docs", url: "https://docs.github.com/en/copilot/using-github-copilot/copilot-chat", type: "docs" },
          ],
        },
        {
          id: "commit-messages",
          title: "AI commit messages",
          why: "Generate clear commit messages from your diff — small win, every commit.",
          resources: [
            { label: "Copilot in your editor", url: "https://docs.github.com/en/copilot", type: "docs" },
          ],
        },
        {
          id: "vodafone-community",
          title: "Learn from the Vodafone community",
          why: "See how Vodafone teams actually use Copilot — drop-in recordings, tips and the internal hub.",
          resources: [
            { label: "Copilot Community drop-in recordings", url: VF_COPILOT_COMMUNITY_RECORDINGS, type: "video" },
            { label: "VCircle: GitHub & Copilot", url: VF_VCIRCLE_GITHUB_COPILOT, type: "docs" },
          ],
        },
      ],
    },
    {
      id: "prompting",
      title: "Stage 2 · Prompting",
      nodes: [
        {
          id: "prompt-basics",
          title: "Prompt engineering basics",
          why: "Better prompts = better output. Be specific, give context, show examples.",
          resources: [
            { label: "MS Learn: Prompt engineering with Copilot", url: "https://learn.microsoft.com/en-us/training/modules/introduction-prompt-engineering-with-github-copilot/", type: "course", free: true },
            { label: "DeepLearning.AI: Prompt Engineering for Devs", url: "https://www.deeplearning.ai/courses/chatgpt-prompt-eng", type: "course", free: true },
          ],
        },
        {
          id: "custom-instructions",
          title: "Custom instructions & prompt files",
          why: "Teach Copilot your project's conventions once so every suggestion fits your codebase.",
          resources: [
            { label: "Repository custom instructions", url: "https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot", type: "docs" },
          ],
        },
        {
          id: "practice-playground",
          title: "Practice in the Playground",
          why: "Try personas and prompts risk-free in the hub before using them on real work.",
          resources: [
            { label: "Open the Playground", url: "/playground", type: "internal" },
          ],
        },
      ],
    },
    {
      id: "workflow",
      title: "Stage 3 · Copilot in the workflow",
      nodes: [
        {
          id: "tests-debug",
          title: "Tests, debugging & refactoring",
          why: "Use Copilot to write tests, explain failures and refactor safely.",
          resources: [
            { label: "MS Learn: Copilot Bootcamp", url: "https://learn.microsoft.com/en-us/shows/github-copilot-bootcamp/", type: "video", free: true },
          ],
        },
        {
          id: "code-review-pr",
          title: "Code review & PR summaries",
          why: "Copilot can review PRs and summarise changes (GitHub Cloud) — faster, more consistent reviews.",
          resources: [
            { label: "Copilot code review", url: "https://docs.github.com/en/copilot/using-github-copilot/code-review", type: "docs" },
          ],
        },
      ],
    },
    {
      id: "agent-mode",
      title: "Stage 4 · Agent mode & customization",
      nodes: [
        {
          id: "agent-mode-node",
          title: "Agent mode",
          why: "Let Copilot plan and make multi-file changes end-to-end, with you approving each step.",
          resources: [
            { label: "Copilot agent mode", url: "https://docs.github.com/en/copilot/using-github-copilot/using-copilot-agent-mode", type: "docs" },
          ],
        },
        {
          id: "mcp-extensions",
          title: "MCP & extensions",
          why: "Connect Copilot to tools and data via the Model Context Protocol for context-aware help.",
          resources: [
            { label: "Model Context Protocol", url: "https://modelcontextprotocol.io", type: "docs" },
          ],
        },
        {
          id: "spec-kit",
          title: "Spec-driven development",
          why: "Turn a spec into plan → tasks → code. Try the hub's Spec Kit workflow.",
          resources: [
            { label: "Spec Kit in the Playground", url: "/playground/speckit", type: "internal" },
          ],
        },
      ],
    },
    RESPONSIBLE_AI_STAGE,
    {
      id: "certify",
      title: "Stage 5 · Certify (hero badge)",
      nodes: [
        {
          id: "gh-300",
          title: "GitHub Copilot certification (GH-300)",
          why: "Prove your skills. Covers features, prompting, responsible use and privacy.",
          resources: [
            { label: "GH-300 course", url: "https://learn.microsoft.com/en-us/training/courses/gh-300t00", type: "course", free: true },
            { label: "Copilot certification", url: "https://learn.microsoft.com/en-us/credentials/certifications/github-copilot/", type: "cert" },
          ],
        },
      ],
    },
  ],
};

// ── Track B · AI Engineer / Builder ─────────────────────────────────────────
const TRACK_AI_ENGINEER: RoadmapTrack = {
  id: "ai-engineer",
  title: "AI Engineer",
  audience: "Engineers building AI features with GitHub Copilot & GitHub Models",
  effort: "~6–10 weeks, part-time",
  stages: [
    ACCESS_STAGE,
    {
      id: "llm-foundations",
      title: "Stage 1 · LLM foundations",
      nodes: [
        {
          id: "how-llms-work",
          title: "How LLMs work",
          why: "Tokens, context window, temperature, embeddings — the mental model behind every AI feature.",
          resources: [
            { label: "roadmap.sh: AI Engineer", url: "https://roadmap.sh/ai-engineer", type: "interactive", free: true },
            { label: "Try models in GitHub Models playground", url: "https://github.com/marketplace/models", type: "interactive", free: true },
          ],
        },
        {
          id: "ai-for-beginners",
          title: "Broader AI fundamentals",
          why: "Optional grounding in ML/AI concepts if you're new to the field.",
          resources: [
            { label: "Microsoft: AI for Beginners (12 wk)", url: "https://github.com/microsoft/ai-for-beginners", type: "course", free: true },
          ],
        },
      ],
    },
    {
      id: "using-models",
      title: "Stage 2 · Building with GitHub Models",
      nodes: [
        {
          id: "github-models-api",
          title: "Call models with the GitHub Models API",
          why: "Vodafone's platform: hit hosted models through GitHub with your token — messages, streaming, structured output, cost.",
          resources: [
            { label: "GitHub Models docs", url: "https://docs.github.com/en/github-models", type: "docs" },
            { label: "GitHub Models marketplace", url: "https://github.com/marketplace/models", type: "interactive", free: true },
          ],
        },
        {
          id: "tool-calling",
          title: "Tool / function calling",
          why: "Let the model call your functions — the primitive behind agents and integrations.",
          resources: [
            { label: "GitHub Models: prototyping with AI", url: "https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models", type: "docs" },
          ],
        },
        {
          id: "ai-sdk",
          title: "An AI SDK",
          why: "A framework (Vercel AI SDK / LangChain) speeds up building — streaming, tools, providers. Both support GitHub Models as a provider.",
          resources: [
            { label: "Vercel AI SDK", url: "https://ai-sdk.dev/docs", type: "docs" },
          ],
        },
      ],
    },
    {
      id: "prompt-engineering",
      title: "Stage 3 · Prompt engineering",
      nodes: [
        {
          id: "context-engineering",
          title: "Context engineering",
          why: "The context window is a token budget — spend it well: system prompt, examples, retrieved data.",
          resources: [
            { label: "roadmap.sh: Prompt Engineering", url: "https://roadmap.sh/prompt-engineering", type: "interactive", free: true },
            { label: "MS Learn: Prompt engineering with Copilot", url: "https://learn.microsoft.com/en-us/training/modules/introduction-prompt-engineering-with-github-copilot/", type: "course", free: true },
          ],
        },
      ],
    },
    {
      id: "rag",
      title: "Stage 4 · RAG (retrieval-augmented generation)",
      nodes: [
        {
          id: "embeddings-vectors",
          title: "Embeddings & vector search",
          why: "Turn text into vectors and retrieve relevant chunks to ground answers in your data.",
          resources: [
            { label: "roadmap.sh: RAG section", url: "https://roadmap.sh/ai-engineer", type: "interactive", free: true },
          ],
        },
        {
          id: "vector-db",
          title: "Vector databases",
          why: "Store and query embeddings — pgvector (you already run Postgres), Pinecone, etc.",
          resources: [
            { label: "pgvector", url: "https://github.com/pgvector/pgvector", type: "docs" },
          ],
        },
        {
          id: "rag-course",
          title: "Build a RAG app",
          why: "Chunking, retrieval, re-ranking, citations — hands-on.",
          resources: [
            { label: "DeepLearning.AI short courses", url: "https://www.deeplearning.ai/courses", type: "course", free: true },
          ],
        },
      ],
    },
    {
      id: "agents",
      title: "Stage 5 · Agents, Copilot Extensions & MCP",
      nodes: [
        {
          id: "copilot-extensions",
          title: "Build a Copilot Extension",
          why: "Ship your own capability inside Copilot — the Vodafone-native way to put an agent in front of every engineer.",
          resources: [
            { label: "Building Copilot Extensions", url: "https://docs.github.com/en/copilot/building-copilot-extensions/about-building-copilot-extensions", type: "docs" },
          ],
        },
        {
          id: "agent-loops",
          title: "Agent loops & tools",
          why: "Give a model tools + a goal and let it act in a loop. The core of agentic apps.",
          resources: [
            { label: "roadmap.sh: AI agents", url: "https://roadmap.sh/ai-engineer", type: "interactive", free: true },
          ],
        },
        {
          id: "mcp",
          title: "Model Context Protocol (MCP)",
          why: "The open standard for connecting agents to tools/data — and how Copilot itself extends. Learn once, use in Copilot and your own agents.",
          resources: [
            { label: "modelcontextprotocol.io", url: "https://modelcontextprotocol.io", type: "docs" },
            { label: "Extend Copilot Chat with MCP", url: "https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-chat-with-mcp", type: "docs" },
          ],
        },
      ],
    },
    {
      id: "multimodal",
      title: "Stage 6 · Multimodal",
      nodes: [
        {
          id: "vision-audio",
          title: "Vision & audio",
          why: "Work with images and speech — multimodal models are available in GitHub Models. (The hub's in-browser voice dictation is a live example.)",
          resources: [
            { label: "GitHub Models marketplace", url: "https://github.com/marketplace/models", type: "interactive", free: true },
          ],
        },
      ],
    },
    {
      id: "eval-ops",
      title: "Stage 7 · Eval, observability & deploy",
      nodes: [
        {
          id: "eval",
          title: "Evaluate & trace",
          why: "You can't improve what you don't measure — test prompts, trace calls, watch cost/latency.",
          resources: [
            { label: "GitHub Models: evaluators & prompt eval", url: "https://docs.github.com/en/github-models/use-github-models/evaluating-ai-models", type: "docs" },
            { label: "roadmap.sh: AI Engineer (eval)", url: "https://roadmap.sh/ai-engineer", type: "interactive", free: true },
          ],
        },
        {
          id: "guardrails",
          title: "Guardrails & safety in production",
          why: "Input/output validation, PII handling, injection defense before you ship to users.",
          resources: [
            { label: "GitHub Copilot Trust Center", url: "https://resources.github.com/copilot-trust-center/", type: "docs" },
            { label: "Microsoft: Responsible AI", url: "https://learn.microsoft.com/en-us/ai/", type: "docs" },
          ],
        },
      ],
    },
    RESPONSIBLE_AI_STAGE,
  ],
};

export const ROADMAP_TRACKS: RoadmapTrack[] = [TRACK_POWER_USER, TRACK_AI_ENGINEER];
