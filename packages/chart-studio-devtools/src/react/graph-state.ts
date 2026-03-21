import type {
  Edge,
  Node,
  NodeChange,
} from '@xyflow/react'
import {DEVTOOLS_NODE_WIDTH} from './layout.js'
import type {NormalizedSourceVm} from './types.js'

export type FlowNode = Node<{nodeId: string}, 'semantic-node'>
export type FlowEdge = Edge<
  {edgeId: string; parallelIndex: number; parallelCount: number},
  'semantic-edge'
>

export type FlowNodePosition = {
  x: number
  y: number
}

type HandleSide = 'left' | 'right'

/**
 * Avoid side flips when nodes are nearly vertically stacked and differ by only a few pixels.
 */
const SIDE_AWARE_HANDLE_X_THRESHOLD = 24

export function toFlowHandleId(
  handleId: string,
  side: HandleSide,
): string {
  return `${handleId}::${side}`
}

function hasSamePosition(
  left: FlowNodePosition | undefined,
  right: FlowNodePosition | undefined,
): boolean {
  if (!left || !right) {
    return left === right
  }

  return left.x === right.x && left.y === right.y
}

export function buildFlowNodes(
  source: NormalizedSourceVm,
  positions: Readonly<Record<string, FlowNodePosition>>,
  selectedNodeId: string | null,
  previousNodes: readonly FlowNode[] = [],
): FlowNode[] {
  const previousNodesById = new Map(previousNodes.map((node) => [node.id, node]))
  let changed = previousNodes.length !== source.nodes.length

  const nextNodes = source.nodes.map((node, index) => {
    const position = positions[node.id] ?? {x: 0, y: 0}
    const selected = node.id === selectedNodeId
    const previousNode = previousNodesById.get(node.id)

    if (
      previousNode
      && previousNode.type === 'semantic-node'
      && previousNode.position.x === position.x
      && previousNode.position.y === position.y
      && previousNode.draggable
      && previousNode.selectable
      && previousNode.selected === selected
      && previousNode.data.nodeId === node.id
      && previousNode.width === DEVTOOLS_NODE_WIDTH
    ) {
      if (previousNodes[index] !== previousNode) {
        changed = true
      }

      return previousNode
    }

    changed = true

    return {
      id: node.id,
      type: 'semantic-node' as const,
      position,
      draggable: true,
      selectable: true,
      selected,
      data: {nodeId: node.id},
      width: DEVTOOLS_NODE_WIDTH,
    }
  })

  return changed ? nextNodes : (previousNodes as FlowNode[])
}

export function extractFlowNodePositions(
  nodes: readonly FlowNode[],
): Record<string, FlowNodePosition> {
  return nodes.reduce<Record<string, FlowNodePosition>>((positions, node) => {
    positions[node.id] = {
      x: node.position.x,
      y: node.position.y,
    }

    return positions
  }, {})
}

/**
 * Reconciles externally-derived flow nodes into local canvas state.
 *
 * React Flow performs best when drag updates stay local. This merge keeps any in-flight local
 * position changes unless the external positions actually changed (for example after relayout or
 * when a drag result is committed).
 */
export function syncFlowNodesWithExternalState(
  currentNodes: readonly FlowNode[],
  externalNodes: readonly FlowNode[],
  previousExternalPositions: Readonly<Record<string, FlowNodePosition>>,
): FlowNode[] {
  const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]))
  let changed = currentNodes.length !== externalNodes.length

  const nextNodes = externalNodes.map((externalNode, index) => {
    const currentNode = currentNodesById.get(externalNode.id)

    if (!currentNode) {
      changed = true
      return externalNode
    }

    const externalPositionChanged = !hasSamePosition(
      previousExternalPositions[externalNode.id],
      externalNode.position,
    )
    const position = externalPositionChanged ? externalNode.position : currentNode.position

    if (
      currentNode.type === externalNode.type
      && currentNode.position.x === position.x
      && currentNode.position.y === position.y
      && currentNode.draggable === externalNode.draggable
      && currentNode.selectable === externalNode.selectable
      && currentNode.selected === externalNode.selected
      && currentNode.data.nodeId === externalNode.data.nodeId
      && currentNode.width === externalNode.width
    ) {
      if (currentNodes[index] !== currentNode) {
        changed = true
      }

      return currentNode
    }

    changed = true

    return {
      ...currentNode,
      ...externalNode,
      position,
    }
  })

  return changed ? nextNodes : (currentNodes as FlowNode[])
}

/**
 * For each directed pair of nodes, assigns a stable index so parallel relationship
 * lines can use different smooth-step offsets and `stepPosition` (less overlap).
 *
 * @param source - Normalized graph snapshot
 * @returns Map from edge id to its index within the (source → target) bundle and bundle size
 */
function computeParallelEdgeMeta(
  source: NormalizedSourceVm,
): Map<string, {parallelIndex: number; parallelCount: number}> {
  const byPair = new Map<string, string[]>()

  for (const edge of source.edges) {
    const key = `${edge.sourceNodeId}\0${edge.targetNodeId}`
    const list = byPair.get(key) ?? []
    list.push(edge.id)
    byPair.set(key, list)
  }

  const meta = new Map<string, {parallelIndex: number; parallelCount: number}>()

  for (const ids of byPair.values()) {
    const sorted = [...ids].sort((a, b) => a.localeCompare(b))
    const count = sorted.length

    sorted.forEach((id, parallelIndex) => {
      meta.set(id, {parallelIndex, parallelCount: count})
    })
  }

  return meta
}

