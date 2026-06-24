# Engineering Intelligence Hub — Product Requirements
> Captured from Kickoff · June 2026 · Product Team Alignment

---

## Overview

Three new features were identified as high-priority additions to the Engineering Intelligence Hub following the product team kickoff. These features are designed to close the feedback loop between engineers and the platform, surface collective intelligence from the team, and give engineers a hands-on way to explore AI capabilities.

---

## Feature 1 — 💡 Idea Box

### Vision
A living, community-owned backlog where any engineer can submit ideas for new tools, vote on what matters most, and watch their ideas move from concept to shipped. The Idea Box turns the platform from a top-down product into a community-driven ecosystem.

### Core Concept
Think of it as a mix between a **Product Hunt board** and a **GitHub Issues tracker** — but built specifically for engineering tooling ideas inside Vodafone. Ideas are visible to everyone, voteable, commentable, and tracked through a transparent lifecycle.

### User Stories

**As an engineer, I want to:**
- Submit a new tool idea with a title, description, and the problem it solves
- Tag my idea by domain (Mobile Guild, Delivery, Quality, Productivity, AI)
- See all submitted ideas from my colleagues
- Upvote ideas I find valuable (one vote per person per idea)
- Comment on ideas to add context, use cases, or implementation thoughts
- Track the status of my idea (New → Under Review → Planned → In Progress → Shipped → Declined)
- Get notified when my idea changes status or receives comments

**As a platform owner, I want to:**
- Review incoming ideas and change their status
- Add internal notes visible only to the team
- Pin featured or high-priority ideas to the top
- See a leaderboard of most-voted ideas
- Export ideas to ADO as work items when approved

### Key UI Concepts
- **Idea Feed** — Card-based list sorted by votes, recency, or status. Each card shows: title, submitter avatar, domain tag, vote count, comment count, and status badge.
- **Submit Modal** — Clean form: Title, Problem Statement (what pain does this solve?), Proposed Solution, Domain Tag, Estimated Impact (Low/Medium/High). Optional: attach a screenshot or link.
- **Idea Detail Page** — Full description, comment thread, status timeline, related ideas, and a "Similar to" section powered by semantic search.
- **Status Board** — Kanban-style view showing ideas across lifecycle stages. Useful for platform owners during planning.
- **Leaderboard** — Top 10 most-voted ideas of the month. Drives engagement and shows engineers their voice matters.
- **"My Ideas" tab** — Personal view of submitted ideas and their current status.

### Gamification
- 🏆 **Idea Pioneer** badge for first idea submitted
- ⭐ **Top Contributor** badge for most ideas shipped
- 🔥 **Trending** tag on ideas that get 10+ votes in 48 hours
- Monthly "Idea of the Month" highlight in the platform header

### Data Model (Draft)
```
Idea {
  id, title, description, problemStatement, proposedSolution
  submittedBy (userId), submittedAt
  domain: ['Mobile Guild' | 'Delivery Excellence' | 'Quality & Testing' | 'Engineering Productivity' | 'AI Value & Knowledge']
  status: ['new' | 'under-review' | 'planned' | 'in-progress' | 'shipped' | 'declined']
  votes: number
  voters: userId[]
  comments: Comment[]
  tags: string[]
  estimatedImpact: 'low' | 'medium' | 'high'
  adoWorkItemId?: string  // linked when approved
  isPinned: boolean
  internalNotes?: string  // platform team only
}

Comment {
  id, ideaId, authorId, content, createdAt, updatedAt
}
```

### Technical Considerations
- Store in a lightweight DB (SQLite for MVP, PostgreSQL for scale)
- Real-time vote updates via optimistic UI
- Semantic deduplication: warn submitter if a similar idea already exists (using embeddings)
- ADO integration: one-click export to create a Feature/Epic in Azure DevOps
- Auth: tied to existing portal auth (no separate login)

---

## Feature 2 — 📝 Feedback Form

