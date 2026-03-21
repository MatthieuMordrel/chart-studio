import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type {ChartStudioDevtoolsContextSnapshot} from '@matthieumordrel/chart-studio/_internal'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  type EdgeProps,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import {ArrowUpRight, ChevronDown, ChevronUp} from 'lucide-react'
import {
  buildFlowEdges,
  buildFlowNodes,
  extractFlowNodePositions,
  mergeFlowNodePositions,
  syncFlowNodesWithExternalState,
  toFlowHandleId,
  type FlowEdge,
  type FlowNode,
  type FlowNodePosition,
} from './graph-state.js'
import {
  getCollapsedVisibleFields,
  getMaterializedViewJoinProjectedFields,
} from './graph-field-visibility.js'
import {computeCanvasFieldOrderByNodeId} from './graph-field-layout.js'
import {DEVTOOLS_NODE_WIDTH} from './layout.js'
import {ColumnTypeIcon} from './column-type-icon.js'
import {FieldRoleBadges, formatBytes} from './devtools-details.js'
import type {
  NormalizedEdgeVm,
  NormalizedSourceVm,
} from './types.js'

/** Base `getSmoothStepPath` offset (matches previous single-edge default). */
const SMOOTH_STEP_OFFSET_BASE = 14
/** Extra offset per additional edge between the same two nodes (staggered paths). */
const SMOOTH_STEP_OFFSET_STRIDE = 12

/**
 * Viewport margin when fitting the graph (React Flow `fitView` padding). Lower = tighter fit /
 * larger default zoom; was 0.22 and left noticeable empty bands on wide layouts.
 */
export const FIT_VIEW_PADDING = 0.06

const FIT_VIEW_OPTIONS = {padding: FIT_VIEW_PADDING} as const
const PRO_OPTIONS = {hideAttribution: true} as const
const EMPTY_FLOW_NODES: readonly FlowNode[] = []

type NormalizedNodeVm = NormalizedSourceVm['nodes'][number]
type NormalizedFieldVm = NormalizedNodeVm['fields'][number]

export type CanvasContextValue = {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
  edgeHighlightFieldIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>
  expandedNodeIds: ReadonlySet<string>
  /** Node that owns {@link focusedFieldId} for column focus styling (hover or selection). */
  fieldFocusNodeId: string | null
  focusedEdgeIds: ReadonlySet<string>
  focusedFieldId: string | null
  focusedNodeIds: ReadonlySet<string>
  issuesByTargetId: ReadonlyMap<string, readonly string[]>
  /** Manual ∪ auto: MV join/key overflow is visible (beyond the first cap of join/key rows). */
  mvJoinKeyOverflowRevealedIds: ReadonlySet<string>
  onClearHover(): void
  onClearSelection(): void
  onHoverEdge(edgeId: string | null): void
  onHoverField(nodeId: string | null, fieldId: string | null): void
  onInspectNode(nodeId: string): void
  onSelectEdge(edgeId: string): void
  onSelectNode(nodeId: string, fieldId?: string): void
  onToggleNodeExpand(nodeId: string): void
  selectedEdgeId: string | null
  selectedNodeId: string | null
  source: NormalizedSourceVm
}

type DevtoolsGraphCanvasProps = {
  canvasContextValue: CanvasContextValue
  displaySource: NormalizedSourceVm
  edgeRoutes: Readonly<Record<string, readonly FlowNodePosition[]>>
  layoutNodePositions: Readonly<Record<string, FlowNodePosition>>
  nodePositions: Readonly<Record<string, FlowNodePosition>>
  onFlowInstanceChange: Dispatch<SetStateAction<ReactFlowInstance<FlowNode, FlowEdge> | null>>
  onNodePositionsChange: Dispatch<SetStateAction<Record<string, FlowNodePosition>>>
  onRevealMaterializedViewFields(nodeId: string): void
}

