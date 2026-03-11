/**
 * chart-studio — TanStack Table for charts.
 *
 * A headless, composable charting library built on top of Recharts.
 * Pass raw data for the zero-config path, or add an explicit `schema` when you
 * want full control over inference overrides, derived columns, and selectable
 * chart controls.
 *
 * @example
 * ```tsx
 * import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'
 * import { Chart, ChartToolbar, ChartCanvas } from '@matthieumordrel/chart-studio/ui'
 *
 * function MyChart({ data }) {
 *   const chart = useChart({
 *     data,
 *     schema: defineChartSchema<typeof data[number]>()({
 *       columns: {
 *         dateAdded: { label: 'Date Added', type: 'date' },
 *         ownerName: { label: 'Consultant' },
 *         salary: { format: 'currency' }
 *       }
 *     })
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
  defineChartSchema,
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
  RawColumnSchemaFor,
  RawColumnSchemaMap,
  DerivedColumnSchema,
  DerivedDateColumnSchema,
  DerivedCategoryColumnSchema,
  DerivedBooleanColumnSchema,
  DerivedNumberColumnSchema,
  ChartSchema,
  DefinedChartSchema,
  ValidatedChartSchema,
  InferableFieldKey,
  ResolvedColumnIdFromSchema,
  SelectableControlConfig,
  XAxisConfig,
  GroupByConfig,
  FiltersConfig,
  MetricConfig,
  ChartTypeConfig,
  TimeBucketConfig,
  RestrictedXAxisColumnIdFromSchema,
  RestrictedGroupByColumnIdFromSchema,
  RestrictedFilterColumnIdFromSchema,
  RestrictedMetricFromSchema,
  RestrictedChartTypeFromSchema,
  RestrictedTimeBucketFromSchema,
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
  ChartInstanceFromSchema,
} from './core/index.js'
