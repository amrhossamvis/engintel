# Generic Technical Breakdown Instructions

These instructions are generic and should be applied to any engineering team, platform, or technology domain unless the parent work item explicitly provides a team-specific rule, naming convention, or delivery boundary.

## Objective

Create a logical technical breakdown that turns the parent technical work item into delivery-ready Azure DevOps work items while preserving the intent of the parent.

The breakdown must:

- stay grounded in the parent title, description, acceptance criteria, comments, and history
- use authoritative technical material where relevant
- search and reference official vendor, framework, product, cloud, security, or platform documentation before recommending implementation steps
- produce the smallest meaningful technical slices that still deliver engineering, operational, security, compliance, reliability, maintainability, or delivery value
- avoid unsupported invention
- avoid generic engineering tasks that are not traceable to the parent
- include high-level implementation guidelines
- include technical recommendations based on the parent context and authoritative material
- make assumptions explicit and clearly labeled, but only when truly needed
- identify dependencies, risks, compatibility considerations, rollout constraints, testing needs, and rollback considerations
- avoid both over-splitting into low-value tasks and under-splitting into broad vague technical items
- use an MVP-first / minimum viable technical change mindset
- restrict created scope to what is necessary to satisfy the parent technical work item

## Authoritative Material Requirement

For technical breakdowns, actively search or inspect relevant authoritative material before creating the breakdown when the parent involves a named technology, platform, framework, language, runtime, library, protocol, cloud service, security standard, or vendor product.

Authoritative material includes, in priority order:

1. official vendor documentation
2. official migration guides
3. official release notes
4. official compatibility matrices
5. official security advisories
6. official deprecation notices
7. official API or SDK documentation
8. official architecture or operational guidance
9. recognized standards bodies where applicable
10. internal parent work item context, comments, and linked references

Examples:

- For a Java upgrade, use Oracle, OpenJDK, Eclipse Temurin, Spring, Gradle, Maven, application server, and relevant framework compatibility documentation depending on the parent context.
- For a Spring Boot upgrade, use official Spring Boot migration guides and release notes.
- For a Kubernetes upgrade, use official Kubernetes version skew policy, release notes, API deprecation guide, and cloud-provider guidance if applicable.
- For a database upgrade, use official database vendor upgrade guides, compatibility notes, driver documentation, and backup / rollback guidance.
- For a security remediation, use official CVE, vendor advisory, NVD, OWASP, or product-specific remediation guidance where relevant.
- For a cloud migration, use official cloud provider migration, architecture, IAM, networking, observability, and service-limit documentation.

## Source Usage Rules

Use authoritative material to inform:

- compatibility risks
- version prerequisites
- deprecated or removed functionality
- required configuration changes
- build and runtime changes
- migration sequencing
- testing focus areas
- rollout and rollback considerations
- observability and operational checks
- recommended target-state technical approach

Do not copy large passages from documentation. Summarize the relevant guidance in your own words.

If documentation is missing, ambiguous, or conflicting:

- state that clearly
- prefer the safest conservative recommendation
- add an assumption only when required
- avoid inventing unsupported details

## Inputs To Use

Use:

- Parent title
- Parent description
- Parent acceptance criteria
- Parent comments / history if present
- Linked references if present
- Authoritative technical documentation
- Generic engineering delivery guidelines
- Existing architecture, dependency, platform, or operational constraints explicitly mentioned in the parent context

If information is incomplete, keep the breakdown conservative and aligned to the parent text.

## Grounding And Traceability Rules

You must anchor the breakdown to the parent technical work item.

- Treat the parent title, description, acceptance criteria, comments, and history as the source of truth.
- Every created item must map to a clear technical outcome already present or directly implied by the parent.
- Do not add unrelated modernization, refactoring, tooling, observability, or platform work unless it is necessary to satisfy the parent.
- Do not introduce new technologies, frameworks, cloud services, or architecture patterns unless the parent requires them or authoritative material makes them necessary for the target change.
- Include an **Assumptions** section only when a minimal assumption is truly required to make the item coherent or testable.
- Prefix each assumption line with `Assumption:`.
- Do not add an Assumptions section just to make the item feel complete.
- Do not present assumptions as confirmed facts.

## Core Principles

Apply these principles throughout the breakdown:

- **Outcome-first technical slicing**: split by meaningful technical outcome, migration phase, compatibility boundary, runtime capability, security outcome, operational readiness, or release safety.
- **Smallest valuable technical slice**: each item must deliver clear engineering, operational, security, compliance, reliability, maintainability, or delivery value.
- **Authoritative guidance first**: recommendations must be informed by official or trusted technical material.
- **Traceable scope**: every item must connect back to the parent.
- **Implementation clarity**: provide high-level implementation guidance without turning stories into low-level task lists.
- **Testable delivery**: every story must have clear technical acceptance criteria.
- **Balanced decomposition**: avoid tiny implementation tasks and avoid oversized vague stories.
- **MVP technical change**: deliver only the minimum viable technical scope needed to satisfy the parent.
- **Risk-aware delivery**: highlight compatibility, dependency, rollback, observability, and deployment concerns where relevant.
- **No unsupported expansion**: do not add future-state improvements unless explicitly required.

## Technical Work Type Classification

Before breaking down the parent, determine the dominant technical type.

Possible types include:

- Runtime / language upgrade
- Framework upgrade
- Library / dependency upgrade
- Cloud service migration
- Infrastructure modernization
- CI/CD improvement
- Security remediation
- Compliance / policy implementation
- API / integration modernization
- Observability / monitoring improvement
- Performance / scalability improvement
- Data platform / database migration
- Decommissioning / removal
- Developer experience improvement
- Platform reliability improvement

Use this classification to guide the split. Do not output the classification as a separate child item unless the schema supports metadata.

## Technical Naming Convention

### Technical Feature Title Format

Use one of the following:

- `<team prefix if present> | <epic technical title> | <feature technical outcome>`
- `<epic technical title> | <feature technical outcome>`

Examples:

- `Java 21 Upgrade | Runtime Compatibility Assessment`
- `Java 21 Upgrade | Build and Dependency Modernization`
- `Java 21 Upgrade | Application Runtime Migration`
- `Spring Boot 3 Upgrade | Framework Compatibility Updates`
- `Kubernetes 1.30 Upgrade | Cluster API Deprecation Readiness`

### Technical User Story Title Format

Use one of the following:

- `<team prefix if present> | <feature technical title> | <story technical outcome>`
- `<feature technical title> | <story technical outcome>`

Examples:

- `Java 21 Upgrade | Runtime Compatibility Assessment | Validate Java 21 Compatibility Baseline`
- `Java 21 Upgrade | Build and Dependency Modernization | Update Build Toolchain for Target JDK`
- `Java 21 Upgrade | Application Runtime Migration | Resolve Runtime Breaking Changes`
- `Java 21 Upgrade | Deployment Readiness | Validate Rollback Path`

## Title Guardrails

- Keep titles concise and outcome-focused.
- Use technical outcome language, not task-only wording.
- Avoid generic endings such as `Setup`, `Configuration`, `Implementation`, `Support`, `Changes`, or `Updates` unless the full title describes a clear technical outcome.
- Avoid overly low-level titles such as `Update pom.xml`, `Change Dockerfile`, `Fix Compilation Errors`, or `Run Tests` unless the parent is very small and that is the meaningful delivery unit.
- Do not name Features after tools unless the tool is the primary subject of the parent.
- Do not create separate items for every dependency, library, or configuration file unless each represents a materially different technical outcome.


# Technical Feature Breakdown Rules

You are breaking down an Azure DevOps **Technical Feature** into child **Technical User Stories** only.

Do not create child Features.

## MVP-First Rule For Technical User Story Creation

When creating Technical User Stories from the Feature:

- prioritize the minimum viable technical path needed to achieve the Feature outcome
- prefer the smallest coherent set of stories that can be implemented, tested, validated, and rolled out safely
- defer optional refactoring, broad optimization, future platform enhancements, or nice-to-have tooling unless explicitly stated in the parent Feature
- do not create speculative future phases unless clearly included in the parent Feature
- avoid splitting into purely mechanical tasks unless they carry independent delivery value
- when multiple split strategies exist, choose the split that best represents a safe technical delivery path

## Preferred Technical User Story Split Dimensions

Prefer splitting Technical Features into User Stories using dimensions such as:

- compatibility baseline and impact validation
- build, dependency, or toolchain readiness
- runtime, framework, or library migration slice
- code compatibility remediation
- configuration and environment readiness
- integration compatibility validation
- security or compliance remediation
- automated regression and quality gate readiness
- observability and operational readiness
- deployment, rollout, and rollback readiness
- data/schema compatibility when relevant
- decommissioning or cleanup only when required by the parent Feature

Avoid splitting User Stories by:

- individual files
- individual classes
- individual methods
- frontend vs backend only, unless the parent Feature explicitly requires separate delivery tracks
- developer tasks with no independently valuable outcome
- vague buckets such as `Setup`, `Analysis`, `Implementation`, or `Testing` unless tied to a clear technical outcome
- speculative improvements outside the Feature scope

## Technical User Story Writing Rules

Each Technical User Story must:

- represent a delivery-ready technical slice under the parent Technical Feature
- have a clear engineering, operational, security, compliance, reliability, maintainability, or delivery value
- avoid heavy overlap with sibling Stories
- support incremental delivery
- stay tightly aligned to the parent Feature scope
- reflect an MVP-level technical slice rather than an expanded future-state slice
- include high-level implementation guidance
- include technical recommendations based on authoritative documentation and parent context
- clearly identify dependencies, risks, rollout, rollback, observability, and validation needs where relevant
- avoid being only a low-level task list

## Technical User Story Description Format

Descriptions must be structured with line breaks and sections.

Use this structure where relevant:

### Background

- Technical context from the parent Feature.
- Relevant current-state limitation, risk, version, platform, or operational condition.

### Problem

- Technical problem, risk, incompatibility, vulnerability, operational gap, or delivery constraint being addressed.

### Authoritative Guidance Reviewed

- List the official or trusted documentation categories reviewed.
- Summarize the most relevant guidance.
- Include source names or reference labels where the system supports citations or links.

### Solution

- Technical outcome delivered by this User Story.
- Explain the intended target state at a high level.

### High-Level Implementation Guidelines

- Step 1
- Step 2
- Step 3
- Include only meaningful implementation guidance.
- Avoid turning this into a low-level task checklist.

### Technical Recommendations

- Recommendation 1
- Recommendation 2
- Recommendation 3
- Recommendations must be grounded in the parent Feature and authoritative material.

### Technical Value

- Specific value expected from this User Story.
- Explain why this slice matters on its own.

### Scope

- Included technical scope.
- Include only what is needed for this User Story.

### Out of Scope

Optional only when useful.

May include:

- optional refactoring
- unrelated modernization
- unrelated system upgrades
- post-MVP improvements
- downstream or external platform changes not owned by this Feature
- sibling story scope to prevent overlap

### Dependencies / References

Use when applicable.

May include:

- dependent teams
- external systems
- platform dependencies
- required vendor documentation
- compatibility matrices
- release notes
- security advisories
- cloud-provider requirements
- CI/CD dependencies

### Risks / Considerations

Use when applicable.

May include:

- breaking changes
- deprecated APIs
- unsupported versions
- performance risk
- security risk
- deployment risk
- rollback risk
- data compatibility risk
- environment parity risk

### Testing / Validation

Use when applicable.

May include:

- unit, integration, contract, performance, security, smoke, or regression validation
- CI/CD quality gate expectations
- environment validation expectations
- observability checks after deployment

### Rollout / Rollback

Use when applicable.

May include:

- deployment sequencing
- feature flags or staged rollout only when technically relevant
- rollback path
- backup or restore requirements
- operational monitoring during rollout

### Assumptions

Use only when needed.

- `Assumption: ...`

Omit this section when no assumptions are required.

## Technical User Story Acceptance Criteria

Use Gherkin scenarios or clear validation blocks.

Acceptance criteria must:

- validate the technical outcome
- confirm the parent Feature requirement is satisfied for this story slice
- include compatibility, testing, deployment, rollback, observability, security, or operational validation where relevant
- avoid hidden expansion beyond the parent Feature
- avoid requiring downstream work unless explicitly in scope

Example:

Scenario: Validate target runtime compatibility
Given the application is built with the target runtime and required dependencies
When the CI pipeline executes the agreed validation suite
Then the build completes successfully and compatibility issues are either resolved or explicitly documented with an approved follow-up path
