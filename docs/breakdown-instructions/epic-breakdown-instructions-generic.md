# Epic Breakdown Instructions (Generic)

You are breaking down an Azure DevOps **Epic** into:
1. child **Features**
2. child **User Stories** under each Feature

These instructions are **team- and domain-agnostic**. They apply to any area path (for example
`Area\Team\Product`) and any squad. Naming prefixes, scope boundaries, and any
team-specific conventions come from the parent work item context and from the run-specific
**Additional instructions** file (`04_po_recommendations.md`) when present.

## Precedence
- The parent Epic content is the source of truth for *what* to build.
- The **Additional instructions** file, when present, takes precedence for naming conventions,
  team prefixes, scope rules, exclusions, and any house style. Apply it on top of these generic rules.
- When the two conflict, follow the Additional instructions; otherwise follow this file.

## Objective
Create a logical business breakdown that turns the Epic into delivery-ready Features and User Stories
while preserving the intent of the original Epic.

The breakdown must:
- stay grounded in the parent Epic content
- avoid unsupported invention
- produce the **smallest meaningful slices that still deliver business value**
- make assumptions explicit and clearly labeled, but include them only when truly needed
- ensure every Feature and User Story is traceable back to the parent Epic description, acceptance criteria, and relevant discussion/history
- avoid both over-splitting into tiny low-value stories and under-splitting into oversized vague stories
- create Features using an **MVP-first mindset**, prioritizing only the minimum viable scope needed to realize the Epic intent

## MVP-first rule for Feature creation
When creating Features from the Epic:
- prioritize the **minimum viable product** needed to deliver the Epic outcome
- prefer the smallest business-complete set of Features that can be delivered and validated
- defer optional enhancements, future optimizations, advanced variants, broad exception handling, and post-MVP expansion unless explicitly stated in the parent Epic
- do not create separate Features for speculative future phases unless the parent Epic clearly includes them
- when multiple possible Feature splits exist, choose the split that best represents an **MVP delivery path**

## Inputs to use
Use only:
- Parent Epic title
- Parent Epic description
- Parent Epic acceptance criteria
- Parent comments / history if present
- Additional instructions file when present

If information is incomplete, keep the breakdown conservative and aligned to the parent text.

## Grounding and traceability rules
- Treat the **parent title, description, acceptance criteria, and discussion/history** as the source of truth.
- Every Feature must map to a clear business scope already present in the parent context.
- Every User Story must map to a specific slice of a created Feature.
- Do not add journeys, personas, channels, rules, segments, or edge cases unless they are either:
    - explicitly stated in the parent context, or
    - the minimum assumption needed to make the item coherent
- Include an **Assumptions** section only when a minimal assumption is truly required. Prefix each line with `Assumption:`. Omit otherwise.
- Do not introduce implementation design, architecture, APIs, services, data models, or engineering tasks unless the parent explicitly includes them.
- Treat downstream/external systems as **dependencies**, not as primary business breakdown dimensions.

## Core principles
- **Business-first slicing**: split by capability, customer journey, outcome, or measurable business value
- **Smallest valuable slice**: each Feature and User Story must stand on its own as a meaningful step forward
- **MVP-first decomposition**: prefer the minimum viable set of Features that delivers the Epic intent
- **No technical-only decomposition** unless the parent explicitly frames the work that way
- **Explicit assumptions**: never hide inferred details inside prose; add them only when required for clarity or testability
- **Traceable scope**: every child item must clearly map back to the Epic intent
- **Testable delivery**: all User Stories must be understandable, scoped, and verifiable
- **Balanced decomposition**: avoid aggressive fragmentation and avoid overly broad umbrella stories
- **Delivery-sized slices**: prefer stories and features practical for engineering delivery, review, and testing within normal sprint boundaries

## Naming convention
### Feature title format
- `<team prefix if provided> | <epic business title> | <feature slice name>`
- `<epic business title> | <feature slice name>`

### User Story title format
- `<team prefix if provided> | <feature business title> | <story slice name>`
- `<feature business title> | <story slice name>`

Use a team prefix only when the parent context or the Additional instructions provide one. Do not invent one.

### Title guardrails
- Keep titles concise and business-focused
- Prefer capability or outcome names over UI filler words
- Avoid redundant endings such as `Display`, `Screen`, `Page`, `Breakdown Display` unless genuinely required
- Do not include implementation language in titles unless the parent explicitly does
- Avoid generic titles such as `Setup`, `Configuration`, `Enablement`, or `Support` unless part of a broader business outcome title

## Epic-to-Feature split guidance
Prefer splitting using business-relevant dimensions such as:
- customer journey stages
- major capabilities
- lifecycle steps
- channels or entry points
- eligibility / entitlement behavior
- conversion or onboarding moments
- segment-specific journeys only where behavior materially differs
- experiment / variant units where the variant itself is a meaningful delivery unit
- the **minimum viable business slices** required to deliver the Epic

Avoid splitting Features by frontend vs backend, service/API/UI layers, pure engineering tasks, team/platform ownership, or post-MVP expansion not grounded in the parent Epic.

## How to judge the right level of breakdown
- prefer a story to cover one coherent flow step, decision point, or user outcome
- avoid putting an entire end-to-end journey into one story if it creates a large delivery and testing surface
- avoid splitting one coherent flow into tiny UI or API fragments with little standalone value
- when in doubt, choose the smallest slice that is still clear, valuable, and realistically deliverable

### Split further when:
- a Feature contains more than one clearly different business capability or journey
- a User Story contains multiple independently valuable user outcomes
- one story would be too large for a normal sprint-sized delivery slice
- one story covers too many screens, states, rules, or dependencies for a single delivery slice
- one story mixes unrelated happy paths that should be validated separately

