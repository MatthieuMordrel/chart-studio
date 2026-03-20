import type React from 'react'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio-ui'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {useVirtualizer} from '@tanstack/react-virtual'
import type {
  ChartStudioDevtoolsContextSnapshot,
} from '@matthieumordrel/chart-studio/_internal'
import {useElementSize} from '@matthieumordrel/chart-studio/_internal'
import {ColumnTypeIcon} from './column-type-icon.js'
import type {
  DevtoolsRow,
  NormalizedNodeVm,
} from './types.js'

/**
 * Row height for the inspect grid (must match `.csdt-grid__row` / header in styles).
 */
const GRID_ROW_HEIGHT_PX = 36

/**
 * Single viewer presentation: paginated grid, chart UI, or JSON.
 */
export type DevtoolsDataView = 'table' | 'explore' | 'json'

type DevtoolsDataViewerProps = {
  context: ChartStudioDevtoolsContextSnapshot | null
  dataView: DevtoolsDataView
  node: NormalizedNodeVm
  onClose(): void
  onDataViewChange(dataView: DevtoolsDataView): void
  onScopeChange(scope: 'raw' | 'effective'): void
  rows: readonly DevtoolsRow[]
  scope: 'raw' | 'effective'
}

/**
 * Formats a cell value for the inspect table (booleans use field labels, null as em dash).
 */
