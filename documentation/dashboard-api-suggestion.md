# Dashboard API Suggestion

This document is an exploration, not a final API decision.

The goal is to define a direction that can support dashboards and linked datasets
without weakening the current single-chart story.

## Goals

We want to support all of the following without another major API rewrite:

- keep the single-chart story simple
- define reusable columns and derived fields once per dataset
- derive multiple charts from one dataset definition
- support dashboards with multiple charts and multiple datasets
- support shared filters and other dashboard coordination
- preserve strong type safety across datasets, charts, and relationships
- avoid hiding expensive or ambiguous cross-dataset behavior behind "magic"
- keep layout fully controlled by normal React composition

## Updated Recommendation

We should optimize for low cognitive load, but not by collapsing everything into
one giant universal API.

The cleanest direction is:

1. one dataset-model API
2. one linked data-model API
3. one chart-definition surface
4. one dashboard-composition API

That means:

- charts and dashboards should share the same chart-definition surface
- a chart should not be publicly modeled as a dashboard
- datasets may declare keys, and relationships should point from a declared key to a foreign-key column
- relationships should be defined before dashboards or linked metrics consume them
- charts should still execute against one flat row shape at a time
- cross-dataset behavior should be explicit through relationships or materialized views

So the answer is:

- yes, we should reduce cognitive load by keeping one chart-definition surface
- no, we should not force single charts, linked data models, and dashboards into one public abstraction

## Recommended Mental Model

There are four layers with different responsibilities.

### 1. Dataset model

A dataset model owns:

- declared row identity via `key(...)` when the dataset has one
- raw columns
- derived columns
- labels and formatting
- the local contract for charts that use this dataset

This is where shared column definitions belong.

### 2. Linked data model

A linked data model owns:

- which datasets are registered together
- named relationships between datasets
- one-to-many path identity from a declared key to a foreign-key column
- optional association definitions for many-to-many edges
- optional reusable shared-filter attributes built on top of those relationships
- optional materialized views when a flat cross-dataset grain is needed

This is the layer that makes cross-dataset work explicit and type safe.

### 3. Chart definition

A chart definition owns:

- which dataset it reads from
- xAxis
- groupBy
- filters exposed locally
- metric
- chartType
- timeBucket
- connectNulls
- optional chart metadata like title or description

A chart definition is one view over one dataset or one explicit materialized view.

### 4. Dashboard definition

A dashboard definition owns:

- which chart definitions are used together
- which filters are shared globally
- which dashboard-level state exists
- which charts and non-chart consumers react to that state

A dashboard definition should not own layout.

Layout should stay in normal React code so charts can render anywhere.

## Single Chart vs Dashboard

The single-chart and dashboard stories should share chart authoring, but differ in
runtime scope.

### Standalone chart

In the simple case, a chart should still work directly from data plus a chart definition:

```ts
const chart = useChart({
  data: jobData,
  schema: jobsByMonth,
})
```

This stays the strongest low-cognitive-load path.

### Dashboard chart

In a dashboard, the same chart definition should be resolved from a linked data
model plus dashboard state:

```ts
const dashboard = useDashboard({
  definition: hiringDashboard,
  data: {
    jobs: jobData,
    candidates: candidateData,
  },
})
```

Then UI code can place charts anywhere:

```tsx
<DashboardProvider dashboard={dashboard}>
  <Sidebar>
    <HiringFilters />
  </Sidebar>

  <MainGrid>
    <JobsTrendCard />
    <CandidatesStageCard />
  </MainGrid>
</DashboardProvider>
```

The rule should be:

- same chart definition surface
- different runtime scope
- no dashboard ceremony for a standalone chart
- no chart API polluted with layout or registry concepts

## What Happens To `.columns`?

This needs to be explicit, because it will shape the long-term API.

## Recommendation

`.columns` should remain, but its meaning should become dataset-owned.

That means:

- `defineDataset<Row>().columns(...)` is the canonical reusable path
- `defineChartSchema<Row>()` should remain as the single-chart shortcut
- the shortcut should reuse the same underlying builder concepts, not invent a second meaning for `.columns`

