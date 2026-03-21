import '@xyflow/react/dist/base.css'
import {useDocumentEvent} from '@matthieumordrel/chart-studio/_internal'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {CSSProperties} from 'react'
import type {ReactFlowInstance} from '@xyflow/react'
import {ElkLayoutPanel} from './devtools-elk-layout-panel.js'
import {
  type FlowNodePosition,
  type FlowEdge,
  type FlowNode,
} from './graph-state.js'
import {
  getCollapsedVisibleFields,
  isMaterializedViewJoinOrKeyField,
  isMaterializedViewJoinProjectedField,
} from './graph-field-visibility.js'
import {useMvJoinKeyClickRevealForSelection} from './use-mv-join-key-click-reveal.js'
import {
  computeGraphLayout,
  DEVTOOLS_NODE_WIDTH,
  type GraphLayoutResult,
} from './layout.js'
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
import {useDevtoolsSources} from './use-devtools-sources.js'
import {SelectionPanel, getNodeRows} from './devtools-details.js'
import {
  computeEdgeFieldHighlights,
  findFocusSets,
  resolveCanvasFocusFromHoverAndSelection,
} from './selection-utils.js'
import {
  DevtoolsGraphCanvas,
  FIT_VIEW_PADDING,
  type CanvasContextValue,
} from './devtools-graph-canvas.js'
import type {
  ChartStudioDevtoolsProps,
  SearchItemVm,
} from './types.js'

type ViewerState = {
  nodeId: string
  /** Paginated grid, chart explore UI, or JSON (one control in the viewer header). */
  dataView: 'table' | 'explore' | 'json'
  scope: 'raw' | 'effective'
}

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

