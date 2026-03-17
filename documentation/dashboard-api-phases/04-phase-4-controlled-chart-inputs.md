# Phase 4: Controlled Chart Inputs

## Status

Implemented.

## Goal

Let outside state drive one chart's data scope without changing the locked
single-chart contract.

## Locked Contract

Controlled data-scope state is additive through `useChart({inputs: ...})`.

```tsx
const chart = useChart({
  data: jobs,
  schema,
  inputs: {
    filters,
    onFiltersChange: setFilters,
    referenceDateId,
    onReferenceDateIdChange: setReferenceDateId,
    dateRange,
    onDateRangeChange: setDateRange,
  },
})
```

Where `dateRange` is:

```ts
{
  preset: DateRangePresetId | null
  customFilter: DateRangeFilter | null
}
```

## Scope

- categorical and boolean filters
- reference-date selection
- date-range selection

## Explicit Non-Goals

- dashboard runtime
- shared dashboard state
- linked metrics
- relationship traversal
- dashboard-local vs chart-local merge policy beyond one chart's own data scope

## Control Rules

- omit an input value to keep that slice uncontrolled
- provide an input value to make that slice controlled
- callbacks fire in both modes
- in controlled mode, chart setters request changes through callbacks instead of
  mutating hook-owned state
- `chart.dataScopeControl` exposes which slices are controlled vs uncontrolled

## Sanitization Rules

- `chart.filters`, `chart.referenceDateId`, `chart.dateRangePreset`, and
  `chart.dateRangeFilter` always expose the sanitized effective runtime state
- stale controlled filters or reference dates are ignored at runtime rather than
  throwing
- the hook does not auto-rewrite external state just because the active source
  cannot currently use it
- switching back to a compatible source can make the previously requested
  controlled or uncontrolled state effective again
- when `dateRange.preset` is non-null, the effective filter is derived from that
  preset and `customFilter` is only stored for custom mode
- `setDateRangeFilter(null)` maps to the same effective selection as
  `'all-time'`

## Separation From Dashboard Work

This phase only makes one chart controllable from the outside.

It does not define:

- how several charts are composed together
- how shared filters are declared
- how model attributes propagate across relationships

Those remain later dashboard phases.
