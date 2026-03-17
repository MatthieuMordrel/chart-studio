import {defineDashboard} from './define-dashboard.js'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {inferColumnsFromData} from './infer-columns.js'
import type {
  DashboardChartRegistration,
  DashboardLocalSharedSelectFilterDefinition,
  DashboardModelSharedFilterDefinition,
  DefinedDashboard,
} from './dashboard.types.js'
import type {
  DefinedDataModel,
  ModelAttributeDefinition,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {
  DatasetChartDefinition,
  DefinedDataset,
} from './dataset-builder.types.js'
import type {
  ChartColumn,
  ChartType,
  InferableFieldKey,
  NumericAggregateFunction,
  RawColumnSchemaMap,
  ResolvedFilterColumnIdFromHints,
  ResolvedGroupByColumnIdFromHints,
  ResolvedMetricColumnIdFromHints,
  ResolvedXAxisColumnIdFromHints,
  TimeBucket,
} from './types.js'

type DashboardDataInputMap = Record<string, readonly Record<string, unknown>[]>

type DatasetIdOfData<TData extends DashboardDataInputMap> = Extract<keyof TData, string>

type DatasetRowOfData<
  TData extends DashboardDataInputMap,
  TDatasetId extends DatasetIdOfData<TData>,
> = TData[TDatasetId] extends readonly (infer TRow extends Record<string, unknown>)[]
  ? TRow
  : never

type NormalizeDatasetConfigs<TDatasetConfigs> =
  TDatasetConfigs extends Record<string, unknown>
    ? TDatasetConfigs
    : {}

type NormalizeKeys<TKeys> =
  TKeys extends Record<string, unknown>
    ? TKeys
    : {}

type NormalizeRelationships<TRelationships> =
  TRelationships extends Record<string, unknown>
    ? TRelationships
    : {}

type DatasetColumnHintsFor<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TDatasetId extends DatasetIdOfData<TData>,
> = TDatasetId extends keyof NormalizeDatasetConfigs<TDatasetConfigs>
  ? NormalizeDatasetConfigs<TDatasetConfigs>[TDatasetId] extends {
      columns?: infer TColumns extends RawColumnSchemaMap<DatasetRowOfData<TData, TDatasetId>> | undefined
    }
    ? TColumns
    : undefined
  : undefined

type DatasetKeyIdFor<
  TData extends DashboardDataInputMap,
  TKeys,
  TDatasetId extends DatasetIdOfData<TData>,
> = TDatasetId extends keyof NormalizeKeys<TKeys>
  ? Extract<
      NormalizeKeys<TKeys>[TDatasetId],
      InferableFieldKey<DatasetRowOfData<TData, TDatasetId>>
    >
  : 'id' extends InferableFieldKey<DatasetRowOfData<TData, TDatasetId>>
    ? 'id'
    : never

type SingularizeDatasetId<TDatasetId extends string> =
  TDatasetId extends `${infer TStem}ies`
    ? `${TStem}y`
    : TDatasetId extends `${infer TStem}s`
      ? TStem
      : TDatasetId

type RelationAliasFromColumn<TColumnId extends string> =
  TColumnId extends `${infer TAlias}Id`
    ? TAlias
    : never

type DatasetAliasMatches<
  TDatasetId extends string,
  TAlias extends string,
> = TAlias extends TDatasetId
  ? true
  : TAlias extends SingularizeDatasetId<TDatasetId>
    ? true
    : false

type FieldPairId<
  TDatasetId extends string,
  TColumnId extends string,
> = `${TDatasetId}.${TColumnId}`

/**
 * Column schema overrides for a single dataset within a `createDashboard` call.
 *
 * @typeParam TRow - The row type of the dataset.
 *
 * @property columns - Optional column schema hints that override the inferred column types.
 *   Keys are field names from the row, and values describe the column type, format, and label.
 *   When omitted, columns are inferred automatically from the data.
 */
export type CreateDashboardDatasetConfig<TRow extends Record<string, unknown>> = {
  readonly columns?: RawColumnSchemaMap<TRow>
}

/**
 * Per-dataset column schema overrides, keyed by dataset id.
 *
 * Use this to override the inferred column types for specific datasets
 * when the automatic inference is insufficient (e.g. forcing a numeric
 * field to be treated as a category).
 *
 * @typeParam TData - The full data input map (`Record<datasetId, rows[]>`).
 */
export type CreateDashboardDatasetsConfig<
  TData extends DashboardDataInputMap,
> = Partial<{
  [TDatasetId in DatasetIdOfData<TData>]: CreateDashboardDatasetConfig<
    DatasetRowOfData<TData, TDatasetId>
  >
}>

/**
 * Primary key overrides for each dataset.
 *
 * By default, `createDashboard` uses `"id"` as the key field when a dataset's
 * rows contain an `id` property. Use this type to specify an alternative key
 * field for datasets that use a different primary key.
 *
 * @typeParam TData - The full data input map (`Record<datasetId, rows[]>`).
 */
export type CreateDashboardKeys<
  TData extends DashboardDataInputMap,
> = Partial<{
  [TDatasetId in DatasetIdOfData<TData>]: InferableFieldKey<
    DatasetRowOfData<TData, TDatasetId>
  >
}>

/**
 * Defines an explicit relationship (foreign key join) between two datasets.
 *
 * @property from - The source (parent) side of the relationship.
 * @property from.dataset - The dataset id that owns the primary key.
 * @property from.key - The primary key field on the source dataset.
 * @property to - The target (child) side of the relationship.
 * @property to.dataset - The dataset id that holds the foreign key.
 * @property to.column - The foreign key column on the target dataset.
 *
 * @typeParam TData - The full data input map.
 * @typeParam TKeys - The key overrides map.
 * @typeParam TFromDatasetId - The source dataset id.
 * @typeParam TToDatasetId - The target dataset id.
 */
export type CreateDashboardRelationshipConfig<
  TData extends DashboardDataInputMap,
  TKeys,
  TFromDatasetId extends DatasetIdOfData<TData> = DatasetIdOfData<TData>,
  TToDatasetId extends DatasetIdOfData<TData> = DatasetIdOfData<TData>,
> = {
  readonly from: {
    readonly dataset: TFromDatasetId
    readonly key: DatasetKeyIdFor<TData, TKeys, TFromDatasetId>
  }
  readonly to: {
    readonly dataset: TToDatasetId
    readonly column: InferableFieldKey<DatasetRowOfData<TData, TToDatasetId>>
  }
}

type AnyCreateDashboardRelationshipConfig<
  TData extends DashboardDataInputMap,
  TKeys,
> = {
  [TFromDatasetId in DatasetIdOfData<TData>]: {
    [TToDatasetId in DatasetIdOfData<TData>]: CreateDashboardRelationshipConfig<
      TData,
      TKeys,
      TFromDatasetId,
      TToDatasetId
    >
  }[DatasetIdOfData<TData>]
}[DatasetIdOfData<TData>]

/**
 * A map of explicit relationship definitions, keyed by a user-chosen relationship id.
 *
 * These override or supplement the relationships that `createDashboard` infers
 * automatically from foreign-key naming conventions (e.g. `userId` → `users.id`).
 */
export type CreateDashboardRelationshipsConfig<
  TData extends DashboardDataInputMap,
  TKeys,
> = Record<string, AnyCreateDashboardRelationshipConfig<TData, TKeys>>

/**
 * A `"datasetId.columnId"` pair identifying a field that should be excluded
 * from automatic relationship inference.
 *
 * Use this to suppress false-positive foreign-key matches, e.g. when a column
 * like `parentId` happens to match naming conventions but is not a real join.
 */
export type CreateDashboardExcludeId<
  TData extends DashboardDataInputMap,
> = {
  [TDatasetId in DatasetIdOfData<TData>]: FieldPairId<
    TDatasetId,
    InferableFieldKey<DatasetRowOfData<TData, TDatasetId>>
  >
}[DatasetIdOfData<TData>]

type ExplicitLookupRelationUnion<
  TRelationships,
> = {
  [TRelationshipId in keyof NormalizeRelationships<TRelationships>]:
    NormalizeRelationships<TRelationships>[TRelationshipId] extends {
      from: {
        dataset: infer TFromDatasetId extends string
        key: infer TFromKey extends string
      }
      to: {
        dataset: infer TToDatasetId extends string
        column: infer TToColumn extends string
      }
    }
      ? {
          id: Extract<TRelationshipId, string>
          alias: RelationAliasFromColumn<TToColumn>
          fromDataset: TFromDatasetId
          fromKey: TFromKey
          toDataset: TToDatasetId
          toColumn: TToColumn
          inferred: false
        }
      : never
}[keyof NormalizeRelationships<TRelationships>]

type ExplicitTargetPairUnion<
  TRelationships,
> = ExplicitLookupRelationUnion<TRelationships> extends infer TRelationship
  ? TRelationship extends {
      toDataset: infer TToDatasetId extends string
      toColumn: infer TToColumn extends string
    }
    ? FieldPairId<TToDatasetId, TToColumn>
    : never
  : never

type ExcludedFieldPairUnion<TExclude> =
  TExclude extends readonly (infer TFieldPair extends string)[]
    ? TFieldPair
    : never

type InferredLookupRelationCandidateForColumn<
  TData extends DashboardDataInputMap,
  TKeys,
  TToDatasetId extends DatasetIdOfData<TData>,
  TToColumn extends InferableFieldKey<DatasetRowOfData<TData, TToDatasetId>>,
  TFromDatasetId extends DatasetIdOfData<TData>,
> = TToColumn extends `${infer TAlias}Id`
  ? DatasetKeyIdFor<TData, TKeys, TFromDatasetId> extends infer TFromKey extends string
    ? TFromDatasetId extends TToDatasetId
      ? never
      : TFromKey extends 'id'
        ? DatasetAliasMatches<TFromDatasetId, TAlias> extends true
          ? {
              id: FieldPairId<TToDatasetId, TToColumn>
              alias: TAlias
              fromDataset: TFromDatasetId
              fromKey: TFromKey
              toDataset: TToDatasetId
              toColumn: TToColumn
              inferred: true
            }
          : never
        : TToColumn extends TFromKey
          ? {
              id: FieldPairId<TToDatasetId, TToColumn>
              alias: TAlias
              fromDataset: TFromDatasetId
              fromKey: TFromKey
              toDataset: TToDatasetId
              toColumn: TToColumn
              inferred: true
            }
          : never
    : never
  : never

type InferredLookupRelationUnion<
  TData extends DashboardDataInputMap,
  TKeys,
  TRelationships,
  TExclude,
> = {
  [TToDatasetId in DatasetIdOfData<TData>]: {
    [TToColumn in InferableFieldKey<DatasetRowOfData<TData, TToDatasetId>>]:
      FieldPairId<TToDatasetId, TToColumn> extends
        | ExplicitTargetPairUnion<TRelationships>
        | ExcludedFieldPairUnion<TExclude>
        ? never
        : {
            [TFromDatasetId in DatasetIdOfData<TData>]: InferredLookupRelationCandidateForColumn<
              TData,
              TKeys,
              TToDatasetId,
              TToColumn,
              TFromDatasetId
            >
          }[DatasetIdOfData<TData>]
  }[InferableFieldKey<DatasetRowOfData<TData, TToDatasetId>>]
}[DatasetIdOfData<TData>]

type LookupRelationUnion<
  TData extends DashboardDataInputMap,
  TKeys,
  TRelationships,
  TExclude,
> =
  | ExplicitLookupRelationUnion<TRelationships>
  | InferredLookupRelationUnion<TData, TKeys, TRelationships, TExclude>

type DirectXAxisFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TDatasetId extends DatasetIdOfData<TData>,
> = ResolvedXAxisColumnIdFromHints<
  DatasetRowOfData<TData, TDatasetId>,
  DatasetColumnHintsFor<TData, TDatasetConfigs, TDatasetId>
>

type DirectGroupByFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TDatasetId extends DatasetIdOfData<TData>,
> = ResolvedGroupByColumnIdFromHints<
  DatasetRowOfData<TData, TDatasetId>,
  DatasetColumnHintsFor<TData, TDatasetConfigs, TDatasetId>
>

type DirectFilterFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TDatasetId extends DatasetIdOfData<TData>,
> = ResolvedFilterColumnIdFromHints<
  DatasetRowOfData<TData, TDatasetId>,
  DatasetColumnHintsFor<TData, TDatasetConfigs, TDatasetId>
>

type DirectMetricFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TDatasetId extends DatasetIdOfData<TData>,
> = ResolvedMetricColumnIdFromHints<
  DatasetRowOfData<TData, TDatasetId>,
  DatasetColumnHintsFor<TData, TDatasetConfigs, TDatasetId>
>

type LookupXAxisFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> = Extract<
  LookupRelationUnion<TData, TKeys, TRelationships, TExclude> extends infer TRelationship
    ? TRelationship extends {
        toDataset: TDatasetId
        alias: infer TAlias extends string
        fromDataset: infer TFromDatasetId extends DatasetIdOfData<TData>
      }
      ? `${TAlias}.${DirectXAxisFieldId<TData, TDatasetConfigs, TFromDatasetId>}`
      : never
    : never,
  string
>

type LookupGroupByFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> = Extract<
  LookupRelationUnion<TData, TKeys, TRelationships, TExclude> extends infer TRelationship
    ? TRelationship extends {
        toDataset: TDatasetId
        alias: infer TAlias extends string
        fromDataset: infer TFromDatasetId extends DatasetIdOfData<TData>
      }
      ? `${TAlias}.${DirectGroupByFieldId<TData, TDatasetConfigs, TFromDatasetId>}`
      : never
    : never,
  string
>

type LookupMetricFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> = Extract<
  LookupRelationUnion<TData, TKeys, TRelationships, TExclude> extends infer TRelationship
    ? TRelationship extends {
        toDataset: TDatasetId
        alias: infer TAlias extends string
        fromDataset: infer TFromDatasetId extends DatasetIdOfData<TData>
      }
      ? `${TAlias}.${DirectMetricFieldId<TData, TDatasetConfigs, TFromDatasetId>}`
      : never
    : never,
  string
>

type CreateDashboardXAxisFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> =
  | DirectXAxisFieldId<TData, TDatasetConfigs, TDatasetId>
  | LookupXAxisFieldId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude, TDatasetId>

type CreateDashboardGroupByFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> =
  | DirectGroupByFieldId<TData, TDatasetConfigs, TDatasetId>
  | LookupGroupByFieldId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude, TDatasetId>

type CreateDashboardMetricFieldId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
  TDatasetId extends DatasetIdOfData<TData>,
> =
  | DirectMetricFieldId<TData, TDatasetConfigs, TDatasetId>
  | LookupMetricFieldId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude, TDatasetId>

/**
 * Specifies how a chart's metric (y-axis value) is computed.
 *
 * - `'count'` — counts the number of rows per bucket.
 * - `{ column, fn, includeZeros? }` — applies an aggregate function to a numeric column.
 *
 * @property column - The numeric column id to aggregate.
 * @property fn - The aggregate function (`'sum'`, `'avg'`, `'min'`, `'max'`, etc.).
 * @property includeZeros - When `true`, rows with a zero value are included in the aggregation.
 *   Defaults to `false`.
 */
export type CreateDashboardMetricSpec<TColumnId extends string> =
  | 'count'
  | {
      readonly column: TColumnId
      readonly fn: NumericAggregateFunction
      readonly includeZeros?: boolean
    }

/**
 * Configuration for a single chart within a `createDashboard` call.
 *
 * Fields support both direct column references (e.g. `"createdAt"`) and
 * lookup paths through inferred or explicit relationships (e.g. `"owner.name"`).
 *
 * @property data - The dataset id this chart draws its rows from.
 * @property xAxis - The column (or lookup path) used for the x-axis. Must resolve to a
 *   `date`, `category`, or `boolean` column.
 * @property groupBy - Optional column (or lookup path) to group/segment data by.
 *   Must resolve to a `category` or `boolean` column.
 * @property metric - How the y-axis value is computed. Either `'count'` or an
 *   `{ column, fn }` aggregate spec targeting a numeric column.
 * @property chartType - Optional chart visualization type override (e.g. `'bar'`, `'line'`, `'area'`).
 * @property timeBucket - Optional time bucketing granularity when the x-axis is a date column
 *   (e.g. `'day'`, `'week'`, `'month'`).
 */
export type CreateDashboardChartConfig<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
> = {
  [TDatasetId in DatasetIdOfData<TData>]: {
    readonly data: TDatasetId
    readonly xAxis: CreateDashboardXAxisFieldId<
      TData,
      TDatasetConfigs,
      TKeys,
      TRelationships,
      TExclude,
      TDatasetId
    >
    readonly groupBy?: CreateDashboardGroupByFieldId<
      TData,
      TDatasetConfigs,
      TKeys,
      TRelationships,
      TExclude,
      TDatasetId
    >
    readonly metric: CreateDashboardMetricSpec<
      CreateDashboardMetricFieldId<
        TData,
        TDatasetConfigs,
        TKeys,
        TRelationships,
        TExclude,
        TDatasetId
      >
    >
    readonly chartType?: ChartType
    readonly timeBucket?: TimeBucket
  }
}[DatasetIdOfData<TData>]

type LookupSharedFilterId<
  TData extends DashboardDataInputMap,
  TKeys,
  TRelationships,
  TExclude,
> = Extract<
  LookupRelationUnion<TData, TKeys, TRelationships, TExclude> extends infer TRelationship
    ? TRelationship extends {alias: infer TAlias extends string}
      ? TAlias
      : never
    : never,
  string
>

type DirectSharedFilterId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
> = {
  [TDatasetId in DatasetIdOfData<TData>]: DirectFilterFieldId<TData, TDatasetConfigs, TDatasetId>
}[DatasetIdOfData<TData>]

/**
 * Union of valid shared filter identifiers for a `createDashboard` call.
 *
 * A shared filter id can be:
 * - A relationship alias (e.g. `"owner"`) — creates a model-attribute-based
 *   select filter that propagates across all datasets joined through that relationship.
 * - A direct column id present on one or more datasets (e.g. `"status"`) — creates
 *   a column-based select filter applied to every dataset that has a matching filterable column.
 */
export type CreateDashboardSharedFilterId<
  TData extends DashboardDataInputMap,
  TDatasetConfigs,
  TKeys,
  TRelationships,
  TExclude,
> =
  | LookupSharedFilterId<TData, TKeys, TRelationships, TExclude>
  | DirectSharedFilterId<TData, TDatasetConfigs>

/**
 * Full options object accepted by {@link createDashboard}.
 *
 * @property data - A map of dataset ids to their row arrays. Each key becomes a dataset
 *   in the dashboard's data model, and columns are inferred from the row shape.
 * @property charts - A map of chart ids to their configuration. Each entry produces one
 *   chart registration on the resulting dashboard definition.
 * @property datasets - Optional per-dataset column schema overrides. Use this to refine
 *   inferred column types (e.g. marking a string field as a date).
 * @property keys - Optional per-dataset primary key overrides. Defaults to `"id"` when
 *   the rows contain an `id` field.
 * @property relationships - Optional explicit relationship definitions that override or
 *   supplement automatic foreign-key inference.
 * @property exclude - Optional list of `"datasetId.columnId"` pairs to exclude from
 *   automatic relationship inference. Useful for suppressing false-positive matches.
 * @property sharedFilters - Optional list of shared filter ids. Each id is either a
 *   relationship alias (producing a model-attribute select filter) or a direct column id
 *   (producing a column-based select filter across matching datasets).
 */
export type CreateDashboardOptions<
  TData extends DashboardDataInputMap,
  TDatasetConfigs extends CreateDashboardDatasetsConfig<TData> | undefined,
  TKeys extends CreateDashboardKeys<TData> | undefined,
  TRelationships extends CreateDashboardRelationshipsConfig<TData, TKeys> | undefined,
  TExclude extends readonly CreateDashboardExcludeId<TData>[] | undefined,
  TCharts extends Record<string, CreateDashboardChartConfig<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>>,
  TSharedFilters extends readonly CreateDashboardSharedFilterId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>[] | undefined,
> = {
  readonly data: TData
  readonly charts: TCharts
  readonly datasets?: TDatasetConfigs
  readonly keys?: TKeys
  readonly relationships?: TRelationships
  readonly exclude?: TExclude
  readonly sharedFilters?: TSharedFilters
}

type InferredDashboardDatasets<
  TData extends DashboardDataInputMap,
> = {
  [TDatasetId in DatasetIdOfData<TData>]: DefinedDataset<
    DatasetRowOfData<TData, TDatasetId>,
    Record<string, unknown> | undefined,
    any
  >
}

type SelectedSharedFilterId<TSharedFilters> =
  TSharedFilters extends readonly (infer TFilterId extends string)[]
    ? TFilterId
    : never

type InferredRelationshipSharedFilterId<
  TData extends DashboardDataInputMap,
  TKeys,
  TRelationships,
  TExclude,
  TSharedFilters,
> = Extract<
  SelectedSharedFilterId<TSharedFilters>,
  LookupSharedFilterId<TData, TKeys, TRelationships, TExclude>
>

type InferredDashboardModel<
  TData extends DashboardDataInputMap,
  TKeys,
  TRelationships,
  TExclude,
  TSharedFilters,
> = DefinedDataModel<
  InferredDashboardDatasets<TData>,
  Record<string, ModelRelationshipDefinition>,
  {},
  Record<
    InferredRelationshipSharedFilterId<TData, TKeys, TRelationships, TExclude, TSharedFilters>,
    ModelAttributeDefinition
  >
>

type InferredDashboardCharts<
  TCharts extends Record<string, unknown>,
> = {
  [TChartId in Extract<keyof TCharts, string>]: DashboardChartRegistration<
    Extract<TCharts[TChartId] extends {data: infer TDatasetId extends string} ? TDatasetId : never, string>,
    DatasetChartDefinition<any, any, any, any, any, any, any, any, any, any>
  >
}

type InferredDashboardSharedFilterDefinition<
  TModel extends DefinedDataModel,
> =
  | DashboardModelSharedFilterDefinition<string, ModelAttributeDefinition>
  | DashboardLocalSharedSelectFilterDefinition<string, TModel['datasets']>

type InferredDashboardSharedFilters<
  TModel extends DefinedDataModel,
  TSharedFilters,
> = TSharedFilters extends readonly (infer TFilterId extends string)[]
  ? Record<TFilterId, InferredDashboardSharedFilterDefinition<TModel>>
  : {}

/**
 * The fully-resolved dashboard definition returned by {@link createDashboard}.
 *
 * This is a {@link DefinedDashboard} whose model, charts, and shared filters are
 * inferred from the provided data, chart configs, and relationship structure.
 * Pass this result to {@link useDashboard} to obtain a live runtime.
 */
export type CreateDashboardResult<
  TData extends DashboardDataInputMap,
  TDatasetConfigs extends CreateDashboardDatasetsConfig<TData> | undefined,
  TKeys extends CreateDashboardKeys<TData> | undefined,
  TRelationships extends CreateDashboardRelationshipsConfig<TData, TKeys> | undefined,
  TExclude extends readonly CreateDashboardExcludeId<TData>[] | undefined,
  TCharts extends Record<string, CreateDashboardChartConfig<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>>,
  TSharedFilters extends readonly CreateDashboardSharedFilterId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>[] | undefined,
  TModel extends InferredDashboardModel<TData, TKeys, TRelationships, TExclude, TSharedFilters> = InferredDashboardModel<
    TData,
    TKeys,
    TRelationships,
    TExclude,
    TSharedFilters
  >,
> = DefinedDashboard<
  TModel,
  InferredDashboardCharts<TCharts>,
  InferredDashboardSharedFilters<TModel, TSharedFilters>
>

type RuntimeRelationship = {
  id: string
  alias: string
  fromDataset: string
  fromKey: string
  toDataset: string
  toColumn: string
  inferred: boolean
}

type RuntimeDatasetInfo = {
  id: string
  rows: readonly Record<string, unknown>[]
  fieldIds: ReadonlySet<string>
  keyId?: string
  dataset: DefinedDataset<any, any, any>
  columns: readonly ChartColumn<any, string>[]
  columnsById: ReadonlyMap<string, ChartColumn<any, string>>
}

type ResolvedChartField = {
  internalId: string
  lookup?: {
    alias: string
    relationship: RuntimeRelationship
    columnId: string
  }
}

function capitalize(value: string): string {
  return value.length === 0
    ? value
    : `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${capitalize(columnId)}`
}

function singularizeDatasetId(datasetId: string): string {
  if (datasetId.endsWith('ies')) {
    return `${datasetId.slice(0, -3)}y`
  }

  if (datasetId.endsWith('s')) {
    return datasetId.slice(0, -1)
  }

  return datasetId
}

function stripIdSuffix(value: string): string {
  return value.endsWith('Id')
    ? value.slice(0, -2)
    : value
}

function buildDatasetFieldIds(
  rows: readonly Record<string, unknown>[],
  keyId: string | undefined,
  overrides: RawColumnSchemaMap<Record<string, unknown>> | undefined,
): ReadonlySet<string> {
  const fieldIds = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((fieldId) => {
      fieldIds.add(fieldId)
    })
  })

  Object.keys(overrides ?? {}).forEach((fieldId) => {
    fieldIds.add(fieldId)
  })

  if (keyId) {
    fieldIds.add(keyId)
  }

  return fieldIds
}

