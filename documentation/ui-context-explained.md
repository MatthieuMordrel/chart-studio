# UI Context Explained

This note explains `useChartContext()` in plain language.

## Where `useChartContext()` comes from

`useChartContext()` is exported from the optional UI package:

- package path: `@matthieumordrel/chart-studio/ui`
- source file: `src/ui/chart-context.tsx`

It is part of the UI layer, not the headless core.

## What problem it solves

The chart UI is made of many small components:

- `ChartCanvas`
- `ChartToolbar`
- `ChartFilters`
- `ChartTypeSelector`
- `ChartDateRange`

All of those components need access to the same chart state:

- current chart type
- selected x-axis
- active filters
- visible data
- available metrics

Without context, every parent component would need to pass the `chart` object down manually through props.

That would look like this idea:

```tsx
<ChartToolbar chart={chart} />
<ChartCanvas chart={chart} />
<ChartFilters chart={chart} />
```

React context is a built-in way to avoid that "prop drilling".

## The simple mental model

Think of context as a shared backpack.

- `<Chart chart={chart}>` puts the chart instance into the backpack.
- Any UI component inside `<Chart>` can read from that backpack.
- `useChartContext()` is the hook that opens the backpack.

So this:

```tsx
const chart = useChart({data, columnHints})

return (
  <Chart chart={chart}>
    <ChartToolbar />
    <ChartCanvas />
  </Chart>
)
```

means:

1. `useChart()` creates the chart state.
2. `<Chart>` makes that state available to all children.
3. `ChartToolbar` and `ChartCanvas` call `useChartContext()` to read it.

## Why `<Chart>` exists

`<Chart>` is mostly a provider.

Its job is not to render the data visualization itself. Its main job is to make one shared chart instance available to all nested UI primitives.

So:

- `useChart()` creates the chart
- `<Chart>` shares the chart
- `useChartContext()` reads the shared chart

## Why not just use props everywhere

You could, but it gets annoying fast.

Imagine a custom layout:

```tsx
<Chart chart={chart}>
  <Header>
    <ChartTypeSelector />
  </Header>
  <Sidebar>
    <ChartFilters />
  </Sidebar>
  <Main>
    <ChartCanvas />
  </Main>
</Chart>
```

With context, each child can read the same chart instance directly.

Without context, every layer in between would need to receive `chart` and forward it again, even if that layer does not use it.

## Why this matters for typing

The chart is strongly typed when `useChart()` creates it.

Example:

```tsx
const chart = useChart({data, columnHints})
```

At that moment, TypeScript knows:

- the row shape
- the valid column IDs
- which methods accept which values

The difficult part starts when that typed value goes through shared React context.

## Why `useChartContext()` is hard to type perfectly

TypeScript is good at following types inside normal function calls.

It is not good at saying:

"This hook is inside that specific provider above it, so infer the exact generic type from that provider."

That is the core problem.

So for this code:

```tsx
const chart = useChart({data, columnHints})

return (
  <Chart chart={chart}>
    <MyCustomChild />
  </Chart>
)
```

inside `MyCustomChild`, a plain zero-argument `useChartContext()` cannot automatically know the exact generic type of `chart` just from the provider above it.

## Single-source vs multi-source

### Single-source

Single-source charts have one stable schema:

- one row shape
- one set of column IDs

So typed narrowing is possible, because the schema does not change while the chart is running.

### Multi-source

Multi-source charts are harder because the active source can change at runtime.

That means all of these can change:

- row shape
- column IDs
- available metrics
- available filters

So multi-source is not just a TypeScript problem. It is also a real runtime shape-changing problem.

## Why `useChartContext()` exists anyway

Because the UI package needs a shared way for small composable UI pieces to work together.

If `useChartContext()` did not exist, the optional UI layer would be much clumsier to use.

Its purpose is:

- make the UI primitives composable
- avoid prop drilling
- let all chart UI pieces talk to the same chart instance

## Short version

- `useChartContext()` comes from the UI package.
- It reads the chart instance shared by `<Chart>`.
- It exists so UI components do not need the `chart` prop passed manually everywhere.
- The tricky part is not React itself. The tricky part is keeping perfect TypeScript generics through shared context.
- That issue exists for every chart, but multi-source is harder because the active schema can really change at runtime.
