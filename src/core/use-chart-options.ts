import type {ChartColumn, DataSource} from './types.js'

/**
 * Multi-source charts require at least one source so the hook always has a
 * valid active source.
 */
type NonEmptyDataSources = readonly [
  DataSource<any>,
  ...DataSource<any>[],
]

/**
 * Single-source options for useChart.
 *
 * @property data - Array of raw data items
 * @property columns - Column definitions describing the data shape
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<
  T,
  TColumns extends readonly ChartColumn<T, string>[] = readonly ChartColumn<T, string>[],
> = {
  data: readonly T[]
  columns: TColumns
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
  sources: NonEmptyDataSources
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<
  T,
  TColumns extends readonly ChartColumn<T, string>[] = readonly ChartColumn<T, string>[],
> = SingleSourceOptions<T, TColumns> | MultiSourceOptions

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
