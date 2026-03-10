/**
 * Shared helpers for the chart transformation pipeline.
 */

import type {AggregateFunction, ChartColumn, TimeBucket} from './types.js'

/**
 * Format a stable key for a date bucket.
 *
 * @param date - Source date
 * @param bucket - Time bucket granularity
 * @returns Machine-friendly bucket key
 */
export function dateBucketKey(date: Date, bucket: TimeBucket): string {
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (bucket) {
    case 'day':
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    case 'week': {
      const day = date.getDay()
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((day + 6) % 7))
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    }
    case 'month':
      return `${year}-${String(month + 1).padStart(2, '0')}`
    case 'quarter':
      return `${year}-Q${Math.floor(month / 3) + 1}`
    case 'year':
      return `${year}`
  }
}

/**
 * Format a bucket key into a human-readable label.
 *
 * @param key - Bucket key
 * @param bucket - Time bucket granularity
 * @returns Display label for the chart axis
 */
export function dateBucketLabel(key: string, bucket: TimeBucket): string {
  switch (bucket) {
    case 'day': {
      const date = new Date(`${key}T00:00:00`)
      return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: '2-digit'})
    }
    case 'week': {
      const date = new Date(`${key}T00:00:00`)
      return `W ${date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`
    }
    case 'month': {
      const [year, month] = key.split('-')
      const date = new Date(Number(year), Number(month) - 1)
      return date.toLocaleDateString('en-US', {month: 'short', year: '2-digit'})
    }
    case 'quarter':
      return key
    case 'year':
      return key
  }
}

/**
 * Extract a comparable string value from an item using a column definition.
 *
 * @param item - Raw data item
 * @param column - Column definition to read from
 * @returns String value used by filters and groups
 */
export function getStringValue<T>(item: T, column: ChartColumn<T>): string {
  switch (column.type) {
    case 'boolean': {
      const value = column.accessor(item)
      if (value === true) return column.trueLabel
      if (value === false) return column.falseLabel
      return 'Unknown'
    }
    case 'category': {
      const value = column.accessor(item)
      return value ?? 'Unknown'
    }
    case 'date': {
      const value = column.accessor(item)
      return value != null ? String(value) : 'Unknown'
    }
    case 'number': {
      const value = column.accessor(item)
      return value != null ? String(value) : 'Unknown'
    }
  }
}

/**
 * Aggregate numeric values using the requested function.
 *
 * @param values - Numeric values to aggregate
 * @param fn - Aggregation strategy
 * @param includeZeros - Whether zero values should participate in avg/min/max
 * @returns Aggregated numeric result
 */
export function aggregate(values: number[], fn: AggregateFunction, includeZeros = true): number {
  if (fn === 'count') return values.length

  const effectiveValues =
    !includeZeros && fn !== 'sum' ? values.filter((value) => value !== 0) : values

  if (effectiveValues.length === 0) return 0

  switch (fn) {
    case 'sum':
      return effectiveValues.reduce((sum, value) => sum + value, 0)
    case 'avg':
      return effectiveValues.reduce((sum, value) => sum + value, 0) / effectiveValues.length
    case 'min':
      return Math.min(...effectiveValues)
    case 'max':
      return Math.max(...effectiveValues)
  }
}