function buildColumnEntry(column: ChartColumn<any, string>): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    kind: 'raw',
    id: column.id,
    column: {
      type: column.type,
      label: column.label,
    },
  }

  const columnConfig = entry['column'] as Record<string, unknown>
  if (column.format !== undefined) {
    columnConfig['format'] = column.format
  }
  if (column.formatter !== undefined) {
    columnConfig['formatter'] = column.formatter
  }
  if (column.type === 'boolean') {
    columnConfig['trueLabel'] = column.trueLabel
    columnConfig['falseLabel'] = column.falseLabel
  }

  return entry
}

function buildDatasetInfo(
  datasetId: string,
  rows: readonly Record<string, unknown>[],
  keyId: string | undefined,
  overrides: RawColumnSchemaMap<Record<string, unknown>> | undefined,
): RuntimeDatasetInfo {
  const inferredColumns = inferColumnsFromData(
    rows,
    overrides ? {columns: overrides} : undefined,
  )
  const columnEntries = inferredColumns.map((column) => buildColumnEntry(column))

  let datasetBuilder: any = defineDataset<Record<string, unknown>>()
  if (keyId) {
    datasetBuilder = datasetBuilder.key(keyId)
  }
  if (columnEntries.length > 0) {
    datasetBuilder = datasetBuilder.columns(() => columnEntries as any)
  }

  return {
    id: datasetId,
    rows,
    fieldIds: buildDatasetFieldIds(rows, keyId, overrides),
    keyId,
    dataset: datasetBuilder.build(),
    columns: inferredColumns,
    columnsById: new Map(inferredColumns.map((column) => [column.id, column])),
  }
}

