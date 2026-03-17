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

Requirements:

- `react` >= 18.2.0

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

Requirements:

- `react` >= 18.2.0
- `recharts` >= 3.0.0 (v2 is **not** supported)
- `lucide-react` >= 0.577.0 (optional, for toolbar icons)

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
2. Add an optional `schema` with either `defineChartSchema<Row>()...` or `defineDataset<Row>().chart(...)` when you need labels, type overrides, derived columns, or control restrictions (allowed metrics, groupings, chart types, etc.).
3. Either render your own UI from the returned state, or use the components from `@matthieumordrel/chart-studio/ui`.

## Stable Single-Chart Contract

For the simple case, the public contract is:

- `useChart({ data })` stays the zero-config path
- `useChart({ data, schema })` is the explicit single-chart path
- `defineChartSchema<Row>()` is the chart-first shortcut for that path
- `.columns(...)` is the authoring entry point: override raw fields, exclude fields, and add derived columns
- raw fields you do not mention in `.columns(...)` still infer normally unless you exclude them
- `xAxis`, `groupBy`, `filters`, `metric`, `chartType`, `timeBucket`, and `connectNulls` restrict that one chart's public controls
- `inputs` is an additive escape hatch for externally controlled data-scope state; it does not replace the simple `useChart({ data })` or `useChart({ data, schema })` path
- pass the builder directly to `useChart(...)`, or call `.build()` if you need the plain schema object

## Three Authoring Entry Points

### 1. Chart-first shortcut

Use `defineChartSchema<Row>()` when one chart owns its own explicit contract:

```tsx
const schema = defineChartSchema<Job>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.number('salary')
  ])
  .xAxis((x) => x.allowed('createdAt'))
  .metric((m) => m.aggregate('salary', 'sum'))

const chart = useChart({ data: jobs, schema })
```

This remains the simplest explicit path. Conceptually, it is the chart-first
shortcut over an anonymous one-off dataset.

### 2. Dataset-first reuse

Use `defineDataset<Row>()` when several charts should share one `.columns(...)`
contract and one optional declared key:

```tsx
import { defineDataset, useChart } from '@matthieumordrel/chart-studio'

const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.date('createdAt', { label: 'Created' }),
    c.number('salary', { format: 'currency' }),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary >= 100_000 ? 'High' : 'Base')
    })
  ])

const jobsByMonth = jobs
  .chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .groupBy((g) => g.allowed('salaryBand'))
  .metric((m) => m.count().aggregate('salary', 'sum'))

const chart = useChart({ data: jobsData, schema: jobsByMonth })
```

Rules for the dataset-first path:

- dataset `.columns(...)` is the canonical reusable meaning of columns
- `dataset.chart(...)` reuses the same chart-definition surface as `defineChartSchema(...)`
- `dataset.chart(...)` inherits dataset columns, so charts do not reopen `.columns(...)`
- declared dataset keys can be validated at runtime with `dataset.validateData(data)` or `validateDatasetData(dataset, data)`

### 3. Model-level linked data

Use `defineDataModel()` when linked datasets, relationships, associations, and
reusable shared-filter semantics need to be declared explicitly:

```tsx
import { defineDataModel } from '@matthieumordrel/chart-studio'

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('jobOwner', {
    from: { dataset: 'owners', key: 'id' },
    to: { dataset: 'jobs', column: 'ownerId' }
  })
  .association('jobSkills', {
    from: { dataset: 'jobs', key: 'id' },
    to: { dataset: 'skills', key: 'id' },
    data: jobSkillEdges,
    columns: {
      from: 'jobId',
      to: 'skillId'
    }
  })
  .attribute('owner', {
    kind: 'select',
    source: { dataset: 'owners', key: 'id', label: 'name' },
    targets: [
      { dataset: 'jobs', column: 'ownerId', via: 'jobOwner' }
    ]
  })

hiringModel.validateData({
  jobs: jobsData,
  owners: ownersData,
  skills: skillsData
})
```

Important limits of the current model layer:

