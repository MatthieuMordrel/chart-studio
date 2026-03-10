import {useState} from 'react'
import {CodePanel} from './CodePanel'
import {HeadlessChart} from './HeadlessChart'
import headlessSource from './HeadlessChart.tsx?raw'
import {KitchenSinkChart} from './KitchenSinkChart'
import kitchenSinkSource from './KitchenSinkChart.tsx?raw'
import {MinimalChart} from './MinimalChart'
import minimalSource from './MinimalChart.tsx?raw'
import {OverflowToolbarChart} from './OverflowToolbarChart'
import overflowToolbarSource from './OverflowToolbarChart.tsx?raw'
import {ThemeToggle} from './ThemeToggle'

type ScenarioId = 'kitchen-sink' | 'overflow-toolbar' | 'minimal' | 'headless'

const SCENARIOS = [
  {
    id: 'kitchen-sink' as const,
    label: 'Kitchen Sink',
    description:
      'Interactive ChartToolbar documentation inside the playground. Toggle each control between ' +
      'pinned, ellipsis, and hidden to understand the full API and the available controls.',
  },
  {
    id: 'overflow-toolbar' as const,
    label: 'Overflow Toolbar',
    description:
      'Uses ChartToolbar with its default configuration so every control stays inside the ellipsis menu. ' +
      'Multi-source mode with ChartDebug included to inspect state changes.',
  },
  {
    id: 'minimal' as const,
    label: 'Minimal Embed',
    description:
      'Single source passed directly to useChart. Uses ChartToolbar with three pinned controls ' +
      'so chart type, time bucket, and group by stay visible while the rest remain in overflow.',
  },
  {
    id: 'headless' as const,
    label: 'Headless Core',
    description:
      'Zero imports from /ui — only the core useChart hook. Native HTML controls drive ' +
      'fully-typed state; chart.transformedData is the pipeline output, ready for any renderer.',
  },
] as const satisfies ReadonlyArray<{id: ScenarioId; label: string; description: string}>

/** Map each scenario id to its raw source string for the code panel. */
const SCENARIO_SOURCE: Record<ScenarioId, string> = {
  'kitchen-sink': kitchenSinkSource,
  'overflow-toolbar': overflowToolbarSource,
  minimal: minimalSource,
  headless: headlessSource,
}

/**
 * Root application for visually testing chart-studio.
 * Tab navigation switches between playground scenarios — one chart per screen.
 */
function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('kitchen-sink')

  const activeScenario = SCENARIOS.find(s => s.id === scenarioId)!

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Scenario tab navigation */}
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarioId(s.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    scenarioId === s.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <ThemeToggle />
          </div>

          <p className="text-sm text-muted-foreground">{activeScenario.description}</p>
        </header>

        {scenarioId === 'kitchen-sink' && <KitchenSinkChart />}
        {scenarioId === 'overflow-toolbar' && <OverflowToolbarChart />}
        {scenarioId === 'minimal' && <MinimalChart />}
        {scenarioId === 'headless' && <HeadlessChart />}

        <CodePanel source={SCENARIO_SOURCE[scenarioId]} />
      </div>
    </main>
  )
}

export default App
