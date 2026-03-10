/**
 * Date range utilities for chart-studio.
 *
 * Pure functions for filtering data by date range and computing
 * the min/max date range from a dataset.
 */

import type {DateColumn, DateRangeFilter} from './types.js'

/**
 * Filter data by a date range on a specific date column.
 * Both bounds are inclusive (to is extended to end of day).
 *
 * @param data - Raw data items
 * @param dateColumn - The date column to filter on
 * @param filter - Date range filter with from/to bounds
 * @returns Filtered data items within the date range
 */
export function filterByDateRange<T>(
  data: T[],
  dateColumn: DateColumn<T>,
  filter: DateRangeFilter,
): T[] {
  const {from, to} = filter
  if (!from && !to) return data

  const toEnd = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : null

  return data.filter((item) => {
    const raw = dateColumn.accessor(item)
    if (raw == null) return false
    const d = new Date(raw as string | number | Date)
    if (Number.isNaN(d.getTime())) return false
    if (from && d < from) return false
    if (toEnd && d > toEnd) return false
    return true
  })
}

/**
 * Compute the min/max date range from data for a given date column.
 *
 * @param data - Data items to scan
 * @param dateColumn - The date column to extract dates from
 * @returns Object with min and max dates (both null if no valid dates)
 */
export function computeDateRange<T>(
  data: T[],
  dateColumn: DateColumn<T>,
): {min: Date | null; max: Date | null} {
  let min: Date | null = null
  let max: Date | null = null

  for (const item of data) {
    const raw = dateColumn.accessor(item)
    if (raw == null) continue
    const d = new Date(raw as string | number | Date)
    if (Number.isNaN(d.getTime())) continue
    if (!min || d < min) min = d
    if (!max || d > max) max = d
  }

  return {min, max}
}
