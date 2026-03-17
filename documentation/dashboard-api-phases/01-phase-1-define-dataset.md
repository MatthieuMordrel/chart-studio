# Phase 1: Define Dataset

## Goal

Introduce `defineDataset<Row>()` as the reusable foundation for dataset-owned
columns, optional declared keys, and reusable chart definitions.

## Why This Phase Exists

`.columns(...)` should mean one reusable thing: the shared column contract for a
dataset.

That lets multiple charts reuse one definition without weakening the current
single-chart shortcut.

## Implemented Contract

- `defineDataset<Row>()`
- `.key('id')` or `.key(['jobId', 'skillId'])`
- `.columns(...)` for raw overrides, exclusions, derived fields, labels, and formats
- `dataset.chart(id?)` as the reusable chart-definition entry point
- `dataset.validateData(data)` and `validateDatasetData(dataset, data)` for runtime key validation
- compatibility with `useChart({data, schema})`

## Locked Rules

- `.columns(...)` stays in the API
- dataset `.columns(...)` is now the canonical reusable meaning
- `dataset.chart(...)` reuses the same chart-definition surface as `defineChartSchema(...)`
- dataset-backed charts inherit dataset columns, so `.columns(...)` is not reopened on `dataset.chart(...)`
- `defineChartSchema<Row>()` remains the simple chart-first shortcut over an anonymous one-off dataset
- declared dataset keys hard-fail at runtime when key parts are missing or not unique

## Example

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.date('createdAt', {label: 'Created'}),
    c.number('salary', {format: 'currency'}),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary >= 100_000 ? 'High' : 'Base'),
    }),
  ])

const jobsByMonth = jobs
  .chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .groupBy((g) => g.allowed('salaryBand'))
  .metric((m) => m.count().aggregate('salary', 'sum'))

jobs.validateData(jobRows)

const chart = useChart({
  data: jobRows,
  schema: jobsByMonth,
})
```

## What Stayed Stable

- `useChart({data})` remains the zero-config single-chart path
- `useChart({data, schema})` remains the canonical explicit single-chart path
- `defineChartSchema<Row>()` still works directly for one-off charts
- all existing chart control sections stay chart-local:
  `xAxis`, `groupBy`, `filters`, `metric`, `chartType`, `timeBucket`, `connectNulls`

## Deferred

- relationships between datasets
- dashboards and shared dashboard state
- linked metrics or automatic denormalization
- using datasets directly as a new chart runtime input

## Risks / Unresolved

- dataset keys can be composite for validation, but Phase 2 relationships and associations currently require exactly one declared key column per endpoint
- `dataset.chart(id?)` exists as the reusable authoring entry point, but chart ids are not yet consumed by a dashboard runtime
