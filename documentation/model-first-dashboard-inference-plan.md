# Model-First Dashboard Inference Plan

This document proposes a concrete successor direction to the current
`createDashboard(...)` inference story.

The goal is to keep as much of the good inference from `createDashboard(...)` as
possible while moving the primary public API to a cleaner model-first shape:

1. `defineDataModel(...)`
2. `defineDashboard(model)`
3. `useDashboard(...)`

The main idea is:

- infer model structure in the data model layer, not in the dashboard layer
- keep dashboard composition thin
- keep `useDashboard(...)` as the runtime boundary
- keep the explicit core as the truth
- preserve best-in-class type safety by making inference typed when it is safe,
  and forcing explicit definitions when it is not

## Summary

The target direction is:

- `defineDataModel(...)` becomes the place where datasets are registered,
  inference happens, and explicit overrides live
- `defineDashboard(model)` remains the dashboard composition API
- charts that need cross-dataset lookup paths are authored against the model
- `defineChartSchema(...)` + `useChart(...)` remains the standalone
  single-chart path
- `createDashboard(...)` becomes a compatibility wrapper or secondary helper,
  not the flagship API

This keeps one clear dashboard story while preserving the strongest parts of the
current inferred implementation.

## What We Want At The Same Time

We want all of the following together:

- inline dataset definition inside `defineDataModel(...)`
- extracted `defineDataset(...)` reuse when desired
- safe inference of obvious keys, relationships, and reusable shared-filter
  attributes
- strong compile-time typing for:
  - dataset ids
  - inferred relationship aliases
  - inferred shared-filter ids
  - reachable lookup field paths
  - chart config shape
- runtime validation for:
  - key presence and uniqueness
  - referential integrity
  - association integrity
- ergonomic chart authoring with the same fluent controls we already have:
  - `xAxis(...)`
  - `groupBy(...)`
  - `filters(...)`
  - `metric(...)`
  - `chartType(...)`
  - `timeBucket(...)`
  - `connectNulls(...)`
- easy lookup fields like `owner.name` when the lookup preserves grain
- explicit materialization when grain changes
- no second runtime join engine inside `useChart(...)`

That combination is reasonable if inference is attached to the model and kept
conservative.

## Final API Target

### Primary path: model first, dashboard second

```ts
const hiringModel = defineDataModel()
  .dataset('jobs', defineDataset<Job>()
    .key('id')
    .columns((c) => [
      c.date('createdAt'),
      c.category('status'),
      c.number('salary', {format: 'currency'}),
    ]))
  .dataset('owners', defineDataset<Owner>()
    .key('id')
    .columns((c) => [
      c.category('name', {label: 'Owner'}),
      c.category('region'),
    ]))
  .infer({
    relationships: true,
    attributes: true,
  })
  .build()

const jobsByOwner = hiringModel.chart('jobsByOwner', (chart) =>
  chart
    .from('jobs')
    .xAxis((x) => x.allowed('createdAt', 'owner.name').default('owner.name'))
    .metric((m) =>
      m
        .count()
        .aggregate('salary', 'sum', 'avg')
        .defaultAggregate('salary', 'avg'))
    .filters((f) => f.allowed('status', 'owner.region'))
    .chartType((t) => t.allowed('bar', 'line').default('bar'))
)

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByOwner', jobsByOwner)
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

This should be the main story.

The key points are:

- datasets may be declared inline in the model
- inference happens once on the model
- charts may use safe cross-dataset lookup paths
- the dashboard only composes charts and selects shared filters

### Extracted dataset path

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.date('createdAt'),
    c.category('status'),
    c.number('salary', {format: 'currency'}),
  ])

const owners = defineDataset<Owner>()
  .key('id')
  .columns((c) => [
    c.category('name', {label: 'Owner'}),
    c.category('region'),
  ])

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .infer({
    relationships: true,
    attributes: true,
  })
  .build()
```

This is the same model, just with reusable dataset handles.

### Explicit escape hatches stay available

