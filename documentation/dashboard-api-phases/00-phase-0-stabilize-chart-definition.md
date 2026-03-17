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

## Risks

- over-tuning the shortcut before the reusable dataset path exists
- letting multi-source or dashboard concerns leak into the simple chart API
