import type {
  ChartConfigFromHints,
  ChartSourceOptions,
  ColumnHints,
  DefinedChartConfigFromHints,
  NonEmptyChartSourceOptions,
} from './types.js'

/**
 * Single-source options for useChart.
 *
 * @property data - Array of raw data items
 * @property columnHints - Optional per-field overrides layered on top of automatic inference
 * @property config - Optional explicit config that narrows the chart contract. Use `defineChartConfig(...)` to create it.
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = {
  data: readonly T[]
  columnHints?: THints
  config?: DefinedChartConfigFromHints<T, THints, Exclude<TConfig, undefined>>
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
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = SingleSourceOptions<T, THints, TConfig> | MultiSourceOptions

export type {ChartSourceOptions}

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