```ts
const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('people', people)
  .relationship('jobOwner', {
    from: {dataset: 'people', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'people', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
    ],
  })
  .infer({
    relationships: true,
    attributes: true,
    exclude: ['jobs.parentId'],
  })
  .build()
```

The rules should be:

- explicit relationships remain available
- explicit attributes remain available
- inferred structure augments the model
- explicit definitions win when the same structure would otherwise be inferred
- `exclude` suppresses false-positive automatic relationship inference for one
  `"datasetId.columnId"` pair

For reusable dataset definitions:

- keys do not need to be repeated in `.columns(...)` when `.key(...)` already
  declares them
- inferred foreign-key columns do not need to be repeated in `.columns(...)`
  unless the author wants to override their label, type, formatting, or make
  them part of the visible chart contract explicitly
- leaving a raw field out of `.columns(...)` should not be treated as the same
  thing as explicitly excluding it

### Explicit expanded-grain path remains separate

```ts
const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillRows,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
  .build()

const jobsWithSkills = hiringModel.materialize('jobsWithSkills', (m) =>
  m
    .from('jobs')
    .join('owner', {relationship: 'jobOwner'})
    .throughAssociation('skill', {association: 'jobSkills'})
    .grain('job-skill'))

const avgSalaryBySkill = jobsWithSkills
  .chart('avgSalaryBySkill')
  .xAxis((x) => x.allowed('skillName').default('skillName'))
  .metric((m) => m.aggregate('salary', 'avg'))
```

Lookup-preserving inference should be easy.

Grain-changing charts should stay explicit.

### Optional raw-data-first helper

If a raw-data-first helper survives, it should be secondary and implemented on
top of the same inference compiler:

```ts
const dashboard = createDashboard({
  data,
  charts,
})
```

This should not be the primary recommended API.

## Target Responsibilities

### `defineDataModel(...)`

`defineDataModel(...)` should own:

- dataset registration
- inline or extracted dataset definitions
- narrow key inference where safe
- relationship inference where safe
- reusable attribute inference where safe
- explicit relationships
- explicit associations
- explicit attributes
- explicit materialization
- runtime model validation

This is where inferred model semantics belong.

### Model-aware chart definitions

Charts that need cross-dataset lookup paths should be authored against the model.

That chart surface should:

- reuse the current fluent chart builder ideas
- choose a base dataset first with `.from(datasetId)`
- expose direct base-dataset columns plus safe lookup paths
- compile into the existing explicit core

This keeps chart authoring ergonomic without moving model logic into the
dashboard builder.

### `defineDashboard(model)`

`defineDashboard(model)` should own:

- chart composition
- chart registration by id
- shared filter selection
- dashboard-specific shared filters when needed

It should not own:

- relationship inference
- association inference
- model attributes
- materialization
- dataset semantics

### `useDashboard(...)`

`useDashboard(...)` should remain the runtime boundary for:

- model validation
- shared state
- shared filter propagation
- filtered dataset resolution
- chart data resolution

That part of the architecture is already right and should remain right.

## Safe Inference Rules

The target inference should be conservative.

### Safe to infer

- dataset ids from model registration
- a dataset key only when it is explicitly declared, or when it is obviously
  `id`
- one-to-many relationships when:
  - one side has a validated key
  - the target column clearly follows the foreign-key naming convention
  - the match is unambiguous
  - runtime validation confirms referential integrity
- reusable select attributes from validated relationships when the label source
  is obvious
- lookup field paths that preserve the base grain

### Not safe to infer by default

- arbitrary keys from uniqueness heuristics
- ambiguous relationship paths
- many-to-many structure from value overlap
- grain-changing traversal
- business semantics like formatting, labels, and derived columns
- free multi-hop traversal

### Reasonable first boundary

The first serious model-inference release should target:

- star schema and simple lookup-style graphs
- one-hop lookup paths like `owner.name`
- inferred relationship-backed shared filter attributes like `owner`

It should not try to solve every normalized-database case in the first pass.

## Type Safety Contract

Compile-time and runtime should keep different responsibilities.

### Compile-time should validate

