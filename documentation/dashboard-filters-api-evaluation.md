# Dashboard Filters API Evaluation

This note captures whether the current API can evolve from single-chart usage to dashboard usage where filters are shared across multiple views.

## Short Answer

Yes.

The current design is compatible with centralized dashboard filters, and it can get there without losing the ergonomic single-chart story.

The main reason is that filtering is already modeled as explicit headless state and applied through pure data transformations. That is a strong foundation for making filters reusable across multiple consumers, not just one chart.

## What Already Works Well

- The filtering model is simple and composable.
- Filter state is headless rather than hard-coded into a visual component.
- Date range filtering is already a separate concern from chart display concerns.
- `schema.filters` already gives a clean way to declare which columns are filterable.
- Derived columns in `schema.columns` provide a path to normalize different datasets to shared semantic filter ids.

This means the system already leans toward:

- per-chart visualization state
- reusable filtering state

That is the right direction for dashboards.

## Can Filters Power More Than Charts?

Yes.

If filters become shared dashboard state, they can drive anything that depends on the same filtered dataset, not only charts.

Examples:

- KPI cards
- summary stats
- tables
- lists
- badges
- custom React components
- external visualizations not managed by this library

This is an important confirmation: filters should be understood as data-scope controls, not chart-only controls.

In other words, a dashboard-level filter model should be able to feed:

- chart components from this library
- card components outside this library
- any custom derived view built by the application

That makes the filtering layer more valuable and avoids making charts the only first-class dashboard citizen.

## Separation Of Concerns

The cleanest model is:

- per-chart concerns stay local to each chart
- filters can be either local or shared

Per-chart concerns should remain:

- sorting
- metric
- groupBy
- xAxis
- chartType
- timeBucket

These control how one chart presents data, not how the dashboard defines the active slice of data.

Filter concerns can reasonably exist at two levels:

- local chart filters for standalone or embedded single-chart usage
- global dashboard filters for coordinated multi-view experiences

That split keeps the API honest and preserves good ergonomics.

## Best Path Forward

The best path is additive, not a rewrite.

Keep the current single-chart API as the default uncontrolled experience:

```ts
const chart = useChart({ data, schema })
```

Then add optional controlled support for the reusable filtering layer:

- `filters`
- `onFiltersChange`
- `dateRangeFilter`
- `onDateRangeFilterChange`
- possibly `referenceDateId`
- possibly `onReferenceDateIdChange`

This gives two clean modes:

### 1. Single-chart mode

Use `useChart()` exactly as today.

- zero extra ceremony
- filters remain local
- best ergonomic path for simple usage

### 2. Dashboard mode

Lift shared filter state into a parent container or dashboard helper.

Then pass that shared state into multiple charts.

That allows:

- several charts reacting to the same filters
- cards and summaries reacting to the same filters
- local chart presentation settings staying independent

## Why This Is The Right Direction

This approach keeps the current strengths:

- simple single-chart authoring
- strong separation between headless state and UI
- schema-driven narrowing and normalization

And it adds dashboard support without forcing every user into a dashboard-shaped API.

That is important because dashboards are a more advanced composition case, not the only use case.

## Important Requirement For Shared Filters

The best shared-filter contract is not raw field names.

It should be shared semantic column ids.

For example, different datasets might expose:

- `region`
- `salesRegion`
- `customerRegion`

If those all need to respond to one dashboard filter, each chart schema should map them to the same semantic id or derived column shape where appropriate.

That is where the current schema and derived-column design already helps.

## Recommendation

Recommended product direction:

1. Keep chart presentation controls local to each chart.
2. Treat filters as reusable data-scope state.
3. Support both local and controlled shared filter modes.
4. Let dashboards compose shared filters across charts, cards, and any other consumer.
5. Use schema-defined semantic column ids as the long-term contract for cross-view filtering.

## Final Conclusion

The API is on a good path for dashboards.

It does not yet provide the seamless shared-filter experience out of the box, because `useChart()` currently owns filter state internally.

But the design is close: the missing step is mainly to add a controlled filtering mode while preserving the current uncontrolled single-chart mode.

That gives the best of both worlds:

- excellent ergonomics for one chart
- a clear path to centralized dashboard filters
- reuse of filters for cards and any other non-chart dashboard component
