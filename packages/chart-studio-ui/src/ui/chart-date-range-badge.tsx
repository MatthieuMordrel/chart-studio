/**
 * Read-only badge that always displays the current date range in the toolbar.
 *
 * Shows the preset label (e.g. "All time") and the computed min–max range.
 * Non-interactive — purely informational so users always know the date window.
 */

import {Calendar} from 'lucide-react'
import {useChartContext} from './chart-context.js'
import {resolvePresetLabel} from './chart-date-range-panel.js'

/** Format a Date into a compact, readable string (e.g. "Jan 5, 25"). */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

/**
 * Read-only badge showing the active date range preset and computed bounds.
 * Renders nothing if no date columns are available.
 */
export function ChartDateRangeBadge({className}: {className?: string}) {
  const {dateRange, dateRangePreset, availableDateColumns} = useChartContext()

  if (availableDateColumns.length === 0) return null

  const activeLabel = resolvePresetLabel(dateRangePreset)
  const hasRange = dateRange?.min && dateRange?.max

  return (
    <div
      className={`inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 text-xs text-muted-foreground ${className ?? ''}`}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      <span className="font-medium">{activeLabel}</span>
      {hasRange && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>
            {formatDate(dateRange!.min!)} – {formatDate(dateRange!.max!)}
          </span>
        </>
      )}
    </div>
  )
}
