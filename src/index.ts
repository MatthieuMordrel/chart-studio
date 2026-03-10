/**
 * chart-studio — TanStack Table for charts.
 *
 * A headless, composable charting library built on top of Recharts.
 * Define columns, pass data, and get a full interactive chart with
 * automatic filtering, grouping, time bucketing, and chart type switching.
 *
 * @example
 * ```tsx
 * import { useChart, columns } from '@matthieumordrel/chart-studio'
 * import { Chart, ChartToolbar, ChartCanvas } from '@matthieumordrel/chart-studio/ui'
 *
 * const jobColumns = [
 *   columns.date('dateAdded', { label: 'Date Added' }),
 *   columns.category('ownerName', { label: 'Consultant' }),
 *   columns.boolean('isOpen', { trueLabel: 'Open', falseLabel: 'Closed' }),
 * ]
 *
 * function MyChart({ data }) {
 *   const chart = useChart({ data, columns: jobColumns })
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
