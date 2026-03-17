# Inferred Dashboard API Implementation Plan

## Goal

Introduce one inferred dashboard API that restores a very happy path:

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    owners: ownerRows,
    candidates: candidateRows,
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    candidatesByStage: {
      data: 'candidates',
      xAxis: 'stage',
      metric: 'count',
    },
  },
})
```

while keeping the current explicit architecture as the source of truth for:

- dataset meaning
- linked model semantics
- shared filter semantics
- materialized chart grains
- dashboard composition

The inferred API must compile into the explicit core. It must not replace it.

## Why This Exists

The current explicit model is powerful and honest, but the happy path became too
ceremonial for common dashboard cases. The next API layer should let users:

- pass several datasets
- define charts declaratively
- get obvious relationships and shared filters for free
- customize only when needed

without forcing them to manually author relationships, associations,
attributes, and materialized views for cases that are already obvious from the
data shape.

## Locked Constraints

These constraints should not be broken while implementing the inferred layer.

### 1. The explicit core remains the truth

The inferred API is sugar over:

- `defineDataset(...)`
- `defineDataModel(...)`
- `defineDashboard(...)`
- `model.materialize(...)`
- `useDashboard(...)`

The inferred layer should generate those internal structures rather than
introducing a second execution engine.

### 2. A chart still runs on one flat row array

`useChart(...)` should continue to read one flat dataset or one explicit
materialized view. Do not move relationship traversal into the chart runtime.

### 3. Inference must be safe, not clever

Infer only what is structurally obvious and runtime-validatable. Do not infer:

- arbitrary keys from uniqueness heuristics
- many-to-many edges from similar-looking values
- business semantics like derived columns or formatting
- multi-hop traversal paths that are ambiguous

### 4. TypeScript and runtime have different jobs

Compile-time should validate:

- dataset ids
- chart ids
- chart config shape
- reachable field and path ids
- override shapes

Runtime should validate:

- key presence and uniqueness
- referential integrity
- association edge integrity
- derived association integrity

Do not pretend the type system can prove data truth.

### 5. Grain changes must stay visible

Lookup traversal that preserves the base grain may be hidden behind inference.
Row-expanding traversal must not become invisible or impossible to debug.

If the inferred layer eventually auto-materializes expanded rows, the runtime
and debug metadata must still expose the resolved grain.

## Decision Summary

These are the recommended implementation decisions.

### Path syntax

Use dot notation for inferred traversal paths:

- `owner.name`
- `manager.region`
- `skill.name`

It is the most readable option. If raw source keys contain dots, that case
should stay explicit through dataset customization instead of complicating the
inferred path syntax.

### Shared filters

Infer shared-filter candidates automatically, but do not auto-surface every one
by default in the first shipping version.

Recommended first API:

```ts
createDashboard({
  data,
  charts,
  sharedFilters: ['owner', 'status'],
})
```

Possible later addition:

```ts
sharedFilters: 'auto'
```

### Key inference

Only infer a dataset key automatically when it is obviously `id`.

Do not infer "the first unique non-null column" as a public default. That is
too risky for a best-in-class typed API.

### Column overrides

Column overrides must be per dataset, never global.

### Many-to-many

Only infer many-to-many when real edge data exists:

- explicit bridge rows
- embedded arrays such as `skillIds`

If no edge mapping exists, inference must fail and require explicit structure or
a pre-flattened dataset.

## Scope By Data Model Scenario

This plan should align with [data-model-scenarios.md](/home/matth/projects/maintained/chart-studio/documentation/data-model-scenarios.md).

### Scenario A: Already flat

Supported immediately.

The inferred API should be almost trivial here:

- register one dataset
- infer scalar columns
- define charts

No model graph is needed.

### Scenario B: Star schema

This is the ideal target for the first inferred dashboard release.

It gives the biggest ergonomic win with the lowest semantic risk because:

- keys are simple
- relationships are lookup-style
- shared filters are obvious
- lookup traversal preserves grain

### Scenario C: Normalized tables with bridge rows

Supported, but in stages.

Later phases should support inferred associations for filtering and shared
filters. Cross-dataset chart paths through that association should come later
because they expand grain.

### Scenario D: Normalized tables with embedded arrays

Supported, but only when the array values clearly map to another dataset's key.

This should compile into the existing explicit `association(... deriveFrom ...)`
shape internally.

### No edge mapping exists

Must fail.

This remains a hard boundary:

- no guessed many-to-many
- no value-overlap inference
- no "magical" bridge creation

## Target Public API Shape

The inferred entry point should stay small.

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    owners: ownerRows,
    candidates: candidateRows,
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    salaryByOwner: {
      data: 'jobs',
      xAxis: 'owner.name',
      metric: {column: 'salary', fn: 'avg'},
    },
  },
  sharedFilters: ['owner'],
})
```