### Vision
A contextual, per-app feedback system that lets engineers rate their experience with each tool, report issues, and suggest improvements — directly from within the app they're using. Feedback is structured enough to be actionable but lightweight enough that engineers actually fill it out.

### Core Concept
Not a generic "contact us" form. Each tool in the hub has its own feedback channel. Feedback is tied to the specific app, the user's session context (what they were doing), and optionally a specific output (e.g., "this RCA was wrong"). Think **in-context micro-surveys** combined with a **structured bug/suggestion reporter**.

### User Stories

**As an engineer, I want to:**
- Rate my experience with a specific tool (1–5 stars or emoji scale)
- Choose a feedback type: Bug Report / Feature Request / General Feedback / Praise
- Describe my feedback in free text
- Optionally attach a screenshot or paste a code snippet
- Submit feedback without leaving the current page (slide-over panel)
- See a confirmation that my feedback was received
- Optionally opt-in to be contacted for follow-up

**As a platform owner, I want to:**
- See all feedback per app in a unified dashboard
- Filter by type, rating, date range, and app
- See aggregate satisfaction scores per tool (NPS-style)
- Get notified when a tool receives a low rating (≤2 stars)
- Tag feedback as "Acknowledged", "In Progress", "Resolved", or "Won't Fix"
- Reply to feedback (visible to the submitter)
- Export feedback to CSV or ADO

### Key UI Concepts
- **Floating Feedback Button** — A subtle "💬 Feedback" button fixed to the bottom-right of every app page. Unobtrusive but always accessible.
- **Slide-Over Panel** — Opens from the right without navigating away. Contains: star rating, feedback type selector, text area, optional attachment, and submit button. Closes smoothly after submission.
- **Feedback Dashboard** (`/feedback`) — Platform-owner view. Shows: per-app satisfaction scores, recent feedback feed, trend charts (satisfaction over time), and a heatmap of which apps get the most feedback.
- **In-line Feedback Prompts** — After a key action (e.g., RCA generated, story extracted), a subtle prompt appears: "Was this result helpful? 👍 👎". One-click micro-feedback that feeds into the satisfaction score.
- **App Health Score** — Each app card on the hub homepage shows a small satisfaction indicator (e.g., ⭐ 4.2) derived from recent feedback.

### Feedback Types
| Type | Icon | Description |
|------|------|-------------|
| Bug Report | 🐛 | Something is broken or producing wrong results |
| Feature Request | ✨ | I want the tool to do something it doesn't do yet |
| General Feedback | 💬 | General thoughts, impressions, or suggestions |
| Praise | 🙌 | This tool saved me time / worked great |

### Satisfaction Metrics
- **Per-app NPS**: % positive (4–5 stars) minus % negative (1–2 stars)
- **Weekly trend**: Is satisfaction improving or declining?
- **Response rate**: What % of active users leave feedback?
- **Top pain points**: Most common themes in negative feedback (AI-extracted tags)

### Data Model (Draft)
```
Feedback {
  id, appId (e.g., 'bug-analyzer'), appName
  submittedBy (userId, optional — can be anonymous)
  submittedAt
  type: 'bug' | 'feature-request' | 'general' | 'praise'
  rating: 1 | 2 | 3 | 4 | 5
  message: string
  attachment?: string (URL)
  sessionContext?: {
    page: string,
    action?: string,   // e.g., 'rca-generated'
    outputId?: string  // e.g., the specific RCA that was bad
  }
  status: 'new' | 'acknowledged' | 'in-progress' | 'resolved' | 'wont-fix'
  platformReply?: string
  contactConsent: boolean
  tags?: string[]  // AI-extracted themes
}
```

### Technical Considerations
- Feedback button injected via a shared `<FeedbackWidget appId={...} />` component added to `AppHeader`
- No page navigation required — slide-over panel using Radix UI Dialog/Sheet
- Screenshot capture: use `html2canvas` for optional page snapshot
- AI theme extraction: run feedback text through Azure OpenAI to auto-tag themes (e.g., "slow performance", "wrong output", "confusing UI")
- Alerting: webhook/email notification when satisfaction drops below threshold

