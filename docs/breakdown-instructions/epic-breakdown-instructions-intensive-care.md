# Intensive Care Epic Breakdown Instructions

You are breaking down an Azure DevOps **Epic** for the **Intensive Care** team into child **Features** and child **User Stories**.

## Team ownership boundary
The Intensive Care team is primarily responsible for **MVO-owned scope**.

For this instruction set, MVO scope means the customer, operational, application, and supporting-service outcomes explicitly owned by the MVO estate in the parent context. Do not guess what MVO stands for or broaden its ownership beyond the supplied work item.

- Create delivery items only for MVO-owned outcomes.
- MVA, DXL, eShop, eCare, TIL, AOM, Siebel, MEF, Chordiant, and any other external team/platform must be treated as dependencies or out of scope unless the parent explicitly states that Intensive Care owns the change.
- Do not create sibling Features by external team name.
- When the parent contains a cross-channel journey, isolate the MVO-owned slice and record the remaining ownership as dependencies.
- UI, middleware, service, and operational work may be included only where it is part of the MVO-owned outcome.

## Objective
Create the smallest coherent set of MVO-owned Features needed to deliver the Epic outcome, with delivery-ready User Stories under each Feature.

## Epic-to-Feature slicing
Prefer business or operational outcomes such as:
- MVO journey stages or user outcomes
- MVO eligibility, routing, or entitlement outcomes
- MVO content, account, transaction, or support capabilities explicitly present in the parent
- MVO-owned exception or recovery journeys when supported by the parent
- controlled migration or rollout outcomes when explicitly required

Avoid splitting by frontend/backend, individual APIs, external platform, or engineering task.

## Feature rules
- Every Feature must represent a distinct MVO-owned capability.
- Every Feature must have at least one child User Story.
- Feature boundaries must prevent duplication across sibling Features.
- External integrations belong in Dependencies / References unless the integration behavior itself is owned by Intensive Care.

## User Story rules
- Each story must deliver an understandable MVO-owned user, business, operational, reliability, or support outcome.
- Backend-only stories are allowed when they provide a distinct MVO-owned capability or are necessary for a testable end-to-end slice.
- Do not create stories for changes that another team must deliver.
- Sequence stories in a practical delivery order.

## Grounding and quality rules
- Treat the parent title, description, acceptance criteria, and discussion/history as the source of truth.
- Do not invent journeys, channels, personas, business rules, integrations, or exception paths that are not supported by the parent context.
- Keep assumptions minimal, label every assumption with `Assumption:`, and omit the section when no assumption is required.
- Prefer the smallest meaningful slices that remain independently understandable, testable, and valuable.
- Avoid both large umbrella stories and tiny implementation-task stories.
- Keep sibling Features and User Stories mutually exclusive and collectively sufficient for the parent scope.
- Use MVP-first decomposition and defer optional future improvements unless the parent explicitly includes them.
- Treat other teams and platforms as dependencies, references, or out of scope unless the selected team owns the described outcome.

## Naming
- Feature: `<Team> | <parent business title> | <feature outcome>`
- User Story: `<Team> | <feature business title> | <story outcome>`
- Keep titles concise and outcome-focused.
- Avoid titles that are only a system name, component name, technical layer, or generic word such as Setup, Support, Configuration, Display, Screen, or Page.

## Description structure
Use readable sections rather than one paragraph.

For Features, use relevant sections from:
- Background
- Problem
- Solution
- Business Value
- Scope
- Out of Scope
- Dependencies / References
- Risks / Considerations
- Assumptions
- Benefit Hypothesis

For User Stories, use:
- `As a ...`
- `I want ...`
- `So that ...`
- Business Value
- Background / Context
- Scope
- Out of Scope when useful
- Dependencies / References when present
- Assumptions only when needed
- Accessibility only for user-interface scope

## Acceptance criteria
- Use distinct Gherkin scenarios or clear outcome-validation blocks.
- Validate the selected team's owned outcome.
- Mention external systems only where needed to prove the owned outcome.
- Include alternate/error paths only when grounded in the parent.
- Do not hide new scope inside acceptance criteria.

## Rollout controls
- Feature flags, experimentation, and staged rollout are not automatically mandatory.
- Include them only when explicitly required by the parent, PO recommendations, or established team delivery guidance.
- Never create a setup-only rollout story with no business or operational value.

## Final checks
- All Features and Stories remain within Intensive Care / MVO ownership.
- External teams are dependencies, not silently assigned delivery scope.
- The hierarchy covers the Epic without duplication or speculative expansion.
- Every story contains its own description and acceptance criteria.

Return JSON only using the schema from `00_instructions.md`.
