import type {
  DatasetRow,
  DefinedDataset,
  SingleDatasetKeyId,
} from './dataset-builder.types.js'
import type {
  ModelAttributeDefinition,
  ModelDatasets,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {
  InferableFieldKey,
  ResolvedGroupByColumnIdFromSchema,
} from './types.js'

type Simplify<T> = {
  [TKey in keyof T]: T[TKey]
} & {}

type IsUnion<T, TWhole = T> =
  T extends TWhole
    ? ([TWhole] extends [T] ? false : true)
    : never

type SingularizeDatasetId<TDatasetId extends string> =
  TDatasetId extends `${infer TStem}ies`
    ? `${TStem}y`
    : TDatasetId extends `${infer TStem}s`
      ? TStem
      : TDatasetId

type StripIdSuffix<TValue extends string> =
  TValue extends `${infer TPrefix}Id`
    ? TPrefix
    : never

type ExplicitTargetPairUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = {
  [TRelationshipId in keyof TRelationships]:
    TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
      any,
      infer TToDatasetId extends string,
      any,
      infer TToColumn extends string
    >
      ? `${TToDatasetId}.${TToColumn}`
      : never
}[keyof TRelationships]

type ExcludedFieldPairUnion<TExclude> =
  TExclude extends readonly (infer TFieldPair extends string)[]
    ? TFieldPair
    : never

type SafeRelationshipKeyId<TDataset> =
  SingleDatasetKeyId<TDataset> extends infer TKeyId extends string
    ? TKeyId
    : never

type InferredForeignKeyColumnId<
  TDatasetId extends string,
  TKeyId extends string,
> = TKeyId extends 'id'
  ? `${SingularizeDatasetId<TDatasetId>}Id`
  : TKeyId extends `${string}Id`
    ? TKeyId
    : never

type RelationshipCandidate<
  TFromDatasetId extends string,
  TFromKey extends string,
  TToDatasetId extends string,
  TToColumn extends string,
> = {
  id: `${TToDatasetId}.${TToColumn} -> ${TFromDatasetId}.${TFromKey}`
  pair: `${TToDatasetId}.${TToColumn}`
  alias: StripIdSuffix<TToColumn>
  fromDataset: TFromDatasetId
  fromKey: TFromKey
  toDataset: TToDatasetId
  toColumn: TToColumn
}

type InferredRelationshipCandidateUnion<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TExclude extends readonly string[] | undefined,
> = {
  [TToDatasetId in Extract<keyof TDatasets, string>]: {
    [TFromDatasetId in Extract<keyof TDatasets, string>]:
      TFromDatasetId extends TToDatasetId
        ? never
        : SafeRelationshipKeyId<TDatasets[TFromDatasetId]> extends infer TFromKey extends string
          ? InferredForeignKeyColumnId<TFromDatasetId, TFromKey> extends infer TToColumn extends string
            ? TToColumn extends InferableFieldKey<DatasetRow<TDatasets[TToDatasetId]>>
              ? `${TToDatasetId}.${TToColumn}` extends
                  | ExplicitTargetPairUnion<TRelationships>
                  | ExcludedFieldPairUnion<TExclude>
                ? never
                : RelationshipCandidate<
                    TFromDatasetId,
                    TFromKey,
                    TToDatasetId,
                    TToColumn
                  >
              : never
            : never
          : never
  }[Extract<keyof TDatasets, string>]
}[Extract<keyof TDatasets, string>]

type UniqueRelationshipCandidateUnion<
  TCandidates,
> = TCandidates extends infer TCandidate
  ? TCandidate extends {pair: infer TPair extends string}
    ? Extract<TCandidates, {pair: TPair}> extends infer TMatchingCandidate
      ? TMatchingCandidate extends {fromDataset: infer TFromDataset}
        ? IsUnion<TFromDataset> extends true
          ? never
          : TCandidate
        : never
      : never
    : never
  : never

type AliasableRelationshipUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
> = {
  [TRelationshipId in keyof TRelationships]:
    TRelationships[TRelationshipId] extends ModelRelationshipDefinition<
      infer TFromDatasetId extends string,
      infer TToDatasetId extends string,
      infer TFromKey extends string,
      infer TToColumn extends string
    >
      ? StripIdSuffix<TToColumn> extends infer TAlias extends string
        ? TToColumn extends `${string}Id`
          ? {
              id: Extract<TRelationshipId, string>
              alias: TAlias
              fromDataset: TFromDatasetId
              fromKey: TFromKey
              toDataset: TToDatasetId
              toColumn: TToColumn
            }
          : never
        : never
      : never
}[keyof TRelationships]

type LabelColumnCandidates<TDataset extends DefinedDataset<any, any, any>> = Exclude<
  ResolvedGroupByColumnIdFromSchema<DatasetRow<TDataset>, TDataset>,
  SafeRelationshipKeyId<TDataset> | `${string}Id`
> | SafeRelationshipKeyId<TDataset>

type InferredAttributeAliasUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
> = Exclude<
  AliasableRelationshipUnion<TRelationships>['alias'],
  Extract<keyof TAttributes, string>
>

type UniqueAttributeAliasUnion<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
> = InferredAttributeAliasUnion<TRelationships, TAttributes> extends infer TAlias
  ? TAlias extends string
    ? IsUnion<Extract<AliasableRelationshipUnion<TRelationships>, {alias: TAlias}>['fromDataset']> extends true
      ? never
      : TAlias
    : never
  : never

type AttributeSourceDatasetId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAlias extends string,
> = Extract<
  Extract<AliasableRelationshipUnion<TRelationships>, {alias: TAlias}>['fromDataset'],
  string
>

type AttributeSourceKeyId<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAlias extends string,
> = Extract<
  Extract<AliasableRelationshipUnion<TRelationships>, {alias: TAlias}>['fromKey'],
  string
>

type AttributeTargetsForAlias<
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAlias extends string,
> = readonly (
  Extract<
    AliasableRelationshipUnion<TRelationships>,
    {alias: TAlias}
  > extends infer TRelationship
    ? TRelationship extends {
        id: infer TRelationshipId extends string
        toDataset: infer TToDatasetId extends string
        toColumn: infer TToColumn extends string
      }
      ? {
          dataset: TToDatasetId
          column: TToColumn
          via: TRelationshipId
        }
      : never
    : never
)[]

type CanInferAttributeForAlias<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAlias extends string,
> = LabelColumnCandidates<TDatasets[AttributeSourceDatasetId<TRelationships, TAlias>]> extends never
  ? false
  : true

export type InferRelationshipsForModel<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TExclude extends readonly string[] | undefined,
> = Simplify<
  TRelationships & {
    [TRelationship in UniqueRelationshipCandidateUnion<
      InferredRelationshipCandidateUnion<TDatasets, TRelationships, TExclude>
    > as TRelationship['id']]: ModelRelationshipDefinition<
      TRelationship['fromDataset'],
      TRelationship['toDataset'],
      TRelationship['fromKey'],
      TRelationship['toColumn']
    >
  }
>

export type InferAttributesForModel<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
> = Simplify<
  TAttributes & {
    [TAlias in UniqueAttributeAliasUnion<TRelationships, TAttributes> as CanInferAttributeForAlias<
      TDatasets,
      TRelationships,
      TAlias
    > extends true ? TAlias : never]: ModelAttributeDefinition<
      AttributeSourceDatasetId<TRelationships, TAlias>,
      AttributeTargetsForAlias<TRelationships, TAlias>
    > & {
      source: {
        dataset: AttributeSourceDatasetId<TRelationships, TAlias>
        key: AttributeSourceKeyId<TRelationships, TAlias>
        label: LabelColumnCandidates<TDatasets[AttributeSourceDatasetId<TRelationships, TAlias>]>
      }
    }
  }
>