function matchRelationshipSourceDatasets(
  datasets: Record<string, RuntimeDatasetInfo>,
  targetDatasetId: string,
  targetColumnId: string,
): RuntimeDatasetInfo[] {
  if (!targetColumnId.endsWith('Id')) {
    return []
  }

  const alias = stripIdSuffix(targetColumnId)
  const matches: RuntimeDatasetInfo[] = []

  Object.values(datasets).forEach((dataset) => {
    if (dataset.id === targetDatasetId || !dataset.keyId) {
      return
    }

    if (
      (dataset.keyId === 'id' && (
        dataset.id === alias
        || singularizeDatasetId(dataset.id) === alias
      ))
      || dataset.keyId === targetColumnId
    ) {
      matches.push(dataset)
    }
  })

  return matches
}

function inferRelationships(
  datasets: Record<string, RuntimeDatasetInfo>,
  explicitRelationships: Record<string, CreateDashboardRelationshipConfig<any, any>> | undefined,
  excludedFieldPairs: ReadonlySet<string>,
): RuntimeRelationship[] {
  const relationships: RuntimeRelationship[] = []
  const explicitTargetPairs = new Set<string>()

  Object.entries(explicitRelationships ?? {}).forEach(([relationshipId, relationship]) => {
    explicitTargetPairs.add(`${relationship.to.dataset}.${relationship.to.column}`)
    relationships.push({
      id: relationshipId,
      alias: stripIdSuffix(relationship.to.column),
      fromDataset: relationship.from.dataset,
      fromKey: relationship.from.key,
      toDataset: relationship.to.dataset,
      toColumn: relationship.to.column,
      inferred: false,
    })
  })

  Object.values(datasets).forEach((targetDataset) => {
    targetDataset.fieldIds.forEach((fieldId) => {
      const fieldPairId = `${targetDataset.id}.${fieldId}`
      if (explicitTargetPairs.has(fieldPairId) || excludedFieldPairs.has(fieldPairId)) {
        return
      }

      const matches = matchRelationshipSourceDatasets(datasets, targetDataset.id, fieldId)
      if (matches.length === 0) {
        return
      }

      if (matches.length > 1) {
        throw new Error(
          `Cannot safely infer relationship for "${targetDataset.id}.${fieldId}". Multiple datasets match: ${matches.map((dataset) => `"${dataset.id}"`).join(', ')}. Add an explicit relationship or exclude "${targetDataset.id}.${fieldId}".`,
        )
      }

      const sourceDataset = matches[0]!
      relationships.push({
        id: `${targetDataset.id}.${fieldId} -> ${sourceDataset.id}.${sourceDataset.keyId!}`,
        alias: stripIdSuffix(fieldId),
        fromDataset: sourceDataset.id,
        fromKey: sourceDataset.keyId!,
        toDataset: targetDataset.id,
        toColumn: fieldId,
        inferred: true,
      })
    })
  })

  return relationships
}

