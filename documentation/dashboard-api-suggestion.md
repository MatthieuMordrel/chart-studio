# Dashboard API Suggestion

This document is an exploration, not a final API decision.

The goal is to capture one coherent direction that fits the current builder work, while leaving room to revisit alternatives later.

## Goal

We want to support all of the following without another major API rewrite:

- define columns once for one dataset
- derive multiple charts from that shared column definition
- keep the single-chart story simple
- support dashboards with multiple charts and multiple datasets
- support shared filters and other coordination between views
- keep layout fully controlled by normal React composition

## Short Answer

The cleanest direction is:

1. one dataset-definition API
2. one chart-definition API
3. one dashboard-composition API

That means:

- charts should not be exposed publicly as "little dashboards"
- chart authoring should stay the same inside and outside dashboards
- dashboards should compose chart definitions rather than invent a second chart authoring surface

So the answer is:

- yes, single charts and dashboards should share the same chart-definition model
- no, they should not be the exact same public abstraction

## Recommended Mental Model

There are three layers with different responsibilities.

### 1. Dataset model

A dataset model owns:

- raw columns
- derived columns
- formatting
- semantic normalization for later reuse

This is the place where we define the shared column contract once.

### 2. Chart definition

A chart definition owns:

- xAxis
- groupBy
- filters
- metric
- chartType
- timeBucket
- connectNulls
- optional chart metadata like title or description

This is one view over one dataset model.

### 3. Dashboard definition

A dashboard definition owns:

- which datasets exist
- which charts exist
- which charts use which datasets
- which filters are shared
- which datasets/charts are linked

A dashboard definition should not own layout.

Layout should stay in normal React code so charts can be rendered anywhere.

## Main Recommendation

Keep one chart authoring API.

Add a dataset layer above shared columns.

Then let dashboards compose charts, rather than redefining charts in a second way.

The important distinction is:

- chart authoring is shared
- dashboard composition is separate

That gives us one chart API, not two chart APIs.

## Implementation Principles

If we pursue this direction, we should do it slowly and in layers.

The main rules should be:

- do not merge dataset modeling, dashboard composition, and cross-dataset querying into one API step
- do not rush into linked metrics before dataset boundaries are explicit
- do not weaken the current single-chart API to make dashboards fit
- do not encode layout into the dashboard model
- do not add parallel chart authoring APIs

The right approach is:

- make the shared foundation first
- validate it in the simple case first
- only then add larger composition layers

## Suggested API Shape

### Dataset-first reusable model

Suggested future API:

```ts
const jobs = defineDataset<Job>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('ownerName', {label: 'Owner'}),
    c.boolean('isOpen'),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('status', {
      label: 'Status',
      accessor: (row) => (row.isOpen ? 'Open' : 'Closed'),
    }),
  ])
```

This is the shared column contract for every chart built from `jobs`.

### Multiple charts from the same dataset

Suggested future API:

```ts
const jobsByMonth = jobs.chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .metric((m) => m.count())
  .chartType((t) => t.allowed('bar', 'line').default('line'))

const jobsByOwner = jobs.chart('jobsByOwner')
  .xAxis((x) => x.allowed('ownerName').default('ownerName'))
  .metric((m) => m.aggregate('salary', 'avg'))
  .chartType((t) => t.allowed('bar').default('bar'))
```

This is the key benefit:

- define columns once
- derive many charts from the same model
- keep each chart focused on presentation choices, not repeated column wiring

## Standalone Single-Chart Usage

The simple case should stay simple.

Recommended direction:

```ts
const chart = useChart({
  data: jobData,
  schema: jobsByMonth,
})
```

This is important.

The best future path is for a dataset-derived chart definition to remain usable anywhere the current chart schema is usable.

That keeps the single-chart API honest:

- no dashboard ceremony for simple charts
- no special runtime just because the chart came from a shared dataset model

## Dashboard Composition

For dashboards, the next layer should compose datasets and charts from one central place.

Suggested future API:

