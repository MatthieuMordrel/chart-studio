import { useChart } from '@matthieumordrel/chart-studio'
import {
  Chart,
  ChartCanvas,
  ChartGroupBySelector,
  ChartTimeBucketSelector,
  ChartTypeSelector,
} from '@matthieumordrel/chart-studio/ui'
import { recipeLogColumns, recipeLogData } from './mock-data'

/**
 * Minimal chart composition: a canvas with only three controls.
 * Shows how little code is needed to get a fully interactive, grouped, time-bucketed chart.
 * Uses single-source mode — data and columns passed directly to useChart.
 */
export function MinimalChart() {
  const chart = useChart({
    data: recipeLogData,
    columns: recipeLogColumns,
    sourceLabel: 'Home Cooking',
  })

  return (
    <Chart chart={chart} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChartTypeSelector />
        <ChartTimeBucketSelector />
        <ChartGroupBySelector />
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartCanvas height={320} />
      </div>
    </Chart>
  )
}
