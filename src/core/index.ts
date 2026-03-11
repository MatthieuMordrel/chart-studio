/**
 * Core exports for chart-studio.
 *
 * The headless layer: types, inference, pipeline, and the useChart hook.
 */

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
  ChartSourceOptions,
  ChartColumn,
  ChartColumnType,
  ColumnFormatPreset,
  ColumnHints,
  ColumnHintFor,
  InferableFieldKey,
  ResolvedColumnIdFromHints,
  ResolvedXAxisColumnIdFromHints,
  ResolvedGroupByColumnIdFromHints,
  ResolvedFilterColumnIdFromHints,
  ResolvedMetricColumnIdFromHints,
  ResolvedDateColumnIdFromHints,
  GroupByToolConfig,
  MetricToolConfig,
  ChartToolsConfig,
  ChartToolsConfigFromHints,
  RestrictedGroupByColumnIdFromTools,
  RestrictedMetricFromTools,
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
  MultiSourceChartInstance,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
  ChartInstanceFromConfig,
  ChartInstanceFromHints,
} from './types.js'
