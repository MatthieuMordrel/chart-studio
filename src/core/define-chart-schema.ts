import type {
  ChartTypeConfig,
  DefinedChartSchema,
  ExactShape,
  FiltersConfig,
  GroupByConfig,
  MetricConfig,
  ResolvedFilterColumnIdFromSchema,
  ResolvedGroupByColumnIdFromSchema,
  ResolvedMetricColumnIdFromSchema,
  ResolvedXAxisColumnIdFromSchema,
  SchemaColumnsValidationShape,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'

type SchemaFromSections<
  T,
  TColumns extends Record<string, unknown> | undefined,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
> = {
  columns?: Extract<TColumns, Record<string, unknown> | undefined>
  xAxis?: Extract<TXAxis, XAxisConfig<ResolvedXAxisColumnIdFromSchema<T, {columns?: TColumns}>> | undefined>
  groupBy?: Extract<TGroupBy, GroupByConfig<ResolvedGroupByColumnIdFromSchema<T, {columns?: TColumns}>> | undefined>
  filters?: Extract<TFilters, FiltersConfig<ResolvedFilterColumnIdFromSchema<T, {columns?: TColumns}>> | undefined>
  metric?: Extract<TMetric, MetricConfig<ResolvedMetricColumnIdFromSchema<T, {columns?: TColumns}>> | undefined>
  chartType?: Extract<TChartType, ChartTypeConfig | undefined>
  timeBucket?: Extract<TTimeBucket, TimeBucketConfig | undefined>
}

type DefineChartSchemaInput<
  T,
  TColumns extends Record<string, unknown> | undefined,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
> = {
  /**
   * Shape the available chart columns.
   *
   * This is usually the most important part of the schema. Use it to:
   * - rename inferred raw fields with `label`
   * - force a field to a specific `type`
   * - apply `format` or `formatter`
   * - remove a raw field with `false`
   * - add brand new derived columns with `kind: 'derived'`
   */
  columns?: TColumns
    & ExactShape<SchemaColumnsValidationShape<T, NoInfer<TColumns>>, NoInfer<TColumns>>
  /**
   * Restrict which resolved columns may be selected on the X-axis.
   *
   * Use this when you want to expose only a subset of possible X-axis fields.
   */
  xAxis?: TXAxis
    & ExactShape<XAxisConfig<ResolvedXAxisColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TXAxis>>
  /**
   * Restrict which resolved columns may be used to split the chart into series.
   *
   * This powers grouped / multi-series charts.
   */
  groupBy?: TGroupBy
    & ExactShape<GroupByConfig<ResolvedGroupByColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TGroupBy>>
  /**
   * Restrict which resolved columns appear in the filters UI.
   *
   * Only category and boolean-like columns are eligible here.
   */
  filters?: TFilters
    & ExactShape<FiltersConfig<ResolvedFilterColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TFilters>>
  /**
   * Restrict which metrics and aggregate combinations remain selectable.
   *
   * Use this when you want to curate the metric dropdown rather than exposing
   * every available numeric aggregate.
   */
  metric?: TMetric
    & ExactShape<MetricConfig<ResolvedMetricColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TMetric>>
  /** Restrict which chart renderers are available to the user. */
  chartType?: TChartType
    & ExactShape<ChartTypeConfig, NoInfer<TChartType>>
  /**
   * Restrict which time buckets remain available for date X-axes.
   *
   * Example: allow only `'month'` and `'quarter'`.
   */
  timeBucket?: TTimeBucket
    & ExactShape<TimeBucketConfig, NoInfer<TTimeBucket>>
}

/**
 * Define one explicit chart schema with strict exact-object checking.
 *
 * The schema is the single advanced authoring surface for chart-studio:
 * `columns` can override or exclude inferred raw fields and also define derived
 * columns, while the top-level control sections restrict the public chart
 * contract.
 *
 * Typical shape:
 *
 * ```ts
 * const schema = defineChartSchema<Row>()({
 *   columns: {
 *     createdAt: {type: 'date', label: 'Created'},
 *     revenue: {type: 'number', format: 'currency'},
 *     margin: {
 *       kind: 'derived',
 *       type: 'number',
 *       label: 'Margin',
 *       format: 'percent',
 *       accessor: row => row.profit / row.revenue,
 *     },
 *   },
 *   xAxis: {allowed: ['createdAt']},
 *   metric: {
 *     allowed: [{kind: 'aggregate', columnId: 'revenue', aggregate: 'sum'}],
 *   },
 * })
 * ```
 */
export function defineChartSchema<T>() {
  /**
   * Brand one schema object while preserving its literal types.
   *
   * This is what lets the schema stay both strongly typed and editor-friendly
   * when it is later passed to `useChart(...)`.
   */
  return function defineSchema<
    const TColumns extends Record<string, unknown> | undefined = undefined,
    const TXAxis = undefined,
    const TGroupBy = undefined,
    const TFilters = undefined,
    const TMetric = undefined,
    const TChartType = undefined,
    const TTimeBucket = undefined,
  >(
    schema: DefineChartSchemaInput<T, TColumns, TXAxis, TGroupBy, TFilters, TMetric, TChartType, TTimeBucket>,
  ): DefinedChartSchema<
    T,
    SchemaFromSections<T, TColumns, TXAxis, TGroupBy, TFilters, TMetric, TChartType, TTimeBucket>
  > {
    return {
      ...schema,
      __chartSchemaBrand: 'chart-schema-definition',
    } as DefinedChartSchema<
      T,
      SchemaFromSections<T, TColumns, TXAxis, TGroupBy, TFilters, TMetric, TChartType, TTimeBucket>
    >
  }
}
