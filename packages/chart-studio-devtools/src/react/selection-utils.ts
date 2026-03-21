import type {
  NormalizedEdgeVm,
  NormalizedSourceVm,
} from './types.js'

/**
 * @param nodeId - Dataset / view node id
 * @param fieldId - Column id on that node
 */
function addFieldToHighlightMap(
  byNode: Map<string, Set<string>>,
  nodeId: string,
  fieldId: string,
): void {
  let set = byNode.get(nodeId)

  if (!set) {
    set = new Set()
    byNode.set(nodeId, set)
  }

  set.add(fieldId)
}

/**
 * Field ids on each node that participate in a single graph edge (for row highlighting).
 */
function fieldHighlightsForEdge(edge: NormalizedEdgeVm): ReadonlyMap<string, ReadonlySet<string>> {
  const byNode = new Map<string, Set<string>>()

  if (edge.kind === 'relationship' || edge.kind === 'association') {
    addFieldToHighlightMap(byNode, edge.sourceNodeId, edge.fromFieldId)
    addFieldToHighlightMap(byNode, edge.targetNodeId, edge.toFieldId)
  } else if (edge.kind === 'materialization') {
    const sourceFieldId = edge.sourceHandleId.endsWith('::out')
      ? edge.sourceHandleId.slice(0, -'::out'.length)
      : edge.sourceHandleId

    addFieldToHighlightMap(byNode, edge.sourceNodeId, sourceFieldId)

    if (edge.projectedFieldIds.length > 0) {
      for (const fieldId of edge.projectedFieldIds) {
        addFieldToHighlightMap(byNode, edge.targetNodeId, fieldId)
      }
    } else {
      const targetFieldId = edge.targetHandleId.endsWith('::in')
        ? edge.targetHandleId.slice(0, -'::in'.length)
        : edge.targetHandleId

      addFieldToHighlightMap(byNode, edge.targetNodeId, targetFieldId)
    }
  }

  return new Map([...byNode.entries()].map(([id, set]) => [id, set]))
}

function mergeFieldHighlightMaps(
  maps: ReadonlyArray<ReadonlyMap<string, ReadonlySet<string>>>,
): ReadonlyMap<string, ReadonlySet<string>> {
  const merged = new Map<string, Set<string>>()

  for (const map of maps) {
    for (const [nodeId, fieldIds] of map) {
      let set = merged.get(nodeId)

      if (!set) {
        set = new Set()
        merged.set(nodeId, set)
      }

      for (const fieldId of fieldIds) {
        set.add(fieldId)
      }
    }
  }

  return new Map([...merged.entries()].map(([id, set]) => [id, set]))
}

/**
 * Returns whether the given column participates in this edge on the graph.
 */
function edgeTouchesField(edge: NormalizedEdgeVm, nodeId: string, fieldId: string): boolean {
  if (edge.kind === 'relationship' || edge.kind === 'association') {
    return (
      (edge.sourceNodeId === nodeId && edge.fromFieldId === fieldId)
      || (edge.targetNodeId === nodeId && edge.toFieldId === fieldId)
    )
  }

  if (edge.kind === 'materialization') {
    const sourceFieldId = edge.sourceHandleId.endsWith('::out')
      ? edge.sourceHandleId.slice(0, -'::out'.length)
      : edge.sourceHandleId

    if (edge.sourceNodeId === nodeId && sourceFieldId === fieldId) {
      return true
    }

    if (edge.targetNodeId !== nodeId) {
      return false
    }

    if (edge.projectedFieldIds.length > 0) {
      return edge.projectedFieldIds.includes(fieldId)
    }

    const targetFieldId = edge.targetHandleId.endsWith('::in')
      ? edge.targetHandleId.slice(0, -'::in'.length)
      : edge.targetHandleId

    return targetFieldId === fieldId
  }

  return false
}

/**
 * Graph edges that connect through the given column on {@link nodeId}.
 */
export function findEdgesForField(
  nodeId: string,
  fieldId: string,
  source: NormalizedSourceVm,
): readonly NormalizedEdgeVm[] {
  return source.edges.filter((edge) => edgeTouchesField(edge, nodeId, fieldId))
}

/**
 * All graph edges that connect to this dataset / view node.
 */
function findEdgesForNode(nodeId: string, source: NormalizedSourceVm): readonly NormalizedEdgeVm[] {
  return source.edges.filter((edge) =>
    edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
  )
}

/**
 * Maps each endpoint node id to field ids to pulse-highlight on the canvas:
 * selected edge, every edge for a selected column, or every edge for a selected node (whole table).
 */
