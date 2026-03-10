import type {ChartColumn} from './types.js'

/**
 * Single-source options for useChart.
 *
 * @property data - Array of raw data items
 * @property columns - Column definitions describing the data shape
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<T> = {
  data: T[]
  columns: ChartColumn<T>[]
  sourceLabel?: string
  sources?: never
}

/**
 * Multi-source options for useChart.
 *
 * @property sources - Array of named data sources with their own columns
 */
export type MultiSourceOptions = {
  data?: never
  columns?: never
  sources: ReadonlyArray<{
    id: string
    label: string
    data: readonly unknown[]
    columns: readonly ChartColumn<never>[]
  }>
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<T> = SingleSourceOptions<T> | MultiSourceOptions

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
