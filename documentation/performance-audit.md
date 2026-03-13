# Performance Audit

This note is a short high-level audit of current and likely performance issues.

It is not a benchmark report and it is not a solution plan.

## Main Risk Areas

### Repeated per-chart data work

Each chart instance performs its own data preparation work.

As chart count grows, the same general kinds of work are repeated across charts:

- schema resolution
- column inference
- available filter extraction
- filtering
- aggregation
- sorting

This is likely acceptable for small usage, but it becomes a real concern for large dashboards.

### Main-thread pressure

The current model is centered on synchronous local computation in React-driven flows.

With larger datasets, this creates a risk of:

- delayed interactions
- visible UI stalls
- more expensive updates when several charts depend on the same data changes

### Dashboard cost scaling

A dashboard with many charts multiplies work.

Even when each chart is conceptually simple, the total cost can grow quickly because each chart computes its own resolved state and transformed data.

The risk increases when:

- several charts use the same dataset
- several charts react to the same shared filters
- several charts compute similar derived views independently

### Filter-related cost

Available filter options are data-driven, which means filter generation itself becomes part of the expensive path.

This creates two possible pressure points:

- scanning data to build filter option lists
- rendering large filter option sets in the UI

Dashboards amplify this because shared filter updates can cause several views to recompute.

### Broad rerender scope in UI composition

The current headless state is correct, but broad state containers can still cause wide rerender propagation.

This creates a potential issue where:

- one chart interaction updates a large state object
- many child UI pieces rerender together
- dashboard composition magnifies that cost

### Memo sensitivity

The current behavior depends heavily on React memoization boundaries.

This means performance can degrade when:

- parent components recreate option objects frequently
- several derived values invalidate together
- data and schema references are not stable enough to preserve memo reuse

### Multi-source switching cost

Multi-source charts are correct functionally, but source switching can still be expensive because each source carries its own resolved schema/column state and chart state has to be sanitized on transitions.

This is a smaller issue than full dashboard composition, but it is still a meaningful scaling concern.

## High-Level Conclusion

The main performance risks are not about one isolated React rerender.

They come from the combination of:

- repeated data computation
- main-thread synchronous work
- broad rerender surfaces
- dashboard-level multiplication of the same chart work

So the important concern is not only "React rendering performance".

It is the full interaction between:

- data preparation cost
- chart-state derivation cost
- shared dashboard updates
- UI rerender scope
