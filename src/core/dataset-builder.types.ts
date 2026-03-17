import type {
  BuilderSchemaState,
  ChartSchemaBuilder,
  ColumnHelper,
  ColumnsFromEntries,
  MetricBuilder,
  MetricBuilderConfig,
  SchemaColumnEntry,
  SelectableControlBuilder,
  SelectableControlBuilderConfig,
  ValidateColumnEntries,
  SchemaFromBuilder,
} from './schema-builder.types.js'
import type {
  ChartType,
  ChartTypeConfig,
  DefinedChartSchema,
  FiltersConfig,
  GroupByConfig,
  InferableFieldKey,
  MetricConfig,
  ResolvedFilterColumnIdFromSchema,
  ResolvedGroupByColumnIdFromSchema,
  ResolvedMetricColumnIdFromSchema,
  ResolvedXAxisColumnIdFromSchema,
  TimeBucket,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'
import type {DatasetChartMetadata} from './dataset-chart-metadata.js'
import {DATASET_CHART_METADATA} from './dataset-chart-metadata.js'

type NonEmptyReadonlyArray<TValue> = readonly [TValue, ...TValue[]]

type DatasetColumnsContext<TColumns extends Record<string, unknown> | undefined> =
  [TColumns] extends [undefined]
    ? undefined
    : {columns?: TColumns}

export type DefinedDatasetChartSchema<
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TXAxis extends XAxisConfig<any> | undefined,
  TGroupBy extends GroupByConfig<any> | undefined,
  TFilters extends FiltersConfig<any> | undefined,
  TMetric extends MetricConfig<any> | undefined,
  TChartType extends ChartTypeConfig | undefined,
  TTimeBucket extends TimeBucketConfig | undefined,
  TConnectNulls extends boolean | undefined,
  TChartId extends string | undefined = undefined,
> = DefinedChartSchema<
  TRow,
  SchemaFromBuilder<
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >
> & {
  readonly [DATASET_CHART_METADATA]: DatasetChartMetadata<TChartId>
}

export type DatasetKey<TRow> = NonEmptyReadonlyArray<InferableFieldKey<TRow>>

export type DatasetBuilderState<
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
> = {
  columns?: TColumns
  key?: TKey
}

export type DefinedDataset<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TKey extends DatasetKey<TRow> | undefined = undefined,
> = {
  readonly key?: TKey
  readonly columns?: TColumns
  chart<const TChartId extends string | undefined = undefined>(
    id?: TChartId,
  ): DatasetChartBuilder<TRow, TColumns>
  validateData(data: readonly TRow[]): void
  build(): DefinedDataset<TRow, TColumns, TKey>
  readonly __datasetBrand: 'dataset-definition'
}

export type DatasetDefinition<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TKey extends DatasetKey<TRow> | undefined = undefined,
> = {
  build(): DefinedDataset<TRow, TColumns, TKey>
}

export type ResolvedDatasetFromDefinition<TDataset> =
  TDataset extends DatasetDefinition<any, any, any>
    ? ReturnType<TDataset['build']>
    : never

export type DatasetRow<TDataset> =
  TDataset extends DefinedDataset<infer TRow, any, any>
    ? TRow
    : never

export type DatasetColumns<TDataset> =
  TDataset extends DefinedDataset<any, infer TColumns, any>
    ? TColumns
    : never

export type DatasetKeyIds<TDataset> =
  TDataset extends DefinedDataset<any, any, infer TKey>
    ? TKey
    : never

export type SingleDatasetKeyId<TDataset> =
  DatasetKeyIds<TDataset> extends readonly [infer TKeyId extends string]
    ? TKeyId
    : never

export type DatasetChartBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
  TChartId extends string | undefined = undefined,
> = {
  xAxis<const TBuilder extends SelectableControlBuilder<
    ResolvedXAxisColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
    true
  >>(
    defineXAxis: (
      xAxis: SelectableControlBuilder<
        ResolvedXAxisColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
        true
      >,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    SelectableControlBuilderConfig<TBuilder>,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >

  groupBy<const TBuilder extends SelectableControlBuilder<
    ResolvedGroupByColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
    true
  >>(
    defineGroupBy: (
      groupBy: SelectableControlBuilder<
        ResolvedGroupByColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
        true
      >,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    SelectableControlBuilderConfig<TBuilder>,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >

  filters<const TBuilder extends SelectableControlBuilder<
    ResolvedFilterColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
    false
  >>(
    defineFilters: (
      filters: SelectableControlBuilder<
        ResolvedFilterColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
        false
      >,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    SelectableControlBuilderConfig<TBuilder>,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >

  metric<const TBuilder extends MetricBuilder<
    ResolvedMetricColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>,
    any,
    any,
    any
  >>(
    defineMetric: (
      metric: MetricBuilder<
        ResolvedMetricColumnIdFromSchema<TRow, DatasetColumnsContext<TColumns>>
      >,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    MetricBuilderConfig<TBuilder>,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >

  chartType<const TBuilder extends SelectableControlBuilder<ChartType, true>>(
    defineChartType: (
      chartType: SelectableControlBuilder<ChartType, true>,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    SelectableControlBuilderConfig<TBuilder>,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >

  timeBucket<const TBuilder extends SelectableControlBuilder<TimeBucket, true>>(
    defineTimeBucket: (
      timeBucket: SelectableControlBuilder<TimeBucket, true>,
    ) => TBuilder,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    SelectableControlBuilderConfig<TBuilder>,
    TConnectNulls,
    TChartId
  >

  connectNulls<const TValue extends boolean>(
    value: TValue,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TValue,
    TChartId
  >

  build(): DefinedDatasetChartSchema<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId
  >
  readonly [DATASET_CHART_METADATA]: DatasetChartMetadata<TChartId>
}

export type DatasetChartDefinition<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
  TChartId extends string | undefined = undefined,
> =
  | DatasetChartBuilder<
      TRow,
      TColumns,
      TXAxis,
      TGroupBy,
      TFilters,
      TMetric,
      TChartType,
      TTimeBucket,
      TConnectNulls,
      TChartId
    >
  | DefinedDatasetChartSchema<
      TRow,
      TColumns,
      TXAxis,
      TGroupBy,
      TFilters,
      TMetric,
      TChartType,
      TTimeBucket,
      TConnectNulls,
      TChartId
    >

export type DatasetChartBuilderState<
  TColumns extends Record<string, unknown> | undefined,
  TXAxis extends XAxisConfig<any> | undefined,
  TGroupBy extends GroupByConfig<any> | undefined,
  TFilters extends FiltersConfig<any> | undefined,
  TMetric extends MetricConfig<any> | undefined,
  TChartType extends ChartTypeConfig | undefined,
  TTimeBucket extends TimeBucketConfig | undefined,
  TConnectNulls extends boolean | undefined,
> = BuilderSchemaState<
  TColumns,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls
>

export interface DatasetBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TKey extends DatasetKey<TRow> | undefined = undefined,
> extends DatasetDefinition<TRow, TColumns, TKey> {
  key<const TFieldId extends InferableFieldKey<TRow>>(
    id: TFieldId,
  ): DatasetBuilder<TRow, TColumns, readonly [TFieldId]>
  key<const TKeyIds extends DatasetKey<TRow>>(
    ids: TKeyIds,
  ): DatasetBuilder<TRow, TColumns, TKeyIds>

  columns: TColumns extends undefined
    ? <const TEntries extends readonly SchemaColumnEntry<TRow>[]>(
        defineColumns: (columns: ColumnHelper<TRow>) => TEntries & ValidateColumnEntries<TEntries>,
      ) => DatasetBuilder<
        TRow,
        ColumnsFromEntries<TRow, TEntries>,
        TKey
      >
    : never

  chart<const TChartId extends string | undefined = undefined>(
    id?: TChartId,
  ): DatasetChartBuilder<TRow, TColumns, undefined, undefined, undefined, undefined, undefined, undefined, undefined, TChartId>

  validateData(data: readonly TRow[]): void

  build(): DefinedDataset<TRow, TColumns, TKey>
}

export type ChartSchemaShortcutBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
> = ChartSchemaBuilder<
  TRow,
  TColumns,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls
>
