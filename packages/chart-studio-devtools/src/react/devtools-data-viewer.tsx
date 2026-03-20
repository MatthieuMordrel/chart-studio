import {
  type RefObject,
  useEffect,
  useLayoutEffect,
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

/**
 * Syncs chart canvas pixel height to the explore panel’s remaining space.
 */
function useExploreCanvasHeight(containerRef: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState(320)

  useLayoutEffect(() => {
    const el = containerRef.current

    if (!el) {
      return
    }

    function read() {
      const container = containerRef.current

      if (!container) {
        return
      }

      const next = Math.floor(container.getBoundingClientRect().height)

      if (next > 0) {
        setHeight((current) => (current === next ? current : next))
      }
    }

    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [])

  return Math.max(200, height)
}

function DevtoolsExploreChart({
  node,
  rows,
}: {
  node: NormalizedNodeVm
  rows: readonly DevtoolsRow[]
}) {
  const canvasShellRef = useRef<HTMLDivElement>(null)
  const canvasHeightPx = useExploreCanvasHeight(canvasShellRef)

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
  const pageSize = 100
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPageIndex(0)
  }, [node.id, scope, dataView])

  const pageRows = useMemo(
    () => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [pageIndex, rows],
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
    /**
     * Scroll content begins with an in-flow sticky header; virtual rows live in a sibling
     * below it. `scrollMargin` aligns measurement coordinates with the scroll container so
     * range detection matches DOM positions (see translate in the row renderer).
     */
    scrollMargin: GRID_ROW_HEIGHT_PX,
    overscan: 8,
  })

  return (
    <div className='csdt-data-viewer'>
      <div className='csdt-data-viewer__backdrop' onClick={onClose} />
      <section className='csdt-data-viewer__panel'>
        <header className='csdt-data-viewer__header'>
          <div>
            <p className='csdt-kicker'>{node.kind === 'materialized-view' ? 'Materialized View' : 'Dataset'}</p>
            <h2>{node.label}</h2>
            <p className='csdt-muted'>{rows.length.toLocaleString()} rows in {scope} mode</p>
          </div>

          <div className='csdt-data-viewer__controls' role='toolbar' aria-label='Data viewer'>
            <div className='csdt-segmented' role='group' aria-label='Presentation'>
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

            <div className='csdt-segmented' role='group' aria-label='Row scope'>
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

            <button type='button' className='csdt-icon-button' onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {dataView === 'explore'
          ? <DevtoolsExploreChart node={node} rows={rows} />
          : (
            <div className='csdt-data-viewer__inspect'>
              <div className='csdt-data-viewer__pagination'>
                <span>Page {pageIndex + 1} of {pageCount}</span>
                <div className='csdt-pagination__buttons'>
                  <button
                    type='button'
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                    disabled={pageIndex === 0}>
                    Previous
                  </button>
                  <button
                    type='button'
                    onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
                    disabled={pageIndex >= pageCount - 1}>
                    Next
                  </button>
                </div>
              </div>

              {dataView === 'json'
                ? (
                  <div className='csdt-json-viewer__shell'>
                    <pre className='csdt-json-viewer'>
                      {JSON.stringify(pageRows, null, 2)}
                    </pre>
                  </div>
                )
                : (
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
                                  className='csdt-grid__cell'
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
                )}
            </div>
          )}
      </section>
    </div>
  )
}
