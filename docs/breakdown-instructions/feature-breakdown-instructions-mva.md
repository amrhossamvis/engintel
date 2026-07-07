# Feature Breakdown Instructions

You are breaking down an Azure DevOps **Feature** into **child User Stories only**.

These instructions are intentionally **generic** and should be applied to any team or domain unless an explicit team prefix or naming rule is provided in the parent work item context.

## Objective
Create a business-aligned, delivery-ready set of child User Stories that fully cover the Feature scope without duplicating work or inventing unsupported functionality.

The breakdown must:
- stay grounded in the parent Feature content
- avoid unsupported invention
- produce the **smallest meaningful slices that still deliver business value**
- make assumptions explicit and clearly labeled, but include them only when truly needed
- ensure the Feature includes the LaunchDarkly feature flag in the most appropriate rollout story
- detect whether the Feature is **CRO / experimentation** focused and handle it accordingly
- ensure every User Story is traceable back to the parent Feature description, acceptance criteria, and relevant discussion/history
- avoid both over-splitting into tiny low-value stories and under-splitting into oversized vague stories
- restrict created User Stories to **MVA scope only**
- preserve the parent Feature's **MVP intent** and avoid expanding into post-MVP scope unless explicitly stated

## MVA scope rule
## MVA hard exclusion rule
For avoidance of doubt when the selected team is **MVA**:
- **eShop, eCare, MVO, DXL, TIL, AOM, Siebel, MEF, Chordiant, and any other non-MVA owners must never become the primary breakdown dimension**
- do **not** create User Story titles such as `eShop ...`, `eCare ...`, `MVO ...`, or similar owner/platform-based slices
- if the parent Feature references those owners, translate that information into:
    - MVA APP journey slices where MVA actually owns customer-facing behavior, or
    - Dependencies / References / Out of Scope text only
- if a possible slice is primarily about another owner/platform rather than an **MVA APP** journey, it must be excluded from the breakdown

## Experimentation / A-B hard rule
- Treat **A/B testing / experimentation** as a release mechanism, not as a standalone User Story title, unless the parent Feature is explicitly experimentation-first
- only include experimentation where the parent Feature explicitly requires it for a specific supported journey slice
- when experimentation is included, keep it inside the relevant journey story or rollout story; do **not** create generic titles like `A/B Testing`, `Experiment Setup`, or `Tariff Migration with A/B Testing` unless the parent wording makes that exact title business-meaningful

All decomposition must be restricted to **MVA scope only**.

For these instructions:
- **MVA scope** means **MVA APP-owned customer flows and journeys**, plus only the minimal **MW layer** behavior needed to support those app journeys
- **DXL, TIL, AOM, Siebel, MEF, Chordiant, eShop, eCare, MVO, and any other non-MVA teams or platforms** are **external dependencies / out of scope delivery owners**

Implications:
- Create User Stories only for behavior owned by **MVA scope**
- Focus decomposition on **MVA APP customer flows and journeys only**
- Do **not** create separate User Stories for downstream systems or non-MVA teams
- If downstream systems or non-MVA teams are mentioned in the parent Feature, capture them only as:
    - **Dependencies / References**
    - context in **Out of Scope**
    - clearly labeled **Assumptions** when required
- Mention downstream systems in acceptance criteria only when needed to validate the MVA outcome explicitly supported by the parent Feature

## Inputs to use
Use only:
- Parent Feature title
- Parent Feature description
- Parent Feature acceptance criteria
- Parent comments / history if present
- Generic feature and story writing guidelines

If information is missing, keep the breakdown conservative and stay close to the parent wording.

## Grounding and traceability rules
You must anchor the breakdown to the parent Feature content.

- Treat the **parent title, description, acceptance criteria, and discussion/history** as the source of truth.
- Every User Story must map to a clear business slice already present in the parent context.
- Keep the breakdown centered on **what the customer does in the MVA APP** rather than on cross-team ownership boundaries.
- Do not add journeys, personas, channels, segments, rules, edge cases, or dependencies unless they are either:
    - explicitly stated in the parent context, or
    - the minimum assumption needed to make the story coherent
- Include an **Assumptions** section only when a minimal assumption is truly required to keep the story coherent or testable. If not needed, omit the section entirely. Prefix each assumption line with `Assumption:`.
- Do not add an Assumptions section just to make the story feel more complete; omit it entirely when the story is already clear without assumptions.
- Do not introduce implementation design, architecture, APIs, services, data models, or engineering tasks unless the parent explicitly includes them.
- Do not create User Stories outside **MVA scope**.
- Treat downstream systems only as dependencies unless the parent explicitly describes MVA-owned behavior involving them.

