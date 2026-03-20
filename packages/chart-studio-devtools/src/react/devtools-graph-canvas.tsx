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
  type FlowEdge,
  type FlowNode,
  type FlowNodePosition,
} from './graph-state.js'
import {
  getCollapsedVisibleFields,
  getMaterializedViewJoinProjectedFields,
} from './graph-field-visibility.js'
import {computeCanvasFieldOrderByNodeId} from './graph-field-layout.js'
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
  focusedEdgeIds: ReadonlySet<string>
  focusedFieldId: string | null
  focusedNodeIds: ReadonlySet<string>
  issuesByTargetId: ReadonlyMap<string, readonly string[]>
  /** Manual ∪ auto: MV join/key overflow is visible (beyond the first cap of join/key rows). */
  mvJoinKeyOverflowRevealedIds: ReadonlySet<string>
  onClearSelection(): void
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
  nodePositions: Readonly<Record<string, FlowNodePosition>>
  onFlowInstanceChange: Dispatch<SetStateAction<ReactFlowInstance<FlowNode, FlowEdge> | null>>
  onNodePositionsChange: Dispatch<SetStateAction<Record<string, FlowNodePosition>>>
  onRevealMaterializedViewFields(nodeId: string): void
}

type CanvasRenderContextValue = CanvasContextValue & {
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
  focusedFieldId: string | null
  isDimmed: boolean
  isDragging: boolean
  isFocused: boolean
  isSelected: boolean
  issueCount: number
  node: NormalizedNodeVm
  visibleFieldCount: number
  visibleFields: readonly NormalizedFieldVm[]
  onInspectNode(nodeId: string): void
  onSelectNode(nodeId: string, fieldId?: string): void
  onToggleNodeExpand(nodeId: string): void
}

const SemanticNodeCard = memo(function SemanticNodeCard({
  edgeHighlightFieldIds,
  expanded,
  focusedFieldId,
  isDimmed,
  isDragging,
  isFocused,
  isSelected,
  issueCount,
  node,
  visibleFieldCount,
  visibleFields,
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
              focusedFieldId === field.id && isSelected ? 'is-field-focused' : undefined,
              edgeHighlightFieldIds?.has(field.id) ? 'is-edge-highlight' : undefined,
            ].filter(Boolean).join(' ')}
            onClick={(event) => {
              event.stopPropagation()
              onSelectNode(node.id, field.id)
            }}>
            <Handle
              className='csdt-handle'
              position={Position.Left}
              type='target'
              id={field.targetHandleId}
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
              id={field.sourceHandleId}
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
      focusedFieldId={ctx.focusedFieldId}
      isDimmed={isDimmed}
      isDragging={dragging}
      isFocused={isFocused}
      isSelected={isSelected}
      issueCount={issueCount}
      node={node}
      visibleFieldCount={collapsedFields.length}
      visibleFields={visibleFields}
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

  const [path, labelX, labelY] = getSmoothStepPath({
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
          onClick={() => ctx.onSelectEdge(edge.id)}>
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
      previousExternalEdgesRef.current,
    )

    previousExternalEdgesRef.current = nextEdges

    return nextEdges
  }, [canvasContextValue.selectedEdgeId, displaySource])
  const [nodes, setNodes] = useState<FlowNode[]>(() => externalNodes)
  const nodesRef = useRef(nodes)
  const orderedFieldIdsByNodeId = useMemo(
    () => computeCanvasFieldOrderByNodeId(displaySource, nodePositions, canvasContextValue.expandedNodeIds),
    [canvasContextValue.expandedNodeIds, displaySource, nodePositions],
  )
  const renderContextValue = useMemo<CanvasRenderContextValue>(
    () => ({
      ...canvasContextValue,
      orderedFieldIdsByNodeId,
    }),
    [canvasContextValue, orderedFieldIdsByNodeId],
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

  return (
    <>
      <MarkerDefs />

      <CanvasContext.Provider value={renderContextValue}>
        <div className='csdt-canvas'>
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
