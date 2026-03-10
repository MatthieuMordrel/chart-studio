# chart-studio

Headless, composable charting for React with an optional batteries-included UI layer.

GitHub repository: `MatthieuMordrel/chart-studio`  
npm package: `@matthieumordrel/chart-studio`

Built on top of **Recharts**. Works with **shadcn/ui** themes out of the box.

## Install

### Headless core only

```bash
bun add @matthieumordrel/chart-studio react
```

### Optional UI layer

If you want the ready-made UI components from `@matthieumordrel/chart-studio/ui`, install the UI peers too:

```bash
bun add @matthieumordrel/chart-studio react recharts lucide-react
```

## Quick Start

```tsx
import {useChart, columns} from '@matthieumordrel/chart-studio'
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

## Styling

The headless API has no styling requirements.

The optional UI layer assumes:

- Tailwind utility classes are available
- your design system exposes shadcn-style tokens such as `background`, `foreground`, `muted`, `border`, `popover`, `primary`, and `ring`

If you do not use Tailwind or these tokens, prefer the headless API and render your own controls and chart container.

## Compatibility

- `react`: `>=18.2.0 <20`
- `recharts`: `>=2.15.4 <3` for the UI layer
- `lucide-react`: `>=0.577.0 <1` for the UI layer

## Architecture

### Two layers

- **Core (headless)** — the package root exports `useChart`, column definitions, and the pure data pipeline
- **UI (composable)** — `@matthieumordrel/chart-studio/ui` exports `<Chart>`, `<ChartToolbar>`, `<ChartCanvas>`, and granular controls
- **Explicit subpaths** — `@matthieumordrel/chart-studio/core` remains available if you prefer an explicit headless-only import path
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
- `npm publish` is guarded by `prepublishOnly`, which runs `bun run release:check`
- GitHub Actions release workflow: `.github/workflows/release.yml`

## Notes

- The npm scope is lowercase because npm package names are case-sensitive and must be URL-safe.
- Before the first public publish, add a `LICENSE` file and a matching `license` field in `package.json`.
