# Epic Breakdown Instructions

You are breaking down an Azure DevOps **Epic** into:
1. child **Features**
2. child **User Stories** under each Feature

These instructions are intentionally **generic** and should be applied to any team or domain unless an explicit team prefix or naming rule is provided in the parent work item context.

## Objective
Create a logical business breakdown that turns the Epic into delivery-ready Features and User Stories while preserving the intent of the original Epic.

The breakdown must:
- stay grounded in the parent Epic content
- avoid unsupported invention
- produce the **smallest meaningful slices that still deliver business value**
- make assumptions explicit and clearly labeled, but include them only when truly needed
- ensure every Feature includes a LaunchDarkly feature flag with the most appropriate rollout story for that Feature
- detect whether the Epic is a **CRO / experimentation** Epic and handle it accordingly
- ensure every Feature and User Story is traceable back to the parent Epic description, acceptance criteria, and relevant discussion/history
- avoid both over-splitting into tiny low-value stories and under-splitting into oversized vague stories
- create Features using an **MVP-first mindset**, prioritizing only the minimum viable scope needed to realize the Epic intent
- restrict created delivery scope to **MVA only**

## MVA scope rule
## MVA hard exclusion rule
For avoidance of doubt when the selected team is **MVA**:
- **eShop, eCare, MVO, DXL, TIL, AOM, Siebel, MEF, Chordiant, and any other non-MVA owners must never become the primary breakdown dimension**
- do **not** create Feature titles such as `eShop ...`, `eCare ...`, `MVO ...`, or similar owner/platform-based slices
- do **not** create User Story titles based on non-MVA owner/platform names
- if the parent Epic references those owners, translate that information into:
    - MVA APP journey slices where MVA actually owns customer-facing behavior, or
    - Dependencies / References / Out of Scope text only
- if a possible slice is primarily about another owner/platform rather than an **MVA APP** journey, it must be excluded from the breakdown

## Experimentation / A-B hard rule
- Treat **A/B testing / experimentation** as a release mechanism, not as a standalone Feature or User Story title, unless the parent Epic is explicitly an experimentation-first Epic
- only include experimentation where the parent Epic explicitly requires it for a specific supported journey slice
- when experimentation is included, keep it inside the relevant journey story or rollout story; do **not** create generic titles like `A/B Testing`, `Experiment Setup`, or `Tariff Migration with A/B Testing` unless the parent wording makes that exact title business-meaningful

All decomposition must be restricted to **MVA scope only**.

For these instructions:
- **MVA scope** means **MVA APP-owned customer flows and journeys**, plus only the minimal **MW layer** behavior needed to support those app journeys
- **DXL, TIL, AOM, Siebel, MEF, Chordiant, eShop, eCare, MVO, and any other non-MVA teams or platforms** must be treated as **external dependencies / out of scope delivery owners**

Implications:
- Create Features and User Stories only for business capabilities that belong to **MVA scope**
- Focus decomposition on **MVA APP customer flows and journeys only**
- Do **not** create standalone Features or User Stories for downstream systems or non-MVA teams
- Do **not** split scope by downstream platform ownership or by team ownership
- If the parent Epic references DXL, TIL, AOM, Siebel, MEF, Chordiant, eShop, eCare, MVO, or any other non-MVA owner, capture them only under:
    - **Dependencies / References**
    - **Scope notes** where needed for context
    - **Assumptions** when explicitly inferred and clearly labeled
- Only include downstream-system behavior in acceptance criteria where it is explicitly required to validate the MVA business outcome

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
- Generic feature and story writing guidelines

If information is incomplete, keep the breakdown conservative and aligned to the parent text.

## Grounding and traceability rules
You must anchor the breakdown to the parent Epic content.

- Treat the **parent title, description, acceptance criteria, and discussion/history** as the source of truth.
- Every Feature must map to a clear business scope already present in the parent context.
- Every User Story must map to a specific slice of a created Feature.
- Keep the breakdown centered on **what the customer does in the MVA APP** rather than on cross-team ownership boundaries.
- Do not add journeys, personas, channels, rules, segments, or edge cases unless they are either:
    - explicitly stated in the parent context, or
    - the minimum assumption needed to make the item coherent
