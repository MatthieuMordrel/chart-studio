import { useState } from 'react'
import { DatasetModelChart } from './charts/DatasetModelChart'
import { DashboardChart } from './charts/DashboardChart'
import { HeadlessChart } from './charts/HeadlessChart'
import { KitchenSinkChart } from './charts/KitchenSinkChart'
import { MinimalChart } from './charts/MinimalChart'
import { SingleSourceChart } from './charts/SingleSourceChart'
import { TypedInferredDashboardChart } from './charts/TypedInferredDashboardChart'
import { CodePanel } from './CodePanel'
import datasetModelSource from './charts/DatasetModelChart.tsx?raw'
import dashboardSource from './charts/DashboardChart.tsx?raw'
import headlessSource from './charts/HeadlessChart.tsx?raw'
import kitchenSinkSource from './charts/KitchenSinkChart.tsx?raw'
import minimalSource from './charts/MinimalChart.tsx?raw'
import singleSourceSource from './charts/SingleSourceChart.tsx?raw'
import typedInferredDashboardSource from './charts/TypedInferredDashboardChart.tsx?raw'
import { ThemeToggle } from './ThemeToggle'

type ScenarioId =
  | 'kitchen-sink'
  | 'single-source'
  | 'schema-restricted'
  | 'minimal'
  | 'headless'
  | 'dataset-model'
  | 'typed-inferred-dashboard'

type ScenarioGroup = {
  label: string
  hook: string
  scenarios: ReadonlyArray<{ id: ScenarioId; label: string; title: string; description: string }>
}

const SCENARIO_GROUPS: ReadonlyArray<ScenarioGroup> = [
  {
    label: 'Charts',
    hook: 'useChart',
    scenarios: [
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
        id: 'schema-restricted' as const,
        label: 'Schema-Restricted',
        title: 'Global Events Program — Schema-Restricted Charts',
        description:
          'Four focused charts from a single dataset, each with its own schema restricting axes, chart types, ' +
          'and metrics. Shows how defineChartSchema locks down controls to convey a specific data story.'
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
        id: 'headless' as const,
        label: 'Headless Core',
        title: 'Headless Core — Zero UI Imports',
        description:
          'Zero imports from /ui — only the core useChart hook. Native HTML controls drive ' +
          'fully-typed state; chart.transformedData is the pipeline output, ready for any renderer.'
      },
    ],
  },
  {
    label: 'Dashboards',
    hook: 'useDashboard',
    scenarios: [
      {
        id: 'typed-inferred-dashboard' as const,
        label: 'Model-First',
        title: 'School Dashboard — Model-First Inference',
        description:
          'The recommended path: define datasets on a data model, infer safe relationships and shared-filter attributes there, ' +
          'author charts on the model, then compose them with defineDashboard(model).'
      },
      {
        id: 'dataset-model' as const,
        label: 'Explicit Model',
        title: 'Hiring Requisitions — Explicit Model + Dashboard',
        description:
          'A realistic hiring planning dashboard with an explicit linked model for owners, skills, associations, validation, ' +
          'and reusable materialized views when the chart grain must change.'
      },
    ],
  },
]

const ALL_SCENARIOS = SCENARIO_GROUPS.flatMap(g => g.scenarios)

/** Map each scenario id to its raw source string for the code panel. */
const SCENARIO_SOURCE: Record<ScenarioId, string> = {
  'kitchen-sink': kitchenSinkSource,
  'single-source': singleSourceSource,
  'schema-restricted': dashboardSource,
  'dataset-model': datasetModelSource,
  'typed-inferred-dashboard': typedInferredDashboardSource,
  minimal: minimalSource,
  headless: headlessSource
}

/**
 * Root application for visually testing chart-studio.
 * Tab navigation switches between playground scenarios — one chart per screen.
 */
function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('kitchen-sink')

  const activeScenario = ALL_SCENARIOS.find(s => s.id === scenarioId)!

  return (
    <main className='min-h-screen bg-background text-foreground'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10'>
        <header className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            {/* Scenario tab navigation — grouped by primitive */}
            <div className='inline-flex items-center gap-0.5 rounded-lg border border-border/50 bg-background p-0.5 shadow-sm'>
              {SCENARIO_GROUPS.map((group, groupIdx) => (
                <div key={group.label} className='inline-flex items-center'>
                  {groupIdx > 0 && (
                    <div className='mx-1 h-4 w-px bg-border/60' />
                  )}
                  <span className='px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60'>
                    {group.label}
                  </span>
                  {group.scenarios.map(s => (
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
        {scenarioId === 'schema-restricted' && <DashboardChart />}
        {scenarioId === 'minimal' && <MinimalChart />}
        {scenarioId === 'headless' && <HeadlessChart />}
        {scenarioId === 'dataset-model' && <DatasetModelChart />}
        {scenarioId === 'typed-inferred-dashboard' && <TypedInferredDashboardChart />}

        <CodePanel source={SCENARIO_SOURCE[scenarioId]} />
      </div>
    </main>
  )
}

export default App
