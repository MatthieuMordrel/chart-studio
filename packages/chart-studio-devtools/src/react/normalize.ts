import {
  inferColumnsFromData,
  type ChartColumn,
} from '@matthieumordrel/chart-studio'
import {
  getModelRuntimeMetadata,
  getRegisteredMaterializedViews,
  type ChartStudioDevtoolsContextSnapshot,
  type ChartStudioDevtoolsIssue,
} from '@matthieumordrel/chart-studio/_internal'
import type {
  AnyMaterializedView,
  AnyDatasetDefinition,
  ChartStudioDevtoolsSource,
  DevtoolsAssociation,
  DevtoolsAttribute,
  DevtoolsRelationship,
  DatasetFieldJoinProjection,
  DatasetFieldVm,
  DevtoolsRow,
  MaterializationEdgeVm,
  NormalizedEdgeVm,
  NormalizedNodeVm,
  NormalizedSourceVm,
  SearchItemVm,
} from './types.js'

function humanizeId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function estimatePayloadBytes(rows: readonly DevtoolsRow[]): number {
  try {
    return new Blob([JSON.stringify(rows)]).size
  } catch {
    return JSON.stringify(rows).length
  }
}

function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`
}

function createHandleIds(fieldId: string): {
  sourceHandleId: string
  targetHandleId: string
} {
  return {
    sourceHandleId: `${fieldId}::out`,
    targetHandleId: `${fieldId}::in`,
  }
}

function getFormatHint(column: ChartColumn<any, string>): string | null {
  const hints: string[] = []

  if (column.format) {
    hints.push(typeof column.format === 'string'
      ? column.format
      : column.format.kind)
  }
  if (column.formatter) {
    hints.push('custom formatter')
  }

  return hints.length > 0 ? hints.join(' · ') : null
}

function getInferenceHint(column: ChartColumn<any, string>): string | null {
  if (!column.inference) {
    return null
  }

  return `${column.inference.detectedType} · ${column.inference.confidence}`
}

/**
 * Ranks columns for listing: PK, FK-only, joined (MV), association keys, then the rest.
 */
function fieldOrderingRank(
  columnId: string,
  keySet: Set<string>,
  foreignKeySet: Set<string>,
  associationFieldSet: Set<string>,
  joinedFieldSet: ReadonlySet<string>,
): number {
  if (keySet.has(columnId)) {
    return 0
  }

  if (foreignKeySet.has(columnId)) {
    return 1
  }

  if (joinedFieldSet.has(columnId)) {
    return 2
  }

  if (associationFieldSet.has(columnId)) {
    return 3
  }

  return 4
}

function buildFieldOrder(
  datasetId: string,
  definition: {key?: readonly string[]; columns?: Record<string, unknown>},
  columns: readonly ChartColumn<any, string>[],
  model: ChartStudioDevtoolsSource['snapshot']['model'],
  joinedFieldIds: ReadonlySet<string>,
): readonly ChartColumn<any, string>[] {
  const keySet = new Set(definition.key ?? [])
  const foreignKeySet = new Set(
    Object.values(model.relationships)
      .filter(relationship => relationship.to.dataset === datasetId)
      .map(relationship => relationship.to.column),
  )
  const associationFieldSet = new Set(
    Object.values(model.associations).flatMap((association) => {
      if (association.from.dataset === datasetId) {
        return [association.from.key]
      }
      if (association.to.dataset === datasetId) {
        return [association.to.key]
      }
      return []
    }),
  )
  const declaredOrder = new Map(
    Object.keys(definition.columns ?? {}).map((columnId, index) => [columnId, index] as const),
  )
  const originalOrder = new Map(
    columns.map((column, index) => [column.id, index] as const),
  )

  return [...columns].sort((left, right) => {
    const rankDiff =
      fieldOrderingRank(left.id, keySet, foreignKeySet, associationFieldSet, joinedFieldIds)
      - fieldOrderingRank(right.id, keySet, foreignKeySet, associationFieldSet, joinedFieldIds)

    if (rankDiff !== 0) {
      return rankDiff
    }

    const leftDeclared = declaredOrder.get(left.id)
    const rightDeclared = declaredOrder.get(right.id)
    if (leftDeclared != null || rightDeclared != null) {
      return (leftDeclared ?? Number.MAX_SAFE_INTEGER) - (rightDeclared ?? Number.MAX_SAFE_INTEGER)
    }

    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0)
  })
}

/**
 * Maps output column ids to join metadata for a built materialized view.
 */
function buildJoinProjectionByFieldId(view: AnyMaterializedView): ReadonlyMap<string, DatasetFieldJoinProjection> {
  const meta = view.materialization
  const map = new Map<string, DatasetFieldJoinProjection>()

  if (!meta?.steps) {
    return map
  }

  for (const step of meta.steps) {
    const via = step.kind === 'through-association' ? step.association : step.relationship

    for (const columnId of step.projectedColumns) {
      const fieldId = buildProjectedId(step.alias, columnId)
      map.set(fieldId, {
        targetDataset: step.targetDataset,
        via,
        alias: step.alias,
        stepKind: step.kind,
      })
    }
  }

  return map
}

function normalizeFields(
  datasetId: string,
  definition: {key?: readonly string[]; columns?: Record<string, unknown>},
  rows: readonly DevtoolsRow[],
  model: ChartStudioDevtoolsSource['snapshot']['model'],
  joinProjectionByFieldId: ReadonlyMap<string, DatasetFieldJoinProjection> | null,
): readonly DatasetFieldVm[] {
  const joinedFieldIds = new Set(joinProjectionByFieldId?.keys() ?? [])
  const resolvedColumns = buildFieldOrder(
    datasetId,
    definition,
    inferColumnsFromData(rows, definition.columns ? {columns: definition.columns} : undefined),
    model,
    joinedFieldIds,
  )
  const keySet = new Set(definition.key ?? [])
  const foreignKeySet = new Set(
    Object.values(model.relationships)
      .filter(relationship => relationship.to.dataset === datasetId)
      .map(relationship => relationship.to.column),
  )
  const associationFieldSet = new Set(
    Object.values(model.associations).flatMap((association) => {
      if (association.from.dataset === datasetId) {
        return [association.from.key]
      }
      if (association.to.dataset === datasetId) {
        return [association.to.key]
      }
      return []
    }),
  )

  return resolvedColumns.map((column) => {
    const rawColumn = definition.columns?.[column.id]
    const isDerived = !!rawColumn
      && typeof rawColumn === 'object'
      && 'kind' in rawColumn
      && rawColumn.kind === 'derived'

    let derivedSummary: string | null = null

    if (isDerived && rawColumn && typeof rawColumn === 'object' && 'type' in rawColumn) {
      const derivedType = (rawColumn as {type?: string}).type
      derivedSummary = derivedType
        ? `Per-row accessor · ${derivedType}`
        : 'Per-row accessor'
    }

    return {
      id: column.id,
      label: column.label,
      type: column.type,
      formatHint: getFormatHint(column),
      inferenceHint: getInferenceHint(column),
      derivedSummary,
      isPrimaryKey: keySet.has(column.id),
      isForeignKey: foreignKeySet.has(column.id),
      isAssociationField: associationFieldSet.has(column.id),
      isDerived,
      joinProjection: joinProjectionByFieldId?.get(column.id) ?? null,
      trueLabel: column.type === 'boolean' ? column.trueLabel : undefined,
      falseLabel: column.type === 'boolean' ? column.falseLabel : undefined,
      ...createHandleIds(column.id),
    }
  })
}

function generateIssues(
  source: ChartStudioDevtoolsSource,
): readonly ChartStudioDevtoolsIssue[] {
  const inferredRelationships = getModelRuntimeMetadata(source.snapshot.model as any).inferredRelationships
  const generated = [...inferredRelationships.values()].map((relationship) => ({
    id: `inferred:${relationship.id}`,
    severity: 'warning' as const,
    scope: 'relationship' as const,
    targetId: relationship.id,
    message: `Relationship "${relationship.id}" is inferred from foreign-key naming.`,
  }))

  return [...(source.snapshot.issues ?? []), ...generated]
}

function normalizeContexts(
  source: ChartStudioDevtoolsSource,
  materializedViews: Record<string, AnyMaterializedView>,
): readonly ChartStudioDevtoolsContextSnapshot[] {
  const contexts = source.snapshot.contexts ?? []

  return contexts.map((context) => {
    if (context.effectiveMaterializedViews || !context.effectiveDatasets) {
      return context
    }

    return {
      ...context,
      effectiveMaterializedViews: Object.fromEntries(
        Object.entries(materializedViews).map(([viewId, view]) => [
          viewId,
          view.materialize(context.effectiveDatasets as any) as readonly DevtoolsRow[],
        ]),
      ),
    }
  })
}

function buildAssociationPreview(
  association: DevtoolsAssociation,
  data: Record<string, readonly DevtoolsRow[]>,
): {
  previewPairs: readonly {from: string; to: string; raw?: Record<string, unknown>}[]
  edgeRows?: readonly Record<string, unknown>[]
} {
  const edge = association.edge

  if (edge.kind === 'explicit') {
    return {
      previewPairs: edge.data.slice(0, 12).map((row) => ({
        from: String(row[edge.columns.from]),
        to: String(row[edge.columns.to]),
        raw: row,
      })),
      edgeRows: edge.data,
    }
  }

  const deriveDatasetId = edge.deriveFrom.dataset
  const deriveRows = data[deriveDatasetId] ?? []
  const deriveKeyId = deriveDatasetId === association.from.dataset
    ? association.from.key
    : association.to.key
  const previewPairs = deriveRows.flatMap((row: DevtoolsRow) => {
    const values = edge.deriveFrom.values(row) ?? []
    const sourceValue = row[deriveKeyId]

    if (sourceValue == null) {
      return []
    }

    return values.map((value: unknown) => deriveDatasetId === association.from.dataset
      ? {
          from: String(sourceValue),
          to: String(value),
        }
      : {
          from: String(value),
          to: String(sourceValue),
        })
  }).slice(0, 12)

  return {
    previewPairs,
  }
}

function createMaterializationEdge(
  viewId: string,
  view: AnyMaterializedView,
  sourceNodeId: string,
  sourceFieldId: string,
  targetFieldId: string,
  label: string,
  materializationKind: MaterializationEdgeVm['materializationKind'],
  projectedFieldIds: readonly string[],
): MaterializationEdgeVm {
  return {
    id: `${viewId}:${materializationKind}:${sourceNodeId}:${targetFieldId}`,
    kind: 'materialization',
    label,
    sourceNodeId,
    targetNodeId: viewId,
    sourceHandleId: createHandleIds(sourceFieldId).sourceHandleId,
    targetHandleId: createHandleIds(targetFieldId).targetHandleId,
    viewId: view.materialization.id,
    projectedFieldIds,
    materializationKind,
  }
}

function resolveFirstFieldId(
  fields: readonly DatasetFieldVm[],
  fallback: string,
): string {
  return fields[0]?.id ?? fallback
}

function normalizeSearchItems(
  nodes: readonly NormalizedNodeVm[],
  edges: readonly NormalizedEdgeVm[],
  attributes: NormalizedSourceVm['attributes'],
): readonly SearchItemVm[] {
  const items: SearchItemVm[] = []

  nodes.forEach((node) => {
    items.push({
      id: node.id,
      kind: node.kind,
      label: node.label,
      description: `${node.kind} · ${node.fields.length} columns`,
      nodeId: node.id,
    })

    node.fields.forEach((field) => {
      items.push({
        id: `${node.id}:${field.id}`,
        kind: 'column',
        label: `${node.label} · ${field.label}`,
        description: field.type,
        nodeId: node.id,
        fieldId: field.id,
      })
    })
  })

  edges.forEach((edge) => {
    items.push({
      id: edge.id,
      kind: edge.kind === 'materialization' ? 'relationship' : edge.kind,
      label: edge.label,
      description: edge.kind,
      edgeId: edge.id,
      nodeId: edge.sourceNodeId,
    })
  })

  attributes.forEach((attribute) => {
    items.push({
      id: attribute.id,
      kind: 'attribute',
      label: humanizeId(attribute.id),
      description: `${humanizeId(attribute.sourceDatasetId)} · ${attribute.labelColumnId}`,
      nodeId: attribute.sourceDatasetId,
    })
  })

  return items
}

export function normalizeSource(
  source: ChartStudioDevtoolsSource,
): NormalizedSourceVm {
  const materializedViews = source.snapshot.materializedViews ?? getRegisteredMaterializedViews(source.snapshot.model as any)
  const contexts = normalizeContexts(source, materializedViews)
  const issues = generateIssues(source)
  const nodes: NormalizedNodeVm[] = []
  const attributes = (Object.values(source.snapshot.model.attributes) as DevtoolsAttribute[]).map((attribute) => ({
    id: attribute.id,
    sourceDatasetId: attribute.source.dataset,
    sourceKeyId: attribute.source.key,
    labelColumnId: attribute.source.label,
    targetDatasetIds: attribute.targets.map((target) => target.dataset),
    relationshipTargetIds: attribute.targets
      .filter((target) => 'via' in target)
      .map((target) => target.via),
    associationTargetIds: attribute.targets
      .filter((target) => 'through' in target)
      .map((target) => target.through),
  }))

  Object.entries(source.snapshot.model.datasets).forEach(([datasetId, dataset]) => {
    const rawRows = source.snapshot.data[datasetId] ?? []
    const fields = normalizeFields(datasetId, dataset as AnyDatasetDefinition, rawRows, source.snapshot.model, null)

    nodes.push({
      id: datasetId,
      kind: 'dataset',
      label: humanizeId(datasetId),
      datasetId,
      rowCount: rawRows.length,
      estimatedBytes: estimatePayloadBytes(rawRows),
      attributeIds: attributes
        .filter((attribute) => attribute.sourceDatasetId === datasetId || attribute.targetDatasetIds.includes(datasetId))
        .map((attribute) => attribute.id),
      rawRows,
      fields,
      definition: dataset,
    })
  })

  Object.entries(materializedViews).forEach(([viewId, view]) => {
    const rawRows = view.materialize(source.snapshot.data as any) as readonly DevtoolsRow[]
    const joinMap = buildJoinProjectionByFieldId(view)
    const fields = normalizeFields(viewId, view, rawRows, source.snapshot.model, joinMap)

    nodes.push({
      id: viewId,
      kind: 'materialized-view',
      label: humanizeId(viewId),
      datasetId: viewId,
      rowCount: rawRows.length,
      estimatedBytes: estimatePayloadBytes(rawRows),
      attributeIds: [],
      rawRows,
      fields,
      definition: view,
    })
  })

  const nodeMap = new Map(nodes.map((node) => [node.id, node] as const))
  const edges: NormalizedEdgeVm[] = []
  const inferredRelationshipIds = new Set(getModelRuntimeMetadata(source.snapshot.model as any).inferredRelationships.keys())

  ;(Object.values(source.snapshot.model.relationships) as DevtoolsRelationship[]).forEach((relationship) => {
    const sourceNode = nodeMap.get(relationship.from.dataset)
    const targetNode = nodeMap.get(relationship.to.dataset)

    if (!sourceNode || !targetNode) {
      return
    }

    edges.push({
      id: relationship.id,
      kind: 'relationship',
      label: relationship.id,
      sourceNodeId: relationship.from.dataset,
      targetNodeId: relationship.to.dataset,
      sourceHandleId: createHandleIds(relationship.from.key).sourceHandleId,
      targetHandleId: createHandleIds(relationship.to.column).targetHandleId,
      inferred: inferredRelationshipIds.has(relationship.id),
      fromDatasetId: relationship.from.dataset,
      toDatasetId: relationship.to.dataset,
      fromFieldId: relationship.from.key,
      toFieldId: relationship.to.column,
    })
  })

  ;(Object.values(source.snapshot.model.associations) as DevtoolsAssociation[]).forEach((association) => {
    const preview = buildAssociationPreview(association, source.snapshot.data)

    edges.push({
      id: association.id,
      kind: 'association',
      label: association.id,
      sourceNodeId: association.from.dataset,
      targetNodeId: association.to.dataset,
      sourceHandleId: createHandleIds(association.from.key).sourceHandleId,
      targetHandleId: createHandleIds(association.to.key).targetHandleId,
      fromDatasetId: association.from.dataset,
      toDatasetId: association.to.dataset,
      fromFieldId: association.from.key,
      toFieldId: association.to.key,
      backing: association.edge.kind,
      derivedFromDatasetId: association.edge.kind === 'derived'
        ? association.edge.deriveFrom.dataset
        : undefined,
      previewPairs: preview.previewPairs,
      edgeRows: preview.edgeRows,
    })
  })

  Object.entries(materializedViews).forEach(([viewId, view]) => {
    const viewNode = nodeMap.get(viewId)

    if (!viewNode) {
      return
    }

    const baseNode = nodeMap.get(view.materialization.baseDataset)
    if (baseNode) {
      const sourceFieldId = resolveFirstFieldId(baseNode.fields, view.materialization.baseDataset)
      const targetFieldId = resolveFirstFieldId(viewNode.fields, view.materialization.baseDataset)

      edges.push(
        createMaterializationEdge(
          viewId,
          view,
          baseNode.id,
          sourceFieldId,
          targetFieldId,
          `${humanizeId(view.materialization.baseDataset)} lineage`,
          'base',
          [targetFieldId],
        ),
      )
    }

    view.materialization.steps.forEach((step) => {
      const sourceNode = nodeMap.get(step.targetDataset)
      if (!sourceNode) {
        return
      }

      const projectedFieldIds = step.projectedColumns.map((columnId) => buildProjectedId(step.alias, columnId))
      const sourceFieldId = resolveFirstFieldId(
        sourceNode.fields.filter((field) => step.projectedColumns.includes(field.id)),
        step.projectedColumns[0] ?? resolveFirstFieldId(sourceNode.fields, step.targetDataset),
      )
      const targetFieldId = resolveFirstFieldId(
        viewNode.fields.filter((field) => projectedFieldIds.includes(field.id)),
        projectedFieldIds[0] ?? resolveFirstFieldId(viewNode.fields, viewId),
      )

      edges.push(
        createMaterializationEdge(
          viewId,
          view,
          sourceNode.id,
          sourceFieldId,
          targetFieldId,
          `${humanizeId(step.alias)} projection`,
          step.kind,
          projectedFieldIds,
        ),
      )
    })
  })

  const edgeMap = new Map(edges.map((edge) => [edge.id, edge] as const))
  const attributeMap = new Map(attributes.map((attribute) => [attribute.id, attribute] as const))
  const normalized: NormalizedSourceVm = {
    id: source.id,
    label: source.label,
    snapshot: {
      ...source.snapshot,
      materializedViews,
      contexts,
      issues,
    },
    nodes,
    edges,
    attributes,
    contexts,
    issues,
    searchItems: [],
    nodeMap,
    edgeMap,
    attributeMap,
  }

  return {
    ...normalized,
    searchItems: normalizeSearchItems(nodes, edges, attributes),
  }
}
