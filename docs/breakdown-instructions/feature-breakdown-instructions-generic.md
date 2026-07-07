# Feature Breakdown Instructions (Generic)

You are breaking down an Azure DevOps **Feature** into **child User Stories only**.

These instructions are **team- and domain-agnostic**. They apply to any area path (for example
`Area\Team\Product`) and any squad. Naming prefixes, scope boundaries, and any
team-specific conventions come from the parent work item context and from the run-specific
**Additional instructions** file (`04_po_recommendations.md`) when present.

## Precedence
- The parent Feature content is the source of truth for *what* to build.
- The **Additional instructions** file, when present, takes precedence for naming conventions,
  team prefixes, scope rules, exclusions, and any house style. Apply it on top of these generic rules.
- When the two conflict, follow the Additional instructions; otherwise follow this file.

## Objective
Create a business-aligned, delivery-ready set of child User Stories that fully cover the Feature scope
without duplicating work or inventing unsupported functionality.

The breakdown must:
- stay grounded in the parent Feature content
- avoid unsupported invention
- produce the **smallest meaningful slices that still deliver business value**
- make assumptions explicit and clearly labeled, but include them only when truly needed
- ensure every User Story is traceable back to the parent Feature description, acceptance criteria, and relevant discussion/history
- avoid both over-splitting into tiny low-value stories and under-splitting into oversized vague stories
- preserve the parent Feature's **MVP intent** and avoid expanding into post-MVP scope unless explicitly stated

## Inputs to use
Use only:
- Parent Feature title
- Parent Feature description
- Parent Feature acceptance criteria
- Parent comments / history if present
- Additional instructions file when present

If information is missing, keep the breakdown conservative and stay close to the parent wording.

## Grounding and traceability rules
You must anchor the breakdown to the parent Feature content.

- Treat the **parent title, description, acceptance criteria, and discussion/history** as the source of truth.
- Every User Story must map to a clear business slice already present in the parent context.
- Do not add journeys, personas, channels, segments, rules, edge cases, or dependencies unless they are either:
    - explicitly stated in the parent context, or
    - the minimum assumption needed to make the story coherent
- Include an **Assumptions** section only when a minimal assumption is truly required to keep the story coherent or testable. Prefix each assumption line with `Assumption:`. Omit the section otherwise.
- Do not introduce implementation design, architecture, APIs, services, data models, or engineering tasks unless the parent explicitly includes them.
- Treat downstream/external systems as **dependencies** unless the parent explicitly describes owned behavior involving them.

## Core principles
- **Business-first slicing**: split by customer journey, capability, or meaningful outcome
- **Smallest valuable slice**: every User Story must deliver real value on its own
- **No hidden assumptions**: inferred details must be labeled, and added only when required for clarity or testability
- **No technical-only slicing** unless explicitly required by the parent
- **Traceable scope**: every User Story must map clearly back to the parent Feature
- **Testable delivery**: stories must be understandable, scoped, and verifiable
- **Balanced decomposition**: avoid aggressive fragmentation and avoid overly broad umbrella stories
- **Delivery-sized slices**: prefer stories that represent one coherent flow step or outcome while remaining practical for engineering delivery, review, and testing within normal sprint boundaries
- **MVP-preserving refinement**: do not expand the Feature into post-MVP scope unless the parent explicitly requires it

## Naming convention
Every created User Story title should use one of the following:
- `<team prefix if provided> | <feature business title> | <story slice name>`
- `<feature business title> | <story slice name>`

Use a team prefix only when the parent context or the Additional instructions provide one. Do not invent one.

### Title guardrails
- Keep the final title segment concise and outcome-focused
- Prefer business capability names over visual filler wording
- Avoid redundant suffixes such as `Display`, `Screen`, `Page`, `Breakdown Display` unless essential to the business capability
- Avoid technical implementation wording in titles unless the parent explicitly uses it
- Avoid generic titles such as `Setup`, `Configuration`, `Enablement`, or `Support` unless they are part of a broader business outcome title

## Preferred split dimensions
Break the Feature into stories using one or more of these:
- entry points
- screens, cards, or steps only when they map to a meaningful user outcome
- user journeys
- conversion moments
- segment differences only when materially different
- redirection / navigation flows
- eligibility / entitlement logic
- fallback / empty / blocked states when clearly needed
- experiment / variant exposure where it is a meaningful slice
- the minimum set of business slices needed to complete the Feature

Do not split by backend/frontend only. Do not split by team or platform ownership.

## How to judge the right level of breakdown
The output should be neither too aggressive nor too shallow.

- prefer a story to cover one coherent flow step, decision point, or user outcome
- avoid putting an entire end-to-end journey into one story if it creates a large delivery and testing surface
- avoid splitting one coherent flow into tiny UI or API fragments that have little standalone value
- when in doubt, choose the smallest slice that is still clear, valuable, and realistically deliverable

