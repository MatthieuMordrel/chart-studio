# chart-studio

Headless, composable charting for React with an optional batteries-included UI layer.

GitHub repository: `MatthieuMordrel/chart-studio`  
npm package: `@matthieumordrel/chart-studio`

Built on top of **Recharts**. Works with **shadcn/ui** themes out of the box.

## Install

```bash
bun add @matthieumordrel/chart-studio
```

## Quick Start

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio/core'
import {Chart, ChartToolbar, ChartCanvas} from '@matthieumordrel/chart-studio/ui'

const jobColumns = [
  columns.date<Job>('dateAdded', {label: 'Date Added'}),
  columns.category<Job>('ownerName', {label: 'Consultant'}),
  columns.boolean<Job>('isOpen', {trueLabel: 'Open', falseLabel: 'Closed'}),
  columns.number<Job>('salary', {label: 'Salary'}),
]

function MyChart({data}: {data: Job[]}) {
  const chart = useChart({data, columns: jobColumns})

  return (
    <Chart chart={chart}>
      <ChartToolbar />
      <ChartCanvas height={300} />
    </Chart>
  )
}
```

## Architecture

### Two layers

- **Core (headless)** — `useChart`, column definitions, and the pure data pipeline
- **UI (composable)** — `<Chart>`, `<ChartToolbar>`, `<ChartCanvas>`, and granular controls
- **Subpath imports** — use `@matthieumordrel/chart-studio/core` for the hook layer only, or `.../ui` for ready-made UI
- **Build output** — package exports point to compiled `dist/` files in this standalone repo

### Column types

| Type       | X-axis      | GroupBy      | Filter       | Metric          |
| ---------- | ----------- | ------------ | ------------ | --------------- |
| `date`     | time-series | -            | -            | -               |
| `category` | categorical | stacked bars | multi-select | -               |
| `boolean`  | categorical | 2 groups     | toggle       | -               |
| `number`   | -           | -            | -            | sum/avg/min/max |

### Chart type matrix

| X-axis           | Available charts |
| ---------------- | ---------------- |
| Date             | bar, line, area  |
| Category/Boolean | bar, pie, donut  |

### Capability rules

- `pie` and `donut` do not support `groupBy`
- enabling `groupBy` narrows the available chart types automatically
- chart type rules are centralized in `src/core/chart-capabilities.ts`

### Data pipeline

```
Raw data -> filter -> bucket by time -> pivot by groupBy -> aggregate -> sort
```

All pipeline stages are pure functions and independently testable.

### Multi-source support

```tsx
const chart = useChart({
  sources: [
    {id: 'jobs', label: 'Jobs', data: jobs, columns: jobColumns},
    {id: 'candidates', label: 'Candidates', data: candidates, columns: candidateColumns},
  ],
})
```

## Release

- `bun run release:check`
- `bun run release:publish -- --tag=latest`
- GitHub Actions release workflow: `.github/workflows/release.yml`

## Notes

- The npm scope is lowercase because npm package names are case-sensitive and must be URL-safe.
- Before the first public publish, add a license file that matches how you want to open-source the package.
