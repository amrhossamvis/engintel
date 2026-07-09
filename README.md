# Engineering Intelligence Hub

> A unified portal of AI-powered capabilities for delivery excellence, quality, agile backlog, and AI value measurement.

The **Engineering Intelligence Hub** is a Next.js portal that hosts a growing set of AI-assisted delivery capabilities behind a single authenticated platform. It was built to reduce engineering effort on repetitive delivery activities and accelerate software delivery through AI-assisted workflows.

The platform is **capability-driven rather than market-specific** — capabilities are decoupled from any one market or toolchain, so the same model extends to new markets and tools (Azure DevOps today; Jira, GitHub, Jenkins and more next) with minimal effort.

**Same power. Fraction of the tokens.** Each capability runs under your own GitHub Copilot / Azure OpenAI token, secured through Entra.

---

## Project Structure

```
portal/                  Next.js 16 app (App Router)
├── app/                 Page routes + API route handlers
│   ├── pulse/           Guild-scoped capability views
│   ├── playground/      Copilot CLI prompt playground
│   ├── skills/          Community skills marketplace
│   ├── ideas/           Idea Box (community backlog)
│   ├── settings/        Per-user credentials + ADO sign-in
│   └── api/             Server routes (ado, ideas, skills, feedback, run, …)
├── components/          Shared UI (Hub, Pulse, widgets, …)
├── lib/                 Service layer (ADO, capabilities catalog, db, skills, …)
├── db/                  Postgres schema (schema.sql)
└── public/             Static assets
```

**Tech stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Recharts · Motion · Postgres (`pg`) · Azure DevOps API · GitHub Copilot CLI · Vitest

**Execution models**

- **Pipeline** — the capability triggers an Azure DevOps pipeline that runs a Copilot CLI script and writes results back to the work item / PR.
- **Hub-inline** — read-only analytics computed inside the app directly from ADO (no pipeline, no credits).

---

## Capabilities

Each capability carries an Egyptian-pantheon codename that nods to what it does. **7 live · 24 total.**

### Live

| Capability | Codename | Category | Execution | What it does |
|-----------|----------|----------|-----------|--------------|
| **PR Reviewer** | Maat | Quality & Review | Pipeline | Reads the PR diff, linked work items and repo coding guidelines, then posts inline + summary review comments. Blocks merge only on high-severity, high-confidence findings. |
| **Bug Triage** | Anubis | Quality & Review | Pipeline | Pulls bug context, screenshots, history and linked PRs, correlates DataDog logs, then diagnoses the affected service + owning team and posts the triage back to the work item. |
| **Feature Breakdown** | Ptah | Agile & Backlog | Pipeline | Reverse-engineers an epic or feature into a structured backlog with acceptance criteria, applying team-specific rules. Creates child work items in ADO. |
| **Business Intent Builder** | Atum | Agile & Backlog | Pipeline | Turns a plain-language business intent into a complete Epic → Feature → Story hierarchy in ADO, applying team breakdown rulebooks. |
| **Wiki Weaver** | Development | Enablement | Pipeline | Climbs a User Story/Feature/Epic link (or bare id) to its top parent, reads its description/acceptance criteria/comments/attached design docs plus every child item on the same area path (and linked PRs for stories), then publishes one business + tech wiki page. |
| **Executive Dashboard** | Ra | Delivery Intelligence | Hub-inline | Reads a team's last 6 ADO sprints and computes a RAG health score from completion, velocity stability and bug resolution, with trend charts. Read-only. |
| **AI Productivity Index** | Hapi | Delivery Intelligence | Hub-inline | Scores a team's last 6 sprints into one 0–100 index across delivery, quality, velocity, PR speed and Copilot adoption, plus a £ ROI estimate. Read-only. |

### Coming soon

Sprint Health Coach · Test Case Generator · Figma Test Cases · UI Test Data Reviewer · Story Extractor · Mobile Crash Intelligence · App Store Release Risk Scorer · Mobile CI/CD Intelligence · Mobile Code Review Assistant · Mobile Test Gap Analyzer · Mobile Onboarding Accelerator · Delivery Intelligence Platform · Release Risk Scorer · Dependency & Blocker Radar · Test Gap Analyzer · Developer Onboarding Accelerator · Engineering Knowledge Copilot

The full catalog (fields, credits, pipelines, status) lives in [`portal/lib/capabilities.ts`](portal/lib/capabilities.ts).

### Platform surfaces

| Surface | Route | What it does |
|---------|-------|--------------|
| **Hub** | `/` | Landing page — live count and entry into every capability. |
| **Pulse** | `/pulse` | Guild-scoped view of the capabilities available to your guild. |
| **Playground** | `/playground` | Explore the GitHub Copilot CLI with pre-built prompt templates. |
| **Skills** | `/skills` | Community marketplace of installable Copilot skills. |
| **Idea Box** | `/ideas` | Community backlog for the hub itself — submit, upvote, comment, track. |
| **Settings** | `/settings` | Per-user credentials and Azure DevOps sign-in. |

---

## Local Installation Guide

Get the hub running on your machine in a few minutes. Everything lives under `portal/`.