## Core principles
Apply these principles throughout the breakdown:
- **Business-first slicing**: split by customer journey, capability, or meaningful outcome
- **Smallest valuable slice**: every User Story must deliver real value on its own
- **No hidden assumptions**: inferred details must be labeled, and assumptions must not be added unless they are required for clarity or testability
- **No technical-only slicing** unless explicitly required by the parent
- **Traceable scope**: every User Story must map clearly back to the parent Feature
- **Testable delivery**: stories must be understandable, scoped, and verifiable
- **Balanced decomposition**: avoid aggressive fragmentation and avoid overly broad umbrella stories
- **Delivery-sized slices**: prefer stories that represent one coherent flow step or outcome while remaining practical for engineering delivery, review, and testing within normal sprint boundaries
- **MVA-only scope**: create stories only for **MVA APP flows/journeys** and only the minimal MW layer scope needed to support them
- **MVP-preserving refinement**: do not expand the Feature into post-MVP scope unless the parent explicitly requires it

## Naming convention
Every created User Story title should use one of the following:
- `<team prefix if present> | <feature business title> | <story slice name>`
- `<feature business title> | <story slice name>`

### Title guardrails
- Keep the final title segment concise and outcome-focused
- Prefer business capability names over visual filler wording
- Avoid redundant suffixes such as:
    - `Display`
    - `Screen`
    - `Page`
    - `Breakdown Display`
      unless essential to the business capability
- Avoid technical implementation wording in titles unless the parent explicitly uses it
- Avoid generic titles such as `Setup`, `Configuration`, `Enablement`, or `Support` unless they are part of a broader business outcome title
- Avoid using downstream system names or non-MVA team names as the main story split unless explicitly required by the parent Feature and still owned by MVA scope

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
- CRO / experiment variant exposure where it is a meaningful slice
- the minimum set of business slices needed to complete the Feature within MVA scope

Do not split by backend/frontend only.
Do not split by team ownership such as eShop, eCare, MVO, or other non-MVA teams.

## How to judge the right level of breakdown
The output should be neither too aggressive nor too shallow.

Use a balanced middle ground:
- prefer a story to cover one coherent flow step, decision point, or user outcome
- avoid putting an entire end-to-end journey into one story if it creates a large delivery and testing surface
- avoid splitting one coherent flow into tiny UI or API fragments that have little standalone value
- when in doubt, choose the smallest slice that is still clear, valuable, and realistically deliverable by the team

### Split further when:
- a story contains more than one clearly different business outcome
- a story would be too large for a normal sprint-sized delivery slice
- the scope mixes unrelated happy paths or materially different behaviors
- the story covers too many screens, states, rules, or dependencies for a single dev-focused delivery slice
- one slice could be delivered and validated independently with business value

### Do not split further when:
- the smaller slice would become a technical task with no standalone business value
- the split only separates implementation concerns
- the smaller slice would cause repeated descriptions or nearly identical acceptance criteria
- the smaller slice would create avoidable overlap with a sibling story
- the slice is too thin to justify an independent User Story
- the smaller slice would split a single coherent flow step into separate dev tasks with little business distinction
- the split would create scope beyond the parent Feature's MVP-level intent

## CRO / experimentation detection
You must actively determine whether the Feature is **CRO / experimentation** focused.

Treat the Feature as CRO-oriented when the parent context indicates:
- conversion optimization
- A/B testing
- multivariate testing
- experiment / variant
- rollout to a subset or percentage of users
- compare control versus treatment journey
- selective exposure of a new UI or journey

When the Feature is CRO-oriented:
- explicitly reflect the **new UI variant / treatment experience**
- mention the intended **audience / cohort** where known
- mention rollout to **a specific amount or percentage of users** where supported by the parent text
- keep stories focused on meaningful customer or business value, not just experiment mechanics
- include experiment gating via LaunchDarkly in the first story
- do not invent KPIs or measurement details unless the parent explicitly provides them
- still respect **MVA-only** and **MVP-preserving** constraints

## LaunchDarkly requirement
A **LaunchDarkly feature flag is mandatory** for the Feature.

Rule:
- Prefer including the LaunchDarkly flag in the **first meaningful business User Story** when that keeps the story coherent.
- If combining LaunchDarkly with the first business slice would reduce clarity, a dedicated rollout story may be created **only if** it still carries real rollout or business value and is not written as a purely technical task.
- Do not create a LaunchDarkly-only story that reads like setup with no user, rollout, or release value.
- The story that introduces LaunchDarkly must still deliver or safely control a meaningful business capability, scenario, or rollout outcome.
- Treat the flag as part of a valuable delivery slice, not as a standalone technical-only story.
- After LaunchDarkly is introduced, do **not** repeat feature-flag setup scope in later stories unless a later story genuinely adds new rollout behavior, targeting logic, or variant control.
- Where relevant, the LaunchDarkly story should also cover:
    - default flag state
    - targeted audience / cohort eligibility
    - disabled state preserving the current experience
    - enabled state exposing only the intended new behavior
    - safe rollout control without affecting unrelated journeys
    - variant allocation for CRO scenarios
