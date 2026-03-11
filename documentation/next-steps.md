# Next Steps

This document captures the remaining work needed to turn the current API into a clean, extensible foundation.

The goal is:

- keep the drop-in `useChart({data})` experience
- keep one progressive configuration story
- preserve strong type safety when users provide explicit config
- make future features additive rather than forcing another API rewrite

## 1. Lock The Core API Contract

- Decide whether `columnHints` remains the long-term name, or whether it should evolve into a more explicit schema name once it carries labels, types, restrictions, and later derived columns.
- Write down the official progression model:
  `data only` -> `data + columnHints` -> `data + explicit config + restrictions`
- Define which parts of the API are convenience-first and broad by design, and which parts become authoritative when explicit config is present.
- Make this contract stable before adding more feature-specific options.

## 2. Clean Up Internal Typing Boundaries

- Reduce type escape hatches such as `as unknown as` where they are only compensating for overloaded return shapes.
- Isolate any unavoidable internal casts behind small helper functions so they do not leak across the core implementation.
- Review existing type helpers in `infer-columns` and `use-chart` and document why each remaining cast exists.
- Prefer explicit internal helper types over increasingly large inline conditional types where readability is starting to degrade.

## 3. Separate Runtime Inference From Compile-Time Guarantees

- Make the distinction explicit everywhere:
  runtime inference decides behavior when config is absent,
  explicit config defines the compile-time contract when present.
- Keep role-aware typing derived from explicit `columnHints.type`.
- Keep tool restriction typing derived from explicit `tools.allowed`.
- Audit all public setters and available option lists to ensure they follow the same rule consistently.

## 4. Generalize The `tools` Model

- Decide whether `tools` is the permanent home for all control restrictions and feature toggles.
- Standardize the shape so every tool can eventually support the same concepts where relevant:
  `allowed`, `hidden`, `default`, and possibly `locked`.
- Extend the current approach beyond `groupBy` and `metric` only after the shape is stable.
- Add the next declarative tool targets explicitly:
  `filters`, `timeBucket`, `xAxis`, `chartType`, and shared default selection behavior.
- Investigate how to reject unknown `tools` keys while preserving both autocomplete and literal return-type narrowing.
- Decide whether this should be solved with stricter exact-object typing, a helper such as `defineChartTools(...)`, or a different config typing strategy entirely.
- Define whether filter restrictions mean:
  "which columns may be filtered",
  "which values are available for a given filterable column",
  or both.
- Define how `timeBucket.allowed` should interact with the active X-axis type so date-only controls stay honest.
- Ensure new tool configs compose cleanly with both headless and UI usage.

## 5. Prepare For Derived Columns

- Decide whether derived columns should live inside the same config object rather than reintroducing a second schema API.
- Define the minimal derived-column contract:
  `id`, `type`, `label`, `accessor`, and whether formatting lives there too.
- Clarify how derived columns interact with inferred top-level fields:
  additive only, override existing field, or explicit-only mode.
- Ensure derived columns can participate in typing, metrics, grouping, filters, and tool restrictions without special cases.

## 6. Make Single-Source And Multi-Source Stories More Intentional

- Keep single-source as the strongest typed path.
- Decide the exact multi-source promise:
  broad shared API, branch narrowing by `activeSourceId`, and what should or should not narrow inside each branch.
- Revisit whether multi-source setters should stay broad forever or whether some source-local helper API should exist for safer branch-specific interactions.
- Document the honesty principle clearly so users understand why multi-source cannot feel identical to single-source typing.

## 7. Unify Headless And UI Behavior

- Audit every UI control to ensure it renders only from the resolved headless state, never from raw columns when a narrower list already exists.
- Keep selectors driven by `availableXAxes`, `availableGroupBys`, `availableMetrics`, and future restricted lists.
- Make sure hidden or restricted options cannot still appear through alternative UI paths.
- Treat the headless layer as the single source of truth for all UI controls.

## 8. Clarify Defaults, Fallbacks, And Sanitization

- Define the exact fallback behavior when a configured default or allowed value is not valid for the active source.
- Centralize sanitization rules for stale `groupBy`, `metric`, filters, and future restricted controls.
- Make the behavior predictable across source changes, hint changes, and tool restriction changes.
- Document which invalid states are prevented at compile time and which are corrected at runtime.

## 9. Simplify The Public Type Surface

- Review which advanced helper types should stay public and which should remain internal.
- Keep exports focused on types users can actually reason about:
  resolved ids, tool config types, and final chart instance types.
- Avoid exposing too many intermediate conditional helper types unless they are directly useful to consumers.
- Add small type-level examples in docs so advanced users can understand the intended extension points.

## 10. Strengthen Documentation And Examples

- Add one canonical example for each level of usage:
  zero-config inference,
  explicit typed hints,
  typed tool restrictions,
  multi-source,
  future derived columns.
- Explain the tradeoff model in plain language instead of only through type names.
- Keep examples aligned with the actual recommended API, not historical alternatives.
- Add a short “when to use what” section so new users can choose the right level of configuration quickly.

## 11. Expand Test Coverage Around API Guarantees

- Add dedicated type tests for single-source restricted setters and future derived-column behavior.
- Add runtime tests for sanitization when tool restrictions change or when multi-source switches invalidate current selections.
- Add UI tests confirming restricted metrics and groupings never appear in selectors.
- Keep one or two regression tests specifically for extension-oriented behavior so future features do not silently break the contract.

## 12. Define Extension Rules Before Adding More Features

- Before adding labels, richer sorting, advanced filters, or new chart capabilities, decide where each feature belongs:
  core state,
  schema/config,
  tools config,
  or UI-only.
- Avoid adding isolated top-level booleans or one-off options if they really belong to a more general extension point.
- Prefer feature families over feature-specific knobs whenever the pattern is likely to repeat.
- Re-run an API consistency pass after every major new capability to avoid drift.

## Recommended Order

1. Finalize the long-term config contract and naming.
2. Reduce internal type escape hatches and simplify helper types.
3. Stabilize the `tools` model as the shared restriction system.
4. Design derived columns inside that same progressive config story.
5. Revisit multi-source ergonomics only after the single-source contract is fully solid.
