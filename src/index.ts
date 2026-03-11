/**
 * chart-studio — TanStack Table for charts.
 *
 * A headless, composable charting library built on top of Recharts.
 * Pass raw data, optionally add column hints, and get a full interactive chart with
 * automatic filtering, grouping, time bucketing, and chart type switching.
 * Move to `config` when you want the explicit chart contract to become authoritative.
 *
 * @example
 * ```tsx
 * import { useChart } from '@matthieumordrel/chart-studio'
 * import { Chart, ChartToolbar, ChartCanvas } from '@matthieumordrel/chart-studio/ui'
 *
 * function MyChart({ data }) {
 *   const chart = useChart({
 *     data,
 *     columnHints: {
 *       dateAdded: { label: 'Date Added', type: 'date' },
 *       ownerName: { label: 'Consultant' },
 *       salary: { format: 'currency' }
 *     }
 *   })
 *   return (
 *     <Chart chart={chart}>
 *       <ChartToolbar />
 *       <ChartCanvas />
 *     </Chart>
 *   )
 * }
 * ```
 */

// Headless charting API.
export {
  CHART_TYPE_CONFIG,
  inferColumnsFromData,
  useChart,
  getSeriesColor,
  buildColorMap,
  runPipeline,
  applyFilters,
  extractAvailableFilters,
  buildAvailableMetrics,
  getMetricLabel,
} from './core/index.js'

export type {
  ChartSourceOptions,
  ChartAxisType,
  ChartTypeCapabilities,
  UseChartOptions,
  PipelineInput,
  PipelineOutput,
  ChartColumn,
  ChartColumnType,
  ColumnFormatPreset,
  ColumnHints,
  ColumnHintFor,
  InferableFieldKey,
  ResolvedColumnIdFromHints,
  SelectableControlConfig,
  XAxisConfig,
  GroupByConfig,
  FiltersConfig,
  MetricConfig,
  ChartTypeConfig,
  TimeBucketConfig,
  ChartConfig,
  ChartConfigFromHints,
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
  CountMetric,
  AggregateMetric,
  Metric,
  FilterState,
  SortDirection,
  SortConfig,
  MultiSourceChartInstance,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
} from './core/index.js'
