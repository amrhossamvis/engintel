# Engineering Intelligence Hub

> A unified portal of AI-powered tools for mobile engineering, delivery excellence, quality prediction, productivity, and AI value measurement.

The **Engineering Intelligence Hub** is a Next.js portal that hosts a growing set of AI-assisted delivery capabilities behind a single authenticated platform. It was built to reduce engineering effort on repetitive delivery activities and accelerate software delivery through AI-assisted workflows.

The platform is **capability-driven rather than market-specific** — capabilities are decoupled from any one market or toolchain, so the same model extends to new markets and tools (Azure DevOps today; Jira, GitHub, Jenkins and more next) with minimal effort.

**Same power. Fraction of the tokens.** Each capability runs under your own GitHub Copilot / Azure OpenAI token, secured through Entra.

---

## Project Structure

```
portal/                  Next.js 14 app (App Router)
├── src/app/             Page routes — one folder per capability
├── src/components/      Shared UI components (AppHeader, FeedbackWidget, …)
├── src/lib/             Service layer (ADO, Copilot CLI, bug analysis, …)
└── src/types/           Shared TypeScript types
```

**Tech stack:** Next.js 14 · TypeScript · Tailwind CSS · Recharts · Azure DevOps API · GitHub Copilot CLI · Azure OpenAI

---

## Live Apps

These capabilities are fully deployed and available today.

| App | Route | Category | What it does |
|-----|-------|----------|--------------|
| **Feedback Dashboard** | `/feedback` | Platform & Community | Centralised view of all engineer feedback submitted across every tool in the hub. Tracks bug reports, feature requests, praise, and general feedback with star ratings, status tracking (New → Acknowledged → In Progress → Resolved), and per-app filtering. Admin mode enables inline status changes and deletion. |
| **Idea Box** | `/idea-box` | Platform & Community | Community-driven feature backlog for the hub itself. Engineers submit ideas with a problem statement, proposed solution, domain tag, and impact estimate. Ideas are upvoted, commented on, pinned by admins, and tracked through a full lifecycle (New → Under Review → Planned → In Progress → Shipped). |
| **Bug Analyzer** | `/bug-analyzer` | Mobile Guild | AI classifies every ADO bug by type, severity, and mobile platform. Traces each bug to the originating commit and generates structured RCA automatically. Supports release-folder query picker or custom ADO query URL. |
| **Executive Dashboard** | `/exec-dashboard` | Delivery Excellence | Real-time engineering health visibility for leadership — RAG status, velocity trends, bug trends, and AI-generated executive summaries per team and org-wide. Powered by GitHub Copilot CLI. |
| **Story Extractor** | `/story-extractor` | Engineering Productivity | AI reverse-engineers iOS source code into structured Agile user stories with acceptance criteria. Uses Claude Sonnet 4.5 via GitHub Copilot. Results cached locally; exportable to Excel and clipboard. |
| **AI Productivity Index** | `/ai-productivity` | AI Value & Knowledge | Measures and proves AI ROI by correlating GitHub Copilot usage with engineering outcomes — sprint completion, PR cycle time, bug escape rate, and velocity. Includes baseline comparison, ROI calculator, and Teams digest. |
| **AI Playground** | `/playground` | Platform & Community | Explore GitHub Copilot CLI with pre-built prompt templates across Bug Analysis, Story Generation, Code Review, Delivery, Test Generation, and Copilot CLI categories. Experiment, learn, and prototype new AI workflows. |

---

## Roadmap

Capabilities are grouped into delivery domains. Each is independently shippable.

### 📱 Mobile Guild

