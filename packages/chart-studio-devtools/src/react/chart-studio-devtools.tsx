import '@xyflow/react/dist/base.css'
import {
  useDocumentEvent,
  type ChartStudioDevtoolsContextSnapshot,
} from '@matthieumordrel/chart-studio/_internal'
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
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import {ElkLayoutPanel} from './devtools-elk-layout-panel.js'
import {
  applyFlowNodePositionChanges,
  buildFlowEdges,
  buildFlowNodes,
  type FlowEdge,
  type FlowNode,
} from './graph-state.js'
import {
  getCollapsedVisibleFields,
  getMaterializedViewJoinProjectedFields,
  isMaterializedViewJoinOrKeyField,
  isMaterializedViewJoinProjectedField,
} from './graph-field-visibility.js'
import {useMvJoinKeyClickRevealForSelection} from './use-mv-join-key-click-reveal.js'
import {computeGraphLayout, DEVTOOLS_NODE_WIDTH} from './layout.js'
import {
  adjustDevtoolsLayoutForEdgeDensity,
  loadStoredDevtoolsElkLayout,
  persistDevtoolsElkLayout,
  type DevtoolsElkLayoutConfig,
} from './layout-options.js'
import {filterGraphVisibleSource, normalizeSource} from './normalize.js'
import {lockDocumentScroll} from './scroll-lock.js'
import {DEVTOOLS_STYLES} from './styles.js'
import {DevtoolsDataViewer} from './devtools-data-viewer.js'
import {ArrowUpRight, ChevronDown, ChevronUp} from 'lucide-react'
import {ColumnTypeIcon} from './column-type-icon.js'
import {useDevtoolsSources} from './use-devtools-sources.js'
import {
  FieldRoleBadges,
  SelectionPanel,
  formatBytes,
  getNodeRows,
} from './devtools-details.js'
import {
  computeEdgeFieldHighlights,
  findFocusSets,
} from './selection-utils.js'
import type {
  ChartStudioDevtoolsProps,
  NormalizedEdgeVm,
  NormalizedSourceVm,
  SearchItemVm,
} from './types.js'

/** Base `getSmoothStepPath` offset (matches previous single-edge default). */
const SMOOTH_STEP_OFFSET_BASE = 14
/** Extra offset per additional edge between the same two nodes (staggered paths). */
const SMOOTH_STEP_OFFSET_STRIDE = 12

/**
 * Viewport margin when fitting the graph (React Flow `fitView` padding). Lower = tighter fit /
 * larger default zoom; was 0.22 and left noticeable empty bands on wide layouts.
 */
const FIT_VIEW_PADDING = 0.06

type ViewerState = {
  nodeId: string
  /** Paginated grid, chart explore UI, or JSON (one control in the viewer header). */
  dataView: 'table' | 'explore' | 'json'
  scope: 'raw' | 'effective'
}

type CanvasContextValue = {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
  edgeHighlightFieldIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>
  expandedNodeIds: ReadonlySet<string>
  focusedEdgeIds: ReadonlySet<string>
  focusedFieldId: string | null
  focusedNodeIds: ReadonlySet<string>
  issuesByTargetId: ReadonlyMap<string, readonly string[]>
  /** Manual ∪ auto: MV join/key overflow is visible (beyond the first cap of join/key rows). */
  mvJoinKeyOverflowRevealedIds: ReadonlySet<string>
  onInspectNode(nodeId: string): void
  onSelectEdge(edgeId: string): void
  onSelectNode(nodeId: string, fieldId?: string): void
  onToggleNodeExpand(nodeId: string): void
  selectedEdgeId: string | null
  selectedNodeId: string | null
  source: NormalizedSourceVm
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

const SHOW_MATERIALIZED_VIEWS_STORAGE_KEY = 'chart-studio-devtools:show-materialized-views-v1'

/**
 * @returns Whether MV nodes should appear on the graph (persisted preference, default true)
 */
function loadShowMaterializedViews(): boolean {
  if (typeof localStorage === 'undefined') {
    return true
  }

  try {
    const raw = localStorage.getItem(SHOW_MATERIALIZED_VIEWS_STORAGE_KEY)

    if (raw === null) {
      return true
    }

    return raw === 'true'
  } catch {
    return true
  }
}

/**
 * @param show - Persisted for the next devtools session
 */
function persistShowMaterializedViews(show: boolean): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(SHOW_MATERIALIZED_VIEWS_STORAGE_KEY, show ? 'true' : 'false')
  } catch {
    // ignore quota / private mode
  }
}

