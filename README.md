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
- optional `schema` via `defineChartSchema`
- transformed chart data
- filtering, grouping, metrics, and time bucketing logic

Install:

```bash
bun add @matthieumordrel/chart-studio react
```

Import from:

```tsx
import { useChart } from '@matthieumordrel/chart-studio'
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

Then import the package theme once in your app stylesheet:

```css
@import 'tailwindcss';
@import '@matthieumordrel/chart-studio/ui/theme.css';
```

Import from:

```tsx
import { useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartToolbar, ChartCanvas } from '@matthieumordrel/chart-studio/ui'
```

## Smallest Working Example (Single Source)

```tsx
import { useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartToolbar, ChartCanvas } from '@matthieumordrel/chart-studio/ui'
import { data } from './data.json'

export function JobsChart() {
  const chart = useChart({ data })

  return (
    <Chart chart={chart}>
      <ChartToolbar />
      <ChartCanvas height={320} />
    </Chart>
  )
}
```

## How It Works

1. Pass your raw data to `useChart()`.
2. Add an optional `schema` with `defineChartSchema<Row>()(...)` when you need labels, type overrides, derived columns, or control restrictions (allowed metrics, groupings, chart types, etc.).
3. Either render your own UI from the returned state, or use the components from `@matthieumordrel/chart-studio/ui`.

## Column Types

| Type       | What it is for                          |
| ---------- | --------------------------------------- |
| `date`     | time-series X-axis                      |
| `category` | categorical X-axis, grouping, filtering |
| `boolean`  | grouping, filtering                     |
| `number`   | metrics such as sum, avg, min, max      |

## Declarative Schema and Control Restrictions

If you want to expose only a subset of groupings, metrics, chart types, or axes, use `defineChartSchema<Row>()()` with the control sections:

```tsx
import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'

type Row = { periodEnd: string; segment: string; revenue: number; netIncome: number }

const schema = defineChartSchema<Row>()({
  columns: {
    periodEnd: { type: 'date', label: 'Period End' },
    segment: { type: 'category' },
    revenue: { type: 'number' },
    netIncome: { type: 'number' }
  },
  xAxis: { allowed: ['periodEnd'] },
  groupBy: { allowed: ['segment'] },
  metric: {
    allowed: [
      { kind: 'count' },
      { kind: 'aggregate', columnId: 'revenue', aggregate: ['sum', 'avg'] },
      { kind: 'aggregate', columnId: 'netIncome', aggregate: 'sum' }
    ]
  },
  chartType: { allowed: ['bar', 'line'] },
  timeBucket: { allowed: ['year', 'quarter', 'month'] }
})

const chart = useChart({ data, schema })
```

Why this pattern:

- `columns` defines types, labels, and formats for raw fields; use `false` to exclude a column from the chart
- Derived columns use `{ kind: 'derived', type, label?, accessor, format? }` for computed values from each row
- `xAxis`, `groupBy`, `metric`, `chartType`, `timeBucket` restrict the allowed options
- invalid column IDs and config keys are rejected at compile time
- metric restrictions preserve the order you declare, so the first allowed metric becomes the default

## Headless Example

If you want to render your own UI or your own charting library, use only the core state:

```tsx
import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'

type Job = {
  dateAdded: string
  ownerName: string
  salary: number
}

const jobSchema = defineChartSchema<Job>()({
  columns: {
    dateAdded: { type: 'date', label: 'Date Added' },
    ownerName: { type: 'category', label: 'Consultant' },
    salary: { type: 'number', label: 'Salary' }
  }
})

