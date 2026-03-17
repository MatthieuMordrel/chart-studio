import {resolveDatasetDefinition, validateDatasetData} from './define-dataset.js'
import type {
  DataModelBuilder,
  DefinedDataModel,
  ModelAssociationDefinition,
  ModelAttributeDefinition,
  ModelDataInput,
  ModelDatasets,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {DefinedDataset} from './dataset-builder.types.js'

type PrimitiveKeyValue = string | number | boolean | bigint | symbol | Date

type DataModelState<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
> = {
  datasets: TDatasets
  relationships: TRelationships
  associations: TAssociations
  attributes: TAttributes
}

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

function buildFingerprint(value: PrimitiveKeyValue): string {
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  return `${typeof value}:${String(value)}`
}

function getSingleDatasetKey(
  dataset: DefinedDataset<any, any, any>,
  datasetId: string,
): string {
  if (!dataset.key || dataset.key.length !== 1) {
    throw new Error(`Dataset "${datasetId}" must declare exactly one key to participate in relationships or associations.`)
  }

  return dataset.key[0]
}

function assertUniqueId(
  collection: Record<string, unknown>,
  kind: string,
  id: string,
): void {
  if (id in collection) {
    throw new Error(`Duplicate ${kind} id: "${id}"`)
  }
}

function getDatasetOrThrow(
  datasets: Record<string, DefinedDataset<any, any, any>>,
  datasetId: string,
): DefinedDataset<any, any, any> {
  const dataset = datasets[datasetId]

  if (!dataset) {
    throw new Error(`Unknown dataset id: "${datasetId}"`)
  }

  return dataset
}

function createKeyLookup(
  datasetId: string,
  dataset: DefinedDataset<any, any, any>,
  rows: readonly any[],
): {
  keyId: string
  values: Set<string>
} {
  const keyId = getSingleDatasetKey(dataset, datasetId)
  const values = new Set<string>()

  rows.forEach((row, index) => {
    const value = row[keyId]

    if (value == null) {
      throw new Error(`Dataset "${datasetId}" key "${keyId}" is missing a value at row ${index}.`)
    }

    values.add(buildFingerprint(value as PrimitiveKeyValue))
  })

  return {
    keyId,
    values,
  }
}

function validateRelationshipData(
  relationship: ModelRelationshipDefinition,
  data: ModelDataInput<any>,
  keyLookups: Record<string, {keyId: string; values: Set<string>}>,
): void {
  const toRows = data[relationship.to.dataset]
  const sourceLookup = keyLookups[relationship.from.dataset]

  if (!sourceLookup) {
    throw new Error(`Relationship "${relationship.id}" requires dataset "${relationship.from.dataset}" data.`)
  }

  if (!Array.isArray(toRows)) {
    throw new Error(`Relationship "${relationship.id}" requires dataset "${relationship.to.dataset}" data.`)
  }

  ;(toRows as readonly Record<string, unknown>[]).forEach((row, index) => {
    const value = row[relationship.to.column]

    if (value == null) {
      return
    }

    if (!sourceLookup.values.has(buildFingerprint(value as PrimitiveKeyValue))) {
      throw new Error(
        `Relationship "${relationship.id}" has an orphan foreign key "${formatValue(value)}" in dataset "${relationship.to.dataset}" column "${relationship.to.column}" at row ${index}.`,
      )
    }
  })
}

function validateExplicitAssociationData(
  association: Extract<ModelAssociationDefinition['edge'], {kind: 'explicit'}>,
  associationId: string,
  fromDatasetId: string,
  toDatasetId: string,
  fromLookup: {values: Set<string>},
  toLookup: {values: Set<string>},
): void {
  association.data.forEach((row, index) => {
    const fromValue = row[association.columns.from]
    const toValue = row[association.columns.to]

    if (fromValue == null) {
      throw new Error(`Association "${associationId}" is missing "${association.columns.from}" at edge row ${index}.`)
    }

    if (toValue == null) {
      throw new Error(`Association "${associationId}" is missing "${association.columns.to}" at edge row ${index}.`)
    }

    if (!fromLookup.values.has(buildFingerprint(fromValue as PrimitiveKeyValue))) {
      throw new Error(
        `Association "${associationId}" has an orphan "${association.columns.from}" value "${formatValue(fromValue)}" for dataset "${fromDatasetId}".`,
      )
    }

    if (!toLookup.values.has(buildFingerprint(toValue as PrimitiveKeyValue))) {
      throw new Error(
        `Association "${associationId}" has an orphan "${association.columns.to}" value "${formatValue(toValue)}" for dataset "${toDatasetId}".`,
      )
    }
  })
}

function validateDerivedAssociationData(
  association: ModelAssociationDefinition,
  state: DataModelState<any, any, any, any>,
  data: ModelDataInput<any>,
  keyLookups: Record<string, {keyId: string; values: Set<string>}>,
): void {
  const derivedEdge = association.edge

  if (derivedEdge.kind !== 'derived') {
    return
  }

  const deriveDatasetId = derivedEdge.deriveFrom.dataset
  const deriveRows = data[deriveDatasetId]
  const deriveDataset = getDatasetOrThrow(state.datasets, deriveDatasetId)
  const deriveKeyId = getSingleDatasetKey(deriveDataset, deriveDatasetId)
  const oppositeDatasetId = deriveDatasetId === association.from.dataset
    ? association.to.dataset
    : association.from.dataset
  const oppositeLookup = keyLookups[oppositeDatasetId]

  if (!oppositeLookup) {
    throw new Error(`Association "${association.id}" requires dataset "${oppositeDatasetId}" data.`)
  }

  if (!Array.isArray(deriveRows)) {
    throw new Error(`Association "${association.id}" requires dataset "${deriveDatasetId}" data.`)
  }

  ;(deriveRows as readonly Record<string, unknown>[]).forEach((row, index) => {
    const sourceKey = row[deriveKeyId]

    if (sourceKey == null) {
      throw new Error(`Association "${association.id}" source dataset "${deriveDatasetId}" is missing key "${deriveKeyId}" at row ${index}.`)
    }

    const rawValues = derivedEdge.deriveFrom.values(row) ?? []
    if (!Array.isArray(rawValues)) {
      throw new Error(`Association "${association.id}" deriveFrom.values(...) must return an array.`)
    }

    rawValues.forEach((value) => {
      if (value == null) {
        throw new Error(`Association "${association.id}" deriveFrom.values(...) returned an empty key value.`)
      }

      if (!oppositeLookup.values.has(buildFingerprint(value as PrimitiveKeyValue))) {
        throw new Error(
          `Association "${association.id}" has an orphan derived key "${formatValue(value)}" targeting dataset "${oppositeDatasetId}".`,
        )
      }
    })
  })
}

function validateAssociationData(
  association: ModelAssociationDefinition,
  state: DataModelState<any, any, any, any>,
  data: ModelDataInput<any>,
  keyLookups: Record<string, {keyId: string; values: Set<string>}>,
): void {
  const fromLookup = keyLookups[association.from.dataset]
  const toLookup = keyLookups[association.to.dataset]

  if (!fromLookup || !toLookup) {
    throw new Error(`Association "${association.id}" requires both endpoint datasets to be present.`)
  }

  if (association.edge.kind === 'explicit') {
    validateExplicitAssociationData(
      association.edge,
      association.id,
      association.from.dataset,
      association.to.dataset,
      fromLookup,
      toLookup,
    )
    return
  }

  validateDerivedAssociationData(association, state, data, keyLookups)
}

function validateModelRuntimeData(
  state: DataModelState<any, any, any, any>,
  data: ModelDataInput<any>,
): void {
  const keyLookups: Record<string, {keyId: string; values: Set<string>}> = {}

  ;(Object.entries(state.datasets) as Array<[string, DefinedDataset<any, any, any>]>).forEach(([datasetId, dataset]) => {
    const rows = data[datasetId]
    if (!Array.isArray(rows)) {
      throw new Error(`Missing dataset data for "${datasetId}".`)
    }

    validateDatasetData(dataset, rows, datasetId)

    if (dataset.key && dataset.key.length === 1) {
      keyLookups[datasetId] = createKeyLookup(datasetId, dataset, rows)
    }
  })

  ;(Object.values(state.relationships) as ModelRelationshipDefinition[]).forEach((relationship) => {
    validateRelationshipData(relationship, data, keyLookups)
  })

  ;(Object.values(state.associations) as ModelAssociationDefinition[]).forEach((association) => {
    validateAssociationData(association, state, data, keyLookups)
  })
}

function createDefinedDataModel<
  TDatasets extends ModelDatasets,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
>(
  state: DataModelState<TDatasets, TRelationships, TAssociations, TAttributes>,
): DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes> {
  let cachedModel: DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes> | undefined

  const build = (): DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes> => {
    if (cachedModel) {
      return cachedModel
    }

    const definedModel: DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes> = {
      datasets: state.datasets,
      relationships: state.relationships,
      associations: state.associations,
      attributes: state.attributes,
      validateData(data) {
        validateModelRuntimeData(state, data)
      },
      build() {
        return definedModel
      },
      __dataModelBrand: 'data-model-definition',
    }

    cachedModel = definedModel
    return definedModel
  }

  return build()
}

function createDataModelBuilder<
  TDatasets extends ModelDatasets = {},
  TRelationships extends Record<string, ModelRelationshipDefinition> = {},
  TAssociations extends Record<string, ModelAssociationDefinition> = {},
  TAttributes extends Record<string, ModelAttributeDefinition> = {},
>(
  state: DataModelState<TDatasets, TRelationships, TAssociations, TAttributes> = {
    datasets: {} as TDatasets,
    relationships: {} as TRelationships,
    associations: {} as TAssociations,
    attributes: {} as TAttributes,
  },
): DataModelBuilder<TDatasets, TRelationships, TAssociations, TAttributes> {
  let cachedModel: DefinedDataModel<TDatasets, TRelationships, TAssociations, TAttributes> | undefined

  return {
    dataset(id: any, dataset: any) {
      assertUniqueId(state.datasets, 'dataset', id)
      const resolvedDataset = resolveDatasetDefinition(dataset)

      return createDataModelBuilder({
        ...state,
        datasets: {
          ...state.datasets,
          [id]: resolvedDataset,
        },
      })
    },
    relationship(id: any, config: any) {
      assertUniqueId(state.relationships, 'relationship', id)

      const fromDataset = getDatasetOrThrow(state.datasets, config.from.dataset)
      const fromKeyId = getSingleDatasetKey(fromDataset, config.from.dataset)
      getDatasetOrThrow(state.datasets, config.to.dataset)

      if (config.from.key !== fromKeyId) {
        throw new Error(`Relationship "${id}" must use declared key "${fromKeyId}" from dataset "${config.from.dataset}".`)
      }

      return createDataModelBuilder({
        ...state,
        relationships: {
          ...state.relationships,
          [id]: {
            kind: 'relationship',
            id,
            from: config.from,
            to: config.to,
            reverse: {
              dataset: config.to.dataset,
              column: config.to.column,
              to: {
                dataset: config.from.dataset,
                key: config.from.key,
              },
            },
          },
        },
      })
    },
    association(id: any, config: any) {
      assertUniqueId(state.associations, 'association', id)

      const fromDataset = getDatasetOrThrow(state.datasets, config.from.dataset)
      const toDataset = getDatasetOrThrow(state.datasets, config.to.dataset)
      const fromKeyId = getSingleDatasetKey(fromDataset, config.from.dataset)
      const toKeyId = getSingleDatasetKey(toDataset, config.to.dataset)

      if (config.from.key !== fromKeyId) {
        throw new Error(`Association "${id}" must use declared key "${fromKeyId}" from dataset "${config.from.dataset}".`)
      }

      if (config.to.key !== toKeyId) {
        throw new Error(`Association "${id}" must use declared key "${toKeyId}" from dataset "${config.to.dataset}".`)
      }

      if ('deriveFrom' in config) {
        if (config.deriveFrom.dataset !== config.from.dataset && config.deriveFrom.dataset !== config.to.dataset) {
          throw new Error(
            `Association "${id}" deriveFrom.dataset must match either "${config.from.dataset}" or "${config.to.dataset}".`,
          )
        }
      }

      return createDataModelBuilder({
        ...state,
        associations: {
          ...state.associations,
          [id]: {
            kind: 'association',
            id,
            from: config.from,
            to: config.to,
            reverse: {
              dataset: config.to.dataset,
              key: config.to.key,
              to: {
                dataset: config.from.dataset,
                key: config.from.key,
              },
            },
            edge: 'deriveFrom' in config
              ? {
                  kind: 'derived',
                  deriveFrom: config.deriveFrom,
                }
              : {
                  kind: 'explicit',
                  data: config.data as readonly Record<string, unknown>[],
                  columns: config.columns,
                },
          },
        },
      })
    },
    attribute(id: any, config: any) {
      assertUniqueId(state.attributes, 'attribute', id)

      return createDataModelBuilder({
        ...state,
        attributes: {
          ...state.attributes,
          [id]: {
            id,
            kind: config.kind,
            source: config.source,
            targets: config.targets,
          },
        },
      })
    },
    validateData(data: any) {
      validateModelRuntimeData(state, data)
    },
    build() {
      if (cachedModel) {
        return cachedModel
      }

      cachedModel = createDefinedDataModel(state)
      return cachedModel
    },
  } as unknown as DataModelBuilder<TDatasets, TRelationships, TAssociations, TAttributes>
}

/**
 * Define one linked data model for dataset registration, relationships,
 * associations, and reusable model-level filter attributes.
 */
export function defineDataModel() {
  return createDataModelBuilder()
}
