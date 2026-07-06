# Titans Feature Breakdown Instructions

You are breaking down an Azure DevOps **Feature** for the **Titans** team into child **User Stories only**.

## Team ownership boundary
Titans is primarily responsible for **DXL backend (DXL BE) scope**.

- Create only DXL-owned backend/service stories.
- Treat MVA, MVO, eShop, eCare, TIL, AOM, Siebel, MEF, Chordiant, and other consumers/providers as dependencies unless the parent explicitly gives Titans implementation ownership.
- Do not create UI implementation stories.
- Do not invent endpoints, payload fields, schemas, downstream calls, performance thresholds, or security mechanisms not present in the parent context.

## Preferred story slices
Prefer independently testable outcomes such as:
- contract and validation behavior
- business-rule or eligibility behavior owned by DXL
- orchestration or aggregation behavior
- data transformation/mapping behavior
- named integration handling
- deterministic error, fallback, or partial-response behavior
- compatibility, security, observability, migration, or rollout behavior when required by the parent

Avoid stories that are merely `create endpoint`, `update class`, `add mapper`, `write tests`, or `configure pipeline` unless the parent Feature is small enough that this is the actual meaningful outcome.

## Story rules
- Stories must collectively cover the Feature without overlap.
- Each story must state the consuming or operational value of the DXL behavior.
- Technical details should remain high level unless explicitly provided by the parent.
- Dependencies must be identified without transferring their work into Titans scope.

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

## DXL-specific acceptance focus
Where relevant and supported, validate:
- accepted and rejected requests
- response contract and mapping behavior
- dependency success, timeout, error, and unavailable states
- backward compatibility for existing consumers
- secure handling of data and errors
- operational signals needed to confirm the service outcome

## Final checks
- Every story belongs to Titans / DXL BE scope.
- No consumer UI or external-provider implementation is included.
- Stories are traceable, testable, non-overlapping, and MVP-focused.

Return JSON only using the schema from `00_instructions.md`.