function indexRelationshipsByDataset(
  relationships: readonly RuntimeRelationship[],
): ReadonlyMap<string, ReadonlyMap<string, RuntimeRelationship>> {
  const indexed = new Map<string, Map<string, RuntimeRelationship>>()

  relationships.forEach((relationship) => {
    const relationshipsForDataset = indexed.get(relationship.toDataset) ?? new Map<string, RuntimeRelationship>()
    const existing = relationshipsForDataset.get(relationship.alias)
    if (existing && (
      existing.fromDataset !== relationship.fromDataset
      || existing.toColumn !== relationship.toColumn
      || existing.fromKey !== relationship.fromKey
    )) {
      throw new Error(
        `Lookup alias "${relationship.alias}" is ambiguous on dataset "${relationship.toDataset}". Add explicit relationships with distinct foreign-key column names.`,
      )
    }

    relationshipsForDataset.set(relationship.alias, relationship)
    indexed.set(relationship.toDataset, relationshipsForDataset)
  })

  return indexed
}

function assertColumnUsage(
  column: ChartColumn<any, string>,
  usage: 'xAxis' | 'groupBy' | 'metric',
  field: string,
): void {
  const isValid = usage === 'xAxis'
    ? column.type === 'date' || column.type === 'category' || column.type === 'boolean'
    : usage === 'groupBy'
      ? column.type === 'category' || column.type === 'boolean'
      : column.type === 'number'

  if (!isValid) {
    throw new Error(
      `Field "${field}" cannot be used as a ${usage}. Resolved column type: "${column.type}".`,
    )
  }
}

