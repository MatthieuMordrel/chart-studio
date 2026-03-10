/**
 * Chart filters — compact button that shows active filter count.
 * Clicking reveals a popover wrapping ChartFiltersPanel.
 */

import {useRef, useState} from 'react'
import {Filter} from 'lucide-react'
import {useChartContext} from './chart-context.js'
import {ChartDropdownPanel} from './chart-dropdown.js'
import {ChartFiltersPanel} from './chart-filters-panel.js'

/**
 * Compact filter button + dropdown for all filterable columns.
 * Shows a count badge when filters are active.
 */
export function ChartFilters({className}: {className?: string}) {
  const {availableFilters, filters} = useChartContext()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (availableFilters.length === 0) return null

  const activeCount = [...filters.values()].reduce((sum, set) => sum + set.size, 0)
  const isActive = activeCount > 0

  return (
    <div className={className}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 ${
          isActive
            ? 'border-primary/30 bg-primary/5 text-primary shadow-sm shadow-primary/5 hover:bg-primary/8'
            : 'border-border/50 bg-background text-muted-foreground shadow-sm hover:border-border hover:bg-muted/30 hover:shadow hover:text-foreground'
        }`}
      >
        <Filter className="h-3 w-3" />
        Filters
        {isActive && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <ChartDropdownPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        width={288}
        className="max-h-[420px] overflow-y-auto overscroll-contain p-3"
      >
        <ChartFiltersPanel />
      </ChartDropdownPanel>
    </div>
  )
}
