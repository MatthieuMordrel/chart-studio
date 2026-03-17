# Model-First Dashboard Inference Implementation Prompt

Implement the model-first dashboard inference plan described in:

- `/home/matth/projects/maintained/chart-studio/documentation/model-first-dashboard-inference-plan.md`

This is an implementation task, not a design exploration. Read the plan first,
then inspect the current implementation before making changes.

## Goal

Replace the current public-center-of-gravity around `createDashboard(...)` with
a clean model-first implementation that preserves as much of its safe inference
value as possible while keeping the runtime architecture honest and the typing
strong.

The target direction is:

1. `defineDataModel(...)` owns safe inference
2. model-aware charts allow safe lookup-preserving cross-dataset fields
3. `defineDashboard(model)` stays a thin composition layer
4. `useDashboard(...)` remains the runtime boundary
5. `createDashboard(...)` becomes a wrapper / compatibility layer over the new
   internals, not the main source of truth

## Non-negotiable constraints

- Do not take shortcuts that weaken type safety for the main API.
- Do not introduce a second runtime execution engine for charts.
- Do not move arbitrary joins into `useChart(...)`.
- Do not turn `defineDashboard(...)` into a model-definition kitchen sink.
- Do not keep duplicated public APIs alive if the duplication is unnecessary.
- Organize new code into coherent internal modules instead of growing one giant
  file.
- Prefer explicit internal compiler phases over ad hoc branching.
- Keep the repo clean by removing obsolete code paths once the new structure is
  in place.

## Primary objectives

Maximize all of these at once:

- type safety
- ergonomics
- performance
- composability
- power / expressiveness
- clarity of mental model
- progressive disclosure from simple to advanced use cases

When there is tension:

- preserve correctness and type safety first
- preserve runtime honesty second
- preserve ergonomics third

## Existing code to study first

Read these before changing anything:

- `/home/matth/projects/maintained/chart-studio/documentation/model-first-dashboard-inference-plan.md`
- `/home/matth/projects/maintained/chart-studio/documentation/dashboard-authoring-direction.md`
- `/home/matth/projects/maintained/chart-studio/documentation/inferred-dashboard-api.md`
- `/home/matth/projects/maintained/chart-studio/documentation/data-model-scenarios.md`
- `/home/matth/projects/maintained/chart-studio/documentation/dashboard-api-suggestion.md`

Inspect these implementation files carefully:

- `/home/matth/projects/maintained/chart-studio/src/core/define-data-model.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/data-model.types.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/define-dashboard.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/dashboard.types.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/define-dataset.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/dataset-builder.types.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/create-dashboard.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/use-dashboard.tsx`
- `/home/matth/projects/maintained/chart-studio/src/core/use-chart.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/materialized-view.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/materialized-view.types.ts`

Inspect the relevant tests and type tests:

- `/home/matth/projects/maintained/chart-studio/src/core/dashboard.test.tsx`
- `/home/matth/projects/maintained/chart-studio/src/core/create-dashboard.test.tsx`
- `/home/matth/projects/maintained/chart-studio/src/core/dataset-model.test.tsx`
- `/home/matth/projects/maintained/chart-studio/src/core/dashboard.typecheck.ts`
- `/home/matth/projects/maintained/chart-studio/src/core/create-dashboard.typecheck.ts`

Also inspect the playground examples and update them by the end:

- typed dashboard example
- inferred dashboard example

The playground should reflect the new API shape after the implementation is
done.

## API target

Implement the plan’s intended shape, including these core ideas.

### 1. Safe inference belongs on the data model

The model should support safe inference of:

- obvious keys where appropriate and honest
- obvious one-to-many relationships
- reusable shared-filter attribute candidates / inferred attributes

Inference should be typed, not just runtime-only.

Inference should be conservative.

Ambiguous or unsafe cases must require explicit configuration.

### 2. Datasets may be defined inline in the model

This should work cleanly:

```ts
const model = defineDataModel()
  .dataset('jobs', defineDataset<Job>()
    .key('id')
    .columns((c) => [
      c.date('createdAt'),
      c.category('status'),
      c.number('salary'),
    ]))
  .dataset('owners', defineDataset<Owner>()
    .key('id')
    .columns((c) => [
      c.category('name', {label: 'Owner'}),
    ]))
  .infer({
    relationships: true,
    attributes: true,
  })
```

Do not require users to repeat `c.field('id')` when `.key('id')` already
declares row identity.

Do not require users to repeat inferred FK fields like `ownerId` in
`.columns(...)` unless they are overriding metadata or intentionally exposing
that field in the chart contract.

Omitting a raw field from `.columns(...)` must not mean the same thing as
explicit exclusion.

### 3. Charts that need safe lookup fields should be model-aware

Implement a model-aware fluent chart authoring path that keeps the current
builder ergonomics:

```ts
const jobsByOwner = model.chart('jobsByOwner', (chart) =>
  chart
    .from('jobs')
    .xAxis((x) => x.allowed('createdAt', 'owner.name').default('owner.name'))
    .metric((m) =>
      m
        .count()
        .aggregate('salary', 'avg')
        .defaultAggregate('salary', 'avg'))
    .filters((f) => f.allowed('status', 'owner.region'))
    .chartType((t) => t.allowed('bar', 'line').default('bar'))
)
```

Requirements:

- keep the fluent builder shape
- keep usage-specific narrowing for x-axis / metric / filters / group-by
- allow safe one-hop lookup-preserving fields like `owner.name`
- do not allow grain-changing traversal implicitly
- compile into the existing explicit runtime core

### 4. `defineDashboard(model)` stays thin

The dashboard layer should remain about:

- chart composition
- chart registration
- shared filter selection
- dashboard-specific shared filters when needed

It should not own:

- model inference
- association inference
- materialization
- relationship declaration

### 5. `createDashboard(...)` becomes a wrapper

Preserve convenience where possible, but rebase it on the new internals.

`createDashboard(...)` should no longer be the place where the real inference
logic lives.

It should compile through:

- inferred / explicit model construction
- model-aware chart compilation
- dashboard composition

## Safe inference boundaries

Keep these boundaries strict.

### Safe to infer

- one-hop lookup relationships in star-schema / lookup-style structures
- inferred relationship-backed shared filter attributes
- lookup field paths that preserve the base dataset grain

### Must remain explicit

- many-to-many association setup
- derived association rules
- row-expanding traversal
- materialized chart grains
- ambiguous relationships
- arbitrary key guessing from heuristics
- business semantics such as labels, formatting, and derived columns

Do not overreach in the first implementation.

## Implementation strategy

Follow a phased implementation inside this task, even if you complete multiple
phases in one pass.

### Phase A: Extract reusable internals

Refactor the current `createDashboard(...)` logic into reusable internal modules.

Likely extraction areas:

- relationship inference
- relationship indexing / ambiguity handling
- lookup path resolution
- inferred attribute generation
- hidden lookup-preserving view compilation
- inferred relationship validation error rewriting

The purpose is to stop having the inference logic trapped in one monolithic
public API file.

### Phase B: Add model inference

Add a typed `.infer(...)` capability to `defineDataModel(...)`.

Implement only what is safe and supportable now.

If needed, start with:

- `relationships: true`
- `attributes: true`
- `exclude: [...]`

Ensure inferred relationships and inferred attributes appear in the model type so
downstream APIs can stay type-safe.

### Phase C: Add model-aware charts

Implement a chart authoring surface on the model that:

- selects a base dataset
- exposes direct and safe lookup-preserving fields
- narrows by usage
- compiles to dataset-backed charts or explicit hidden lookup-projection views

Do not bolt this onto the dashboard builder.

### Phase D: Rewire dashboard composition

Make sure `defineDashboard(model)` can compose the new model-aware charts
without taking on model concerns.

### Phase E: Rebase `createDashboard(...)`

Keep it working, but make it consume the new implementation layers rather than
duplicating them.

## Code organization expectations

- Split internal compiler logic into focused files if the code gets large.
- Prefer small, composable helpers over expanding `create-dashboard.ts` or
  `define-data-model.ts` into even larger god files.
- Keep public types and runtime implementation aligned.
- Avoid introducing placeholder abstractions that do not actually reduce
  complexity.
- Add concise comments only where the logic would otherwise be hard to follow.

## Testing requirements

Update and extend tests as part of the implementation.

At minimum, cover:

- inline dataset definitions inside `defineDataModel(...)`
- inferred relationships on the model
- inferred shared-filter attributes on the model
- dashboard `sharedFilter(...)` typing from inferred attributes
- model-aware chart typing for safe lookup fields
- runtime validation failures for bad inferred relationships
- explicit materialization remaining required for grain-changing cases
- `createDashboard(...)` compatibility behavior after rebasing

Update both runtime tests and type tests where relevant.

Do not leave the implementation in a state where types only work through `any`
casts or untested assumptions.

## Playground updates

Update the playground examples to reflect the new intended API shape.

Specifically update:

- the typed dashboard example to use the new model-first API
- the inferred dashboard example to reflect the new inference location and shape

Do this after the core implementation is correct.

Priority order:

1. clean implementation
2. tests and type tests
3. playground examples

## Cleanup requirements

Do not stop after “it works”.

Before finishing:

- remove obsolete or now-unused helper code
- remove dead branches from the old implementation if they are no longer needed
- collapse duplicated inference logic so there is one source of truth
- remove stale exports if they are no longer appropriate
- update docs and examples that would otherwise describe the old primary API
- make sure the repo does not end in a half-migrated dirty state with both old
  and new implementations doing the same job unnecessarily

If some compatibility layer must remain temporarily, keep it intentionally thin
and clearly structured.

## Delivery expectations

When done:

- the core implementation should be clean and organized
- tests and type tests should pass
- the playground should reflect the new API shape
- unnecessary old code should be removed or reduced to a deliberate wrapper

Do not optimize for a small diff. Optimize for a correct, maintainable
implementation that matches the plan.