### Do not split further when:
- the smaller slice would become a technical task with no standalone business value
- the slice only separates implementation concerns
- the smaller slice would produce duplicate descriptions or acceptance criteria
- the smaller slice would create avoidable overlap with a sibling Feature or User Story
- the extra split would move beyond the **MVP path** supported by the parent Epic

## Feature flag / controlled rollout (conditional)
Apply this **only when** the parent Epic, its context, or the Additional instructions indicate a
feature flag, experiment, or controlled/percentage rollout (for example LaunchDarkly or any equivalent).

When applicable:
- Prefer including the flag in the **first meaningful business User Story** for that Feature when it keeps the story coherent.
- A dedicated rollout story may be created only if it still carries real rollout or business value and is not a purely technical task.
- Do not create a flag-only story that reads like setup with no user, rollout, or release value.
- After the flag is introduced for a Feature, do not repeat flag-setup scope in later stories unless a later story genuinely adds new rollout behavior, targeting logic, or variant control.

When the parent gives no signal of flags/experiments/rollout, do **not** invent one.

## Experimentation / A-B (conditional)
- Treat experimentation as a release mechanism, not a standalone Feature or User Story title, unless the parent Epic is explicitly experimentation-first.
- Include experimentation only where the parent explicitly requires it for a specific journey slice, kept inside the relevant journey or rollout story.

## Feature writing rules
Each Feature must:
- represent a meaningful business capability or journey slice
- be large enough to justify one or more child stories
- have a clear customer or business outcome
- avoid heavy overlap or scope duplication with sibling Features
- be expressed in business language and support incremental delivery
- stay tightly aligned to a distinct part of the parent Epic scope
- reflect an **MVP-level slice** rather than an expanded future-state slice unless explicitly requested

## Feature description format
Background:
- business context from the Epic

Problem:
- customer or business pain point

Solution:
- capability delivered by this Feature

Business Value:
- specific business value expected from this Feature; explain why this slice matters on its own

Impacted Segments:
- only the segments supported by the Epic context

Scope:
- bullet list of what this Feature includes

Out of Scope:
- optional only when useful
- may include behavior intentionally covered by sibling Features/User Stories to prevent overlap
- note downstream/external systems here when they are dependencies, not delivery scope

Assumptions:
- list only inferred items not explicitly stated; prefix each with `Assumption:`; omit if none

Benefit Hypothesis:
- one short paragraph on why this Feature matters

## Feature acceptance criteria
Keep concise and business-level: describe when the Feature is complete, not every UI permutation. Detailed behavior belongs to the User Stories. Use separate scenario or bullet blocks; do not flatten into one paragraph. Stay aligned to the **MVP delivery slice**.

## User Story writing rules
User Stories under each Feature must:
- represent functional slices within that Feature
- be independently understandable and deliver explicit user or business value
- be small enough for delivery in one sprint where possible
- stay customer-facing and testable; avoid purely technical split unless unavoidable
- include accessibility in scope for UI work unless the parent context says otherwise
- allow backend-only or middleware-only stories when they still deliver distinct business value or enable controlled rollout
- have their **own unique description** tailored to that exact story; avoid reused generic descriptions

### Business value requirement
Every User Story must have a clear **business added value** explainable in one or two sentences. If a proposed story is too small to have business value on its own, merge it into a neighboring story.

## User Story description format
As a <persona>
I want <capability>
So that <value>

Business Value:
- explicit statement of the business/customer value delivered by this story

Segment:
- relevant segments only

Background / Context:
- concise context derived from the Feature and parent Epic

Scope:
- item 1
- item 2
- item 3

Out of Scope:
- optional only when useful
- may include behavior intentionally covered by sibling Features/User Stories to prevent overlap
- list downstream/external systems here when outside delivery scope but relevant as dependencies

Dependencies / References:
- only if present in the parent input

Assumptions:
- list only inferred items not explicitly stated; prefix each with `Assumption:`; include only when required for clarity or testability

Accessibility:
- Included for UI-facing stories
- Not applicable (backend-only story) for backend-only, middleware-only, routing-only, or flag-control-only stories
- Not explicitly identified in parent context when the story may affect UX but the parent context is genuinely unclear

## User Story acceptance criteria
Write as distinct Gherkin blocks:

Scenario: <short name>
Given <precondition>
When <action>
Then <expected result>
And <optional additional result>

Do not combine all scenarios into one paragraph. Include alternate / negative paths only where useful and supported by parent context.

## Clarity over template completeness
- Do not force optional sections when they add no value to the specific item
- Optional sections (**Out of Scope**, **Dependencies / References**, **Assumptions**) appear only when they improve clarity
- Keep structure readable; do not add filler content just to populate every heading

## Quality checks before finalizing
Only output a breakdown if:
- the Features collectively cover the Epic scope and each is clearly distinguishable
- each Feature has at least one child User Story
- include any feature flag / rollout story only when the parent signals it, and never as a purely technical flag-only story
- handle experimentation only where explicitly grounded in the parent Epic
- each Feature and User Story has explicit business value
- each User Story has its **own description** and **own acceptance criteria** in readable formatting
- User Stories are not duplicates across Features and there is no scope overlap across siblings
- no item introduces unsupported scope beyond the parent Epic context
- the output is balanced: not over-split and not under-specified
- downstream/external systems are treated as **dependencies**, not standalone delivery scope
- Feature creation reflects an **MVP-first** breakdown

Return JSON only using the schema from the system instruction.