- relationships are one public primitive: declared key -> foreign-key column
- many-to-many stays explicit through `association(...)`
- `validateData(...)` hard-fails on duplicate declared keys, orphan foreign keys, and malformed association edges
- charts still execute against one flat dataset at a time
- dashboard composition and shared filters now build on top of the model layer explicitly
- automatic denormalization and linked metrics do not exist yet

### 4. Dashboard composition

Use `defineDashboard(model)` when several reusable dataset-backed charts belong
to one dashboard:

```tsx
import {
  defineDashboard,
  useDashboard,
  useDashboardChart,
  DashboardProvider,
} from '@matthieumordrel/chart-studio'

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .chart('candidatesByStage', candidatesByStage)

function HiringOverview() {
  const dashboard = useDashboard({
    definition: hiringDashboard,
    data: {
      jobs: jobsData,
      owners: ownersData,
      candidates: candidatesData,
    },
  })

  const jobsChart = useDashboardChart(dashboard, 'jobsByMonth')

  return (
    <DashboardProvider dashboard={dashboard}>
      <Chart chart={jobsChart}>
        <ChartCanvas />
      </Chart>
    </DashboardProvider>
  )
}
```

Rules for dashboard composition:

- dashboard charts must come from `defineDataset<Row>().chart(...)`
- chart registration is explicit by id
- `useDashboardChart(...)` resolves the reusable chart by id and keeps React in charge of placement
- `useDashboardDataset(...)` exposes the globally filtered rows for non-chart consumers like KPI cards or tables

### 5. Shared dashboard filters

Shared dashboard filters layer on top of dashboard composition.

Reuse model-level relationship semantics when the same filter concept should
work across several dashboards:

```tsx
const dashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .sharedFilter('owner')
```

Add one-off dashboard-local filters when the concept is specific to one
dashboard:

```tsx
const dashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .sharedFilter('status', {
    kind: 'select',
    source: { dataset: 'jobs', column: 'status' },
  })
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      { dataset: 'jobs', column: 'createdAt' },
      { dataset: 'candidates', column: 'appliedAt' },
    ],
  })
```

Rules for shared dashboard filters:

- shared filters are explicit; nothing is guessed from chart configs
- shared filters narrow dataset slices before chart-local `useChart(...)` filters run
- local and global filters compose by intersection
- when a shared filter targets the same chart-local column, the dashboard owns that filter for that chart by default
- cross-dataset ambiguity requires an explicit model `attribute(...)` or explicit target choice

## Column Types

| Type       | What it is for                          |
| ---------- | --------------------------------------- |
| `date`     | time-series X-axis                      |
| `category` | categorical X-axis, grouping, filtering |
| `boolean`  | grouping, filtering                     |
| `number`   | metrics such as sum, avg, min, max      |

## Declarative Schema and Control Restrictions

If you want to expose only a subset of groupings, metrics, chart types, or axes, use the fluent `defineChartSchema<Row>()` builder:

```tsx
import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'

type Row = { periodEnd: string; segment: string; revenue: number; netIncome: number }

const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.date('periodEnd', { label: 'Period End' }),
    c.category('segment'),
    c.number('revenue'),
    c.number('netIncome')
  ])
  .xAxis((x) => x.allowed('periodEnd'))
  .groupBy((g) => g.allowed('segment'))
  .metric((m) =>
    m
      .count()
      .aggregate('revenue', 'sum', 'avg')
      .aggregate('netIncome', 'sum')
  )
  .chartType((t) => t.allowed('bar', 'line'))
  .timeBucket((tb) => tb.allowed('year', 'quarter', 'month'))

const chart = useChart({ data, schema })
```

Why this pattern:

- `columns` defines types, labels, and formats for raw fields; use `c.exclude(...)` to remove a column from the chart
- Derived columns use `c.derived.*(...)` helpers for computed values from each row
- `xAxis`, `groupBy`, `metric`, `chartType`, and `timeBucket` restrict the allowed options
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

const jobSchema = defineChartSchema<Job>()
  .columns((c) => [
    c.date('dateAdded', { label: 'Date Added' }),
    c.category('ownerName', { label: 'Consultant' }),
    c.number('salary', { label: 'Salary' })
  ])

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