function resolveChartField(
  datasets: Record<string, RuntimeDatasetInfo>,
  relationshipsByDataset: ReadonlyMap<string, ReadonlyMap<string, RuntimeRelationship>>,
  datasetId: string,
  field: string,
  usage: 'xAxis' | 'groupBy' | 'metric',
): ResolvedChartField {
  const dotSegments = field.split('.')

  if (dotSegments.length === 1) {
    const dataset = datasets[datasetId]!
    const column = dataset.columnsById.get(field)
    if (!column) {
      throw new Error(`Unknown field "${field}" on dataset "${datasetId}".`)
    }

    assertColumnUsage(column, usage, field)
    return {internalId: field}
  }

  if (dotSegments.length !== 2) {
    throw new Error(
      `Field path "${field}" is not supported. Inferred dashboards only allow one lookup hop such as "owner.name".`,
    )
  }

  const [alias, columnId] = dotSegments as [string, string]
  const relationship = relationshipsByDataset.get(datasetId)?.get(alias)
  if (!relationship) {
    throw new Error(`Cannot resolve lookup path "${field}" from dataset "${datasetId}".`)
  }

  const sourceDataset = datasets[relationship.fromDataset]!
  const sourceColumn = sourceDataset.columnsById.get(columnId)
  if (!sourceColumn) {
    throw new Error(
      `Lookup path "${field}" references unknown field "${columnId}" on dataset "${relationship.fromDataset}".`,
    )
  }

  assertColumnUsage(sourceColumn, usage, field)

  return {
    internalId: buildProjectedId(alias, columnId),
    lookup: {
      alias,
      relationship,
      columnId,
    },
  }
}

