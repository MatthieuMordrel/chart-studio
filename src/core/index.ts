/**
 * Core exports for chart-studio.
 *
 * The headless layer: types, inference, pipeline, and the useChart hook.
 */

export {CHART_TYPE_CONFIG} from './chart-capabilities.js'
export {getSeriesColor, buildColorMap} from './colors.js'
export {defineChartConfig} from './define-chart-config.js'
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
  SelectableControlConfig,
  XAxisConfig,
  GroupByConfig,
  FiltersConfig,
  MetricConfig,
  ChartTypeConfig,
  TimeBucketConfig,
  ChartConfig,
  ChartConfigFromHints,
  ValidatedChartConfigFromHints,
  RestrictedXAxisColumnIdFromConfig,
  RestrictedGroupByColumnIdFromConfig,
  RestrictedFilterColumnIdFromConfig,
  RestrictedMetricFromConfig,
  RestrictedChartTypeFromConfig,
  RestrictedTimeBucketFromConfig,
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
  NumericAggregateSelection,
  CountMetric,
  AggregateMetric,
  AggregateMetricAllowance,
  Metric,
  MetricAllowance,
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
