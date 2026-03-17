# Phase 6: Shared Dashboard Filters

## Status

Implemented.

## Goal

Let several charts and non-chart consumers react to the same dashboard-level
state.

## Why This Phase Exists

This is where dashboards become more than a chart registry.

Shared filters are the first real coordination primitive users will expect.

This phase builds on top of Phase 5 dashboard composition. It does not redefine
chart registration or placement.

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
- reverse faceting or automatic option propagation through every possible path

## Core Rules

- shared filters are explicit
- model attributes are reusable, dashboard filters are compositional
- one filter should not surface twice for the same chart by default
- local and global filters compose by intersection
- cross-dataset ambiguity requires an explicit attribute or explicit target

## Public Contract

Reuse model-level relationship semantics when a shared filter concept matters
outside one dashboard:

```tsx
const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .chart('candidatesByStage', candidatesByStage)
  .sharedFilter('owner')
```

Add one-off dashboard-local shared filters when the concept is specific to this
dashboard:

```tsx
const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .sharedFilter('status', {
    kind: 'select',
    source: {dataset: 'jobs', column: 'status'},
  })
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'jobs', column: 'createdAt'},
      {dataset: 'candidates', column: 'appliedAt'},
    ],
  })
```

Runtime access happens through the dashboard runtime itself or the matching
hooks:

```tsx
const dashboard = useDashboard({definition: hiringDashboard, data})

const owner = dashboard.sharedFilter('owner')
const activityDate = useDashboardSharedFilter(dashboard, 'activityDate')
const jobs = useDashboardDataset(dashboard, 'jobs')
const jobsChart = useDashboardChart(dashboard, 'jobsByMonth')
```

## Runtime Semantics

- shared select filters narrow each targeted dataset before a chart is passed to
  `useChart(...)`
- shared date ranges do the same for explicit date targets
- non-chart consumers read the same globally filtered dataset slices through
  `dashboard.dataset(...)` or `useDashboardDataset(...)`
- chart-local filters still live inside `useChart(...)`
- the effective row set is:

```text
raw dataset
-> dashboard shared filters
-> chart-local filters
-> chart presentation state
```

## Ownership And Suppression

When a dashboard shared filter targets the same chart-local column, the
dashboard owns that filter by default for that chart:

- shared select filters suppress matching local filter columns
- shared date ranges suppress matching local date columns
- callers can still keep a separate chart-local filter on different columns
- the composition rule stays intersection, not replacement

## Deliverables

- shared filter runtime
- filter suppression/ownership rules
- docs for model-level reusable filters vs dashboard-local filters

## Exit Criteria

- several charts can respond to one shared filter
- non-chart consumers can use the same filtered slice

## Important Boundaries

- shared filters remain explicit; nothing is guessed from chart schemas
- dashboard-local select filters are direct column filters
- cross-dataset relationship-driven select filters should reuse
  `defineDataModel().attribute(...)`
- no automatic denormalization or linked metrics yet

## Risks

- duplicate filter UI and unclear ownership
- path ambiguity across linked datasets