---

## Feature 3 — 🧪 AI Playground

### Vision
An interactive sandbox where engineers can explore GitHub Copilot CLI capabilities, experiment with Azure OpenAI prompts, and prototype new AI-powered workflows — all without touching production systems. The Playground democratizes AI experimentation and accelerates the discovery of new use cases.

### Core Concept
Think of it as a **Jupyter Notebook meets Postman meets GitHub Copilot** — but purpose-built for engineering teams. Engineers can run pre-built prompt templates, modify them, chain them together, and see real outputs from the AI models powering the hub. It's both an exploration tool and a learning environment.

### User Stories

**As an engineer, I want to:**
- Browse a library of pre-built prompt templates organized by use case
- Run any template with one click and see the AI output in real time
- Modify a template's prompt and re-run it to see how the output changes
- Chain multiple prompts together (output of one feeds into the next)
- Save my own custom prompts to a personal library
- Share a prompt with my team (generate a shareable link)
- See the raw API request/response for learning purposes
- Compare outputs from different models (GPT-4o vs GPT-4 Turbo)
- Export a prompt + output as a markdown snippet

**As a platform owner, I want to:**
- Curate the official prompt template library
- See which prompts are most used (analytics)
- Feature community-contributed prompts
- Set token/cost limits per user per day
- Monitor for prompt injection or misuse

### Key UI Concepts

**Playground Layout (3-panel)**
```
┌─────────────────┬──────────────────────────┬─────────────────┐
│  Template       │  Prompt Editor           │  Output         │
│  Library        │                          │                 │
│                 │  [System Prompt]         │  Streaming      │
│  🔍 Search      │  ┌──────────────────┐   │  response       │
│                 │  │ You are an AI... │   │  appears here   │
│  📁 Categories  │  └──────────────────┘   │  in real time   │
│  • Bug Analysis │                          │                 │
│  • Code Review  │  [User Prompt]           │  ─────────────  │
│  • Story Gen    │  ┌──────────────────┐   │  Token count    │
│  • RCA          │  │ Analyze this...  │   │  Latency        │
│  • Custom       │  └──────────────────┘   │  Model used     │
│                 │                          │                 │
│  ⭐ My Saved    │  [Variables]             │  [Copy] [Save]  │
│  🔥 Popular     │  key: value pairs        │  [Share] [Fork] │
│                 │                          │                 │
│                 │  Model: [GPT-4o ▼]       │                 │
│                 │  Temp:  [0.7    ▼]       │                 │
│                 │                          │                 │
│                 │  [▶ Run]  [⛓ Chain]     │                 │
└─────────────────┴──────────────────────────┴─────────────────┘
```

**Template Library Categories**
| Category | Example Templates |
|----------|-------------------|
| 🐛 Bug Analysis | Classify bug severity, Generate RCA from stack trace, Suggest fix for crash |
| 📖 Story Generation | Extract user stories from code, Write acceptance criteria, Estimate story points |
| 🔍 Code Review | Review Swift PR for memory leaks, Check Kotlin for ANR patterns, Audit React Native bridge |
| 📊 Delivery | Summarize sprint health, Identify delivery risks, Generate status report |
| 🧪 Test Generation | Generate XCTest cases, Write Espresso tests, Create Detox scenarios |
| 🤖 Custom | Blank canvas for free-form experimentation |

**GitHub Copilot CLI Mode**
A dedicated tab within the Playground that simulates GitHub Copilot CLI commands:
- `gh copilot suggest` — Natural language → shell command
- `gh copilot explain` — Explain a shell command
- `gh copilot` with custom context (repo, branch, recent commits)
- Side-by-side: "What you typed" vs "What Copilot suggested" vs "What it actually does"
- Safety mode: commands are shown but not executed (copy to clipboard only)

**Prompt Chaining**
- Visual node-based chain builder (simple, not complex)
- Example chain: `[Fetch ADO bugs] → [Classify by severity] → [Generate RCA] → [Format as report]`
- Each node shows its input/output
- Chains can be saved and shared