type CanvasRenderContextValue = CanvasContextValue & {
  nodeBoundsById: ReadonlyMap<string, {left: number; right: number; top: number; bottom: number}>
  orderedFieldIdsByNodeId: ReadonlyMap<string, readonly string[]>
}

const CanvasContext = createContext<CanvasRenderContextValue | null>(null)

function useCanvasContext(): CanvasRenderContextValue {
  const value = useContext(CanvasContext)

  if (!value) {
    throw new Error('ChartStudioDevtools canvas context is missing.')
  }

  return value
}

function getEdgeBadge(edge: NormalizedEdgeVm, selected: boolean): string {
  if (selected) {
    return edge.label
  }

  if (edge.kind === 'association') {
    return 'N:N'
  }

  if (edge.kind === 'materialization') {
    return 'MV'
  }

  return edge.inferred ? '1:N*' : '1:N'
}

type SemanticNodeCardProps = {
  edgeHighlightFieldIds: ReadonlySet<string> | undefined
  expanded: boolean
  fieldFocusNodeId: string | null
  focusedFieldId: string | null
  isDimmed: boolean
  isDragging: boolean
  isFocused: boolean
  isSelected: boolean
  issueCount: number
  node: NormalizedNodeVm
  visibleFieldCount: number
  visibleFields: readonly NormalizedFieldVm[]
  onHoverField(nodeId: string | null, fieldId: string | null): void
  onInspectNode(nodeId: string): void
  onSelectNode(nodeId: string, fieldId?: string): void
  onToggleNodeExpand(nodeId: string): void
}

const SemanticNodeCard = memo(function SemanticNodeCard({
  edgeHighlightFieldIds,
  expanded,
  fieldFocusNodeId,
  focusedFieldId,
  isDimmed,
  isDragging,
  isFocused,
  isSelected,
  issueCount,
  node,
  visibleFieldCount,
  visibleFields,
  onHoverField,
  onInspectNode,
  onSelectNode,
  onToggleNodeExpand,
}: SemanticNodeCardProps) {
  return (
    <div
      className={[
        'csdt-node',
        node.kind === 'materialized-view' ? 'is-materialized' : undefined,
        isSelected ? 'is-selected' : undefined,
        isFocused ? 'is-focused' : undefined,
        isDimmed ? 'is-dimmed' : undefined,
        isDragging ? 'is-dragging' : undefined,
      ].filter(Boolean).join(' ')}>
      <div className='csdt-node__hero'>
        <div className='csdt-node__header-row'>
          <h3>{node.label}</h3>
          <div className='csdt-node__meta'>
            <span className='csdt-node__type'>
              {node.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}
            </span>
            {issueCount > 0 && (
              <span className='csdt-node__issue-count'>{issueCount}</span>
            )}
            <button
              type='button'
              className='csdt-node__inspect nodrag'
              title='Open data viewer'
              onClick={(event) => {
                event.stopPropagation()
                onInspectNode(node.id)
              }}>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
        <p>{node.fields.length} columns · {node.rowCount.toLocaleString()} rows · {formatBytes(node.estimatedBytes)}</p>
      </div>

      {node.attributeIds.length > 0 && (
        <div className='csdt-node__attributes'>
          {node.attributeIds.map((attributeId) => (
            <span key={attributeId} className='csdt-attribute-chip'>
              {attributeId}
            </span>
          ))}
        </div>
      )}

      <div className='csdt-node__fields'>
        {visibleFields.map((field) => (
          <button
            key={field.id}
            type='button'
            className={[
              'csdt-field nodrag',
              field.isPrimaryKey ? 'is-primary-key' : undefined,
              focusedFieldId === field.id && fieldFocusNodeId === node.id ? 'is-field-focused' : undefined,
              edgeHighlightFieldIds?.has(field.id) ? 'is-edge-highlight' : undefined,
            ].filter(Boolean).join(' ')}
            onClick={(event) => {
              event.stopPropagation()
              onSelectNode(node.id, field.id)
            }}
            onMouseEnter={() => {
              onHoverField(node.id, field.id)
            }}
            onMouseLeave={() => {
              onHoverField(null, null)
            }}>
            <Handle
              className='csdt-handle'
              position={Position.Left}
              type='target'
              id={toFlowHandleId(field.targetHandleId, 'left')}
            />
            <Handle
              className='csdt-handle'
              position={Position.Left}
              type='source'
              id={toFlowHandleId(field.sourceHandleId, 'left')}
            />
            <span className='csdt-field__main'>
              <ColumnTypeIcon type={field.type} />
              <span>{field.label}</span>
            </span>
            <span className='csdt-field__badges'>
              <FieldRoleBadges field={field} />
            </span>
            <Handle
              className='csdt-handle'
              position={Position.Right}
              type='source'
              id={toFlowHandleId(field.sourceHandleId, 'right')}
            />
            <Handle
              className='csdt-handle'
              position={Position.Right}
              type='target'
              id={toFlowHandleId(field.targetHandleId, 'right')}
            />
          </button>
        ))}
      </div>

      {(expanded || node.fields.length > visibleFieldCount) && (
        <button
          type='button'
          className='csdt-node__expand nodrag'
          onClick={(event) => {
            event.stopPropagation()
            onToggleNodeExpand(node.id)
          }}>
          {expanded
            ? <><ChevronUp size={12} /> Show less</>
            : <><ChevronDown size={12} /> {node.fields.length - visibleFieldCount} more fields</>}
        </button>
      )}
    </div>
  )
})