- dataset ids
- inferred and explicit relationship ids
- inferred relationship aliases
- inferred and explicit attribute ids
- dashboard `sharedFilter(...)` ids
- chart ids
- chart config shape
- direct field ids
- reachable inferred lookup field paths
- explicit escape-hatch shapes such as `exclude`

### Runtime should validate

- declared or inferred key presence
- declared or inferred key uniqueness
- referential integrity for inferred and explicit relationships
- association edge integrity
- materialization assumptions

We should not pretend the type system can prove the truth of runtime data.

## Shared Filter Typing

This is one of the main reasons inference belongs on the model.

If inference creates typed model attributes, then:

- `defineDashboard(model).sharedFilter('owner')` stays strongly typed
- unknown shared filter ids fail at compile time
- inferred shared filters and explicit shared filters use one coherent contract

The dashboard layer should still opt into which inferred attributes it surfaces.

Inference should produce candidates and typed ids.

The dashboard should decide which ones are visible.

## Chart Typing And Ergonomics

The target chart experience should stay fluent and strongly typed.

### Builder shape

A fluent builder is still the right shape for chart authoring because type
narrowing improves step by step:

- `.from('jobs')` chooses the base dataset
- `xAxis(...)` narrows to valid direct and lookup fields for x-axis usage
- `metric(...)` narrows to valid numeric direct and lookup fields
- `filters(...)` narrows to valid filterable direct and lookup fields
- `chartType(...)` and `timeBucket(...)` stay the same

We should not go back to a large object-config DSL as the primary authoring
surface.

### Direct and lookup fields

For model-aware charts:

- direct base-dataset fields should be available normally
- safe lookup fields like `owner.name` should be available when they preserve
  base grain
- lookup fields should be typed separately by usage:
  - x-axis
  - group-by
  - filters
  - metric

That preserves the current "allowed fields narrow by role" behavior while making
cross-dataset fields easy.

### Compilation strategy

Model-aware chart definitions should compile into the explicit runtime core:

- if a chart uses only direct base-dataset fields, compile to a normal
  dataset-backed chart
- if a chart uses lookup-preserving fields, compile to a hidden
  lookup-projection view or equivalent explicit internal structure
- if a chart would expand grain, require explicit `model.materialize(...)`

This keeps `useChart(...)` and `useDashboard(...)` honest.

There should still be no second chart runtime that performs hidden arbitrary
joins at render time.

## Explicitness Boundaries

We should make the easy things easy without making the hard things magical.

### Implicit

- `owner.name` on top of a validated one-to-many lookup
- inferred shared-filter attribute `owner`
- inferred relationship `jobs.ownerId -> owners.id`

### Explicit

- multiple possible relationship matches
- many-to-many association setup
- derived association rules
- grain-changing expansion
- materialized chart grains
- special business naming or formatting

That is the boundary that preserves clarity and debuggability.

## Concrete Implementation Plan

### Phase 0: Extract reusable inference/compiler internals

#### Goal

Move the good inference logic out of `createDashboard(...)` into reusable
internal modules before changing the public API.

#### Deliverables

- extract relationship inference logic
- extract lookup-path resolution logic
- extract shared-filter attribute inference logic
- extract hidden lookup-view compilation logic
- keep error-rewrite behavior for inferred relationships

#### Likely code areas

- `src/core/create-dashboard.ts`
- new internal compiler modules under `src/core/`

#### Exit criteria

- `createDashboard(...)` still works
- the same internals can be called from model-first APIs

### Phase 1: Add typed model inference

#### Goal

Teach `defineDataModel(...)` to infer safe relationships and reusable
attributes.

#### Target API

```ts
defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .infer({
    relationships: true,
    attributes: true,
    exclude: ['jobs.parentId'],
  })
```

#### Deliverables

- `.infer(...)` on the data-model builder
- typed inferred relationships
- typed inferred attributes
- explicit definitions still available through existing builder methods
- runtime validation for inferred relationships

#### Rules

- explicit relationships are registered first
- inferred relationships do not override explicit ones
- excluded field pairs are skipped
- ambiguous candidates fail fast
- initial support is one-hop lookup-style inference only

#### Exit criteria