function selectSharedFilterLabelColumn(dataset: RuntimeDatasetInfo): string {
  const preferredIds = ['name', 'title', 'label']

  for (const preferredId of preferredIds) {
    const column = dataset.columnsById.get(preferredId)
    if (column?.type === 'category' && preferredId !== dataset.keyId) {
      return preferredId
    }
  }

  for (const column of dataset.columns) {
    if (
      column.type === 'category'
      && column.id !== dataset.keyId
      && !column.id.endsWith('Id')
    ) {
      return column.id
    }
  }

  return dataset.keyId ?? dataset.columns[0]?.id ?? 'id'
}

function wrapInferredModel(
  model: DefinedDataModel,
  relationships: readonly RuntimeRelationship[],
): DefinedDataModel {
  const inferredRelationshipsById = new Map(
    relationships
      .filter((relationship) => relationship.inferred)
      .map((relationship) => [relationship.id, relationship]),
  )

  if (inferredRelationshipsById.size === 0) {
    return model
  }

  const wrappedModel: DefinedDataModel = {
    ...model,
    validateData(data) {
      try {
        model.validateData(data)
      } catch (error) {
        if (error instanceof Error) {
          for (const [relationshipId, relationship] of inferredRelationshipsById) {
            if (error.message.startsWith(`Relationship "${relationshipId}"`)) {
              throw new Error(
                `Inferred relationship "${relationship.toDataset}.${relationship.toColumn} -> ${relationship.fromDataset}.${relationship.fromKey}" failed validation: ${error.message.slice(`Relationship "${relationshipId}" `.length)} If this is not a real foreign key, exclude it with: exclude: ['${relationship.toDataset}.${relationship.toColumn}']`,
              )
            }
          }
        }

        throw error
      }
    },
    build() {
      return wrappedModel
    },
  }

  return wrappedModel
}

