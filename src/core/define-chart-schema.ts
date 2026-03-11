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

/**
 * Define one explicit chart schema with strict exact-object checking.
 *
 * The schema is the single advanced authoring surface for chart-studio:
 * `columns` can override or exclude inferred raw fields and also define derived
 * columns, while the top-level control sections restrict the public chart
 * contract.
 */
export function defineChartSchema<T>() {
  /**
   * Brand one schema object while preserving its literal types.
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
    schema: {
      columns?: TColumns & ExactShape<SchemaColumnsValidationShape<T, NoInfer<TColumns>>, NoInfer<TColumns>>
      xAxis?: TXAxis
        & ExactShape<XAxisConfig<ResolvedXAxisColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TXAxis>>
      groupBy?: TGroupBy
        & ExactShape<GroupByConfig<ResolvedGroupByColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TGroupBy>>
      filters?: TFilters
        & ExactShape<FiltersConfig<ResolvedFilterColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TFilters>>
      metric?: TMetric
        & ExactShape<MetricConfig<ResolvedMetricColumnIdFromSchema<T, {columns?: TColumns}>>, NoInfer<TMetric>>
      chartType?: TChartType
        & ExactShape<ChartTypeConfig, NoInfer<TChartType>>
      timeBucket?: TTimeBucket
        & ExactShape<TimeBucketConfig, NoInfer<TTimeBucket>>
    },
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
