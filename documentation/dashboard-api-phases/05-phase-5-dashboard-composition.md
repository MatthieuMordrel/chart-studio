# Phase 5: Dashboard Composition

## Status

Implemented.

## Goal

Add `defineDashboard(model)` and a dashboard runtime that resolves reusable
dataset-backed charts by id without changing the locked single-chart contract.

## Why This Phase Exists

Once datasets, model relationships, and controlled chart inputs exist, the
dashboard layer can compose charts without redefining chart semantics.

This phase is only about composition:

- which charts belong to one dashboard
- how those charts are registered and resolved by id
- how React can render them anywhere

It is not yet about shared cross-chart filter state. That belongs to Phase 6.

## Scope

- `defineDashboard(model)`
- chart registration by id
- typed chart lookup/resolution by id
- dashboard runtime via `useDashboard(...)`
- `DashboardProvider` plus chart/dataset resolution hooks
- free React layout placement

## Out Of Scope

- shared filters across charts
- linked metrics
- layout DSLs

## Core Rules

- dashboard definition owns composition
- React owns placement
- chart definitions are reused, not re-authored inside dashboards
- only dataset-backed charts participate in dashboards
- `defineChartSchema<Row>()` remains the standalone chart-first shortcut

## Public Contract

```tsx
const jobsByMonth = jobs
  .chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .metric((m) => m.count())

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)

function HiringScreen() {
  const dashboard = useDashboard({
    definition: hiringDashboard,
    data: {
      jobs: jobsData,
      owners: ownersData,
    },
  })

  const chart = useDashboardChart(dashboard, 'jobsByMonth')

  return <Chart chart={chart} />
}
```

The same runtime can also be provided through React context when charts or
non-chart consumers are rendered deeper in the tree:

```tsx
<DashboardProvider dashboard={dashboard}>
  <Sidebar />
  <MainGrid />
</DashboardProvider>
```

Then descendants can resolve by id with:

- `useDashboardChart('jobsByMonth')`
- `useDashboardDataset('jobs')`

## Deliverables

- dashboard definition builder
- dashboard runtime
- provider/hooks for chart resolution

## Exit Criteria

- charts can be defined centrally and rendered anywhere
- the dashboard layer does not pollute standalone chart usage

## Important Boundaries

- `useChart({data})` and `useChart({data, schema})` remain unchanged
- multi-source `useChart({sources: [...]})` stays source-switching for one chart
- controlled `inputs` stay chart-level data-scope controls only
- dashboards do not introduce a layout framework or layout DSL
- dashboards do not duplicate `.columns(...)`, `.xAxis(...)`, `.metric(...)`, or
  other chart authoring APIs

## Risks

- turning dashboards into a layout framework
- duplicating chart-definition APIs inside dashboards
