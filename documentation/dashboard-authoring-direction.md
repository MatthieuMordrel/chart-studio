# Dashboard Authoring Direction

This document is a conservative direction note, not a locked API contract.

The goal is to simplify the public dashboard story without weakening type
safety, runtime honesty, or performance.

## Summary

The recommended direction is:

1. keep one primary dashboard authoring API: `defineDashboard(...)`
2. let `defineDashboard(...)` infer the obvious model structure when possible
3. let users progressively extract `defineDataset(...)` and `defineDataModel(...)`
   only when they need more control or reuse
4. keep `useDashboard(...)` as the runtime boundary for data, shared state, and
   filtered chart resolution

This means we should avoid introducing a separate primary API such as
`createDashboard(...)` or `inferDashboard(...)` if it would compete with
`defineDashboard(...)` in user-facing guidance.

## Why We Think This Is The Best Direction

We are optimizing for three things at the same time:

- best-in-class type safety at every layer
- ergonomics for the common case
- predictable runtime performance

Those goals are easiest to balance when the public model stays progressive
instead of branching into several similar-looking dashboard APIs.

The cleanest progression is:

- start with `defineDashboard(...)`
- extract reusable datasets with `defineDataset(...)` when needed
- extract a reusable linked model with `defineDataModel(...)` when needed

That gives users one mental model that scales up instead of several parallel
entry points that overlap heavily.

The builder shape matters here. A fluent builder is the best fit for this
surface because type narrowing improves step by step as datasets, charts, and
shared filters are registered.

## Primary Path

For dashboards, the primary path should be:

1. `defineDashboard()`
2. `useDashboard(...)`

The dashboard builder should support inline dataset registration and safe
inference for the obvious cases:

- direct dataset registration
- narrow key inference only when it is obviously safe
- obvious lookup relationships
- obvious shared-filter candidates
- lookup path resolution that preserves grain

When data is already clean, this should feel like an ultra happy path: register
the datasets and start building charts immediately.

Conceptually:

```ts
const hiringDashboard = defineDashboard()
  .dataset('jobs', defineDataset<Job>()
    .key('id')
    .columns((c) => [
      c.field('id'),
      c.field('ownerId'),
      c.date('createdAt'),
      c.category('status'),
      c.number('salary', {format: 'currency'}),
    ]))
  .dataset('owners', defineDataset<Owner>()
    .key('id')
    .columns((c) => [
      c.field('id'),
      c.category('name', {label: 'Owner'}),
    ]))
  .chart('avgSalaryByOwner', (chart) =>
    chart
      .from('jobs')
      .xAxis((x) => x.allowed('owner.name').default('owner.name'))
      .metric((m) =>
        m.aggregate('salary', 'avg').defaultAggregate('salary', 'avg'),
      ))
  .sharedFilter('owner')
  .build()

const dashboard = useDashboard({
  definition: hiringDashboard,
  data: {
    jobs: jobRows,
    owners: ownerRows,
  },
})
```

This keeps the authoring experience declarative while still compiling into the
existing explicit core.

This document is specifically about dashboard authoring. The standalone
single-chart path should remain separate:

- `defineChartSchema(...)` + `useChart(...)` for one-off charts
- `defineDashboard(...)` + `useDashboard(...)` for dashboard composition

That keeps the simple single-chart story fast and uncluttered.

## Progressive Extraction

The same authoring flow should scale without forcing users onto a different
dashboard API.

### Extract datasets when dataset meaning matters

As soon as a dataset needs richer semantics, users should pull it out into
`defineDataset(...)`:

- labels
- formatting
- exclusions
- derived columns
- explicit keys
- reusable chart contracts

This is the right place for dataset meaning. It should not depend on runtime
row samples.

### Extract the data model when cross-dataset semantics become important

If users need multiple dashboards over the same model, or advanced linked-model
behavior, they should extract `defineDataModel(...)`.

Conceptually:

```ts
const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })

const hiringDashboard = defineDashboard(model)
  .chart('avgSalaryByOwner', jobs.chart('avgSalaryByOwner')
    .xAxis((x) => x.allowed('owner.name').default('owner.name'))
    .metric((m) => m.aggregate('salary', 'avg')))
  .sharedFilter('owner')
  .build()
```

