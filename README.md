# chart-studio

Composable charting for React with two adoption paths:

- use the **headless core** if you want chart state, filtering, grouping, and transformed data
- use the **optional UI layer** if you also want ready-made controls and a Recharts canvas

Package: `@matthieumordrel/chart-studio`

## Start Here

Choose the path that matches your app:

### 1. Headless core

Use this if you already have your own design system or chart renderer.

You get:

- `useChart`
- typed column helpers
- transformed chart data
- filtering, grouping, metrics, and time bucketing logic

Install:

```bash
bun add @matthieumordrel/chart-studio react
```

Import from:

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio'
```

### 2. Ready-made UI

Use this if you want the package to render the controls and chart for you.

You get:

- everything from the headless core
- `<Chart>`
- `<ChartToolbar>`
- `<ChartCanvas>`
- granular UI controls from `@matthieumordrel/chart-studio/ui`

Install:

```bash
bun add @matthieumordrel/chart-studio react recharts lucide-react
```

Import from:

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio'
import {Chart, ChartToolbar, ChartCanvas} from '@matthieumordrel/chart-studio/ui'
```

## Smallest Working Example

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio'
import {Chart, ChartToolbar, ChartCanvas} from '@matthieumordrel/chart-studio/ui'

type Job = {
  dateAdded: string
  ownerName: string
  isOpen: boolean
  salary: number
}

const jobColumns = [
  columns.date<Job>('dateAdded', {label: 'Date Added'}),
  columns.category<Job>('ownerName', {label: 'Consultant'}),
  columns.boolean<Job>('isOpen', {trueLabel: 'Open', falseLabel: 'Closed'}),
  columns.number<Job>('salary', {label: 'Salary'}),
]

export function JobsChart({data}: {data: Job[]}) {
  const chart = useChart({
    data,
    columns: jobColumns,
  })

  return (
    <Chart chart={chart}>
      <ChartToolbar />
      <ChartCanvas height={320} />
    </Chart>
  )
}
```

## How It Works

1. Define columns for the fields you want to chart.
2. Call `useChart()` with your data and columns.
3. Either render your own UI from the returned state, or use the components from `@matthieumordrel/chart-studio/ui`.

## Column Types

| Type       | What it is for                          |
| ---------- | --------------------------------------- |
| `date`     | time-series X-axis                      |
| `category` | categorical X-axis, grouping, filtering |
| `boolean`  | grouping, filtering                     |
| `number`   | metrics such as sum, avg, min, max      |

## Headless Example

If you want to render your own UI or your own charting library, use only the core state:

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio'

type Job = {
  dateAdded: string
  ownerName: string
  salary: number
}

const jobColumns = [
  columns.date<Job>('dateAdded', {label: 'Date Added'}),
  columns.category<Job>('ownerName', {label: 'Consultant'}),
  columns.number<Job>('salary', {label: 'Salary'}),
]

export function JobsChartHeadless({data}: {data: Job[]}) {
  const chart = useChart({data, columns: jobColumns})

  return (
    <div>
      <div>Chart type: {chart.chartType}</div>
      <div>Rows: {chart.transformedData.length}</div>
      <pre>{JSON.stringify(chart.transformedData, null, 2)}</pre>
    </div>
  )
}
```

## Styling Requirements

The headless core has no styling requirements.

The UI layer assumes:

- Tailwind utility classes are available
- your app exposes shadcn-style design tokens such as `background`, `foreground`, `muted`, `border`, `popover`, `primary`, and `ring`

If that does not match your app, use the headless core and render your own controls.

## Compatibility

- `react`: `>=18.2.0 <20`
- `recharts`: `>=2.15.4 <3` for the UI layer
- `lucide-react`: `>=0.577.0 <1` for the UI layer

## Common Questions

### Which import path should I use?

- Use `@matthieumordrel/chart-studio` for the headless core.
- Use `@matthieumordrel/chart-studio/ui` for the optional UI components.
- Use `@matthieumordrel/chart-studio/core` only if you prefer an explicit headless-only subpath.

### Do I need Recharts?

Only for the UI layer. The headless core works without it.

### Do I need Tailwind?

Only for the UI layer. The headless core does not require it.

### Can I use multiple datasets?

Yes:

```tsx
const chart = useChart({
  sources: [
    {id: 'jobs', label: 'Jobs', data: jobs, columns: jobColumns},
    {id: 'candidates', label: 'Candidates', data: candidates, columns: candidateColumns},
  ],
})
```

### What chart types are available?

- date X-axis: `bar`, `line`, `area`
- category or boolean X-axis: `bar`, `pie`, `donut`
- `pie` and `donut` do not support `groupBy`

## Troubleshooting

### The UI looks mostly unstyled

If the components render but look plain, compressed, or layout incorrectly, the most common cause is that Tailwind is not scanning the files from `@matthieumordrel/chart-studio/ui`.

This usually happens in local playgrounds, monorepos, or alias-based setups where your app imports the package source from outside the app folder.

For Tailwind v4, make sure your stylesheet includes the package source as a scan target:

```css
@import "tailwindcss";
@source "../path-to-chart-studio/src";
```

If your app already uses shadcn-style tokens, also make sure tokens such as `background`, `foreground`, `muted`, `border`, `popover`, `primary`, and `ring` are defined in your theme.

## Release

- `bun run release:check`
- `bun run release:publish -- --tag=latest`
- `npm publish` runs `prepublishOnly`, which calls `bun run release:check`
