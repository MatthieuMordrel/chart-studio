import type {
  DatasetDefinition,
  DatasetRow,
  DefinedDataset,
  ResolvedDatasetFromDefinition,
  SingleDatasetKeyId,
} from './dataset-builder.types.js'
import type {
  InferableFieldKey,
  ResolvedGroupByColumnIdFromSchema,
} from './types.js'

type NonNullish<T> = Exclude<T, null | undefined>

type UniqueId<TId extends string, TExisting extends string> =
  TId extends TExisting
    ? never
    : TId

export type ModelDatasets = Record<string, DefinedDataset<any, any, any>>

export type ModelDatasetId<TDatasets extends ModelDatasets> = Extract<keyof TDatasets, string>

export type ModelSingleKeyDatasetId<TDatasets extends ModelDatasets> = Extract<
  {
    [TId in keyof TDatasets]:
      SingleDatasetKeyId<TDatasets[TId]> extends never
        ? never
        : TId
  }[keyof TDatasets],
  string
>

export type DatasetForeignKeyColumnId<TDataset> =
  TDataset extends DefinedDataset<infer TRow, any, any>
    ? InferableFieldKey<TRow>
    : never

export type DatasetKeyValue<TDataset> =
  TDataset extends DefinedDataset<infer TRow, any, any>
    ? SingleDatasetKeyId<TDataset> extends infer TKeyId extends keyof TRow
      ? NonNullish<TRow[TKeyId]>
      : never
    : never

export type ModelRelationshipDefinition<
  TFromDatasetId extends string = string,
  TToDatasetId extends string = string,
  TFromKey extends string = string,
  TToColumn extends string = string,
> = {
  readonly kind: 'relationship'
  readonly id: string
  readonly from: {
    readonly dataset: TFromDatasetId
    readonly key: TFromKey
  }
  readonly to: {
    readonly dataset: TToDatasetId
    readonly column: TToColumn
  }
  readonly reverse: {
    readonly dataset: TToDatasetId
    readonly column: TToColumn
    readonly to: {
      readonly dataset: TFromDatasetId
      readonly key: TFromKey
    }
  }
}

export type RelationshipConfig<
  TDatasets extends ModelDatasets,
  TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TToDatasetId extends ModelDatasetId<TDatasets>,
> = {
  readonly from: {
    readonly dataset: TFromDatasetId
    readonly key: SingleDatasetKeyId<TDatasets[TFromDatasetId]>
  }
  readonly to: {
    readonly dataset: TToDatasetId
    readonly column: DatasetForeignKeyColumnId<TDatasets[TToDatasetId]>
  }
}

type AssociationEndpoints<
  TDatasets extends ModelDatasets,
  TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
> = {
  readonly from: {
    readonly dataset: TFromDatasetId
    readonly key: SingleDatasetKeyId<TDatasets[TFromDatasetId]>
  }
  readonly to: {
    readonly dataset: TToDatasetId
    readonly key: SingleDatasetKeyId<TDatasets[TToDatasetId]>
  }
}

export type ExplicitAssociationConfig<
  TDatasets extends ModelDatasets,
  TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TEdgeRow extends Record<string, unknown>,
> = AssociationEndpoints<TDatasets, TFromDatasetId, TToDatasetId> & {
  readonly data: readonly TEdgeRow[]
  readonly columns: {
    readonly from: Extract<keyof TEdgeRow, string>
    readonly to: Extract<keyof TEdgeRow, string>
  }
}

type DerivedAssociationConfigForSource<
  TDatasets extends ModelDatasets,
  TSourceDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TOtherDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
> = AssociationEndpoints<TDatasets, TSourceDatasetId, TOtherDatasetId> & {
  readonly deriveFrom: {
    readonly dataset: TSourceDatasetId
    readonly values: (
      row: DatasetRow<TDatasets[TSourceDatasetId]>,
    ) => readonly DatasetKeyValue<TDatasets[TOtherDatasetId]>[] | null | undefined
  }
}

export type DerivedAssociationConfig<
  TDatasets extends ModelDatasets,
  TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TDeriveDatasetId extends TFromDatasetId | TToDatasetId = TFromDatasetId | TToDatasetId,
> = TDeriveDatasetId extends TFromDatasetId
  ? DerivedAssociationConfigForSource<TDatasets, TFromDatasetId, TToDatasetId>
  : DerivedAssociationConfigForSource<TDatasets, TToDatasetId, TFromDatasetId>