/**
 * Creates a fully-configured dashboard definition from raw data arrays.
 *
 * `createDashboard` is the high-level, inference-driven API for building dashboards.
 * It automatically:
 * - Infers column types (date, number, category, boolean) from the provided row data.
 * - Discovers foreign-key relationships between datasets using naming conventions
 *   (e.g. a `userId` column on one dataset is matched to the `id` key on a `users` dataset).
 * - Builds a data model with datasets, relationships, and optional model attributes.
 * - Compiles chart definitions with x-axis, group-by, and metric configurations,
 *   including support for cross-dataset lookup paths (e.g. `"owner.name"`).
 * - Registers shared filters that propagate selections across all charts in the dashboard.
 *
 * The returned {@link CreateDashboardResult} is a standard `DefinedDashboard` that can
 * be passed to {@link useDashboard} to obtain a live `DashboardRuntime`.
 *
 * @param options - The dashboard configuration. See {@link CreateDashboardOptions} for details.
 * @returns A fully-resolved dashboard definition ready for use with `useDashboard`.
 *
 * @throws If a lookup field path cannot be resolved against any known relationship.
 * @throws If an ambiguous relationship is inferred and cannot be resolved automatically.
 *   Use `exclude` or explicit `relationships` to disambiguate.
 * @throws If a column is used in an incompatible role (e.g. a `number` column as `groupBy`).
 *
 * @example
 * ```ts
 * const dashboard = createDashboard({
 *   data: { orders, customers },
 *   charts: {
 *     ordersByMonth: {
 *       data: 'orders',
 *       xAxis: 'createdAt',
 *       metric: 'count',
 *       timeBucket: 'month',
 *     },
 *     revenueByCustomer: {
 *       data: 'orders',
 *       xAxis: 'customer.name',
 *       metric: { column: 'amount', fn: 'sum' },
 *     },
 *   },
 *   sharedFilters: ['customer'],
 * })
 * ```
 */
export function createDashboard<
  const TData extends DashboardDataInputMap,
  const TDatasetConfigs extends CreateDashboardDatasetsConfig<TData> | undefined = undefined,
  const TKeys extends CreateDashboardKeys<TData> | undefined = undefined,
  const TRelationships extends CreateDashboardRelationshipsConfig<TData, TKeys> | undefined = undefined,
  const TExclude extends readonly CreateDashboardExcludeId<TData>[] | undefined = undefined,
  const TCharts extends Record<string, CreateDashboardChartConfig<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>> = Record<
    string,
    CreateDashboardChartConfig<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>
  >,
  const TSharedFilters extends readonly CreateDashboardSharedFilterId<TData, TDatasetConfigs, TKeys, TRelationships, TExclude>[] | undefined = undefined,