### Split further when:
- a story contains more than one clearly different business outcome
- a story would be too large for a normal sprint-sized delivery slice
- the scope mixes unrelated happy paths or materially different behaviors
- one slice could be delivered and validated independently with business value

### Do not split further when:
- the smaller slice would become a technical task with no standalone business value
- the split only separates implementation concerns
- the smaller slice would cause repeated descriptions or nearly identical acceptance criteria
- the smaller slice would create avoidable overlap with a sibling story
- the split would create scope beyond the parent Feature's MVP-level intent

## Feature flag / controlled rollout (conditional)
Apply this **only when** the parent Feature, its context, or the Additional instructions indicate a
feature flag, experiment, or controlled/percentage rollout (for example LaunchDarkly or any equivalent).

When applicable:
- Prefer including the flag in the **first meaningful business User Story** when that keeps the story coherent.
- A dedicated rollout story may be created only if it still carries real rollout or business value and is not a purely technical task.
- Do not create a flag-only story that reads like setup with no user, rollout, or release value.
- After the flag is introduced, do not repeat flag-setup scope in later stories unless a later story genuinely adds new rollout behavior, targeting logic, or variant control.

When the parent gives no signal of flags/experiments/rollout, do **not** invent one.

## Experimentation / A-B (conditional)
- Treat experimentation as a release mechanism, not a standalone story title, unless the parent Feature is explicitly experimentation-first.
- Include experimentation only where the parent explicitly requires it for a specific journey slice, and keep it inside the relevant journey or rollout story.

## Story writing rules
Each User Story must:
- represent a user-visible functional slice or meaningful business slice
- be independently understandable
- be small enough for delivery in one sprint where possible
- contain explicit business context and business value
- include accessibility in scope when the parent context implies UI work
- allow backend-only or middleware-only stories when they still deliver distinct business value or enable controlled rollout
- avoid purely technical split unless unavoidable
- have its **own unique description** tailored to that exact story
- avoid reusing the same generic description across multiple stories
- balance business completeness with delivery practicality

### Business value requirement
Every User Story must have clear **business added value**: a meaningful customer, commercial, operational, or learning outcome that can be clearly stated. If a proposed story is too small to carry business value by itself, merge it into a broader story.

## User Story description format
Descriptions must be structured with line breaks and sections. Do not return one long paragraph.

As a <persona>
I want <capability>
So that <value>

Business Value:
- explicit statement of the business/customer value delivered by this story

Segment:
- relevant segments only

Background / Context:
- concise business context derived from the parent Feature

Scope:
- item 1
- item 2
- item 3

Out of Scope:
- optional bullet list only when useful
- may include behavior intentionally covered by sibling stories to prevent overlap and duplication
- list downstream/external systems here when they are outside delivery scope but contextually relevant

Dependencies / References:
- linked dependency only if present in parent context

Assumptions:
- list only inferred items that are not explicitly stated
- prefix each item with `Assumption:`
- include only when a minimal assumption is required for clarity or testability; omit otherwise

Accessibility:
- Included for UI-facing stories
- Not applicable (backend-only story) for backend-only, middleware-only, routing-only, or flag-control-only stories
- Not explicitly identified in parent context when the story may affect UX but the parent context is genuinely unclear

## Acceptance criteria rules
Acceptance criteria must:
- use Gherkin style
- be testable and concise
- cover primary success path first
- add negative / alternate path only when required by the parent Feature
- mention segments only where they change behavior
- mention navigation destination only if known from the parent context
- mention rollout targeting / percentage-based exposure only where supported by the parent text
- be written as separate scenario blocks, not as one merged paragraph

Scenario: <short name>
Given <precondition>
When <action>
Then <expected result>
And <optional additional result>

## Clarity over template completeness
- Do not force optional sections when they add no value to the specific story
- Optional sections (**Out of Scope**, **Dependencies / References**, **Assumptions**) should appear only when they improve clarity
- Keep structure readable; do not add filler content just to populate every heading

## Quality checks before finalizing
Only output stories that:
- together cover the parent Feature scope end to end
- are not duplicates of each other and do not overlap in scope with sibling stories
- each have a clear user or business value
- include any feature flag / rollout story only when the parent signals it, and never as a purely technical flag-only story
- handle experimentation only where explicitly grounded in the parent Feature
- each have their **own description** and **own acceptance criteria** in readable formatting
- introduce no unsupported scope beyond the parent Feature context
- are balanced: not over-split and not under-specified
- treat downstream/external systems as **dependencies**, not standalone delivery items
- preserve the parent Feature's **MVP-level intent**

Return JSON only using the schema from the system instruction.