So we should not remove `.columns`.

We should also not keep two unrelated `.columns` concepts alive forever.

The clean model is:

- dataset `.columns(...)` defines the reusable dataset contract
- chart definitions consume that contract
- `defineChartSchema<Row>()` is a thin chart-first shortcut over an anonymous one-off dataset

Conceptually:

```ts
defineChartSchema<Row>()
```

is equivalent to something like:

```ts
defineDataset<Row>().chart()
```

with the ergonomic difference that the chart-first shortcut still lets users write:

```ts
defineChartSchema<Row>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.number('salary'),
  ])
  .xAxis((x) => x.allowed('createdAt'))
```

The important constraint is:

- chart authoring should feel the same
- the single-chart shortcut should stay simple
- reusable dataset authoring should not require copy-pasting columns into every chart

## Recommended Authoring Shape

### Reusable dataset path

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.date('createdAt', {label: 'Created'}),
    c.category('ownerName', {label: 'Owner'}),
    c.category('status'),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => row.salary != null && row.salary > 100_000 ? 'High' : 'Base',
    }),
  ])
```

### Reusable charts from that dataset

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

### Single-chart shortcut

```ts
const quickChart = defineChartSchema<Job>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.number('salary'),
  ])
  .xAxis((x) => x.allowed('createdAt'))
  .metric((m) => m.count())
```

This is the key compatibility rule:

- one chart-definition surface
- two entry points
- one reusable, one shortcut

## Linked Datasets And Type Safety

This is the main place where the current proposal needs to be sharper.

Relationships are not chart facts.

They are also usually not dashboard-local facts.

If `owners.id` links to `jobs.ownerId`, that is part of the linked data model
and should be defined before dashboards or linked metrics consume it.

## Recommendation

Define datasets first.

Then define a linked data model that registers datasets and relationships.

Then optionally define reusable shared-filter attributes on that linked data model.

Then let dashboards and cross-dataset features build on that linked data model.

That gives us better type safety than pushing relationships down into isolated
datasets or defining them ad hoc inside individual charts.

## Keys And Relationship Shape

The cleanest public relationship model is:

- datasets may declare `key(...)`
- relationships are declared once from the one side to the many side
- that means from a declared key to a foreign-key column
- reverse traversal is still available at runtime from the same relationship

So we should not expose separate public relationship kinds like:

- `one-to-many`
- `many-to-one`
- `many-to-many`

Instead, the public primitive should be one thing:

- key to foreign-key

That keeps the model simpler while still allowing reverse traversal when
filters, materialization, or path resolution need it.

## Associations For Many-to-Many

Direct public many-to-many relationships should still be avoided.

But many-to-many business domains are real, so the model needs a clear place to
represent the edge data when it exists.

The cleanest addition is:

- keep `relationship(...)` for key-to-foreign-key paths
- add `association(...)` for many-to-many edge data

An association is not necessarily a chartable dataset.

It is a relationship-only structure that tells the model how two keyed datasets
connect through edge pairs.

This matters because users may have edge data in different shapes:

- an explicit bridge table
- embedded arrays on one side such as `skillIds: string[]`
- or no edge data at all

The first two can be modeled.

The last one cannot be inferred safely.

For a fuller breakdown of those input shapes, see
[relationship-input-scenarios.md](/home/matth/projects/maintained/chart-studio/documentation/relationship-input-scenarios.md).

### Suggested future shape

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.date('createdAt'),
    c.number('salary'),
    c.field('ownerId'),
  ])

const candidates = defineDataset<Candidate>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.date('appliedAt'),
    c.category('stage'),
    c.field('ownerId'),
  ])

const owners = defineDataset<Owner>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
  ])

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('candidates', candidates)
  .dataset('owners', owners)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .relationship('candidateOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'candidates', column: 'ownerId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
      {dataset: 'candidates', column: 'ownerId', via: 'candidateOwner'},
    ],
  })
```

This should give us compile-time guarantees for:

