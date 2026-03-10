/**
 * Chart type selector — inline toggle buttons for bar/line/area/pie/donut.
 */

import type {ChartType} from '../core/types.js'
import {useChartContext} from './chart-context.js'

/** Labels for each chart type. */
const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar',
  line: 'Line',
  area: 'Area',
  pie: 'Pie',
  donut: 'Donut',
}

/** Inline toggle buttons to select the chart type. */
export function ChartTypeSelector({className}: {className?: string}) {
  const {chartType, setChartType, availableChartTypes} = useChartContext()

  if (availableChartTypes.length <= 1) return null

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border/50 bg-muted/50 p-0.5 shadow-sm ${className ?? ''}`}
      role="tablist"
      aria-label="Chart type"
    >
      {availableChartTypes.map((type) => {
        const isActive = type === chartType
        return (
          <button
            key={type}
            role="tab"
            aria-selected={isActive}
            onClick={() => setChartType(type)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            }`}
          >
            {CHART_TYPE_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