**Learning Mode**
- Toggle "Show me how this works" to reveal:
  - The exact API call being made
  - Token breakdown (system / user / response)
  - Cost estimate for the call
  - Tips for improving the prompt
- Ideal for engineers new to prompt engineering

### Prompt Template Schema (Draft)
```
PromptTemplate {
  id, name, description
  category: string
  tags: string[]
  systemPrompt: string
  userPrompt: string  // may contain {{variables}}
  variables: TemplateVariable[]
  model: 'gpt-4o' | 'gpt-4-turbo' | 'gpt-35-turbo'
  temperature: number
  maxTokens: number
  author: 'official' | userId
  isPublic: boolean
  usageCount: number
  rating: number
  createdAt, updatedAt
}

TemplateVariable {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'code'
  placeholder: string
  required: boolean
  options?: string[]  // for select type
}

PlaygroundSession {
  id, userId
  templateId?: string
  systemPrompt, userPrompt
  variables: Record<string, string>
  model, temperature, maxTokens
  response: string
  tokenUsage: { prompt: number, completion: number, total: number }
  latencyMs: number
  createdAt
  isSaved: boolean
  shareToken?: string
}
```

### Technical Considerations
- Stream responses using Azure OpenAI streaming API (SSE) for real-time output
- Rate limiting: max 50 requests/user/day in MVP (configurable)
- Cost tracking: log token usage per user, alert if approaching limit
- No code execution: Copilot CLI mode is display-only (no shell execution in browser)
- Prompt injection guard: basic input sanitization + system prompt hardening
- Sharing: generate a short URL that encodes the prompt + variables (no auth required to view)
- Export: markdown format with prompt, variables, model config, and output

---

## Implementation Priority

| Feature | Complexity | Impact | Suggested Quarter |
|---------|-----------|--------|-------------------|
| 📝 Feedback Form | Low–Medium | High | Q2 2026 |
| 💡 Idea Box | Medium | High | Q2–Q3 2026 |
| 🧪 AI Playground | High | Very High | Q3 2026 |

### Suggested Build Order
1. **Feedback Form** first — lowest effort, highest immediate value, closes the feedback loop on existing live tools
2. **Idea Box** second — builds community ownership and generates a validated backlog for Q3+
3. **AI Playground** third — most complex, but highest strategic value for AI adoption and enablement

---

## Open Questions

### Feedback Form
- [ ] Should feedback be anonymous by default, or tied to the user's identity?
- [ ] Do we want a public-facing satisfaction score on each app card, or keep it internal?
- [ ] What's the SLA for platform team to respond to feedback?

### Idea Box
- [ ] Who has the authority to change idea status? Platform team only, or any engineering lead?
- [ ] Should ideas be visible to everyone in Vodafone, or only to hub users?
- [ ] Do we want a nomination process for "Idea of the Month"?

### AI Playground
- [ ] What's the daily token budget per user? (Cost implications)
- [ ] Should Copilot CLI mode eventually execute commands in a sandboxed environment?
- [ ] Do we want to allow engineers to publish their custom prompts to the shared library?
- [ ] Integration with ADO: can a playground session be saved as a work item?

---

## Success Metrics

| Feature | Metric | Target (3 months post-launch) |
|---------|--------|-------------------------------|
| Feedback Form | Feedback response rate | >20% of active users/week |
| Feedback Form | Average satisfaction score | >4.0 / 5.0 across all tools |
| Idea Box | Ideas submitted | >50 ideas in first month |
| Idea Box | Ideas shipped | >3 ideas shipped in first quarter |
| AI Playground | Weekly active users | >30% of hub users |
| AI Playground | Prompts run per user/week | >10 |
| AI Playground | New use cases discovered | >5 community-contributed templates |

---

*Document owner: Engineering Intelligence Team*
*Last updated: June 2026*
*Status: Draft — pending product team review*
