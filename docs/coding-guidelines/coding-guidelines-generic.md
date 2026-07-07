# Generic Coding Guidelines

Vendor- and language-neutral coding, testing, commit, and pull-request standards. This is the
**default fallback** loaded by the PR reviewer when no repository-specific
`coding-guidelines-<repoName>.md` file exists. Repositories with their own conventions should add a
repo-specific file; everything below applies otherwise.

These rules describe *intent*, not a single language's syntax. Apply them through the idioms of the
repository's actual stack (naming case, formatter, test framework) rather than imposing foreign
conventions.

## 1. Purpose

- Keep code quality consistent across teams and repositories.
- Improve readability, maintainability, and reuse.
- Reduce unnecessary complexity and review friction.
- Support safe, reversible releases through disciplined testing, commits, and PRs.

## 2. Naming

- Names express **intent**: what a thing is or does, not how it is implemented.
- Use the established case convention of the language/repository consistently; do not mix styles.
- Prefer full, pronounceable words over cryptic abbreviations and acronyms.
- Boolean names read as predicates (`isEnabled`, `hasAccess`, `shouldRetry`).
- Functions/methods are verbs or verb phrases; types are nouns.
- Replace magic numbers and repeated string literals with named constants when they carry meaning.
- Avoid encoding type or scope into names (Hungarian-style prefixes) unless the language idiom requires it.

## 3. Formatting and Readability

- Use the repository's configured formatter/linter. Do not hand-format against it; do not reformat
  unrelated lines in a feature PR (keep diffs minimal and reviewable).
- One statement per line; initialize variables close to first use.
- Use blank lines to separate logical blocks; avoid dense, cramped expressions.
- Keep lines within the repository's configured limit.
- Comments explain **why**, not **what**. Delete commented-out code; rely on version control instead.

## 4. Complexity and Design

- Each function/module has a **single, clear responsibility**. Prefer small, composable units.
- Minimize deep nesting and branching. Use guard clauses, early returns, and polymorphism/strategy
  patterns where they genuinely simplify branch-heavy logic — not for their own sake.
- Eliminate duplication by extracting shared helpers, but avoid premature abstraction that couples
  unrelated callers.
- Favor pure functions and clear data flow; isolate side effects (I/O, network, global state) at the edges.
- Follow established repository patterns before introducing new ones; check for an existing helper,
  error type, or abstraction before adding another.

## 5. Error Handling and Logging

- Handle failure paths explicitly at real boundaries (user input, external APIs, I/O). Do not guard
  against conditions that cannot occur in trusted internal code.
- Do not catch overly broad exceptions or swallow errors silently. Either handle, or propagate with context.
- Fail fast and fail loud in development; degrade safely in production.
- Log with enough context to diagnose (identifiers, operation, outcome) but **never log secrets, tokens,
  credentials, or PII**.
- Use structured, leveled logging (error / warn / info / debug) rather than ad-hoc prints.

## 6. Security

- Never hardcode secrets, tokens, connection strings, or PATs. Use the platform's secret store /
  environment variables.
- Validate and sanitize all external input at the boundary; treat all external data as untrusted.
- Use parameterized queries / prepared statements; never build queries by string concatenation.
- Apply least privilege to tokens, service accounts, and pipeline credentials.
- Keep dependencies current; avoid introducing libraries with known vulnerabilities.

## 7. Testing

- Add or update tests for every behavior change and risky/regression-prone path.
- Cover **positive, negative, and edge** scenarios — not only the happy path.
- Tests are deterministic and isolated: no reliance on wall-clock, ordering, network, or shared mutable state.
- Mirror the source structure in the test tree; name tests to describe behavior and expected outcome.
- Use a clear Arrange / Act / Assert (Given / When / Then) structure; assert meaningful behavior, not incidental detail.
- Treat flaky tests as defects — fix or quarantine with a tracked follow-up, never ignore.

## 8. Feature Flags / Controlled Rollout

- Gate incomplete, phased, or business-controlled behavior behind a feature flag rather than long-lived branches.
- Default new flags to **off**; make enable/disable possible without redeploy where the platform supports it.
- Remove stale flags once a feature is fully rolled out — flags are temporary, not permanent config.

## 9. Commits

- Keep commits small, focused, and individually revertable; split unrelated changes.
- Write imperative, descriptive subjects; explain the **why** in the body when it is non-obvious.
- Link the commit/PR to its tracking work item (Story/Bug), not only a Task, so it is visible from the
  primary item's development links.
- Match the repository's existing commit-message convention (e.g. Conventional Commits or
  `[WorkitemType][WorkitemId][Title]`) when one is established.

## 10. Pull Requests

- Keep PRs scoped to a single logical change aligned with the linked work item; smaller PRs review faster.
- PR description includes: context (business/technical), what changed, notable decisions, and testing notes.
- Before requesting merge: build passes, linters/quality gates are green, tests pass, review comments resolved.
- Do not bundle unrelated refactors, formatting sweeps, or dependency bumps into a feature PR.

## 11. Review Expectations

Reviewers assess each PR against:

- correctness, including negative and edge cases;
- readability, naming, and structure;
- complexity, duplication, and code smells;
- error handling, logging, and security;
- test coverage and test quality;
- performance impact and resource use;
- dependency and compatibility impact;
- cross-cutting impact on other modules, services, or consumers;
- documentation updates where behavior or contracts changed.

Comment on what materially affects correctness, safety, or maintainability. Avoid blocking on pure
style the formatter/linter already enforces.
