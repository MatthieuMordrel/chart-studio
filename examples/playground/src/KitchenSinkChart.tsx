import {useMemo, useState} from 'react'
import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartDebug, ChartToolbar, type ControlId} from '@matthieumordrel/chart-studio/ui'
import {playgroundSources} from './mock-data'

type ControlVisibility = 'pinned' | 'overflow' | 'hidden'

const CONTROL_OPTIONS = [
  {
    id: 'source',
    label: 'Data source',
    description: 'Switch between the available datasets.',
  },
  {
    id: 'xAxis',
    label: 'X-axis',
    description: 'Pick which column drives the horizontal axis.',
  },
  {
    id: 'chartType',
    label: 'Chart type',
    description: 'Toggle between line, bar, area, pie, and more.',
  },
  {
    id: 'groupBy',
    label: 'Group by',
    description: 'Split the chart into multiple series.',
  },
  {
    id: 'timeBucket',
    label: 'Time bucket',
    description: 'Aggregate date axes by day, week, month, quarter, or year.',
  },
  {
    id: 'metric',
    label: 'Metric',
    description: 'Choose the aggregation metric used in the chart.',
  },
  {
    id: 'filters',
    label: 'Filters',
    description: 'Add categorical and boolean filters to the dataset.',
  },
  {
    id: 'dateRange',
    label: 'Date range',
    description: 'Open the interactive date filter. The read-only badge stays visible in the toolbar.',
  },
] as const satisfies ReadonlyArray<{id: ControlId; label: string; description: string}>

const DEFAULT_CONTROL_VISIBILITY: Record<ControlId, ControlVisibility> = {
  source: 'pinned',
  xAxis: 'pinned',
  chartType: 'pinned',
  groupBy: 'pinned',
  timeBucket: 'pinned',
  metric: 'overflow',
  filters: 'overflow',
  dateRange: 'overflow',
}

const VISIBILITY_OPTIONS = [
  {id: 'pinned', label: 'Pin', shortLabel: 'P'},
  {id: 'overflow', label: 'Ellipsis', shortLabel: 'E'},
  {id: 'hidden', label: 'Hidden', shortLabel: 'H'},
] as const satisfies ReadonlyArray<{id: ControlVisibility; label: string; shortLabel: string}>

const TOOLBAR_PRESETS = [
  {
    id: 'default',
    label: 'Default',
    description: 'Common inline controls with advanced settings in the ellipsis menu.',
    visibility: DEFAULT_CONTROL_VISIBILITY,
  },
  {
    id: 'overflow-first',
    label: 'Overflow first',
    description: 'Keep the toolbar clean and send all controls into the ellipsis menu.',
    visibility: {
      source: 'overflow',
      xAxis: 'overflow',
      chartType: 'overflow',
      groupBy: 'overflow',
      timeBucket: 'overflow',
      metric: 'overflow',
      filters: 'overflow',
      dateRange: 'overflow',
    } satisfies Record<ControlId, ControlVisibility>,
  },
  {
    id: 'show-all',
    label: 'Show all',
    description: 'Expose every direct control except the date-range badge behavior.',
    visibility: {
      source: 'pinned',
      xAxis: 'pinned',
      chartType: 'pinned',
      groupBy: 'pinned',
      timeBucket: 'pinned',
      metric: 'pinned',
      filters: 'pinned',
      dateRange: 'pinned',
    } satisfies Record<ControlId, ControlVisibility>,
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Compact embed with only the most common controls pinned.',
    visibility: {
      source: 'hidden',
      xAxis: 'hidden',
      chartType: 'pinned',
      groupBy: 'pinned',
      timeBucket: 'pinned',
      metric: 'overflow',
      filters: 'overflow',
      dateRange: 'overflow',
    } satisfies Record<ControlId, ControlVisibility>,
  },
] as const

/**
 * Kitchen sink chart: a docs-style playground for ChartToolbar configuration.
 * Uses multi-source mode and lets you programmatically preview pinned, overflow, and hidden controls.
 */
