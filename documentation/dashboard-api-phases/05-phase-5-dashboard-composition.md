# Phase 5: Dashboard Composition

## Goal

Add `defineDashboard(...)` and dashboard runtime composition on top of linked
data models.

## Why This Phase Exists

Once datasets, model relationships, and controlled chart inputs exist, the
dashboard layer can compose charts without redefining chart semantics.

## Scope

- `defineDashboard(model)`
- chart registration by id
- typed chart lookup by id
- shared dashboard state container
- free React layout placement

## Out Of Scope

- shared filters across charts
- linked metrics
- layout DSLs

## Core Rules

- dashboard definition owns composition
- React owns placement
- chart definitions are reused, not re-authored

## Deliverables

- dashboard definition builder
- dashboard runtime
- provider/hooks for chart resolution

## Exit Criteria

- charts can be defined centrally and rendered anywhere
- the dashboard layer does not pollute standalone chart usage

## Risks

- turning dashboards into a layout framework
- duplicating chart-definition APIs inside dashboards