- dataset ids
- declared dataset key ids
- chart-to-dataset membership
- relationship endpoint dataset ids
- relationship endpoint key ids
- relationship endpoint foreign-key column ids
- model attribute ids
- shared filter target dataset ids

The intended split is:

- shared filter semantics usually target user-facing attributes such as `owner`
- relationships usually target stable key columns such as `ownerId`

## Important Type-Safety Rules

### 1. Charts should stay single-source at execution time

A chart definition should resolve against one dataset or one explicit materialized view.

Do not let arbitrary charts silently span multiple datasets at runtime.

That keeps chart typing tractable and keeps row-grain semantics visible.

### 1b. Declared keys should be validated against runtime data

If a dataset declares `key(...)`, the runtime should validate that key when data
is loaded.

That means:

- no duplicate key values
- no duplicate composite key tuples
- no missing key parts when the dataset declares a composite key

If validation fails, the runtime should throw with a precise error naming:

- the dataset
- the declared key
- a sample duplicate value or tuple

This should be a hard failure because relationships, filter propagation, and
materialization all depend on key uniqueness being true.

### 2. Cross-dataset features must name their path

If a dashboard filter, linked metric, or materialized view depends on a
relationship path, that path should be explicit.

Do not guess between multiple valid relationships.

### 3. Multiple possible links must force disambiguation

If several keys or several relationship paths could match, the API should stop
and require explicit configuration.

Examples:

- `ownerId` and `recruiterId` both exist across two datasets
- the same dataset pair can be reached through more than one path
- several columns happen to share values but mean different things

In those cases, no automatic default should be chosen.

## Dashboard Definition

Once datasets and relationships are defined in a linked data model, the dashboard
layer should compose charts from that model.

Because chart definitions are already created from datasets, the dashboard should
not have to repeat the dataset id for every chart.

### Suggested future shape

```ts
const jobsByMonth = jobs.chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .metric((m) => m.count())

const candidatesByStage = candidates.chart('candidatesByStage')
  .xAxis((x) => x.allowed('stage').default('stage'))
  .metric((m) => m.count())

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .chart('candidatesByStage', candidatesByStage)
  .sharedFilter('owner')
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'jobs', column: 'createdAt'},
      {dataset: 'candidates', column: 'appliedAt'},
    ],
  })
```

This keeps the responsibility split clean:

- datasets own columns
- linked data models own relationships
- linked data models may also own reusable shared-filter attributes
- chart definitions own chart behavior
- dashboards own composition and shared state

This is the intended rule:

- use `model.attribute(...)` when a filter concept is reused across dashboards or depends on relationships for its value domain
- use `dashboard.sharedFilter(...)` directly when the concept is dashboard-specific

## Complex Scenario Examples

Two scenarios are especially useful for testing whether the API stays clear under
real BI-style complexity.

### Scenario 1. Same lookup table, multiple relationship roles

Suppose `orders` links to `customers` twice:

- `billingCustomerId`
- `shippingCustomerId`

We want both filters available in one dashboard without ambiguity.

```ts
const orders = defineDataset<Order>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.date('createdAt'),
    c.field('billingCustomerId'),
    c.field('shippingCustomerId'),
    c.number('totalAmount', {format: 'currency'}),
  ])

const customers = defineDataset<Customer>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
    c.category('segment'),
  ])

const commerceModel = defineDataModel()
  .dataset('orders', orders)
  .dataset('customers', customers)
  .relationship('billingCustomer', {
    from: {dataset: 'customers', key: 'id'},
    to: {dataset: 'orders', column: 'billingCustomerId'},
  })
  .relationship('shippingCustomer', {
    from: {dataset: 'customers', key: 'id'},
    to: {dataset: 'orders', column: 'shippingCustomerId'},
  })
  .attribute('billingCustomer', {
    kind: 'select',
    source: {dataset: 'customers', key: 'id', label: 'name'},
    targets: [
      {dataset: 'orders', column: 'billingCustomerId', via: 'billingCustomer'},
    ],
  })
  .attribute('shippingCustomer', {
    kind: 'select',
    source: {dataset: 'customers', key: 'id', label: 'name'},
    targets: [
      {dataset: 'orders', column: 'shippingCustomerId', via: 'shippingCustomer'},
    ],
  })

const revenueByMonth = orders.chart('revenueByMonth')
  .xAxis((x) => x.allowed('createdAt'))
  .metric((m) => m.aggregate('totalAmount', 'sum'))

const commerceDashboard = defineDashboard(commerceModel)
  .chart('revenueByMonth', revenueByMonth)
  .sharedFilter('billingCustomer')
  .sharedFilter('shippingCustomer')
```

