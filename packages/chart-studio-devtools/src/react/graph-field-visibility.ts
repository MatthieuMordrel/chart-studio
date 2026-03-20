import type {DatasetFieldVm, NormalizedEdgeVm, NormalizedNodeVm, NormalizedSourceVm} from './types.js'

/** Maximum field rows on a collapsed canvas node (after relationship filtering). */
export const MAX_COLLAPSED_GRAPH_FIELDS = 14

/** Shown on isolated nodes with no graph edges and no key/join metadata. */
const FALLBACK_FIELD_COUNT = 4

/**
 * Extracts the dataset field id from a React Flow handle id (`fieldId::out` / `fieldId::in`).
 */
function fieldIdFromHandle(handleId: string): string {
  if (handleId.endsWith('::out')) {
    return handleId.slice(0, -'::out'.length)
  }

  if (handleId.endsWith('::in')) {
    return handleId.slice(0, -'::in'.length)
  }

  return handleId
}

/**
 * Collects field ids on {@link node} that participate in at least one graph edge.
 */
function collectEdgeEndpointFieldIds(node: NormalizedNodeVm, source: NormalizedSourceVm): Set<string> {
  const ids = new Set<string>()

  for (const edge of source.edges) {
    if (edge.kind === 'materialization') {
      appendMaterializationFields(node, edge, ids)
      continue
    }

    if (edge.sourceNodeId === node.id) {
      ids.add(edge.fromFieldId)
    }

    if (edge.targetNodeId === node.id) {
      ids.add(edge.toFieldId)
    }
  }

  return ids
}

/**
 * Adds materialization edge field ids that belong to {@link node}.
 */
function appendMaterializationFields(
  node: NormalizedNodeVm,
  edge: Extract<NormalizedEdgeVm, {kind: 'materialization'}>,
  ids: Set<string>,
): void {
  if (edge.sourceNodeId === node.id) {
    ids.add(fieldIdFromHandle(edge.sourceHandleId))
  }

  if (edge.targetNodeId === node.id) {
    ids.add(fieldIdFromHandle(edge.targetHandleId))

    for (const projectedId of edge.projectedFieldIds) {
      ids.add(projectedId)
    }
  }
}

/**
 * Attribute-backed columns on this dataset (keys used in the semantic model).
 */
function collectAttributeFieldIds(node: NormalizedNodeVm, source: NormalizedSourceVm): Set<string> {
  const ids = new Set<string>()

  for (const attribute of source.attributes) {
    if (attribute.sourceDatasetId !== node.datasetId) {
      continue
    }

    ids.add(attribute.sourceKeyId)
    ids.add(attribute.labelColumnId)
  }

  return ids
}

/**
 * Whether the field is inherently part of schema / join semantics (not necessarily on an edge).
 */
function isRelationalMetadataField(field: DatasetFieldVm): boolean {
  return field.isPrimaryKey
    || field.isForeignKey
    || field.isAssociationField
    || field.joinProjection != null
    || field.mvBaseDatasetId != null
}

/**
 * Fields to render on a collapsed graph node: edge endpoints, attribute keys, and PK/FK/join/MV
 * metadata, in the same order as {@link NormalizedNodeVm.fields}.
 */
export function getCollapsedVisibleFields(
  node: NormalizedNodeVm,
  source: NormalizedSourceVm,
): readonly DatasetFieldVm[] {
  const edgeIds = collectEdgeEndpointFieldIds(node, source)
  const attributeIds = collectAttributeFieldIds(node, source)
  const picked: DatasetFieldVm[] = []

  for (const field of node.fields) {
    if (edgeIds.has(field.id) || attributeIds.has(field.id) || isRelationalMetadataField(field)) {
      picked.push(field)
    }
  }

  if (picked.length === 0 && node.fields.length > 0) {
    return node.fields.slice(0, Math.min(FALLBACK_FIELD_COUNT, node.fields.length))
  }

  if (picked.length <= MAX_COLLAPSED_GRAPH_FIELDS) {
    return picked
  }

  return picked.slice(0, MAX_COLLAPSED_GRAPH_FIELDS)
}
