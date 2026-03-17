# Phase 3: Revisit Multi-Source

## Status

Implemented.

## Goal

Keep `useChart({sources: [...]})` as source-switching for one chart, clearly
separate from dashboard composition.

## Locked Contract

- multi-source means one rendered chart with one active source at a time
- each source keeps the same authoring model as single-source:
  raw `data` plus an optional per-source `schema`
- that schema may come from either:
  - `defineChartSchema<Row>()`
  - `defineDataset<Row>().chart(...)`
- linked data models are not consulted at chart runtime here
- no source is joined, overlaid, denormalized, or aggregated together with
  another source inside one chart instance

## Runtime Rules

- `activeSourceId` is the only source selector
- switching sources recalculates columns, metrics, filters, date columns, and
  transformed output from the active source only
- `chart.filters` is always the sanitized effective filter state for the active
  source
- stale filter columns or values are hidden from the effective runtime state
- stale `referenceDateId` falls back to the active source's valid date context,
  or `null` when no date column exists
- requested state is not hard-reset internally just because another source
  cannot use it right now
- when the user switches back to a compatible source, previously requested
  source-local selections can become effective again

## What This Still Does Not Mean

- not dashboard composition
- not shared state across several charts
- not linked metrics
- not relationship traversal through `defineDataModel(...)`
- not cross-dataset execution inside one chart

## Example

```tsx
const jobs = defineDataset<Job>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('owner'),
    c.number('salary'),
  ])

const candidates = defineDataset<Candidate>()
  .columns((c) => [
    c.category('stage'),
    c.boolean('isActive'),
    c.number('expectedSalary'),
  ])

const chart = useChart({
  sources: [
    {
      id: 'jobs',
      label: 'Jobs',
      data: jobsData,
      schema: jobs
        .chart('jobsByOwner')
        .xAxis((x) => x.allowed('owner').default('owner')),
    },
    {
      id: 'candidates',
      label: 'Candidates',
      data: candidatesData,
      schema: candidates
        .chart('candidatesByStage')
        .xAxis((x) => x.allowed('stage').default('stage')),
    },
  ],
})
```

This is still one chart. The source changes, but the chart never composes both
datasets at the same time.
