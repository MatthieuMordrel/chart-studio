import { useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar, type ControlId } from '@matthieumordrel/chart-studio/ui'
import { useMemo, useState } from 'react'
import { playgroundSources } from '../mock-data'

type ControlVisibility = 'pinned' | 'overflow' | 'hidden'

const CONTROLS: ReadonlyArray<{ id: ControlId; label: string; description: string }> = [
  { id: 'source', label: 'Data source', description: 'Switch between datasets' },
  { id: 'xAxis', label: 'X-axis', description: 'Column for the horizontal axis' },
  { id: 'chartType', label: 'Chart type', description: 'Line, bar, area, pie, etc.' },
  { id: 'groupBy', label: 'Group by', description: 'Split into multiple series' },
  { id: 'timeBucket', label: 'Time bucket', description: 'Day, week, month, quarter, year' },
  { id: 'metric', label: 'Metric', description: 'Aggregation function' },
  { id: 'filters', label: 'Filters', description: 'Categorical and boolean filters' },
  { id: 'dateRange', label: 'Date range', description: 'Date filtering with presets' }
]

const STATES = [
  { id: 'pinned', shortLabel: 'P', label: 'Pinned — visible in the toolbar row' },
  { id: 'overflow', shortLabel: 'E', label: 'Ellipsis — inside the overflow menu' },
  { id: 'hidden', shortLabel: 'H', label: 'Hidden — not rendered anywhere' }
] as const satisfies ReadonlyArray<{ id: ControlVisibility; shortLabel: string; label: string }>

type Preset = {
  id: string
  label: string
  visibility: Record<ControlId, ControlVisibility>
}

const DEFAULT_VISIBILITY: Record<ControlId, ControlVisibility> = {
  source: 'pinned',
  xAxis: 'pinned',
  chartType: 'overflow',
  groupBy: 'overflow',
  timeBucket: 'overflow',
  metric: 'overflow',
  filters: 'overflow',
  dateRange: 'pinned'
}

const PRESETS: readonly Preset[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    visibility: DEFAULT_VISIBILITY
  },
  {
    id: 'all-pinned',
    label: 'All pinned',
    visibility: {
      source: 'pinned',
      xAxis: 'pinned',
      chartType: 'pinned',
      groupBy: 'pinned',
      timeBucket: 'pinned',
      metric: 'pinned',
      filters: 'pinned',
      dateRange: 'pinned'
    }
  },
  {
    id: 'all-overflow',
    label: 'All overflow',
    visibility: {
      source: 'overflow',
      xAxis: 'overflow',
      chartType: 'overflow',
      groupBy: 'overflow',
      timeBucket: 'overflow',
      metric: 'overflow',
      filters: 'overflow',
      dateRange: 'overflow'
    }
  }
]

/**
 * Interactive ChartToolbar configurator.
 * Toggle each control between pinned / ellipsis / hidden and see the result live.
 */
export function KitchenSinkChart() {
  const chart = useChart({ sources: playgroundSources })
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY)

  const pinned = useMemo(() => CONTROLS.filter(c => visibility[c.id] === 'pinned').map(c => c.id), [visibility])
  const hidden = useMemo(() => CONTROLS.filter(c => visibility[c.id] === 'hidden').map(c => c.id), [visibility])

  /** The exact JSX a developer would write in their app. */
  const snippet = useMemo(() => {
    const parts = [
      pinned.length > 0 ? `pinned={[${pinned.map(id => `'${id}'`).join(', ')}]}` : null,
      hidden.length > 0 ? `hidden={[${hidden.map(id => `'${id}'`).join(', ')}]}` : null
    ].filter(Boolean)
    return parts.length === 0 ? '<ChartToolbar />' : `<ChartToolbar\n  ${parts.join('\n  ')}\n/>`
  }, [hidden, pinned])

  /** Set a single control's visibility. */
  const setControl = (id: ControlId, state: ControlVisibility) => setVisibility(prev => ({ ...prev, [id]: state }))

  return (
    <Chart chart={chart}>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]'>
        {/* ── Left: live chart ─────────────────────────────────────── */}
        <div className='space-y-4'>
          <div className='overflow-hidden rounded-xl border border-border bg-background'>
            <div className='p-4'>
              <ChartToolbar pinned={pinned} hidden={hidden} />
            </div>
            <div className='border-t border-border p-4'>
              <ChartCanvas height={360} />
            </div>
            <div className='border-t border-border/60 bg-card/40 px-4 py-3'>
              <pre className='overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground'>
                <code>{snippet}</code>
              </pre>
            </div>
          </div>

          <details className='group rounded-xl border border-border bg-background'>
            <summary className='cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'>
              Inspect live chart state
            </summary>
            <div className='border-t border-border p-4'>
              <ChartDebug />
            </div>
          </details>
        </div>

        {/* ── Right: toolbar editor ────────────────────────────────── */}
        <div className='xl:sticky xl:top-6 xl:self-start'>
          <div className='overflow-hidden rounded-xl border border-border bg-background shadow-sm'>
            <div className='flex items-center justify-between border-b border-border px-4 py-3'>
              <p className='text-sm font-semibold text-foreground'>Toolbar editor</p>
              <button
                type='button'
                onClick={() => setVisibility(DEFAULT_VISIBILITY)}
                className='text-xs text-muted-foreground transition-colors hover:text-foreground'>
                Reset
              </button>
            </div>

            <div className='flex flex-wrap gap-1.5 border-b border-border px-4 py-3'>
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type='button'
                  onClick={() => setVisibility(preset.visibility)}
                  className='rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
                  {preset.label}
                </button>
              ))}
            </div>

            <div className='divide-y divide-border/70'>
              {CONTROLS.map(control => (
                <div key={control.id} className='flex items-center justify-between gap-3 px-4 py-2.5'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm text-foreground'>{control.label}</p>
                    <p className='truncate text-[11px] text-muted-foreground'>{control.description}</p>
                  </div>

                  <div className='inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5'>
                    {STATES.map(state => {
                      const active = visibility[control.id] === state.id
                      return (
                        <button
                          key={state.id}
                          type='button'
                          onClick={() => setControl(control.id, state.id)}
                          title={state.label}
                          className={`flex h-6 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                            active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}>
                          {state.shortLabel}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className='border-t border-border bg-card/30 px-4 py-3'>
              <p className='text-[11px] leading-relaxed text-muted-foreground'>
                In your app, pass <code className='font-semibold'>pinned</code> and <code className='font-semibold'>hidden</code> to{' '}
                <code className='font-semibold'>{'<ChartToolbar />'}</code>. By default, <code className='font-semibold'>dateRange</code> stays pinned
                and unlisted controls default to the ellipsis menu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Chart>
  )
}
