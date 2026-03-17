# Phase 6: Shared Dashboard Filters

## Goal

Let several charts and non-chart consumers react to the same dashboard-level
state.

## Why This Phase Exists

This is where dashboards become more than a chart registry.

Shared filters are the first real coordination primitive users will expect.

## Scope

- dashboard-level `sharedFilter(...)`
- reuse of model `attribute(...)`
- dashboard-local one-off shared filters
- shared date ranges
- non-chart consumers such as KPI cards or tables

## Out Of Scope

- linked metrics
- automatic denormalization
- dashboard layout systems

## Core Rules

- shared filters are explicit
- model attributes are reusable, dashboard filters are compositional
- one filter should not surface twice for the same chart by default
- local and global filters compose by intersection

## Deliverables

- shared filter runtime
- filter suppression/ownership rules
- docs for model-level reusable filters vs dashboard-local filters

## Exit Criteria

- several charts can respond to one shared filter
- non-chart consumers can use the same filtered slice

## Risks

- duplicate filter UI and unclear ownership
- path ambiguity across linked datasets
