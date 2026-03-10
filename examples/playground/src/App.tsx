import {useEffect, useState, type ReactNode} from 'react'
import {useChart} from '@matthieumordrel/chart-studio'
import {
  Chart,
  ChartCanvas,
  ChartDateRange,
  ChartDebug,
  ChartFilters,
  ChartGroupBySelector,
  ChartMetricSelector,
  ChartSourceSwitcher,
  ChartTimeBucketSelector,
  ChartTypeSelector,
  ChartXAxisSelector,
} from '@matthieumordrel/chart-studio/ui'
import {hiringPushData, jobColumns} from './mock-data'

type Theme = 'light' | 'dark'

type PlaygroundSectionProps = {
  title: string
  description: string
  children: ReactNode
}

/**
 * Read the persisted playground theme from localStorage.
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.localStorage.getItem('chart-studio-playground-theme') === 'dark' ? 'dark' : 'light'
}

/**
 * Apply the current theme using the same data attribute supported by the shipped package theme.
 */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem('chart-studio-playground-theme', theme)
}

/**
 * Reusable card shell for each playground scenario.
 */
function PlaygroundSection({title, description, children}: PlaygroundSectionProps) {
  return (
    <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * Small theme toggle for testing the shipped light and dark theme defaults.
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Dark
      </button>
    </div>
  )
}

/**
 * Shows a more custom composition where controls are rendered individually.
 */
function ComposedControlsDemo() {
  const chart = useChart({
    data: hiringPushData,
    columns: jobColumns,
    sourceLabel: 'Quarterly hiring push',
  })

  return (
    <PlaygroundSection
      title="Composed Controls Demo"
      description="Use this section to test the fully expanded control surface with every available chart toggle rendered directly in the layout."
    >
      <Chart chart={chart} className="space-y-4">
        {/* This layout exposes every control directly so each interaction is easy to inspect. */}
        <div className="flex flex-wrap items-center gap-2">
          <ChartSourceSwitcher />
          <ChartXAxisSelector />
          <ChartTypeSelector />
          <ChartGroupBySelector />
          <ChartTimeBucketSelector />
          <ChartMetricSelector />
          <ChartFilters />
          <ChartDateRange />
        </div>

        {/* A second dataset makes it easy to spot regressions across different distributions. */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <ChartCanvas height={320} />
        </div>

        {/* Keep debug state nearby so control changes are easy to verify in this expanded layout. */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <ChartDebug />
        </div>
      </Chart>
    </PlaygroundSection>
  )
}

/**
 * Root application for visually testing chart-studio in isolation.
 */
function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
        {/* Intro copy explains the playground's purpose to future contributors. */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Local UI playground
            </div>
            <ThemeToggle />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">chart-studio playground</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            This app is isolated from the published package and resolves imports directly to the
            local source files. Edit anything in <code>src/</code> and refresh the playground to
            verify visual changes without polluting the main library surface.
          </p>
        </header>

        <ComposedControlsDemo />
      </div>
    </main>
  )
}

export default App
