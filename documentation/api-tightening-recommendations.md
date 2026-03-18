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

### Still Open

- model inference still needs stricter key prerequisites
- `model.chart(...)` still needs better explanation around compiled lookup ids
  and debugging
- explicit materialized-view aliases are still the main place where runtime can
  know slightly more than the public type surface

### Priority Order

1. ~~tighten the `defineChartSchema(...)` story and docs~~ — completed:
   `defineChartSchema(...)` was removed entirely;
   `defineDataset(...).chart(...)` is now the single explicit path
2. require explicit keys before relationship/attribute inference
3. improve `model.chart(...)` / `model.materialize(...)` debugging clarity
4. revisit explicit materialized-view alias typing only if it proves costly in
   real usage

## Direction

The library should converge on one explicit progression:

1. `useChart({data})` for zero-config single-chart usage
2. `defineDataset(...).chart(...)` for reusable single-dataset chart contracts
3. `defineDataModel(...).infer(...)` for linked-data semantics
4. `model.chart(...)` for lookup-preserving linked charts
5. `model.materialize(...)` only when chart grain changes
6. `defineDashboard(model)` and `useDashboard(...)` for shared dashboard state

That progression is coherent. The public API should stop advertising parallel or
legacy paths that cut across it.

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

## Near-Term Follow-Ups

### 4. Removed `defineChartSchema(...)` entirely

`defineChartSchema(...)` has been removed from the public API surface.
`defineDataset(...).chart(...)` is now the single explicit path for any chart
that needs a declared schema.

This resolves the earlier concern about `defineChartSchema(...)` being presented
as a co-equal upgrade path. There is no longer a parallel entry point that lacks
dataset identity.

### 5. Tighten model inference prerequisites

`infer(...)` is only trustworthy when dataset identity is explicit.

Recommendation:

- require explicit single-column keys before inferred relationships or
  attributes are enabled
- reject fallback-to-`id` inference for datasets without declared keys

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

- single chart: start with `useChart`
- explicit single-dataset charts: move to `defineDataset(...).chart(...)`
- linked data: move to `defineDataModel(...)`
- dashboards: always use `defineDashboard(...)`
- grain changes: use `model.materialize(...)`
- do not use `createDashboard(...)`

## Concrete Next Pass

The next documentation/API pass should focus on these concrete changes:

1. ~~Rewrite README positioning so `defineChartSchema(...)` is clearly the
   standalone-only option~~ — completed: `defineChartSchema(...)` was removed;
   `defineDataset(...).chart(...)` is the single explicit path.
2. Make `defineDataset(...).chart(...)` the first-class explicit example for
   anything reusable.
3. Tighten `infer(...)` so undeclared keys do not silently participate in
   relationship/attribute inference.
4. Add clearer debugging language around how authored lookup paths map to
   compiled chart columns and aliases.

## Summary

The API does not need more concepts. It needs fewer overlapping entry points,
clearer public progression, and more honesty about where composition actually
starts. `defineChartSchema(...)` has been removed entirely.
`defineDataset(...).chart(...)` is now the single explicit path for any chart
that needs a declared schema, removing the parallel entry point that previously
cut across the progression.
