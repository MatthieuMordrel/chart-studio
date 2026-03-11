# Next Steps

This document captures the remaining work needed to turn the current API into a clean, extensible foundation.

The goal is:

- keep the drop-in `useChart({data})` experience
- keep one progressive explicit `schema` story
- preserve strong type safety when users provide explicit `schema`
- make future features additive rather than forcing another API rewrite

## 1. Finish The Derived-Column Contract

- Derived columns now live inside `schema.columns`, which is the right long-term shape.
- The remaining work is to lock the exact contract:
  which fields are required,
  how formatting should work,
  whether extra metadata belongs there,
  and which derived-column capabilities should stay out of scope for now.
- Keep the first version intentionally narrow:
  additive-only,
  single-row accessors,
  no raw-field replacement by id,
  no hidden second extension surface.
- Ensure derived columns participate everywhere raw columns can participate when their type allows it:
  typing,
  metrics,
  grouping,
  filters,
  date controls,
  and future restrictions.

## 2. Make Single-Source And Multi-Source Stories More Intentional

- Keep single-source as the strongest typed path.
- Decide the exact multi-source promise:
  shared broad API,
  branch narrowing by `activeSourceId`,
  and what should or should not narrow inside each branch.
- Revisit whether multi-source setters should stay broad forever or whether some source-local helper API should exist for safer branch-specific interactions.
- Document the honesty principle clearly so users understand why multi-source cannot feel identical to single-source typing.
- Keep per-source authoring aligned with the single-source mental model:
  one source, one `schema`.

## 3. Unify Headless And UI Behavior

- Audit every UI control to ensure it renders only from the resolved headless state, never from raw columns when a narrower list already exists.
- Keep selectors driven by `availableXAxes`, `availableGroupBys`, `availableMetrics`, and future restricted lists.
- Make sure hidden or restricted options cannot still appear through alternative UI paths.
- Treat the headless layer as the single source of truth for all UI controls.

## 4. Clarify Defaults, Fallbacks, And Sanitization

- Define the exact fallback behavior when an allowed or hidden schema restriction leaves no valid options for the active source.
- Keep the fallback order explicit and shared across tools:
  surviving `default`,
  then first surviving allowed entry,
  then first surviving runtime-valid option.
- Centralize sanitization rules for stale `groupBy`, `metric`, filters, and future restricted controls.
- Make the behavior predictable across source changes, schema changes, and tool restriction changes.
- Document which invalid states are prevented at compile time and which are corrected at runtime.

## 5. Tighten Authoring Ergonomics Around `schema.columns`

- Declaration-time validation is now in place and `bun run typecheck` is green, but editor completions remain a separate concern from type correctness.
- The current builder now preserves the one-surface `schema.columns` story while improving contextual typing for known raw keys.
- We should still validate the practical authoring experience in Cursor and VS Code:
  whether known raw keys are suggested predictably,
  whether derived ids remain easy to add,
  and whether any future type refactor silently regresses completions.
- Revisit JSDoc surfacing for inline schema authoring:
  whether nested properties like `type`, `label`, `format`, `kind`, and `accessor` can surface reliably,
  what TypeScript/cursor limitations are unavoidable,
  and whether a deeper redesign is warranted to improve the authoring experience.
- If this area is revisited, keep the priority order explicit:
  type safety first,
  ergonomics second,
  and IntelliSense / hover behavior third.
- A full redesign is acceptable if needed, but not if it weakens the current type guarantees or makes the API harder to understand.
- Do not compromise the current inference-first validation design just to chase perfect editor heuristics.

## 6. Simplify The Public Type Surface

- Review which advanced helper types should stay public and which should remain internal.
- Keep exports focused on types users can actually reason about:
  schema types,
  resolved ids,
  tool restriction types,
  and final chart instance types.
- Avoid exposing too many intermediate conditional helper types unless they are directly useful to consumers.
- Add small type-level examples in docs so advanced users can understand the intended extension points.

## 7. Strengthen Documentation And Examples

- Add one canonical example for each level of usage:
  zero-config inference,
  explicit typed schema,
  typed tool restrictions through schema,
  multi-source,
  derived columns.
- Explain the tradeoff model in plain language instead of only through type names.
- Keep examples aligned with the actual recommended API, not historical alternatives.
- Add a short “when to use what” section so new users can choose the right level of configuration quickly.

## 8. Expand Test Coverage Around API Guarantees

- Keep the declaration-time `schema` validation cases in `src/core/use-chart.typecheck.ts` as regression coverage now that they are green.
- Add dedicated type tests for single-source restricted setters and derived-column behavior.
- Add runtime tests for sanitization when tool restrictions change or when multi-source switches invalidate current selections.
- Add UI tests confirming restricted metrics and groupings never appear in selectors.
- Add a small regression test around `schema.columns` authoring ergonomics if a reliable tsserver-facing pattern emerges.
- Keep one or two regression tests specifically for extension-oriented behavior so future features do not silently break the contract.

## 9. Define Extension Rules Before Adding More Features

- Before adding labels, richer sorting, advanced filters, or new chart capabilities, decide where each feature belongs:
  core state,
  schema,
  or UI-only.
- Avoid adding isolated top-level booleans or one-off options if they really belong to a more general schema extension point.
- Prefer feature families over feature-specific knobs whenever the pattern is likely to repeat.
- Re-run an API consistency pass after every major new capability to avoid drift.

## Recommended Order

1. Finalize the derived-column contract inside `schema.columns`.
2. Revisit multi-source ergonomics only after the single-source `schema` contract is fully solid.
3. Unify UI behavior around the resolved headless option lists.
4. Centralize fallback and sanitization rules for restricted controls.
5. Validate editor authoring ergonomics without destabilizing the current builder design.
6. Finish the docs/examples/test pass once the stricter schema story is fully absorbed into the public API guidance.
