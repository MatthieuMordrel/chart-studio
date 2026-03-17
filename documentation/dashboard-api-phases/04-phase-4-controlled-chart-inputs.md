# Phase 4: Controlled Chart Inputs

## Goal

Add controlled chart inputs for data-scope state so dashboards can drive charts
cleanly.

## Why This Phase Exists

Dashboard-global filters cannot be implemented cleanly while `useChart(...)`
fully owns filter and date state internally.

This phase is the bridge between standalone charts and dashboard coordination.

## Scope

- controlled categorical/boolean filters
- controlled date range filters
- controlled reference-date state if needed
- clear merge rules between controlled and uncontrolled modes

## Out Of Scope

- dashboard composition itself
- model-level linked metrics
- materialized view query planning

## Core Rules

- controlled state should only cover data-scope controls
- presentation controls such as `xAxis`, `groupBy`, and `chartType` remain chart-local by default
- local and future global filters must compose by intersection

## Deliverables

- controlled inputs in `useChart(...)`
- docs for standalone controlled and uncontrolled usage
- tests around external filter driving

## Exit Criteria

- dashboard-global state can flow into charts without hacks
- standalone charts still remain easy to use

## Risks

- making the hook too complex for the simple case
- unclear precedence between controlled and uncontrolled state