function useCanvasContext(): CanvasContextValue {
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

function SemanticNode({
  data,
}: NodeProps<FlowNode>) {
  const ctx = useCanvasContext()
  const node = ctx.source.nodeMap.get(data.nodeId)

  if (!node) {
    return null
  }

  const expanded = ctx.expandedNodeIds.has(node.id)
  const collapsedFields = getCollapsedVisibleFields(node, ctx.source, {
    mvJoinKeyOverflowRevealed: ctx.mvJoinKeyOverflowRevealedIds.has(node.id),
  })
  const visibleFields = expanded ? node.fields : collapsedFields
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
        <div className='csdt-node__header-row'>
          <h3>{node.label}</h3>
          <div className='csdt-node__meta'>
            <span className='csdt-node__type'>
              {node.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}
            </span>
            {issueMessages.length > 0 && (
              <span className='csdt-node__issue-count'>{issueMessages.length}</span>
            )}
            <button
              type='button'
              className='csdt-node__inspect nodrag'
              title='Open data viewer'
              onClick={(event) => {
                event.stopPropagation()
                ctx.onInspectNode(node.id)
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
              ctx.focusedFieldId === field.id && isSelected ? 'is-field-focused' : undefined,
              edgeHighlightFieldIds?.has(field.id) ? 'is-edge-highlight' : undefined,
            ].filter(Boolean).join(' ')}
            onClick={(event) => {
              event.stopPropagation()
              ctx.onSelectNode(node.id, field.id)
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

      {(expanded || node.fields.length > collapsedFields.length) && (
        <button
          type='button'
          className='csdt-node__expand nodrag'
          onClick={(event) => {
            event.stopPropagation()
            ctx.onToggleNodeExpand(node.id)
          }}>
          {expanded
            ? <><ChevronUp size={12} /> Show less</>
            : <><ChevronDown size={12} /> {node.fields.length - collapsedFields.length} more fields</>}
        </button>
      )}
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

export function ChartStudioDevtools(props: ChartStudioDevtoolsProps) {
  const sources = useDevtoolsSources(props)
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false)
  const [pausedSources, setPausedSources] = useState<typeof sources | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [showIssues, setShowIssues] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set())
  const [elkLayoutConfig, setElkLayoutConfig] = useState<DevtoolsElkLayoutConfig>(loadStoredDevtoolsElkLayout)
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
  const [showMaterializedViews, setShowMaterializedViews] = useState(() => loadShowMaterializedViews())
  const displaySource = useMemo(
    () => (normalizedSource ? filterGraphVisibleSource(normalizedSource, showMaterializedViews) : null),
    [normalizedSource, showMaterializedViews],
  )
  /**
   * Keep layout anchored to the full normalized graph so hiding/showing materialized views
   * is a pure visibility toggle instead of a relayout trigger.
   */
  const layoutSource = normalizedSource
  const elkLayoutForComputation = useMemo(
    () =>
      layoutSource
        ? adjustDevtoolsLayoutForEdgeDensity(
            elkLayoutConfig,
            layoutSource.edges.length,
            layoutSource.nodes.length,
          )
        : elkLayoutConfig,
    [elkLayoutConfig, layoutSource],
  )
  /** Dashboard shared-filter scope only (see `useDashboard` devtools snapshot). */
  const activeContext = useMemo(
    () =>
      normalizedSource?.contexts.find((context) => context.kind === 'dashboard')
      ?? normalizedSource?.contexts[0]
      ?? null,
    [normalizedSource],
  )
  const currentSelectedNode = selectedNodeId && displaySource?.nodeMap.has(selectedNodeId)
    ? displaySource.nodeMap.get(selectedNodeId) ?? null
    : null
  const currentSelectedNodeId = currentSelectedNode?.id ?? null
  const currentSelectedFieldId = currentSelectedNode && selectedFieldId
    && currentSelectedNode.fields.some((field) => field.id === selectedFieldId)
    ? selectedFieldId
    : null
  const currentSelectedEdgeId = selectedEdgeId && displaySource?.edgeMap.has(selectedEdgeId)
    ? selectedEdgeId
    : null
  const currentViewer = viewer && displaySource?.nodeMap.has(viewer.nodeId)
    ? viewer
    : null

  const {mvJoinKeyClickRevealNodeId, setMvJoinKeyClickRevealNodeId} = useMvJoinKeyClickRevealForSelection(
    currentSelectedNodeId,
  )

  const manualExpandedNodeIds = useMemo(() => {
    if (!displaySource) {
      return new Set<string>()
    }

    return new Set(
      [...expandedNodeIds].filter((id) => displaySource.nodeMap.has(id)),
    )
  }, [displaySource, expandedNodeIds])
  const [nodePositions, setNodePositions] = useState<Record<string, {x: number; y: number}>>({})
  const layoutRunIdRef = useRef(0)
  const fitViewAfterLayoutRef = useRef(false)
  const fitViewFrameRef = useRef<number | null>(null)

  useDocumentEvent('keydown', (event) => {
    /**
     * Escape closes nested UI first (data viewer, issues drawer), then the devtools shell.
     * Uses capture so React Flow / host app handlers do not swallow the key.
     */
    if (event.key !== 'Escape') {
      return
    }

    if (currentViewer) {
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
  }, true, isOpen)

  /**
   * Chart UI dropdowns portal to `document.body` with default z-index 40/50.
   * Devtools shells use ~2^31 z-index so those panels would render underneath;
   * raise the stacking variables while the shell is open.
   */
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const root = document.documentElement

    root.style.setProperty('--cs-chart-dropdown-backdrop-z-index', '2147483002')
    root.style.setProperty('--cs-chart-dropdown-panel-z-index', '2147483003')

    return () => {
      root.style.removeProperty('--cs-chart-dropdown-backdrop-z-index')
      root.style.removeProperty('--cs-chart-dropdown-panel-z-index')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    return lockDocumentScroll()
  }, [isOpen])

  const issuesByTargetId = useMemo(() => {
    if (!displaySource) {
      return new Map<string, readonly string[]>()
    }

    return displaySource.issues.reduce((map, issue) => {
      const existing = map.get(issue.targetId) ?? []
      map.set(issue.targetId, [...existing, issue.message])
      return map
    }, new Map<string, readonly string[]>())
  }, [displaySource])

  const {focusedEdgeIds, focusedNodeIds} = useMemo(
    () => displaySource
      ? findFocusSets(displaySource, currentSelectedNodeId, currentSelectedEdgeId, currentSelectedFieldId)
      : {focusedEdgeIds: new Set<string>(), focusedNodeIds: new Set<string>()},
    [currentSelectedEdgeId, currentSelectedFieldId, currentSelectedNodeId, displaySource],
  )

  const edgeFieldHighlights = useMemo(
    () => displaySource
      ? computeEdgeFieldHighlights(currentSelectedEdgeId, currentSelectedNodeId, currentSelectedFieldId, displaySource)
      : new Map<string, ReadonlySet<string>>(),
    [currentSelectedEdgeId, currentSelectedFieldId, currentSelectedNodeId, displaySource],
  )
  const autoMaterializedViewJoinKeyRevealedIds = useMemo(() => {
    const next = new Set<string>()

    if (!displaySource || edgeFieldHighlights.size === 0) {
      return next
    }

    for (const [nodeId, fieldIds] of edgeFieldHighlights) {
      const node = displaySource.nodeMap.get(nodeId)

      if (!node || node.kind !== 'materialized-view' || mvJoinKeyClickRevealNodeId === nodeId) {
        continue
      }

      for (const fieldId of fieldIds) {
        const field = node.fields.find((candidate) => candidate.id === fieldId)

        if (field && isMaterializedViewJoinProjectedField(field)) {
          next.add(nodeId)
          break
        }
      }
    }

    return next
  }, [displaySource, edgeFieldHighlights, mvJoinKeyClickRevealNodeId])
  const visibleMvJoinKeyOverflowRevealedIds = useMemo(() => {
    const merged = new Set(autoMaterializedViewJoinKeyRevealedIds)

    if (mvJoinKeyClickRevealNodeId != null) {
      merged.add(mvJoinKeyClickRevealNodeId)
    }

    return merged
  }, [autoMaterializedViewJoinKeyRevealedIds, mvJoinKeyClickRevealNodeId])
  const autoExpandedNodeIds = useMemo(() => {
    if (!displaySource || edgeFieldHighlights.size === 0) {
      return new Set<string>()
    }

    const next = new Set<string>()

    for (const [nodeId, fieldIds] of edgeFieldHighlights) {
      const node = displaySource.nodeMap.get(nodeId)

      if (!node || manualExpandedNodeIds.has(nodeId)) {
        continue
      }

      const collapsedIds = new Set(
        getCollapsedVisibleFields(node, displaySource, {
          mvJoinKeyOverflowRevealed: visibleMvJoinKeyOverflowRevealedIds.has(nodeId),
        }).map((field) => field.id),
      )

      for (const fieldId of fieldIds) {
        if (!collapsedIds.has(fieldId)) {
          if (node.kind === 'materialized-view') {
            const field = node.fields.find((candidate) => candidate.id === fieldId)

            if (field && isMaterializedViewJoinOrKeyField(field)) {
              continue
            }
          }

          next.add(nodeId)
          break
        }
      }
    }

    return next
  }, [displaySource, edgeFieldHighlights, manualExpandedNodeIds, visibleMvJoinKeyOverflowRevealedIds])
  const visibleExpandedNodeIds = useMemo(() => {
    if (autoExpandedNodeIds.size === 0) {
      return manualExpandedNodeIds
    }

    return new Set([
      ...manualExpandedNodeIds,
      ...autoExpandedNodeIds,
    ])
  }, [autoExpandedNodeIds, manualExpandedNodeIds])

  useEffect(() => {
    if (fitViewFrameRef.current != null) {
      window.cancelAnimationFrame(fitViewFrameRef.current)
      fitViewFrameRef.current = null
    }

    if (!layoutSource) {
      fitViewAfterLayoutRef.current = false
      setNodePositions({})
      return
    }

    let cancelled = false
    const layoutRunId = ++layoutRunIdRef.current

    void computeGraphLayout(layoutSource, visibleExpandedNodeIds, elkLayoutForComputation).then((positions) => {
      if (cancelled || layoutRunId !== layoutRunIdRef.current) {
        return
      }

      startTransition(() => {
        setNodePositions(positions)
      })

      if (!fitViewAfterLayoutRef.current) {
        return
      }

      fitViewAfterLayoutRef.current = false
      fitViewFrameRef.current = window.requestAnimationFrame(() => {
        if (layoutRunId !== layoutRunIdRef.current) {
          return
        }

        void flowInstance?.fitView({
          padding: FIT_VIEW_PADDING,
          duration: 280,
        })
      })
    })

    return () => {
      cancelled = true
      if (fitViewFrameRef.current != null) {
        window.cancelAnimationFrame(fitViewFrameRef.current)
        fitViewFrameRef.current = null
      }
    }
  }, [elkLayoutForComputation, flowInstance, layoutNonce, layoutSource, visibleExpandedNodeIds])

  const searchResults = useMemo(() => {
    if (!displaySource || deferredSearchQuery.trim().length === 0) {
      return []
    }

    const query = deferredSearchQuery.trim().toLowerCase()

    return displaySource.searchItems
      .filter((item) =>
        item.label.toLowerCase().includes(query)
        || item.description.toLowerCase().includes(query),
      )
      .slice(0, 14)
  }, [deferredSearchQuery, displaySource])

  const flowNodes = useMemo(
    () => displaySource ? buildFlowNodes(displaySource, nodePositions, currentSelectedNodeId) : [],
    [currentSelectedNodeId, displaySource, nodePositions],
  )
  const flowEdges = useMemo(
    () => displaySource ? buildFlowEdges(displaySource, currentSelectedEdgeId) : [],
    [currentSelectedEdgeId, displaySource],
  )

  const canvasContextValue = useMemo<CanvasContextValue | null>(() => {
    if (!displaySource) {
      return null
    }

    return {
      activeContext,
      edgeHighlightFieldIdsByNodeId: edgeFieldHighlights,
      expandedNodeIds: visibleExpandedNodeIds,
      focusedEdgeIds,
      focusedFieldId: currentSelectedFieldId,
      focusedNodeIds,
      issuesByTargetId,
      mvJoinKeyOverflowRevealedIds: visibleMvJoinKeyOverflowRevealedIds,
      onInspectNode(nodeId) {
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setViewer({
          nodeId,
          dataView: 'table',
          scope: 'raw',
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
            setMvJoinKeyClickRevealNodeId((previous) => (previous === nodeId ? null : previous))
          } else {
            next.add(nodeId)
          }

          return next
        })
      },
      selectedEdgeId: currentSelectedEdgeId,
      selectedNodeId: currentSelectedNodeId,
      source: displaySource,
    }
  }, [
    activeContext,
    currentSelectedEdgeId,
    currentSelectedFieldId,
    currentSelectedNodeId,
    displaySource,
    edgeFieldHighlights,
    focusedEdgeIds,
    focusedNodeIds,
    issuesByTargetId,
    visibleExpandedNodeIds,
    visibleMvJoinKeyOverflowRevealedIds,
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
      ?? displaySource?.edgeMap.get(item.edgeId ?? '')?.sourceNodeId

    if (!targetNodeId) {
      return
    }

    const targetNode = flowNodes.find((node) => node.id === targetNodeId)
    if (!targetNode || !flowInstance) {
      return
    }

    void flowInstance.setCenter(
      targetNode.position.x + (DEVTOOLS_NODE_WIDTH / 2),
      targetNode.position.y + 150,
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

  /**
   * Clears expanded field rows, re-runs ELK via `layoutNonce`, and fits the viewport — same as
   * **Reset layout**, reused when toggling graph visibility (e.g. materialized views).
   */
  function applyLayoutResetAndFitView() {
    fitViewAfterLayoutRef.current = true

    startTransition(() => {
      setExpandedNodeIds(() => new Set())
      setMvJoinKeyClickRevealNodeId(null)
      setLayoutNonce((current) => current + 1)
    })
  }

  function resetLayout() {
    applyLayoutResetAndFitView()
  }

  const viewerNode = currentViewer && displaySource
    ? displaySource.nodeMap.get(currentViewer.nodeId) ?? null
    : null
  const viewerRows = viewerNode && currentViewer
    ? getNodeRows(viewerNode, activeContext, currentViewer.scope)
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
                  <label className='csdt-toggle'>
                    <input
                      type='checkbox'
                      checked={showMaterializedViews}
                      onChange={(event) => {
                        setShowMaterializedViews(event.target.checked)
                        persistShowMaterializedViews(event.target.checked)
                      }}
                    />
                    <span>Materialized views</span>
                  </label>
                  <button type='button' onClick={resetLayout}>Reset layout</button>
                  <button type='button' onClick={() => setShowIssues((current) => !current)}>
                    Issues ({displaySource?.issues.length ?? 0})
                  </button>
                  <button type='button' onClick={() => setIsOpen(false)}>Close</button>
                </div>
              </div>

              {normalizedSource && (
                <ElkLayoutPanel value={elkLayoutConfig} onChange={(config) => {
                  setElkLayoutConfig(config)
                  persistDevtoolsElkLayout(config)
                }} />
              )}
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
                          fitViewOptions={{padding: FIT_VIEW_PADDING}}
                          nodes={flowNodes}
                          edges={flowEdges}
                          nodeTypes={{'semantic-node': SemanticNode}}
                          edgeTypes={{'semantic-edge': SemanticEdge}}
                          nodesConnectable={false}
                          onInit={setFlowInstance}
                          onNodesChange={(changes) => {
                            if (!displaySource) {
                              return
                            }

                            setNodePositions((current) =>
                              applyFlowNodePositionChanges(current, changes, displaySource))
                          }}
                          onNodeClick={(_, node: FlowNode) => {
                            const n = displaySource?.nodeMap.get(node.id)

                            if (n?.kind === 'materialized-view') {
                              const joinProjected = getMaterializedViewJoinProjectedFields(n)

                              if (
                                joinProjected.length > 0
                                && !visibleMvJoinKeyOverflowRevealedIds.has(node.id)
                              ) {
                                setMvJoinKeyClickRevealNodeId(node.id)
                              }
                            }

                            setSelectedNodeId(node.id)
                            setSelectedEdgeId(null)
                            setSelectedFieldId(null)
                          }}
                          onEdgeClick={(_, edge: FlowEdge) => {
                            setSelectedEdgeId(edge.id)
                            setSelectedNodeId(null)
                            setSelectedFieldId(null)
                          }}
                          onPaneClick={() => {
                            setSelectedNodeId(null)
                            setSelectedEdgeId(null)
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
                      focusedFieldId={currentSelectedFieldId}
                      onInspectNode={(nodeId) => canvasContextValue.onInspectNode(nodeId)}
                      selectedEdgeId={currentSelectedEdgeId}
                      selectedNodeId={currentSelectedNodeId}
                      source={displaySource!}
                    />
                  </CanvasContext.Provider>
                </div>
              )}

            {showIssues && displaySource && (
              <aside className='csdt-issues-drawer'>
                <div className='csdt-issues-drawer__header'>
                  <h3>Issues</h3>
                  <button type='button' onClick={() => setShowIssues(false)}>Close</button>
                </div>

                {displaySource.issues.length === 0
                  ? <p className='csdt-muted'>No issues in the current snapshot.</p>
                  : displaySource.issues.map((issue) => (
                    <div key={issue.id} className={`csdt-issue-row is-${issue.severity}`}>
                      <div>
                        <strong>{issue.message}</strong>
                        <small>{issue.scope} · {issue.targetId}</small>
                      </div>
                      <button
                        type='button'
                        onClick={() => {
                          if (displaySource.nodeMap.has(issue.targetId)) {
                            setSelectedNodeId(issue.targetId)
                            setSelectedEdgeId(null)
                            return
                          }

                          if (displaySource.edgeMap.has(issue.targetId)) {
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

          {currentViewer && viewerNode && (
            <DevtoolsDataViewer
              key={`${currentViewer.nodeId}:${currentViewer.scope}:${currentViewer.dataView}`}
              context={activeContext}
              dataView={currentViewer.dataView}
              node={viewerNode}
              onClose={() => setViewer(null)}
              onDataViewChange={(dataView) => setViewer((current) => current ? {...current, dataView} : current)}
              onScopeChange={(scope) => setViewer((current) => current ? {...current, scope} : current)}
              rows={viewerRows}
              scope={currentViewer.scope}
            />
          )}
        </div>
      )}
    </>
  )
}
