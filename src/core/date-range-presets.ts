/**
 * Date range preset definitions for chart-studio.
 *
 * Presets are named date range selections that users can pick from the UI.
 * Each preset knows how to build a `DateRangeFilter` from the current date.
 *
 * The special `'auto'` preset derives its range from the active time bucket,
 * so the visible window automatically adjusts when the user changes granularity.
 */

import type {DateRangeFilter, TimeBucket} from './types.js'

// ---------------------------------------------------------------------------
// Preset IDs
// ---------------------------------------------------------------------------

/**
 * All recognised date range preset identifiers.
 *
 * - `'auto'`          — derived from the active time bucket
 * - `'all-time'`      — no date filtering
 * - Relative presets   — rolling window from "now"
 * - Calendar presets   — aligned to calendar boundaries
 */
export type DateRangePresetId =
  | 'auto'
  | 'all-time'
  | 'last-7-days'
  | 'last-30-days'
  | 'last-3-months'
  | 'last-12-months'
  | 'quarter-to-date'
  | 'year-to-date'
  | 'last-year'

// ---------------------------------------------------------------------------
// Preset metadata
// ---------------------------------------------------------------------------

export type DateRangePreset = {
  id: DateRangePresetId
  label: string
  /** Optional tooltip description shown on hover. */
  description?: string
  /** Build the filter for this preset. `null` = no date filtering (all time). */
  buildFilter: () => DateRangeFilter | null
}

/**
 * Ordered list of all date range presets shown in the UI.
 *
 * Layout hint (2-column grid):
 *   Auto          | All time
 *   Last 7 days   | Last 30 days
 *   Last 3 months | Last 12 months
 *   Quarter to date | Year to date
 *   Last year     |
 */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  {id: 'auto', label: 'Auto', description: 'Adjusts the date range automatically based on the selected time bucket', buildFilter: () => null /* resolved dynamically */},
  {id: 'all-time', label: 'All time', buildFilter: () => null},
  {id: 'last-7-days', label: 'Last 7 days', buildFilter: () => ({from: daysAgo(7), to: null})},
  {id: 'last-30-days', label: 'Last 30 days', buildFilter: () => ({from: daysAgo(30), to: null})},
  {id: 'last-3-months', label: 'Last 3 months', buildFilter: () => ({from: monthsAgo(3), to: null})},
  {id: 'last-12-months', label: 'Last 12 months', buildFilter: () => ({from: monthsAgo(12), to: null})},
  {id: 'quarter-to-date', label: 'Quarter to date', buildFilter: () => ({from: startOfQuarter(), to: null})},
  {id: 'year-to-date', label: 'Year to date', buildFilter: () => ({from: startOfYear(), to: null})},
  {id: 'last-year', label: 'Last year', buildFilter: () => lastYear()},
]

// ---------------------------------------------------------------------------
// Auto preset logic
// ---------------------------------------------------------------------------

/**
 * Map a time bucket to a sensible default date range.
 *
 * - `day`     → last 30 days (enough for a meaningful daily trend)
 * - `week`    → last 3 months (~13 weeks)
 * - `month`   → last 12 months
 * - `quarter` → all time (null)
 * - `year`    → all time (null)
 */
export function autoFilterForBucket(bucket: TimeBucket): DateRangeFilter | null {
  switch (bucket) {
    case 'day':
      return {from: daysAgo(30), to: null}
    case 'week':
      return {from: monthsAgo(3), to: null}
    case 'month':
      return {from: monthsAgo(12), to: null}
    case 'quarter':
    case 'year':
      return null
  }
}

// ---------------------------------------------------------------------------
// Resolve preset → filter
// ---------------------------------------------------------------------------

/**
 * Compute the effective `DateRangeFilter` for a given preset.
 *
 * For `'auto'`, this uses the provided `timeBucket` to derive the range.
 * For all other presets, the filter is computed from the preset definition.
 *
 * @returns The resolved filter, or `null` for "all time".
 */
export function resolvePresetFilter(
  presetId: DateRangePresetId,
  timeBucket: TimeBucket,
): DateRangeFilter | null {
  if (presetId === 'auto') {
    return autoFilterForBucket(timeBucket)
  }

  const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId)
  return preset?.buildFilter() ?? null
}

/**
 * Get the human-readable label for a preset ID.
 */
export function getPresetLabel(presetId: DateRangePresetId): string {
  const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId)
  return preset?.label ?? 'Custom'
}

// ---------------------------------------------------------------------------
// Date helpers (pure, no side effects)
// ---------------------------------------------------------------------------

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

function startOfQuarter(): Date {
  const d = new Date()
  const quarterMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), quarterMonth, 1)
}

function startOfYear(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1)
}

function lastYear(): DateRangeFilter {
  const d = new Date()
  const year = d.getFullYear() - 1
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31),
  }
}