export type AssociationConfig<
  TDatasets extends ModelDatasets,
  TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TEdgeRow extends Record<string, unknown> = Record<string, unknown>,
  TDeriveDatasetId extends TFromDatasetId | TToDatasetId = TFromDatasetId | TToDatasetId,
> =
  | ExplicitAssociationConfig<TDatasets, TFromDatasetId, TToDatasetId, TEdgeRow>
  | DerivedAssociationConfig<TDatasets, TFromDatasetId, TToDatasetId, TDeriveDatasetId>

export type ModelAssociationDefinition<
  TFromDatasetId extends string = string,
  TToDatasetId extends string = string,
  TFromKey extends string = string,
  TToKey extends string = string,
> = {
  readonly kind: 'association'
  readonly id: string
  readonly from: {
    readonly dataset: TFromDatasetId
    readonly key: TFromKey
  }
  readonly to: {
    readonly dataset: TToDatasetId
    readonly key: TToKey
  }
  readonly reverse: {
    readonly dataset: TToDatasetId
    readonly key: TToKey
    readonly to: {
      readonly dataset: TFromDatasetId
      readonly key: TFromKey
    }
  }
  readonly edge:
    | {
        readonly kind: 'explicit'
        readonly data: readonly Record<string, unknown>[]
        readonly columns: {
          readonly from: string
          readonly to: string
        }
      }
    | {
        readonly kind: 'derived'
        readonly deriveFrom: {
          readonly dataset: string
          readonly values: (row: unknown) => readonly unknown[] | null | undefined
        }
      }
}

type RelationshipTarget<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TSourceDatasetId extends string,
> = {
  [TRelationshipId in keyof TRelationships]:
    TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
      TSourceDatasetId,
      infer TTargetDatasetId extends string,
      any,
      infer TToColumn extends string
    >
      ? {
          readonly dataset: TTargetDatasetId
          readonly column: TToColumn
          readonly via: Extract<TRelationshipId, string>
        }
      : never
}[keyof TRelationships]

type AssociationTarget<
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TSourceDatasetId extends string,
> = {
  [TAssociationId in keyof TAssociations]:
    TAssociations[TAssociationId] extends ModelAssociationDefinition<
      infer TFromDatasetId extends string,
      infer TToDatasetId extends string,
      any,
      any
    >
      ? TFromDatasetId extends TSourceDatasetId
        ? {
            readonly dataset: TToDatasetId
            readonly through: Extract<TAssociationId, string>
            readonly mode: 'exists'
          }
        : TToDatasetId extends TSourceDatasetId
          ? {
              readonly dataset: TFromDatasetId
              readonly through: Extract<TAssociationId, string>
              readonly mode: 'exists'
            }
          : never
      : never
}[keyof TAssociations]

export type ModelAttributeTarget<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TSourceDatasetId extends string,
> =
  | RelationshipTarget<TRelationships, TSourceDatasetId>
  | AssociationTarget<TAssociations, TSourceDatasetId>

export type SelectAttributeConfig<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TSourceDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
  TTargets extends readonly ModelAttributeTarget<
    TRelationships,
    TAssociations,
    TSourceDatasetId
  >[],
> = {
  readonly kind: 'select'
  readonly source: {
    readonly dataset: TSourceDatasetId
    readonly key: SingleDatasetKeyId<TDatasets[TSourceDatasetId]>
    readonly label: ResolvedGroupByColumnIdFromSchema<
      DatasetRow<TDatasets[TSourceDatasetId]>,
      TDatasets[TSourceDatasetId]
    >
  }
  readonly targets: TTargets
}

export type ModelAttributeDefinition<
  TSourceDatasetId extends string = string,
  TTargets extends readonly unknown[] = readonly unknown[],
> = {
  readonly kind: 'select'
  readonly id: string
  readonly source: {
    readonly dataset: TSourceDatasetId
    readonly key: string
    readonly label: string
  }
  readonly targets: TTargets
}

export type ModelDataInput<TDatasets extends ModelDatasets> = {
  readonly [TId in keyof TDatasets]: readonly DatasetRow<TDatasets[TId]>[]
}

export type DefinedDataModel<
  TDatasets extends ModelDatasets = {},
  TRelationships extends Record<string, ModelRelationshipDefinition> = {},
  TAssociations extends Record<string, ModelAssociationDefinition> = {},
  TAttributes extends Record<string, ModelAttributeDefinition> = {},
