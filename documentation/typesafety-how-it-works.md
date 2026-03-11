# How The Type Safety Works

This file explains what is strongly typed in `chart-studio`, what is only partly typed, and why.

## The good parts

The strongest type safety lives in the headless single-source path.

When you write:

```tsx
const chart = useChart({data, columnHints})
```

TypeScript can know:

- the row shape
- the literal column IDs
- which column IDs are valid for x-axis, filters, metrics, and date range functions

That means methods like these can be strongly typed:

- `setXAxis(...)`
- `setGroupBy(...)`
- `toggleFilter(...)`
- `clearFilter(...)`
- `setReferenceDateId(...)`
- `setMetric(...)`

This is the best developer experience in the package today.

## Why inferred column IDs matter so much

Type safety comes from the resolved column IDs.

If the data shape and `columnHints` are preserved, TypeScript can carry those exact IDs through the chart instance.

That is why `columnHints` are not just presentation overrides. They also shape the final typed chart API.

## What is still broad

Some parts stay intentionally broad today.

Examples:

- direct multi-source `useChart(...)` usage narrows by `activeSourceId`, but the shared UI context stays broad
- transformed output rows use dynamic string keys
- `SortConfig.key` is still just `string`
- the default UI context hook is broad

These are not accidents. They are places where the runtime behavior is more dynamic than the type system can describe cleanly without making the API much heavier.

## Why UI context is harder

The chart instance is strongly typed where it is created.

But once it is shared through React context, a plain zero-argument `useChartContext()` cannot automatically recover the exact provider generic from an arbitrary subtree.

So the problem is not:

- `useChart()`
- `<Chart chart={chart}>`

The problem is:

- `useChartContext()` inside descendants

This affects any chart, not only multi-source charts.

## Why multi-source is even harder

Multi-source adds a second problem on top of the React context issue.

The active source can change at runtime, which means these things can also change:

- row shape
- column IDs
- available metrics
- available filters

So for multi-source, the type challenge is not only "can TypeScript infer this?"

It is also:

"What is the honest type when the real schema can change while the app is running?"

## Current honest story

Today, the package is strongest here:

- single-source headless usage

It is acceptable here:

- single-source UI usage with explicit narrowing help

It is intentionally broader here:

- multi-source usage
- dynamic transformed output helpers
- zero-argument shared UI context

## Why not make everything perfectly typed

Because perfect types can make the public API much harder to use.

There is always a tradeoff between:

- precision
- simplicity
- runtime honesty
- maintainability

This package currently favors:

- strong types where they are high value and natural
- broader types where the runtime is truly dynamic
- avoiding fake precision that would require unsafe casts

## The good tradeoffs today

- Single-source charts feel good at the main `useChart()` entry point.
- Column IDs can stay literal.
- Most important mutation methods are typed.
- The headless API gives the best type experience.

## The bad tradeoffs today

- Type precision gets worse once data becomes more dynamic.
- UI context cannot magically infer the provider type across the component tree.
- Multi-source is flexible, but that flexibility widens types.
- Some output shapes are still string-key based rather than deeply modeled.

## Short version

- Best type safety: single-source `useChart({data, columnHints?})`
- Hardest area: shared UI context
- Broadest area: multi-source and dynamic output shapes
- Main rule: the package tries to be honest, not artificially precise
