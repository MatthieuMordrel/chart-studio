import type {ColumnHints, DataSource} from './types.js'

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
 * @property columnHints - Optional per-field overrides layered on top of automatic inference
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = {
  data: readonly T[]
  columnHints?: THints
  sourceLabel?: string
  sources?: never
  columns?: never
}

/**
 * Multi-source options for useChart.
 *
 * @property sources - Array of named data sources with their own columns
 */
export type MultiSourceOptions = {
  data?: never
  columnHints?: never
  sources: NonEmptyDataSources
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = SingleSourceOptions<T, THints> | MultiSourceOptions

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
