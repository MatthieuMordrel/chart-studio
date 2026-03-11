# Next Steps

This document captures the remaining work needed to turn the current API into a clean, extensible foundation.

The goal is:

- keep the drop-in `useChart({data})` experience
- keep one progressive explicit `schema` story
- preserve strong type safety when users provide explicit `schema`
- make future features additive rather than forcing another API rewrite

## 1. Harden Declaration-Time `schema` Validation

- The advanced story is now standardized around:
  `const schema = defineChartSchema<Row>()({...})`.
- That gives us one explicit surface for:
  raw-field overrides,
  exclusions,
  derived columns,
  and tool restrictions.
- The remaining gap is declaration-time strictness.
- The current builder preserves literals and downstream narrowing, but it should become stricter at definition time.
- There are now intentional red type tests in:
  `src/core/use-chart.typecheck.ts`.
- Those tests should stay red until declaration-time schema validation is truly fixed.
- The success bar is not “the runtime still works”.
  The success bar is:
  the typecheck goes green because those invalid declarations are finally rejected.
- The important reality:
  this is a TypeScript inference problem, not a chart-runtime problem.
- The API goal is still correct.
  The risk is implementation strategy, not product direction.
- We should explicitly optimize for:
  best-in-class authoring ergonomics,
  strong declaration-time feedback where TypeScript can do it reliably,
  and avoiding type machinery that collapses inference or makes the API unreadable.
- Goals for the schema-validation story:
  preserve literal narrowing,
  reject invalid top-level keys,
  reject invalid nested keys,
  reject invalid raw-field branch shapes,
  reject invalid derived-column branch shapes,
  reject unknown ids inside tool restrictions such as `groupBy.allowed`, `xAxis.allowed`, `filters.allowed`, and `metric.allowed`,
  and keep the authoring experience readable enough for both humans and LLMs.
- The important principle:
  `defineChartSchema(...)` should be the single place where advanced users get confidence that the object they wrote is the object the library understands.
- Another important principle:
  inference must happen before validation.
  If the validation type participates too aggressively in inferring the schema object, TypeScript starts widening literals or collapsing the builder parameter to `never`.
- Concrete red cases that must become green:
  `schema.columns.fefe`,
  `groupBy.allowed: ['fefe']`,
  `xAxis.allowed: ['fefe']`,
  `filters.allowed: ['fefe']`,
  `metric.allowed` entries with `columnId: 'fefe'`,
  unknown top-level schema keys,
  unknown nested schema keys,
  raw keys accepting derived definitions,
  and derived definitions accepting stray properties.
- Recommended implementation strategy:
  do not try to solve every exactness rule through one giant self-referential conditional type.
- Instead, split the work into stages:
  1. preserve the current literal inference behavior of `defineChartSchema<Row>()({...})`,
  2. add exact object checking for `columns` branches,
  3. add exact object checking for top-level and nested control config shapes,
  4. then add id-validation for `allowed`, `hidden`, and `default` based on already-inferred schema ids.
- A practical litmus test for every attempted type change:
  valid schemas should still infer literal ids and narrow downstream setters before we care about new rejection cases.
  If a candidate solution breaks valid inference, it is the wrong direction even if some red tests become green.
- It is acceptable if the final design draws a clear boundary between:
  compile-time prevention for structurally knowable invalid declarations,
  and runtime sanitization for dynamic invalid states.
- It is not acceptable to require:
  unreadable helper types at the call site,
  multiple schema authoring surfaces,
  or an API that only works through unnatural `as const` rituals everywhere.
- If full single-pass declaration-time validation proves too hostile to inference,
  the fallback should still preserve the one-schema story.
  For example:
  the builder may remain inference-first while a second internal validation layer is used only to power tests and exported helper types.
  But we should only take that path if repeated builder-based attempts show the TS cost is not worth it.
- The core decision rule:
  prefer a stable and understandable TypeScript experience over chasing absolute compile-time perfection that makes the API fragile.

## 2. Finish The Derived-Column Contract

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

## 3. Make Single-Source And Multi-Source Stories More Intentional

- Keep single-source as the strongest typed path.
- Decide the exact multi-source promise:
  shared broad API,
  branch narrowing by `activeSourceId`,
  and what should or should not narrow inside each branch.
- Revisit whether multi-source setters should stay broad forever or whether some source-local helper API should exist for safer branch-specific interactions.
- Document the honesty principle clearly so users understand why multi-source cannot feel identical to single-source typing.
- Keep per-source authoring aligned with the single-source mental model:
  one source, one `schema`.

## 4. Unify Headless And UI Behavior

- Audit every UI control to ensure it renders only from the resolved headless state, never from raw columns when a narrower list already exists.
- Keep selectors driven by `availableXAxes`, `availableGroupBys`, `availableMetrics`, and future restricted lists.
- Make sure hidden or restricted options cannot still appear through alternative UI paths.
- Treat the headless layer as the single source of truth for all UI controls.

## 5. Clarify Defaults, Fallbacks, And Sanitization

- Define the exact fallback behavior when an allowed or hidden schema restriction leaves no valid options for the active source.
- Keep the fallback order explicit and shared across tools:
  surviving `default`,
  then first surviving allowed entry,
  then first surviving runtime-valid option.
- Centralize sanitization rules for stale `groupBy`, `metric`, filters, and future restricted controls.
- Make the behavior predictable across source changes, schema changes, and tool restriction changes.
- Document which invalid states are prevented at compile time and which are corrected at runtime.

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

- Add dedicated type tests for declaration-time `schema` validation once the stricter builder story is finalized.
- Use the intentional red cases in `src/core/use-chart.typecheck.ts` as the concrete checklist.
- The task is complete only when those expectations become valid and `bun run typecheck` is green again.
- Add dedicated type tests for single-source restricted setters and derived-column behavior.
- Add runtime tests for sanitization when tool restrictions change or when multi-source switches invalidate current selections.
- Add UI tests confirming restricted metrics and groupings never appear in selectors.
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

1. Preserve the current good inference behavior of `defineChartSchema<Row>()({...})` as a non-negotiable baseline.
2. Tighten `schema.columns` exactness first, because it is the foundation for every later id restriction.
3. Tighten top-level and nested config exactness next, before attempting cross-object id validation.
4. Add id-based declaration-time validation for `allowed`, `hidden`, and `default` only after the builder still proves stable on valid schemas.
5. Finalize the derived-column contract inside `schema.columns`.
6. Revisit multi-source ergonomics only after the single-source `schema` contract is fully solid.
7. Finish the docs/examples/test pass once the stricter schema story is locked.
