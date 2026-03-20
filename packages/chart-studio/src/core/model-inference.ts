import type {
  AnyDefinedDataModel,
  ModelAttributeDefinition,
  ModelDatasets,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {DefinedDataset} from './dataset-builder.types.js'
import type {MaterializedViewDefinition} from './materialized-view.types.js'

type RuntimeRelationshipDefinition = ModelRelationshipDefinition<string, string, string, string>

export const MODEL_RUNTIME_METADATA = Symbol('model-runtime-metadata')

export type InferredRelationshipMetadata = {
  readonly id: string
  readonly fromDataset: string
  readonly fromKey: string
  readonly toDataset: string
  readonly toColumn: string
}

export type ModelRuntimeMetadata = {
  readonly inferredRelationships: ReadonlyMap<string, InferredRelationshipMetadata>
  readonly materializedViews: ReadonlyMap<string, MaterializedViewDefinition<any, any, any, any>>
}

type MutableModelRuntimeMetadata = {
  inferredRelationships: Map<string, InferredRelationshipMetadata>
  materializedViews: Map<string, MaterializedViewDefinition<any, any, any, any>>
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

export function stripIdSuffix(value: string): string | undefined {
  return value.endsWith('Id')
    ? value.slice(0, -2)
    : undefined
}

export function resolveRelationshipAlias(
  relationship: RuntimeRelationshipDefinition,
): string | undefined {
  return stripIdSuffix(relationship.to.column)
}

export function buildRelationshipId(
  toDatasetId: string,
  toColumnId: string,
  fromDatasetId: string,
  fromKeyId: string,
): string {
  return `${toDatasetId}.${toColumnId} -> ${fromDatasetId}.${fromKeyId}`
}

function resolveRelationshipSourceKeyId(
  dataset: DefinedDataset<any, any, any>,
): string | undefined {
  if (dataset.key?.length === 1) {
    return dataset.key[0]
  }

  return undefined
}

function buildInferredForeignKeyColumnId(
  sourceDatasetId: string,
  sourceKeyId: string,
): string | undefined {
  if (sourceKeyId === 'id') {
    return `${singularizeDatasetId(sourceDatasetId)}Id`
  }

  return sourceKeyId.endsWith('Id')
    ? sourceKeyId
    : undefined
}

export function inferModelRelationships(
  datasets: ModelDatasets,
  explicitRelationships: Record<string, ModelRelationshipDefinition>,
  excludedFieldPairs: ReadonlySet<string>,
): {
  relationships: Record<string, ModelRelationshipDefinition>
  metadata: MutableModelRuntimeMetadata
} {
  const relationships: Record<string, ModelRelationshipDefinition> = {
    ...explicitRelationships,
  }
  const metadata: MutableModelRuntimeMetadata = {
    inferredRelationships: new Map(),
    materializedViews: new Map(),
  }
  const explicitTargetPairs = new Set(
    Object.values(explicitRelationships).map(
      relationship => `${relationship.to.dataset}.${relationship.to.column}`,
    ),
  )
  const candidatesByFieldPair = new Map<string, InferredRelationshipMetadata[]>()

  Object.entries(datasets).forEach(([targetDatasetId]) => {
    Object.entries(datasets).forEach(([sourceDatasetId, sourceDataset]) => {
      if (sourceDatasetId === targetDatasetId) {
        return
      }

      const sourceKeyId = resolveRelationshipSourceKeyId(sourceDataset)
      if (!sourceKeyId) {
        return
      }

      const targetColumnId = buildInferredForeignKeyColumnId(sourceDatasetId, sourceKeyId)
      if (!targetColumnId) {
        return
      }

      const fieldPairId = `${targetDatasetId}.${targetColumnId}`
      if (explicitTargetPairs.has(fieldPairId) || excludedFieldPairs.has(fieldPairId)) {
        return
      }

      const relationshipId = buildRelationshipId(
        targetDatasetId,
        targetColumnId,
        sourceDatasetId,
        sourceKeyId,
      )
      const candidate: InferredRelationshipMetadata = {
        id: relationshipId,
        fromDataset: sourceDatasetId,
        fromKey: sourceKeyId,
        toDataset: targetDatasetId,
        toColumn: targetColumnId,
      }
      const existing = candidatesByFieldPair.get(fieldPairId)
      if (existing) {
        existing.push(candidate)
        return
      }

      candidatesByFieldPair.set(fieldPairId, [candidate])
    })
  })

  candidatesByFieldPair.forEach((candidates) => {
    if (candidates.length !== 1) {
      return
    }

    const candidate = candidates[0]!
    relationships[candidate.id] = {
      kind: 'relationship',
      id: candidate.id,
      from: {
        dataset: candidate.fromDataset,
        key: candidate.fromKey,
      },
      to: {
        dataset: candidate.toDataset,
        column: candidate.toColumn,
      },
      reverse: {
        dataset: candidate.toDataset,
        column: candidate.toColumn,
        to: {
          dataset: candidate.fromDataset,
          key: candidate.fromKey,
        },
      },
    }
    metadata.inferredRelationships.set(candidate.id, candidate)
  })

  return {relationships, metadata}
}

function isVisibleDatasetColumn(
  column: unknown,
): boolean {
  return column !== false
}

function isCategoricalLabelColumn(
  column: unknown,
): boolean {
  if (!column || column === false || typeof column !== 'object') {
    return false
  }

  const typedColumn = column as Record<string, unknown>

  if (typedColumn['kind'] === 'derived') {
    return typedColumn['type'] === 'category' || typedColumn['type'] === 'boolean'
  }

  if ('type' in typedColumn) {
    return typedColumn['type'] === 'category' || typedColumn['type'] === 'boolean'
  }

  return true
}

function selectAttributeLabelColumn(
  _datasetId: string,
  dataset: DefinedDataset<any, any, any>,
  sourceKeyId: string,
): string | undefined {
  const preferredIds = ['name', 'title', 'label']

  for (const preferredId of preferredIds) {
    if (preferredId === sourceKeyId) {
      continue
    }

    const column = dataset.columns?.[preferredId]
    if (column !== undefined && isVisibleDatasetColumn(column) && isCategoricalLabelColumn(column)) {
      return preferredId
    }
  }

  if (dataset.columns) {
    for (const [columnId, column] of Object.entries(dataset.columns)) {
      if (
        columnId !== sourceKeyId
        && !columnId.endsWith('Id')
        && isVisibleDatasetColumn(column)
        && isCategoricalLabelColumn(column)
      ) {
        return columnId
      }
    }
  }

  if (dataset.columns?.[sourceKeyId] !== false) {
    return sourceKeyId
  }

  return dataset.columns
    ? Object.keys(dataset.columns).find(columnId => columnId !== sourceKeyId && dataset.columns?.[columnId] !== false)
    : sourceKeyId
}

export function inferModelAttributes(
  datasets: ModelDatasets,
  relationships: Record<string, ModelRelationshipDefinition>,
  explicitAttributes: Record<string, ModelAttributeDefinition>,
): Record<string, ModelAttributeDefinition> {
  const attributes: Record<string, ModelAttributeDefinition> = {
    ...explicitAttributes,
  }
  const relationshipsByAlias = new Map<
    string,
    RuntimeRelationshipDefinition[]
  >()

  Object.values(relationships).forEach((relationship) => {
    const alias = resolveRelationshipAlias(relationship)
    if (!alias) {
      return
    }

    const existing = relationshipsByAlias.get(alias)
    if (existing) {
      existing.push(relationship)
      return
    }

    relationshipsByAlias.set(alias, [relationship])
  })

  relationshipsByAlias.forEach((matchingRelationships, alias) => {
    if (alias in attributes) {
      return
    }

    const sourceDatasetIds = [...new Set(matchingRelationships.map(relationship => relationship.from.dataset))]
    const sourceKeyIds = [...new Set(matchingRelationships.map(relationship => relationship.from.key))]
    if (sourceDatasetIds.length !== 1 || sourceKeyIds.length !== 1) {
      return
    }

    const sourceDatasetId = sourceDatasetIds[0]!
    const sourceKeyId = sourceKeyIds[0]!
    const sourceDataset = datasets[sourceDatasetId]
    if (!sourceDataset) {
      return
    }

    const labelColumnId = selectAttributeLabelColumn(
      sourceDatasetId,
      sourceDataset,
      sourceKeyId,
    )
    if (!labelColumnId) {
      return
    }

    attributes[alias] = {
      id: alias,
      kind: 'select',
      source: {
        dataset: sourceDatasetId,
        key: sourceKeyId,
        label: labelColumnId,
      },
      targets: matchingRelationships.map(relationship => ({
        dataset: relationship.to.dataset,
        column: relationship.to.column,
        via: relationship.id,
      })),
    }
  })

  return attributes
}

export function rewriteInferredRelationshipError(
  metadata: ModelRuntimeMetadata,
  error: unknown,
): never {
  if (!(error instanceof Error)) {
    throw error
  }

  for (const relationship of metadata.inferredRelationships.values()) {
    if (error.message.startsWith(`Relationship "${relationship.id}"`)) {
      throw new Error(
        `Inferred relationship "${relationship.toDataset}.${relationship.toColumn} -> ${relationship.fromDataset}.${relationship.fromKey}" failed validation: ${error.message.slice(`Relationship "${relationship.id}" `.length)} If this is not a real foreign key, exclude it with: exclude: ['${relationship.toDataset}.${relationship.toColumn}']`,
      )
    }
  }

  throw error
}

export function attachModelRuntimeMetadata<
  TModel extends AnyDefinedDataModel,
>(
  model: TModel,
  metadata: MutableModelRuntimeMetadata,
): void {
  Object.defineProperty(model, MODEL_RUNTIME_METADATA, {
    value: {
      inferredRelationships: new Map(metadata.inferredRelationships),
      materializedViews: new Map(metadata.materializedViews),
    } satisfies ModelRuntimeMetadata,
    enumerable: false,
    configurable: false,
    writable: false,
  })
}

export function getModelRuntimeMetadata(
  model: AnyDefinedDataModel,
): ModelRuntimeMetadata {
  const metadata = (model as Record<PropertyKey, unknown>)[MODEL_RUNTIME_METADATA]
  if (metadata && typeof metadata === 'object') {
    return metadata as ModelRuntimeMetadata
  }

  return {
    inferredRelationships: new Map(),
    materializedViews: new Map(),
  }
}

export function registerModelMaterializedView(
  model: AnyDefinedDataModel,
  id: string,
  view: MaterializedViewDefinition<any, any, any, any>,
): void {
  const metadata = (model as Record<PropertyKey, unknown>)[MODEL_RUNTIME_METADATA]

  if (!metadata || typeof metadata !== 'object') {
    return
  }

  ;(metadata as MutableModelRuntimeMetadata).materializedViews.set(id, view)
}
