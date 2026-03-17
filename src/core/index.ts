/**
 * Core exports for chart-studio.
 *
 * The headless layer: types, inference, pipeline, and the useChart hook.
 */

export {CHART_TYPE_CONFIG} from './chart-capabilities.js'
export {DATA_LABEL_DEFAULTS, resolveShowDataLabels} from './data-label-defaults.js'
export type {DataLabelDefaults, DataLabelStyle, DataLabelPosition} from './data-label-defaults.js'
export {getSeriesColor, buildColorMap} from './colors.js'
export {DATE_RANGE_PRESETS, autoFilterForBucket, resolvePresetFilter, getPresetLabel} from './date-range-presets.js'
export type {DateRangePreset} from './date-range-presets.js'
export {defineDataModel} from './define-data-model.js'
export {defineDataset, validateDatasetData} from './define-dataset.js'
export {defineChartSchema} from './define-chart-schema.js'
export {inferColumnsFromData} from './infer-columns.js'
export {buildAvailableMetrics, getMetricLabel} from './metric-utils.js'
export {runPipeline, applyFilters, extractAvailableFilters} from './pipeline.js'
export type {PipelineInput, PipelineOutput} from './pipeline.js'
export {useChart} from './use-chart.js'
export type {UseChartOptions} from './use-chart-options.js'
export type {ChartAxisType, ChartTypeCapabilities} from './chart-capabilities.js'

export type {
  DataModelDefinition,
  DataModelBuilder,
  DefinedDataModel,
  ModelAssociationDefinition,
  ModelAttributeDefinition,
  ModelDataInput,
  ModelDatasetId,
  ModelRelationshipDefinition,
  SelectAttributeConfig,
} from './data-model.types.js'
export type {
  DatasetBuilder,
  DatasetChartBuilder,
  DatasetDefinition,
  DatasetKey,
  DatasetRow,
  DefinedDataset,
  SingleDatasetKeyId,
} from './dataset-builder.types.js'
export type {
  ChartSourceOptions,
  ChartColumn,
  ChartColumnType,
  ColumnFormat,
  ColumnFormatPreset,
  DurationInputUnit,
  NumberColumnFormat,
  DateColumnFormat,
  DurationColumnFormat,
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
  ResolvedXAxisColumnIdFromSchema,
  ResolvedGroupByColumnIdFromSchema,
  ResolvedFilterColumnIdFromSchema,
  ResolvedMetricColumnIdFromSchema,
  ResolvedDateColumnIdFromSchema,
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
  NumericAggregateSelection,
  CountMetric,
  AggregateMetric,
  AggregateMetricAllowance,
  Metric,
  MetricAllowance,
  FilterState,
  ChartControlMode,
  ChartDataScopeControlState,
  ChartDataScopeInputs,
  ChartDataScopeInputsFromSchemaDefinition,
  ChartDateRangeSelection,
  SortDirection,
  SortConfig,
  DateRange,
  DateRangeFilter,
  DateRangePresetId,
  MultiSourceChartInstance,
  MultiSourceChartDataScopeInputs,
  ChartSeries,
  TransformedDataPoint,
  AvailableFilter,
  ChartInstance,
  ChartInstanceFromSchema,
  ChartInstanceFromSchemaDefinition,
} from './types.js'
