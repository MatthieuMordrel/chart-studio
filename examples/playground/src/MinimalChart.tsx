import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio/ui'
import {recipeLogColumns, recipeLogData} from './mock-data'

/**
 * Minimal chart composition: a canvas with a partially pinned toolbar.
 * Shows how little code is needed to get a fully interactive, grouped, time-bucketed chart
 * while leaving the rest of the controls inside the ellipsis menu.
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
      {/* Pin only the most useful controls for the compact embed; the rest stay in overflow. */}
      <ChartToolbar pinned={['chartType', 'timeBucket', 'groupBy']} />

      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartCanvas height={320} />
      </div>
    </Chart>
  )
}