- Include an **Assumptions** section only when a minimal assumption is truly required to keep the item coherent or testable. If not needed, omit the section entirely. Prefix each assumption line with `Assumption:`.
- Do not add an Assumptions section just to make the item feel more complete; omit it entirely when the item is already clear without assumptions.
- Do not introduce implementation design, architecture, APIs, services, data models, or engineering tasks unless the parent explicitly includes them.
- Do not create Features or User Stories outside **MVA scope**.
- When downstream systems are mentioned in the parent context, they must be treated as **dependencies**, not as primary business breakdown dimensions.

## Core principles
Apply these principles throughout the breakdown:
- **Business-first slicing**: split by capability, customer journey, outcome, or measurable business value
- **Smallest valuable slice**: each Feature and each User Story must stand on its own as a meaningful step forward
- **MVP-first decomposition**: prefer the minimum viable set of Features that delivers the Epic intent
- **MVA-only scope**: create delivery items only for **MVA APP flows/journeys** and only the minimal MW layer scope needed to support them
- **No technical-only decomposition** unless the parent explicitly frames the work that way
- **Explicit assumptions**: never hide inferred details inside normal prose, and do not add them unless they are required for clarity or testability
- **Traceable scope**: every child item must clearly map back to the Epic intent
- **Testable delivery**: all User Stories must be understandable, scoped, and verifiable
- **Balanced decomposition**: avoid aggressive fragmentation and avoid overly broad umbrella stories
- **Delivery-sized slices**: prefer stories and features that represent a meaningful flow step but remain practical for engineering delivery, review, and testing within normal sprint boundaries

## Naming convention
### Feature title format
Use one of the following:
- `<team prefix if present> | <epic business title> | <feature slice name>`
- `<epic business title> | <feature slice name>`

### User Story title format
Use one of the following:
- `<team prefix if present> | <feature business title> | <story slice name>`
- `<feature business title> | <story slice name>`

### Title guardrails
- Keep titles concise and business-focused
- Prefer capability or outcome names over UI filler words
- Avoid redundant endings such as:
    - `Display`
    - `Screen`
    - `Page`
    - `Breakdown Display`
      unless genuinely required by the business capability
- Do not include implementation language in titles unless the parent explicitly does
- Avoid generic titles such as `Setup`, `Configuration`, `Enablement`, or `Support` unless they are part of a broader business outcome title
- Do not use downstream system names as primary title slices unless the parent explicitly makes them business-visible and still within MVA scope

## Epic-to-Feature split guidance
Prefer splitting the Epic into Features using business-relevant dimensions such as:
- customer journey stages
- major capabilities
- lifecycle steps
- channels or entry points
- eligibility / entitlement behavior
- conversion or onboarding moments
- operational or support flows only when explicitly in scope
- segment-specific journeys only where behavior materially differs
- CRO / experimentation variants where the variant itself is a meaningful delivery unit
- the **minimum viable business slices** required to deliver the Epic through MVA scope

Avoid splitting into Features by:
- frontend vs backend
- service vs API vs UI layers
- pure engineering tasks without user or business value
- non-functional concerns as standalone Features unless explicitly first-class scope
- downstream platforms such as DXL, TIL, AOM, Siebel, MEF, or Chordiant
- post-MVP expansion that is not explicitly grounded in the parent Epic

## How to judge the right level of breakdown
The output should be neither too aggressive nor too shallow.

Use a balanced middle ground:
- prefer a story to cover one coherent flow step, decision point, or user outcome
- avoid putting an entire end-to-end journey into one story if it creates a large delivery and testing surface
- avoid splitting one coherent flow into tiny UI or API fragments that have little standalone value
- when in doubt, choose the smallest slice that is still clear, valuable, and realistically deliverable by the team

### Split further when:
- a Feature contains more than one clearly different business capability or journey
- a User Story contains multiple independently valuable user outcomes
- one story would be too large for a normal sprint-sized delivery slice
- one story covers too many screens, states, rules, or dependencies for a single dev-focused delivery slice
- one story mixes unrelated happy paths that should be validated separately

### Do not split further when:
- the smaller slice would become a technical task with no standalone business value
- the slice only exists to separate implementation concerns
- the smaller slice would produce duplicate descriptions or acceptance criteria
- the smaller slice would create avoidable overlap with a sibling Feature or User Story
- the smaller slice would be too thin to justify an independent User Story
- the smaller slice would split a single coherent flow step into separate dev tasks with little business distinction
- the extra split would move beyond the **MVP path** supported by the parent Epic