export function KitchenSinkChart() {
  const chart = useChart({
    sources: playgroundSources,
  })
  const [controlVisibility, setControlVisibility] =
    useState<Record<ControlId, ControlVisibility>>(DEFAULT_CONTROL_VISIBILITY)
  const [activeControlId, setActiveControlId] = useState<ControlId>('chartType')

  // Derive the exact ChartToolbar props from the interactive playground state.
  const pinned = useMemo(
    () =>
      CONTROL_OPTIONS.filter(({id}) => controlVisibility[id] === 'pinned').map(({id}) => id),
    [controlVisibility],
  )
  const hidden = useMemo(
    () =>
      CONTROL_OPTIONS.filter(({id}) => controlVisibility[id] === 'hidden').map(({id}) => id),
    [controlVisibility],
  )
  const overflow = useMemo(
    () =>
      CONTROL_OPTIONS.filter(({id}) => controlVisibility[id] === 'overflow').map(({id}) => id),
    [controlVisibility],
  )
  const activeControl = CONTROL_OPTIONS.find(({id}) => id === activeControlId) ?? CONTROL_OPTIONS[0]

  // Show the exact programmatic API users would write in their own app.
  const toolbarSnippet = useMemo(() => {
    const props = [
      pinned.length > 0 ? `pinned={[${pinned.map(id => `'${id}'`).join(', ')}]}` : null,
      hidden.length > 0 ? `hidden={[${hidden.map(id => `'${id}'`).join(', ')}]}` : null,
    ].filter(Boolean)

    return props.length === 0 ? '<ChartToolbar />' : `<ChartToolbar ${props.join(' ')} />`
  }, [hidden, pinned])

  return (
    <Chart chart={chart} className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">ChartToolbar playground</h2>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  The editor on the right exists only to explore the API. In real usage, you choose
                  ` pinned ` and ` hidden ` in your own code and pass them to ` ChartToolbar `.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill label="Pinned" value={pinned.length} tone="foreground" />
                <Pill label="Ellipsis" value={overflow.length} tone="muted" />
                <Pill label="Hidden" value={hidden.length} tone="muted" />
              </div>
            </div>
          </div>

          {/* Live preview stays above the fold so changes are visible while tweaking the side panel. */}
          <div className="rounded-2xl border border-border bg-background p-4">
            <ChartToolbar pinned={pinned} hidden={hidden} />
            <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-3">
              <ChartCanvas height={360} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Programmatic API</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anything not listed in ` pinned ` or ` hidden ` automatically lives in the
                  ellipsis menu.
                </p>
              </div>
            </div>

            <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-foreground">
              <code>{toolbarSnippet}</code>
            </pre>
          </div>

          <details className="rounded-2xl border border-border bg-background p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
              Live chart state
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Useful for checking that the same underlying chart state updates no matter where a
              control is rendered.
            </p>
            <div className="mt-4">
              <ChartDebug />
            </div>
          </details>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Toolbar editor</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click a control, then decide whether it is pinned, tucked into the ellipsis, or
                  fully hidden.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setControlVisibility(DEFAULT_CONTROL_VISIBILITY)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Reset
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {TOOLBAR_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setControlVisibility(preset.visibility)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_132px] border-b border-border bg-card px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Control</span>
                <span className="text-center">State</span>
              </div>

              <div className="divide-y divide-border">
                {CONTROL_OPTIONS.map(control => (
                  <div
                    key={control.id}
                    className={`grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 px-3 py-2.5 transition-colors ${
                      activeControlId === control.id ? 'bg-card/70' : 'bg-background'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveControlId(control.id)}
                      className="min-w-0 text-left"
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {control.label}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{control.id}</div>
                    </button>

                    <div className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-background p-1">
                      {VISIBILITY_OPTIONS.map(option => {
                        const isActive = controlVisibility[control.id] === option.id

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setControlVisibility(current => ({
                                ...current,
                                [control.id]: option.id,
                              }))
                            }
                            className={`h-7 w-9 rounded-md text-[11px] font-semibold transition-colors ${
                              isActive
                                ? 'bg-foreground text-background'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                            aria-label={`${control.label}: ${option.label}`}
                            title={option.label}
                          >
                            {option.shortLabel}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{activeControl.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{activeControl.description}</p>
                </div>

                <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {controlVisibility[activeControl.id]}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 xl:grid-cols-1">
              <SummaryGroup title="Pinned" values={pinned} />
              <SummaryGroup title="Ellipsis" values={overflow} />
              <SummaryGroup title="Hidden" values={hidden} />
            </div>
          </div>
        </div>
      </div>
    </Chart>
  )
}

type PillProps = {
  label: string
  value: number
  tone: 'foreground' | 'muted'
}

/**
 * Compact count pill used in the kitchen sink summary row.
 */
function Pill({label, value, tone}: PillProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        tone === 'foreground'
          ? 'border-foreground/15 bg-foreground/5 text-foreground'
          : 'border-border bg-card text-muted-foreground'
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-background px-1.5 py-0.5 font-semibold text-foreground">
        {value}
      </span>
    </div>
  )
}

type SummaryGroupProps = {
  title: string
  values: readonly string[]
}

/**
 * Small textual summary for the current toolbar distribution.
 */
function SummaryGroup({title, values}: SummaryGroupProps) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{values.length > 0 ? values.join(', ') : 'None'}</p>
    </div>
  )
}
