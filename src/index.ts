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
 *     schema: defineChartSchema<typeof data[number]>()
 *       .columns((c) => [
 *         c.date('dateAdded', { label: 'Date Added' }),
 *         c.category('ownerName', { label: 'Consultant' }),
 *         c.number('salary', { format: 'currency' }),
 *       ])
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
  defineDataModel,
  defineDashboard,
  defineDataset,
  defineChartSchema,
  inferColumnsFromData,
  useChart,
  useDashboard,
  useDashboardChart,
  useDashboardContext,
  useDashboardDataset,
  useDashboardSharedFilter,
  DashboardProvider,
  validateDatasetData,
  getSeriesColor,
  buildColorMap,
  runPipeline,
  applyFilters,
  extractAvailableFilters,
  buildAvailableMetrics,
  getMetricLabel,
  resolveDashboardDefinition,
} from './core/index.js'

export type {
  DataModelDefinition,
  DataModelBuilder,
  DefinedDataModel,
  ModelAssociationDefinition,
  ModelAttributeDefinition,
  ModelDataInput,
  ModelDatasetId,
  ModelRelationshipDefinition,
  ResolvedDataModelFromDefinition,
  SelectAttributeConfig,
  DashboardBuilder,
  DashboardChartIdFromDefinition,
  DashboardChartInstanceFromDefinition,
  DashboardDataInputFromDefinition,
  DashboardDatasetIdFromDefinition,
  DashboardDatasetRowsFromDefinition,
  DashboardDateRangeSelection,
  DashboardDefinition,
  DashboardLocalSharedSelectFilterConfig,
  DashboardResolvedChart,
  DashboardResolvedChartOwnership,
  DashboardRuntime,
  DashboardSharedDateRangeFilterConfig,
  DashboardSharedDateRangeFilterDefinition,
  DashboardSharedDateRangeFilterRuntime,
  DashboardSharedDateRangePresetId,
  DashboardSharedFilterDefinition,
  DashboardSharedFilterIdFromDefinition,
  DashboardSharedFilterRuntime,
  DashboardSharedFilterRuntimeFromDefinition,
  DashboardSharedFilters,
  DashboardSharedSelectFilterRuntime,
  DashboardSharedSelectTarget,
  DashboardSharedDateRangeTarget,
  DefinedDashboard,
  ResolvedDashboardFromDefinition,
  DatasetBuilder,
  DatasetChartBuilder,
  DatasetChartDefinition,
  DatasetDefinition,
  DatasetKey,
  DatasetRow,
  DefinedDatasetChartSchema,
  DefinedDataset,
  SingleDatasetKeyId,
  ChartSourceOptions,
  ChartAxisType,
  ChartTypeCapabilities,
  UseChartOptions,
  PipelineInput,
  PipelineOutput,
  ChartColumn,
  ChartColumnType,
  ColumnFormat,
  ColumnFormatPreset,
  NumberColumnFormat,
  DateColumnFormat,
  RawColumnSchemaFor,
  RawColumnSchemaMap,
  DerivedColumnSchema,
  DerivedDateColumnSchema,
  DerivedCategoryColumnSchema,
  DerivedBooleanColumnSchema,
  DerivedNumberColumnSchema,
  ChartSchema,
  ChartSchemaDefinition,
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
  ChartControlMode,
  ChartDataScopeControlState,
  ChartDataScopeInputs,
  ChartDataScopeInputsFromSchemaDefinition,
  ChartDateRangeSelection,
  SortDirection,
  SortConfig,
  MultiSourceChartInstance,
  MultiSourceChartDataScopeInputs,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
  ChartInstanceFromSchema,
  ChartInstanceFromSchemaDefinition,
} from './core/index.js'