export function ChartStudioDevtools(props: ChartStudioDevtoolsProps) {
  const sources = useDevtoolsSources(props)
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false)
  const [pausedSources, setPausedSources] = useState<typeof sources | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  /** Transient graph hover for relationship/key highlights (selection panel stays click-driven). */
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null)
  const [hoverFieldId, setHoverFieldId] = useState<string | null>(null)
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
  const [nodePositions, setNodePositions] = useState<Record<string, FlowNodePosition>>({})
  const [lastComputedLayout, setLastComputedLayout] = useState<GraphLayoutResult | null>(null)
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

    setHoverEdgeId(null)
    setHoverNodeId(null)
    setHoverFieldId(null)
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

  const canvasFocusIds = useMemo(
    () => resolveCanvasFocusFromHoverAndSelection(
      {edgeId: hoverEdgeId, nodeId: hoverNodeId, fieldId: hoverFieldId},
      {
        edgeId: currentSelectedEdgeId,
        nodeId: currentSelectedNodeId,
        fieldId: currentSelectedFieldId,
      },
      displaySource,
    ),
    [
      currentSelectedEdgeId,
      currentSelectedFieldId,
      currentSelectedNodeId,
      displaySource,
      hoverEdgeId,
      hoverFieldId,
      hoverNodeId,
    ],
  )

  const {focusedEdgeIds, focusedNodeIds} = useMemo(
    () => displaySource
      ? findFocusSets(
        displaySource,
        canvasFocusIds.nodeId,
        canvasFocusIds.edgeId,
        canvasFocusIds.fieldId,
      )
      : {focusedEdgeIds: new Set<string>(), focusedNodeIds: new Set<string>()},
    [canvasFocusIds.edgeId, canvasFocusIds.fieldId, canvasFocusIds.nodeId, displaySource],
  )

  const canvasEdgeFieldHighlights = useMemo(
    () => displaySource
      ? computeEdgeFieldHighlights(
        canvasFocusIds.edgeId,
        canvasFocusIds.nodeId,
        canvasFocusIds.fieldId,
        displaySource,
      )
      : new Map<string, ReadonlySet<string>>(),
    [canvasFocusIds.edgeId, canvasFocusIds.fieldId, canvasFocusIds.nodeId, displaySource],
  )

  /** Selection-only: drives auto-expand / MV join reveal, not hover preview. */
  const selectionEdgeFieldHighlights = useMemo(
    () => displaySource
      ? computeEdgeFieldHighlights(currentSelectedEdgeId, currentSelectedNodeId, currentSelectedFieldId, displaySource)
      : new Map<string, ReadonlySet<string>>(),
    [currentSelectedEdgeId, currentSelectedFieldId, currentSelectedNodeId, displaySource],
  )
  const autoMaterializedViewJoinKeyRevealedIds = useMemo(() => {
    const next = new Set<string>()

    if (!displaySource || selectionEdgeFieldHighlights.size === 0) {
      return next
    }

    for (const [nodeId, fieldIds] of selectionEdgeFieldHighlights) {
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
  }, [displaySource, mvJoinKeyClickRevealNodeId, selectionEdgeFieldHighlights])
  const visibleMvJoinKeyOverflowRevealedIds = useMemo(() => {
    const merged = new Set(autoMaterializedViewJoinKeyRevealedIds)

    if (mvJoinKeyClickRevealNodeId != null) {
      merged.add(mvJoinKeyClickRevealNodeId)
    }

    return merged
  }, [autoMaterializedViewJoinKeyRevealedIds, mvJoinKeyClickRevealNodeId])
  const autoExpandedNodeIds = useMemo(() => {
    if (!displaySource || selectionEdgeFieldHighlights.size === 0) {
      return new Set<string>()
    }

    const next = new Set<string>()

    for (const [nodeId, fieldIds] of selectionEdgeFieldHighlights) {
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
  }, [displaySource, manualExpandedNodeIds, selectionEdgeFieldHighlights, visibleMvJoinKeyOverflowRevealedIds])
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
      setLastComputedLayout(null)
      setNodePositions({})
      return
    }

    let cancelled = false
    const layoutRunId = ++layoutRunIdRef.current

    void computeGraphLayout(layoutSource, visibleExpandedNodeIds, elkLayoutForComputation).then((layout) => {
      if (cancelled || layoutRunId !== layoutRunIdRef.current) {
        return
      }

      startTransition(() => {
        setLastComputedLayout(layout)
        setNodePositions(layout.nodePositions)
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

  const canvasContextValue = useMemo<CanvasContextValue | null>(() => {
    if (!displaySource) {
      return null
    }

    return {
      activeContext,
      edgeHighlightFieldIdsByNodeId: canvasEdgeFieldHighlights,
      expandedNodeIds: visibleExpandedNodeIds,
      fieldFocusNodeId: canvasFocusIds.fieldId != null && canvasFocusIds.nodeId != null
        ? canvasFocusIds.nodeId
        : null,
      focusedEdgeIds,
      focusedFieldId: canvasFocusIds.fieldId,
      focusedNodeIds,
      issuesByTargetId,
      mvJoinKeyOverflowRevealedIds: visibleMvJoinKeyOverflowRevealedIds,
      onClearHover() {
        setHoverEdgeId(null)
        setHoverNodeId(null)
        setHoverFieldId(null)
      },
      onClearSelection() {
        setSelectedNodeId(null)
        setSelectedEdgeId(null)
        setSelectedFieldId(null)
        setHoverEdgeId(null)
        setHoverNodeId(null)
        setHoverFieldId(null)
      },
      onHoverEdge(edgeId) {
        setHoverEdgeId(edgeId)
        if (edgeId != null) {
          setHoverNodeId(null)
          setHoverFieldId(null)
        }
      },
      onHoverField(nodeId, fieldId) {
        setHoverEdgeId(null)
        setHoverNodeId(nodeId)
        setHoverFieldId(fieldId)
      },
      onInspectNode(nodeId) {
        setHoverEdgeId(null)
        setHoverNodeId(null)
        setHoverFieldId(null)
        setSelectedNodeId(nodeId)
        setSelectedEdgeId(null)
        setViewer({
          nodeId,
          dataView: 'table',
          scope: 'raw',
        })
      },
      onSelectEdge(edgeId) {
        setHoverEdgeId(null)
        setHoverNodeId(null)
        setHoverFieldId(null)
        setSelectedEdgeId(edgeId)
        setSelectedNodeId(null)
        setSelectedFieldId(null)
      },
      onSelectNode(nodeId, fieldId) {
        setHoverEdgeId(null)
        setHoverNodeId(null)
        setHoverFieldId(null)
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
    canvasEdgeFieldHighlights,
    canvasFocusIds.fieldId,
    canvasFocusIds.nodeId,
    displaySource,
    focusedEdgeIds,
    focusedNodeIds,
    issuesByTargetId,
    visibleExpandedNodeIds,
    visibleMvJoinKeyOverflowRevealedIds,
  ])

  function focusSearchItem(item: SearchItemVm) {
    setHoverEdgeId(null)
    setHoverNodeId(null)
    setHoverFieldId(null)

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

    const targetNode = targetNodeId
      ? flowInstance?.getNodes().find((node) => node.id === targetNodeId)
      : null

    if (!targetNode) {
      return
    }

    void flowInstance?.setCenter(
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
                  <DevtoolsGraphCanvas
                    canvasContextValue={canvasContextValue}
                    displaySource={displaySource!}
                    edgeRoutes={lastComputedLayout?.edgeRoutes ?? {}}
                    layoutNodePositions={lastComputedLayout?.nodePositions ?? {}}
                    nodePositions={nodePositions}
                    onFlowInstanceChange={setFlowInstance}
                    onNodePositionsChange={setNodePositions}
                    onRevealMaterializedViewFields={setMvJoinKeyClickRevealNodeId}
                  />

                  <SelectionPanel
                    activeContext={activeContext}
                    focusedFieldId={currentSelectedFieldId}
                    onInspectNode={(nodeId) => canvasContextValue.onInspectNode(nodeId)}
                    selectedEdgeId={currentSelectedEdgeId}
                    selectedNodeId={currentSelectedNodeId}
                    source={displaySource!}
                  />
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
                          setHoverEdgeId(null)
                          setHoverNodeId(null)
                          setHoverFieldId(null)

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
