# UI Context Typing

`chart-studio` is easy to type at the `useChart()` call site, but harder to keep typed through the optional UI layer.

## What is hard

The hard part is React context, not `useChart()`.

- `useChart({data, columnHints?})` knows the row type and resolved column IDs at the point where the chart instance is created.
- `<Chart chart={chart}>` can accept that typed instance without trouble.
- But a plain `useChartContext()` call inside an arbitrary descendant cannot automatically recover the generic type from the provider above it.

TypeScript does not infer a provider's generic type across a React subtree. Once the value goes through a normal shared context, the type usually has to become broader unless the consumer gives TypeScript some extra information.

## Why single-source and multi-source differ

Single-source charts have one stable schema, so typed narrowing is realistic.

Multi-source charts are harder because the active source can change at runtime:

- row shape can change
- valid column IDs can change
- metric and filter options can change

That means a strongly typed context for multi-source needs a different API shape, not just better annotations.

## Design tension

We want all of these at once:

- strong typing
- zero casts in normal usage
- a simple `<Chart>` / `useChartContext()` mental model
- honest behavior for multi-source

Today, we cannot get all four from a plain zero-argument context hook.

## Honest current direction

The current compromise is:

- keep `Chart` simple
- keep the default context broad and safe
- allow single-source consumers to recover strong typing with `useTypedChartContext()`
- keep multi-source broad until a dedicated typed API exists

This is honest, but it is not the same as a magically typed zero-argument `useChartContext()`.

## What would solve it fully

To make UI context strongly typed with no extra narrowing input, the package would likely need a different public API, such as a typed scope or factory that creates a chart-specific provider and hook pair.

That would improve type precision, but it would also make the API more complex.
