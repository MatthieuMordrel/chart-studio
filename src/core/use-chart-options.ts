import type {ChartSourceOptions, ChartToolsConfigFromHints, ColumnHints, NonEmptyChartSourceOptions} from './types.js'

/**
 * Single-source options for useChart.
 *
 * @property data - Array of raw data items
 * @property columnHints - Optional per-field overrides layered on top of automatic inference
 * @property tools - Optional declarative restrictions for groupBy and metric tools
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TTools extends ChartToolsConfigFromHints<T, THints> | undefined = undefined,
> = {
  data: readonly T[]
  columnHints?: THints
  tools?: TTools
  sourceLabel?: string
  sources?: never
}

/**
 * Multi-source options for useChart.
 *
 * @property sources - Array of named raw-data sources with optional per-source hints
 */
export type MultiSourceOptions<TSources extends NonEmptyChartSourceOptions = NonEmptyChartSourceOptions> = {
  data?: never
  columnHints?: never
  sourceLabel?: never
  sources: TSources
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TTools extends ChartToolsConfigFromHints<T, THints> | undefined = undefined,
> = SingleSourceOptions<T, THints, TTools> | MultiSourceOptions

export type {ChartSourceOptions}

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
