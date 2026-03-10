/**
 * Overflow menu for toolbar controls — Notion-inspired configuration panel.
 *
 * Renders an ellipsis button that opens a panel with all non-pinned controls.
 * Simple controls (selects, toggle buttons) render inline in rows.
 * Complex controls (metric, filters, date range) show as clickable rows that
 * navigate to a full-page detail view within the panel (Notion-style drill-down).
 */

import {useRef, useState} from 'react'
import {ArrowLeft, ChevronRight, Ellipsis, Eraser} from 'lucide-react'
import {getMetricLabel} from '../core/metric-utils.js'
import {useChartContext} from './chart-context.js'
import {ChartDropdownPanel} from './chart-dropdown.js'
import {ChartDateRangePanel, resolvePresetLabel} from './chart-date-range-panel.js'
import {ChartFiltersPanel} from './chart-filters-panel.js'
import {ChartMetricPanel} from './chart-metric-panel.js'
import type {ControlId, ControlSection} from './toolbar-types.js'
import {CONTROL_IDS, CONTROL_REGISTRY, SECTIONS} from './toolbar-types.js'

/** Controls that drill-down into a detail page instead of rendering inline. */
const COMPLEX_CONTROLS = new Set<ControlId>(['metric', 'filters', 'dateRange'])

/**
 * Props for ChartToolbarOverflow.
 *
 * @property pinned - Controls shown outside the overflow (excluded from menu)
 * @property hidden - Controls completely hidden everywhere
 * @property className - Additional CSS classes
 */
type ChartToolbarOverflowProps = {
  pinned: ReadonlySet<ControlId>
  hidden: ReadonlySet<ControlId>
  className?: string
}

/**
 * Ellipsis overflow menu with Notion-style drill-down navigation.
 * Main view shows all controls. Clicking a complex control replaces
 * the panel content with that control's detail page + back button.
 */
export function ChartToolbarOverflow({pinned, hidden, className}: ChartToolbarOverflowProps) {
  const [isOpen, setIsOpen] = useState(false)
  /** null = main menu, ControlId = detail page for that control */
  const [activePage, setActivePage] = useState<ControlId | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Collect overflow controls (not pinned, not hidden) grouped by section
  const sectionGroups = SECTIONS.map((section) => {
    const controls = CONTROL_IDS.filter((id) => {
      if (pinned.has(id) || hidden.has(id)) return false
      return CONTROL_REGISTRY[id].section === section.id
    })
    return {section, controls}
  }).filter((g) => g.controls.length > 0)

  if (sectionGroups.length === 0) return null

  const handleClose = () => {
    setIsOpen(false)
    setActivePage(null)
  }

  const handleToggle = () => {
    if (isOpen) {
      handleClose()
      return
    }
    setIsOpen(true)
  }

  return (
    <div className={className}>
      {/* Trigger — ellipsis button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
          isOpen
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        aria-label="Chart settings"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {/* Popover panel — fixed position to escape any parent overflow/clipping */}
      <ChartDropdownPanel
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
        align="right"
        width={320}
        repositionKey={activePage ?? 'main'}
        className="flex min-h-[280px] max-h-[min(480px,80vh)] flex-col"
      >
        {activePage === null ? (
          <MainMenu sectionGroups={sectionGroups} onNavigate={setActivePage} />
        ) : (
          <DetailPage controlId={activePage} onBack={() => setActivePage(null)} />
        )}
      </ChartDropdownPanel>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main menu view
// ---------------------------------------------------------------------------

/** Main menu showing all controls organized by section. */
function MainMenu({
  sectionGroups,
  onNavigate,
}: {
  sectionGroups: Array<{
    section: {id: ControlSection; label: string}
    controls: readonly ControlId[]
  }>
  onNavigate: (id: ControlId) => void
}) {
  return (
    <>
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="text-xs font-semibold text-foreground">Chart configuration</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          Customize how your data is displayed
        </div>
      </div>

      {/* Sections — scrollable */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        onWheel={(e) => e.stopPropagation()}
      >
        {sectionGroups.map(({section, controls}, groupIdx) => (
          <div key={section.id}>
            {groupIdx > 0 && <div className="mx-2 my-1.5 border-t border-border" />}
            <div className="px-2 pb-1 pt-2">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-1">
                {controls.map((id) =>
                  COMPLEX_CONTROLS.has(id) ? (
                    <ComplexControlRow key={id} controlId={id} onNavigate={() => onNavigate(id)} />
                  ) : (
                    <SimpleControlRow key={id} controlId={id} />
                  ),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Detail page view (drill-down)
// ---------------------------------------------------------------------------

/** Full-page detail view for a complex control, with back navigation. */
function DetailPage({controlId, onBack}: {controlId: ControlId; onBack: () => void}) {
  const entry = CONTROL_REGISTRY[controlId]
  const {filters, clearAllFilters} = useChartContext()
  const filterActiveCount =
    controlId === 'filters' ? [...filters.values()].reduce((sum, set) => sum + set.size, 0) : 0

  return (
    <>
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          onClick={onBack}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        {controlId === 'filters' ? (
          <>
            <div className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
              {filterActiveCount > 0 && (
                <span className="text-muted-foreground">
                  {filterActiveCount} filter{filterActiveCount !== 1 ? 's' : ''} active ·{' '}
                </span>
              )}
              Filters
            </div>
            {filterActiveCount > 0 && (
              <button
                onClick={() => clearAllFilters()}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear all filters"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="text-xs font-semibold text-foreground">{entry.label}</div>
        )}
      </div>

      {/* Panel content — scrollable, flex-1 fills remaining height */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
        onWheel={(e) => e.stopPropagation()}
      >
        {controlId === 'metric' && <ChartMetricPanel />}
        {controlId === 'filters' && <ChartFiltersPanel showHeader={false} />}
        {controlId === 'dateRange' && <ChartDateRangePanel />}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Control rows
// ---------------------------------------------------------------------------

/**
 * A simple control row — label on the left, component on the right.
 * Used for selects and toggle buttons that work inline without popovers.
 */
function SimpleControlRow({controlId}: {controlId: ControlId}) {
  const entry = CONTROL_REGISTRY[controlId]
  const Component = entry.component

  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1.5">
      <div className="shrink-0 text-xs text-muted-foreground">{entry.label}</div>
      <div className="ml-auto flex min-w-0 items-center">
        <Component />
      </div>
    </div>
  )
}

/**
 * A clickable row for complex controls — navigates to detail page on click.
 * Shows the control label, current value summary, and a chevron.
 */
function ComplexControlRow({
  controlId,
  onNavigate,
}: {
  controlId: ControlId
  onNavigate: () => void
}) {
  const entry = CONTROL_REGISTRY[controlId]

  return (
    <button
      onClick={onNavigate}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <div className="shrink-0 text-xs text-muted-foreground">{entry.label}</div>
      <div className="ml-auto truncate text-xs text-foreground">
        <ControlSummary controlId={controlId} />
      </div>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  )
}

/** Summary text for a complex control in the main menu. */
function ControlSummary({controlId}: {controlId: ControlId}) {
  const {metric, columns, filters, dateRangeFilter} = useChartContext()

  switch (controlId) {
    case 'metric':
      return <span>{getMetricLabel(metric, columns)}</span>
    case 'filters': {
      const count = [...filters.values()].reduce((sum, set) => sum + set.size, 0)
      return <span>{count > 0 ? `${count} active` : 'None'}</span>
    }
    case 'dateRange':
      return <span>{resolvePresetLabel(dateRangeFilter)}</span>
    default:
      return null
  }
}
