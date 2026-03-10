import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartDebug, ChartToolbar} from '@matthieumordrel/chart-studio/ui'
import {playgroundSources} from './mock-data'

/**
 * Overflow-first toolbar example.
 * Keeps every control inside the ellipsis menu by relying on ChartToolbar defaults.
 */
export function OverflowToolbarChart() {
  const chart = useChart({
    sources: playgroundSources,
  })

  return (
    <Chart chart={chart} className="space-y-4">
      {/* Default ChartToolbar behavior: no pinned controls, so everything lives in the ellipsis menu. */}
      <ChartToolbar />

      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartCanvas height={320} />
      </div>

      {/* Helpful for confirming overflow controls still update the same chart state as flat layouts. */}
      <div className="rounded-2xl border border-border bg-background p-4">
        <ChartDebug />
      </div>
    </Chart>
  )
}
