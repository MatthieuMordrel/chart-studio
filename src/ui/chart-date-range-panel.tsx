/**
 * Date range panel content — reusable by both ChartDateRange (inside a popover)
 * and ChartToolbarOverflow (rendered inline).
 *
 * Shows preset buttons (Automatic, Last 7 days, etc.), a reference date
 * column picker, and custom date inputs.
 */

import {useMemo} from 'react'
import type {DateRangeFilter} from '../core/types.js'
import {useChartContext} from './chart-context.js'

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type Preset = {
  label: string
  buildFilter: () => DateRangeFilter | null
}

/**
 * Build the list of date range presets relative to "now".
 *
 * "Automatic" → null (hook applies default 12-month window)
 * "All time" → { from: null, to: null } (explicit no-bounds, shows everything)
 * Other presets → { from: Date, to: null } (bounded filter)
 */
function getPresets(): Preset[] {
  return [
    {label: 'Automatic', buildFilter: () => null},
    {label: 'All time', buildFilter: () => ({from: null, to: null})},
    {label: 'Last 7 days', buildFilter: () => ({from: daysAgo(7), to: null})},
    {label: 'Last 30 days', buildFilter: () => ({from: daysAgo(30), to: null})},
    {label: 'Last 3 months', buildFilter: () => ({from: monthsAgo(3), to: null})},
    {label: 'Last 6 months', buildFilter: () => ({from: monthsAgo(6), to: null})},
    {label: 'Last 12 months', buildFilter: () => ({from: monthsAgo(12), to: null})},
    {label: 'Year to date', buildFilter: () => ({from: startOfYear(), to: null})},
  ]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfYear(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1)
}

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
 * Determine which preset label matches the current filter, or "Custom".
 * null → "Automatic" (no filter, chart default window)
 * { from: null, to: null } → "All time" (explicit no-bounds filter)
 * Compares dates at day-level precision.
 */
export function resolvePresetLabel(filter: DateRangeFilter | null): string {
  if (filter === null) return 'Automatic'

  const presets = getPresets()
  for (const preset of presets) {
    const pf = preset.buildFilter()
    if (pf === null) continue
    if (sameDay(pf.from, filter.from) && sameDay(pf.to, filter.to)) {
      return preset.label
    }
  }
  return 'Custom'
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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
    dateRangeFilter,
    setDateRangeFilter,
    referenceDateId,
    setReferenceDateId,
    availableDateColumns,
  } = useChartContext()

  const presets = useMemo(() => getPresets(), [])

  const activeLabel = resolvePresetLabel(dateRangeFilter)
  const hasMultipleDateColumns = availableDateColumns.length > 1

  const handlePreset = (preset: Preset) => {
    setDateRangeFilter(preset.buildFilter())
    if (preset.label !== 'Custom') {
      onClose?.()
    }
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
          {presets.map((preset) => {
            const isActive = activeLabel === preset.label
            return (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
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