SemanticNodeCard.displayName = 'SemanticNodeCard'

function orderVisibleFields(
  visibleFields: readonly NormalizedFieldVm[],
  orderedFieldIds: readonly string[] | undefined,
): readonly NormalizedFieldVm[] {
  if (!orderedFieldIds || orderedFieldIds.length < 2 || visibleFields.length < 2) {
    return visibleFields
  }

  const orderIndexByFieldId = new Map(
    orderedFieldIds.map((fieldId, index) => [fieldId, index] as const),
  )

  return [...visibleFields].sort((left, right) =>
    (orderIndexByFieldId.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (orderIndexByFieldId.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )
}

const CANVAS_NODE_HEADER_HEIGHT = 62
const CANVAS_NODE_ATTRIBUTE_ROW_HEIGHT = 22
const CANVAS_NODE_FIELD_ROW_HEIGHT = 26
const CANVAS_NODE_FOOTER_HEIGHT = 32
const EDGE_ROUTE_HANDLE_OFFSET = 18
const EDGE_ROUTE_OBSTACLE_PADDING = 12

type CanvasRect = {left: number; right: number; top: number; bottom: number}

function estimateCanvasNodeHeight(
  node: NormalizedNodeVm,
  source: NormalizedSourceVm,
  expandedNodeIds: ReadonlySet<string>,
  mvJoinKeyOverflowRevealedIds: ReadonlySet<string>,
): number {
  const visibleFieldCount = expandedNodeIds.has(node.id)
    ? node.fields.length
    : getCollapsedVisibleFields(node, source, {
        mvJoinKeyOverflowRevealed: node.kind === 'materialized-view'
          ? mvJoinKeyOverflowRevealedIds.has(node.id)
          : undefined,
      }).length
  const attributeHeight = node.attributeIds.length > 0 ? CANVAS_NODE_ATTRIBUTE_ROW_HEIGHT : 0

  return CANVAS_NODE_HEADER_HEIGHT
    + attributeHeight
    + (visibleFieldCount * CANVAS_NODE_FIELD_ROW_HEIGHT)
    + CANVAS_NODE_FOOTER_HEIGHT
}

function expandRect(
  rect: CanvasRect,
  padding: number,
): CanvasRect {
  return {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding,
  }
}

function pointInsideRect(
  point: FlowNodePosition,
  rect: CanvasRect,
): boolean {
  return point.x > rect.left
    && point.x < rect.right
    && point.y > rect.top
    && point.y < rect.bottom
}

function rangesOverlap(
  start: number,
  end: number,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  return Math.max(Math.min(start, end), rangeStart) < Math.min(Math.max(start, end), rangeEnd)
}

function isHorizontalSegmentClear(
  y: number,
  startX: number,
  endX: number,
  obstacles: readonly CanvasRect[],
): boolean {
  return obstacles.every((rect) =>
    !(y > rect.top && y < rect.bottom && rangesOverlap(startX, endX, rect.left, rect.right)),
  )
}

function isVerticalSegmentClear(
  x: number,
  startY: number,
  endY: number,
  obstacles: readonly CanvasRect[],
): boolean {
  return obstacles.every((rect) =>
    !(x > rect.left && x < rect.right && rangesOverlap(startY, endY, rect.top, rect.bottom)),
  )
}

function dedupeNumbers(values: readonly number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)).map((value) => Math.round(value * 100) / 100))]
}