The inferred API should then allow additive escape hatches:

```ts
const dashboard = createDashboard({
  data,
  charts,
  keys: {
    users: 'userId',
  },
  datasets: {
    jobs: {
      columns: {
        salary: {type: 'number', format: 'currency'},
        createdAt: {type: 'date', label: 'Created'},
        internalId: false,
      },
    },
  },
  exclude: ['jobs.statusId'],
  relationships: {
    jobOwner: {
      from: {dataset: 'people', key: 'id'},
      to: {dataset: 'jobs', column: 'ownerId'},
    },
  },
  associations: {
    jobSkills: {
      kind: 'bridge',
      dataset: 'assignments',
      from: {dataset: 'jobs', column: 'jobId'},
      to: {dataset: 'skills', column: 'skillId'},
    },
  },
  sharedFilters: ['owner', 'status'],
})
```

## Safe Inference Matrix

| Concern | Safe to infer? | Rule | Escape hatch |
| --- | --- | --- | --- |
| Dataset ids | Yes | Keys of `data` object | None needed |
| Scalar column types | Yes | Existing `infer-columns` rules | Per-dataset column overrides |
| Dataset key | Yes, narrowly | Only `id` by default | `keys` or explicit dataset definition |
| FK relationship | Yes, narrowly | Exact naming convention plus runtime validation | `exclude`, explicit `relationships` |
| Shared-filter candidate | Yes | Inferred from validated relationships and associations | Explicit `sharedFilters` list |
| Lookup path like `owner.name` | Yes | Only validated 1:N lookup traversal | Explicit relationship or dataset/view |
| Bridge association | Yes, narrowly | Exactly two validated FK endpoints, no extra analytic semantics | Explicit `associations` |
| Embedded-array association | Yes, narrowly | Array field values match another dataset key | Explicit `associations` |
| Expanded chart grain | Later only | Only when path requires one unambiguous expansion | Explicit materialized view remains fallback |
| Derived columns | No | Author semantics, not data shape | Reuse explicit dataset customization |
| Formatting/labels/exclusions | No | Author semantics, not data shape | Per-dataset overrides |

## Recommended Internal Architecture

The inferred implementation should be a compiler pipeline.

```text
createDashboard(...)
  -> infer datasets and graph candidates
  -> merge explicit escape hatches
  -> validate inferred graph
  -> generate explicit dataset/model/dashboard definitions
  -> useDashboard(...)
```

### Internal phases of compilation

1. Normalize user input
2. Resolve per-dataset overrides
3. Infer keys
4. Infer relationships
5. Infer associations
6. Infer shared-filter candidates
7. Resolve chart field paths
8. Generate any hidden lookup views
9. Build explicit `defineDataModel(...)`
10. Build explicit `defineDashboard(...)`

### Hidden generated definitions

The inferred layer may generate internal definitions that are not public author
surface:

- anonymous dataset definitions
- anonymous model attributes
- anonymous lookup-preserving materialized views

That is acceptable as long as:

- the runtime behavior stays consistent with the explicit core
- errors still point back to user-facing config
- debug metadata can expose the resolved structure

## Phased Implementation Plan

### Phase 1: Add `createDashboard(...)` as a typed compiler shell

#### Goal

Ship the new entry point without changing runtime semantics yet.

#### Deliverables

- new `createDashboard(...)` public API
- typed `data` object with inferred dataset ids
- typed `charts` object with chart ids and per-chart `data` dataset id
- internal compilation into explicit dataset/model/dashboard definitions
- no relationship traversal yet

#### Allowed chart fields

Only direct columns on the selected dataset:

- `createdAt`
- `status`
- `salary`

#### Non-goals

- shared filters
- inferred relationships
- cross-dataset paths
- inferred associations

#### Exit criteria

- the simple multi-dataset dashboard happy path exists
- chart config stays strongly typed by dataset id
- existing runtime remains unchanged underneath

### Phase 2: Add dataset-level customization to the inferred API

#### Goal

Let users recover labels, formatting, exclusions, and later derived columns
without dropping fully out of the inferred API.

#### Recommendation

Implement this in two layers.

First layer:

- lightweight per-dataset column overrides for:
  - `type`
  - `label`
  - `format`
  - exclusion via `false`

Second layer:

- allow plugging the full explicit dataset contract for advanced customization

This keeps the happy path lean while avoiding a second derived-column DSL.

#### Deliverables

- `datasets.<id>.columns` override surface
- merge logic with inferred column metadata
- typed per-dataset override keys
- compile-time narrowing of chart options after exclusions and type overrides

#### Non-goals

- inferred derived columns
- relationship inference

