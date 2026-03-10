import {useState} from 'react'
import {CodePanel} from './CodePanel'
import {HeadlessChart} from './HeadlessChart'
import headlessSource from './HeadlessChart.tsx?raw'
import {KitchenSinkChart} from './KitchenSinkChart'
import kitchenSinkSource from './KitchenSinkChart.tsx?raw'
import {MinimalChart} from './MinimalChart'
import minimalSource from './MinimalChart.tsx?raw'
import {ThemeToggle} from './ThemeToggle'

type ScenarioId = 'kitchen-sink' | 'minimal' | 'headless'

const SCENARIOS = [
  {
    id: 'kitchen-sink' as const,
    label: 'Kitchen Sink',
    description:
      'Every UI control from @matthieumordrel/chart-studio/ui in a flat layout. ' +
      'Multi-source mode — switch datasets live. Includes ChartDebug to inspect live state.',
  },
  {
    id: 'minimal' as const,
    label: 'Minimal Embed',
    description:
      'Single source passed directly to useChart. Only three UI controls composed: ' +
      'ChartTypeSelector, ChartTimeBucketSelector, ChartGroupBySelector.',
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
  minimal: minimalSource,
  headless: headlessSource,
}

/**
 * Root application for visually testing chart-studio.
 * Tab navigation switches between three scenarios — one chart per screen.
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
        {scenarioId === 'minimal' && <MinimalChart />}
        {scenarioId === 'headless' && <HeadlessChart />}

        <CodePanel source={SCENARIO_SOURCE[scenarioId]} />
      </div>
    </main>
  )
}

export default App