function simplifyOrthogonalPoints(
  points: readonly FlowNodePosition[],
): FlowNodePosition[] {
  const deduped = points.filter((point, index) =>
    index === 0
    || point.x !== points[index - 1]!.x
    || point.y !== points[index - 1]!.y,
  )

  if (deduped.length < 3) {
    return deduped
  }

  const simplified: FlowNodePosition[] = [deduped[0]!]

  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1]!
    const current = deduped[index]!
    const next = deduped[index + 1]!
    const isCollinear = (previous.x === current.x && current.x === next.x)
      || (previous.y === current.y && current.y === next.y)

    if (!isCollinear) {
      simplified.push(current)
    }
  }

  simplified.push(deduped[deduped.length - 1]!)

  return simplified
}

function buildOrthogonalLanePath(
  sourcePoint: FlowNodePosition,
  sourceExit: FlowNodePosition,
  targetEntry: FlowNodePosition,
  targetPoint: FlowNodePosition,
  obstacles: readonly CanvasRect[],
): readonly FlowNodePosition[] | null {
  const candidateLaneYs = dedupeNumbers([
    sourceExit.y,
    targetEntry.y,
    ...obstacles.flatMap((rect) => [rect.top, rect.bottom]),
  ])

  let bestPath: readonly FlowNodePosition[] | null = null
  let bestCost = Number.POSITIVE_INFINITY

  for (const laneY of candidateLaneYs) {
    if (
      !isVerticalSegmentClear(sourceExit.x, sourceExit.y, laneY, obstacles)
      || !isHorizontalSegmentClear(laneY, sourceExit.x, targetEntry.x, obstacles)
      || !isVerticalSegmentClear(targetEntry.x, targetEntry.y, laneY, obstacles)
    ) {
      continue
    }

    const path = simplifyOrthogonalPoints([
      sourcePoint,
      sourceExit,
      {x: sourceExit.x, y: laneY},
      {x: targetEntry.x, y: laneY},
      targetEntry,
      targetPoint,
    ])
    const cost = Math.abs(laneY - sourceExit.y)
      + Math.abs(targetEntry.x - sourceExit.x)
      + Math.abs(targetEntry.y - laneY)

    if (cost < bestCost) {
      bestPath = path
      bestCost = cost
    }
  }

  if (bestPath) {
    return bestPath
  }

  const candidateLaneXs = dedupeNumbers([
    sourceExit.x,
    targetEntry.x,
    ...obstacles.flatMap((rect) => [rect.left, rect.right]),
  ])

  for (const laneX of candidateLaneXs) {
    if (
      !isHorizontalSegmentClear(sourceExit.y, sourceExit.x, laneX, obstacles)
      || !isVerticalSegmentClear(laneX, sourceExit.y, targetEntry.y, obstacles)
      || !isHorizontalSegmentClear(targetEntry.y, laneX, targetEntry.x, obstacles)
    ) {
      continue
    }

    const path = simplifyOrthogonalPoints([
      sourcePoint,
      sourceExit,
      {x: laneX, y: sourceExit.y},
      {x: laneX, y: targetEntry.y},
      targetEntry,
      targetPoint,
    ])
    const cost = Math.abs(laneX - sourceExit.x)
      + Math.abs(targetEntry.y - sourceExit.y)
      + Math.abs(targetEntry.x - laneX)

    if (cost < bestCost) {
      bestPath = path
      bestCost = cost
    }
  }

  return bestPath
}

