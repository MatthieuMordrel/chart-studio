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

### Still Open

- `defineChartSchema(...)` still needs a firmer public position and a docs pass
  that stops treating it as a co-equal upgrade path
- model inference still needs stricter key prerequisites
- `model.chart(...)` still needs better explanation around compiled lookup ids
  and debugging
- explicit materialized-view aliases are still the main place where runtime can
  know slightly more than the public type surface

### Priority Order

1. tighten the `defineChartSchema(...)` story and docs
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

### 4. Demote `defineChartSchema(...)` to standalone-only sugar

`defineChartSchema(...)` is useful, but it should not be presented as the main
explicit path once reuse, dashboard composition, or shared semantics matter.
It lacks the dataset identity that dashboards and linked models need.

Recommendation:

- keep `defineChartSchema(...)` as isolated-chart sugar
- stop presenting it as a co-equal peer to `defineDataset(...).chart(...)`
- make `defineDataset(...).chart(...)` the canonical explicit path for any chart
  contract that may be reused, validated, or moved into a dashboard
- do not make `defineChartSchema(...)` secretly dashboard-compatible through
  hidden datasets or implicit promotion
- do not try to recover composition semantics from a chart-first builder that
  has no dataset identity

Why:

- dashboards need a real dataset/model anchor, not just a row schema
- hidden anonymous datasets would make the API feel simpler while actually
  making the mental model less honest
- auto-promotion would still be a poor match for shared filters and linked-data
  semantics because the chart-first schema has no reusable dataset identity
- the current builder is not just a schema anyway; it also constrains chart
  controls, so pretending it is a reusable data contract blurs two different
  concerns

Practical way to tackle it:

1. Change the docs first.
   - `useChart({data})` stays the no-ceremony start
   - `defineChartSchema(...)` becomes the explicit one-off chart option
   - `defineDataset(...).chart(...)` becomes the default recommendation as soon
     as a chart is intended to live beyond one isolated call site
   - all dashboard examples start from dataset/model definitions, never from
     `defineChartSchema(...)`
2. Tighten wording around the boundary.
   - say plainly that `defineChartSchema(...)` is not an upgrade path into
     dashboards
   - keep the existing runtime rejection when someone tries to register a
     standalone chart schema in `defineDashboard(...)`
3. If the naming still causes confusion after the docs cleanup, consider a
   future rename or alias such as `defineStandaloneChart(...)` or
   `defineChart(...)`.
   - this is secondary to the docs fix
   - do not churn the public surface unless confusion remains high after
     demotion
4. Only if upgrade friction remains a real user problem, add an explicit bridge.
   - that bridge should bind a chart definition to a named dataset on purpose
   - it should not invent anonymous datasets or silently promote chart-first
     definitions

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

More explicit wording for `defineChartSchema(...)`:

- `defineChartSchema(...)` is the lightest explicit schema for one isolated
  chart
- it is not the recommended path for reusable chart contracts
- it is not the path into dashboards
- if a chart might later be reused, start with `defineDataset(...).chart(...)`
  instead of `defineChartSchema(...)`

## Concrete Next Pass

The next documentation/API pass should focus on these concrete changes:

1. Rewrite README positioning so `defineChartSchema(...)` is clearly the
   standalone-only option, not the main explicit progression.
2. Make `defineDataset(...).chart(...)` the first-class explicit example for
   anything reusable.
3. Tighten `infer(...)` so undeclared keys do not silently participate in
   relationship/attribute inference.
4. Add clearer debugging language around how authored lookup paths map to
   compiled chart columns and aliases.

## Summary

The API does not need more concepts. It needs fewer overlapping entry points,
clearer public progression, and more honesty about where composition actually
starts. `defineChartSchema(...)` can stay, but only as the small standalone
entry point rather than as a parallel path into the broader system.