#### Exit criteria

- users can recover most current `defineChartSchema(...)` ergonomics inside
  `createDashboard(...)`
- chart typing reflects the customized dataset meaning

### Phase 3: Add inferred keys and lookup relationships

#### Goal

Infer the obvious star-schema and lookup-style graph.

#### Rules

Infer a key only when:

- the dataset has an `id` field

Infer a relationship only when all of these are true:

- one dataset has a validated key
- another dataset has a column matching the exact FK convention
- the convention maps to exactly one dataset
- runtime referential validation succeeds
- the path is not explicitly excluded

#### Deliverables

- inferred `id` keys
- inferred key-to-foreign-key relationships
- runtime validation for orphan FKs
- precise error messages for:
  - missing dataset
  - missing key
  - invalid FK data
  - excluded false-positive FK

#### Non-goals

- bridge inference
- embedded-array inference
- row expansion

#### Exit criteria

- common star-schema dashboards no longer require manual
  `defineDataModel(...).relationship(...)`
- invalid inferred relationships fail fast

### Phase 4: Add inferred shared-filter candidates

#### Goal

Infer reusable shared-filter semantics from validated model structure.

#### Recommendation

Infer candidates automatically, but keep surfacing explicit in the first
version:

```ts
sharedFilters: ['owner', 'status']
```

That keeps the UI lean and avoids flooding the dashboard with every possible
dimension filter.

#### Rules

Infer a candidate when:

- a lookup dataset connects to one or more chart datasets through validated
  relationships
- or an inferred association provides an `exists`-style filter target

Resolve the label from:

- the first obvious human-readable category column
- otherwise the key field

#### Deliverables

- internal inferred-attribute representation
- typed `sharedFilters` list constrained to inferred or explicit ids
- merge with dashboard-local direct column filters

#### Exit criteria

- dashboards can opt into obvious shared filters without manually authoring
  `attribute(...)`

### Phase 5: Add inferred lookup path resolution

#### Goal

Support cross-dataset chart fields that preserve the base grain.

#### Examples

- `owner.name`
- `manager.region`

#### Rules

Resolve a path only when:

- it is a single validated lookup traversal
- it does not require row expansion
- the far-side column exists and is chart-compatible

Implementation should compile this into a hidden lookup-preserving materialized
view, not into a new runtime join engine.

#### Deliverables

- typed path parser and resolver
- lookup-path union generation for each chart dataset
- hidden generated materialized view when needed
- chart runtime metadata that exposes the resolved chart grain and source view

#### Non-goals

- N:N chart traversal
- multi-hop path search across several relationships

#### Exit criteria

- `xAxis: 'owner.name'` works with strong typing
- the base dataset grain is still preserved and debuggable

### Phase 6: Add inferred associations

#### Goal

Support normalized models that have real many-to-many structure without forcing
manual `association(...)` for obvious cases.

#### Supported inference shapes

Bridge rows:

- dataset contains exactly two validated FK endpoint columns
- no extra analytic semantics are required for classification

Embedded arrays:

- array field name maps to another dataset
- values validate against that dataset key

#### Important boundary

This phase should first unlock:

- shared filtering through the association
- attribute-style semantics

It should not immediately unlock arbitrary chart traversal across the
association.

#### Deliverables

- bridge-table detection
- embedded-array association detection
- runtime validation for explicit or derived edges
- inferred shared-filter targets using association `exists` semantics

#### Exit criteria

- Scenario C and D from [data-model-scenarios.md](/home/matth/projects/maintained/chart-studio/documentation/data-model-scenarios.md)
  are supported for filtering and dashboard coordination

### Phase 7: Add expanded-grain chart support carefully

#### Goal

Reach the eventual dream API for cases like:

```ts
salaryBySkill: {
  data: 'jobs',
  xAxis: 'skill.name',
  metric: {column: 'salary', fn: 'avg'},
}
```

#### Why this is late

This is the first phase that changes chart grain. Today the explicit core makes
that visible through `materialize(...).throughAssociation(...).grain(...)`.
The inferred layer must preserve that honesty.

#### Rules

Only auto-expand when all of these are true:

- exactly one association or one-to-many expansion is required
- the path is unambiguous
- the far-side dataset and column are valid
- the expansion can compile into one hidden generated materialized view
- the resolved grain can be surfaced in debug/runtime metadata

Hard-fail when:

- more than one expansion is required
- a second expansion path is possible
- no edge mapping exists
- the generated expansion would hide unclear semantics

#### Recommendation

Do not ship this phase until the debug/runtime surface can expose:

- base dataset
- resolved generated view
- resolved grain label
- resolved expansion path

#### Exit criteria