function buildAnchoredRoutePoints(
  sourcePoint: FlowNodePosition,
  routePoints: readonly FlowNodePosition[],
  targetPoint: FlowNodePosition,
): readonly FlowNodePosition[] {
  if (routePoints.length <= 2) {
    return simplifyOrthogonalPoints([sourcePoint, targetPoint])
  }

  return simplifyOrthogonalPoints([
    sourcePoint,
    ...routePoints.slice(1, -1),
    targetPoint,
  ])
}

function buildPolylinePath(points: readonly FlowNodePosition[]): string {
  return points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
  ).join(' ')
}

function getPolylineMidpoint(
  points: readonly FlowNodePosition[],
): {x: number; y: number} {
  if (points.length === 0) {
    return {x: 0, y: 0}
  }

  if (points.length === 1) {
    return points[0]!
  }

  const segmentLengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y),
  )
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0)

  if (totalLength === 0) {
    return points[0]!
  }

  let traversed = 0
  const halfway = totalLength / 2

  for (const [index, segmentLength] of segmentLengths.entries()) {
    const start = points[index]!
    const end = points[index + 1]!

    if (traversed + segmentLength >= halfway) {
      const distanceIntoSegment = halfway - traversed
      const ratio = segmentLength === 0 ? 0 : distanceIntoSegment / segmentLength

      return {
        x: start.x + ((end.x - start.x) * ratio),
        y: start.y + ((end.y - start.y) * ratio),
      }
    }

    traversed += segmentLength
  }

  return points[points.length - 1]!
}

const SemanticNode = memo(function SemanticNode({
  data,
  dragging = false,
}: NodeProps<FlowNode>) {
  const ctx = useCanvasContext()
  const node = ctx.source.nodeMap.get(data.nodeId)

  if (!node) {
    return null
  }

  const expanded = ctx.expandedNodeIds.has(node.id)
  const mvJoinKeyOverflowRevealed = ctx.mvJoinKeyOverflowRevealedIds.has(node.id)
  const collapsedFields = useMemo(
    () => getCollapsedVisibleFields(node, ctx.source, {mvJoinKeyOverflowRevealed}),
    [ctx.source, mvJoinKeyOverflowRevealed, node],
  )
  const orderedFieldIds = ctx.orderedFieldIdsByNodeId.get(node.id)
  const visibleFields = useMemo(
    () => orderVisibleFields(expanded ? node.fields : collapsedFields, orderedFieldIds),
    [collapsedFields, expanded, node.fields, orderedFieldIds],
  )
  const issueCount = ctx.issuesByTargetId.get(node.id)?.length ?? 0
  const isSelected = ctx.selectedNodeId === node.id
  const isFocused = ctx.focusedNodeIds.has(node.id)
  const isDimmed = ctx.focusedNodeIds.size > 0 && !isFocused
  const edgeHighlightFieldIds = ctx.edgeHighlightFieldIdsByNodeId.get(node.id)

  return (
    <SemanticNodeCard
      edgeHighlightFieldIds={edgeHighlightFieldIds}
      expanded={expanded}
      fieldFocusNodeId={ctx.fieldFocusNodeId}
      focusedFieldId={ctx.focusedFieldId}
      isDimmed={isDimmed}
      isDragging={dragging}
      isFocused={isFocused}
      isSelected={isSelected}
      issueCount={issueCount}
      node={node}
      visibleFieldCount={collapsedFields.length}
      visibleFields={visibleFields}
      onHoverField={ctx.onHoverField}
      onInspectNode={ctx.onInspectNode}
      onSelectNode={ctx.onSelectNode}
      onToggleNodeExpand={ctx.onToggleNodeExpand}
    />
  )
})

