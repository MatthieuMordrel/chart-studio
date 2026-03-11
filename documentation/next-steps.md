# Next Steps

This document captures the remaining work needed to turn the current API into a clean, extensible foundation.

The goal is:

- keep the drop-in `useChart({data})` experience
- keep one progressive configuration story
- preserve strong type safety when users provide explicit config
- make future features additive rather than forcing another API rewrite

## 1. Tighten The `config` Semantics

- Keep `config` as the permanent home for authoritative restrictions and defaults.
- Keep `allowed`, `hidden`, and `default` together in the model.
- Recommended selection pipeline:
  start from runtime-valid options,
  apply `allowed` if present,
  subtract `hidden` if present,
  use `default` if it still survives,
  otherwise if `allowed` exists use the first remaining allowed entry,
  otherwise fall back to the first remaining runtime-valid option.
- This means `allowed[0]` becomes the default only when explicit `default` is absent.
- Keep `hidden` because it is still useful for the "everything except these few options" case.
- Allow `allowed` and `hidden` together.
  Their meaning should stay simple:
  `allowed` narrows first,
  `hidden` subtracts second.
- Ensure `default` is ignored at runtime when it does not survive the final filtered set.
- Add compile-time protection where practical for obviously contradictory literals such as a `default` that is also listed in `hidden`.
- Keep the filter story explicit:
  current `filters` config means "which columns may be filtered".
  Decide later whether value-level filter restrictions belong in this same shape or in a deeper nested model.
- Keep `timeBucket` honest with the active X-axis and chart type.
  Config should not imply that a date-only control is available when the runtime state cannot support it.

## 2. Reject Invalid `config` Keys At Compile Time

- Wrong top-level `config` properties should produce a compile-time error, not just weak autocomplete.
- Wrong nested properties inside each config branch should also produce a compile-time error.
- Preserve literal narrowing and autocomplete while adding stricter exact-object behavior.
- Investigate the best long-term approach:
  stricter exact-object typing,
  a helper,
  `satisfies`-friendly patterns,
  or a different config typing strategy entirely.
- Make sure the solution works for both inline `useChart({config: ...})` usage and extracted `const config = ...` usage.

## 3. Prepare For Derived Columns

- Decide whether derived columns should live inside the same config object rather than reintroducing a second schema API.
- Define the minimal derived-column contract:
  `id`, `type`, `label`, `accessor`, and whether formatting lives there too.
- Clarify how derived columns interact with inferred top-level fields:
  additive only, override existing field, or explicit-only mode.
- Ensure derived columns can participate in typing, metrics, grouping, filters, and tool restrictions without special cases.

## 4. Make Single-Source And Multi-Source Stories More Intentional

- Keep single-source as the strongest typed path.
- Decide the exact multi-source promise:
  broad shared API, branch narrowing by `activeSourceId`, and what should or should not narrow inside each branch.
- Revisit whether multi-source setters should stay broad forever or whether some source-local helper API should exist for safer branch-specific interactions.
- Document the honesty principle clearly so users understand why multi-source cannot feel identical to single-source typing.

## 5. Unify Headless And UI Behavior

- Audit every UI control to ensure it renders only from the resolved headless state, never from raw columns when a narrower list already exists.
- Keep selectors driven by `availableXAxes`, `availableGroupBys`, `availableMetrics`, and future restricted lists.
- Make sure hidden or restricted options cannot still appear through alternative UI paths.
- Treat the headless layer as the single source of truth for all UI controls.

## 6. Clarify Defaults, Fallbacks, And Sanitization

- Define the exact fallback behavior when an allowed or hidden config leaves no valid options for the active source.
- Keep the fallback order explicit and shared across tools:
  surviving `default`,
  then first surviving allowed entry,
  then first surviving runtime-valid option.
- Centralize sanitization rules for stale `groupBy`, `metric`, filters, and future restricted controls.
- Make the behavior predictable across source changes, hint changes, and tool restriction changes.
- Document which invalid states are prevented at compile time and which are corrected at runtime.

## 7. Simplify The Public Type Surface

- Review which advanced helper types should stay public and which should remain internal.
- Keep exports focused on types users can actually reason about:
  resolved ids, tool config types, and final chart instance types.
- Avoid exposing too many intermediate conditional helper types unless they are directly useful to consumers.
- Add small type-level examples in docs so advanced users can understand the intended extension points.

## 8. Strengthen Documentation And Examples

- Add one canonical example for each level of usage:
  zero-config inference,
  explicit typed hints,
  typed tool restrictions,
  multi-source,
  future derived columns.
- Explain the tradeoff model in plain language instead of only through type names.
- Keep examples aligned with the actual recommended API, not historical alternatives.
- Add a short “when to use what” section so new users can choose the right level of configuration quickly.

## 9. Expand Test Coverage Around API Guarantees

- Add dedicated type tests for single-source restricted setters and future derived-column behavior.
- Add dedicated type tests for invalid `config` keys and invalid nested config properties.
- Add runtime tests for sanitization when tool restrictions change or when multi-source switches invalidate current selections.
- Add UI tests confirming restricted metrics and groupings never appear in selectors.
- Keep one or two regression tests specifically for extension-oriented behavior so future features do not silently break the contract.

## 10. Define Extension Rules Before Adding More Features

- Before adding labels, richer sorting, advanced filters, or new chart capabilities, decide where each feature belongs:
  core state,
  schema/config,
  chart config,
  or UI-only.
- Avoid adding isolated top-level booleans or one-off options if they really belong to a more general extension point.
- Prefer feature families over feature-specific knobs whenever the pattern is likely to repeat.
- Re-run an API consistency pass after every major new capability to avoid drift.

## Recommended Order

1. Finalize the remaining `config` semantics:
   lock the `allowed` -> `hidden` -> `default` pipeline,
   and make `allowed[0]` the fallback default when explicit `default` is absent.
2. Add strict compile-time rejection for invalid `config` keys while preserving literal narrowing.
3. Design derived columns inside that same progressive config story.
4. Revisit multi-source ergonomics only after the single-source contract is fully solid.
5. Finish the docs/examples/test pass once the remaining config semantics are locked.
