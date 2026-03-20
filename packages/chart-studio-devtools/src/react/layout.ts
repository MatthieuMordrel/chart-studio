import ELK from 'elkjs/lib/elk.bundled.js'
import type {NormalizedSourceVm} from './types.js'

export const DEVTOOLS_NODE_WIDTH = 356
export const DEVTOOLS_VISIBLE_FIELD_COUNT = 8

const NODE_HEADER_HEIGHT = 72
const NODE_ATTRIBUTE_ROW_HEIGHT = 24
const NODE_FIELD_ROW_HEIGHT = 30
const NODE_FOOTER_HEIGHT = 36

type ElkNode = {
  id: string
  width?: number
  height?: number
  x?: number
  y?: number
  layoutOptions?: Record<string, string>
  children?: ElkNode[]
  edges?: Array<{
    id: string
    sources: string[]
    targets: string[]
  }>
}

const elk = new ELK()

export function estimateNodeHeight(
  source: NormalizedSourceVm,
  nodeId: string,
  expandedNodeIds: ReadonlySet<string>,
): number {
  const node = source.nodeMap.get(nodeId)

  if (!node) {
    return NODE_HEADER_HEIGHT + NODE_FOOTER_HEIGHT
  }

  const visibleFieldCount = expandedNodeIds.has(nodeId)
    ? node.fields.length
    : Math.min(node.fields.length, DEVTOOLS_VISIBLE_FIELD_COUNT)
  const attributeHeight = node.attributeIds.length > 0 ? NODE_ATTRIBUTE_ROW_HEIGHT : 0

  return NODE_HEADER_HEIGHT
    + attributeHeight
    + (visibleFieldCount * NODE_FIELD_ROW_HEIGHT)
    + NODE_FOOTER_HEIGHT
}

function createFallbackPosition(index: number): {x: number; y: number} {
  const column = index % 3
  const row = Math.floor(index / 3)

  return {
    x: column * 420,
    y: row * 320,
  }
}

export async function computeGraphLayout(
  source: NormalizedSourceVm,
  expandedNodeIds: ReadonlySet<string>,
): Promise<Record<string, {x: number; y: number}>> {
  const graph: ElkNode = {
    id: 'chart-studio-devtools',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '180',
      'elk.spacing.nodeNode': '120',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
    },
    children: source.nodes.map((node) => ({
      id: node.id,
      width: DEVTOOLS_NODE_WIDTH,
      height: estimateNodeHeight(source, node.id, expandedNodeIds),
    })),
    edges: source.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceNodeId],
      targets: [edge.targetNodeId],
    })),
  }

  try {
    const layout = await elk.layout(graph)

    return Object.fromEntries(
      source.nodes.map((node, index) => {
        const layoutNode = layout.children?.find((candidate: ElkNode) => candidate.id === node.id)
        const fallback = createFallbackPosition(index)

        return [node.id, {
          x: layoutNode?.x ?? fallback.x,
          y: layoutNode?.y ?? fallback.y,
        }]
      }),
    )
  } catch {
    return Object.fromEntries(
      source.nodes.map((node, index) => [node.id, createFallbackPosition(index)]),
    )
  }
}