SemanticNode.displayName = 'SemanticNode'

const SemanticEdge = memo(function SemanticEdge({
  data,
  id,
  markerEnd,
  markerStart,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<FlowEdge>) {
  const ctx = useCanvasContext()

  if (!data) {
    return null
  }

  const edge = ctx.source.edgeMap.get(data.edgeId)

  if (!edge) {
    return null
  }

  const parallelIndex = data.parallelIndex ?? 0
  const parallelCount = data.parallelCount ?? 1
  const pathOffset = SMOOTH_STEP_OFFSET_BASE + parallelIndex * SMOOTH_STEP_OFFSET_STRIDE
  const stepPosition = parallelCount <= 1
    ? 0.5
    : (parallelIndex + 1) / (parallelCount + 1)
  const routePoints = data.routePoints ?? null
  const routedPathPoints = useMemo(() => {
    const sourcePoint = {x: sourceX, y: sourceY}
    const targetPoint = {x: targetX, y: targetY}
    const sourceExit = {
      x: sourceX + (sourcePosition === Position.Left ? -EDGE_ROUTE_HANDLE_OFFSET : EDGE_ROUTE_HANDLE_OFFSET),
      y: sourceY,
    }
    const targetEntry = {
      x: targetX + (targetPosition === Position.Left ? -EDGE_ROUTE_HANDLE_OFFSET : EDGE_ROUTE_HANDLE_OFFSET),
      y: targetY,
    }
    const obstacles = [...ctx.nodeBoundsById.entries()]
      .filter(([nodeId]) => nodeId !== edge.sourceNodeId && nodeId !== edge.targetNodeId)
      .map(([, rect]) => expandRect(rect, EDGE_ROUTE_OBSTACLE_PADDING))
      .filter((rect) =>
        !pointInsideRect(sourceExit, rect)
        && !pointInsideRect(targetEntry, rect),
      )

    return buildOrthogonalLanePath(
      sourcePoint,
      sourceExit,
      targetEntry,
      targetPoint,
      obstacles,
    )
      ?? (routePoints ? buildAnchoredRoutePoints(sourcePoint, routePoints, targetPoint) : null)
  }, [
    ctx.nodeBoundsById,
    edge.sourceNodeId,
    edge.targetNodeId,
    routePoints,
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  ])
  const routedLabelPoint = routedPathPoints ? getPolylineMidpoint(routedPathPoints) : null
  const [fallbackPath, fallbackLabelX, fallbackLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 28,
    offset: pathOffset,
    stepPosition,
  })
  const path = routedPathPoints ? buildPolylinePath(routedPathPoints) : fallbackPath
  const labelX = routedLabelPoint?.x ?? fallbackLabelX
  const labelY = routedLabelPoint?.y ?? fallbackLabelY
  const isFocused = ctx.focusedEdgeIds.has(edge.id)
  const isDimmed = ctx.focusedEdgeIds.size > 0 && !isFocused

  return (
    <>
      <BaseEdge
        id={id}
        className={[
          'csdt-edge',
          `is-${edge.kind}`,
          edge.kind === 'relationship' && edge.inferred ? 'is-inferred' : undefined,
          selected ? 'is-selected' : undefined,
          isFocused ? 'is-focused' : undefined,
          isDimmed ? 'is-dimmed' : undefined,
        ].filter(Boolean).join(' ')}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />

      <EdgeLabelRenderer>
        <button
          type='button'
          className={[
            'csdt-edge-label',
            selected ? 'is-selected' : undefined,
          ].filter(Boolean).join(' ')}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={() => ctx.onSelectEdge(edge.id)}
          onMouseEnter={() => {
            ctx.onHoverEdge(edge.id)
          }}>
          {getEdgeBadge(edge, !!selected)}
        </button>
      </EdgeLabelRenderer>
    </>
  )
})