```ts
const candidates = defineDataset<Candidate>()
  .columns((c) => [
    c.date('appliedAt', {label: 'Applied'}),
    c.category('ownerName', {label: 'Owner'}),
    c.category('stage'),
    c.boolean('isActive'),
  ])

const candidatesByStage = candidates.chart('candidatesByStage')
  .xAxis((x) => x.allowed('stage').default('stage'))
  .groupBy((g) => g.allowed('isActive'))
  .metric((m) => m.count())

const hiringDashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .chart('jobsByMonth', {
    dataset: 'jobs',
    definition: jobsByMonth,
  })
  .chart('jobsByOwner', {
    dataset: 'jobs',
    definition: jobsByOwner,
  })
  .chart('candidatesByStage', {
    dataset: 'candidates',
    definition: candidatesByStage,
  })
```

This central place should define:

- which datasets exist
- which charts exist
- which chart uses which dataset

It should not decide where the charts render on the page.

## Layout Freedom

To avoid limiting dashboards, layout should stay outside the dashboard definition.

The dashboard definition should describe the model.
React should describe the placement.

Suggested runtime shape:

```ts
const dashboard = useDashboard({
  definition: hiringDashboard,
  data: {
    jobs: jobData,
    candidates: candidateData,
  },
})
```

Then the dashboard can be rendered anywhere:

```tsx
<DashboardProvider dashboard={dashboard}>
  <Sidebar>
    <HiringFilters />
  </Sidebar>

  <MainGrid>
    <JobsTrendCard />
    <JobsOwnerCard />
  </MainGrid>

  <BottomPanel>
    <CandidatesStageCard />
  </BottomPanel>
</DashboardProvider>
```

And each component can resolve the chart it needs:

```tsx
function JobsTrendCard() {
  const chart = useDashboardChart('jobsByMonth')

  return (
    <Chart chart={chart}>
      <ChartToolbar />
      <ChartCanvas />
    </Chart>
  )
}
```

This is the important flexibility rule:

- central definition for datasets and charts
- free placement in the UI
- no layout lock-in from the dashboard model

## Connected Datasets

Dashboards with multiple datasets should start with explicit links, not implicit joins.

The first useful dashboard coordination feature is shared filters across datasets.

Suggested future shape:

```ts
const hiringDashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .chart('jobsByMonth', {
    dataset: 'jobs',
    definition: jobsByMonth,
  })
  .chart('candidatesByStage', {
    dataset: 'candidates',
    definition: candidatesByStage,
  })
  .sharedFilters((f) => [
    f.select('owner').targets(
      {dataset: 'jobs', dimension: 'owner'},
      {dataset: 'candidates', dimension: 'owner'},
    ),
    f.dateRange('activityDate').targets(
      {dataset: 'jobs', dimension: 'activityDate'},
      {dataset: 'candidates', dimension: 'activityDate'},
    ),
  ])
```

This is a better first step than trying to support general cross-dataset joins immediately.

It keeps the model explicit:

- shared dashboard filters are deliberate
- target columns are declared
- cross-dataset coordination is visible in one place

## Recommended Filter Scope Model

The clean rule is:

- filter capability and filter scope should be different concerns

That means:

- datasets define what can be filtered
- charts define what they expose locally
- dashboards define what is shared globally

This separation matters because some controls are presentation controls, while others are data-scope controls.

### Chart-local controls

These should stay chart-local:

- xAxis
- groupBy
- metric
- chartType
- timeBucket
- sorting

These change how one chart presents data.

They should not become dashboard-global by default.

### Local-or-global controls

These should be modeled as data-scope controls, not chart-only controls:

- categorical filters
- boolean filters
- date range filters
- possibly reference-date semantics when dashboards need one shared date context

These can reasonably exist at two levels:

- local to one chart
- shared across multiple dashboard views

The same filter concept should be reusable in both places.

## Recommended Authoring Direction For Filters

The best long-term model is to define reusable filter semantics at the dataset level.

Suggested future direction:

```ts
const jobs = defineDataset<Job>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.category('status'),
    c.number('salary'),
  ])
  .dimensions((d) => [
    d.select('owner', 'ownerName'),
    d.select('status', 'status'),
    d.date('activityDate', 'createdAt'),
  ])
```

