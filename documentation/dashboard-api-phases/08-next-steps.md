# Next Steps

This folder breaks the dashboard architecture into implementation phases.

The recommended working order is:

1. Phase 0: stabilize chart definitions
2. Phase 1: introduce datasets and optional keys
3. Phase 2: add linked data models, relationships, associations, and attributes
4. Phase 4: add controlled chart inputs before dashboards
5. Phase 5: add dashboard composition
6. Phase 6: add shared dashboard filters
7. Phase 7: add explicit materialized views and linked metrics
8. Phase 3 can be revisited in parallel where useful, but should stay clearly separate from dashboards

Phases 0, 1, and 2 are now implemented. The immediate follow-up work starts at
Phase 3 and Phase 4.

## Suggested Immediate Implementation Sequence

The highest-signal next steps are now:

1. Revisit Phase 3 multi-source semantics on top of dataset-backed authoring.
2. Add controlled filter/date inputs to `useChart(...)` before dashboard composition.
3. Define how dashboard runtimes consume model `attribute(...)` semantics.
4. Keep materialization and linked metrics explicit in later phases.

## Questions To Resolve Before Coding Deeply

- exact shorthand syntax policy, for example whether `'owners.id'` should be allowed
- association API ergonomics for explicit data vs derived edge data
- `attribute(...)` ergonomics for simple vs complex cases
- materialized view naming and output key rules

## Success Condition

The architecture is successful if:

- simple single-chart usage stays simple
- reusable dataset modeling is explicit
- linked data is explicit and validated
- many-to-many remains visible instead of magical
- dashboards compose those layers rather than replacing them
