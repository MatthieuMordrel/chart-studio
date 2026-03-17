import type {
  DatasetColumns,
  DatasetRow,
  DefinedDatasetChartSchema,
} from './dataset-builder.types.js'
import type {
  ModelDatasetId,
  ModelDatasets,
  DefinedDataModel,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {MaterializedViewDefinition} from './materialized-view.types.js'
import type {
  MetricBuilder,
  MetricBuilderConfig,
  SelectableControlBuilder,
  SelectableControlBuilderConfig,
} from './schema-builder.types.js'
import type {
  ChartType,
  ChartTypeConfig,
  ColumnHintFor,
  FiltersConfig,
  GroupByConfig,
  MetricConfig,
  TimeBucket,
  TimeBucketConfig,
  XAxisConfig,
  ResolvedFilterColumnIdFromSchema,
  ResolvedGroupByColumnIdFromSchema,
  ResolvedMetricColumnIdFromSchema,
  ResolvedXAxisColumnIdFromSchema,
} from './types.js'

type Simplify<T> = {
  [TKey in keyof T]: T[TKey]
} & {}

declare const MODEL_CHART_BUILDER_KIND: unique symbol

type IsUnion<T, TWhole = T> =
  T extends TWhole
    ? ([TWhole] extends [T] ? false : true)
    : never

type StripIdSuffix<TValue extends string> =
  TValue extends `${infer TPrefix}Id`
    ? TPrefix
    : never

type MergeColumns<
  TLeft extends Record<string, unknown> | undefined,
  TRight extends Record<string, unknown>,
> = [TLeft] extends [Record<string, unknown>]
  ? Simplify<Extract<TLeft, Record<string, unknown>> & TRight>
  : TRight

type UnionToIntersection<TUnion> = (
  TUnion extends unknown ? (value: TUnion) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type AliasableLookupRelationshipUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends string,
> = {
  [TRelationshipId in keyof TRelationships]:
    TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
      infer TFromDatasetId extends string,
      TBaseDatasetId,
      any,
      infer TToColumn extends string
    >
      ? StripIdSuffix<TToColumn> extends infer TAlias extends string
        ? TToColumn extends `${string}Id`
          ? {
              id: Extract<TRelationshipId, string>
              alias: TAlias
              fromDataset: TFromDatasetId
              toColumn: TToColumn
            }
          : never
        : never
      : never
}[keyof TRelationships]

type UniqueLookupRelationshipUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends string,
> = AliasableLookupRelationshipUnion<TRelationships, TBaseDatasetId> extends infer TRelationship
  ? TRelationship extends {alias: infer TAlias extends string}
    ? IsUnion<Extract<AliasableLookupRelationshipUnion<TRelationships, TBaseDatasetId>, {alias: TAlias}>['fromDataset']> extends true
      ? never
      : TRelationship
    : never
  : never

type DirectXAxisFieldId<
  TDatasets extends ModelDatasets,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> = ResolvedXAxisColumnIdFromSchema<
  DatasetRow<TDatasets[TBaseDatasetId]>,
  TDatasets[TBaseDatasetId]
>

type DirectGroupByFieldId<
  TDatasets extends ModelDatasets,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> = ResolvedGroupByColumnIdFromSchema<
  DatasetRow<TDatasets[TBaseDatasetId]>,
  TDatasets[TBaseDatasetId]
>

type DirectFilterFieldId<
  TDatasets extends ModelDatasets,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> = ResolvedFilterColumnIdFromSchema<
  DatasetRow<TDatasets[TBaseDatasetId]>,
  TDatasets[TBaseDatasetId]
>

type DirectMetricFieldId<
  TDatasets extends ModelDatasets,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> = ResolvedMetricColumnIdFromSchema<
  DatasetRow<TDatasets[TBaseDatasetId]>,
  TDatasets[TBaseDatasetId]
>

export type ModelChartXAxisFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> =
  | DirectXAxisFieldId<TDatasets, TBaseDatasetId>
  | Extract<
      UniqueLookupRelationshipUnion<TRelationships, TBaseDatasetId> extends infer TRelationship
        ? TRelationship extends {
            alias: infer TAlias extends string
            fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
          }
          ? `${TAlias}.${ResolvedXAxisColumnIdFromSchema<
              DatasetRow<TDatasets[TFromDatasetId]>,
              TDatasets[TFromDatasetId]
            >}`
          : never
        : never,
      string
    >

export type ModelChartGroupByFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> =
  | DirectGroupByFieldId<TDatasets, TBaseDatasetId>
  | Extract<
      UniqueLookupRelationshipUnion<TRelationships, TBaseDatasetId> extends infer TRelationship
        ? TRelationship extends {
            alias: infer TAlias extends string
            fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
          }
          ? `${TAlias}.${ResolvedGroupByColumnIdFromSchema<
              DatasetRow<TDatasets[TFromDatasetId]>,
              TDatasets[TFromDatasetId]
            >}`
          : never
        : never,
      string
    >

export type ModelChartFilterFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> =
  | DirectFilterFieldId<TDatasets, TBaseDatasetId>
  | Extract<
      UniqueLookupRelationshipUnion<TRelationships, TBaseDatasetId> extends infer TRelationship
        ? TRelationship extends {
            alias: infer TAlias extends string
            fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
          }
          ? `${TAlias}.${ResolvedFilterColumnIdFromSchema<
              DatasetRow<TDatasets[TFromDatasetId]>,
              TDatasets[TFromDatasetId]
            >}`
          : never
        : never,
      string
    >

export type ModelChartMetricFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> =
  | DirectMetricFieldId<TDatasets, TBaseDatasetId>
  | Extract<
      UniqueLookupRelationshipUnion<TRelationships, TBaseDatasetId> extends infer TRelationship
        ? TRelationship extends {
            alias: infer TAlias extends string
            fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
          }
          ? `${TAlias}.${ResolvedMetricColumnIdFromSchema<
              DatasetRow<TDatasets[TFromDatasetId]>,
              TDatasets[TFromDatasetId]
            >}`
          : never
        : never,
      string
    >

type QualifiedModelChartFieldId<
  TBaseDatasetId extends string,
  TFieldId extends string,
> = `${TBaseDatasetId}.${TFieldId}`

export type InferredModelChartXAxisFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = Extract<
  {
    [TBaseDatasetId in ModelDatasetId<TDatasets>]: QualifiedModelChartFieldId<
      TBaseDatasetId,
      ModelChartXAxisFieldId<TDatasets, TRelationships, TBaseDatasetId>
    >
  }[ModelDatasetId<TDatasets>],
  string
>

export type InferredModelChartGroupByFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = Extract<
  {
    [TBaseDatasetId in ModelDatasetId<TDatasets>]: QualifiedModelChartFieldId<
      TBaseDatasetId,
      ModelChartGroupByFieldId<TDatasets, TRelationships, TBaseDatasetId>
    >
  }[ModelDatasetId<TDatasets>],
  string
>

export type InferredModelChartFilterFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = Extract<
  {
    [TBaseDatasetId in ModelDatasetId<TDatasets>]: QualifiedModelChartFieldId<
      TBaseDatasetId,
      ModelChartFilterFieldId<TDatasets, TRelationships, TBaseDatasetId>
    >
  }[ModelDatasetId<TDatasets>],
  string
>

export type InferredModelChartMetricFieldId<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = Extract<
  {
    [TBaseDatasetId in ModelDatasetId<TDatasets>]: QualifiedModelChartFieldId<
      TBaseDatasetId,
      ModelChartMetricFieldId<TDatasets, TRelationships, TBaseDatasetId>
    >
  }[ModelDatasetId<TDatasets>],
  string
>

type BaseDatasetIdFromQualifiedFieldId<TFieldId extends string> =
  TFieldId extends `${infer TBaseDatasetId}.${string}`
    ? TBaseDatasetId
    : never

type UniqueQualifiedBaseDatasetId<TFieldIds extends string> = [TFieldIds] extends [never]
  ? undefined
  : IsUnion<BaseDatasetIdFromQualifiedFieldId<TFieldIds>> extends true
    ? never
    : BaseDatasetIdFromQualifiedFieldId<TFieldIds>

type BaseDatasetIdFromSelectableBuilderConfig<TConfig> = UniqueQualifiedBaseDatasetId<
  Extract<SelectableConfigFieldIds<TConfig>, `${string}.${string}`>
>

type BaseDatasetIdFromMetricBuilderConfig<TConfig> = UniqueQualifiedBaseDatasetId<
  Extract<MetricConfigFieldIds<TConfig>, `${string}.${string}`>
>

type MergeInferredBaseDatasetId<
  TExistingBaseDatasetId extends string | undefined,
  TNextBaseDatasetId extends string | undefined,
> = [TExistingBaseDatasetId] extends [undefined]
  ? TNextBaseDatasetId
  : [TNextBaseDatasetId] extends [undefined]
    ? TExistingBaseDatasetId
    : TExistingBaseDatasetId extends TNextBaseDatasetId
      ? TExistingBaseDatasetId
      : never

export interface InferredModelChartBuilder<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
> {
  xAxis<const TBuilder extends SelectableControlBuilder<
    InferredModelChartXAxisFieldId<TDatasets, TRelationships>,
    true
  >>(
    defineXAxis: (
      xAxis: SelectableControlBuilder<
        InferredModelChartXAxisFieldId<TDatasets, TRelationships>,
        true
      >,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    MergeInferredBaseDatasetId<
      TBaseDatasetId,
      Extract<BaseDatasetIdFromSelectableBuilderConfig<SelectableControlBuilderConfig<TBuilder>>, ModelDatasetId<TDatasets> | undefined>
    >,
    SelectableControlBuilderConfig<TBuilder>,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  groupBy<const TBuilder extends SelectableControlBuilder<
    InferredModelChartGroupByFieldId<TDatasets, TRelationships>,
    true
  >>(
    defineGroupBy: (
      groupBy: SelectableControlBuilder<
        InferredModelChartGroupByFieldId<TDatasets, TRelationships>,
        true
      >,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    MergeInferredBaseDatasetId<
      TBaseDatasetId,
      Extract<BaseDatasetIdFromSelectableBuilderConfig<SelectableControlBuilderConfig<TBuilder>>, ModelDatasetId<TDatasets> | undefined>
    >,
    TXAxis,
    SelectableControlBuilderConfig<TBuilder>,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  filters<const TBuilder extends SelectableControlBuilder<
    InferredModelChartFilterFieldId<TDatasets, TRelationships>,
    false
  >>(
    defineFilters: (
      filters: SelectableControlBuilder<
        InferredModelChartFilterFieldId<TDatasets, TRelationships>,
        false
      >,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    MergeInferredBaseDatasetId<
      TBaseDatasetId,
      Extract<BaseDatasetIdFromSelectableBuilderConfig<SelectableControlBuilderConfig<TBuilder>>, ModelDatasetId<TDatasets> | undefined>
    >,
    TXAxis,
    TGroupBy,
    SelectableControlBuilderConfig<TBuilder>,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  metric<const TBuilder extends MetricBuilder<
    InferredModelChartMetricFieldId<TDatasets, TRelationships>,
    any,
    any,
    any
  >>(
    defineMetric: (
      metric: MetricBuilder<
        InferredModelChartMetricFieldId<TDatasets, TRelationships>
      >,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    MergeInferredBaseDatasetId<
      TBaseDatasetId,
      Extract<BaseDatasetIdFromMetricBuilderConfig<MetricBuilderConfig<TBuilder>>, ModelDatasetId<TDatasets> | undefined>
    >,
    TXAxis,
    TGroupBy,
    TFilters,
    MetricBuilderConfig<TBuilder>,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  chartType<const TBuilder extends SelectableControlBuilder<ChartType, true>>(
    defineChartType: (
      chartType: SelectableControlBuilder<ChartType, true>,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    SelectableControlBuilderConfig<TBuilder>,
    TTimeBucket,
    TConnectNulls
  >

  timeBucket<const TBuilder extends SelectableControlBuilder<TimeBucket, true>>(
    defineTimeBucket: (
      timeBucket: SelectableControlBuilder<TimeBucket, true>,
    ) => TBuilder,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    SelectableControlBuilderConfig<TBuilder>,
    TConnectNulls
  >

  connectNulls<const TValue extends boolean>(
    value: TValue,
  ): InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TValue
  >

  readonly [MODEL_CHART_BUILDER_KIND]: 'inferred'
}

export interface ModelChartStartBuilder<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> extends InferredModelChartBuilder<TDatasets, TRelationships> {
  from<const TBaseDatasetId extends ModelDatasetId<TDatasets>>(
    dataset: TBaseDatasetId,
  ): ModelChartBuilder<TDatasets, TRelationships, TBaseDatasetId>
}

export interface ModelChartBuilder<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
> {
  xAxis<const TBuilder extends SelectableControlBuilder<
    ModelChartXAxisFieldId<TDatasets, TRelationships, TBaseDatasetId>,
    true
  >>(
    defineXAxis: (
      xAxis: SelectableControlBuilder<
        ModelChartXAxisFieldId<TDatasets, TRelationships, TBaseDatasetId>,
        true
      >,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    SelectableControlBuilderConfig<TBuilder>,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  groupBy<const TBuilder extends SelectableControlBuilder<
    ModelChartGroupByFieldId<TDatasets, TRelationships, TBaseDatasetId>,
    true
  >>(
    defineGroupBy: (
      groupBy: SelectableControlBuilder<
        ModelChartGroupByFieldId<TDatasets, TRelationships, TBaseDatasetId>,
        true
      >,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    SelectableControlBuilderConfig<TBuilder>,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  filters<const TBuilder extends SelectableControlBuilder<
    ModelChartFilterFieldId<TDatasets, TRelationships, TBaseDatasetId>,
    false
  >>(
    defineFilters: (
      filters: SelectableControlBuilder<
        ModelChartFilterFieldId<TDatasets, TRelationships, TBaseDatasetId>,
        false
      >,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    SelectableControlBuilderConfig<TBuilder>,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  metric<const TBuilder extends MetricBuilder<
    ModelChartMetricFieldId<TDatasets, TRelationships, TBaseDatasetId>,
    any,
    any,
    any
  >>(
    defineMetric: (
      metric: MetricBuilder<
        ModelChartMetricFieldId<TDatasets, TRelationships, TBaseDatasetId>
      >,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    MetricBuilderConfig<TBuilder>,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >

  chartType<const TBuilder extends SelectableControlBuilder<ChartType, true>>(
    defineChartType: (
      chartType: SelectableControlBuilder<ChartType, true>,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    SelectableControlBuilderConfig<TBuilder>,
    TTimeBucket,
    TConnectNulls
  >

  timeBucket<const TBuilder extends SelectableControlBuilder<TimeBucket, true>>(
    defineTimeBucket: (
      timeBucket: SelectableControlBuilder<TimeBucket, true>,
    ) => TBuilder,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    SelectableControlBuilderConfig<TBuilder>,
    TConnectNulls
  >

  connectNulls<const TValue extends boolean>(
    value: TValue,
  ): ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TValue
  >

  readonly [MODEL_CHART_BUILDER_KIND]: 'explicit'
}

type ExplicitBuilderBaseDatasetId<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, infer TBaseDatasetId, any, any, any, any, any, any, any>
    ? TBaseDatasetId
    : never

type InferredBuilderBaseDatasetId<TBuilder> =
  TBuilder extends InferredModelChartBuilder<any, any, infer TBaseDatasetId, any, any, any, any, any, any, any>
    ? TBaseDatasetId
    : never

type BuilderXAxisConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, infer TXAxis, any, any, any, any, any, any>
    ? TXAxis
    : TBuilder extends InferredModelChartBuilder<any, any, any, infer TXAxis, any, any, any, any, any, any>
      ? TXAxis
    : never

type BuilderGroupByConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, infer TGroupBy, any, any, any, any, any>
    ? TGroupBy
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, infer TGroupBy, any, any, any, any, any>
      ? TGroupBy
    : never

type BuilderFiltersConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, any, infer TFilters, any, any, any, any>
    ? TFilters
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, any, infer TFilters, any, any, any, any>
      ? TFilters
    : never

type BuilderMetricConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, any, any, infer TMetric, any, any, any>
    ? TMetric
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, infer TMetric, any, any, any>
      ? TMetric
    : never

type BuilderChartTypeConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, any, any, any, infer TChartType, any, any>
    ? TChartType
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, infer TChartType, any, any>
      ? TChartType
    : never

type BuilderTimeBucketConfig<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, any, any, any, any, infer TTimeBucket, any>
    ? TTimeBucket
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, infer TTimeBucket, any>
      ? TTimeBucket
    : never

type BuilderConnectNulls<TBuilder> =
  TBuilder extends ModelChartBuilder<any, any, any, any, any, any, any, any, any, infer TConnectNulls>
    ? TConnectNulls
    : TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, any, infer TConnectNulls>
      ? TConnectNulls
    : never

type StripBaseDatasetPrefix<
  TFieldId extends string,
  TBaseDatasetId extends string,
> = TFieldId extends `${TBaseDatasetId}.${infer TRest}`
  ? TRest
  : TFieldId

type CompiledFieldId<TFieldId extends string> =
  TFieldId extends `${infer TAlias}.${infer TColumnId}`
    ? `${TAlias}${Capitalize<TColumnId>}`
    : TFieldId

type SelectableConfigFieldIds<TConfig> =
  | Extract<TConfig extends {allowed?: readonly (infer TAllowed extends string)[]} ? TAllowed : never, string>
  | Extract<TConfig extends {hidden?: readonly (infer THidden extends string)[]} ? THidden : never, string>
  | Extract<TConfig extends {default?: infer TDefault extends string} ? TDefault : never, string>

type MetricConfigFieldIds<TConfig> = Extract<
  | (TConfig extends {allowed?: readonly (infer TAllowed)[]} ? TAllowed : never)
  | (TConfig extends {hidden?: readonly (infer THidden)[]} ? THidden : never)
  | (TConfig extends {default?: infer TDefault} ? TDefault : never),
  {kind: 'aggregate'; columnId: string}
>['columnId']

type ConfiguredLookupFieldPaths<TBuilder> = Extract<
  | SelectableConfigFieldIds<BuilderXAxisConfig<TBuilder>>
  | SelectableConfigFieldIds<BuilderGroupByConfig<TBuilder>>
  | SelectableConfigFieldIds<BuilderFiltersConfig<TBuilder>>
  | MetricConfigFieldIds<BuilderMetricConfig<TBuilder>>,
  `${string}.${string}`
>

type LookupRelationshipForPath<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends string,
  TPath extends string,
> = TPath extends `${infer TAlias}.${string}`
  ? Extract<UniqueLookupRelationshipUnion<TRelationships, TBaseDatasetId>, {alias: TAlias}>
  : never

type LookupColumnValue<
  TDataset,
  TColumnId extends string,
> = TColumnId extends keyof DatasetRow<TDataset>
  ? DatasetRow<TDataset>[TColumnId] | null
  : TDataset extends {columns?: infer TColumns extends Record<string, unknown>}
    ? TColumnId extends keyof TColumns
      ? TColumns[TColumnId] extends {
          kind: 'derived'
          accessor: (row: any) => infer TValue
        }
        ? TValue | null
        : unknown
      : never
    : never

type ProjectedLookupRowField<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
  TPath extends string,
> = TPath extends `${string}.${infer TColumnId extends string}`
  ? LookupRelationshipForPath<TRelationships, TBaseDatasetId, TPath> extends {
      fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
    }
    ? {
        [TCompiledId in CompiledFieldId<TPath>]: LookupColumnValue<
          TDatasets[TFromDatasetId],
          TColumnId
        >
      }
    : {}
  : {}

type ProjectedLookupColumns<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
  TLookupPaths extends string,
> = {
  [TLookupPath in TLookupPaths as CompiledFieldId<TLookupPath>]: TLookupPath extends `${string}.${infer TColumnId extends string}`
    ? LookupRelationshipForPath<TRelationships, TBaseDatasetId, TLookupPath> extends {
        fromDataset: infer TFromDatasetId extends ModelDatasetId<TDatasets>
      }
      ? ColumnHintFor<LookupColumnValue<TDatasets[TFromDatasetId], TColumnId>, any>
      : never
    : never
}

type MapStringArray<TValue> =
  TValue extends readonly (infer TItem extends string)[]
    ? readonly CompiledFieldId<TItem>[]
    : never

type MapMetricValue<TValue> =
  TValue extends {kind: 'aggregate'; columnId: infer TColumnId extends string}
    ? Simplify<Omit<TValue, 'columnId'> & {columnId: CompiledFieldId<TColumnId>}>
    : TValue

type MapMetricArray<TValue> =
  TValue extends readonly (infer TItem)[]
    ? readonly MapMetricValue<TItem>[]
    : never

type NormalizeSelectableConfig<
  TConfig,
  TBaseDatasetId extends string,
> = [TConfig] extends [undefined]
  ? undefined
  : Simplify<
      (TConfig extends {allowed?: readonly (infer TAllowed)[]}
        ? {allowed?: readonly StripBaseDatasetPrefix<Extract<TAllowed, string>, TBaseDatasetId>[]}
        : {})
      & (TConfig extends {hidden?: readonly (infer THidden)[]}
        ? {hidden?: readonly StripBaseDatasetPrefix<Extract<THidden, string>, TBaseDatasetId>[]}
        : {})
      & (TConfig extends {default?: infer TDefault extends string}
        ? {default?: StripBaseDatasetPrefix<TDefault, TBaseDatasetId>}
        : {})
    >

type NormalizeMetricValue<
  TValue,
  TBaseDatasetId extends string,
> = TValue extends {kind: 'aggregate'; columnId: infer TColumnId extends string}
  ? Simplify<Omit<TValue, 'columnId'> & {columnId: StripBaseDatasetPrefix<TColumnId, TBaseDatasetId>}>
  : TValue

type NormalizeMetricArray<
  TValue,
  TBaseDatasetId extends string,
> = TValue extends readonly (infer TItem)[]
  ? readonly NormalizeMetricValue<TItem, TBaseDatasetId>[]
  : never

type NormalizeMetricConfig<
  TConfig,
  TBaseDatasetId extends string,
> = [TConfig] extends [undefined]
  ? undefined
  : Simplify<
      (TConfig extends {allowed?: readonly unknown[]}
        ? {allowed?: NormalizeMetricArray<TConfig['allowed'], TBaseDatasetId>}
        : {})
      & (TConfig extends {hidden?: readonly unknown[]}
        ? {hidden?: NormalizeMetricArray<TConfig['hidden'], TBaseDatasetId>}
        : {})
      & (TConfig extends {default?: infer TDefault}
        ? {default?: NormalizeMetricValue<TDefault, TBaseDatasetId>}
        : {})
    >

type ResolvedBuilderBaseDatasetId<TBuilder> = [ExplicitBuilderBaseDatasetId<TBuilder>] extends [never]
  ? InferredBuilderBaseDatasetId<TBuilder>
  : ExplicitBuilderBaseDatasetId<TBuilder>

type NormalizedBuilderXAxisConfig<TBuilder> =
  TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, any, any>
    ? [ResolvedBuilderBaseDatasetId<TBuilder>] extends [infer TBaseDatasetId extends string]
      ? NormalizeSelectableConfig<BuilderXAxisConfig<TBuilder>, TBaseDatasetId>
      : BuilderXAxisConfig<TBuilder>
    : BuilderXAxisConfig<TBuilder>

type NormalizedBuilderGroupByConfig<TBuilder> =
  TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, any, any>
    ? [ResolvedBuilderBaseDatasetId<TBuilder>] extends [infer TBaseDatasetId extends string]
      ? NormalizeSelectableConfig<BuilderGroupByConfig<TBuilder>, TBaseDatasetId>
      : BuilderGroupByConfig<TBuilder>
    : BuilderGroupByConfig<TBuilder>

type NormalizedBuilderFiltersConfig<TBuilder> =
  TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, any, any>
    ? [ResolvedBuilderBaseDatasetId<TBuilder>] extends [infer TBaseDatasetId extends string]
      ? NormalizeSelectableConfig<BuilderFiltersConfig<TBuilder>, TBaseDatasetId>
      : BuilderFiltersConfig<TBuilder>
    : BuilderFiltersConfig<TBuilder>

type NormalizedBuilderMetricConfig<TBuilder> =
  TBuilder extends InferredModelChartBuilder<any, any, any, any, any, any, any, any, any, any>
    ? [ResolvedBuilderBaseDatasetId<TBuilder>] extends [infer TBaseDatasetId extends string]
      ? NormalizeMetricConfig<BuilderMetricConfig<TBuilder>, TBaseDatasetId>
      : BuilderMetricConfig<TBuilder>
    : BuilderMetricConfig<TBuilder>

type MapSelectableConfig<TConfig> = [TConfig] extends [undefined]
  ? undefined
  : Simplify<
      (TConfig extends {allowed?: readonly string[]} ? {allowed?: MapStringArray<TConfig['allowed']>} : {})
      & (TConfig extends {hidden?: readonly string[]} ? {hidden?: MapStringArray<TConfig['hidden']>} : {})
      & (TConfig extends {default?: infer TDefault extends string}
        ? {default?: CompiledFieldId<TDefault>}
        : {})
    >

type MapMetricConfig<TConfig> = [TConfig] extends [undefined]
  ? undefined
  : Simplify<
      (TConfig extends {allowed?: readonly unknown[]} ? {allowed?: MapMetricArray<TConfig['allowed']>} : {})
      & (TConfig extends {hidden?: readonly unknown[]} ? {hidden?: MapMetricArray<TConfig['hidden']>} : {})
      & (TConfig extends {default?: infer TDefault}
        ? {default?: MapMetricValue<TDefault>}
        : {})
    >

type BroadCompiledModelChartDefinition<TChartId extends string> = DefinedDatasetChartSchema<
  any,
  Record<string, unknown> | undefined,
  XAxisConfig<string> | undefined,
  GroupByConfig<string> | undefined,
  FiltersConfig<string> | undefined,
  MetricConfig<string> | undefined,
  ChartTypeConfig | undefined,
  TimeBucketConfig | undefined,
  boolean | undefined,
  TChartId,
  unknown
>

type CompiledModelChartOwner<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBuilder,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
> = [ConfiguredLookupFieldPaths<TBuilder>] extends [never]
  ? TDatasets[TBaseDatasetId]
  : MaterializedViewDefinition<
      any,
      Record<string, unknown> | undefined,
      readonly string[] | undefined,
      DefinedDataModel<TDatasets, TRelationships, any, any>,
      string,
      TBaseDatasetId,
      string
    >

export type CompileModelChartDefinition<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBuilder,
  TChartId extends string,
> = CompileModelChartDefinitionFromState<
  TDatasets,
  TRelationships,
  Extract<ResolvedBuilderBaseDatasetId<TBuilder>, ModelDatasetId<TDatasets>>,
  NormalizedBuilderXAxisConfig<TBuilder>,
  NormalizedBuilderGroupByConfig<TBuilder>,
  NormalizedBuilderFiltersConfig<TBuilder>,
  NormalizedBuilderMetricConfig<TBuilder>,
  BuilderChartTypeConfig<TBuilder>,
  BuilderTimeBucketConfig<TBuilder>,
  BuilderConnectNulls<TBuilder>,
  TChartId,
  CompiledModelChartOwner<
    TDatasets,
    TRelationships,
    TBuilder,
    Extract<ResolvedBuilderBaseDatasetId<TBuilder>, ModelDatasetId<TDatasets>>
  >
>

export type CompileModelChartDefinitionFromState<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
  TXAxis extends XAxisConfig<any> | undefined,
  TGroupBy extends GroupByConfig<any> | undefined,
  TFilters extends FiltersConfig<any> | undefined,
  TMetric extends MetricConfig<any> | undefined,
  TChartType extends ChartTypeConfig | undefined,
  TTimeBucket extends TimeBucketConfig | undefined,
  TConnectNulls extends boolean | undefined,
  TChartId extends string,
  TOwner = unknown,
> = [ModelDatasetId<TDatasets>] extends [never]
  ? BroadCompiledModelChartDefinition<TChartId>
  : TBaseDatasetId extends ModelDatasetId<TDatasets>
  ? DefinedDatasetChartSchema<
      Simplify<
        DatasetRow<TDatasets[TBaseDatasetId]>
        & UnionToIntersection<
          ProjectedLookupRowField<
            TDatasets,
            TRelationships,
            TBaseDatasetId,
            ConfiguredLookupFieldPaths<
              ModelChartBuilder<
                TDatasets,
                TRelationships,
                TBaseDatasetId,
                TXAxis,
                TGroupBy,
                TFilters,
                TMetric,
                TChartType,
                TTimeBucket,
                TConnectNulls
              >
            >
          >
        >
      >,
      MergeColumns<
        DatasetColumns<TDatasets[TBaseDatasetId]>,
        ProjectedLookupColumns<
          TDatasets,
          TRelationships,
          TBaseDatasetId,
          ConfiguredLookupFieldPaths<
            ModelChartBuilder<
              TDatasets,
              TRelationships,
              TBaseDatasetId,
              TXAxis,
              TGroupBy,
              TFilters,
              TMetric,
              TChartType,
              TTimeBucket,
              TConnectNulls
            >
          >
        >
      >,
      MapSelectableConfig<TXAxis>,
      MapSelectableConfig<TGroupBy>,
      MapSelectableConfig<TFilters>,
      MapMetricConfig<TMetric>,
      TChartType,
      TTimeBucket,
      TConnectNulls,
      TChartId,
      TOwner
    >
  : BroadCompiledModelChartDefinition<TChartId>