- Keep the wording outcome-focused and testable. Do not invent detailed implementation design.

## Story writing rules
Each User Story must:
- represent a user-visible functional slice or meaningful business slice
- be independently understandable
- be small enough for delivery in one sprint where possible
- contain explicit business context and business value
- include accessibility in scope when the parent context implies UI work
- allow backend-only or middleware-only stories when they still deliver distinct business value, enable controlled rollout, or are necessary for a meaningful end-to-end slice
- avoid purely technical split unless unavoidable
- have its **own unique description** tailored to that exact story
- avoid reusing the same generic description across multiple stories
- stay within **MVA scope**
- balance business completeness with delivery practicality; avoid stories that are valid in business terms but too broad from a dev, QA, or dependency perspective
- avoid expanding the Feature into post-MVP behavior unless explicitly supported by the parent

### Business value requirement
Every User Story must have clear **business added value**.
A User Story is valid only if:
- it delivers a meaningful customer, commercial, operational, or learning outcome
- it is not only a technical task with no standalone value
- the value can be clearly stated

If a proposed story is too small to carry business value by itself, merge it into a broader story that does.

## Story ordering rules
Order stories in a logical delivery sequence.

1. The **first User Story must include the LaunchDarkly feature flag** as part of the first meaningful business slice
2. Remaining stories should follow the most coherent user or business flow

For CRO-oriented Features:
- the first story should typically include both:
    - LaunchDarkly setup for controlled rollout
    - controlled exposure of the new variant to the intended audience or percentage of users
- later stories should cover the rest of the variant-enabled journey

## User Story description format
Descriptions must be structured with line breaks and sections. Do not return one long paragraph.

Use this structure:

As a <persona>
I want <capability>
So that <value>

Business Value:
- explicit statement of the business/customer value delivered by this story

Segment:
- <relevant segments only>

Background / Context:
- concise business context derived from the parent Feature

Scope:
- item 1
- item 2
- item 3

Out of Scope:
- optional bullet list only when useful
- may include items outside the parent scope
- may also include behavior intentionally covered by sibling stories to prevent overlap and duplication
- downstream systems should be listed here when they are outside MVA delivery scope but contextually relevant

Dependencies / References:
- linked dependency only if present in parent context
- use this section for DXL, TIL, AOM, Siebel, MEF, or Chordiant where applicable

Assumptions:
- list only inferred items that are not explicitly stated
- prefix each item with `Assumption:`
- include this section only when a minimal assumption is required for clarity or testability
- omit this section if there are no assumptions

Accessibility:
- Included for UI-facing stories
- Not applicable (backend-only story) for backend-only, middleware-only, routing-only, or flag-control-only stories
- Not explicitly identified in parent context only when the story may affect UX but the parent context is genuinely unclear

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
- validate **MVA-owned** behavior
- avoid introducing hidden downstream delivery scope

Use this format:

Scenario: <short name>
Given <precondition>
When <action>
Then <expected result>
And <optional additional result>

## Assumptions handling
When information is missing:
- keep the breakdown conservative
- add only minimal assumptions required to make the story coherent or testable
- place them under a dedicated **Assumptions** section
- prefix each line with `Assumption:`
- omit the Assumptions section entirely when it is not needed
- never present inferred details as facts
- never use assumptions to extend scope beyond **MVA** or beyond the parent Feature's MVP intent

## Clarity over template completeness
Prefer clarity over rigid template completeness.

- Do not force optional sections when they add no value to the specific story
- Optional sections such as **Out of Scope**, **Dependencies / References**, and **Assumptions** should appear only when they improve clarity
- Keep structure readable, but do not add filler content just to populate every heading

## Quality checks before finalizing
Only output stories that:
- together cover the parent Feature scope end to end
- are not duplicates of each other
- do not overlap in scope with sibling stories
- each have a clear user or business value
- LaunchDarkly is included in the most coherent rollout story, preferably the first meaningful business slice
- there is **no purely technical LaunchDarkly-only story**
- assumptions are clearly labeled and appear only when truly needed
- CRO behavior is handled when relevant
- each story has its **own description** and **its own acceptance criteria**
- descriptions and acceptance criteria use readable formatting
- no story introduces unsupported scope beyond the parent Feature context
- the output is balanced: not over-split and not under-specified
- no story is so large that it represents an oversized delivery flow from an engineering perspective
- no story is so small that it mostly reflects implementation task splitting rather than business slicing
- every story stays within **MVA scope**
- scope is not duplicated across sibling stories
- downstream systems are treated as **dependencies**, not as standalone delivery items
- no User Story title is primarily named after a non-MVA team/platform such as eShop, eCare, or MVO
- experimentation/A-B wording appears only where explicitly grounded in the parent Feature for that exact journey slice
- the breakdown preserves the parent Feature's **MVP-level intent**

Return JSON only using the schema from the system instruction.
