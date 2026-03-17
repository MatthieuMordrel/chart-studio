/**
 * Filters panel content — reusable by both ChartFilters (inside a popover)
 * and ChartToolbarOverflow (rendered inline).
 *
 * Shows filterable columns as collapsible sections with checkbox options.
 * Each column section can be expanded/collapsed independently.
 */

import {useLayoutEffect, useRef, useState} from 'react'
import {ChevronDown, Eraser, Search, X} from 'lucide-react'
import {useChartContext} from './chart-context.js'

/** Maximum number of options to show per column before collapsing. */
const MAX_VISIBLE_OPTIONS = 6

/**
 * Filters panel content (no popover wrapper).
 *
 * @property className - Additional CSS classes
 * @property showHeader - When true (default), shows "Filters" title + clear button.
 *   Set false when the header is rendered by the parent (e.g. overflow DetailPage).
 */
export function ChartFiltersPanel({
  className,
  showHeader = true,
}: {
  className?: string
  showHeader?: boolean
}) {
  const {availableFilters, filters, toggleFilter, clearAllFilters} = useChartContext()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Count total active filters
  const activeCount = [...filters.values()].reduce((sum, set) => sum + set.size, 0)

  // Flat list of active filter badges for the bottom badge row
  const activeBadges = availableFilters.flatMap((af) => {
    const active = filters.get(af.columnId)
    if (!active?.size) return []
    return [...active].map((value) => {
      const option = af.options.find((o) => o.value === value)
      return {columnId: af.columnId, value, label: `${af.label}: ${option?.label ?? value}`}
    })
  })

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const isSearching = normalizedQuery.length > 0

  // When searching, filter each section's options and hide sections with no matches
  const filteredSections = availableFilters.map((filter) => {
    if (!isSearching) return {filter, matchedOptions: filter.options}
    const matchedOptions = filter.options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    )
    return {filter, matchedOptions}
  })

  const visibleSections = isSearching
    ? filteredSections.filter((s) => s.matchedOptions.length > 0)
    : filteredSections

  if (availableFilters.length === 0) {
    return (
      <div className={className}>
        <div className="py-6 text-center text-xs text-muted-foreground">No filterable columns</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header — always renders same structure to avoid layout shift */}
      {showHeader && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="truncate text-xs font-semibold text-foreground">Filters</div>
          <button
            onClick={() => clearAllFilters()}
            disabled={activeCount === 0}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors enabled:hover:bg-muted enabled:hover:text-foreground disabled:opacity-0"
            aria-label="Clear all filters"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search filters…"
          className="h-8 w-full rounded-lg border border-border/50 bg-muted/30 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20"
          aria-label="Search filters"
        />
        {isSearching && (
          <button
            onClick={() => {
              setSearchQuery('')
              searchInputRef.current?.focus()
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* No results message */}
      {isSearching && visibleSections.length === 0 && (
        <div className="py-4 text-center text-xs text-muted-foreground">
          No filters matching &ldquo;{searchQuery.trim()}&rdquo;
        </div>
      )}

      {/* Filter sections — no inner scroll, parent handles scrolling */}
      <div className="space-y-1">
        {visibleSections.map(({filter, matchedOptions}) => (
          <FilterSection
            key={filter.columnId}
            filter={filter}
            matchedOptions={matchedOptions}
            isSearching={isSearching}
            activeValues={filters.get(filter.columnId)}
            onToggle={(value) => toggleFilter(filter.columnId, value)}
          />
        ))}
      </div>

      {/* Active filter badges — at bottom so they never shift content above */}
      {activeCount > 0 && (
        <div className="mt-2 border-t border-border/40 pt-2">
          <BadgeRow badges={activeBadges} onRemove={toggleFilter} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export type BadgeItem = {columnId: string; value: string; label: string}

/**
 * Renders filter badges that fit within 2 rows, with a "+N" overflow pill
 * for badges that don't fit. Measures after layout to determine the cutoff.
 */
export function BadgeRow({
  badges,
  onRemove,
}: {
  badges: BadgeItem[]
  onRemove: (columnId: string, value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // null = not yet measured (first render shows all for measurement)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  // Measure on every badge change. useLayoutEffect runs before paint,
  // so the user never sees the "all badges" measurement frame.
  useLayoutEffect(() => {
    // Reset to show all so we can measure them
    setVisibleCount(null)
  }, [badges.length])

  useLayoutEffect(() => {
    // Only measure when all badges are rendered (visibleCount === null)
    if (visibleCount !== null) return
    const container = containerRef.current
    if (!container) return

    const children = Array.from(container.children) as HTMLElement[]
    const first = children[0]
    if (!first) return

    const gap = 4 // gap-1 = 0.25rem = 4px
    const maxBottom = first.offsetTop + first.offsetHeight * 2 + gap
    const badgeCount = badges.length

    // Find first badge that falls outside 2 rows
    let fits = badgeCount
    for (let i = 0; i < badgeCount; i++) {
      const el = children[i]!
      if (el.offsetTop + el.offsetHeight > maxBottom) {
        fits = i
        break
      }
    }

    if (fits >= badgeCount) {
      setVisibleCount(badgeCount)
      return
    }

    // Account for the "+N" pill width — walk backwards until it fits on the row
    // Estimate pill width: ~30px ("+N" text + padding) + gap
    const pillSpace = 34 + gap
    let adjusted = fits
    for (let i = fits - 1; i >= 0; i--) {
      const el = children[i]!
      if (el.offsetLeft + el.offsetWidth + pillSpace <= container.clientWidth) {
        adjusted = i + 1
        break
      }
      adjusted = i
    }

    setVisibleCount(Math.max(1, adjusted))
  })

  const resolved = visibleCount ?? badges.length
  const overflowCount = badges.length - resolved

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 flex-wrap content-start items-start gap-1"
    >
      {badges.slice(0, resolved).map(({columnId, value, label}) => (
        <button
          key={`${columnId}-${value}`}
          onClick={() => onRemove(columnId, value)}
          className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <span className="max-w-[10rem] truncate">{label}</span>
          <X className="h-2.5 w-2.5 shrink-0 opacity-60" />
        </button>
      ))}
      {overflowCount > 0 && (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{overflowCount}
        </span>
      )}
    </div>
  )
}

/** A collapsible filter column section with checkable options. */
function FilterSection({
  filter,
  matchedOptions,
  isSearching,
  activeValues,
  onToggle,
}: {
  filter: {
    columnId: string
    label: string
    options: Array<{value: string; label: string; count: number}>
  }
  /** The options to display (pre-filtered by the search query). */
  matchedOptions: Array<{value: string; label: string; count: number}>
  /** Whether a search query is active — bypasses the "show more" limit. */
  isSearching: boolean
  activeValues: Set<string> | undefined
  onToggle: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // When searching, show all matched options (no truncation).
  // Otherwise, respect the expand/collapse limit.
  const visibleOptions =
    isSearching || expanded ? matchedOptions : matchedOptions.slice(0, MAX_VISIBLE_OPTIONS)
  const hasMore = !isSearching && matchedOptions.length > MAX_VISIBLE_OPTIONS
  const activeCount = activeValues?.size ?? 0

  // Auto-expand when searching so matched results are visible
  const effectiveIsOpen = isSearching || isOpen

  return (
    <div className="rounded-lg">
      {/* Section header — click to collapse/expand */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
      >
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${
            effectiveIsOpen ? '' : '-rotate-90'
          }`}
        />
        <span className="text-[11px] font-semibold text-foreground">{filter.label}</span>
        {activeCount > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[9px] font-semibold text-primary">
            {activeCount}
          </span>
        )}
      </button>

      {/* Options */}
      {effectiveIsOpen && (
        <div className="pb-1 pl-2 pr-1 pt-0.5">
          <div className="space-y-px">
            {visibleOptions.map((option) => {
              const isActive = activeValues?.has(option.value) ?? false
              return (
                <button
                  key={option.value}
                  onClick={() => onToggle(option.value)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    isActive ? 'bg-primary/8 text-primary' : 'text-foreground hover:bg-muted/60'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isActive
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30 bg-background'
                    }`}
                  >
                    {isActive && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70">
                    {option.count}
                  </span>
                </button>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 w-full rounded-md px-2 py-1 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {expanded ? 'Show less' : `Show ${matchedOptions.length - MAX_VISIBLE_OPTIONS} more…`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
