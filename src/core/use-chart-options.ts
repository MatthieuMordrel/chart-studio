import type {
  ChartSchema,
  ChartSourceOptions,
  DefinedChartSchema,
  NonEmptyChartSourceOptions,
} from './types.js'

/**
 * Single-source options for useChart.
 *
 * @property data - Array of raw data items
 * @property schema - Optional explicit schema that overrides inference, defines derived columns, and narrows the chart contract. Use `defineChartSchema<Row>()(...)` to create it.
 * @property sourceLabel - Human-readable label for the data source (e.g. "Jobs", "Placements"). Defaults to "Unnamed Source".
 */
export type SingleSourceOptions<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = {
  data: readonly T[]
  schema?: DefinedChartSchema<T, Exclude<TSchema, undefined>>
  sourceLabel?: string
  sources?: never
}

/**
 * Multi-source options for useChart.
 *
 * @property sources - Array of named raw-data sources with optional per-source schemas
 */
export type MultiSourceOptions<TSources extends NonEmptyChartSourceOptions = NonEmptyChartSourceOptions> = {
  data?: never
  schema?: never
  sourceLabel?: never
  sources: TSources
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = SingleSourceOptions<T, TSchema> | MultiSourceOptions

export type {ChartSourceOptions}

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
