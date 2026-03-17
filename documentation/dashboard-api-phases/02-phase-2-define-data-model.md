# Phase 2: Define Data Model

## Goal

Add `defineDataModel(...)` for linked datasets, explicit key-to-foreign-key
relationships, many-to-many associations, and reusable shared-filter
attributes.

## Why This Phase Exists

Relationships are not chart facts.

They belong in a model layer that dashboards, filters, and materialized views
can build on later.

## Scope

- `defineDataModel(...)`
- `.dataset(id, dataset)`
- `.relationship(...)` from declared key to foreign-key column
- reverse traversal derived from the same relationship
- `.association(...)` for many-to-many edge data
- `.attribute(...)` for reusable shared filter semantics
- runtime validation for declared dataset keys

## Out Of Scope

- dashboard runtime
- shared dashboard state
- linked metrics
- automatic denormalization

## Core Rules

- relationships are one public primitive: key -> foreign key
- direct public many-to-many relationships are avoided
- many-to-many uses `association(...)`
- declared keys should hard-fail at runtime if not unique

## Deliverables

- data-model builder
- key validation
- relationship validation
- association support for:
  - explicit edge rows
  - derived edge rows from source data
- reusable model-level attributes

## Exit Criteria

- linked data is explicit and type safe
- filter semantics can be defined on the model
- future dashboard phases have a real graph to build on

## Risks

- overcomplicating association syntax
- weak runtime validation around orphan or malformed edges