| Capability | Target | Purpose |
|------------|--------|---------|
| **Mobile Crash Intelligence** | Q2 2026 | Firebase Crashlytics → AI crash pattern analysis. Groups crashes by platform, OS version, and device model. Correlates with commits and generates incident reports. |
| **App Store Release Risk Scorer** | Q2 2026 | AI-powered Go/No-Go for iOS App Store & Google Play. Evaluates Fastlane results, crash rates, open bugs, and code churn into a 0–100 readiness score. |
| **Mobile CI/CD Intelligence** | Q3 2026 | AI monitoring for Fastlane, GitHub Actions, and Azure Pipelines. Detects flaky tests, diagnoses build failures, and generates weekly pipeline health reports. |
| **Mobile Code Review Assistant** | Q3 2026 | AI first-pass review for Swift, Kotlin, and React Native PRs. Flags force-unwraps, ARC issues, coroutine scope leaks, ANR-prone patterns, and bridge performance problems. |
| **Mobile Test Gap Analyzer** | Q3 2026 | AI identifies untested UI flows across XCTest, Espresso, and Detox. Prioritises gaps by production crash history and generates test case suggestions. |
| **Mobile Onboarding Accelerator** | Q4 2026 | AI-guided onboarding for iOS, Android, and React Native engineers. RAG over internal docs, Fastlane lanes, and architecture decisions. Days to first PR. |

### 🚀 Delivery Excellence

| Capability | Target | Purpose |
|------------|--------|---------|
| **Delivery Intelligence Platform** | Q2 2026 | Automated sprint health scoring, velocity tracking, risk prediction, and executive-ready delivery reports. Eliminates 80% of manual reporting effort. |
| **Release Risk Scorer** | Q3 2026 | Data-driven release readiness scores before every deployment. Evaluates test results, code churn, open bugs, and historical patterns to prevent production incidents. |
| **Dependency & Blocker Radar** | Q3 2026 | Auto-detect cross-team dependencies and predict blockers before they cause delivery delays. Visual dependency graph with escalation alerts. |

### 🧪 Quality & Testing

| Capability | Target | Purpose |
|------------|--------|---------|
| **Sprint Quality Predictor** | Q2 2026 | Predict sprint quality risk before testing begins using code churn, complexity, and historical defect patterns. Shift left on quality. |
| **Test Gap Analyzer** | Q3 2026 | Identify highest-value testing gaps by combining code complexity, defect history, and change frequency. Ranked by production incident risk. |

### ⚡ Engineering Productivity

| Capability | Target | Purpose |
|------------|--------|---------|
| **PR Review Intelligence** | Q2 2026 | Automated first-pass PR analysis with risk scoring, standards compliance checking, and stale PR alerts. Reduces review cycle time by 35%. |
| **Developer Onboarding Accelerator** | Q4 2026 | AI-assisted onboarding with personalised learning paths, codebase orientation, and contextual Q&A. Reduces time-to-productivity from 3 months to 6 weeks. |

### 🧠 AI Value & Knowledge

| Capability | Target | Purpose |
|------------|--------|---------|
| **Engineering Knowledge Copilot** | Q3 2026 | AI assistant that answers engineering questions from your internal docs, code, and architecture decisions. |

---

## How it works

1. **Sign in** via the login page (Entra-secured).
2. **Configure credentials** in Settings — your Azure DevOps PAT, GitHub PAT, and team/repo list are stored in your browser.
3. **Pick a capability** from the hub.
4. **Point it at a target** — a release query, ADO team, iOS module, or sprint range.
5. **It runs under your own token** — no shared credential pool.
6. **Results are returned in-app** — exportable to Excel, clipboard, or Teams via webhook digest.

---

## Design Principles

- **Capability-driven** — capabilities are first-class units, decoupled from market or toolchain.
- **Toolchain-agnostic** — Azure DevOps today; Jira, GitHub, and Jenkins on the roadmap.
- **Bring-your-own-token** — runs under the caller's AI token; no shared credential pool.
- **Secured by Entra** — authentication and access control through Entra.
- **Extensible by market** — the same model extends beyond the initial market with minimal effort.

---

## Getting Started

```bash
cd portal
npm install
npm run dev
```

The portal runs on `http://localhost:3000` by default.

---

## Status

**7 capabilities live** (Feedback Dashboard, Idea Box, Bug Analyzer, Executive Dashboard, Story Extractor, AI Productivity Index, AI Playground) · **14 capabilities on the roadmap** across Mobile Guild, Delivery Excellence, Quality & Testing, Engineering Productivity, and AI Value & Knowledge.
