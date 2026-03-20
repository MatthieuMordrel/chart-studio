import '@xyflow/react/dist/base.css'
import {
  createContext,
  startTransition,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {CSSProperties} from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import type {ChartStudioDevtoolsContextSnapshot} from '@matthieumordrel/chart-studio/_internal'
import {computeGraphLayout, DEVTOOLS_NODE_WIDTH, DEVTOOLS_VISIBLE_FIELD_COUNT} from './layout.js'
import {normalizeSource} from './normalize.js'
import {DEVTOOLS_STYLES} from './styles.js'
import {DevtoolsDataViewer} from './devtools-data-viewer.js'
import {ColumnTypeIcon} from './column-type-icon.js'
import {useDevtoolsSources} from './use-devtools-sources.js'
import type {
  ChartStudioDevtoolsProps,
  NormalizedEdgeVm,
  NormalizedNodeVm,
  NormalizedSourceVm,
  SearchItemVm,
} from './types.js'

type FlowNode = Node<{nodeId: string}, 'semantic-node'>
type FlowEdge = Edge<{edgeId: string}, 'semantic-edge'>

type ViewerState = {
  nodeId: string
  mode: 'inspect' | 'explore'
  scope: 'raw' | 'effective'
  viewMode: 'table' | 'json'
}

type CanvasContextValue = {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
  edgeHighlightFieldIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>
  expandedNodeIds: ReadonlySet<string>
  focusedEdgeIds: ReadonlySet<string>
  focusedFieldId: string | null
  focusedNodeIds: ReadonlySet<string>
  issuesByTargetId: ReadonlyMap<string, readonly string[]>
  onInspectNode(nodeId: string): void
  onExploreNode(nodeId: string): void
  onSelectEdge(edgeId: string): void
  onSelectNode(nodeId: string, fieldId?: string): void
  onToggleNodeExpand(nodeId: string): void
  selectedEdgeId: string | null
  selectedNodeId: string | null
  source: NormalizedSourceVm
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

function useCanvasContext(): CanvasContextValue {
  const value = useContext(CanvasContext)

  if (!value) {
    throw new Error('ChartStudioDevtools canvas context is missing.')
  }

  return value
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

function getNodeRows(
  node: NormalizedNodeVm,
  context: ChartStudioDevtoolsContextSnapshot | null,
  scope: 'raw' | 'effective',
): readonly Record<string, unknown>[] {
  if (scope === 'raw' || !context) {
    return node.rawRows
  }

  return context.effectiveDatasets?.[node.datasetId]
    ?? context.effectiveMaterializedViews?.[node.datasetId]
    ?? node.rawRows
}

function SemanticNode({
  data,
}: NodeProps<FlowNode>) {
  const ctx = useCanvasContext()
  const node = ctx.source.nodeMap.get(data.nodeId)

  if (!node) {
    return null
  }

  const expanded = ctx.expandedNodeIds.has(node.id)
  const visibleFields = expanded
    ? node.fields
    : node.fields.slice(0, DEVTOOLS_VISIBLE_FIELD_COUNT)
  const issueMessages = ctx.issuesByTargetId.get(node.id) ?? []
  const isSelected = ctx.selectedNodeId === node.id
  const isFocused = ctx.focusedNodeIds.has(node.id)
  const isDimmed = ctx.focusedNodeIds.size > 0 && !isFocused
  const edgeHighlightFieldIds = ctx.edgeHighlightFieldIdsByNodeId.get(node.id)

  return (
    <div
      className={[
        'csdt-node',
        node.kind === 'materialized-view' ? 'is-materialized' : undefined,
        isSelected ? 'is-selected' : undefined,
        isFocused ? 'is-focused' : undefined,
        isDimmed ? 'is-dimmed' : undefined,
      ].filter(Boolean).join(' ')}>
      <div className='csdt-node__hero'>
        <div className='csdt-node__meta'>
          <span className='csdt-node__type'>
            {node.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}
          </span>
          {issueMessages.length > 0 && (
            <span className='csdt-node__issue-count'>{issueMessages.length}</span>
          )}
        </div>
        <h3>{node.label}</h3>
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
              'csdt-field',
              ctx.focusedFieldId === field.id && isSelected ? 'is-field-focused' : undefined,
              edgeHighlightFieldIds?.has(field.id) ? 'is-edge-highlight' : undefined,
            ].filter(Boolean).join(' ')}
            onClick={() => ctx.onSelectNode(node.id, field.id)}>
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
              {field.isPrimaryKey && <span className='csdt-badge'>PK</span>}
              {field.isForeignKey && <span className='csdt-badge'>FK</span>}
              {field.isAssociationField && <span className='csdt-badge'>N:N</span>}
              {field.isDerived && <span className='csdt-badge'>Derived</span>}
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

      <div className='csdt-node__footer'>
        <button type='button' className='nodrag' onClick={() => ctx.onInspectNode(node.id)}>
          Inspect
        </button>
        <button type='button' className='nodrag' onClick={() => ctx.onExploreNode(node.id)}>
          Explore
        </button>
        {node.fields.length > DEVTOOLS_VISIBLE_FIELD_COUNT && (
          <button type='button' className='nodrag' onClick={() => ctx.onToggleNodeExpand(node.id)}>
            {expanded ? 'Collapse' : `+${node.fields.length - DEVTOOLS_VISIBLE_FIELD_COUNT} more`}
          </button>
        )}
      </div>
    </div>
  )
}

function SemanticEdge({
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

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 28,
    offset: 18,
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
}

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

function buildFlowNodes(
  source: NormalizedSourceVm,
  positions: Record<string, {x: number; y: number}>,
): FlowNode[] {
  return source.nodes.map((node) => ({
    id: node.id,
    type: 'semantic-node',
    position: positions[node.id] ?? {x: 0, y: 0},
    draggable: true,
    selectable: true,
    data: {nodeId: node.id},
    width: DEVTOOLS_NODE_WIDTH,
  }))
}

function buildFlowEdges(
  source: NormalizedSourceVm,
): FlowEdge[] {
  return source.edges.map((edge) => ({
    id: edge.id,
    type: 'semantic-edge',
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandleId,
    targetHandle: edge.targetHandleId,
    selectable: true,
    data: {edgeId: edge.id},
    markerStart: edge.kind === 'association' ? 'url(#csdt-marker-many)' : undefined,
    markerEnd: edge.kind === 'association'
      ? 'url(#csdt-marker-many)'
      : edge.kind === 'materialization'
        ? 'url(#csdt-marker-lineage)'
        : 'url(#csdt-marker-many)',
  }))
}

/**
 * Maps each endpoint node id to field ids that participate in the selected edge
 * (for row highlighting on the canvas).
 */
function computeEdgeFieldHighlights(
  selectedEdgeId: string | null,
  source: NormalizedSourceVm,
): ReadonlyMap<string, ReadonlySet<string>> {
  if (!selectedEdgeId) {
    return new Map()
  }

  const edge = source.edgeMap.get(selectedEdgeId)

  if (!edge) {
    return new Map()
  }

  const byNode = new Map<string, Set<string>>()

  /**
   * @param nodeId - Dataset / view node id
   * @param fieldId - Column id on that node
   */
  function addField(nodeId: string, fieldId: string) {
    let set = byNode.get(nodeId)

    if (!set) {
      set = new Set()
      byNode.set(nodeId, set)
    }

    set.add(fieldId)
  }

  if (edge.kind === 'relationship' || edge.kind === 'association') {
    addField(edge.sourceNodeId, edge.fromFieldId)
    addField(edge.targetNodeId, edge.toFieldId)
  } else if (edge.kind === 'materialization') {
    const sourceFieldId = edge.sourceHandleId.endsWith('::out')
      ? edge.sourceHandleId.slice(0, -'::out'.length)
      : edge.sourceHandleId

    addField(edge.sourceNodeId, sourceFieldId)

    if (edge.projectedFieldIds.length > 0) {
      for (const fieldId of edge.projectedFieldIds) {
        addField(edge.targetNodeId, fieldId)
      }
    } else {
      const targetFieldId = edge.targetHandleId.endsWith('::in')
        ? edge.targetHandleId.slice(0, -'::in'.length)
        : edge.targetHandleId

      addField(edge.targetNodeId, targetFieldId)
    }
  }

  return new Map([...byNode.entries()].map(([id, set]) => [id, set]))
}

function findFocusSets(
  source: NormalizedSourceVm,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
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
    const connectedEdges = source.edges.filter((edge) =>
      edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId,
    )

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

function SelectionPanel({
  activeContext,
  focusedFieldId,
  onExploreNode,
  onInspectNode,
  selectedEdgeId,
  selectedNodeId,
  source,
}: {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
  focusedFieldId: string | null
  onExploreNode(nodeId: string): void
  onInspectNode(nodeId: string): void
  selectedEdgeId: string | null
  selectedNodeId: string | null
  source: NormalizedSourceVm
}) {
  const selectedNode = selectedNodeId ? source.nodeMap.get(selectedNodeId) ?? null : null
  const selectedEdge = selectedEdgeId ? source.edgeMap.get(selectedEdgeId) ?? null : null

  if (selectedNode) {
    const effectiveRows = getNodeRows(selectedNode, activeContext, 'effective')

    return (
      <section className='csdt-sidepanel'>
        <div className='csdt-sidepanel__header'>
          <p className='csdt-kicker'>{selectedNode.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}</p>
          <h3>{selectedNode.label}</h3>
          <p className='csdt-muted'>
            {selectedNode.rowCount.toLocaleString()} raw rows · {effectiveRows.length.toLocaleString()} effective
          </p>
        </div>

        <div className='csdt-sidepanel__actions'>
          <button type='button' onClick={() => onInspectNode(selectedNode.id)}>Inspect</button>
          <button type='button' onClick={() => onExploreNode(selectedNode.id)}>Explore</button>
        </div>

        <div className='csdt-sidepanel__section'>
          <h4>Attributes</h4>
          {selectedNode.attributeIds.length
            ? selectedNode.attributeIds.map((attributeId) => (
              <span key={attributeId} className='csdt-attribute-chip'>
                {attributeId}
              </span>
            ))
            : <p className='csdt-muted'>None</p>}
        </div>

        <div className='csdt-sidepanel__section'>
          <h4>Schema</h4>
          <div className='csdt-sidepanel__field-list'>
            {selectedNode.fields.map((field) => (
              <div
                key={field.id}
                className={[
                  'csdt-sidepanel__field',
                  focusedFieldId === field.id ? 'is-focused' : undefined,
                ].filter(Boolean).join(' ')}>
                <div className='csdt-sidepanel__field-label'>
                  <ColumnTypeIcon type={field.type} />
                  <strong>{field.label}</strong>
                </div>
                <div className='csdt-field__badges'>
                  {field.isPrimaryKey && <span className='csdt-badge'>PK</span>}
                  {field.isForeignKey && <span className='csdt-badge'>FK</span>}
                  {field.isAssociationField && <span className='csdt-badge'>N:N</span>}
                  {field.isDerived && <span className='csdt-badge'>Derived</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (selectedEdge) {
    return (
      <section className='csdt-sidepanel'>
        <div className='csdt-sidepanel__header'>
          <p className='csdt-kicker'>{selectedEdge.kind}</p>
          <h3>{selectedEdge.label}</h3>
        </div>

        {selectedEdge.kind === 'relationship' && (
          <div className='csdt-sidepanel__section'>
            <h4>Relationship</h4>
            <p>{selectedEdge.fromDatasetId}.{selectedEdge.fromFieldId} → {selectedEdge.toDatasetId}.{selectedEdge.toFieldId}</p>
            <p className='csdt-muted'>{selectedEdge.inferred ? 'Inferred at runtime' : 'Declared explicitly'}</p>
          </div>
        )}

        {selectedEdge.kind === 'association' && (
          <>
            <div className='csdt-sidepanel__section'>
              <h4>Association</h4>
              <p>{selectedEdge.fromDatasetId}.{selectedEdge.fromFieldId} ↔ {selectedEdge.toDatasetId}.{selectedEdge.toFieldId}</p>
              <p className='csdt-muted'>
                {selectedEdge.backing === 'explicit'
                  ? 'Backed by explicit edge rows'
                  : `Derived from ${selectedEdge.derivedFromDatasetId}`}
              </p>
            </div>

            <div className='csdt-sidepanel__section'>
              <h4>Preview</h4>
              {selectedEdge.previewPairs.length
                ? selectedEdge.previewPairs.map((pair, index) => (
                  <div key={`${pair.from}:${pair.to}:${index}`} className='csdt-preview-row'>
                    <span>{pair.from}</span>
                    <span>{pair.to}</span>
                  </div>
                ))
                : <p className='csdt-muted'>No generated pairs available.</p>}
            </div>
          </>
        )}

        {selectedEdge.kind === 'materialization' && (
          <div className='csdt-sidepanel__section'>
            <h4>Materialization lineage</h4>
            <p>{selectedEdge.sourceNodeId} → {selectedEdge.viewId}</p>
            <p className='csdt-muted'>{selectedEdge.projectedFieldIds.join(', ')}</p>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className='csdt-sidepanel is-empty'>
      <p className='csdt-muted'>Select an element to inspect.</p>
    </section>
  )
}

export function ChartStudioDevtools(props: ChartStudioDevtoolsProps) {
  const sources = useDevtoolsSources(props)
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false)
  const [pausedSources, setPausedSources] = useState<typeof sources | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [showIssues, setShowIssues] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set())
  const [layoutNonce, setLayoutNonce] = useState(0)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)
  const visibleSources = pausedSources ?? sources
  const activeSource = useMemo(
    () => visibleSources.find((source) => source.id === selectedSourceId) ?? visibleSources[0] ?? null,
    [selectedSourceId, visibleSources],
  )
  const normalizedSource = useMemo(
    () => activeSource ? normalizeSource(activeSource) : null,
    [activeSource],
  )
  const activeContext = useMemo(
    () => normalizedSource?.contexts.find((context) => context.id === selectedContextId)
      ?? normalizedSource?.contexts[0]
      ?? null,
    [normalizedSource, selectedContextId],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const positionsRef = useRef<Record<string, {x: number; y: number}>>({})

  useEffect(() => {
    if (!isOpen) {
      return
    }

    /**
     * Escape closes nested UI first (data viewer, issues drawer), then the devtools shell.
     * Uses capture so React Flow / host app handlers do not swallow the key.
     */
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      if (viewer) {
        setViewer(null)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (showIssues) {
        setShowIssues(false)
        event.preventDefault()
        event.stopPropagation()
        return
      }

      setIsOpen(false)
      setViewer(null)
      setShowIssues(false)
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('keydown', onDocumentKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true)
    }
  }, [isOpen, showIssues, viewer])

  useEffect(() => {
    if (!activeSource && selectedSourceId) {
      setSelectedSourceId(null)
    }
  }, [activeSource, selectedSourceId])

  useEffect(() => {
    if (activeSource && selectedSourceId == null) {
      setSelectedSourceId(activeSource.id)
    }
  }, [activeSource, selectedSourceId])

  useEffect(() => {
    if (normalizedSource && !activeContext) {
      setSelectedContextId(normalizedSource.contexts[0]?.id ?? null)
    }
  }, [activeContext, normalizedSource])

  useEffect(() => {
    if (!normalizedSource) {
      setNodes([])
      setEdges([])
      positionsRef.current = {}
      return
    }

    setEdges(buildFlowEdges(normalizedSource))
  }, [normalizedSource, setEdges])

  useEffect(() => {
    if (!normalizedSource) {
      return
    }

    let cancelled = false

    void computeGraphLayout(normalizedSource, expandedNodeIds).then((positions) => {
      if (cancelled) {
        return
      }

      positionsRef.current = positions
      startTransition(() => {
        setNodes(buildFlowNodes(normalizedSource, positions))
      })
    })

    return () => {
      cancelled = true
    }
  }, [expandedNodeIds, layoutNonce, normalizedSource, setNodes])

  const issuesByTargetId = useMemo(() => {
    if (!normalizedSource) {
      return new Map<string, readonly string[]>()
    }

    return normalizedSource.issues.reduce((map, issue) => {
      const existing = map.get(issue.targetId) ?? []
      map.set(issue.targetId, [...existing, issue.message])
      return map
    }, new Map<string, readonly string[]>())
  }, [normalizedSource])

  const {focusedEdgeIds, focusedNodeIds} = useMemo(
    () => normalizedSource
      ? findFocusSets(normalizedSource, selectedNodeId, selectedEdgeId)
      : {focusedEdgeIds: new Set<string>(), focusedNodeIds: new Set<string>()},
    [normalizedSource, selectedEdgeId, selectedNodeId],
  )

  const edgeFieldHighlights = useMemo(
    () => normalizedSource
      ? computeEdgeFieldHighlights(selectedEdgeId, normalizedSource)
      : new Map<string, ReadonlySet<string>>(),
    [normalizedSource, selectedEdgeId],
  )

  useEffect(() => {
    if (!normalizedSource || !selectedEdgeId) {
      return
    }

    const highlights = computeEdgeFieldHighlights(selectedEdgeId, normalizedSource)

    setExpandedNodeIds((current) => {
      let next: Set<string> | null = null

      for (const [nodeId, fieldIds] of highlights) {
        const node = normalizedSource.nodeMap.get(nodeId)

        if (!node) {
          continue
        }

        for (const fieldId of fieldIds) {
          const fieldIndex = node.fields.findIndex((field) => field.id === fieldId)

          if (fieldIndex === -1) {
            continue
          }

          if (fieldIndex >= DEVTOOLS_VISIBLE_FIELD_COUNT && !current.has(nodeId)) {
            if (!next) {
              next = new Set(current)
            }

            next.add(nodeId)
          }
        }
      }

      return next ?? current
    })
  }, [normalizedSource, selectedEdgeId])

  const searchResults = useMemo(() => {
    if (!normalizedSource || deferredSearchQuery.trim().length === 0) {
      return []
    }

    const query = deferredSearchQuery.trim().toLowerCase()

    return normalizedSource.searchItems
      .filter((item) =>
        item.label.toLowerCase().includes(query)
        || item.description.toLowerCase().includes(query),
      )
      .slice(0, 14)
  }, [deferredSearchQuery, normalizedSource])

  const canvasContextValue = useMemo<CanvasContextValue | null>(() => {
    if (!normalizedSource) {
      return null
    }

    return {
      activeContext,
      edgeHighlightFieldIdsByNodeId: edgeFieldHighlights,
      expandedNodeIds,
      focusedEdgeIds,
      focusedFieldId: selectedFieldId,
      focusedNodeIds,
      issuesByTargetId,
      onInspectNode(nodeId) {
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setViewer({
          nodeId,
          mode: 'inspect',
          scope: 'raw',
          viewMode: 'table',
        })
      },
      onExploreNode(nodeId) {
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setViewer({
          nodeId,
          mode: 'explore',
          scope: 'raw',
          viewMode: 'table',
        })
      },
      onSelectEdge(edgeId) {
        setSelectedEdgeId(edgeId)
        setSelectedNodeId(null)
        setSelectedFieldId(null)
      },
      onSelectNode(nodeId, fieldId) {
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setSelectedFieldId(fieldId ?? null)
      },
      onToggleNodeExpand(nodeId) {
        setExpandedNodeIds((current) => {
          const next = new Set(current)

          if (next.has(nodeId)) {
            next.delete(nodeId)
          } else {
            next.add(nodeId)
          }

          return next
        })
      },
      selectedEdgeId,
      selectedNodeId,
      source: normalizedSource,
    }
  }, [
    activeContext,
    edgeFieldHighlights,
    expandedNodeIds,
    focusedEdgeIds,
    focusedNodeIds,
    issuesByTargetId,
    normalizedSource,
    selectedEdgeId,
    selectedFieldId,
    selectedNodeId,
  ])

  function focusSearchItem(item: SearchItemVm) {
    if (item.edgeId) {
      setSelectedEdgeId(item.edgeId)
      setSelectedNodeId(null)
      setSelectedFieldId(null)
    } else if (item.nodeId) {
      setSelectedNodeId(item.nodeId)
      setSelectedEdgeId(null)
      setSelectedFieldId(item.fieldId ?? null)
    }

    setSearchQuery('')

    const targetNodeId = item.nodeId
      ?? normalizedSource?.edgeMap.get(item.edgeId ?? '')?.sourceNodeId

    if (!targetNodeId) {
      return
    }

    const targetNode = nodes.find((node) => node.id === targetNodeId)
    if (!targetNode || !flowInstance) {
      return
    }

    void flowInstance.setCenter(
      targetNode.position.x + (DEVTOOLS_NODE_WIDTH / 2),
      targetNode.position.y + 180,
      {
        zoom: 0.9,
        duration: 360,
      },
    )
  }

  function togglePause() {
    if (pausedSources) {
      setPausedSources(null)
      return
    }

    setPausedSources(sources)
  }

  function resetLayout() {
    startTransition(() => {
      setLayoutNonce((current) => current + 1)
    })

    window.setTimeout(() => {
      void flowInstance?.fitView({
        padding: 0.18,
        duration: 280,
      })
    }, 80)
  }

  const viewerNode = viewer && normalizedSource
    ? normalizedSource.nodeMap.get(viewer.nodeId) ?? null
    : null
  const viewerRows = viewerNode && viewer
    ? getNodeRows(viewerNode, activeContext, viewer.scope)
    : []

  return (
    <>
      <style>{DEVTOOLS_STYLES}</style>
      <MarkerDefs />

      {!isOpen && (
        <button
          type='button'
          className='csdt-launcher'
          onClick={() => setIsOpen(true)}>
          <svg className='csdt-launcher__logo' viewBox='0 0 20 20' fill='none' aria-hidden='true'>
            <rect x='2' y='11' width='4' height='7' rx='1' fill='currentColor' opacity='0.35' />
            <rect x='8' y='7' width='4' height='11' rx='1' fill='currentColor' opacity='0.55' />
            <rect x='14' y='3' width='4' height='15' rx='1' fill='currentColor' opacity='0.85' />
            <path d='M4 10 L10 5.5 L16 2' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' opacity='0.9' />
          </svg>
          <span className='csdt-launcher__text'>
            <span>Chart Studio</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className='csdt-shell'
          style={
            {
              '--csdt-node-width': `${DEVTOOLS_NODE_WIDTH}px`,
            } as CSSProperties
          }>
          <div className='csdt-shell__scrim' onClick={() => setIsOpen(false)} />
          <section className='csdt-shell__workspace'>
            <header className='csdt-header'>
              <div className='csdt-header__cluster'>
                <div className='csdt-header__title'>
                  <h1>{normalizedSource?.label ?? 'Chart Studio Devtools'}</h1>
                </div>

                <div className='csdt-header__controls'>
                  {visibleSources.length > 1 && (
                    <select
                      value={activeSource?.id ?? ''}
                      onChange={(event) => setSelectedSourceId(event.target.value)}>
                      {visibleSources.map((source) => (
                        <option key={source.id} value={source.id}>{source.label}</option>
                      ))}
                    </select>
                  )}

                  <select
                    value={activeContext?.id ?? ''}
                    onChange={(event) => setSelectedContextId(event.target.value)}
                    disabled={!normalizedSource || normalizedSource.contexts.length === 0}>
                    {normalizedSource?.contexts.map((context) => (
                      <option key={context.id} value={context.id}>
                        {context.label}
                      </option>
                    ))}
                  </select>

                  <div className='csdt-search'>
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder='Search…'
                    />

                    {searchResults.length > 0 && (
                      <div className='csdt-search__results'>
                        {searchResults.map((item) => (
                          <button
                            key={item.id}
                            type='button'
                            className='csdt-search__item'
                            onClick={() => focusSearchItem(item)}>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button type='button' onClick={togglePause}>
                    {pausedSources ? 'Resume' : 'Pause'}
                  </button>
                  <button type='button' onClick={resetLayout}>Reset layout</button>
                  <button type='button' onClick={() => setShowIssues((current) => !current)}>
                    Issues ({normalizedSource?.issues.length ?? 0})
                  </button>
                  <button type='button' onClick={() => setIsOpen(false)}>Close</button>
                </div>
              </div>
            </header>

            {!normalizedSource || !canvasContextValue
              ? (
                <div className='csdt-empty-state'>
                  <h2>No live snapshot</h2>
                  <p>
                    Mount the devtools inside an app that uses <code>useDashboard()</code>, or pass
                    a <code>getSnapshot()</code> prop.
                  </p>
                </div>
              )
              : (
                <div className='csdt-workspace'>
                  <CanvasContext.Provider value={canvasContextValue}>
                    <div className='csdt-canvas'>
                      <ReactFlowProvider>
                        <ReactFlow
                          fitView
                          nodes={nodes}
                          edges={edges}
                          nodeTypes={{'semantic-node': SemanticNode}}
                          edgeTypes={{'semantic-edge': SemanticEdge}}
                          nodesConnectable={false}
                          onInit={setFlowInstance}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                          onNodeClick={(_, node: FlowNode) => {
                            setSelectedNodeId(node.id)
                            setSelectedEdgeId(null)
                            setSelectedFieldId(null)
                          }}
                          onEdgeClick={(_, edge: FlowEdge) => {
                            setSelectedEdgeId(edge.id)
                            setSelectedNodeId(null)
                            setSelectedFieldId(null)
                          }}
                          minZoom={0.2}
                          maxZoom={1.5}
                          proOptions={{hideAttribution: true}}>
                          <Background
                            gap={24}
                            size={1}
                            variant={BackgroundVariant.Dots}
                            color='rgba(31, 41, 55, 0.12)'
                          />
                        </ReactFlow>
                      </ReactFlowProvider>
                    </div>

                    <SelectionPanel
                      activeContext={activeContext}
                      focusedFieldId={selectedFieldId}
                      onExploreNode={(nodeId) => canvasContextValue.onExploreNode(nodeId)}
                      onInspectNode={(nodeId) => canvasContextValue.onInspectNode(nodeId)}
                      selectedEdgeId={selectedEdgeId}
                      selectedNodeId={selectedNodeId}
                      source={normalizedSource}
                    />
                  </CanvasContext.Provider>
                </div>
              )}

            {showIssues && normalizedSource && (
              <aside className='csdt-issues-drawer'>
                <div className='csdt-issues-drawer__header'>
                  <h3>Issues</h3>
                  <button type='button' onClick={() => setShowIssues(false)}>Close</button>
                </div>

                {normalizedSource.issues.length === 0
                  ? <p className='csdt-muted'>No issues in the current snapshot.</p>
                  : normalizedSource.issues.map((issue) => (
                    <div key={issue.id} className={`csdt-issue-row is-${issue.severity}`}>
                      <div>
                        <strong>{issue.message}</strong>
                        <small>{issue.scope} · {issue.targetId}</small>
                      </div>
                      <button
                        type='button'
                        onClick={() => {
                          if (normalizedSource.nodeMap.has(issue.targetId)) {
                            setSelectedNodeId(issue.targetId)
                            setSelectedEdgeId(null)
                            return
                          }

                          if (normalizedSource.edgeMap.has(issue.targetId)) {
                            setSelectedEdgeId(issue.targetId)
                            setSelectedNodeId(null)
                          }
                        }}>
                        Jump
                      </button>
                    </div>
                  ))}
              </aside>
            )}
          </section>

          {viewer && viewerNode && (
            <DevtoolsDataViewer
              context={activeContext}
              mode={viewer.mode}
              node={viewerNode}
              onClose={() => setViewer(null)}
              onModeChange={(mode) => setViewer((current) => current ? {...current, mode} : current)}
              onScopeChange={(scope) => setViewer((current) => current ? {...current, scope} : current)}
              onViewModeChange={(viewMode) => setViewer((current) => current ? {...current, viewMode} : current)}
              rows={viewerRows}
              scope={viewer.scope}
              viewMode={viewer.viewMode}
            />
          )}
        </div>
      )}
    </>
  )
}
