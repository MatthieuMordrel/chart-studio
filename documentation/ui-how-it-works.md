# How The UI Works

This file explains the optional UI layer in `chart-studio`.

## What the UI layer is

The UI layer is a set of ready-made React components built on top of the headless core.

Examples:

- `Chart`
- `ChartCanvas`
- `ChartToolbar`
- `ChartFilters`
- `ChartTypeSelector`
- `ChartDateRange`

These components do not create chart logic by themselves. They consume the `chart` object created by `useChart()`.

## The basic flow

The usual setup is:

1. Call `useChart()` in your component.
2. Pass the result into `<Chart chart={chart}>`.
3. Render any UI primitives inside that provider.

Example:

```tsx
const chart = useChart({data, columns})

return (
  <Chart chart={chart}>
    <ChartToolbar />
    <ChartCanvas />
  </Chart>
)
```

## What `<Chart>` does

`<Chart>` is the root UI provider.

Its main job is to share one chart instance with all nested UI components using React context.

That means children do not need to receive `chart` as a prop one by one.

## What `useChartContext()` does

`useChartContext()` reads the shared chart instance from the nearest `<Chart>` provider.

This lets UI components stay small and focused.

For example:

- `ChartCanvas` reads `transformedData`, `series`, and `chartType`
- `ChartFilters` reads available filters and active filters
- `ChartTypeSelector` reads and updates `chartType`

All of them work with the same shared state.

## Why the UI is split into many pieces

The UI is intentionally composable.

Instead of one giant "do everything" component, the package gives you small building blocks that can be arranged however you want.

That makes it easier to:

- build simple dashboards
- hide controls you do not need
- place controls in custom layouts
- mix built-in UI with custom components

## What `ChartCanvas` does

`ChartCanvas` is the renderer.

It reads the already-prepared chart state and chooses the correct Recharts component:

- `BarChart`
- `LineChart`
- `AreaChart`
- `PieChart`

It does not decide business logic like which rows are filtered or how values are aggregated. That work already happened in the core.

## Separation of responsibilities

A good way to think about the package is:

- core = logic
- UI = composition and rendering

More concretely:

- the core decides what data should be shown
- the UI decides how to present and control it

This separation keeps the system easier to reason about and easier to customize.

## Why the UI layer is optional

Not every consumer wants the same visual system.

Some people want:

- the ready-made toolbar and canvas
- only the renderer
- only the headless state
- a completely custom design

By keeping the UI optional, the package can support all of those cases.

## Short version

- `useChart()` creates the chart state
- `<Chart>` shares that state through context
- UI primitives read it with `useChartContext()`
- `ChartCanvas` renders the final chart
- the UI layer is convenience, not the source of truth