export function JobsChartHeadless({ data }: { data: Job[] }) {
  const chart = useChart({ data, schema: jobSchema })

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

The `ui` layer is Tailwind-based and uses semantic classes such as:

- `bg-background`
- `text-foreground`
- `border-border`
- `bg-popover`
- `text-muted-foreground`

For those classes to render correctly, Tailwind needs real values behind tokens like `background`, `foreground`, `border`, and `popover`.

You can use `ui` in two ways:

### 1. Recommended: import the built-in theme

This is the easiest setup:

```css
@import 'tailwindcss';
@import '@matthieumordrel/chart-studio/ui/theme.css';
```

This does three things for you:

- Tailwind utilities for the package components
- automatic scanning of the package UI classes
- default fallback values for all semantic UI tokens
- built-in light and dark default themes

If your app already defines matching shadcn-style variables, those values take over automatically. If not, the built-in defaults are used.

The shipped theme supports dark mode through either:

- `.dark`
- `[data-theme="dark"]`

### 2. Advanced: define everything yourself

If you do not want to import `@matthieumordrel/chart-studio/ui/theme.css`, you can provide all the required semantic tokens yourself in your app theme.

If neither of those is true, use the headless core and render your own controls.

### Minimum UI theme contract

You do not need shadcn itself to use `@matthieumordrel/chart-studio/ui`.

If you import `@matthieumordrel/chart-studio/ui/theme.css`, every token below gets a built-in fallback automatically.

If your app already defines some of these variables, your values override the defaults for those specific tokens only. Missing ones still fall back to the package defaults.

These are the tokens currently expected by the UI layer:

| Token                | Purpose                                |
| -------------------- | -------------------------------------- |
| `background`         | control backgrounds and input surfaces |
| `foreground`         | primary text                           |
| `muted`              | subtle backgrounds and hover states    |
| `muted-foreground`   | secondary text and icons               |
| `border`             | outlines and separators                |
| `popover`            | dropdowns and floating panels          |
| `popover-foreground` | popover text color                     |
| `primary`            | selected and active states             |
| `primary-foreground` | text on filled primary surfaces        |
| `ring`               | focus-visible ring color               |

Minimal example:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --border: 214.3 31.8% 91.4%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --ring: 221.2 83.2% 53.3%;
}
```

How this works in practice:

- import `ui/theme.css` and do nothing else: the package uses its own defaults
- toggle dark mode with either `.dark` or `[data-theme="dark"]`: the package uses its built-in dark defaults
- import `ui/theme.css` and define only a few variables: your values win for those variables, defaults cover the rest
- skip `ui/theme.css`: you must define the whole token contract yourself

That makes the package usable out of the box while still being easy to theme.

### Optional chart color tokens

Chart series colors also support shadcn-style chart variables:

| Token     | Purpose             |
| --------- | ------------------- |
| `chart-1` | first series color  |
| `chart-2` | second series color |
| `chart-3` | third series color  |
| `chart-4` | fourth series color |
| `chart-5` | fifth series color  |

These are also optional when you import `ui/theme.css`.

If your app defines `--chart-1` through `--chart-5`, those colors are used automatically.

If they are not defined, `chart-studio` falls back to a built-in OKLCH palette, with separate light and dark defaults. That is why you may see blue, rose, cyan, or other fallback colors in charts when your app does not provide chart variables.

Minimal example:

```css
:root {
  --chart-1: 221.2 83.2% 53.3%;
  --chart-2: 262.1 83.3% 57.8%;
  --chart-3: 24.6 95% 53.1%;
  --chart-4: 142.1 76.2% 36.3%;
  --chart-5: 346.8 77.2% 49.8%;
}
```

## Compatibility

- `react`: `>=18.2.0 <20`
- `recharts`: `>=2.15.4 <3` for the UI layer
- `lucide-react`: `>=0.577.0 <1` for the UI layer

## Common Questions

### Which import path should I use?

- Use `@matthieumordrel/chart-studio` for the headless core.
- Use `@matthieumordrel/chart-studio/ui` for the optional UI components.

### Do I need Recharts?

Only for the UI layer. The headless core works without it.

### Do I need Tailwind?

Only for the UI layer. The headless core does not require it.

### Can I use multiple datasets?

Yes:

```tsx
import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'

const chart = useChart({
  sources: [
    {
      id: 'jobs',
      label: 'Jobs',
      data: jobs,
      schema: defineChartSchema<Job>()({
        columns: { dateAdded: { type: 'date', label: 'Date Added' } }
      })
    },
    { id: 'candidates', label: 'Candidates', data: candidates }
  ]
})
```

### What chart types are available?

- date X-axis: `bar`, `line`, `area`
- category or boolean X-axis: `bar`, `pie`, `donut`
- `pie` and `donut` do not support `groupBy`

## Troubleshooting

### The UI looks mostly unstyled

If the components render but look plain, compressed, or layout incorrectly, the most common cause is that the package theme file is not imported.

Start with:

```css
@import 'tailwindcss';
@import '@matthieumordrel/chart-studio/ui/theme.css';
```

If you are importing the package source directly in a local playground or monorepo, make sure Tailwind is scanning those source files too.

If your app already uses shadcn-style tokens, also make sure tokens such as `background`, `foreground`, `muted`, `border`, `popover`, `primary`, `ring`, and optionally `chart-1` through `chart-5` are defined in your theme.

## Release

- `bun run release:check`
- `bun run release:publish -- --tag=latest`
- `npm publish` runs `prepublishOnly`, which calls `bun run release:check`
