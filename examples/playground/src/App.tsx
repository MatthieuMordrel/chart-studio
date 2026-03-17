import { useState } from 'react'
import { DatasetModelChart } from './charts/DatasetModelChart'
import { DashboardChart } from './charts/DashboardChart'
import { HeadlessChart } from './charts/HeadlessChart'
import { InferredDashboardChart } from './charts/InferredDashboardChart'
import { KitchenSinkChart } from './charts/KitchenSinkChart'
import { MinimalChart } from './charts/MinimalChart'
import { SingleSourceChart } from './charts/SingleSourceChart'
import { CodePanel } from './CodePanel'
import datasetModelSource from './charts/DatasetModelChart.tsx?raw'
import dashboardSource from './charts/DashboardChart.tsx?raw'
import headlessSource from './charts/HeadlessChart.tsx?raw'
import inferredDashboardSource from './charts/InferredDashboardChart.tsx?raw'
import kitchenSinkSource from './charts/KitchenSinkChart.tsx?raw'
import minimalSource from './charts/MinimalChart.tsx?raw'
import singleSourceSource from './charts/SingleSourceChart.tsx?raw'
import { ThemeToggle } from './ThemeToggle'

type ScenarioId =
  | 'kitchen-sink'
  | 'single-source'
  | 'dataset-model'
  | 'inferred-dashboard'
  | 'minimal'
  | 'dashboard'
  | 'headless'

const SCENARIOS = [
  {
    id: 'kitchen-sink' as const,
    label: 'Kitchen Sink',
    title: 'Chart Controls — Kitchen Sink Explorer',
    description:
      'Interactive ChartToolbar documentation inside the playground. Toggle each control between ' +
      'pinned, ellipsis, and hidden to understand the full API and the available controls.'
  },
  {
    id: 'single-source' as const,
    label: 'Single Source',
    title: 'Single Source — Inference-First Mode',
    description:
      'Inference-first single-source mode. Pass raw data directly to useChart and add a schema only ' +
      'when you want explicit labels, derived columns, or tighter control restrictions.'
  },
  {
    id: 'dataset-model' as const,
    label: 'Dataset + Model',
    title: 'Hiring Requisitions — Dataset + Model API',
    description:
      'A realistic hiring planning dashboard built on the new APIs: reusable dataset-owned columns, ' +
      'multiple charts from one requisition dataset, and an explicit linked model for owners, skills, associations, and validation.'
  },
  {
    id: 'inferred-dashboard' as const,
    label: 'Inferred Dashboard',
    title: 'Inferred Dashboard API — owner.name Without Manual Plumbing',
    description:
      'Pass jobs, owners, and candidates directly into createDashboard(...), get owner lookups and one shared owner filter inferred, ' +
      'and chart with owner.name without authoring defineDataModel(...), relationship(...), attribute(...), or a lookup materialized view by hand.'
  },
  {
    id: 'minimal' as const,
    label: 'Minimal Embed',
    title: 'Minimal Embed — Pinned Controls',
    description:
      'Single source passed directly to useChart. Uses ChartToolbar with three pinned controls ' +
      'so chart type, time bucket, and group by stay visible while the rest remain in overflow.'
  },
  {
    id: 'dashboard' as const,
    label: 'Dashboard',
    title: 'Global Events Program — Performance Dashboard',
    description:
      'Four focused charts from a single dataset, each with its own schema restricting axes, chart types, ' +
      'and metrics. Shows how defineChartSchema locks down controls to convey a specific data story.'
  },
  {
    id: 'headless' as const,
    label: 'Headless Core',
    title: 'Headless Core — Zero UI Imports',
    description:
      'Zero imports from /ui — only the core useChart hook. Native HTML controls drive ' +
      'fully-typed state; chart.transformedData is the pipeline output, ready for any renderer.'
  }
] as const satisfies ReadonlyArray<{ id: ScenarioId; label: string; title: string; description: string }>

/** Map each scenario id to its raw source string for the code panel. */
const SCENARIO_SOURCE: Record<ScenarioId, string> = {
  'kitchen-sink': kitchenSinkSource,
  'single-source': singleSourceSource,
  'dataset-model': datasetModelSource,
  'inferred-dashboard': inferredDashboardSource,
  minimal: minimalSource,
  dashboard: dashboardSource,
  headless: headlessSource
}

/**
 * Root application for visually testing chart-studio.
 * Tab navigation switches between playground scenarios — one chart per screen.
 */
function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('kitchen-sink')

  const activeScenario = SCENARIOS.find(s => s.id === scenarioId)!

  return (
    <main className='min-h-screen bg-background text-foreground'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10'>
        <header className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            {/* Scenario tab navigation */}
            <div className='inline-flex items-center gap-0.5 rounded-lg border border-border/50 bg-background p-0.5 shadow-sm'>
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  type='button'
                  onClick={() => setScenarioId(s.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    scenarioId === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            <ThemeToggle />
          </div>

          <div className='rounded-lg border border-primary/20 bg-primary/5 px-4 py-3'>
            <h2 className='text-sm font-semibold text-foreground'>{activeScenario.title}</h2>
            <p className='mt-0.5 text-xs text-muted-foreground'>{activeScenario.description}</p>
          </div>
        </header>

        {scenarioId === 'kitchen-sink' && <KitchenSinkChart />}
        {scenarioId === 'single-source' && <SingleSourceChart />}
        {scenarioId === 'dataset-model' && <DatasetModelChart />}
        {scenarioId === 'inferred-dashboard' && <InferredDashboardChart />}
        {scenarioId === 'minimal' && <MinimalChart />}
        {scenarioId === 'dashboard' && <DashboardChart />}
        {scenarioId === 'headless' && <HeadlessChart />}

        <CodePanel source={SCENARIO_SOURCE[scenarioId]} />
      </div>
    </main>
  )
}

export default App