Why this shape works:

- the two paths are explicitly named
- there is no need to guess which customer role a filter should use
- the reusable filter semantics live where the relationships are defined

### Scenario 2. Many-to-many through explicit association data

Suppose `jobs` connects to `skills` through `jobSkills`.

We want:

- a dashboard filter for skill that narrows jobs safely
- a chart that actually groups jobs by skill

Those are not the same operation.

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.date('createdAt'),
    c.number('salary'),
  ])

const skills = defineDataset<Skill>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
  ])

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('skills', skills)
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillsData,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
  .attribute('skill', {
    kind: 'select',
    source: {dataset: 'skills', key: 'id', label: 'name'},
    targets: [
      {
        dataset: 'jobs',
        through: 'jobSkills',
        mode: 'exists',
      },
    ],
  })

const jobsByMonth = jobs.chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt'))
  .metric((m) => m.count())

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .sharedFilter('skill')

const jobsWithSkills = hiringModel.materialize('jobsWithSkills', (m) =>
  m
    .from('jobs')
    .throughAssociation('jobSkills')
    .grain('job-skill')
)

const jobsBySkill = jobsWithSkills.chart('jobsBySkill')
  .xAxis((x) => x.allowed('name'))
  .metric((m) => m.count())
```

Why this shape works:

- the shared filter uses `mode: 'exists'`, so jobs are filtered by related skills without flattening the dataset
- the association is explicit without forcing the bridge to be a first-class chartable dataset
- the chart that truly needs job-skill grain uses an explicit materialized view
- many-to-many behavior stays visible instead of being hidden behind automatic denormalization

## Filter Scope Model

The clean rule is:

- filter capability and filter scope are different concerns

That means:

- datasets define columns
- linked data models may define reusable shared-filter attributes
- charts define which local columns they expose
- dashboards define which shared filters exist, either by reusing a model attribute or declaring one locally

### Chart-local controls

These should stay chart-local:

- xAxis
- groupBy
- metric
- chartType
- timeBucket
- sorting

These change how one chart presents data.

### Local-or-global data-scope controls

These should be reusable at both chart and dashboard scope:

- categorical filters
- boolean filters
- date range filters
- reference-date semantics when dashboards need one shared date context

### Runtime composition order

The most predictable runtime order is:

1. raw dataset
2. dashboard-global filters
3. chart-local filters
4. chart presentation state such as xAxis, groupBy, metric, and chartType

That gives a clear mental model:

- global filters choose the dashboard-wide slice of data
- local filters refine one chart further
- chart controls shape the final visualization

### Guardrails

The API should enforce:

- one filter should not surface twice for the same chart by default
- global filters should be explicit, not guessed from chart configs
- local and global filters should compose by intersection
- date filters should follow the same scope model as other data-scope filters

For cross-dataset filters, the API should also enforce:

- relationship paths must be explicit when more than one valid path exists
- association traversal should distinguish `exists` filtering from explicit materialization

## Runtime Loading And In-Memory Model

For the first dashboard runtime, we should stay simple and explicit.

## Recommendation

The first linked-dashboard runtime should assume:

- linked data-model metadata is in memory
- raw dataset arrays are passed eagerly and are in memory
- relationship indexes can be built lazily and cached
- charts read from in-memory data, not from hidden background fetches

This is the cleanest first step because it matches the current `useChart(...)`
mental model and avoids mixing API design with distributed query planning.

Later, we can add loader abstractions if real usage demands them.

What we should not do in the first version:

- require eager denormalized copies of every dataset
- hide cross-dataset fetch behavior behind chart definitions
- guess relationship traversal at render time

## Denormalization And Materialization

This needs to be defined concretely, because "denormalize everything" sounds
attractive until one-to-many data starts duplicating rows and corrupting metrics.

## Why denormalization exists at all

It is useful when the runtime must evaluate one chart or one derived metric
against a single flat row grain that spans several datasets.

Typical cases:

- a chart groups `jobs` by a field that only exists on `candidates`
- a KPI formula needs one aligned flat grain across several datasets
- a table or chart wants a single sort/filter/grouping surface over fields that currently live in different datasets

In those cases, some form of explicit materialization is useful.

## When denormalization is not needed

It is not needed when:

- each chart reads one dataset
- dashboards only coordinate shared filters across related datasets
- KPI cards can read each dataset separately and only share dashboard state

Example:

- `jobsByMonth` reads `jobs`
- `candidatesByStage` reads `candidates`
- a shared `owner` filter propagates through the linked data model

That does not require a denormalized dataset.

## Why we should not denormalize automatically by default

Automatic denormalization is risky because:

- one-to-many and many-to-many joins duplicate rows
- duplicated rows can silently double count aggregates
- ambiguous relationship paths can make the "obvious" join wrong
- memory usage can grow quickly
- null and unmatched-row behavior becomes hidden
- users lose visibility into the chart grain they are actually analyzing

So the default should stay normalized.

## Recommendation

We should not automatically denormalize all datasets.

Instead:

- keep relationships normalized by default
- model many-to-many through explicit associations, not implicit direct many-to-many links
- propagate filters through explicit relationships
- add explicit materialized views when a flat analytic grain is truly needed
- cache those materialized views when several charts reuse them

### Suggested future shape

```ts
const jobsWithCandidates = hiringModel.materialize('jobsWithCandidates', (m) =>
  m
    .from('jobs')
    .join('candidates', {relationship: 'jobCandidate'})
    .grain('job-candidate')
)

