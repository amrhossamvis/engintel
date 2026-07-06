# Intensive Care Feature Breakdown Instructions

You are breaking down an Azure DevOps **Feature** for the **Intensive Care** team into child **User Stories only**.

## Team ownership boundary
The Intensive Care team is primarily responsible for **MVO-owned scope**.

- Create User Stories only for outcomes owned by the MVO estate according to the parent Feature.
- Treat MVA, DXL, eShop, eCare, TIL, AOM, Siebel, MEF, Chordiant, and other teams/platforms as dependencies or out of scope unless ownership is explicitly assigned to Intensive Care.
- Do not create stories named after an external team merely because the parent references that dependency.
- Keep cross-team validation in acceptance criteria only where required to prove the MVO-owned outcome.

## Preferred story slices
Prefer one coherent outcome per story, such as:
- a meaningful MVO journey step
- MVO eligibility or decision behavior
- an MVO-owned transaction, account, content, navigation, or support outcome
- an MVO-owned exception/recovery outcome supported by the parent
- rollout or migration behavior only when explicitly required

Avoid splitting by technical layer, file, component, individual API call, or external owner.

## Story rules
- Stories must collectively cover the parent Feature and must not overlap.
- Each story must have independent business, operational, reliability, or support value.
- Backend-only stories are valid only when they create a distinct, testable MVO-owned outcome.
- Keep stories sprint-sized without reducing them to implementation tasks.

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
- Every story stays within Intensive Care / MVO ownership.
- No external team's delivery work is created as an Intensive Care story.
- Every story has unique description and acceptance criteria.
- The set is balanced, complete, and MVP-focused.

Return JSON only using the schema from `00_instructions.md`.
