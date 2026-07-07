# web-voxi-app Coding Guidelines

Coding, testing, PR, and review standards for the **web-voxi-app** repository — a Vite + React + TypeScript frontend.

## 1. Purpose

These guidelines exist to:
- keep frontend code quality consistent across teams,
- improve readability, maintainability, and reuse,
- reduce unnecessary complexity and re-renders,
- make reviews faster and more accurate,
- support safer releases through strong typing, testing, and disciplined PR practices.

## 2. TypeScript and Naming

- **No `any`.** Use precise types, `unknown` at boundaries, generics where needed. A `@ts-expect-error`/`@ts-ignore` must carry a comment explaining why.
- **Components:** PascalCase (`PlanCard`, `CheckoutSummary`).
- **Hooks:** camelCase, prefixed `use` (`useBasket`, `usePlanEligibility`).
- **Variables/functions:** camelCase, short but meaningful; booleans read as predicates (`isLoading`, `hasError`, `canSubmit`).
- **Constants:** UPPER_SNAKE_CASE for stable technical/business constants; no magic numbers/strings inline.
- **Types/interfaces:** PascalCase; suffix props types with `Props` (`PlanCardProps`).
- **Files:** one component per file, file name matches the component (`PlanCard.tsx`). Co-locate component, styles, and test.

## 3. Components and Structure

- Prefer **function components** with hooks. No class components for new code.
- Keep components **small and single-purpose**. Extract sub-components when JSX or logic grows.
- Lift shared logic into **custom hooks** rather than duplicating effects/state.
- Props: keep the surface small; avoid boolean-prop explosions — prefer a `variant` union.
- Derive state during render where possible; avoid storing values that can be computed.
- Keep side effects in `useEffect`/event handlers only — never during render.

## 4. Hooks and State

- Respect the rules of hooks (no conditional hooks; complete dependency arrays).
- `useEffect` is for **synchronizing with external systems**, not for deriving data. If an effect only computes from props/state, compute inline or with `useMemo`.
- Memoize (`useMemo`/`useCallback`) only when it fixes a measured re-render/identity problem — not by default.
- Keep state as local as possible; lift only when genuinely shared. Use the established app/store pattern for cross-cutting state.
- Clean up subscriptions, timers, and listeners in the effect's cleanup.

## 5. Styling

- Follow the repo's established styling approach; do not introduce a new styling system in a feature PR.
- No hardcoded design values when tokens/theme variables exist.
- Keep components accessible: semantic elements, labels for inputs, keyboard focus, and `aria-*` only where semantics are insufficient.

## 6. Formatting and Readability

- Rely on the repo's ESLint + Prettier config; do not hand-format around them. CI lint must pass.
- One declaration per line; initialize at declaration where practical.
- Use blank lines to separate logical blocks.
- **Comments only for non-obvious "why".** Do not restate what the code says.

## 7. Complexity Reduction

- Prefer smaller functions/components with a single responsibility.
- Reduce deep nesting and branching; early-return over nested `if/else`.
- Avoid duplication — extract shared hooks, utils, and components.
- Avoid premature abstraction; extract on the second real use.

## 8. Error Handling

- Validate and handle failures only at **true boundaries** (user input, API calls); trust internal code.
- Surface user-facing errors gracefully; never swallow errors silently.
- Type and narrow API responses at the boundary; do not assume shape.

## 9. Testing Standards

- Use the repo's test stack (Vitest / React Testing Library). Co-locate tests (`PlanCard.test.tsx`).
- Test **behavior and accessibility**, not implementation details; query by role/label.
- Structure tests with `// Arrange`, `// Act`, `// Assert`.
- Name tests by behavior and expectation.
- Cover positive, negative, and regression-prone paths for changed logic.

## 10. Performance

- Avoid unnecessary re-renders: stable keys, stable identities for memoized children, no new objects/functions in hot props without need.
- Use lists with stable, meaningful `key`s (never array index for dynamic lists).
- Code-split heavy routes/components; lazy-load where it helps first paint.
- Keep bundle size in mind — avoid pulling large deps for small needs.

## 11. Commit Standards

- Small, focused, descriptive commits.
- Message format: `[WorkitemType][WorkitemId][Short descriptive title]`.
- Include a body when the reason for the change is not obvious.

## 12. Pull Request Standards

- PR title: `[WorkitemType][WorkitemId][Descriptive PR title]`.
- PR description: business/technical context, what changed, notable decisions, testing notes.
- **Link the main work item** (User Story or Bug), not just a Task.
- Before merge: review comments resolved, build succeeds, lint + typecheck pass, quality gate passes.

## 13. PR Review Expectations

Reviewers assess:
- component structure and responsibility boundaries,
- TypeScript correctness (no `any`, sound types at boundaries),
- hooks usage (dependencies, effect misuse, cleanup),
- readability and naming,
- accessibility (roles, labels, keyboard),
- re-render/performance impact,
- duplication and reuse,
- test coverage for positive and negative scenarios,
- bundle/dependency impact,
- PR scope aligned with the linked work item.
