/**
 * Date range control — interactive button that shows the current date range
 * and opens a popover wrapping ChartDateRangePanel.
 *
 * Acts as both a display and a filter control for the reference date column.
 */

import {useRef, useState} from 'react'
import {Calendar} from 'lucide-react'
import {useChartContext} from './chart-context.js'
import {ChartDropdownPanel} from './chart-dropdown.js'
import {ChartDateRangePanel, resolvePresetLabel} from './chart-date-range-panel.js'

/** Format a Date into a compact, readable string (e.g. "Jan 5, 25"). */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

/**
 * Interactive date range control with presets and custom date inputs.
 * Also serves as the reference date column picker when multiple date columns exist.
 */
export function ChartDateRange({className}: {className?: string}) {
  const {dateRange, dateRangeFilter, availableDateColumns} = useChartContext()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (availableDateColumns.length === 0) return null

  const activeLabel = resolvePresetLabel(dateRangeFilter)
  const isFiltered = dateRangeFilter !== null
  const hasRange = dateRange?.min && dateRange?.max

  return (
    <div className={className}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 ${
          isFiltered
            ? 'border-primary/30 bg-primary/5 text-primary shadow-sm shadow-primary/5 hover:bg-primary/8'
            : 'border-border/50 bg-background text-muted-foreground shadow-sm hover:border-border hover:bg-muted/30 hover:shadow hover:text-foreground'
        }`}
      >
        <Calendar className="h-3 w-3" />
        <span>{activeLabel}</span>
        {hasRange && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-normal">
              {formatDate(dateRange!.min!)} – {formatDate(dateRange!.max!)}
            </span>
          </>
        )}
      </button>

      {/* Dropdown panel */}
      <ChartDropdownPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        align="right"
        width={288}
        className="p-3"
      >
        <ChartDateRangePanel onClose={() => setIsOpen(false)} />
      </ChartDropdownPanel>
    </div>
  )
}
