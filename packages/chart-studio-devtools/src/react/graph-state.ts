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

export function buildFlowNodes(
  source: NormalizedSourceVm,
  positions: Readonly<Record<string, FlowNodePosition>>,
  selectedNodeId: string | null,
): FlowNode[] {
  return source.nodes.map((node) => ({
    id: node.id,
    type: 'semantic-node',
    position: positions[node.id] ?? {x: 0, y: 0},
    draggable: true,
    selectable: true,
    selected: node.id === selectedNodeId,
    data: {nodeId: node.id},
    width: DEVTOOLS_NODE_WIDTH,
  }))
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

export function buildFlowEdges(
  source: NormalizedSourceVm,
  selectedEdgeId: string | null,
): FlowEdge[] {
  const parallelMeta = computeParallelEdgeMeta(source)

  return source.edges.map((edge) => {
    const bundle = parallelMeta.get(edge.id) ?? {parallelIndex: 0, parallelCount: 1}

    return {
      id: edge.id,
      type: 'semantic-edge',
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandleId,
      targetHandle: edge.targetHandleId,
      selectable: true,
      selected: edge.id === selectedEdgeId,
      data: {
        edgeId: edge.id,
        parallelIndex: bundle.parallelIndex,
        parallelCount: bundle.parallelCount,
      },
      markerStart: edge.kind === 'association' ? 'url(#csdt-marker-many)' : undefined,
      markerEnd: edge.kind === 'association'
        ? 'url(#csdt-marker-many)'
        : edge.kind === 'materialization'
          ? 'url(#csdt-marker-lineage)'
          : 'url(#csdt-marker-many)',
    }
  })
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

    if (previous?.x === change.position.x && previous?.y === change.position.y) {
      continue
    }

    if (!nextPositions) {
      nextPositions = {...currentPositions}
    }

    nextPositions[change.id] = change.position
  }

  return nextPositions ?? currentPositions
}
