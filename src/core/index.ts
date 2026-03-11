/**
 * Core exports for chart-studio.
 *
 * The headless layer: types, column helpers, pipeline, and the useChart hook.
 */

export {columns, defineColumns} from './columns.js'
export {CHART_TYPE_CONFIG} from './chart-capabilities.js'
export {getSeriesColor, buildColorMap} from './colors.js'
export {inferColumnsFromData} from './infer-columns.js'
export {buildAvailableMetrics, getMetricLabel} from './metric-utils.js'
export {runPipeline, applyFilters, extractAvailableFilters} from './pipeline.js'
export type {PipelineInput, PipelineOutput} from './pipeline.js'
export {useChart} from './use-chart.js'
export type {UseChartOptions} from './use-chart-options.js'
export type {ChartAxisType, ChartTypeCapabilities} from './chart-capabilities.js'

export type {
  ChartColumn,
  ChartColumnType,
  ColumnFormatPreset,
  ColumnHints,
  ColumnHintFor,
  InferableFieldKey,
  ResolvedColumnIdFromHints,
  DateColumn,
  CategoryColumn,
  BooleanColumn,
  NumberColumn,
  ChartType,
  TimeSeriesChartType,
  CategoricalChartType,
  TimeBucket,
  AggregateFunction,
  NumericAggregateFunction,
  CountMetric,
  AggregateMetric,
  Metric,
  FilterState,
  SortDirection,
  SortConfig,
  DateRange,
  DateRangeFilter,
  DataSource,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
} from './types.js'