export function computeEdgeFieldHighlights(
  selectedEdgeId: string | null,
  selectedNodeId: string | null,
  selectedFieldId: string | null,
  source: NormalizedSourceVm,
): ReadonlyMap<string, ReadonlySet<string>> {
  if (selectedEdgeId) {
    const edge = source.edgeMap.get(selectedEdgeId)

    if (!edge) {
      return new Map()
    }

    return fieldHighlightsForEdge(edge)
  }

  if (selectedNodeId && selectedFieldId) {
    const edges = findEdgesForField(selectedNodeId, selectedFieldId, source)

    if (edges.length === 0) {
      return new Map()
    }

    return mergeFieldHighlightMaps(edges.map((edge) => fieldHighlightsForEdge(edge)))
  }

  if (selectedNodeId) {
    const connectedEdges = findEdgesForNode(selectedNodeId, source)

    if (connectedEdges.length === 0) {
      return new Map()
    }

    return mergeFieldHighlightMaps(connectedEdges.map((edge) => fieldHighlightsForEdge(edge)))
  }

  return new Map()
}

/**
 * Ids used to compute graph focus highlights (dimming, edge/field pulses) on the devtools canvas.
 */
export type CanvasFocusIds = {
  edgeId: string | null
  nodeId: string | null
  fieldId: string | null
}

/**
 * Picks which node/edge/field drives canvas highlights: hover preview wins over click selection
 * so relationships and keys light up on pointer-over without changing the selection panel.
 *
 * @param hover - Transient hover state from the graph (edge or field row)
 * @param selection - Pinned selection from clicks / search / issues
 * @param source - Normalized snapshot (validates ids)
 */
export function resolveCanvasFocusFromHoverAndSelection(
  hover: CanvasFocusIds,
  selection: CanvasFocusIds,
  source: NormalizedSourceVm | null,
): CanvasFocusIds {
  if (hover.edgeId && source?.edgeMap.has(hover.edgeId)) {
    return {edgeId: hover.edgeId, nodeId: null, fieldId: null}
  }

  if (hover.nodeId && hover.fieldId) {
    const node = source?.nodeMap.get(hover.nodeId)

    if (node?.fields.some((field) => field.id === hover.fieldId)) {
      return {edgeId: null, nodeId: hover.nodeId, fieldId: hover.fieldId}
    }
  }

  return {
    edgeId: selection.edgeId,
    nodeId: selection.nodeId,
    fieldId: selection.fieldId,
  }
}

export function findFocusSets(
  source: NormalizedSourceVm,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedFieldId: string | null,
): {
  focusedEdgeIds: ReadonlySet<string>
  focusedNodeIds: ReadonlySet<string>
} {
  if (selectedEdgeId) {
    const edge = source.edgeMap.get(selectedEdgeId)
    if (!edge) {
      return {focusedEdgeIds: new Set(), focusedNodeIds: new Set()}
    }

    return {
      focusedEdgeIds: new Set([edge.id]),
      focusedNodeIds: new Set([edge.sourceNodeId, edge.targetNodeId]),
    }
  }

  if (selectedNodeId) {
    if (selectedFieldId) {
      const edges = findEdgesForField(selectedNodeId, selectedFieldId, source)

      if (edges.length === 0) {
        return {
          focusedEdgeIds: new Set(),
          focusedNodeIds: new Set([selectedNodeId]),
        }
      }

      const nodeIds = new Set<string>()

      for (const edge of edges) {
        nodeIds.add(edge.sourceNodeId)
        nodeIds.add(edge.targetNodeId)
      }

      return {
        focusedEdgeIds: new Set(edges.map((edge) => edge.id)),
        focusedNodeIds: nodeIds,
      }
    }

    const connectedEdges = findEdgesForNode(selectedNodeId, source)

    return {
      focusedEdgeIds: new Set(connectedEdges.map((edge) => edge.id)),
      focusedNodeIds: new Set([
        selectedNodeId,
        ...connectedEdges.map((edge) => edge.sourceNodeId),
        ...connectedEdges.map((edge) => edge.targetNodeId),
      ]),
    }
  }

  return {
    focusedEdgeIds: new Set(),
    focusedNodeIds: new Set(),
  }
}

/**
 * One-line description of an edge for the column inspector list.
 */
export function describeEdgeSummary(edge: NormalizedEdgeVm): string {
  if (edge.kind === 'relationship') {
    return `${edge.fromDatasetId}.${edge.fromFieldId} → ${edge.toDatasetId}.${edge.toFieldId}`
  }

  if (edge.kind === 'association') {
    return `${edge.fromDatasetId}.${edge.fromFieldId} ↔ ${edge.toDatasetId}.${edge.toFieldId}`
  }

  return `${edge.label} · ${edge.materializationKind}`
}
