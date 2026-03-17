import {defineDashboard} from './define-dashboard.js'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {inferColumnsFromData} from './infer-columns.js'
import {compileModelChartFromState} from './model-chart.js'
import type {
  DashboardChartRegistration,
  DashboardLocalSharedSelectFilterDefinition,
  DashboardModelSharedFilterDefinition,
  DefinedDashboard,
} from './dashboard.types.js'
import type {
  AnyDefinedDataModel,
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
  TModel extends AnyDefinedDataModel,
> =
  | DashboardModelSharedFilterDefinition<string, ModelAttributeDefinition>
  | DashboardLocalSharedSelectFilterDefinition<string, TModel['datasets']>

type InferredDashboardSharedFilters<
  TModel extends AnyDefinedDataModel,
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

type RuntimeDatasetInfo = {
  id: string
  keyId?: string
  dataset: DefinedDataset<any, any, any>
  columns: readonly ChartColumn<any, string>[]
  columnsById: ReadonlyMap<string, ChartColumn<any, string>>
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
    keyId,
    dataset: datasetBuilder.build(),
    columns: inferredColumns,
    columnsById: new Map(inferredColumns.map((column) => [column.id, column])),
  }
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
  const selectedSharedFilters = [...(options.sharedFilters ?? [])]

  let modelBuilder: any = defineDataModel()
  Object.values(datasetInfos).forEach((datasetInfo) => {
    modelBuilder = modelBuilder.dataset(datasetInfo.id, datasetInfo.dataset)
  })

  Object.entries(options.relationships ?? {}).forEach(([relationshipId, relationship]) => {
    const typedRelationship = relationship as CreateDashboardRelationshipConfig<any, any>
    modelBuilder = modelBuilder.relationship(relationshipId, {
      from: {dataset: typedRelationship.from.dataset, key: typedRelationship.from.key},
      to: {dataset: typedRelationship.to.dataset, column: typedRelationship.to.column},
    })
  })

  modelBuilder = modelBuilder.infer({
    relationships: true,
    attributes: true,
    exclude: options.exclude,
  })

  const builtModel = modelBuilder.build() as DefinedDataModel

  const compiledCharts = Object.entries(options.charts).map(([chartId, chartConfig]) => {
    return {
      id: chartId,
      schema: compileModelChartFromState(
        builtModel as any,
        chartId,
        {
          baseDatasetId: chartConfig.data,
          xAxis: {
            allowed: [chartConfig.xAxis],
            default: chartConfig.xAxis,
          },
          ...(chartConfig.groupBy
            ? {
                groupBy: {
                  allowed: [chartConfig.groupBy],
                  default: chartConfig.groupBy,
                },
              }
            : {}),
          metric: chartConfig.metric === 'count'
            ? {
                allowed: [{kind: 'count'}],
                default: {kind: 'count'},
              }
            : {
                allowed: [{
                  kind: 'aggregate',
                  columnId: chartConfig.metric.column,
                  aggregate: chartConfig.metric.fn,
                  includeZeros: chartConfig.metric.includeZeros,
                }],
                default: {
                  kind: 'aggregate',
                  columnId: chartConfig.metric.column,
                  aggregate: chartConfig.metric.fn,
                  includeZeros: chartConfig.metric.includeZeros,
                },
              },
          ...(chartConfig.chartType
            ? {
                chartType: {
                  allowed: [chartConfig.chartType],
                  default: chartConfig.chartType,
                },
              }
            : {}),
          ...(chartConfig.timeBucket
            ? {
                timeBucket: {
                  allowed: [chartConfig.timeBucket],
                  default: chartConfig.timeBucket,
                },
              }
            : {}),
        },
        {
          hiddenViewIdPrefix: '__inferred_',
        },
      ),
    }
  })

  let dashboardBuilder: any = defineDashboard(builtModel)
  compiledCharts.forEach((compiledChart) => {
    dashboardBuilder = dashboardBuilder.chart(compiledChart.id, compiledChart.schema)
  })

  selectedSharedFilters.forEach((filterId) => {
    if (filterId in builtModel.attributes) {
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
