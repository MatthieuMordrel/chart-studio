# Phase 3: Revisit Multi-Source

## Goal

Clarify multi-source as source-switching for one chart, separate from dashboard
composition.

## Why This Phase Exists

`useChart({sources: [...]})` already exists, but it should not drift into a
dashboard-shaped abstraction.

## Scope

- document multi-source as “one chart, many interchangeable inputs”
- allow dataset-backed schemas in multi-source usage
- verify source-local typing remains predictable
- define the intended setter behavior when active source changes

## Out Of Scope

- shared filters across charts
- dashboard composition
- linked metrics

## Core Rules

- multi-source is not dashboard composition
- multi-source does not imply cross-dataset analytics
- one active source at a time

## Deliverables

- clearer docs and examples
- type tests around active-source narrowing
- stable rules for stale state reset when source changes

## Exit Criteria

- multi-source is explicitly distinct from dashboards
- source switching remains correct and predictable

## Risks

- accidental overlap with dashboard concerns
- unclear behavior for controlled state across source switches