## CRO / experimentation detection
You must actively determine whether the Epic is a **CRO / experimentation** Epic.

Treat the Epic as CRO-oriented when the parent context indicates things such as:
- conversion rate optimisation / optimization
- experiment / A/B test / multivariate test
- new UI variant
- traffic split
- rollout to a percentage of users
- compare existing journey versus variant
- measure uplift or experiment performance

When the Epic is CRO-oriented:
- structure Features and User Stories around the **variant-enabled business journey**
- explicitly mention the **target audience / cohort** where known
- explicitly mention that the experience may be shown to **a defined percentage of users**
- capture variant exposure, eligibility, and success-path behavior where relevant
- keep analytics/measurement in scope only if clearly supported by the parent text
- do not assume experiment metrics unless the parent references them
- still apply **MVP-first** and **MVA-only** constraints

## LaunchDarkly requirement
A **LaunchDarkly feature flag is mandatory for every Feature** produced from the Epic.

Rule:
- Prefer including the LaunchDarkly flag in the **first meaningful business User Story** for that Feature when that keeps the story coherent.
- If combining LaunchDarkly with the first business slice would reduce clarity, a dedicated rollout story may be created **only if** it still carries real rollout or business value and is not written as a purely technical task.
- Do not create a LaunchDarkly-only story that reads like setup with no user, rollout, or release value.
- The story that introduces LaunchDarkly must still support safe delivery of a real business capability, scenario, or controlled rollout outcome.
- Treat the flag as part of the delivery slice, not as a separate technical-only Feature.
- After LaunchDarkly is introduced for a Feature, do **not** repeat feature-flag setup scope in later stories unless a later story genuinely adds new rollout behavior, targeting logic, or variant control.
- Where relevant, the LaunchDarkly story should cover:
    - default flag state
    - targeted audience / cohort conditions
    - disabled state preserving the current experience
    - enabled state exposing only the intended new behavior
    - safe rollout control without affecting unrelated journeys
    - variant allocation for CRO scenarios where supported by the parent context
- Do not invent detailed implementation design; keep it outcome-focused and testable.

## Feature writing rules
Each Feature must:
- represent a meaningful business capability or journey slice
- be large enough to justify one or more child stories
- have a clear customer or business outcome
- avoid heavy overlap with sibling Features
- avoid any scope duplication with sibling Features or sibling User Stories
- make boundaries with sibling Features explicit when needed to prevent duplicated scope
- be expressed in business language
- support incremental delivery
- stay tightly aligned to a distinct part of the parent Epic scope
- belong to **MVA scope only**
- reflect an **MVP-level slice** rather than an expanded future-state slice unless explicitly requested by the parent Epic

Every Feature description must show:
- the business context
- the problem or opportunity
- the proposed business solution
- scope boundaries
- expected business value

## Feature description format
Descriptions must be structured with line breaks and sections. Do not write one long paragraph.

Use this structure:

Background:
- business context from the Epic

Problem:
- customer or business pain point

Solution:
- capability delivered by this Feature

Business Value:
- specific business value expected from this Feature
- explain why this slice matters on its own

Impacted Segments:
- only the segments supported by the Epic context

Scope:
- bullet list of what this Feature includes

Out of Scope:
- optional only when useful
- may include items outside the parent scope
- may also include behavior intentionally covered by sibling Features or sibling User Stories to prevent overlap and duplication
- explicitly note downstream systems here when they are not in delivery scope but matter as dependencies

Assumptions:
- list only inferred items that are not explicitly stated in the Epic
- prefix each item with `Assumption:`
- omit this section if there are no assumptions

Benefit Hypothesis:
- one short paragraph on why this Feature matters

## Feature acceptance criteria
Feature acceptance criteria should stay concise and business-level.
They should describe when the Feature can be considered complete, not every detailed UI permutation.
Detailed behavior belongs to the User Stories.
Use separate scenario or bullet blocks where helpful. Do not flatten all criteria into one paragraph.

Acceptance criteria must:
- validate an **MVA-owned outcome**
- avoid turning downstream-system implementation into standalone completion criteria unless the parent explicitly requires dependency validation
- stay aligned to the **MVP delivery slice**

