import {estimateNodeHeight} from './layout.js'
import type {
  DatasetFieldVm,
  NormalizedEdgeVm,
  NormalizedNodeVm,
  NormalizedSourceVm,
} from './types.js'

const MIN_FIELD_REORDER_DELTA = 18

function fieldIdFromHandle(handleId: string): string {
  if (handleId.endsWith('::out')) {
    return handleId.slice(0, -'::out'.length)
  }

  if (handleId.endsWith('::in')) {
    return handleId.slice(0, -'::in'.length)
  }

  return handleId
}

function isGraphOrderingCandidate(field: DatasetFieldVm): boolean {
  return field.isPrimaryKey
    || field.isForeignKey
    || field.isAssociationField
    || field.joinProjection != null
    || field.mvBaseDatasetId != null
}

function appendFieldScore(
  byNodeId: Map<string, Map<string, number[]>>,
  nodeId: string,
  fieldId: string,
  score: number,
): void {
  const byFieldId = byNodeId.get(nodeId) ?? new Map<string, number[]>()
  const scores = byFieldId.get(fieldId) ?? []

  scores.push(score)
  byFieldId.set(fieldId, scores)
  byNodeId.set(nodeId, byFieldId)
}

function appendEdgeScores(
  edge: NormalizedEdgeVm,
  byNodeId: Map<string, Map<string, number[]>>,
  nodeCenterYById: ReadonlyMap<string, number>,
): void {
  const sourceCenterY = nodeCenterYById.get(edge.sourceNodeId) ?? 0
  const targetCenterY = nodeCenterYById.get(edge.targetNodeId) ?? 0
  const sourceFieldId = edge.kind === 'materialization'
    ? fieldIdFromHandle(edge.sourceHandleId)
    : edge.fromFieldId
  const targetFieldId = edge.kind === 'materialization'
    ? fieldIdFromHandle(edge.targetHandleId)
    : edge.toFieldId

  appendFieldScore(byNodeId, edge.sourceNodeId, sourceFieldId, targetCenterY)
  appendFieldScore(byNodeId, edge.targetNodeId, targetFieldId, sourceCenterY)
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeNodeCenterYById(
  source: NormalizedSourceVm,
  positions: Readonly<Record<string, {x: number; y: number}>>,
  expandedNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  return new Map(
    source.nodes.map((node) => [
      node.id,
      (positions[node.id]?.y ?? 0) + (estimateNodeHeight(source, node.id, expandedNodeIds) / 2),
    ] as const),
  )
}

function orderNodeFields(
  node: NormalizedNodeVm,
  fieldScores: ReadonlyMap<string, readonly number[]>,
): readonly string[] {
  let reorderablePrefixLength = 0

  while (
    reorderablePrefixLength < node.fields.length
    && isGraphOrderingCandidate(node.fields[reorderablePrefixLength]!)
  ) {
    reorderablePrefixLength += 1
  }

  if (reorderablePrefixLength < 2) {
    return node.fields.map((field) => field.id)
  }

  const originalIndexByFieldId = new Map(
    node.fields.map((field, index) => [field.id, index] as const),
  )
  const prefix = node.fields.slice(0, reorderablePrefixLength)
  const suffix = node.fields.slice(reorderablePrefixLength)
  const sortedPrefix = [...prefix].sort((left, right) => {
    const leftScores = fieldScores.get(left.id)
    const rightScores = fieldScores.get(right.id)
    const leftConnected = leftScores && leftScores.length > 0
    const rightConnected = rightScores && rightScores.length > 0

    if (leftConnected !== rightConnected) {
      return leftConnected ? -1 : 1
    }

    if (leftConnected && rightConnected) {
      const leftAverage = average(leftScores)
      const rightAverage = average(rightScores)
      const delta = leftAverage - rightAverage

      if (Math.abs(delta) >= MIN_FIELD_REORDER_DELTA) {
        return delta
      }
    }

    return (originalIndexByFieldId.get(left.id) ?? 0) - (originalIndexByFieldId.get(right.id) ?? 0)
  })

  return [...sortedPrefix, ...suffix].map((field) => field.id)
}

export function computeCanvasFieldOrderByNodeId(
  source: NormalizedSourceVm,
  positions: Readonly<Record<string, {x: number; y: number}>>,
  expandedNodeIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  const nodeCenterYById = computeNodeCenterYById(source, positions, expandedNodeIds)
  const fieldScoresByNodeId = new Map<string, Map<string, number[]>>()

  for (const edge of source.edges) {
    appendEdgeScores(edge, fieldScoresByNodeId, nodeCenterYById)
  }

  return new Map(
    source.nodes.map((node) => [
      node.id,
      orderNodeFields(node, fieldScoresByNodeId.get(node.id) ?? new Map()),
    ] as const),
  )
}
