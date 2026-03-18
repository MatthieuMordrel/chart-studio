# API Tightening Recommendations

This document captures the current API direction after reviewing the public
surface, docs, tests, type tests, and playground examples.

## Status

### Completed

- `createDashboard(...)` has been removed from the public API surface
- dashboard chart typing now reflects dashboard-owned filter and date controls
- provider-based dashboard ergonomics were restored through
  definition-anchored hooks such as
  `useDashboardChart(myDashboard, 'chartId')`
- `defineChartSchema(...)` has been removed entirely;
  `defineDataset(...).chart(...)` is now the single explicit path
- all docs, README, playground examples, tests, and type tests updated to
  use `defineDataset(...).chart(...)` as the canonical explicit path
- `ChartSchemaBuilder` type and `createChartSchemaBuilder()` removed from
  internals; `createDatasetChartBuilder()` is the only builder factory
- `defineDataModel().dataset(...)` now requires a declared `.key()` on every
  dataset; keyless datasets are rejected at both compile time and runtime
- the `'id'` fallback in model inference has been removed; datasets without
  a declared key no longer silently participate in relationship or attribute
  inference

### Still Open

- `model.chart(...)` still needs better explanation around compiled lookup ids
  and debugging
- explicit materialized-view aliases are still the main place where runtime can
  know slightly more than the public type surface

### Priority Order

1. improve `model.chart(...)` / `model.materialize(...)` debugging clarity
2. revisit explicit materialized-view alias typing only if it proves costly in
   real usage

## Direction

The library converges on one explicit progression:

1. `useChart({data})` for zero-config single-chart usage
2. `defineDataset(...).chart(...)` for reusable single-dataset chart contracts
3. `defineDataModel(...).infer(...)` for linked-data semantics
4. `model.chart(...)` for lookup-preserving linked charts
5. `model.materialize(...)` only when chart grain changes
6. `defineDashboard(model)` and `useDashboard(...)` for shared dashboard state

There are no parallel or legacy paths that cut across this progression.

## Completed Changes

### 1. Removed `createDashboard(...)`

`createDashboard(...)` is not a thin adapter. It is a separate inference-first
dashboard DSL with its own runtime and definition semantics. It creates three
problems:

- it lets sample data shape the API surface
- it duplicates concepts already owned by `defineDataModel(...)` and
  `defineDashboard(...)`
- it makes the recommended path look optional when it should be canonical

Completed:

- remove the full `createDashboard(...)` public path
- remove its exports, tests, docs, and compatibility messaging
- treat model-first dashboards as the only supported dashboard authoring path

### 2. Made typed dashboard hooks honest

React context cannot preserve the dashboard definition generic through the
current `DashboardProvider` / string-only hook overload design. The result is a
surface that looks symmetric but is only typed in one branch.

Implemented:

- keep `useDashboard(...)` as the typed runtime entry point
- allow typed hook usage in two honest ways:
  - explicit runtime: `useDashboardChart(dashboardRuntime, 'chartId')`
  - matching provider plus definition anchor:
    `useDashboardChart(dashboardDefinition, 'chartId')`
- reject mismatched provider/definition pairs at runtime

Reasoning:

- React context still stores a broad runtime internally
- the hook needs either the explicit runtime or the dashboard definition value
  to recover exact typing
- the old string-only form could not preserve dashboard-specific typing

### 3. Made dashboard chart typing reflect ownership

Dashboard charts are not plain `useChart(...)` results. Shared dashboard filters
and date ranges remove chart-local control over owned columns.

Implemented:

- narrow dashboard chart filter/date column ids by dashboard ownership rules
- keep x-axis, grouping, metric, and chart-type controls unchanged
- make the explicit dashboard hook return type match the runtime restrictions
  instead of exposing chart-local control for columns the dashboard owns

This should be exact for dataset-backed charts and model-chart lookup aliases.
Explicit materialized-view aliases remain the main edge where runtime can know
more than types unless view-step metadata becomes part of the public type
surface.

### 4. Removed `defineChartSchema(...)` entirely

`defineChartSchema(...)` has been removed from the public API surface.
`defineDataset(...).chart(...)` is now the single explicit path for any chart
that needs a declared schema.

What was removed:

