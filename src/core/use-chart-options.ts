import type {
  ChartSchemaDefinition,
  ChartSourceOptions,
  NonEmptyChartSourceOptions,
} from './types.js'

/**
 * Single-source options for `useChart(...)`.
 *
 * This is the stable chart-first path:
 * one dataset, one optional schema, one chart.
 */
export interface SingleSourceOptions<
  T,
  TSchema extends ChartSchemaDefinition<T, any> | undefined = undefined,
> {
  /**
   * Raw rows that chart-studio should inspect and transform.
   *
   * Example:
   * `[{createdAt: '2026-01-01', revenue: 1200}]`
   */
  data: readonly T[]
  /**
   * Optional explicit schema layered on top of inference.
   *
   * Usually this is either:
   * - the fluent builder returned by `defineChartSchema<Row>()`
   * - or a reusable dataset-backed chart builder from
   *   `defineDataset<Row>().chart(...)`
   *
   * Both can be passed directly without calling `.build()`. Plain schema
   * objects are also accepted.
   *
   * Use this when you want to:
   * - rename fields with `label`
   * - force or refine column `type`
   * - add `format`
   * - exclude fields
   * - create derived columns
   * - restrict what users can select in the chart UI
   *
   * Unspecified raw fields still participate through inference unless you
   * explicitly exclude them.
   */
  schema?: TSchema
  /**
   * Human-readable source name shown by the built-in UI when relevant.
   *
   * Example: `'Jobs'`, `'Quarterly Financials'`, or `'Pipeline Health'`.
   */
  sourceLabel?: string
  sources?: never
}

/**
 * Multi-source options for `useChart(...)`.
 *
 * Use this for source-switching within one chart. It is separate from the
 * single-source `useChart({data, schema})` contract and is not dashboard
 * composition.
 */
export interface MultiSourceOptions<TSources extends NonEmptyChartSourceOptions = NonEmptyChartSourceOptions> {
  data?: never
  schema?: never
  sourceLabel?: never
  /**
   * Named list of chart sources.
   *
   * Each source provides:
   * - an `id`
   * - a user-facing `label`
   * - raw `data`
   * - an optional per-source `schema`
   */
  sources: TSources
}

/**
 * Options for the useChart hook.
 */
export type UseChartOptions<
  T,
  TSchema extends ChartSchemaDefinition<T, any> | undefined = undefined,
> = SingleSourceOptions<T, TSchema> | MultiSourceOptions

export type {ChartSourceOptions}

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
