/**
 * Date range panel content — reusable by both ChartDateRange (inside a popover)
 * and ChartToolbarOverflow (rendered inline).
 *
 * Shows preset buttons (Auto, All time, Last 7 days, etc.), a reference date
 * column picker, and custom date inputs.
 */

import {DATE_RANGE_PRESETS, getPresetLabel} from '@matthieumordrel/chart-studio/_internal'
import type {DateRangePresetId} from '@matthieumordrel/chart-studio'
import {useChartContext} from './chart-context.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD for native date input value. */
function toInputValue(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a YYYY-MM-DD string into a Date, or null if empty/invalid. */
function fromInputValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Resolve the display label for the current date range state.
 *
 * When a preset is active, returns the preset label.
 * When no preset is active (custom range), returns "Custom".
 */
export function resolvePresetLabel(
  dateRangePreset: DateRangePresetId | null,
): string {
  if (dateRangePreset === null) return 'Custom'
  return getPresetLabel(dateRangePreset)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Date range panel content (no popover wrapper).
 *
 * @property onClose - Optional callback when user selects a preset
 * @property className - Additional CSS classes
 */
export function ChartDateRangePanel({
  onClose,
  className,
}: {
  onClose?: () => void
  className?: string
}) {
  const {
    dateRangePreset,
    setDateRangePreset,
    dateRangeFilter,
    setDateRangeFilter,
    referenceDateId,
    setReferenceDateId,
    availableDateColumns,
  } = useChartContext()

  const hasMultipleDateColumns = availableDateColumns.length > 1

  const handlePreset = (presetId: DateRangePresetId) => {
    setDateRangePreset(presetId)
    onClose?.()
  }

  const handleCustomFrom = (value: string) => {
    const from = fromInputValue(value)
    setDateRangeFilter({from, to: dateRangeFilter?.to ?? null})
  }

  const handleCustomTo = (value: string) => {
    const to = fromInputValue(value)
    setDateRangeFilter({from: dateRangeFilter?.from ?? null, to})
  }

  return (
    <div className={className}>
      {/* Reference date column picker */}
      {hasMultipleDateColumns && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Date field
          </div>
          <select
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={referenceDateId ?? ''}
            onChange={(e) => setReferenceDateId(e.target.value)}
            aria-label="Reference date column"
          >
            {availableDateColumns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Presets */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Range
        </div>
        <div className="grid grid-cols-2 gap-1">
          {DATE_RANGE_PRESETS.map((preset) => {
            const isActive = dateRangePreset === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset.id)}
                title={preset.description}
                className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom date inputs */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Custom range
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={toInputValue(dateRangeFilter?.from ?? null)}
            onChange={(e) => handleCustomFrom(e.target.value)}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={toInputValue(dateRangeFilter?.to ?? null)}
            onChange={(e) => handleCustomTo(e.target.value)}
            aria-label="To date"
          />
        </div>
      </div>
    </div>
  )
}
