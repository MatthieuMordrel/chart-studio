# Phase 1: Define Dataset

## Goal

Introduce `defineDataset(...)` as the reusable foundation for columns, derived
fields, formatting, and optional keys.

## Why This Phase Exists

Columns should be defined once per dataset, not copied across every chart.

This is also where dataset identity starts through optional `key(...)`.

## Scope

- `defineDataset<Row>()`
- `.key(...)` for stable row identity when it exists
- `.columns(...)` for raw fields, derived fields, labels, and formats
- `dataset.chart(...)` as the reusable chart-definition entry point
- compatibility with the chart-first shortcut

## Out Of Scope

- relationships between datasets
- dashboards
- shared filters across datasets
- materialized views

## Core Rules

- `.columns(...)` stays in the API
- dataset `.columns(...)` becomes the canonical reusable meaning
- `defineChartSchema<Row>()` remains the shortcut over an anonymous one-off dataset

## Deliverables

- dataset builder
- dataset-backed chart builder
- docs explaining dataset-first vs chart-first entry points
- key uniqueness validation hooks prepared for runtime phases

## Exit Criteria

- multiple charts can derive from one dataset
- `.columns(...)` has one coherent meaning
- `defineChartSchema<Row>()` still feels simple

## Risks

- making datasets feel mandatory for small use cases
- creating two chart-definition surfaces that drift apart
