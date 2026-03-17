# Phase 2: Define Data Model

## Goal

Add `defineDataModel(...)` for linked datasets, explicit key-to-foreign-key
relationships, many-to-many associations, reusable shared-filter attributes,
and runtime validation over the registered model graph.

## Why This Phase Exists

Relationships are not chart facts.

They belong in a model layer that later dashboard phases can build on without
leaking dashboard concerns into single-chart or dataset APIs.

## Implemented Contract

- `defineDataModel(...)`
- `.dataset(id, dataset)`
- `.relationship(id, {from: {dataset, key}, to: {dataset, column}})`
- reverse traversal metadata derived from the same relationship
- `.association(...)` for many-to-many edge data
- `.attribute(...)` for reusable shared filter semantics
- `model.validateData({...})` for runtime validation

## Locked Rules

- relationships are one public primitive: declared key -> foreign-key column
- reverse traversal is derived automatically from the same public relationship
- direct public many-to-many relationships are avoided
- many-to-many uses `association(...)`
- declared dataset keys hard-fail at runtime if they are missing or not unique
- model validation also hard-fails on orphan foreign keys and orphan association edges
- charts still execute against one flat dataset at a time

## Example

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
    data: jobSkillEdges,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
    ],
  })

hiringModel.validateData({
  jobs: jobRows,
  owners: ownerRows,
  skills: skillRows,
})
```

## Runtime Validation Scope

`model.validateData(...)` currently validates:

- every registered dataset payload exists
- declared dataset keys are present and unique
- relationship foreign keys reference a real declared key value
- explicit association edge rows reference real keys on both endpoints
- derived association values resolve to real keys on the far side

## Deferred

- dashboard runtime
- shared dashboard state
- linked metrics
- automatic denormalization
- relationship-path execution inside `useChart(...)`

## Risks / Unresolved

- relationships and associations currently require exactly one declared key column per endpoint; composite-key traversal remains deferred
- attributes are stored as reusable model semantics today, but later phases still need to define how dashboard and materialization runtimes consume them