const jobsByCandidateStage = jobsWithCandidates.chart('jobsByCandidateStage')
  .xAxis((x) => x.allowed('candidateStage'))
  .metric((m) => m.count())
```

The important rule is:

- materialization should be explicit
- row grain should be visible
- denormalized views should be opt-in, not automatic side effects of relationships

## Automatic Link Suggestions

We can help users discover obvious links, but we should be careful not to turn
that into implicit runtime behavior.

## Recommendation

Automatic link discovery should be:

- off by default
- opt-in
- suggestion-based, not silently applied
- rejected when several plausible links or paths exist

Reasonable suggestion heuristics could include:

- same declared attribute id
- same column id
- same declared alias
- compatible value type

But the user should still confirm:

- which datasets are linked
- which endpoints are linked
- what the relationship name is
- which side is the declared key

### Multiple links and ambiguous paths

If several keys have the same values, or if several paths connect the same
datasets, the API must require explicit disambiguation.

That means:

- no automatic default path
- no automatic merge of several candidate links
- no silent "best guess" relationship

At most, the system may surface suggestions for user confirmation.

## Why Not Make A Chart Publicly Equal To A Dashboard?

This still looks attractive at first, but it weakens the simple case.

If every chart is treated as a dashboard publicly, the single-chart API starts
to inherit concepts that do not belong there:

- chart ids
- widget registries
- dataset registries
- relationship graphs
- shared filter ownership
- layout slots

That will make the small case worse.

The better rule is:

- a chart is a reusable dashboard widget
- a dashboard is a composition of reusable charts

So:

- share the chart-definition surface
- do not collapse the whole public model into one dashboard-shaped abstraction

## Revised Phased Evolution Plan

The best path is phased, not one migration.

### Phase 0. Stabilize the current chart-definition surface

Goal:

- keep `defineChartSchema<Row>()` as the trustworthy chart authoring contract for the simple case

Exit criteria:

- single-chart authoring is stable
- docs teach one clear chart-definition surface
- later work does not need to rewrite existing chart configs

### Phase 1. Add `defineDataset(...)` as the reusable foundation

Goal:

- define reusable columns, derived fields, labels, formats, and optional keys once per dataset

Important rule:

- keep `defineChartSchema<Row>()` as the shortcut
- do not remove `.columns(...)`

Exit criteria:

- multiple chart definitions can derive from one dataset
- `.columns(...)` has one coherent meaning

### Phase 2. Add `defineDataModel(...)` for linked datasets

Goal:

- register datasets together, define named key-to-foreign-key relationships explicitly, support many-to-many associations, and optionally define reusable shared-filter attributes

Scope:

- dataset ids
- relationship endpoints
- declared keys
- foreign-key endpoints
- association endpoints and edge sources
- relationship path identity
- optional model-level shared-filter attributes

Exit criteria:

- linked data is explicit and type safe
- dashboards and linked metrics have a real graph to build on

### Phase 3. Revisit multi-source charts on top of datasets

Goal:

- keep multi-source clearly defined as source-switching for one chart

Important rule:

- multi-source is not dashboard composition
- multi-source does not imply linked metrics

Exit criteria:

- source switching stays correct and predictable
- docs clearly separate multi-source from dashboards

### Phase 4. Add controlled chart inputs for data-scope state

Goal:

- let charts accept controlled filters, date range filters, and related data-scope state

Why this matters:

- this is the bridge that allows dashboards to drive charts cleanly

Exit criteria:

- dashboard-global state can flow into charts without hacks

### Phase 5. Add dashboard composition on top of linked data models

Goal:

- compose typed chart definitions into one dashboard definition

Scope:

- chart registry
- shared dashboard state container
- chart resolution by id
- no layout DSL

Exit criteria:

- charts can be composed centrally and rendered anywhere

### Phase 6. Add shared dashboard filters and coordination

Goal:

- let several charts and non-chart consumers respond to the same dashboard state

Scope:

- shared filters
- shared date ranges
- non-chart consumers like KPI cards and tables

Exit criteria:

- dashboard coordination is explicit rather than magical

### Phase 7. Add explicit materialized views and linked metrics

Goal:

- support flat cross-dataset analytic grains only when explicitly requested

Scope:

- materialized views
- linked metrics
- multi-dataset derived KPIs

Important rule:

- do not ship automatic denormalization as a shortcut

Exit criteria:

- cross-dataset row grain is explicit
- linked metrics are built on a real linked data model

## Non-Goals For A First Dashboard API

The first dashboard API should not try to solve everything.

Recommended non-goals:

- automatic dataset joins by default
- automatic denormalization of all datasets
- silent relationship inference in ambiguous cases
- freeform SQL-like query composition
- layout DSLs
- cross-dataset overlay series in one chart without an explicit materialized view
- treating every dashboard card as a built-in special component type

## Current Recommendation

The strongest current suggestion is:

1. Keep one chart-definition surface.
2. Make `.columns(...)` dataset-owned, but keep `defineChartSchema<Row>()` as the chart-first shortcut.
3. Add a linked `defineDataModel(...)` layer before dashboard composition.
4. Let datasets declare `key(...)` when they have stable row identity.
5. Define relationships once from a declared key to a foreign-key column, and derive reverse traversal from that same edge.
6. Support many-to-many through explicit `association(...)` definitions rather than direct many-to-many relationships.
7. Put reusable shared-filter semantics on the data model with optional `attribute(...)`, not on datasets.
8. Keep charts single-source at execution time.
9. Use explicit relationships and associations for cross-dataset coordination.
10. Fail at runtime if declared keys are not actually unique in the loaded data.
11. Do not automatically denormalize by default.
12. Add explicit materialized views only when a flat cross-dataset grain is truly needed.
13. Make automatic link discovery opt-in and suggestion-based only.
14. Keep layout outside the dashboard definition.
15. Do not publicly model a chart as a dashboard.

This keeps the simple case clean while still opening a credible path to typed,
linked dashboards.