## Common Questions

### Which import path should I use?

- Use `@matthieumordrel/chart-studio` for the headless core.
- Use `@matthieumordrel/chart-studio/ui` for the optional UI components.

### Do I need Recharts?

Only for the UI layer. The headless core works without it.

### Do I need Tailwind?

Only for the UI layer. The headless core does not require it.

### Can I use multiple datasets?

Yes, but there are two different meanings:

- `useChart({ sources: [...] })` is for source-switching within one chart
- `defineDataModel()` is for linked dataset metadata, validation, and reusable filter semantics outside the chart runtime
- `defineDashboard()` plus `useDashboard()` is for composing several reusable charts and optional shared dashboard filters

The current chart runtime still executes one flat dataset at a time. Multi-source
source-switching is separate from linked data models and from future dashboard
composition.

```tsx
import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'

const chart = useChart({
  sources: [
    {
      id: 'jobs',
      label: 'Jobs',
      data: jobs,
      schema: defineChartSchema<Job>()
        .columns((c) => [c.date('dateAdded', { label: 'Date Added' })])
    },
    { id: 'candidates', label: 'Candidates', data: candidates }
  ]
})
```

Each source may use either `defineChartSchema<Row>()` or
`defineDataset<Row>().chart(...)`. The chart still reads one active source at a
time, so this is not dashboard composition and not cross-dataset execution.

### Can outside state drive one chart's filters or date range?

Yes. Use `inputs` for externally controlled data-scope state:

```tsx
const chart = useChart({
  data: jobs,
  schema,
  inputs: {
    filters,
    onFiltersChange: setFilters,
    referenceDateId,
    onReferenceDateIdChange: setReferenceDateId,
    dateRange,
    onDateRangeChange: setDateRange
  }
})
```

Rules:

- `inputs` only covers data-scope state: filters, reference date, and date range
- presentation controls such as `xAxis`, `groupBy`, `metric`, and `chartType` stay chart-local
- `dateRange` is `{ preset, customFilter }`
- when an input is controlled, chart setters request changes through the matching callback
- `chart.filters` and related date state are always the sanitized effective state for the active source
- this still does not create a dashboard runtime or shared state between charts; use `defineDashboard()` for that

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

## On the Radar

These are known limitations and areas being considered for future versions. None of these are committed — they represent directions the library may grow based on real usage.

### Renderer flexibility

The UI layer currently only supports Recharts. If you want to use ECharts, Plotly, or another renderer, you can use the headless core but lose the built-in toolbar and canvas composition. A renderer adapter pattern for `<ChartCanvas>` could make the UI layer renderer-agnostic.

### Richer aggregation

The pipeline supports sum, avg, min, and max. Derived columns can access multiple fields of a single row (e.g. `row.revenue - row.cost`), but there is no support yet for metrics that depend on other rows or on aggregated results — things like "% of total", running totals, percentiles, or post-aggregation ratios (e.g. total revenue / total orders).

### Chart interactivity

There is currently no built-in support for drill-down, click-to-filter, brush selection, or linked charts. The headless state can be wired manually to achieve some of these, but first-class interactivity primitives would make this significantly easier.

### Multi-dataset composition

Dashboard composition and shared dashboard filters are now available, but each
chart instance still operates on one flat dataset at a time. Overlaying series
from different schemas (e.g. revenue on the left Y-axis and headcount on the
right) would require separate chart instances today. Dual-axis cross-dataset
execution, automatic denormalization, and linked metrics are not yet supported.

### Schema Builder Ergonomics

`defineChartSchema<Row>()` remains the simple chart-first shortcut, while
`defineDataset<Row>()` now owns the reusable `.columns(...)` contract. Both feed
the same chart-definition surface that you pass directly to `useChart(...)` or
`inferColumnsFromData(...)`.

## Release

- `bun run release:check`
- `bun run release:publish -- --tag=latest`
- `npm publish` runs `prepublishOnly`, which calls `bun run release:check`
