import ELK from 'elkjs/lib/elk.bundled.js'
import {getCollapsedVisibleFields} from './graph-field-visibility.js'
import {
  DEFAULT_DEVTOOLS_ELK_LAYOUT,
  devtoolsElkLayoutToElkOptions,
  normalizeDevtoolsElkLayoutConfig,
  type DevtoolsElkLayoutConfig,
} from './layout-options.js'
import type {NormalizedSourceVm} from './types.js'

/** Canvas node width (React Flow + ELK); keep in sync with `--csdt-node-width` fallback in CSS. */
export const DEVTOOLS_NODE_WIDTH = 276

const NODE_HEADER_HEIGHT = 62
const NODE_ATTRIBUTE_ROW_HEIGHT = 22
const NODE_FIELD_ROW_HEIGHT = 26
const NODE_FOOTER_HEIGHT = 32

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
    layoutOptions?: Record<string, string>
  }>
}

const elk = new ELK()
const ELK_MODEL_ORDER_GROUP_KEY = 'elk.layered.considerModelOrder.groupModelOrder.crossingMinimizationId'
const STRUCTURAL_LAYOUT_GROUP = '0'
const MATERIALIZED_LAYOUT_GROUP = '1'

/**
 * Height passed to ELK for each node. Materialized views use the **default** join/key row count only
 * (`mvJoinKeyOverflowRevealed: false`) so toggling “reveal more join keys” on the canvas does not
 * change ELK dimensions — the graph does not relayout or shift neighbors; the node grows visually in
 * the DOM only. Full “show more” expansion still uses the expanded-node set and relayouts.
 */
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
    : getCollapsedVisibleFields(node, source, {
        mvJoinKeyOverflowRevealed: node.kind === 'materialized-view' ? false : undefined,
      }).length
  const attributeHeight = node.attributeIds.length > 0 ? NODE_ATTRIBUTE_ROW_HEIGHT : 0

  return NODE_HEADER_HEIGHT
    + attributeHeight
    + (visibleFieldCount * NODE_FIELD_ROW_HEIGHT)
    + NODE_FOOTER_HEIGHT
}

function getNodeLayoutGroup(node: NormalizedSourceVm['nodes'][number]): string {
  return node.kind === 'materialized-view' ? MATERIALIZED_LAYOUT_GROUP : STRUCTURAL_LAYOUT_GROUP
}

function getEdgeLayoutGroup(edge: NormalizedSourceVm['edges'][number]): string {
  return edge.kind === 'materialization' ? MATERIALIZED_LAYOUT_GROUP : STRUCTURAL_LAYOUT_GROUP
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
  const graph = buildElkLayoutGraph(source, expandedNodeIds, layoutConfig)

  try {
    const layout = await elk.layout(graph)

    return Object.fromEntries(
      source.nodes.map((node, index) => {
        const layoutNode = layout.children?.find((candidate: ElkNode) => candidate.id === node.id)
        const fallback = createFallbackPosition(index, normalizeDevtoolsElkLayoutConfig(layoutConfig))

        return [node.id, {
          x: layoutNode?.x ?? fallback.x,
          y: layoutNode?.y ?? fallback.y,
        }]
      }),
    )
  } catch {
    const normalizedLayout = normalizeDevtoolsElkLayoutConfig(layoutConfig)

    return Object.fromEntries(
      source.nodes.map((node, index) => [node.id, createFallbackPosition(index, normalizedLayout)]),
    )
  }
}

export function buildElkLayoutGraph(
  source: NormalizedSourceVm,
  expandedNodeIds: ReadonlySet<string>,
  layoutConfig: DevtoolsElkLayoutConfig = DEFAULT_DEVTOOLS_ELK_LAYOUT,
): ElkNode {
  const normalizedLayout = normalizeDevtoolsElkLayoutConfig(layoutConfig)

  return {
    id: 'chart-studio-devtools',
    layoutOptions: devtoolsElkLayoutToElkOptions(normalizedLayout),
    children: source.nodes.map((node) => ({
      id: node.id,
      width: DEVTOOLS_NODE_WIDTH,
      height: estimateNodeHeight(source, node.id, expandedNodeIds),
      layoutOptions: {
        [ELK_MODEL_ORDER_GROUP_KEY]: getNodeLayoutGroup(node),
      },
    })),
    edges: source.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceNodeId],
      targets: [edge.targetNodeId],
      layoutOptions: {
        [ELK_MODEL_ORDER_GROUP_KEY]: getEdgeLayoutGroup(edge),
      },
    })),
  }
}