- `defineChartSchema()` function and its module (`define-chart-schema.ts`)
- `ChartSchemaBuilder` type from `schema-builder.types.ts`
- `ChartSchemaShortcutBuilder` alias from `dataset-builder.types.ts`
- `createChartSchemaBuilder()` from `schema-builder.ts`
- the `TAllowColumns` conditional in the internal builder; the shared
  `createChartDefinitionBuilder` was simplified into
  `createDatasetChartBuilder` directly
- all public exports from `src/core/index.ts` and `src/index.ts`

What was updated:

- all tests and type tests converted to `defineDataset(...).chart(...)`
- playground examples now define one shared dataset per data source and derive
  multiple chart schemas from it
- README, api-tightening-recommendations, and semantic-model-concepts docs
  updated
- dashboard registration error message simplified (no longer mentions the
  removed function)

This resolves the earlier concern about a parallel entry point that lacks
dataset identity. The type safety between the two paths was always identical
because they shared the same internal builder — the only real difference was
that `defineChartSchema` could not participate in datasets, models, or
dashboards.

### 5. Required explicit keys for model datasets

`defineDataModel().dataset(...)` now requires every dataset to declare a
`.key()`. This was the last place where dataset identity could be implicit.

The problem:

- `resolveRelationshipSourceKeyId()` in `model-inference.ts` silently fell back
  to assuming an `'id'` column existed when no key was declared
- `SafeRelationshipKeyId` in `model-inference.types.ts` had the same fallback
  at the type level
- this meant `infer({ relationships: true })` could create phantom
  relationships based on an unverified assumption, producing silently incorrect
  chart data

What was changed:

- `DataModelBuilder.dataset()` now constrains the dataset parameter to
  `KeyedDatasetDefinition` — a dataset whose `TKey` generic is a concrete
  `DatasetKey<TRow>`, not `undefined`
- passing a dataset without `.key()` produces a compile-time error:
  `Argument of type 'DatasetBuilder<..., undefined>' is not assignable to
  parameter of type 'KeyedDatasetDefinition<...>'`
- the runtime `dataset()` method throws
  `"Dataset must declare a .key() before being added to a data model"` if the
  resolved dataset has no key
- `resolveRelationshipSourceKeyId()` now returns `undefined` (not `'id'`) when
  no single key is declared
- `SafeRelationshipKeyId` now returns `never` (not `'id'`) when no single key
  is declared
- `KeyedDatasetDefinition` is exported from both `src/core/index.ts` and
  `src/index.ts`
- type tests added for both keyless-with-columns and bare keyless datasets

Why this is safe:

- `.relationship()`, `.association()`, and `.attribute()` already required
  `ModelSingleKeyDatasetId` — a keyless dataset could not participate in any of
  these. The only thing it could do in a model was be charted, which
  `defineDataset(...).chart(...)` handles without needing a model.
- all existing tests, type tests, and playground examples already declare
  `.key()` on every dataset added to a model — no code was broken by this
  change.

## Still Open

### 6. Keep `model.chart(...)` and `model.materialize(...)` separate

This boundary is the right tradeoff and should stay:

- `model.chart(...)` for lookup-preserving, one-grain charts
- `model.materialize(...)` for explicit row-grain changes

The design debt is not the boundary itself. The debt is hidden compilation
details leaking through naming and debugging.

Recommendation:

- keep the boundary
- improve docs and metadata around compiled lookup aliases and projected ids

## Recommended Public Story

For new users, the docs should say this plainly:

- single chart: start with `useChart({data})`
- explicit single-dataset charts: move to `defineDataset(...).chart(...)`
- linked data: move to `defineDataModel(...)` (every dataset needs `.key()`)
- dashboards: always use `defineDashboard(...)`
- grain changes: use `model.materialize(...)`

## Concrete Next Pass

The next API pass should focus on:

1. Add clearer debugging language around how authored lookup paths map to
   compiled chart columns and aliases.

## Summary

The API does not need more concepts. It needs fewer overlapping entry points
and clearer public progression. The three implicit paths (`createDashboard`,
`defineChartSchema`, and fallback-to-`id` inference) have all been removed. The
public surface now has one explicit progression from `useChart({data})` through
`defineDataset(...).chart(...)` to `defineDataModel(...)` and
`defineDashboard(...)`, with no shortcuts that bypass dataset identity.