- the dream API works for one safe expansion
- row multiplication is still visible to advanced users
- explicit materialized views remain the fallback for anything more complex

### Phase 8: Converge inferred and explicit customization

#### Goal

Make the inferred API feel progressive rather than parallel.

#### Deliverables

- clean escape hatches for:
  - `keys`
  - `exclude`
  - `relationships`
  - `associations`
  - full dataset customization
- internal reuse of explicit builder logic rather than duplicated validation
- migration guidance between `createDashboard(...)` and explicit authoring

#### Exit criteria

- users can start inferred and move explicit only where necessary
- there is one mental model, not two competing systems

## Type Safety Plan

The inferred layer should preserve the library's strongest current property:
literal-aware configuration and narrow chart contracts.

### Compile-time guarantees

When the caller provides object literals, TypeScript should validate:

- `charts.<id>.data` is a real dataset id
- direct field ids exist on that dataset
- lookup paths are only allowed when a relationship can be resolved from the
  declared shapes and config
- metric columns are numeric on the resolved chart grain
- shared filter ids are inferred or explicit valid ids
- overrides only reference real dataset and column ids

### Important type boundary

The type system should model:

- what can be resolved from the declared data shape and config

The runtime should validate:

- whether the actual values satisfy that structure

That means type errors should cover path resolution and config misuse, while
runtime errors should cover bad data.

## Runtime Validation Plan

The inferred runtime should reuse current explicit validation semantics.

### Validation responsibilities

- dataset key presence and uniqueness
- relationship referential integrity
- bridge edge integrity
- derived association integrity
- path-resolution assumptions that depend on inferred graph validity

### Error quality requirements

Errors must explain:

- what was inferred
- why it failed
- which config can override or disable that inference

Example:

```text
Inferred relationship "jobs.ownerId -> owners.id" failed validation:
row 12 references "owner-99", which does not exist in dataset "owners".
If this is not a real foreign key, exclude it with:
exclude: ['jobs.ownerId']
```

## Testing Plan

Each phase should ship with both type-level and runtime coverage.

### Type tests

- dataset-id narrowing in `createDashboard(...)`
- per-chart field narrowing by dataset
- lookup path narrowing
- shared-filter id narrowing
- escape-hatch merge behavior
- invalid config rejection

### Runtime tests

- inferred key validation
- inferred FK validation
- false-positive FK exclusion
- bridge detection
- embedded-array association validation
- hidden lookup materialization behavior
- expanded-grain materialization behavior once added

### Scenario regression tests

Create one stable regression test for each scenario in
[data-model-scenarios.md](/home/matth/projects/maintained/chart-studio/documentation/data-model-scenarios.md):

- flat
- star schema
- normalized bridge
- normalized embedded arrays
- missing edge mapping failure

## Playground Acceptance

The implementation is not complete until the playground demonstrates a real
happy-path win over the current explicit API.

### Required playground outcome

Add one new playground example that uses `createDashboard(...)` and shows a
dashboard that would currently require noticeably more ceremony with the
explicit model API.

The example should demonstrate at least:

- multiple datasets passed directly into the inferred dashboard API
- at least one lookup-style relationship inferred automatically
- at least one chart that uses a column from another dataset through inferred
  traversal, for example `owner.name`
- shared dashboard behavior that becomes available because the relationship was
  inferred rather than manually declared

### Example quality bar

The playground example should be intentionally simple to read.

It should prove that the inferred API is worth having because the same behavior
would be much noisier with:

- manual `defineDataModel(...)`
- manual `relationship(...)`
- manual `attribute(...)`
- manual lookup materialization

The example should highlight the ergonomic improvement, not just restate the
explicit model in a slightly different syntax.

## Non-Goals

These should stay out of scope unless the explicit core changes first.

- freeform query planning
- arbitrary graph search through the model
- guessing many-to-many edges from weak signals
- moving relationship traversal into `useChart(...)`
- global column overrides across datasets
- silently surfacing every possible shared filter in the UI by default

## Recommended Shipping Order

1. `createDashboard(...)` compiler shell
2. dataset-level column customization
3. inferred `id` keys and lookup relationships
4. inferred shared-filter candidates
5. inferred lookup path resolution
6. inferred associations for filtering
7. expanded-grain chart support
8. convergence polish and migration docs

## Final Recommendation

The implementation should optimize for one principle:

Start with the smallest amount of safe inference that removes obvious
boilerplate, then reuse the explicit core everywhere else.

That means:

- infer registration
- infer obvious scalar types
- infer obvious lookup relationships
- infer obvious shared-filter candidates
- infer many-to-many only when real edge data exists
- keep grain-changing chart behavior staged and observable

If this discipline is maintained, the inferred API can become dramatically more
ergonomic without turning chart-studio into a hidden query engine.
