# Semantic Model Concepts

This guide explains why chart-studio has separate semantics for datasets,
relationships, associations, attributes, materialized views, and dashboards.

It uses the same domain as the playground example in
`examples/playground/src/charts/DatasetModelChart.tsx`:

- `projectPlans`: one row = one approved project plan
- `managers`: one row = one accountable manager
- `capabilities`: one row = one reusable capability
- `projectCapabilities`: explicit bridge rows linking plans to capabilities

The short version is:

- datasets define one flat row shape
- models define cross-dataset meaning
- materialized views define one explicit flat derived grain
- dashboards define screen-level composition and shared state

Those are different jobs. Collapsing them makes the API look smaller, but it
also hides the places where row meaning, cardinality, and filter semantics
actually matter.

## Why These Semantics Exist

The library needs to support both of these at the same time:

1. Simple single-dataset charts with `useChart({ data })` or
   `useChart({ data, schema })`.
2. More advanced cross-dataset work without hidden joins or silent row
   multiplication.

The semantic layer exists because raw field names alone do not tell us:

- which ids are true keys
- which foreign keys are intended relationships
- when a path is many-to-many
- which dashboard filters are reusable business concepts
- what the flat chartable grain should be after crossing dataset boundaries

If those decisions are inferred automatically, the system becomes a hidden query
engine. That is exactly what Phase 7 is trying to avoid.

## Core Example

```ts
const projectPlans = defineDataset<ProjectPlan>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('managerId'),
    c.category('initiativeType'),
    c.category('region'),
    c.date('plannedAt'),
    c.number('budgetMidpoint', { format: 'currency' }),
    c.derived.category('statusBucket', {
      accessor: (row) =>
        row.status === 'Planned' || row.status === 'On Hold'
          ? 'Active Plan'
          : 'Closed',
    }),
  ])

const managers = defineDataset<ProjectManager>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', { label: 'Manager' }),
    c.category('region'),
    c.category('programArea'),
  ])

const capabilities = defineDataset<Capability>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', { label: 'Capability' }),
    c.category('domain'),
  ])

const deliveryModel = defineDataModel()
  .dataset('projectPlans', projectPlans)
  .dataset('managers', managers)
  .dataset('capabilities', capabilities)
  .relationship('projectManager', {
    from: { dataset: 'managers', key: 'id' },
    to: { dataset: 'projectPlans', column: 'managerId' },
  })
  .association('projectCapabilities', {
    from: { dataset: 'projectPlans', key: 'id' },
    to: { dataset: 'capabilities', key: 'id' },
    data: projectCapabilityEdges,
    columns: {
      from: 'projectId',
      to: 'capabilityId',
    },
  })
  .attribute('manager', {
    kind: 'select',
    source: { dataset: 'managers', key: 'id', label: 'name' },
    targets: [
      { dataset: 'projectPlans', column: 'managerId', via: 'projectManager' },
    ] as const,
  })
  .attribute('capability', {
    kind: 'select',
    source: { dataset: 'capabilities', key: 'id', label: 'name' },
    targets: [
      { dataset: 'projectPlans', through: 'projectCapabilities', mode: 'exists' },
    ] as const,
  })
  .build()
```

## `defineDataset(...)`

### What it is

`defineDataset<Row>()` defines the reusable meaning of one flat row shape.

That includes:

- key definition
- column labels and formats
- derived columns
- the shared column contract reused by `dataset.chart(...)`

### Example

`projectPlans` defines business columns like `initiativeType`,
`budgetMidpoint`, and reusable derived columns like `statusBucket`.

### What breaks without it

Without datasets, every chart has to redefine the same meaning:

```ts
defineChartSchema<ProjectPlan>()
  .columns((c) => [
    c.category('initiativeType'),
    c.number('budgetMidpoint', { format: 'currency' }),
    c.derived.category('statusBucket', { accessor: ... }),
  ])
```

That is manageable once. It becomes noise when many charts need the same row
shape.

### Why it cannot be inferred

The runtime cannot infer:

- which fields deserve labels or formats
- which raw fields should be hidden
- which business columns should exist as derived columns
- whether `budgetMidpoint` is currency, integer, or plain number

Those are author decisions, not schema facts.

## `defineDataModel(...)`

### What it is

`defineDataModel()` is the registry for linked semantics across multiple
datasets.

It answers questions that a single dataset cannot answer:

- which datasets belong to the same domain
- which links are valid
- which shared filter concepts are reusable
- which validations should run across datasets

### Example

