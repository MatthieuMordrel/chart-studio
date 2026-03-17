import type {
  AnyDefinedDataModel,
  DefinedDataModel,
  ModelAssociationDefinition,
  ModelAttributeDefinition,
  ModelDatasetId,
  ModelDatasets,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {
  DatasetChartBuilder,
  DatasetColumns,
  DatasetKeyIds,
  DatasetRow,
  DefinedDataset,
  SingleDatasetKeyId,
} from './dataset-builder.types.js'
import type {ResolvedColumnIdFromSchema} from './types.js'

/**
 * Phase 7 materialized-view types.
 *
 * These types keep cross-dataset chart grains explicit:
 * a chart still executes against one flat row shape, but that row shape may now
 * come from a reusable model-derived view when the author opts into
 * materialization.
 */

type Simplify<T> = {
  [TKey in keyof T]: T[TKey]
} & {}

type UniqueId<TId extends string, TExisting extends string> =
  TId extends TExisting
    ? never
    : TId

type MergeColumns<
  TLeft extends Record<string, unknown> | undefined,
  TRight extends Record<string, unknown>,
> = [TLeft] extends [undefined]
  ? TRight
  : Simplify<TLeft & TRight>

type DeclaredDatasetColumns<TDataset> = Extract<
  DatasetColumns<TDataset>,
  Record<string, unknown>
>

type DeclaredVisibleDatasetColumnId<TDataset> = Extract<
  {
    [TColumnId in keyof DeclaredDatasetColumns<TDataset>]:
      DeclaredDatasetColumns<TDataset>[TColumnId] extends false
        ? never
        : TColumnId
  }[keyof DeclaredDatasetColumns<TDataset>],
  string
>

/**
 * Column IDs that a materialized view may project from one linked dataset.
 *
 * This reuses the dataset's own chart-visible column contract, so lookup and
 * expansion steps stay strongly typed instead of falling back to loose strings.
 */
export type MaterializedProjectableColumnId<TDataset> = ResolvedColumnIdFromSchema<
  DatasetRow<TDataset>,
  TDataset extends {columns?: Record<string, unknown> | undefined}
    ? TDataset
    : undefined
>

type DefaultLookupProjectionColumnId<TDataset> = Exclude<
  DeclaredVisibleDatasetColumnId<TDataset>,
  SingleDatasetKeyId<TDataset>
>

type DefaultExpandedProjectionColumnId<TDataset> =
  | DeclaredVisibleDatasetColumnId<TDataset>
  | SingleDatasetKeyId<TDataset>

type EffectiveProjectionColumnId<
  TDataset,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
> = [TColumns] extends [readonly string[]]
  ? TColumns[number] | (TIncludeKey extends true ? SingleDatasetKeyId<TDataset> : never)
  : TIncludeKey extends true
    ? DefaultExpandedProjectionColumnId<TDataset>
    : DefaultLookupProjectionColumnId<TDataset>

type DeclaredEffectiveProjectionColumnId<
  TDataset,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
> = Extract<
  EffectiveProjectionColumnId<TDataset, TColumns, TIncludeKey>,
  DeclaredVisibleDatasetColumnId<TDataset>
>

type ProjectedColumnHintFromEntry<TEntry> =
  TEntry extends {kind: 'derived'; type: infer TType extends string}
    ? Simplify<
        {
          type: TType
        }
        & (TEntry extends {format?: infer TFormat} ? {format?: TFormat} : {})
        & (TEntry extends {label?: infer TLabel} ? {label?: TLabel} : {})
        & (TEntry extends {trueLabel?: infer TTrueLabel} ? {trueLabel?: TTrueLabel} : {})
        & (TEntry extends {falseLabel?: infer TFalseLabel} ? {falseLabel?: TFalseLabel} : {})
      >
    : TEntry extends {type?: infer TType extends string}
      ? Simplify<
          (undefined extends TType ? {} : {type: TType})
          & (TEntry extends {format?: infer TFormat} ? {format?: TFormat} : {})
          & (TEntry extends {label?: infer TLabel} ? {label?: TLabel} : {})
          & (TEntry extends {trueLabel?: infer TTrueLabel} ? {trueLabel?: TTrueLabel} : {})
          & (TEntry extends {falseLabel?: infer TFalseLabel} ? {falseLabel?: TFalseLabel} : {})
        >
      : {}

type PrefixedColumnId<
  TAlias extends string,
  TColumnId extends string,
> = `${TAlias}${Capitalize<TColumnId>}`

type ProjectedColumnsMap<
  TDataset,
  TAlias extends string,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
> = Simplify<
  {
    [TColumnId in DeclaredEffectiveProjectionColumnId<
      TDataset,
      TColumns,
      TIncludeKey
    > as PrefixedColumnId<TAlias, TColumnId>]: ProjectedColumnHintFromEntry<
      DeclaredDatasetColumns<TDataset>[TColumnId]
    >
  }
>

type RawProjectedColumnId<
  TDataset,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
> = Extract<
  EffectiveProjectionColumnId<TDataset, TColumns, TIncludeKey>,
  Extract<keyof DatasetRow<TDataset>, string>
>

type DerivedProjectedColumnId<
  TDataset,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
> = Extract<
  {
    [TColumnId in DeclaredEffectiveProjectionColumnId<TDataset, TColumns, TIncludeKey>]:
      DeclaredDatasetColumns<TDataset>[TColumnId] extends {kind: 'derived'}
        ? TColumnId
        : never
  }[DeclaredEffectiveProjectionColumnId<TDataset, TColumns, TIncludeKey>],
  string
>

type ProjectedRowFields<
  TDataset,
  TAlias extends string,
  TColumns extends readonly string[] | undefined,
  TIncludeKey extends boolean,
  TNullable extends boolean,
> = Simplify<
  {
    [TColumnId in RawProjectedColumnId<
      TDataset,
      TColumns,
      TIncludeKey
    > as PrefixedColumnId<TAlias, TColumnId>]:
      TNullable extends true
        ? DatasetRow<TDataset>[TColumnId] | null
        : DatasetRow<TDataset>[TColumnId]
  } & {
    [TColumnId in DerivedProjectedColumnId<
      TDataset,
      TColumns,
      TIncludeKey
    > as PrefixedColumnId<TAlias, TColumnId>]:
      DeclaredDatasetColumns<TDataset>[TColumnId] extends {
        kind: 'derived'
        accessor: (row: any) => infer TValue
      }
        ? TNullable extends true
          ? TValue | null
          : TValue
        : never
  }
>

type AppendExpandedKey<
  TBaseKey extends readonly string[] | undefined,
  TAlias extends string,
  TDataset,
> = TBaseKey extends readonly string[]
  ? readonly [...TBaseKey, PrefixedColumnId<TAlias, SingleDatasetKeyId<TDataset>>]
  : readonly [PrefixedColumnId<TAlias, SingleDatasetKeyId<TDataset>>]

type RelationshipLookupId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends string,
> = Extract<
  {
    [TRelationshipId in keyof TRelationships]:
      TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
        any,
        infer TToDatasetId extends string,
        any,
        any
      >
        ? TToDatasetId extends TBaseDatasetId
          ? TRelationshipId
          : never
        : never
  }[keyof TRelationships],
  string
>

type RelationshipExpansionId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends string,
> = Extract<
  {
    [TRelationshipId in keyof TRelationships]:
      TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
        infer TFromDatasetId extends string,
        any,
        any,
        any
      >
        ? TFromDatasetId extends TBaseDatasetId
          ? TRelationshipId
          : never
        : never
  }[keyof TRelationships],
  string
>

type RelationshipLookupTargetDatasetId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TRelationshipId extends string,
> = Extract<
  TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
    infer TFromDatasetId extends string,
    any,
    any,
    any
  >
    ? TFromDatasetId
    : never,
  string
>

type RelationshipExpansionTargetDatasetId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TRelationshipId extends string,
> = Extract<
  TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
    any,
    infer TToDatasetId extends string,
    any,
    any
  >
    ? TToDatasetId
    : never,
  string
>

type AssociationExpansionId<
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TBaseDatasetId extends string,
> = Extract<
  {
    [TAssociationId in keyof TAssociations]:
      TAssociations[TAssociationId] extends ModelAssociationDefinition<
        infer TFromDatasetId extends string,
        infer TToDatasetId extends string,
        any,
        any
      >
        ? TBaseDatasetId extends TFromDatasetId | TToDatasetId
          ? TAssociationId
          : never
        : never
  }[keyof TAssociations],
  string
>

type AssociationExpansionTargetDatasetId<
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAssociationId extends string,
  TBaseDatasetId extends string,
> = Extract<
  TAssociations[TAssociationId] extends ModelAssociationDefinition<
    infer TFromDatasetId extends string,
    infer TToDatasetId extends string,
    any,
    any
  >
    ? TBaseDatasetId extends TFromDatasetId
      ? TToDatasetId
      : TBaseDatasetId extends TToDatasetId
        ? TFromDatasetId
        : never
    : never,
  string
>

/**
 * Serializable description of one materialization step.
 *
 * This metadata exists so callers can inspect a built view and understand
 * whether it preserves grain via lookup projection or expands grain through a
 * relationship/association traversal.
 */
export type MaterializedViewStepMetadata =
  | {
      readonly kind: 'join'
      readonly alias: string
      readonly relationship: string
      readonly targetDataset: string
      readonly projectedColumns: readonly string[]
    }
  | {
      readonly kind: 'through-relationship'
      readonly alias: string
      readonly relationship: string
      readonly targetDataset: string
      readonly projectedColumns: readonly string[]
    }
  | {
      readonly kind: 'through-association'
      readonly alias: string
      readonly association: string
      readonly targetDataset: string
      readonly projectedColumns: readonly string[]
    }

/**
 * Public metadata attached to a built materialized view.
 *
 * This is the visible record of what the view is: which dataset owns the base
 * grain, what that grain is called, and which traversals made the extra columns
 * available.
 */
export type MaterializedViewMetadata<
  TId extends string = string,
  TBaseDatasetId extends string = string,
  TGrain extends string = string,
> = {
  readonly id: TId
  readonly baseDataset: TBaseDatasetId
  readonly grain: TGrain
  readonly steps: readonly MaterializedViewStepMetadata[]
}

/**
 * Resolved materialized view.
 *
 * It behaves like a reusable dataset, but also exposes explicit materialization
 * metadata and the `materialize(data)` runtime that flattens model data into
 * one chartable row array.
 */
export type DefinedMaterializedView<
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
  TModel extends AnyDefinedDataModel = AnyDefinedDataModel,
  TId extends string = string,
  TBaseDatasetId extends string = string,
  TGrain extends string = string,
> = Omit<DefinedDataset<TRow, TColumns, any>, 'build' | 'chart'> & {
  readonly key?: TKey
  chart<const TChartId extends string | undefined = undefined>(
    id?: TChartId,
  ): DatasetChartBuilder<
    TRow,
    TColumns,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    TChartId,
    DefinedMaterializedView<
      TRow,
      TColumns,
      TKey,
      TModel,
      TId,
      TBaseDatasetId,
      TGrain
    >
  >
  /**
   * Materialize one explicit flat row array from linked model data.
   *
   * Callers remain in charge of when this happens. The model does not execute
   * hidden joins at chart render time.
   */
  materialize(data: TModel extends DefinedDataModel<infer TDatasets, any, any, any>
    ? {readonly [TDatasetId in keyof TDatasets]: readonly DatasetRow<TDatasets[TDatasetId]>[]}
    : never): readonly TRow[]
  /**
   * Resolve the fluent view definition into its reusable dataset-like form.
   */
  build(): DefinedMaterializedView<
    TRow,
    TColumns,
    TKey,
    TModel,
    TId,
    TBaseDatasetId,
    TGrain
  >
  readonly materialization: MaterializedViewMetadata<TId, TBaseDatasetId, TGrain>
  readonly __materializedViewBrand: 'materialized-view-definition'
}

/**
 * Public materialized view definition accepted across the chart-studio API.
 *
 * The definition is intentionally also a concrete materialized view instance so
 * callers can reuse `.chart(...)`, `.materialize(...)`, and `.build()` without
 * additional wrapping.
 */
export type MaterializedViewDefinition<
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
  TModel extends AnyDefinedDataModel = AnyDefinedDataModel,
  TId extends string = string,
  TBaseDatasetId extends string = string,
  TGrain extends string = string,
> = DefinedMaterializedView<
    TRow,
    TColumns,
    TKey,
    TModel,
    TId,
    TBaseDatasetId,
    TGrain
  >

/**
 * Entry point for authoring one model-derived materialized view.
 *
 * Authors must choose the base dataset first, because the rest of the builder
 * is defined in relation to that one explicit row grain.
 */
export interface ModelMaterializationStartBuilder<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
  TViewId extends string = string,
> {
  /**
   * Start one materialized view from the declared base dataset.
   *
   * This dataset supplies the initial row grain before any lookup projection or
   * explicit row-expanding traversal is added.
   */
  from<const TBaseDatasetId extends ModelDatasetId<TDatasets>>(
    dataset: TBaseDatasetId,
  ): ModelMaterializationBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId,
    TBaseDatasetId,
    DatasetRow<TDatasets[TBaseDatasetId]>,
    DatasetColumns<TDatasets[TBaseDatasetId]>,
    DatasetKeyIds<TDatasets[TBaseDatasetId]>,
    never,
    false
  >
}

/**
 * Fluent builder for one explicit model-derived view.
 *
 * The builder keeps three concerns separate:
 * lookup projection, row-expanding traversal, and final grain declaration.
 */
export interface ModelMaterializationBuilder<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
  TViewId extends string,
  TBaseDatasetId extends ModelDatasetId<TDatasets>,
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
  TAliases extends string,
  THasExpansion extends boolean,
> {
  /**
   * Project columns from the far side of one lookup relationship.
   *
   * This preserves the base row grain and is the ergonomic path for common
   * one-to-one or many-to-one lookups such as `jobs.ownerId -> owners.id`.
   */
  join<
    const TAlias extends string,
    const TRelationshipId extends RelationshipLookupId<TRelationships, TBaseDatasetId>,
    const TProjectedColumns extends readonly MaterializedProjectableColumnId<
      TDatasets[RelationshipLookupTargetDatasetId<TRelationships, TRelationshipId>]
    >[] | undefined = undefined,
  >(
    alias: UniqueId<TAlias, TAliases>,
    config: {
      readonly relationship: TRelationshipId
      readonly columns?: TProjectedColumns
    },
  ): ModelMaterializationBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId,
    TBaseDatasetId,
    Simplify<
      TRow & ProjectedRowFields<
        TDatasets[RelationshipLookupTargetDatasetId<TRelationships, TRelationshipId>],
        TAlias,
        TProjectedColumns,
        false,
        true
      >
    >,
    MergeColumns<
      TColumns,
      ProjectedColumnsMap<
        TDatasets[RelationshipLookupTargetDatasetId<TRelationships, TRelationshipId>],
        TAlias,
        TProjectedColumns,
        false
      >
    >,
    TKey,
    TAliases | TAlias,
    THasExpansion
  >

  /**
   * Expand the base grain across one declared one-to-many relationship.
   *
   * Use this when the chart genuinely needs the child-side grain to become part
   * of the flat output rows.
   */
  throughRelationship<
    const TAlias extends string,
    const TRelationshipId extends RelationshipExpansionId<TRelationships, TBaseDatasetId>,
    const TProjectedColumns extends readonly MaterializedProjectableColumnId<
      TDatasets[RelationshipExpansionTargetDatasetId<TRelationships, TRelationshipId>]
    >[] | undefined = undefined,
  >(
    alias: THasExpansion extends true ? never : UniqueId<TAlias, TAliases>,
    config: {
      readonly relationship: TRelationshipId
      readonly columns?: TProjectedColumns
    },
  ): ModelMaterializationBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId,
    TBaseDatasetId,
    Simplify<
      TRow & ProjectedRowFields<
        TDatasets[RelationshipExpansionTargetDatasetId<TRelationships, TRelationshipId>],
        TAlias,
        TProjectedColumns,
        true,
        false
      >
    >,
    MergeColumns<
      TColumns,
      ProjectedColumnsMap<
        TDatasets[RelationshipExpansionTargetDatasetId<TRelationships, TRelationshipId>],
        TAlias,
        TProjectedColumns,
        true
      >
    >,
    AppendExpandedKey<
      TKey,
      TAlias,
      TDatasets[RelationshipExpansionTargetDatasetId<TRelationships, TRelationshipId>]
    >,
    TAliases | TAlias,
    true
  >

  /**
   * Expand the base grain across one explicit association.
   *
   * This is the visible many-to-many path. It always stays opt-in so row
   * multiplication is never hidden.
   */
  throughAssociation<
    const TAlias extends string,
    const TAssociationId extends AssociationExpansionId<TAssociations, TBaseDatasetId>,
    const TProjectedColumns extends readonly MaterializedProjectableColumnId<
      TDatasets[AssociationExpansionTargetDatasetId<TAssociations, TAssociationId, TBaseDatasetId>]
    >[] | undefined = undefined,
  >(
    alias: THasExpansion extends true ? never : UniqueId<TAlias, TAliases>,
    config: {
      readonly association: TAssociationId
      readonly columns?: TProjectedColumns
    },
  ): ModelMaterializationBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId,
    TBaseDatasetId,
    Simplify<
      TRow & ProjectedRowFields<
        TDatasets[AssociationExpansionTargetDatasetId<TAssociations, TAssociationId, TBaseDatasetId>],
        TAlias,
        TProjectedColumns,
        true,
        false
      >
    >,
    MergeColumns<
      TColumns,
      ProjectedColumnsMap<
        TDatasets[AssociationExpansionTargetDatasetId<TAssociations, TAssociationId, TBaseDatasetId>],
        TAlias,
        TProjectedColumns,
        true
      >
    >,
    AppendExpandedKey<
      TKey,
      TAlias,
      TDatasets[AssociationExpansionTargetDatasetId<TAssociations, TAssociationId, TBaseDatasetId>]
    >,
    TAliases | TAlias,
    true
  >

  /**
   * Finalize the view with a human-readable grain label.
   *
   * Calling `grain(...)` is required so the flattened output shape always has a
   * visible semantic name such as `'job'` or `'job-skill'`.
   */
  grain<const TGrain extends string>(
    grain: TGrain,
  ): MaterializedViewDefinition<
    TRow,
    TColumns,
    TKey,
    DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes>,
    TViewId,
    TBaseDatasetId,
    TGrain
  >
}
