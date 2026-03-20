import {useState, type ReactNode} from 'react'
import {ArrowUpRight, ChevronRight, Database, GitBranch, Link2, Workflow} from 'lucide-react'
import type {ChartStudioDevtoolsContextSnapshot} from '@matthieumordrel/chart-studio/_internal'
import {ColumnTypeIcon} from './column-type-icon.js'
import {findEdgesForField, describeEdgeSummary} from './selection-utils.js'
import type {
  DatasetFieldJoinProjection,
  DatasetFieldVm,
  NormalizedEdgeVm,
  NormalizedNodeVm,
  NormalizedSourceVm,
} from './types.js'

/**
 * Readable label for a dataset id (matches devtools humanize style elsewhere).
 */
export function humanizeDatasetId(datasetId: string): string {
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
export function joinProjectionTitle(j: DatasetFieldJoinProjection): string {
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

export function FieldRoleBadges({field}: {field: DatasetFieldVm}) {
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getNodeRows(
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

function EdgeKindIcon({kind}: {kind: NormalizedEdgeVm['kind']}) {
  if (kind === 'relationship') return <GitBranch size={13} aria-hidden='true' />
  if (kind === 'association') return <Link2 size={13} aria-hidden='true' />
  return <Workflow size={13} aria-hidden='true' />
}

export function SelectionPanel({
  activeContext,
  focusedFieldId,
  onInspectNode,
  selectedEdgeId,
  selectedNodeId,
  source,
}: {
  activeContext: ChartStudioDevtoolsContextSnapshot | null
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
    const selectedField = focusedFieldId
      ? selectedNode.fields.find((field) => field.id === focusedFieldId) ?? null
      : null
    const fieldRelationshipEdges = focusedFieldId && selectedField
      ? findEdgesForField(selectedNode.id, focusedFieldId, source)
      : []

    if (selectedField) {
      return (
        <section className='csdt-sidepanel'>
          <div className='csdt-sp-hero'>
            <h3 className='csdt-sp-hero__title'>{selectedField.label}</h3>
            <span className='csdt-node__type'>Column</span>
          </div>

          <p className='csdt-sp-breadcrumb'>{selectedNode.label}</p>

          <div className='csdt-sp-column-card'>
            <div className='csdt-sp-column-card__header'>
              <ColumnTypeIcon type={selectedField.type} />
              <span className='csdt-sp-column-card__type'>{selectedField.type}</span>
              <div className='csdt-field__badges'>
                <FieldRoleBadges field={selectedField} />
              </div>
            </div>

            <dl className='csdt-sp-props'>
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
          </div>

          <CollapsibleSection title={`Relationships · ${fieldRelationshipEdges.length}`}>
            {fieldRelationshipEdges.length > 0
              ? (
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
              )
              : <p className='csdt-sp-empty-hint'>No graph edges for this column.</p>}
          </CollapsibleSection>
        </section>
      )
    }

    return (
      <section className='csdt-sidepanel'>
        <div className='csdt-sp-hero'>
          <h3 className='csdt-sp-hero__title'>{selectedNode.label}</h3>
          <span className='csdt-node__type'>
            {selectedNode.kind === 'materialized-view' ? 'Materialized view' : 'Dataset'}
          </span>
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

        <CollapsibleSection title={`Attributes · ${selectedNode.attributeIds.length}`}>
          {selectedNode.attributeIds.length > 0
            ? (
              <div className='csdt-sp-chips'>
                {selectedNode.attributeIds.map((attributeId) => (
                  <span key={attributeId} className='csdt-attribute-chip'>
                    {attributeId}
                  </span>
                ))}
              </div>
            )
            : <p className='csdt-sp-empty-hint'>None</p>}
        </CollapsibleSection>

        <CollapsibleSection title={`Schema · ${selectedNode.fields.length}`}>
          <div className='csdt-sp-field-list'>
            {selectedNode.fields.map((field) => (
              <div key={field.id} className='csdt-sp-field'>
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
    const edgeLabel =
      selectedEdge.kind === 'relationship' ? 'Relationship'
        : selectedEdge.kind === 'association' ? 'Association'
          : 'Materialization'

    return (
      <section className='csdt-sidepanel'>
        <div className='csdt-sp-hero'>
          <h3 className='csdt-sp-hero__title'>{selectedEdge.label}</h3>
          <span className='csdt-node__type'>{edgeLabel}</span>
        </div>

        {selectedEdge.kind === 'relationship' && (
          <div className='csdt-sp-detail-card'>
            <div className='csdt-sp-path'>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.fromDatasetId}<strong>.{selectedEdge.fromFieldId}</strong></span>
              <span className='csdt-sp-path__arrow'>{'→'}</span>
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
                <span className='csdt-sp-path__arrow'>{'↔'}</span>
                <span className='csdt-sp-path__endpoint'>{selectedEdge.toDatasetId}<strong>.{selectedEdge.toFieldId}</strong></span>
              </div>
              <span className='csdt-sp-status-pill'>
                {selectedEdge.backing === 'explicit' ? 'Explicit edges' : `Derived · ${selectedEdge.derivedFromDatasetId}`}
              </span>
            </div>

            {selectedEdge.previewPairs.length > 0 && (
              <CollapsibleSection title={`Preview · ${selectedEdge.previewPairs.length} pairs`}>
                <div className='csdt-sp-preview-grid'>
                  {selectedEdge.previewPairs.map((pair, index) => (
                    <div key={`${pair.from}:${pair.to}:${index}`} className='csdt-sp-preview-row'>
                      <span>{pair.from}</span>
                      <span className='csdt-sp-preview-row__arrow'>{'→'}</span>
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
              <span className='csdt-sp-path__arrow'>{'→'}</span>
              <span className='csdt-sp-path__endpoint'>{selectedEdge.viewId}</span>
            </div>
            {selectedEdge.projectedFieldIds.length > 0 && (
              <div className='csdt-sp-chips' style={{marginTop: 8}}>
                {selectedEdge.projectedFieldIds.map((fieldId) => (
                  <span key={fieldId} className='csdt-attribute-chip'>{fieldId}</span>
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
