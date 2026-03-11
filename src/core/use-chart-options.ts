import type {
  ChartSchema,
  ChartSourceOptions,
  DefinedChartSchema,
  NonEmptyChartSourceOptions,
} from './types.js'

/**
 * Single-source options for `useChart(...)`.
 *
 * This is the common case: one dataset, one optional schema, one optional
 * human-readable source label.
 */
export interface SingleSourceOptions<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
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
   * Use this when you want to:
   * - rename fields with `label`
   * - force or refine column `type`
   * - add `format`
   * - exclude fields
   * - create derived columns
   * - restrict what users can select in the chart UI
   */
  schema?: DefinedChartSchema<T, Exclude<TSchema, undefined>>
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
 * Use this when the user should be able to switch between several datasets that
 * may each have their own schema.
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
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = SingleSourceOptions<T, TSchema> | MultiSourceOptions

export type {ChartSourceOptions}

/**
 * Default time bucket used for date charts.
 */
export const DEFAULT_TIME_BUCKET = 'month' as const