This layer gives one reusable semantic contract:

- `owner`
- `status`
- `activityDate`

Those semantics can then be reused by both charts and dashboards.

### Local chart usage

A chart can expose a subset locally:

```ts
const jobsByMonth = jobs.chart('jobsByMonth')
  .filters((f) => f.allowed('status'))
```

This means:

- the chart knows it can use dataset filter semantics
- only `status` is surfaced locally for this chart

### Shared dashboard usage

A dashboard can promote some of the same semantics to shared filters:

```ts
const dashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .sharedFilters((f) => [
    f.select('owner').targets(
      {dataset: 'jobs', dimension: 'owner'},
      {dataset: 'candidates', dimension: 'owner'},
    ),
    f.dateRange('activityDate').targets(
      {dataset: 'jobs', dimension: 'activityDate'},
      {dataset: 'candidates', dimension: 'activityDate'},
    ),
  ])
```

This means:

- the same semantic filter can be reused globally
- dashboards can coordinate multiple datasets explicitly
- the filter contract does not need to be reinvented per chart

## Runtime Composition Rule

The most predictable runtime order is:

1. raw dataset
2. dashboard-global filters
3. chart-local filters
4. chart presentation state such as xAxis, groupBy, metric, and chartType

That gives a clean mental model:

- global filters choose the dashboard-wide slice of data
- local filters refine one chart further
- chart controls shape the final visualization

## Important Guardrails

To keep this clean, the API should enforce several rules.

### 1. One filter should not be surfaced twice for the same chart

If a dashboard exposes `owner` globally, the same chart should not also render `owner` as a local filter control by default.

Otherwise users get:

- duplicate UI
- unclear precedence
- confusing state ownership

The dashboard layer should be able to suppress local surfacing of dimensions already owned globally.

### 2. Global filters should be explicit

Do not guess global filters from chart configs.

Global/shared filters should be declared in the dashboard layer.

That keeps coordination visible and intentional.

### 3. Local and global state should still be composable

If both local and global filters exist, they should compose by intersection, not by replacement.

That means:

- global owner = Alice
- local status = Open

should yield:

- rows where owner is Alice and status is Open

### 4. Date filters should follow the same model

Date filters should not become a special separate architecture.

They should follow the same scope model:

- local chart date filter
- shared dashboard date filter
- same semantic dimension layer when possible

If both exist, they should also intersect.

## Recommended Implementation Order For Filter Scope

This should be built in stages, not all at once.

### 1. Define dataset-level filter/date semantics

First introduce the shared semantic layer for reusable filters and date dimensions.

This gives dashboards and charts one common contract.

### 2. Add controlled filter inputs to charts

`useChart(...)` should eventually support controlled filter state cleanly for:

- filters
- date range filters
- possibly reference-date state

This is the bridge that allows dashboard state to drive charts without hacks.

### 3. Add dashboard shared filters on top

Once charts can consume controlled filter state, dashboards can coordinate several charts from one shared state container.

### 4. Add visibility/ownership rules

Only after the above exists should we add ergonomic rules for:

- whether a filter is shown locally
- whether it is owned by the dashboard
- whether a local chart can opt out of a global dimension or vice versa

That avoids guessing too early.

## Recommendation

The strongest recommendation is:

- treat filters and date filters as reusable data-scope controls
- keep presentation controls chart-local
- define reusable filter semantics at the dataset level
- let charts expose them locally
- let dashboards promote them globally
- keep global ownership explicit
- make local and global filters compose by intersection

## Why Not Make A Chart Publicly Equal To A Dashboard?

This looks attractive at first, but it weakens the simple case.

If every chart is treated as a dashboard publicly, the single-chart API starts to inherit dashboard concepts that do not belong there:

- chart ids
- widget registries
- shared filter scopes
- dataset registries
- cross-view linking
- layout slots

That will make the small case worse.

The better rule is:

- a chart is a reusable dashboard widget
- a dashboard is a composition of reusable charts

