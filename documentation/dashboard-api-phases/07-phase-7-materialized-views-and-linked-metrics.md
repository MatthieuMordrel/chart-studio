# Phase 7: Materialized Views And Linked Metrics

## Goal

Support flat cross-dataset analytic grains only when explicitly requested.

## Why This Phase Exists

Some charts and KPIs genuinely need a flattened cross-dataset grain.

That should exist, but only as an explicit modeled step, not as automatic
denormalization.

## Scope

- `materialize(...)`
- explicit row grain
- cached materialized views
- linked metrics built on top of real model structure

## Out Of Scope

- automatic denormalization of all datasets
- freeform SQL-like query composition

## Core Rules

- materialization is explicit
- output row grain must be visible
- many-to-many flattening should never be hidden

## Deliverables

- materialized view builder/runtime
- naming rules for output columns and keys
- linked metric primitives built on top of materialized data

## Exit Criteria

- cross-dataset row grain is explicit
- linked metrics are built on a real linked data model

## Risks

- accidental silent row multiplication
- performance cost if reused views are not cached well
