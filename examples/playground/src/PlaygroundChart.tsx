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
import {playgroundSources} from './mock-data'

/**
 * Main chart for the playground: full control surface with source switcher,
 * x-axis, type, group-by, time bucket, metric, filters, date range, and debug panel.
 */
export function PlaygroundChart() {
  const chart = useChart({
    sources: playgroundSources,
  })

  return (
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
  )
}
