# Phase 0: Stabilize Chart Definition

## Goal

Make the current chart-definition surface the stable contract for the simple
case.

## Why This Phase Exists

Every later layer depends on chart definitions staying trustworthy.

If this surface keeps moving while datasets, models, and dashboards are added,
the whole API will become noisy.

## Scope

- keep `defineChartSchema<Row>()` as the chart-first shortcut
- keep `.columns(...)` as the current authoring entry point for the shortcut
- keep chart definitions usable with `useChart({data, schema})`
- preserve current typed restrictions for `xAxis`, `groupBy`, `metric`, `chartType`, and `timeBucket`

## Out Of Scope

- reusable datasets
- linked data models
- dashboards
- shared filters
- materialized views

## Deliverables

- a clearly documented stability contract for `defineChartSchema<Row>()`
- tests that lock the chart-first authoring surface
- docs that explain the shortcut as the simple path, not the long-term reusable path

## Exit Criteria

- single-chart authoring is stable
- docs teach one clear chart-definition story
- future phases can build on chart definitions without rewriting them

## Locked Contract

- `useChart({data})` remains the zero-config single-chart path
- `useChart({data, schema})` is the canonical explicit single-chart path
- `defineChartSchema<Row>()` is the stable chart-first shortcut for that path
- `.columns(...)` is the authoring entry point for raw overrides, exclusions,
  and derived columns
- raw fields not mentioned in `.columns(...)` still infer normally unless they
  are explicitly excluded
- the builder may be passed directly to `useChart(...)`, or finalized with
  `.build()` when a plain schema object is needed
- `xAxis`, `groupBy`, `filters`, `metric`, `chartType`, `timeBucket`, and
  `connectNulls` lock the public control surface for one chart
- repeated top-level section calls replace the previous section instead of
  merging with it
- future phases must add reusable datasets and dashboards on top of this
  shortcut rather than replacing it

## Already Stable

- compile-time column typing for raw field helpers, exclusions, derived columns,
  and downstream control restrictions
- runtime duplicate-column protection and runtime validation that
  `.columns(...)` returns an array of entries
- builder reuse via direct `useChart({data, schema: builder})` calls or
  `.build()`
- single-source setter narrowing for `xAxis`, `groupBy`, `metric`, filters,
  chart type, time bucket, and reference date
- runtime sanitization when invalid selections slip through or become stale

## Inconsistencies To Resolve In Phase 0

- public docs must teach the single-chart path before mentioning multi-source
- `defineChartSchema<Row>()` must be described as the simple chart-first
  shortcut, not as a reusable dataset or dashboard abstraction
- the `.columns(...)` entry-point contract must be explicit in tests and docs,
  not only implied by type signatures

## Deferred

- reusable datasets and dataset-owned `.columns(...)`
- linked data models and relationships
- dashboard composition and shared filter architecture
- multi-source semantics beyond source-switching for one chart
- cross-dataset or multi-source execution inside one rendered chart

## Risks

- over-tuning the shortcut before the reusable dataset path exists
- letting multi-source or dashboard concerns leak into the simple chart API
