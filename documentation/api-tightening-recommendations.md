# API Tightening Recommendations

This document captures the current API direction after reviewing the public
surface, docs, tests, type tests, and playground examples.

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

## Immediate Changes

### 1. Remove `createDashboard(...)`

`createDashboard(...)` is not a thin adapter. It is a separate inference-first
dashboard DSL with its own runtime and definition semantics. It creates three
problems:

- it lets sample data shape the API surface
- it duplicates concepts already owned by `defineDataModel(...)` and
  `defineDashboard(...)`
- it makes the recommended path look optional when it should be canonical

Recommendation:

- remove the full `createDashboard(...)` public path
- remove its exports, tests, docs, and compatibility messaging
- treat model-first dashboards as the only supported dashboard authoring path

### 2. Make explicit dashboard runtime access the only typed hook path

React context cannot preserve the dashboard definition generic through the
current `DashboardProvider` / string-only hook overload design. The result is a
surface that looks symmetric but is only typed in one branch.

Recommendation:

- keep `useDashboard(dashboardDefinition, data)` as the typed entry point
- require the runtime object for `useDashboardChart(...)`,
  `useDashboardDataset(...)`, and `useDashboardSharedFilter(...)`
- keep `DashboardProvider` / `useDashboardContext()` only as broad runtime
  plumbing, not as the typed primary API

### 3. Make dashboard chart typing reflect ownership

Dashboard charts are not plain `useChart(...)` results. Shared dashboard filters
and date ranges remove chart-local control over owned columns.

Recommendation:

- narrow dashboard chart filter/date column ids by dashboard ownership rules
- keep x-axis, grouping, metric, and chart-type controls unchanged
- make the explicit dashboard hook return type match the runtime restrictions
  instead of exposing chart-local control for columns the dashboard owns

This should be exact for dataset-backed charts and model-chart lookup aliases.
Explicit materialized-view aliases remain the main edge where runtime can know
more than types unless view-step metadata becomes part of the public type
surface.

## Near-Term Follow-Ups

### 4. Collapse the chart-first vs dataset-first split

`defineChartSchema(...)` is useful, but it is a dead-end for users who later
need dashboards because dashboard registration only accepts dataset-backed chart
definitions.

Recommendation:

- either make `defineChartSchema(...)` dashboard-upgradable
- or demote it harder and treat `defineDataset(...).chart(...)` as the explicit
  path even for one-off charts

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
- reusable single-dataset charts: move to `defineDataset(...).chart(...)`
- linked data: move to `defineDataModel(...)`
- dashboards: always use `defineDashboard(...)`
- grain changes: use `model.materialize(...)`
- do not use `createDashboard(...)`

## Summary

The API does not need more concepts. It needs fewer overlapping entry points and
more honesty at the dashboard boundary.