- `sharedFilter('owner')` can type-check from inferred model attributes
- inferred relationships and explicit relationships share one model contract

### Phase 2: Add model-aware chart definitions

#### Goal

Support fluent, typed chart authoring against the inferred model.

#### Target API

```ts
const jobsByOwner = model.chart('jobsByOwner', (chart) =>
  chart
    .from('jobs')
    .xAxis((x) => x.allowed('createdAt', 'owner.name'))
    .metric((m) => m.count().aggregate('salary', 'avg'))
    .filters((f) => f.allowed('status', 'owner.region'))
)
```

#### Deliverables

- one model-aware chart builder
- usage-specific lookup field unions
- compilation into dataset-backed charts or hidden lookup-preserving views
- no grain-changing implicit behavior

#### Exit criteria

- charts can safely mix base-dataset columns and lookup columns
- the builder remains fluent and narrow by control section

### Phase 3: Keep dashboard composition thin

#### Goal

Keep `defineDashboard(model)` focused on composition while consuming model-aware
charts.

#### Deliverables

- dashboard registration of model-aware charts
- typed shared filters from inferred and explicit model attributes
- direct dashboard-specific select/date-range filters still available
- no model logic added to `defineDashboard(...)`

#### Exit criteria

- dashboards stay a composition layer
- the runtime contract of `useDashboard(...)` stays stable

### Phase 4: Rebase `createDashboard(...)` on top of the new internals

#### Goal

Preserve migration ergonomics while removing `createDashboard(...)` as the main
source of truth.

#### Deliverables

- implement `createDashboard(...)` as a wrapper over:
  - inferred model construction
  - model-aware chart compilation
  - dashboard composition
- keep current error quality and convenience behavior
- mark `createDashboard(...)` as secondary in docs

#### Exit criteria

- no inference logic lives only inside `createDashboard(...)`
- the model-first path is the documented primary path

### Phase 5: Revisit association inference separately

#### Goal

Handle many-to-many inference only after the one-to-many model path is stable.

#### Notes

This should be treated as a separate problem because current
`createDashboard(...)` does not already provide full association inference.

Possible later additions:

- explicit bridge-row association inference
- derived association inference from embedded arrays
- inferred association-backed shared-filter candidates

This should not block the core model-first transition.

## Reasonable Scope For The First Target

The first target should include all of these:

- inline datasets inside `defineDataModel(...)`
- extracted datasets when reuse matters
- narrow implicit `id` key support
- inferred one-to-many relationships
- inferred model attributes for shared filters
- model-aware chart typing for one-hop lookup paths
- explicit dashboard shared-filter opt-in
- unchanged `useDashboard(...)` runtime boundary
- `createDashboard(...)` retained as a compatibility wrapper

The first target should not require all of these:

- many-to-many inference
- free multi-hop traversal
- automatic surfacing of every inferred shared filter
- a new runtime execution engine
- raw sample driven dataset authoring as the primary path

## Migration Advice

We should migrate in this order:

1. move inference internals into reusable compiler modules
2. add model inference
3. add model-aware chart authoring
4. keep dashboard thin
5. make `createDashboard(...)` a wrapper
6. update docs to make model-first the primary story

The important compatibility rule should be:

- inferred public APIs compile into the same explicit runtime core
- explicit model definitions remain the source of truth
- users can progressively move from inferred structure to explicit structure
  without changing the runtime mental model

## Final Recommendation

The concrete direction should be:

- always let users define a data model first
- allow datasets to be declared inline in that model
- move safe inference from `createDashboard(...)` into `defineDataModel(...)`
- add a model-aware fluent chart builder for lookup-preserving cross-dataset
  charts
- keep `defineDashboard(model)` as composition only
- keep `useDashboard(...)` as the runtime boundary
- keep explicit `association(...)` and `materialize(...)` for cases where
  inference would stop being honest

That gives us the best chance of preserving:

- strong type safety
- strong ergonomics
- good performance
- good composability
- clear mental model
- progressive disclosure from simple to advanced cases

without keeping multiple overlapping top-level dashboard APIs alive.
