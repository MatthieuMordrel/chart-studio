# Next Steps

This document captures the remaining work needed to turn the current API into a clean, extensible foundation.

The goal is:

- keep the drop-in `useChart({data})` experience
- keep one progressive configuration story
- preserve strong type safety when users provide explicit config
- make future features additive rather than forcing another API rewrite

## 1. Strengthen Extracted `columnHints` Typing

- The explicit-config story is now standardized around:
  a named `columnHints` object plus `defineChartConfig<Row, typeof columnHints>({...})`.
- That solves the `config` side, but extracted hints are still weaker than they should be at declaration time.
- Today a standalone hints object like:
  `const columnHints = { ... } as const`
  preserves literals, but it is not necessarily validated strongly enough where it is declared.
- We should make extracted hints self-checking at definition time, not only when later consumed by `useChart(...)`.
- Investigate the best long-term approach:
  a typed helper,
  a `satisfies`-friendly pattern,
  or another declaration-time validation strategy.
- Goals for the hints story:
  keep the currently recommended authoring pattern readable,
  preserve literal narrowing,
  reject invalid hint keys or invalid hint branch shapes at declaration time,
  and avoid forcing users into excessive ceremony.

## 2. Prepare For Derived Columns

- Decide whether derived columns should live inside the same config object rather than reintroducing a second schema API.
- Define the minimal derived-column contract:
  `id`, `type`, `label`, `accessor`, and whether formatting lives there too.
- Clarify how derived columns interact with inferred top-level fields:
  additive only, override existing field, or explicit-only mode.
- Ensure derived columns can participate in typing, metrics, grouping, filters, and tool restrictions without special cases.

## 3. Make Single-Source And Multi-Source Stories More Intentional

- Keep single-source as the strongest typed path.
- Decide the exact multi-source promise:
  broad shared API, branch narrowing by `activeSourceId`, and what should or should not narrow inside each branch.
- Revisit whether multi-source setters should stay broad forever or whether some source-local helper API should exist for safer branch-specific interactions.
- Document the honesty principle clearly so users understand why multi-source cannot feel identical to single-source typing.

## 4. Unify Headless And UI Behavior

- Audit every UI control to ensure it renders only from the resolved headless state, never from raw columns when a narrower list already exists.
- Keep selectors driven by `availableXAxes`, `availableGroupBys`, `availableMetrics`, and future restricted lists.
- Make sure hidden or restricted options cannot still appear through alternative UI paths.
- Treat the headless layer as the single source of truth for all UI controls.

## 5. Clarify Defaults, Fallbacks, And Sanitization

- Define the exact fallback behavior when an allowed or hidden config leaves no valid options for the active source.
- Keep the fallback order explicit and shared across tools:
  surviving `default`,
  then first surviving allowed entry,
  then first surviving runtime-valid option.
- Centralize sanitization rules for stale `groupBy`, `metric`, filters, and future restricted controls.
- Make the behavior predictable across source changes, hint changes, and tool restriction changes.
- Document which invalid states are prevented at compile time and which are corrected at runtime.

## 6. Simplify The Public Type Surface

- Review which advanced helper types should stay public and which should remain internal.
- Keep exports focused on types users can actually reason about:
  resolved ids, tool config types, and final chart instance types.
- Avoid exposing too many intermediate conditional helper types unless they are directly useful to consumers.
- Add small type-level examples in docs so advanced users can understand the intended extension points.

## 7. Strengthen Documentation And Examples

- Add one canonical example for each level of usage:
  zero-config inference,
  explicit typed hints,
  typed tool restrictions,
  multi-source,
  future derived columns.
- Explain the tradeoff model in plain language instead of only through type names.
- Keep examples aligned with the actual recommended API, not historical alternatives.
- Add a short “when to use what” section so new users can choose the right level of configuration quickly.

## 8. Expand Test Coverage Around API Guarantees

- Add dedicated type tests for declaration-time `columnHints` validation once that story is finalized.
- Add dedicated type tests for single-source restricted setters and future derived-column behavior.
- Add runtime tests for sanitization when tool restrictions change or when multi-source switches invalidate current selections.
- Add UI tests confirming restricted metrics and groupings never appear in selectors.
- Keep one or two regression tests specifically for extension-oriented behavior so future features do not silently break the contract.

## 9. Define Extension Rules Before Adding More Features

- Before adding labels, richer sorting, advanced filters, or new chart capabilities, decide where each feature belongs:
  core state,
  schema/config,
  chart config,
  or UI-only.
- Avoid adding isolated top-level booleans or one-off options if they really belong to a more general extension point.
- Prefer feature families over feature-specific knobs whenever the pattern is likely to repeat.
- Re-run an API consistency pass after every major new capability to avoid drift.

## Recommended Order

1. Finalize the declaration-time typing story for extracted `columnHints`.
2. Design derived columns inside that same progressive config story.
3. Revisit multi-source ergonomics only after the single-source contract is fully solid.
4. Finish the docs/examples/test pass once the hints story is locked.