> = {
  readonly datasets: TDatasets
  readonly relationships: TRelationships
  readonly associations: TAssociations
  readonly attributes: TAttributes
  validateData(data: ModelDataInput<TDatasets>): void
  build(): DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes>
  readonly __dataModelBrand: 'data-model-definition'
}

export type DataModelDefinition<
  TDatasets extends ModelDatasets = {},
  TRelationships extends Record<string, ModelRelationshipDefinition> = {},
  TAssociations extends Record<string, ModelAssociationDefinition> = {},
  TAttributes extends Record<string, ModelAttributeDefinition> = {},
> = {
  build(): DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes>
}

export interface DataModelBuilder<
  TDatasets extends ModelDatasets = {},
  TRelationships extends Record<string, ModelRelationshipDefinition> = {},
  TAssociations extends Record<string, ModelAssociationDefinition> = {},
  TAttributes extends Record<string, ModelAttributeDefinition> = {},
> extends DataModelDefinition<TDatasets, TRelationships, TAssociations, TAttributes> {
  dataset<
    const TId extends string,
    const TDataset extends DatasetDefinition<any, any, any>,
  >(
    id: UniqueId<TId, ModelDatasetId<TDatasets>>,
    dataset: TDataset,
  ): DataModelBuilder<
    TDatasets & Record<TId, ResolvedDatasetFromDefinition<TDataset>>,
    TRelationships,
    TAssociations,
    TAttributes
  >

  relationship<
    const TId extends string,
    const TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TToDatasetId extends ModelDatasetId<TDatasets>,
  >(
    id: UniqueId<TId, Extract<keyof TRelationships, string>>,
    config: RelationshipConfig<TDatasets, TFromDatasetId, TToDatasetId>,
  ): DataModelBuilder<
    TDatasets,
    TRelationships & Record<
      TId,
      ModelRelationshipDefinition<
        TFromDatasetId,
        TToDatasetId,
        SingleDatasetKeyId<TDatasets[TFromDatasetId]>,
        DatasetForeignKeyColumnId<TDatasets[TToDatasetId]>
      >
    >,
    TAssociations,
    TAttributes
  >

  association<
    const TId extends string,
    const TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TEdgeRow extends Record<string, unknown> = Record<string, unknown>,
  >(
    id: UniqueId<TId, Extract<keyof TAssociations, string>>,
    config: ExplicitAssociationConfig<TDatasets, TFromDatasetId, TToDatasetId, TEdgeRow>,
  ): DataModelBuilder<
    TDatasets,
    TRelationships,
    TAssociations & Record<
      TId,
      ModelAssociationDefinition<
        TFromDatasetId,
        TToDatasetId,
        SingleDatasetKeyId<TDatasets[TFromDatasetId]>,
        SingleDatasetKeyId<TDatasets[TToDatasetId]>
      >
    >,
    TAttributes
  >

  association<
    const TId extends string,
    const TFromDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TToDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TDeriveDatasetId extends TFromDatasetId | TToDatasetId,
  >(
    id: UniqueId<TId, Extract<keyof TAssociations, string>>,
    config: DerivedAssociationConfig<
      TDatasets,
      TFromDatasetId,
      TToDatasetId,
      TDeriveDatasetId
    >,
  ): DataModelBuilder<
    TDatasets,
    TRelationships,
    TAssociations & Record<
      TId,
      ModelAssociationDefinition<
        TFromDatasetId,
        TToDatasetId,
        SingleDatasetKeyId<TDatasets[TFromDatasetId]>,
        SingleDatasetKeyId<TDatasets[TToDatasetId]>
      >
    >,
    TAttributes
  >

  attribute<
    const TId extends string,
    const TSourceDatasetId extends ModelSingleKeyDatasetId<TDatasets>,
    const TTargets extends readonly ModelAttributeTarget<
      TRelationships,
      TAssociations,
      TSourceDatasetId
    >[],
  >(
    id: UniqueId<TId, Extract<keyof TAttributes, string>>,
    config: SelectAttributeConfig<
      TDatasets,
      TRelationships,
      TAssociations,
      TSourceDatasetId,
      TTargets
    >,
  ): DataModelBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes & Record<TId, ModelAttributeDefinition<TSourceDatasetId, TTargets>>
  >

  validateData(data: ModelDataInput<TDatasets>): void

  build(): DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes>
}
