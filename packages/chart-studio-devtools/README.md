# @matthieumordrel/chart-studio-devtools

Visual devtools panel for [chart-studio](https://www.npmjs.com/package/@matthieumordrel/chart-studio). Renders an interactive graph of your data model — datasets, relationships, associations, materialized views — so you can inspect and debug your schema at a glance.

## Install

```bash
npm install @matthieumordrel/chart-studio-devtools --save-dev
```

Peer dependencies (must already be in your project):

- `@matthieumordrel/chart-studio`
- `@matthieumordrel/chart-studio-ui`
- `react` and `react-dom`
- `lucide-react`
- `tailwindcss`

## Usage

```tsx
import {defineDataModel, defineDataset} from '@matthieumordrel/chart-studio'
import {ChartStudioDevtools} from '@matthieumordrel/chart-studio-devtools/react'

const jobsDataset = defineDataset<{id: string; ownerName: string; salary: number}>()
  .key('id')
  .columns((c) => [
    c.field('id', {label: 'Job ID'}),
    c.category('ownerName', {label: 'Owner'}),
    c.number('salary', {label: 'Salary'}),
  ])

const model = defineDataModel()
  .dataset('jobs', jobsDataset)
  .build()

function App() {
  const jobs = [{id: '1', ownerName: 'Alice', salary: 100}]

  return (
    <ChartStudioDevtools
      getSnapshot={() => ({model, data: {jobs}})}
    />
  )
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `getSnapshot` | `() => ChartStudioDevtoolsInputSnapshot \| null` | Returns the current model and data to visualize. |
| `subscribe` | `(listener: () => void) => (() => void)` | Optional subscription for reactive updates. |
| `defaultOpen` | `boolean` | Whether the panel starts open. |
| `pollIntervalMs` | `number` | Polling interval in ms when `subscribe` is not provided. |

## Features

- Interactive graph visualization of datasets, relationships, associations, and materialized views
- Data viewer with virtualized tables for inspecting row-level data
- Configurable ELK-based graph layout with presets
- Search across datasets, columns, relationships, and associations
- Context and issue inspection

## License

MIT
