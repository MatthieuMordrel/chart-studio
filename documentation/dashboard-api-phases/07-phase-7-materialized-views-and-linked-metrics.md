# Phase 7: Materialized Views

## Goal

Support flat cross-dataset analytic grains only when explicitly requested,
without weakening the existing chart-first API.

## Shipped contract

Phase 7 adds `model.materialize(id, (m) => ...)`.

The builder is intentionally small:

- `.from(datasetId)` chooses the base dataset
- `.join(alias, { relationship })` projects lookup columns while preserving the base grain
- `.throughRelationship(alias, { relationship })` explicitly expands one-to-many rows
- `.throughAssociation(alias, { association })` explicitly expands many-to-many rows
- `.grain(label)` is required and finalizes the view

The resulting view is reusable like a dataset:

- `.chart(...)`
- `.build()`
- `.validateData(...)`
- `.materialize(modelData)`

## Naming rules

Projected columns are prefixed from the traversal alias:

- `owner.name` becomes `ownerName`
- `owner.region` becomes `ownerRegion`
- `skill.name` becomes `skillName`

Lookup joins exclude the far-side key by default.

Row-expanding traversals always include the far-side key so the expanded grain
stays visible and keyable:

- `job-skill` -> `['id', 'skillId']`

## Behavioral rules

- materialization is explicit; there are still no hidden joins at chart render time
- a chart still runs against one flat row array
- many-to-many flattening stays explicit through `association(...)` plus `throughAssociation(...)`
- ambiguous traversal stays explicit because joins name the relationship or association directly
- related-table columns reuse existing dataset meanings instead of requiring repeated derived-column boilerplate
- caching is explicit at the view layer through repeated `materialize(modelData)` calls on the same input object

## Still out of scope

- automatic denormalization of all datasets
- freeform SQL-like query composition
- linked metric primitives beyond explicit materialized data

## Main remaining risks

- users can still create expensive or wide views if they over-materialize
- multiple row-expanding traversals in one view need a more deliberate product story before widening the API further