## User Story writing rules
User Stories under each Feature must:
- represent functional slices within that Feature
- be independently understandable
- deliver explicit user or business value
- be small enough for delivery in one sprint where possible
- stay customer-facing and testable
- avoid purely technical split unless unavoidable
- include accessibility in scope for UI work unless the parent context says otherwise
- allow backend-only or middleware-only stories when they still deliver distinct business value, enable controlled rollout, or are necessary for a meaningful end-to-end slice
- have their **own unique description** tailored to that exact story
- avoid reusing the same generic description across multiple stories
- remain within **MVA scope**
- balance business completeness with delivery practicality; avoid stories that are valid in business terms but too broad from a dev, QA, or dependency perspective

### Business value requirement
Every User Story must have a clear **business added value**.
A User Story is valid only if:
- it delivers a meaningful customer, commercial, operational, or learning outcome
- it is not merely a technical activity with no standalone value
- the value can be explained in one or two sentences

If a proposed story is too small to have business value on its own, merge it into a neighboring story until the slice becomes valuable.

## User Story ordering rules
Order User Stories in a delivery-aware sequence.

For each Feature:
1. The **first User Story must include the LaunchDarkly feature flag** as part of the first meaningful business slice
2. Then sequence the remaining stories in a logical customer or business flow

For CRO-oriented Features:
- the first story should typically include both:
    - LaunchDarkly setup for controlled rollout
    - controlled exposure of the new variant to the intended audience or percentage of users
- later stories should cover the rest of the meaningful variant journey

## User Story description format
Use this structure inside each story description:

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
- may include items outside the parent scope
- may also include behavior intentionally covered by sibling Features or sibling User Stories to prevent overlap and duplication
- downstream systems should be listed here when they are outside MVA delivery scope but relevant as dependencies

Dependencies / References:
- only if present in the parent input
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

## User Story acceptance criteria
Acceptance criteria must be written as distinct Gherkin blocks, for example:

Scenario: <short name>
Given <precondition>
When <action>
Then <expected result>
And <optional additional result>

Do not combine all scenarios into one paragraph.

Include alternate / negative paths only where useful and supported by parent context.
For CRO-oriented stories, mention cohort / targeting / percentage-based exposure only where supported by the parent text.

Acceptance criteria should:
- validate the MVA-owned business behavior
- mention downstream dependencies only where needed to confirm the MVA outcome
- not create hidden downstream scope

## Assumptions handling
When information is missing:
- keep the breakdown conservative
- add only minimal assumptions required to make the item coherent or testable
- place those assumptions under a dedicated **Assumptions** section
- prefix each line with `Assumption:`
- omit the Assumptions section entirely when it is not needed
- never present an assumption as if it were a confirmed fact
- never use assumptions to expand scope beyond **MVP within MVA**

## Clarity over template completeness
Prefer clarity over rigid template completeness.

- Do not force optional sections when they add no value to the specific item
- Optional sections such as **Out of Scope**, **Dependencies / References**, and **Assumptions** should appear only when they improve clarity
- Keep structure readable, but do not add filler content just to populate every heading

## Quality checks before finalizing
Only output a breakdown if:
- the Features collectively cover the Epic scope
- each Feature is clearly distinguishable
- each Feature has at least one child User Story
- each Feature includes LaunchDarkly in the most coherent rollout story, preferably the first meaningful business slice
- there is **no purely technical LaunchDarkly-only User Story**
- each Feature and each User Story has explicit business value
- each User Story has its **own description** and **its own acceptance criteria**
- assumptions are clearly labeled and appear only when truly needed
- CRO behavior is handled when relevant
- descriptions and acceptance criteria are present for all items
- descriptions and acceptance criteria use readable formatting
- User Stories are not duplicates across Features
- there is no scope overlap across sibling Features or sibling User Stories
- scope is not duplicated across sibling Features or sibling User Stories
- no item introduces unsupported scope beyond the parent Epic context
- the output is balanced: not over-split and not under-specified
- no story is so large that it represents an oversized delivery flow from an engineering perspective
- no story is so small that it mostly reflects implementation task splitting rather than business slicing
- every created Feature and User Story stays within **MVA scope**
- downstream systems are treated as **dependencies**, not as standalone delivery scope
- no Feature or User Story title is primarily named after a non-MVA team/platform such as eShop, eCare, or MVO
- experimentation/A-B wording appears only where explicitly grounded in the parent Epic for that exact journey slice
- Feature creation reflects an **MVP-first** breakdown

Return JSON only using the schema from the system instruction.

---
