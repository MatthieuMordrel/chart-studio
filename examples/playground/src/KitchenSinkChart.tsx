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
 * Full chart composition: every UI control exposed in a flat toolbar for hands-on inspection.
 * Uses multi-source mode — switch datasets live without losing chart type or groupBy state.
 */
export function KitchenSinkChart() {
  const chart = useChart({
    sources: playgroundSources,
  })

  return (
    <Chart chart={chart} className="space-y-4">
      {/* Every control from @matthieumordrel/chart-studio/ui laid out flat so each interaction is easy to spot. */}
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

      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartCanvas height={320} />
      </div>

      {/* Live state inspector — useful for verifying each control updates the right slice of state. */}
      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartDebug />
      </div>
    </Chart>
  )
}
