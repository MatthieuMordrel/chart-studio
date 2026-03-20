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
import type {CSSProperties, ReactNode} from 'react'
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
  getMaterializedViewJoinKeyFields,
  isMaterializedViewJoinOrKeyField,
  MV_JOIN_KEY_DEFAULT_CAP,
} from './graph-field-visibility.js'
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
import {ArrowUpRight, ChevronDown, ChevronRight, ChevronUp, Database, GitBranch, Layers, Link2, Workflow} from 'lucide-react'
import {ColumnTypeIcon} from './column-type-icon.js'
import {useDevtoolsSources} from './use-devtools-sources.js'
import type {
  ChartStudioDevtoolsProps,
  DatasetFieldJoinProjection,
  DatasetFieldVm,
  NormalizedEdgeVm,
  NormalizedNodeVm,
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

/**
 * Readable label for a dataset id (matches devtools humanize style elsewhere).
 */
function humanizeDatasetId(datasetId: string): string {
  return datasetId
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Tooltip for materialized-view join / traversal columns.
 */
function joinProjectionTitle(j: DatasetFieldJoinProjection): string {
  const viaKind = j.stepKind === 'through-association'
    ? 'association'
    : 'relationship'

  return [
    `From ${j.targetDataset}`,
    `${viaKind} “${j.via}”`,
    `alias “${j.alias}”`,
  ].join(' · ')
}

function mvBaseDatasetTitle(datasetId: string): string {
  return `Column carried from base dataset “${datasetId}” (the \`from(...)\` grain before join / expansion steps).`
}

function FieldRoleBadges({ field }: { field: DatasetFieldVm }) {
  return (
    <>
      {field.joinProjection && (
        <span className='csdt-badge csdt-badge--join' title={joinProjectionTitle(field.joinProjection)}>
          {humanizeDatasetId(field.joinProjection.targetDataset)}
        </span>
      )}
      {field.isAssociationField && <span className='csdt-badge'>N:N</span>}
      {field.mvBaseDatasetId && (
        <span className='csdt-badge csdt-badge--mv-base' title={mvBaseDatasetTitle(field.mvBaseDatasetId)}>
          {humanizeDatasetId(field.mvBaseDatasetId)}
        </span>
      )}
      {field.isDerived && <span className='csdt-badge'>Derived</span>}
      {field.isPrimaryKey && <span className='csdt-badge'>PK</span>}
      {field.isForeignKey && <span className='csdt-badge'>FK</span>}
    </>
  )
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
  const collapsedFields = getCollapsedVisibleFields(node, ctx.source, {
    mvJoinKeyOverflowRevealed: ctx.mvJoinKeyOverflowRevealedIds.has(node.id),
  })
  const visibleFields = expanded ? node.fields : collapsedFields
  const showExpandForMaterializedView =
    expanded
    || node.fields.some((field) => !isMaterializedViewJoinOrKeyField(field))
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

      {(expanded || (node.kind === 'materialized-view' ? showExpandForMaterializedView : node.fields.length > collapsedFields.length)) && (
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
function findEdgesForField(
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
function computeEdgeFieldHighlights(
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

function findFocusSets(
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
function describeEdgeSummary(edge: NormalizedEdgeVm): string {
  if (edge.kind === 'relationship') {
    return `${edge.fromDatasetId}.${edge.fromFieldId} → ${edge.toDatasetId}.${edge.toFieldId}`
  }

  if (edge.kind === 'association') {
    return `${edge.fromDatasetId}.${edge.fromFieldId} ↔ ${edge.toDatasetId}.${edge.toFieldId}`
  }

  return `${edge.label} · ${edge.materializationKind}`
}

function CollapsibleSection({
  children,
  defaultOpen = true,
  title,
}: {
  children: ReactNode
  defaultOpen?: boolean
  title: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`csdt-sp-section${open ? ' is-open' : ''}`}>
      <button
        type='button'
        className='csdt-sp-section__trigger'
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}>
        <ChevronRight size={12} className='csdt-sp-section__chevron' />
        <span>{title}</span>
      </button>
      {open && <div className='csdt-sp-section__body'>{children}</div>}
    </div>
  )
}

function NodeKindIcon({kind}: {kind: 'dataset' | 'materialized-view'}) {
  return kind === 'materialized-view'
    ? <Layers size={14} aria-hidden='true' />
    : <Database size={14} aria-hidden='true' />
}

function EdgeKindIcon({kind}: {kind: string}) {
  if (kind === 'relationship') return <GitBranch size={13} aria-hidden='true' />
  if (kind === 'association') return <Link2 size={13} aria-hidden='true' />
  return <Workflow size={13} aria-hidden='true' />
}

function SelectionPanel({
  activeContext,
  expandedNodeIds,
  focusedFieldId,
  onInspectNode,
  selectedEdgeId,
  selectedNodeId,
  source,
}: {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
  /** Full “show more” expansion on the canvas (all columns on the node). */
  expandedNodeIds: ReadonlySet<string>
  focusedFieldId: string | null
  onInspectNode(nodeId: string): void
  selectedEdgeId: string | null
  selectedNodeId: string | null
  source: NormalizedSourceVm
}) {
  const selectedNode = selectedNodeId ? source.nodeMap.get(selectedNodeId) ?? null : null
  const selectedEdge = selectedEdgeId ? source.edgeMap.get(selectedEdgeId) ?? null : null

  if (selectedNode) {
    const effectiveRows = getNodeRows(selectedNode, activeContext, 'effective')
    const schemaFields =
      selectedNode.kind === 'materialized-view' && !expandedNodeIds.has(selectedNode.id)
        ? getMaterializedViewJoinKeyFields(selectedNode)
        : selectedNode.fields
    const selectedField = focusedFieldId
      ? selectedNode.fields.find((field) => field.id === focusedFieldId) ?? null
      : null
    const fieldRelationshipEdges = focusedFieldId && selectedField
      ? findEdgesForField(selectedNode.id, focusedFieldId, source)
      : []

    return (
      <section className='csdt-sidepanel'>
        {/* ── Node header ── */}
        <div className='csdt-sp-hero'>
          <div className='csdt-sp-hero__icon'>
            <NodeKindIcon kind={selectedNode.kind} />
          </div>
          <div className='csdt-sp-hero__text'>
            <p className='csdt-sp-hero__kind'>{selectedNode.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}</p>
            <h3 className='csdt-sp-hero__title'>{selectedNode.label}</h3>
          </div>
        </div>

        <div className='csdt-sp-stats'>
          <div className='csdt-sp-stat'>
            <span className='csdt-sp-stat__value'>{selectedNode.rowCount.toLocaleString()}</span>
            <span className='csdt-sp-stat__label'>Raw rows</span>
          </div>
          <div className='csdt-sp-stat'>
            <span className='csdt-sp-stat__value'>{effectiveRows.length.toLocaleString()}</span>
            <span className='csdt-sp-stat__label'>Effective</span>
          </div>
          {selectedNode.estimatedBytes > 0 && (
            <div className='csdt-sp-stat'>
              <span className='csdt-sp-stat__value'>{formatBytes(selectedNode.estimatedBytes)}</span>
              <span className='csdt-sp-stat__label'>Size</span>
            </div>
          )}
        </div>

        <button type='button' className='csdt-sp-action' onClick={() => onInspectNode(selectedNode.id)}>
          <ArrowUpRight size={13} />
          <span>Open data viewer</span>
        </button>

        {/* ── Focused column detail ── */}
        {selectedField && (
          <div className='csdt-sp-column-card'>
            <div className='csdt-sp-column-card__header'>
              <ColumnTypeIcon type={selectedField.type} />
              <h4 className='csdt-sp-column-card__name'>{selectedField.label}</h4>
              <div className='csdt-field__badges'>
                <FieldRoleBadges field={selectedField} />
              </div>
            </div>

            <dl className='csdt-sp-props'>
              <div className='csdt-sp-prop'>
                <dt>Type</dt>
                <dd>{selectedField.type}</dd>
              </div>
              {selectedField.formatHint && (
                <div className='csdt-sp-prop'>
                  <dt>Format</dt>
                  <dd>{selectedField.formatHint}</dd>
                </div>
              )}
              {selectedField.inferenceHint && (
                <div className='csdt-sp-prop'>
                  <dt>Inference</dt>
                  <dd>{selectedField.inferenceHint}</dd>
                </div>
              )}
              {selectedField.type === 'boolean' && (selectedField.trueLabel || selectedField.falseLabel) && (
                <div className='csdt-sp-prop'>
                  <dt>Labels</dt>
                  <dd>{selectedField.trueLabel ?? 'true'} / {selectedField.falseLabel ?? 'false'}</dd>
                </div>
              )}
              {selectedField.isDerived && (
                <div className='csdt-sp-prop'>
                  <dt>Derived</dt>
                  <dd>{selectedField.derivedSummary ?? 'Per-row accessor'}</dd>
                </div>
              )}
              {selectedField.mvBaseDatasetId && (
                <div className='csdt-sp-prop'>
                  <dt>Base grain</dt>
                  <dd>{humanizeDatasetId(selectedField.mvBaseDatasetId)}</dd>
                </div>
              )}
              {selectedField.joinProjection && (
                <div className='csdt-sp-prop'>
                  <dt>Joined from</dt>
                  <dd>{joinProjectionTitle(selectedField.joinProjection)}</dd>
                </div>
              )}
            </dl>

            {fieldRelationshipEdges.length > 0 && (
              <div className='csdt-sp-column-edges'>
                <p className='csdt-sp-column-edges__label'>Relationships</p>
                <ul className='csdt-sp-edge-list'>
                  {fieldRelationshipEdges.map((edge) => (
                    <li key={edge.id} className='csdt-sp-edge-item'>
                      <EdgeKindIcon kind={edge.kind} />
                      <div className='csdt-sp-edge-item__text'>
                        <span className='csdt-sp-edge-item__kind'>{edge.kind}</span>
                        <span className='csdt-sp-edge-item__desc'>{describeEdgeSummary(edge)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Attributes ── */}
        {selectedNode.attributeIds.length > 0 && (
          <CollapsibleSection title={`Attributes \u00b7 ${selectedNode.attributeIds.length}`}>
            <div className='csdt-sp-chips'>
              {selectedNode.attributeIds.map((attributeId) => (
                <span key={attributeId} className='csdt-attribute-chip'>
                  {attributeId}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Schema ── */}
        <CollapsibleSection title={`Schema \u00b7 ${schemaFields.length}`}>
          <div className='csdt-sp-field-list'>
            {schemaFields.map((field) => (
              <div
                key={field.id}
                className={`csdt-sp-field${focusedFieldId === field.id ? ' is-focused' : ''}`}>
                <div className='csdt-sp-field__main'>
                  <ColumnTypeIcon type={field.type} />
                  <span className='csdt-sp-field__name'>{field.label}</span>
                </div>
                <div className='csdt-field__badges'>
                  <FieldRoleBadges field={field} />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </section>
    )
  }

  if (selectedEdge) {
    return (
      <section className='csdt-sidepanel'>
        {/* ── Edge header ── */}
        <div className='csdt-sp-hero'>
          <div className='csdt-sp-hero__icon csdt-sp-hero__icon--edge'>
            <EdgeKindIcon kind={selectedEdge.kind} />
          </div>
          <div className='csdt-sp-hero__text'>
            <p className='csdt-sp-hero__kind'>{selectedEdge.kind}</p>
            <h3 className='csdt-sp-hero__title'>{selectedEdge.label}</h3>
          </div>
        </div>

        {selectedEdge.kind === 'relationship' && (
          <div className='csdt-sp-detail-card'>
            <div className='csdt-sp-path'>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.fromDatasetId}<strong>.{selectedEdge.fromFieldId}</strong></span>
              <span className='csdt-sp-path__arrow'>{'\u2192'}</span>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.toDatasetId}<strong>.{selectedEdge.toFieldId}</strong></span>
            </div>
            <span className={`csdt-sp-status-pill${selectedEdge.inferred ? ' csdt-sp-status-pill--inferred' : ''}`}>
              {selectedEdge.inferred ? 'Inferred' : 'Declared'}
            </span>
          </div>
        )}

        {selectedEdge.kind === 'association' && (
          <>
            <div className='csdt-sp-detail-card'>
              <div className='csdt-sp-path'>
                <span className='csdt-sp-path__endpoint'>{selectedEdge.fromDatasetId}<strong>.{selectedEdge.fromFieldId}</strong></span>
                <span className='csdt-sp-path__arrow'>{'\u2194'}</span>
                <span className='csdt-sp-path__endpoint'>{selectedEdge.toDatasetId}<strong>.{selectedEdge.toFieldId}</strong></span>
              </div>
              <span className='csdt-sp-status-pill'>
                {selectedEdge.backing === 'explicit' ? 'Explicit edges' : `Derived \u00b7 ${selectedEdge.derivedFromDatasetId}`}
              </span>
            </div>

            {selectedEdge.previewPairs.length > 0 && (
              <CollapsibleSection title={`Preview \u00b7 ${selectedEdge.previewPairs.length} pairs`}>
                <div className='csdt-sp-preview-grid'>
                  {selectedEdge.previewPairs.map((pair, index) => (
                    <div key={`${pair.from}:${pair.to}:${index}`} className='csdt-sp-preview-row'>
                      <span>{pair.from}</span>
                      <span className='csdt-sp-preview-row__arrow'>{'\u2192'}</span>
                      <span>{pair.to}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </>
        )}

        {selectedEdge.kind === 'materialization' && (
          <div className='csdt-sp-detail-card'>
            <div className='csdt-sp-path'>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.sourceNodeId}</span>
              <span className='csdt-sp-path__arrow'>{'\u2192'}</span>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.viewId}</span>
            </div>
            {selectedEdge.projectedFieldIds.length > 0 && (
              <div className='csdt-sp-chips' style={{marginTop: 8}}>
                {selectedEdge.projectedFieldIds.map((fid) => (
                  <span key={fid} className='csdt-attribute-chip'>{fid}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className='csdt-sidepanel is-empty'>
      <div className='csdt-sp-empty'>
        <div className='csdt-sp-empty__icon'>
          <Database size={20} />
        </div>
        <p>Select an element to inspect</p>
      </div>
    </section>
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
  /** User clicked the MV body to reveal join/key rows beyond {@link MV_JOIN_KEY_DEFAULT_CAP}. */
  const [materializedViewJoinKeyRevealedIds, setMaterializedViewJoinKeyRevealedIds] = useState<Set<string>>(
    () => new Set(),
  )
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
    () => normalizedSource?.contexts[0] ?? null,
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

      if (!node || node.kind !== 'materialized-view' || materializedViewJoinKeyRevealedIds.has(nodeId)) {
        continue
      }

      const joinKeys = getMaterializedViewJoinKeyFields(node)
      const firstN = new Set(joinKeys.slice(0, MV_JOIN_KEY_DEFAULT_CAP).map((field) => field.id))

      for (const fieldId of fieldIds) {
        const field = node.fields.find((candidate) => candidate.id === fieldId)

        if (field && isMaterializedViewJoinOrKeyField(field) && !firstN.has(fieldId)) {
          next.add(nodeId)
          break
        }
      }
    }

    return next
  }, [displaySource, edgeFieldHighlights, materializedViewJoinKeyRevealedIds])
  const visibleMvJoinKeyOverflowRevealedIds = useMemo(
    () => new Set([...materializedViewJoinKeyRevealedIds, ...autoMaterializedViewJoinKeyRevealedIds]),
    [autoMaterializedViewJoinKeyRevealedIds, materializedViewJoinKeyRevealedIds],
  )
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

    void computeGraphLayout(
      layoutSource,
      visibleExpandedNodeIds,
      elkLayoutForComputation,
      visibleMvJoinKeyOverflowRevealedIds,
    ).then((positions) => {
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
  }, [elkLayoutForComputation, flowInstance, layoutNonce, layoutSource, visibleExpandedNodeIds, visibleMvJoinKeyOverflowRevealedIds])

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
            setMaterializedViewJoinKeyRevealedIds((revealed) => {
              if (!revealed.has(nodeId)) {
                return revealed
              }

              const copy = new Set(revealed)
              copy.delete(nodeId)

              return copy
            })
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
      setMaterializedViewJoinKeyRevealedIds(() => new Set())
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
                              const joinKeys = getMaterializedViewJoinKeyFields(n)

                              if (
                                joinKeys.length > MV_JOIN_KEY_DEFAULT_CAP
                                && !visibleMvJoinKeyOverflowRevealedIds.has(node.id)
                              ) {
                                setMaterializedViewJoinKeyRevealedIds((prev) => new Set(prev).add(node.id))
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
                      expandedNodeIds={visibleExpandedNodeIds}
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