So:

- share the chart-definition API
- do not collapse the whole public model into one dashboard-shaped abstraction

## Phased Evolution Plan

The best path is not one migration.

It should be phased so each layer is made correct before the next layer depends on it.

### Phase 0. Stabilize the current chart-definition surface

Goal:

- make the current fluent chart-definition API the stable authoring contract

What this phase means:

- keep `defineChartSchema<Row>()` as the primary chart-definition API
- keep builder-as-schema input working for `useChart(...)` and `inferColumnsFromData(...)`
- keep single-source as the strongest typed path

Why this matters:

- every later phase depends on the chart-definition API being trustworthy
- if this layer moves too much later, dataset and dashboard work will get noisy fast

Exit criteria:

- single-chart authoring is stable
- docs teach one clear chart-definition path
- multi-source and dashboard work can build on this without rewriting chart authoring

### Phase 1. Add `defineDataset(...)` as the shared foundation

Goal:

- define reusable dataset models once, especially shared columns and derived fields

Suggested shape:

```ts
const jobs = defineDataset<Job>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.number('salary'),
  ])
```

Scope:

- shared columns
- derived columns
- labels
- formats
- dataset-level semantic normalization

Important rule:

- `defineDataset(...)` should not be a dashboard API
- it is the reusable data-model layer

Exit criteria:

- multiple chart definitions can be derived from one dataset model
- shared columns no longer need copy-paste between charts
- the dataset abstraction is clearly separate from raw chart state

### Phase 2. Make chart definitions reusable over datasets

Goal:

- keep one chart-definition surface while allowing charts to be created from datasets

Suggested shape:

```ts
const jobsByMonth = jobs.chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt'))
  .metric((m) => m.count())
```

Important rule:

- `dataset.chart()` should return the same chart-definition surface users already know
- do not create a second chart API just because the chart started from a dataset

Compatibility goal:

- charts derived from datasets should still work in normal single-chart usage

Example:

```ts
const chart = useChart({
  data: jobData,
  schema: jobsByMonth,
})
```

Exit criteria:

- one dataset can define many charts
- the same chart definition works standalone
- chart authoring inside and outside datasets feels the same

### Phase 3. Revisit multi-source charts on top of datasets

Goal:

- make multi-source charts more intentional without turning them into dashboards

Recommended meaning of multi-source:

- one chart
- several interchangeable sources
- one active source at a time
- each source has its own dataset model and chart-compatible schema

This phase should not try to solve:

- shared dashboard filters
- cross-chart coordination
- linked cross-dataset metrics

Those are separate concerns.

Suggested future direction:

```ts
const chart = useChart({
  sources: [
    {id: 'jobs', label: 'Jobs', data: jobData, schema: jobsByMonth},
    {id: 'archivedJobs', label: 'Archived Jobs', data: archivedJobData, schema: archivedJobsByMonth},
  ],
})
```

Key design work in this phase:

- decide the exact multi-source typing promise
- decide whether setters stay broad or get source-local helpers
- document clearly that multi-source is source-switching, not dashboard composition

Exit criteria:

- multi-source is explicitly documented as a separate problem from dashboards
- source switching is correct and predictable
- the API still feels like "one chart, many possible inputs"

### Phase 4. Add dashboard composition

Goal:

- define dashboards from datasets and chart definitions in one central place

Suggested shape:

```ts
const dashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .chart('jobsByMonth', {dataset: 'jobs', definition: jobsByMonth})
  .chart('candidatesByStage', {dataset: 'candidates', definition: candidatesByStage})
```

Important rule:

- dashboard definition owns composition
- React owns placement

This phase should focus on:

- registering datasets
- registering charts
- resolving chart instances by id
- shared dashboard state container

This phase should not focus on:

- layout DSLs
- cross-dataset math
- general query planning

Exit criteria:

- all charts can be defined centrally
- charts can still be rendered anywhere in the UI
- layout remains fully free

### Phase 5. Add shared dashboard filters and coordination

Goal:

- let multiple charts and other dashboard components react to the same dashboard-level state