function resolveEdgeHandleSides(
  edge: NormalizedSourceVm['edges'][number],
  positions: Readonly<Record<string, FlowNodePosition>>,
): {sourceSide: HandleSide; targetSide: HandleSide} {
  const sourcePosition = positions[edge.sourceNodeId]
  const targetPosition = positions[edge.targetNodeId]

  if (!sourcePosition || !targetPosition) {
    return {
      sourceSide: 'right',
      targetSide: 'left',
    }
  }

  const deltaX = targetPosition.x - sourcePosition.x

  if (deltaX < -SIDE_AWARE_HANDLE_X_THRESHOLD) {
    return {
      sourceSide: 'left',
      targetSide: 'right',
    }
  }

  return {
    sourceSide: 'right',
    targetSide: 'left',
  }
}

export function buildFlowEdges(
  source: NormalizedSourceVm,
  selectedEdgeId: string | null,
  positions: Readonly<Record<string, FlowNodePosition>> = {},
  previousEdges: readonly FlowEdge[] = [],
): FlowEdge[] {
  const parallelMeta = computeParallelEdgeMeta(source)
  const previousEdgesById = new Map(previousEdges.map((edge) => [edge.id, edge]))
  let changed = previousEdges.length !== source.edges.length

  const nextEdges = source.edges.map((edge, index) => {
    const bundle = parallelMeta.get(edge.id) ?? {parallelIndex: 0, parallelCount: 1}
    const {sourceSide, targetSide} = resolveEdgeHandleSides(edge, positions)
    const sourceHandle = toFlowHandleId(edge.sourceHandleId, sourceSide)
    const targetHandle = toFlowHandleId(edge.targetHandleId, targetSide)
    const selected = edge.id === selectedEdgeId
    const markerStart = edge.kind === 'association' ? 'url(#csdt-marker-many)' : undefined
    const markerEnd = edge.kind === 'association'
      ? 'url(#csdt-marker-many)'
      : edge.kind === 'materialization'
        ? 'url(#csdt-marker-lineage)'
        : 'url(#csdt-marker-many)'
    const previousEdge = previousEdgesById.get(edge.id)

    if (
      previousEdge
      && previousEdge.type === 'semantic-edge'
      && previousEdge.source === edge.sourceNodeId
      && previousEdge.target === edge.targetNodeId
      && previousEdge.sourceHandle === sourceHandle
      && previousEdge.targetHandle === targetHandle
      && previousEdge.selectable
      && previousEdge.selected === selected
      && previousEdge.data?.edgeId === edge.id
      && previousEdge.data.parallelIndex === bundle.parallelIndex
      && previousEdge.data.parallelCount === bundle.parallelCount
      && previousEdge.markerStart === markerStart
      && previousEdge.markerEnd === markerEnd
    ) {
      if (previousEdges[index] !== previousEdge) {
        changed = true
      }

      return previousEdge
    }

    changed = true

    return {
      id: edge.id,
      type: 'semantic-edge' as const,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle,
      targetHandle,
      selectable: true,
      selected,
      data: {
        edgeId: edge.id,
        parallelIndex: bundle.parallelIndex,
        parallelCount: bundle.parallelCount,
      },
      markerStart,
      markerEnd,
    }
  })

  return changed ? nextEdges : (previousEdges as FlowEdge[])
}

/**
 * Persists the current visible node positions back into the devtools store while preserving
 * positions for nodes that are temporarily hidden from the canvas.
 */
export function mergeFlowNodePositions(
  currentPositions: Record<string, FlowNodePosition>,
  nodes: readonly FlowNode[],
  source: NormalizedSourceVm,
): Record<string, FlowNodePosition> {
  const visibleNodeIds = new Set(source.nodes.map((node) => node.id))
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  let nextPositions: Record<string, FlowNodePosition> | null = null

  for (const nodeId of visibleNodeIds) {
    const node = nodesById.get(nodeId)

    if (!node) {
      continue
    }

    const nextPosition = {
      x: node.position.x,
      y: node.position.y,
    }

    if (hasSamePosition(currentPositions[nodeId], nextPosition)) {
      continue
    }

    if (!nextPositions) {
      nextPositions = {...currentPositions}
    }

    nextPositions[nodeId] = nextPosition
  }

  return nextPositions ?? currentPositions
}

/**
 * React Flow emits many structural changes (`remove`, `replace`, `add`) while reconciling.
 * The devtools graph structure is source-controlled, so only user-driven position updates
 * are allowed to feed back into local state.
 */
export function applyFlowNodePositionChanges(
  currentPositions: Record<string, FlowNodePosition>,
  changes: readonly NodeChange<FlowNode>[],
  source: NormalizedSourceVm,
): Record<string, FlowNodePosition> {
  const visibleNodeIds = new Set(source.nodes.map((node) => node.id))
  let nextPositions: Record<string, FlowNodePosition> | null = null

  for (const change of changes) {
    if (change.type !== 'position' || !change.position || !visibleNodeIds.has(change.id)) {
      continue
    }

    const previous = currentPositions[change.id]

    if (hasSamePosition(previous, change.position)) {
      continue
    }

    if (!nextPositions) {
      nextPositions = {...currentPositions}
    }

    nextPositions[change.id] = change.position
  }

  return nextPositions ?? currentPositions
}
