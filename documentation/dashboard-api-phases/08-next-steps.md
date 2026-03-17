# Next Steps

This folder breaks the dashboard architecture into implementation phases.

The recommended working order is:

1. Phase 0: stabilize chart definitions
2. Phase 1: introduce datasets and optional keys
3. Phase 2: add linked data models, relationships, associations, and attributes
4. Phase 3: keep multi-source as source-switching for one chart
5. Phase 4: add controlled chart inputs before dashboards
6. Phase 5: add dashboard composition
7. Phase 6: add shared dashboard filters
8. Phase 7: add explicit materialized views and linked metrics

Phases 0 through 6 are now implemented. The immediate follow-up work starts at
Phase 7.

## Suggested Immediate Implementation Sequence

The highest-signal next steps are now:

1. Add explicit materialized views for flat multi-dataset analytic grains.
2. Define linked metrics on top of explicit materialization rather than hidden denormalization.
3. Improve dashboard shared-filter ergonomics only where real usage demands it.
4. Keep multi-source, dashboards, and materialized views clearly separated.

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
- shared dashboard filters stay explicit and additive