This is where dashboard behavior becomes more than "a registry of charts".

Scope:

- shared filters
- shared date ranges
- optional shared reference-date concepts
- coordination between charts and non-chart consumers such as KPI cards or tables

Suggested direction:

```ts
const dashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .filters((f) => [
    f.select('owner').targets(
      {dataset: 'jobs', column: 'ownerName'},
      {dataset: 'candidates', column: 'ownerName'},
    ),
  ])
```

Important rule:

- shared filters should target explicit columns or semantic ids
- the links should be declared, not guessed

Exit criteria:

- several charts can respond to one shared filter
- non-chart dashboard components can consume the same filtered state
- dashboard coordination is explicit rather than magical

### Phase 6. Add explicit dataset relationships and linked metrics

Goal:

- support more advanced cross-dataset composition after the rest of the model is stable

This is the phase for things like:

- dataset relationships
- semantic joins
- linked metrics across datasets
- multi-dataset derived KPIs

This should happen last because it is not just a chart API problem.

It is really a data-composition problem.

Suggested direction:

```ts
const dashboard = defineDashboard()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .relationship('jobOwner', {
    from: {dataset: 'jobs', column: 'ownerId'},
    to: {dataset: 'candidates', column: 'ownerId'},
  })
```

Only after relationships are explicit should we even consider APIs like:

- linked metrics
- cross-source KPI formulas
- charts that depend on aligned aggregates from more than one dataset

Important rule:

- do not ship linked metrics as a shortcut before the relationship model is explicit

Exit criteria:

- cross-dataset logic is visible and explicit
- linked metrics are built on a real data relationship model
- advanced composition does not contaminate the simple chart API

## Why This Phasing Matters

If we try to do all of this at once, we will blur together:

- reusable column models
- chart authoring
- source switching
- dashboard composition
- shared filter state
- linked multi-dataset metrics

That would almost certainly produce either:

- one giant API with fuzzy boundaries
- or several overlapping APIs that are hard to explain

The phased approach avoids that.

The compatibility principle should stay:

- one chart-definition surface
- dataset reuse added above it
- multi-source refined around it
- dashboard composition added around both
- linked cross-dataset logic added only after relationships exist

## Possible Shortcut For The Simple Case

If we want to keep the current `defineChartSchema<Row>()` ergonomics, it could remain the chart-first shortcut.

Conceptually:

```ts
defineChartSchema<Row>()
```

could remain equivalent to something like:

```ts
defineDataset<Row>().chart()
```

That would keep the simple story intact while still allowing the dataset-first story for reusable columns.

This is probably the most important ergonomic constraint to preserve.

## Non-Goals For A First Dashboard API

The first dashboard API should not try to solve everything.

Recommended non-goals:

- automatic dataset joins
- freeform SQL-like query composition
- layout DSLs
- cross-dataset overlay series in one chart
- treating every dashboard card as a built-in special component type

The first version only needs a strong composition model.

## Open Questions

These should be revisited later rather than decided now:

1. Should chart definitions carry presentational metadata like `title`, `description`, or `icon`?
2. Should shared dashboard filters target raw column ids directly, or should datasets define higher-level semantic ids?
3. Should dashboard data be passed eagerly as plain arrays, or support lazy loaders per dataset?
4. Should dashboard state be mostly uncontrolled like `useChart()` today, or controlled-first?
5. Should `defineChartSchema<Row>()` stay as a permanent shortcut, or eventually become a thin alias over `defineDataset<Row>().chart()`?

## Recommendation

The strongest current suggestion is:

1. Keep one chart-definition API.
2. Add a dataset layer for reusable columns and derived fields.
3. Revisit multi-source as a separate source-switching concern built on top of datasets.
4. Add a dashboard-composition layer for shared filters and multi-chart coordination.
5. Add cross-dataset relationships only after the earlier layers are stable.
6. Keep layout outside the dashboard definition.
7. Do not publicly model a chart as a dashboard, even if that becomes a useful internal implementation detail later.

This keeps the simple case clean while still opening a credible path to dashboards.