### 1. Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 22 LTS or newer | Runtime for Next.js 16. |
| **pnpm** | 9+ | Package manager this repo is pinned to (`pnpm-workspace.yaml`, `pnpm-lock.yaml`). Install with `npm i -g pnpm` or `corepack enable pnpm`. |
| **Azure CLI** (`az`) | latest | *Optional.* Per-user ADO auth for the live analytics capabilities. Without it, ADO-backed views fall back to local simulation. |
| **Postgres** | 14+ | *Optional.* Backs the **Idea Box** and **Skills** marketplace. Without it, those surfaces degrade gracefully. Local Docker or a hosted URL (e.g. Neon) both work. |

### 2. Clone and install

```bash
git clone <repo-url>
cd ai-delivery-capabilities/portal
pnpm install
```

### 3. Configure environment

Copy the example file and fill in what you need. Every value is optional — the app runs with an empty file and simulates ADO data.

```bash
cp .env.example .env.local
```

Key variables (`.env.local` is git-ignored):

| Variable | Needed for | Notes |
|----------|-----------|-------|
| `ADO_ORG`, `ADO_PROJECT` | ADO data | Default to `vfuk-digital` / `Digital`. |
| `AZDO_PAT` | ADO fallback | Shared service token — only used when no per-user PAT and `az` is signed out. Per-user identity is set in the app (**Settings → Azure DevOps access**), not here. |
| `PIPELINE_*` | Pipeline capabilities | Pipeline definition id per capability. Find the id in the pipeline URL (`…/_build?definitionId=<ID>`). |
| `DATABASE_URL` | Idea Box + Skills | Postgres connection string. Leave empty to run without those boards. |
| `IDEAS_ADMINS` | Idea Box curation | Comma-separated UPNs allowed to change status/impact/pin. Empty → open (prototype). |

### 4. (Optional) Sign in to Azure DevOps

The hub mints a per-user ADO token from your local Azure CLI session — no app registration required. Run once:

```bash
az login
```

Azure CLI's first-party client is already consented for Azure DevOps, so this works even when the tenant blocks new app registrations. You can also sign in from the in-app **Settings** page.

**Shared or hosted deploy (no host `az`):** each user instead pastes their own Azure DevOps Personal Access Token in **Settings → Azure DevOps access**. It's stored in their browser and sent per request, so every user reads and queues as their own identity — no shared `AZDO_PAT` needed. ADO auth resolves per request: **user PAT → `az login` → `AZDO_PAT`**.

### 5. (Optional) Start Postgres

Any Postgres 14+ works. Quick local instance with Docker:

```bash
docker run --name hub-db -e POSTGRES_PASSWORD=hub -p 5432:5432 -d postgres:16
```

Then set in `.env.local`:

```
DATABASE_URL=postgres://postgres:hub@localhost:5432/postgres
```

The schema **applies itself on first request** (mirrors [`db/schema.sql`](portal/db/schema.sql)) — no manual migration step.

### 6. Run the dev server

```bash
pnpm dev
```

Open **<http://localhost:3000>**.

### 7. Useful commands

```bash
pnpm dev      # start the dev server (Turbopack)
pnpm build    # production build
pnpm start    # serve the production build
pnpm lint     # eslint
pnpm test     # run the vitest suite once
pnpm test:watch
```

### 8. (Alternative) Run with Docker

The `portal/` folder ships a `Dockerfile` and `docker-compose.yml` that bring up the app and a Postgres instance together — no local Node, pnpm, or database needed.

```bash
cd portal
docker compose up --build
```

Open **<http://localhost:3000>**. Compose wires `DATABASE_URL` to the bundled Postgres and the schema self-applies on first request. To feed ADO / pipeline credentials into the container, drop them in `.env.local` — Compose loads it if present. `az login` isn't available inside the container, so each user connects ADO by pasting their own Personal Access Token in **Settings → Azure DevOps access** (per-user identity, stored in their browser). A server-wide `AZDO_PAT` in `.env.local` also works as a shared fallback.

---

## How it works

1. **Sign in** via Entra.
2. **Configure credentials** in Settings — your GitHub Copilot token, plus ADO access via `az login` or your own Azure DevOps PAT. Both stay in your browser and are sent per-run; no shared credential pool.
3. **Pick a capability** from the hub.
4. **Point it at a target** — a PR, work item, ADO team, or business intent.
5. **It runs under your own token** — pipeline capabilities kick off an ADO pipeline; hub-inline capabilities compute results directly.
6. **Results are returned in-app** or written back to the work item / PR.

---

## Design Principles

- **Capability-driven** — capabilities are first-class units, decoupled from market or toolchain.
- **Toolchain-agnostic** — Azure DevOps today; Jira, GitHub, and Jenkins on the roadmap.
- **Bring-your-own-token** — runs under the caller's AI token; no shared credential pool.
- **Secured by Entra** — authentication and access control through Entra.
- **Extensible by market** — the same model extends beyond the initial market with minimal effort.

---

## Status

**7 capabilities live** (PR Reviewer, Bug Triage, Feature Breakdown, Business Intent Builder, Wiki Weaver, Executive Dashboard, AI Productivity Index) · **17 more on the roadmap** across Quality, Agile & Backlog, Delivery Intelligence, Mobile, Testing, and Enablement.