>(
  options: CreateDashboardOptions<TData, TDatasetConfigs, TKeys, TRelationships, TExclude, TCharts, TSharedFilters>,
): CreateDashboardResult<TData, TDatasetConfigs, TKeys, TRelationships, TExclude, TCharts, TSharedFilters> {
  const datasetInfos = Object.fromEntries(
    Object.entries(options.data).map(([datasetId, rows]) => {
      const keyOverrides = options.keys as Record<string, string | undefined> | undefined
      const datasetOverrides = options.datasets as Record<string, {columns?: RawColumnSchemaMap<Record<string, unknown>>} | undefined> | undefined
      const keyId = keyOverrides?.[datasetId] ?? (rows.some((row) => 'id' in row) ? 'id' : undefined)
      const overrides = datasetOverrides?.[datasetId]?.columns

      return [
        datasetId,
        buildDatasetInfo(
          datasetId,
          rows as readonly Record<string, unknown>[],
          keyId,
          overrides,
        ),
      ]
    }),
  ) as Record<string, RuntimeDatasetInfo>

  const relationships = inferRelationships(
    datasetInfos,
    options.relationships as Record<string, CreateDashboardRelationshipConfig<any, any>> | undefined,
    new Set(options.exclude ?? []),
  )
  const relationshipsByDataset = indexRelationshipsByDataset(relationships)
  const selectedSharedFilters = [...(options.sharedFilters ?? [])]

  let modelBuilder: any = defineDataModel()
  Object.values(datasetInfos).forEach((datasetInfo) => {
    modelBuilder = modelBuilder.dataset(datasetInfo.id, datasetInfo.dataset)
  })

  relationships.forEach((relationship) => {
    modelBuilder = modelBuilder.relationship(relationship.id, {
      from: {dataset: relationship.fromDataset, key: relationship.fromKey},
      to: {dataset: relationship.toDataset, column: relationship.toColumn},
    })
  })

  selectedSharedFilters.forEach((filterId) => {
    const matchingRelationships = relationships.filter((relationship) => relationship.alias === filterId)
    if (matchingRelationships.length === 0) {
      return
    }

    const sourceDatasetIds = [...new Set(matchingRelationships.map((relationship) => relationship.fromDataset))]
    if (sourceDatasetIds.length !== 1) {
      throw new Error(
        `Shared filter "${filterId}" is ambiguous. Its inferred relationships point to multiple source datasets.`,
      )
    }

    const sourceDataset = datasetInfos[sourceDatasetIds[0]!]!
    if (!sourceDataset.keyId) {
      throw new Error(
        `Shared filter "${filterId}" cannot be inferred because dataset "${sourceDataset.id}" has no key.`,
      )
    }

    modelBuilder = modelBuilder.attribute(filterId, {
      kind: 'select',
      source: {
        dataset: sourceDataset.id,
        key: sourceDataset.keyId,
        label: selectSharedFilterLabelColumn(sourceDataset),
      },
      targets: matchingRelationships.map((relationship) => ({
        dataset: relationship.toDataset,
        column: relationship.toColumn,
        via: relationship.id,
      })) as readonly {
        dataset: string
        column: string
        via: string
      }[],
    })
  })

  const builtModel = wrapInferredModel(modelBuilder.build(), relationships) as DefinedDataModel

  const compiledCharts = Object.entries(options.charts).map(([chartId, chartConfig]) => {
    const xAxis = resolveChartField(
      datasetInfos,
      relationshipsByDataset,
      chartConfig.data,
      chartConfig.xAxis,
      'xAxis',
    )
    const groupBy = chartConfig.groupBy
      ? resolveChartField(
          datasetInfos,
          relationshipsByDataset,
          chartConfig.data,
          chartConfig.groupBy,
          'groupBy',
        )
      : undefined
    const metric = chartConfig.metric === 'count'
      ? null
      : resolveChartField(
          datasetInfos,
          relationshipsByDataset,
          chartConfig.data,
          chartConfig.metric.column,
          'metric',
        )
    const aggregateMetric = chartConfig.metric === 'count'
      ? null
      : chartConfig.metric

    const lookups = new Map<string, {relationship: RuntimeRelationship; columns: Set<string>}>()
    ;[xAxis, groupBy, metric].forEach((resolvedField) => {
      if (!resolvedField?.lookup) {
        return
      }

      const existing = lookups.get(resolvedField.lookup.alias) ?? {
        relationship: resolvedField.lookup.relationship,
        columns: new Set<string>(),
      }
      existing.columns.add(resolvedField.lookup.columnId)
      lookups.set(resolvedField.lookup.alias, existing)
    })

    const chartSource = lookups.size === 0
      ? datasetInfos[chartConfig.data]!.dataset
      : (builtModel as any).materialize(`__inferred_${chartId}`, (m: any) => {
          let builder: any = m.from(chartConfig.data)

          lookups.forEach(({relationship, columns}, alias) => {
            builder = builder.join(alias, {
              relationship: relationship.id,
              columns: [...columns],
            })
          })

          return builder.grain(chartConfig.data)
        })

    let compiledChart: any = chartSource.chart(chartId)
      .xAxis((x: any) => x.allowed(xAxis.internalId).default(xAxis.internalId))

    if (groupBy) {
      compiledChart = compiledChart.groupBy((g: any) => g.allowed(groupBy.internalId).default(groupBy.internalId))
    }

    if (chartConfig.metric === 'count') {
      compiledChart = compiledChart.metric((m: any) => m.count())
    } else {
      compiledChart = compiledChart.metric((m: any) =>
        m
          .aggregate(metric!.internalId, aggregateMetric!.fn, aggregateMetric!.includeZeros)
          .defaultAggregate(metric!.internalId, aggregateMetric!.fn, aggregateMetric!.includeZeros),
      )
    }

    if (chartConfig.chartType) {
      compiledChart = compiledChart.chartType((t: any) => t.allowed(chartConfig.chartType).default(chartConfig.chartType))
    }

    if (chartConfig.timeBucket) {
      compiledChart = compiledChart.timeBucket((tb: any) => tb.allowed(chartConfig.timeBucket).default(chartConfig.timeBucket))
    }

    return {
      id: chartId,
      schema: compiledChart,
    }
  })

  let dashboardBuilder: any = defineDashboard(builtModel)
  compiledCharts.forEach((compiledChart) => {
    dashboardBuilder = dashboardBuilder.chart(compiledChart.id, compiledChart.schema)
  })

  selectedSharedFilters.forEach((filterId) => {
    const matchingRelationships = relationships.filter((relationship) => relationship.alias === filterId)
    if (matchingRelationships.length > 0) {
      dashboardBuilder = dashboardBuilder.sharedFilter(filterId)
      return
    }

    const targetDatasets = Object.values(datasetInfos).filter((dataset) => {
      const column = dataset.columnsById.get(filterId)
      return column?.type === 'category' || column?.type === 'boolean'
    })

    if (targetDatasets.length === 0) {
      throw new Error(`Cannot resolve shared filter "${filterId}".`)
    }

    dashboardBuilder = dashboardBuilder.sharedFilter(filterId, {
      kind: 'select',
      source: {
        dataset: targetDatasets[0]!.id,
        column: filterId,
      },
      targets: targetDatasets.map((dataset) => ({
        dataset: dataset.id,
        column: filterId,
      })) as readonly {
        dataset: string
        column: string
      }[],
    })
  })

  return dashboardBuilder.build() as CreateDashboardResult<
    TData,
    TDatasetConfigs,
    TKeys,
    TRelationships,
    TExclude,
    TCharts,
    TSharedFilters
  >
}
