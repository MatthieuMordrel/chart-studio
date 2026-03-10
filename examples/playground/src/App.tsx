import type {ReactNode} from 'react'
import {useChart} from '@matthieumordrel/chart-studio'
import {
  Chart,
  ChartCanvas,
  ChartDateRange,
  ChartDebug,
  ChartFilters,
  ChartGroupBySelector,
  ChartMetricSelector,
  ChartToolbar,
  ChartTypeSelector,
  ChartXAxisSelector,
} from '@matthieumordrel/chart-studio/ui'
import {hiringPushData, jobColumns, jobsPlaygroundData} from './mock-data'

type PlaygroundSectionProps = {
  title: string
  description: string
  children: ReactNode
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
 * Shows the default out-of-the-box toolbar and canvas experience.
 */
function DefaultToolbarDemo() {
  const chart = useChart({
    data: jobsPlaygroundData,
    columns: jobColumns,
    sourceLabel: 'Hiring pipeline',
  })

  return (
    <PlaygroundSection
      title="Default Toolbar Demo"
      description="Use this section to test the standard package experience: toolbar behavior, filters, grouping, date range, and chart rendering."
    >
      <Chart chart={chart} className="space-y-4">
        {/* The stock toolbar is the fastest way to visually verify most UI changes. */}
        <ChartToolbar pinned={['xAxis', 'chartType', 'groupBy', 'metric', 'filters']} />

        {/* Keep the chart surface isolated so spacing and borders are easy to inspect. */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <ChartCanvas height={340} />
        </div>

        {/* Debug output helps verify state transitions while interacting with the UI. */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <ChartDebug />
        </div>
      </Chart>
    </PlaygroundSection>
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
      description="Use this section to test individual controls in custom layouts without going through the default toolbar wrapper."
    >
      <Chart chart={chart} className="space-y-4">
        {/* This layout mimics how a consumer might compose only the controls they want. */}
        <div className="flex flex-wrap items-center gap-2">
          <ChartXAxisSelector />
          <ChartTypeSelector />
          <ChartGroupBySelector />
          <ChartMetricSelector />
          <ChartFilters />
          <ChartDateRange />
        </div>

        {/* A second dataset makes it easy to spot regressions across different distributions. */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <ChartCanvas height={320} />
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
        <header className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Local UI playground
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">chart-studio playground</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            This app is isolated from the published package and resolves imports directly to the
            local source files. Edit anything in <code>src/</code> and refresh the playground to
            verify visual changes without polluting the main library surface.
          </p>
        </header>

        {/* Two scenarios cover both the default package UX and a custom consumer composition. */}
        <DefaultToolbarDemo />
        <ComposedControlsDemo />
      </div>
    </main>
  )
}

export default App
