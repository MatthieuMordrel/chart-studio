/**
 * Metric selector — trigger button + popover wrapping ChartMetricPanel.
 *
 * Follows the same dropdown pattern as ChartFilters / ChartDateRange.
 */

import {useRef, useState} from 'react'
import {ChevronDown, MoveVertical} from 'lucide-react'
import {getMetricLabel, isAggregateMetric} from '../core/metric-utils.js'
import {useChartContext} from './chart-context.js'
import {ChartDropdownPanel} from './chart-dropdown.js'
import {ChartMetricPanel} from './chart-metric-panel.js'

/** Styled popover to select the Y-axis metric with grouped aggregate buttons. */
export function ChartMetricSelector({className}: {className?: string}) {
  const {metric, availableMetrics, columns} = useChartContext()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (availableMetrics.length <= 1) return null

  const isCount = metric.kind === 'count'
  const isActive = !isCount
  const includeZeros = isAggregateMetric(metric) ? (metric.includeZeros ?? true) : true
  const label = getMetricLabel(metric, columns)

  return (
    <div className={className}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 ${
          isActive
            ? 'border-primary/30 bg-primary/5 text-primary shadow-sm shadow-primary/5 hover:bg-primary/8'
            : 'border-border/50 bg-background text-muted-foreground shadow-sm hover:border-border hover:bg-muted/30 hover:shadow hover:text-foreground'
        }`}
        aria-label="Metric"
      >
        <MoveVertical className="h-3 w-3" />
        <span>{label}</span>
        {isActive && !includeZeros && (
          <span className="rounded bg-muted px-1 py-px text-[9px] font-normal text-muted-foreground">
            excl. 0
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      <ChartDropdownPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        width={288}
        className="p-4"
      >
        <ChartMetricPanel onClose={() => setIsOpen(false)} />
      </ChartDropdownPanel>
    </div>
  )
}