`deliveryModel` registers `projectPlans`, `managers`, and `capabilities` in one
place.

### What breaks without it

Without a model, every dashboard or view builder has to rediscover the same
cross-dataset rules by hand.

That usually leads to:

- ad hoc `Map` lookups in UI code
- duplicate foreign-key validation logic
- inconsistent filter behavior across screens

### Why it cannot be inferred

Three datasets sitting next to each other do not say how they are supposed to
connect.

Even if two tables both have `id: string`, that does not mean they are linked.
The model exists because link meaning is semantic, not structural.

## `relationship(...)`

### What it is

`relationship(...)` defines an explicit key-to-foreign-key path.

Example:

```ts
.relationship('projectManager', {
  from: { dataset: 'managers', key: 'id' },
  to: { dataset: 'projectPlans', column: 'managerId' },
})
```

This says:

- managers are keyed by `managers.id`
- each project plan refers to one manager through `projectPlans.managerId`

### What breaks without it

Without an explicit relationship:

- a manager filter cannot safely target project plans
- lookup-style projections like `managerName` need manual `Map` code
- materialized views cannot know which path to follow

You end up writing code like this repeatedly:

```ts
const managerById = new Map(managers.map((row) => [row.id, row]))

const rows = projectPlans.map((plan) => ({
  ...plan,
  managerName: managerById.get(plan.managerId)?.name ?? 'Unknown',
  managerRegion: managerById.get(plan.managerId)?.region ?? null,
}))
```

That boilerplate is exactly what the model is meant to remove.

### Why it cannot be inferred

It is not safe to infer relationships because:

- multiple foreign keys may point to the same dataset
- names may be misleading
- direction matters
- one table may have several manager-like columns

Example:

```ts
type ProjectPlan = {
  id: string
  deliveryManagerId: string
  sponsorManagerId: string
}
```

Both ids point at `managers`. The runtime cannot guess which one you mean when
you say "join manager".

## `association(...)`

### What it is

`association(...)` defines an explicit many-to-many link.

Example:

```ts
.association('projectCapabilities', {
  from: { dataset: 'projectPlans', key: 'id' },
  to: { dataset: 'capabilities', key: 'id' },
  data: projectCapabilityEdges,
  columns: {
    from: 'projectId',
    to: 'capabilityId',
  },
})
```

This says that project plans and capabilities are connected through explicit
bridge rows.

### What breaks without it

Without an association:

- a capability filter cannot answer "show project plans that require X"
- a materialized `project-plan-capability` grain cannot be built safely
- many-to-many expansion gets hidden in custom `flatMap(...)` code

You end up doing this in ad hoc runtime code:

```ts
const rows = projectPlans.flatMap((plan) =>
  projectCapabilityEdges
    .filter((edge) => edge.projectId === plan.id)
    .map((edge) => ({
      ...plan,
      capabilityId: edge.capabilityId,
      capabilityName: capabilityById.get(edge.capabilityId)?.name ?? 'Unknown',
    })),
)
```

This code multiplies rows. If that multiplication is not explicit in the API,
chart counts become misleading.

### Why it cannot be inferred

It is not enough to notice that both sides have ids.

The runtime still cannot know:

- which bridge table is authoritative
- whether the link is really many-to-many
- whether the edge rows are complete
- whether flattening is intended at all

Many-to-many semantics must stay explicit because they change grain.

## `attribute(...)`

### What it is

`attribute(...)` defines reusable shared-filter semantics on the model.

Example:

```ts
.attribute('manager', {
  kind: 'select',
  source: { dataset: 'managers', key: 'id', label: 'name' },
  targets: [
    { dataset: 'projectPlans', column: 'managerId', via: 'projectManager' },
  ] as const,
})
```

`attribute(...)` is not "just another relationship name". It says:

- where filter options come from
- how options are labeled
- which datasets the filter can constrain
- whether the target path is direct or through an association

### What breaks without it

Without attributes, every dashboard has to rebuild the same business filter
definition by hand.

That causes drift:

- one dashboard uses manager id
- another uses manager name
- another filters project plans directly
- another tries to rebuild capability existence logic itself

The same business concept ends up behaving differently in different screens.

### Why it cannot be inferred

The runtime cannot infer:

- the human-facing label source
- whether the filter should key by id or by some other field
- whether the intended semantics are direct equality or association existence
- which targets should participate

Those are product decisions, not database facts.

## `materialize(...)`

### What it is

`materialize(...)` creates one explicit flat derived view with one declared
grain.

Example:

```ts
const projectPlansWithManager = deliveryModel.materialize('projectPlansWithManager', (m) =>
  m
    .from('projectPlans')
    .join('manager', { relationship: 'projectManager' })
    .grain('project-plan')
)

const projectCapabilityView = deliveryModel.materialize('projectCapabilityView', (m) =>
  m
    .from('projectPlans')
    .join('manager', { relationship: 'projectManager' })
    .throughAssociation('capability', { association: 'projectCapabilities' })
    .grain('project-plan-capability')
)
```

This is how cross-dataset columns become available without repeating derived
columns like `managerName`, `managerRegion`, or `capabilityName` on every base
dataset.

### What breaks without it

Without materialized views, users usually end up with one of two bad options.

Bad option 1: duplicate trivial lookup projections on every dataset.

```ts
c.derived.category('managerName', {
  accessor: (row) => managerById.get(row.managerId)?.name ?? 'Unknown',
})
```

That is repetitive and leaks linked-table semantics back into every dataset.

Bad option 2: let the model behave like a hidden query engine at chart render
time.

That hides:

- when joins happened
- which path was taken
- whether rows were multiplied
- what the final chart grain really is

### Why it cannot be inferred

Cross-dataset charting requires explicit answers to questions like:

- which dataset is the base grain
- which relationship should be traversed
- whether the path is lookup-style or row-expanding
- what the resulting grain should be called

Those answers are often ambiguous. For example, if a project can link to both a
delivery manager and a sponsor manager, the runtime cannot safely invent a
single default "manager join".

## `defineDashboard(model)` and `sharedFilter(...)`

### What it is

`defineDashboard(model)` composes charts additively on top of datasets and model
attributes.

`sharedFilter(...)` adds dashboard-level coordinated state.

Example:

```ts
const dashboard = defineDashboard(deliveryModel)
  .chart('planningVolume', planningVolumeSchema)
  .chart('budgetMix', budgetMixSchema)
  .sharedFilter('manager')
  .sharedFilter('capability')
  .sharedFilter('status', {
    kind: 'select',
    source: { dataset: 'projectPlans', column: 'status' },
  })
  .sharedFilter('planningDate', {
    kind: 'date-range',
    targets: [
      { dataset: 'projectPlans', column: 'plannedAt' },
    ] as const,
  })
  .build()
```

### What breaks without it

Without dashboards:

- charts cannot coordinate shared state explicitly
- each screen has to rebuild registry logic
- non-chart consumers cannot easily read the same filtered dataset slice

### Why it cannot be inferred

Not every model attribute belongs on every dashboard.

That choice is screen-specific. For example:

- one dashboard may want `manager` and `capability`
- another may only want `region`
- another may add a dashboard-only `status` filter

This is why dashboard semantics stay separate from model semantics.

## Why We Need Separate Primitives

The semantics look similar because they all talk about data, but they solve
different problems:

| Primitive | Job |
| --- | --- |
| `defineDataset(...)` | Define one reusable flat row contract |
| `defineDataModel(...)` | Register datasets plus explicit cross-dataset meaning |
| `relationship(...)` | Define one key-to-foreign-key path |
| `association(...)` | Define one explicit many-to-many path |
| `attribute(...)` | Define reusable shared-filter semantics |
| `materialize(...)` | Define one explicit flat derived chart grain |
| `defineDashboard(...)` | Compose charts and shared state for one screen |

If any of these are removed, their responsibility does not disappear. It just
moves into less visible code:

- manual lookup maps
- manual `flatMap(...)` joins
- dashboard-specific filter glue
- duplicate derived columns
- hidden row multiplication

The point of the semantic layer is not to make the system more abstract. It is
to move that complexity into explicit, typed, reusable declarations.

## Why Not Infer More Automatically

Automatic inference works well for raw column types inside a single flat row.
It works poorly for cross-dataset meaning.

The missing information is semantic:

- intended key direction
- intended path selection
- intended filter meaning
- intended row grain after traversal
- intended visibility of many-to-many expansion

That is why the library should infer simple column types, but require explicit
semantics once users cross dataset boundaries.

## Boundary Summary

The intended long-term mental model is:

- `defineChartSchema<Row>()` for one chart
- `defineDataset<Row>()` for one reusable row shape
- `defineDataModel(...)` for linked semantics
- `model.materialize(...)` for one explicit cross-dataset flat grain
- `defineDashboard(model)` for additive screen composition

That boundary is the main reason the API remains powerful without turning the
model into a magical query engine.