SemanticEdge.displayName = 'SemanticEdge'

function MarkerDefs() {
  return (
    <svg className='csdt-markers' width='0' height='0' aria-hidden='true'>
      <defs>
        <marker id='csdt-marker-one' markerWidth='12' markerHeight='12' refX='10' refY='6' orient='auto'>
          <path d='M 10 1 L 10 11' className='csdt-marker-stroke' />
        </marker>
        <marker id='csdt-marker-many' markerWidth='16' markerHeight='16' refX='14' refY='8' orient='auto'>
          <path d='M 14 8 L 4 2' className='csdt-marker-stroke' />
          <path d='M 14 8 L 4 8' className='csdt-marker-stroke' />
          <path d='M 14 8 L 4 14' className='csdt-marker-stroke' />
        </marker>
        <marker id='csdt-marker-lineage' markerWidth='12' markerHeight='12' refX='10' refY='6' orient='auto'>
          <circle cx='6' cy='6' r='3.5' className='csdt-marker-fill' />
        </marker>
      </defs>
    </svg>
  )
}

const NODE_TYPES = {'semantic-node': SemanticNode} as const
const EDGE_TYPES = {'semantic-edge': SemanticEdge} as const

export const DevtoolsGraphCanvas = memo(function DevtoolsGraphCanvas({
  canvasContextValue,
  displaySource,
  edgeRoutes,
  layoutNodePositions,
  nodePositions,
  onFlowInstanceChange,
  onNodePositionsChange,
  onRevealMaterializedViewFields,
}: DevtoolsGraphCanvasProps) {
  const previousExternalNodesRef = useRef<readonly FlowNode[]>(EMPTY_FLOW_NODES)
  const previousExternalEdgesRef = useRef<readonly FlowEdge[]>([])
  const previousExternalPositionsRef = useRef<Readonly<Record<string, FlowNodePosition>>>({})
  const externalNodes = useMemo(() => {
    const nextNodes = buildFlowNodes(
      displaySource,
      nodePositions,
      canvasContextValue.selectedNodeId,
      previousExternalNodesRef.current,
    )

    previousExternalNodesRef.current = nextNodes

    return nextNodes
  }, [canvasContextValue.selectedNodeId, displaySource, nodePositions])
  const externalEdges = useMemo(() => {
    const nextEdges = buildFlowEdges(
      displaySource,
      canvasContextValue.selectedEdgeId,
      {
        nodePositions,
        layoutNodePositions,
        edgeRoutes,
        previousEdges: previousExternalEdgesRef.current,
      },
    )

    previousExternalEdgesRef.current = nextEdges

    return nextEdges
  }, [canvasContextValue.selectedEdgeId, displaySource, edgeRoutes, layoutNodePositions, nodePositions])
  const [nodes, setNodes] = useState<FlowNode[]>(() => externalNodes)
  const nodesRef = useRef(nodes)
  const orderedFieldIdsByNodeId = useMemo(
    () => computeCanvasFieldOrderByNodeId(displaySource, nodePositions, canvasContextValue.expandedNodeIds),
    [canvasContextValue.expandedNodeIds, displaySource, nodePositions],
  )
  const nodeBoundsById = useMemo(
    () => new Map(displaySource.nodes.map((node) => {
      const position = nodePositions[node.id] ?? {x: 0, y: 0}
      const height = estimateCanvasNodeHeight(
        node,
        displaySource,
        canvasContextValue.expandedNodeIds,
        canvasContextValue.mvJoinKeyOverflowRevealedIds,
      )

      return [node.id, {
        left: position.x,
        right: position.x + DEVTOOLS_NODE_WIDTH,
        top: position.y,
        bottom: position.y + height,
      }] as const
    })),
    [
      canvasContextValue.expandedNodeIds,
      canvasContextValue.mvJoinKeyOverflowRevealedIds,
      displaySource,
      nodePositions,
    ],
  )
  const renderContextValue = useMemo<CanvasRenderContextValue>(
    () => ({
      ...canvasContextValue,
      nodeBoundsById,
      orderedFieldIdsByNodeId,
    }),
    [canvasContextValue, nodeBoundsById, orderedFieldIdsByNodeId],
  )

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    setNodes((current) =>
      syncFlowNodesWithExternalState(current, externalNodes, previousExternalPositionsRef.current))
    previousExternalPositionsRef.current = extractFlowNodePositions(externalNodes)
  }, [externalNodes])

  useEffect(() => () => {
    onFlowInstanceChange(null)
  }, [onFlowInstanceChange])

  const commitNodePositions = useCallback(() => {
    onNodePositionsChange((current) =>
      mergeFlowNodePositions(current, nodesRef.current, displaySource))
  }, [displaySource, onNodePositionsChange])

  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])
  const handleNodeDragStop = useCallback(() => {
    commitNodePositions()
  }, [commitNodePositions])
  const handleNodeClick = useCallback((_event: unknown, node: FlowNode) => {
    const selectedNode = displaySource.nodeMap.get(node.id)

    if (selectedNode?.kind === 'materialized-view') {
      const joinProjected = getMaterializedViewJoinProjectedFields(selectedNode)

      if (
        joinProjected.length > 0
        && !canvasContextValue.mvJoinKeyOverflowRevealedIds.has(node.id)
      ) {
        onRevealMaterializedViewFields(node.id)
      }
    }

    canvasContextValue.onSelectNode(node.id)
  }, [
    canvasContextValue,
    displaySource.nodeMap,
    onRevealMaterializedViewFields,
  ])
  const handleEdgeClick = useCallback((_event: unknown, edge: FlowEdge) => {
    canvasContextValue.onSelectEdge(edge.id)
  }, [canvasContextValue])
  const handlePaneClick = useCallback(() => {
    canvasContextValue.onClearSelection()
  }, [canvasContextValue])

  const handleEdgeMouseEnter = useCallback(
    (_event: unknown, edge: FlowEdge) => {
      canvasContextValue.onHoverEdge(edge.id)
    },
    [canvasContextValue],
  )

  const handleEdgeMouseLeave = useCallback(
    (_event: unknown, _edge: FlowEdge) => {
      canvasContextValue.onHoverEdge(null)
    },
    [canvasContextValue],
  )

  const handleCanvasPointerLeave = useCallback(() => {
    canvasContextValue.onClearHover()
  }, [canvasContextValue])

  return (
    <>
      <MarkerDefs />

      <CanvasContext.Provider value={renderContextValue}>
        <div className='csdt-canvas' onPointerLeave={handleCanvasPointerLeave}>
          <ReactFlowProvider>
            <ReactFlow
              fitView
              fitViewOptions={FIT_VIEW_OPTIONS}
              nodes={nodes}
              edges={externalEdges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              nodesConnectable={false}
              onInit={onFlowInstanceChange}
              onNodesChange={handleNodesChange}
              onNodeDragStop={handleNodeDragStop}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onEdgeMouseEnter={handleEdgeMouseEnter}
              onEdgeMouseLeave={handleEdgeMouseLeave}
              onPaneClick={handlePaneClick}
              minZoom={0.2}
              maxZoom={1.5}
              proOptions={PRO_OPTIONS}>
              <Background
                gap={24}
                size={1}
                variant={BackgroundVariant.Dots}
                color='rgba(31, 41, 55, 0.12)'
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </CanvasContext.Provider>
    </>
  )
})

DevtoolsGraphCanvas.displayName = 'DevtoolsGraphCanvas'
