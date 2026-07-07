# User Story Roll-up Instructions (Generic)

You are rolling up an existing Azure DevOps **User Story** and its linked **User Stories** into:
1. one new parent **Feature**
2. one new parent **Epic** above that Feature

This is a roll-up flow, not a breakdown flow.
Do **not** create new User Stories.
The listed User Stories already exist and will be linked under the created Feature.

These instructions are **team- and domain-agnostic**. Naming prefixes, scope boundaries, and any
team-specific conventions come from the listed work items and from the run-specific
**Additional instructions** file (`04_po_recommendations.md`) when present.

## Precedence
- The input and linked User Stories are the source of truth.
- The **Additional instructions** file, when present, takes precedence for naming conventions,
  team prefixes, scope rules, exclusions, and house style. Apply it on top of these generic rules.
- When the two conflict, follow the Additional instructions; otherwise follow this file.

## Objective
Create one business-aligned Feature and one business-aligned Epic that accurately summarize the
existing User Stories while preserving their original delivery intent.

The roll-up must:
- stay grounded in the input User Story and linked User Stories
- avoid unsupported invention
- create the smallest meaningful parent Feature and Epic needed to group the listed stories
- preserve the existing story scope without expanding it
- make assumptions explicit and clearly labeled only when required
- treat linked User Stories as the source of truth

## Experimentation / A-B (conditional)
- Treat experimentation as a release mechanism, not as the Feature or Epic title, unless the listed User Stories are explicitly experimentation-first.
- Include experimentation only where the listed stories explicitly require it, kept inside the relevant scope or rollout wording. Do not create generic parent titles like `A/B Testing` or `Experiment Setup`.

## Inputs to use
Use only:
- input User Story title, description, acceptance criteria, comments/history
- linked User Story titles, descriptions, acceptance criteria, comments/history
- Additional instructions file when present

## Roll-up rules
- Create exactly one Feature that represents the common business capability across the listed User Stories.
- Create exactly one Epic that represents the broader business outcome delivered by that Feature.
- Do not create or suggest additional User Stories.
- Do not duplicate detailed story acceptance criteria into the Feature or Epic.
- Keep Feature acceptance criteria business-level and focused on the listed stories being grouped coherently.
- Keep Epic acceptance criteria outcome-level and focused on the Feature representing the intended business outcome.
- Preserve the input story's Area Path and Iteration Path. The script applies those paths to the created Feature and Epic.
- If the linked stories have different Area Path or Iteration Path values, do not mention that as new scope; the script aligns them when configured.

## Feature title format
- `<team prefix if provided> | <business capability> | <feature slice name>`
- `<business capability> | <feature slice name>`

## Epic title format
- `<team prefix if provided> | <business outcome>`
- `<business outcome>`

Use a team prefix only when the listed stories or the Additional instructions provide one. Do not invent one.

## Title guardrails
- Keep titles concise and business-focused
- Prefer customer journey, capability, or outcome names over UI filler words
- Avoid redundant endings such as `Display`, `Screen`, `Page`, or `Breakdown Display` unless essential
- Avoid technical implementation language unless the listed stories explicitly use it as business-visible scope

## Feature description format
Background:
- concise business context from the listed User Stories

Problem:
- customer or business pain point represented by the listed User Stories

Solution:
- parent Feature capability that groups the listed User Stories

Business Value:
- specific value delivered by grouping these stories under this Feature

Scope:
- summarize included scope from the listed stories only

Out of Scope:
- optional only when useful
- list downstream/external systems here when they are only dependencies

Dependencies / References:
- optional only if present in the listed stories

Assumptions:
- optional only when required; prefix every assumption with `Assumption:`

## Epic description format
Background:
- broader business context inferred directly from the listed User Stories

Problem:
- broader customer or business problem represented by the Feature

Solution:
- Epic-level outcome delivered by the Feature

Business Value:
- business value of the Epic outcome

Scope:
- summarize the Feature scope only

Out of Scope:
- optional only when useful

Assumptions:
- optional only when required; prefix every assumption with `Assumption:`

## Acceptance criteria
Use concise business-level criteria. Do not flatten or copy all story-level criteria.

Feature acceptance criteria should confirm:
- the listed User Stories are coherently grouped under one Feature
- the Feature title and description represent the existing story scope
- the Feature does not introduce scope outside the listed stories

Epic acceptance criteria should confirm:
- the Epic groups the created Feature under the correct business outcome
- the Epic does not introduce new delivery scope beyond the Feature and listed stories
- dependencies are documented as context only

## Quality checks before finalizing
Only output a roll-up if:
- exactly one Feature is defined
- exactly one Epic is defined
- no new User Stories are generated
- the Feature is traceable to all listed User Stories
- the Epic is traceable to the Feature
- no unsupported scope is introduced
- experimentation/A-B wording appears only where explicitly grounded in the listed stories
- descriptions and acceptance criteria are readable and structured

Return JSON only using the schema from the system instruction.