function formatRowValue(
  value: unknown,
  node: NormalizedNodeVm,
  fieldId: string,
): string {
  const field = node.fields.find((candidate) => candidate.id === fieldId)

  if (field?.type === 'boolean' && typeof value === 'boolean') {
    return value
      ? field.trueLabel ?? 'True'
      : field.falseLabel ?? 'False'
  }

  if (value == null) {
    return '—'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

/** Check if a field is numeric for right-alignment. */
function isNumericField(type: string): boolean {
  return type === 'number' || type === 'integer' || type === 'float' || type === 'decimal' || type === 'currency'
}

/** Simple JSON syntax highlighter — returns spans per line. */
function highlightJson(json: string): React.ReactNode[] {
  const lines = json.split('\n')
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let keyIdx = 0

    while (remaining.length > 0) {
      // Key
      let match = remaining.match(/^(\s*)"([^"\\]*(?:\\.[^"\\]*)*)"(\s*:)/)
      if (match) {
        if (match[1]) parts.push(<span key={`${i}-ws-${keyIdx++}`}>{match[1]}</span>)
        parts.push(<span key={`${i}-k-${keyIdx++}`} className='csdt-json--key'>"{match[2]}"</span>)
        parts.push(<span key={`${i}-c-${keyIdx++}`}>{match[3]}</span>)
        remaining = remaining.slice(match[0].length)
        continue
      }

      // String value
      match = remaining.match(/^(\s*)"([^"\\]*(?:\\.[^"\\]*)*)"/)
      if (match) {
        if (match[1]) parts.push(<span key={`${i}-ws-${keyIdx++}`}>{match[1]}</span>)
        parts.push(<span key={`${i}-s-${keyIdx++}`} className='csdt-json--string'>"{match[2]}"</span>)
        remaining = remaining.slice(match[0].length)
        continue
      }

      // Number
      match = remaining.match(/^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/)
      if (match) {
        parts.push(<span key={`${i}-n-${keyIdx++}`} className='csdt-json--number'>{match[1]}</span>)
        remaining = remaining.slice(match[0].length)
        continue
      }

      // Boolean
      match = remaining.match(/^(true|false)/)
      if (match) {
        parts.push(<span key={`${i}-b-${keyIdx++}`} className='csdt-json--boolean'>{match[1]}</span>)
        remaining = remaining.slice(match[0].length)
        continue
      }

      // Null
      match = remaining.match(/^null/)
      if (match) {
        parts.push(<span key={`${i}-nl-${keyIdx++}`} className='csdt-json--null'>null</span>)
        remaining = remaining.slice(4)
        continue
      }

      // Consume next char (punctuation, whitespace)
      parts.push(<span key={`${i}-p-${keyIdx++}`}>{remaining[0]}</span>)
      remaining = remaining.slice(1)
    }

    return (
      <span key={i} className='csdt-json-viewer__line'>{parts}</span>
    )
  })
}

/* ── Inline SVG icons ── */

function IconX() {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
      <path d='m15 18-6-6 6-6' />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
      <path d='m9 18 6-6-6-6' />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
      <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
      <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
    </svg>
  )
}

function DevtoolsExploreChart({
  node,
  rows,
}: {
  node: NormalizedNodeVm
  rows: readonly DevtoolsRow[]
}) {
  const {ref: canvasShellRef, size: canvasShellSize} = useElementSize<HTMLDivElement>({
    width: 0,
    height: 320,
  })
  const canvasHeightPx = Math.max(200, Math.floor(canvasShellSize.height))

  const schema = useMemo(
    () =>
      node.definition
        .chart('devtoolsExplore')
        .chartType((t) => t.default('table'))
        .build(),
    [node.definition],
  )
  const chart = useChart({
    data: rows,
    schema,
  })

  return (
    <div className='csdt-data-viewer__explore'>
      <Chart chart={chart}>
        <div className='csdt-explore-chart'>
          <div className='csdt-explore-chart__toolbar'>
            <ChartToolbar className='csdt-explore-chart__toolbar-inner' />
          </div>
          <div className='csdt-explore-chart__canvas-shell'>
            <div ref={canvasShellRef} className='csdt-explore-chart__canvas-measure'>
              <ChartCanvas height={canvasHeightPx} className='csdt-explore-chart__canvas border-0' />
            </div>
          </div>
        </div>
      </Chart>
    </div>
  )
}

/** Format a range string like "1–100 of 1,234". */
function formatRange(pageIndex: number, pageSize: number, total: number): string {
  const start = pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, total)
  return `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
}

/**
 * Full-screen dataset / materialized-view viewer: Table (paginated grid), Explore (charts), or JSON.
 */
export function DevtoolsDataViewer({
  context,
  dataView,
  node,
  onClose,
  onDataViewChange,
  onScopeChange,
  rows,
  scope,
}: DevtoolsDataViewerProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [copyLabel, setCopyLabel] = useState(false)
  const pageSize = 100
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)

  const pageRows = useMemo(
    () => rows.slice(currentPageIndex * pageSize, (currentPageIndex + 1) * pageSize),
    [currentPageIndex, rows],
  )

  const numericFieldIds = useMemo(
    () => new Set(node.fields.filter((f) => isNumericField(f.type)).map((f) => f.id)),
    [node.fields],
  )

  const columnHelper = createColumnHelper<DevtoolsRow>()
  const table = useReactTable({
    data: pageRows as DevtoolsRow[],
    columns: node.fields.map((field) =>
      columnHelper.accessor((row) => row[field.id], {
        id: field.id,
        header: () => (
          <div className='csdt-grid__header'>
            <span>{field.label}</span>
            <ColumnTypeIcon type={field.type} />
          </div>
        ),
        cell: (info) => formatRowValue(info.getValue(), node, field.id),
      }),
    ),
    getCoreRowModel: getCoreRowModel(),
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => GRID_ROW_HEIGHT_PX,
    scrollMargin: GRID_ROW_HEIGHT_PX,
    overscan: 8,
  })

  const handleCopy = useCallback(() => {
    const text = JSON.stringify(pageRows, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel(true)
      setTimeout(() => setCopyLabel(false), 1500)
    })
  }, [pageRows])

  const jsonHighlighted = useMemo(() => {
    if (dataView !== 'json') return null
    return highlightJson(JSON.stringify(pageRows, null, 2))
  }, [dataView, pageRows])

  return (
    <div className='csdt-data-viewer'>
      <div className='csdt-data-viewer__backdrop' onClick={onClose} />
      <section className='csdt-data-viewer__panel'>
        <header className='csdt-data-viewer__header'>
          <div className='csdt-data-viewer__title-block'>
            <h2>{node.label}</h2>
            <div className='csdt-data-viewer__meta'>
              <span className='csdt-data-viewer__meta-item'>
                {node.fields.length} {node.fields.length === 1 ? 'column' : 'columns'}
              </span>
              <span className='csdt-data-viewer__meta-item'>
                {rows.length.toLocaleString()} {rows.length === 1 ? 'row' : 'rows'}
              </span>
            </div>
          </div>

          <div className='csdt-data-viewer__controls' role='toolbar' aria-label='Data viewer'>
            <div className='csdt-tab-bar' role='group' aria-label='Presentation'>
              <button
                type='button'
                className={dataView === 'table' ? 'is-active' : undefined}
                onClick={() => onDataViewChange('table')}>
                Table
              </button>
              <button
                type='button'
                className={dataView === 'explore' ? 'is-active' : undefined}
                onClick={() => onDataViewChange('explore')}>
                Explore
              </button>
              <button
                type='button'
                className={dataView === 'json' ? 'is-active' : undefined}
                onClick={() => onDataViewChange('json')}>
                JSON
              </button>
            </div>

            <div className='csdt-scope-toggle' role='group' aria-label='Row scope'>
              <button
                type='button'
                className={scope === 'raw' ? 'is-active' : undefined}
                onClick={() => onScopeChange('raw')}>
                Raw
              </button>
              <button
                type='button'
                className={scope === 'effective' ? 'is-active' : undefined}
                onClick={() => onScopeChange('effective')}
                disabled={!context}>
                Effective
              </button>
            </div>

            <button
              type='button'
              className='csdt-data-viewer__close'
              onClick={onClose}
              aria-label='Close'>
              <IconX />
            </button>
          </div>
        </header>

        <div className='csdt-data-viewer__body'>
          {/* Table view */}
          <div className={`csdt-data-viewer__pane${dataView === 'table' ? ' is-active' : ''}`}>
            <div className='csdt-data-viewer__inspect'>
              <div className='csdt-data-viewer__pagination'>
                <span className='csdt-data-viewer__pagination-info'>
                  {formatRange(currentPageIndex, pageSize, rows.length)}
                </span>
                <div className='csdt-pagination__buttons'>
                  <button
                    type='button'
                    onClick={() => setPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    aria-label='Previous page'>
                    <IconChevronLeft />
                  </button>
                  <button
                    type='button'
                    onClick={() => setPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex >= pageCount - 1}
                    aria-label='Next page'>
                    <IconChevronRight />
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className='csdt-grid'>
                <div className='csdt-grid__inner'>
                  <div className='csdt-grid__row csdt-grid__row--header'>
                    {table.getFlatHeaders().map((header) => (
                      <div
                        key={header.id}
                        className='csdt-grid__cell csdt-grid__cell--header'
                        style={{width: node.fields.length <= 6 ? `${100 / node.fields.length}%` : 160, flex: node.fields.length <= 6 ? undefined : '0 0 auto'}}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    ))}
                  </div>

                  <div
                    className='csdt-grid__body'
                    style={{height: `${rowVirtualizer.getTotalSize()}px`}}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = table.getRowModel().rows[virtualRow.index]

                      if (!row) {
                        return null
                      }

                      return (
                        <div
                          key={row.id}
                          className='csdt-grid__row'
                          style={{
                            transform: `translateY(${virtualRow.start - GRID_ROW_HEIGHT_PX}px)`,
                          }}>
                          {row.getVisibleCells().map((cell) => (
                            <div
                              key={cell.id}
                              className={`csdt-grid__cell${numericFieldIds.has(cell.column.id) ? ' csdt-grid__cell--numeric' : ''}`}
                              style={{width: node.fields.length <= 6 ? `${100 / node.fields.length}%` : 160, flex: node.fields.length <= 6 ? undefined : '0 0 auto'}}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Explore view */}
          <div className={`csdt-data-viewer__pane${dataView === 'explore' ? ' is-active' : ''}`}>
            <DevtoolsExploreChart node={node} rows={rows} />
          </div>

          {/* JSON view */}
          <div className={`csdt-data-viewer__pane${dataView === 'json' ? ' is-active' : ''}`}>
            <div className='csdt-json-viewer__shell'>
              <button
                type='button'
                className='csdt-json-viewer__copy'
                onClick={handleCopy}
                aria-label='Copy JSON'
                title={copyLabel ? 'Copied!' : 'Copy to clipboard'}>
                <IconCopy />
              </button>
              <pre className='csdt-json-viewer'>
                {jsonHighlighted}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