The important point is that the user has not changed dashboard concepts. They
have only extracted the model because reuse or explicitness now pays for itself.

## What Should Stay Explicit

We should still be conservative about inference.

The dashboard layer should infer only what is structurally obvious and safe to
validate. It should not guess:

- arbitrary keys from uniqueness heuristics
- many-to-many structure from overlapping values
- business semantics such as labels or formatting
- ambiguous or multi-hop traversal paths
- grain-changing behavior that becomes hard to debug

When the chart grain changes, or when model semantics are not obvious, the user
should progressively move into `defineDataModel(...)`,
`model.materialize(...)`, and other explicit helpers.

That keeps the primary path clean without hiding important semantics.

## Why We Should Not Lead With `createDashboard(...)`

A raw-data-first API looks attractive because it is short, but it introduces a
few problems:

- it encourages dataset meaning to be inferred from row samples instead of
  authored explicitly
- it creates a second dashboard entry point that overlaps heavily with
  `defineDashboard(...)`
- it makes the progression from simple to advanced feel like an API switch
  instead of an extraction
- it risks reintroducing confusion about where data belongs at author time
  versus runtime

For that reason, if a raw-data-first helper exists at all, it should be treated
as secondary convenience, not as the recommended dashboard API.

## Type Safety

This direction is specifically intended to preserve the strongest type safety we
already have.

Compile-time should continue to validate:

- dataset ids
- chart ids
- chart option shape
- field ids on each dataset
- reachable lookup paths that are valid for the declared model shape
- override and escape-hatch shapes

Runtime should continue to validate:

- key presence and uniqueness
- referential integrity
- association edge integrity
- materialization assumptions

This split matters. We should not pretend the type system can prove the truth of
runtime data.

## Ergonomics

The desired ergonomics are progressive:

- clean data: define datasets and start building charts immediately
- moderate complexity: add a few explicit hints or exclusions
- advanced complexity: extract `defineDataModel(...)` and explicit
  materialization where needed

The same dashboard API should support that climb without forcing users to learn
competing authoring models too early.

## Performance

This direction must preserve the current runtime architecture:

- the inferred layer compiles into the explicit core
- `useChart(...)` still runs against one flat row array
- relationship traversal should compile into explicit materialized views when
  needed, not into a second runtime join engine
- `useDashboard(...)` remains the single owner of dashboard state, shared
  filters, and resolved chart data

That keeps the primary path fast while avoiding hidden runtime work for charts
that are not mounted.

## Proposed API Shape

We should aim for one dashboard API with two authoring modes:

### Inline dashboard-first mode

```ts
defineDashboard()
```

Use this when the dashboard is the main thing being authored and the model does
not need to be reused elsewhere yet.

### Model-first mode

```ts
defineDashboard(model)
```

Use this when the linked data model is reusable, needs advanced explicit
semantics, or is shared by multiple dashboards.

These two modes should feel like the same API, not two competing products.

## Guardrails

To keep the API coherent, `defineDashboard()` should not become a full duplicate
of `defineDataModel()`.

Inline dashboard-first authoring should cover:

- dataset registration
- safe inference
- lightweight explicit hints where necessary
- chart composition
- shared filters

Once the user needs broader model reuse or more advanced linked semantics, that
is the point where `defineDataModel()` should be extracted explicitly.

## Recommendation

The conservative recommendation is:

- move away from `createDashboard(...)` as the primary direction
- avoid adding `inferDashboard(...)` as another top-level flagship API
- evolve `defineDashboard(...)` into the single progressive dashboard authoring
  surface
- keep `defineDataModel(...)` as the explicit extraction path for advanced and
  reusable model semantics
- keep `useDashboard(...)` as the runtime boundary

This gives us the best chance of delivering:

- an ultra fast happy path when the data is already clean
- progressive escape hatches when it is not
- strong type safety end to end
- good runtime performance without hidden execution paths
- one clear story instead of several overlapping ones
