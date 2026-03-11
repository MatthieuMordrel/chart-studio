/**
 * chart-studio — TanStack Table for charts.
 *
 * A headless, composable charting library built on top of Recharts.
 * Define columns, pass data, and get a full interactive chart with
 * automatic filtering, grouping, time bucketing, and chart type switching.
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
  columns,
  defineColumns,
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
  DataSource,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
} from './core/index.js'
