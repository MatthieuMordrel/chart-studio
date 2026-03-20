import ELK from 'elkjs/lib/elk.bundled.js'
import {
  DEFAULT_DEVTOOLS_ELK_LAYOUT,
  devtoolsElkLayoutToElkOptions,
  normalizeDevtoolsElkLayoutConfig,
  type DevtoolsElkLayoutConfig,
} from './layout-options.js'
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

function createFallbackPosition(
  index: number,
  layoutConfig: DevtoolsElkLayoutConfig,
): {x: number; y: number} {
  const column = index % 3
  const row = Math.floor(index / 3)
  const colW = Math.max(400, Math.round(1.85 * layoutConfig.spacingBetweenLayers))
  const rowH = Math.max(300, Math.round(1.85 * layoutConfig.spacingNodeNode))

  return {
    x: column * colW,
    y: row * rowH,
  }
}

export async function computeGraphLayout(
  source: NormalizedSourceVm,
  expandedNodeIds: ReadonlySet<string>,
  layoutConfig: DevtoolsElkLayoutConfig = DEFAULT_DEVTOOLS_ELK_LAYOUT,
): Promise<Record<string, {x: number; y: number}>> {
  const normalizedLayout = normalizeDevtoolsElkLayoutConfig(layoutConfig)

  const graph: ElkNode = {
    id: 'chart-studio-devtools',
    layoutOptions: devtoolsElkLayoutToElkOptions(normalizedLayout),
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
        const fallback = createFallbackPosition(index, normalizedLayout)

        return [node.id, {
          x: layoutNode?.x ?? fallback.x,
          y: layoutNode?.y ?? fallback.y,
        }]
      }),
    )
  } catch {
    return Object.fromEntries(
      source.nodes.map((node, index) => [node.id, createFallbackPosition(index, normalizedLayout)]),
    )
  }
}
