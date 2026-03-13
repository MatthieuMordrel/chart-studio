/**
 * Chart type selector — inline toggle buttons with variant dropdown.
 *
 * Primary types: Bar, Line, Area, Pie, Donut.
 * Types with variants show a small chevron that opens a dropdown:
 *   Bar  → Stacked, Grouped, 100%
 *   Area → Stacked, 100%
 */

import {useRef, useMemo, useState} from 'react'
import {ChevronDown} from 'lucide-react'
import type {ChartType} from '../core/types.js'
import {useChartContext} from './chart-context.js'
import {ChartDropdownPanel} from './chart-dropdown.js'

// ---------------------------------------------------------------------------
// Grouping definition (UI-only)
// ---------------------------------------------------------------------------

type ChartTypeVariant = {type: ChartType; label: string}

type ChartTypeGroup = {
  primary: ChartType
  label: string
  variants: ChartTypeVariant[]
}

const CHART_TYPE_GROUPS: ChartTypeGroup[] = [
  {
    primary: 'bar',
    label: 'Bar',
    variants: [
      {type: 'bar', label: 'Stacked'},
      {type: 'grouped-bar', label: 'Grouped'},
      {type: 'percent-bar', label: '100%'},
    ],
  },
  {
    primary: 'line',
    label: 'Line',
    variants: [],
  },
  {
    primary: 'area',
    label: 'Area',
    variants: [
      {type: 'area', label: 'Stacked'},
      {type: 'percent-area', label: '100%'},
    ],
  },
  {
    primary: 'pie',
    label: 'Pie',
    variants: [],
  },
  {
    primary: 'donut',
    label: 'Donut',
    variants: [],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type VisibleGroup = ChartTypeGroup & {visibleVariants: ChartTypeVariant[]}

function buildVisibleGroups(availableChartTypes: ChartType[]): VisibleGroup[] {
  const available = new Set(availableChartTypes)
  const result: VisibleGroup[] = []

  for (const group of CHART_TYPE_GROUPS) {
    if (group.variants.length === 0) {
      if (available.has(group.primary)) {
        result.push({...group, visibleVariants: []})
      }
    } else {
      const visibleVariants = group.variants.filter((v) => available.has(v.type))
      if (visibleVariants.length > 0) {
        result.push({...group, visibleVariants})
      }
    }
  }

  return result
}

function findGroupForType(chartType: ChartType): ChartTypeGroup | undefined {
  return CHART_TYPE_GROUPS.find(
    (g) => g.primary === chartType || g.variants.some((v) => v.type === chartType),
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Inline toggle buttons with variant dropdown for chart type selection. */
export function ChartTypeSelector({className}: {className?: string}) {
  const {chartType, setChartType, availableChartTypes} = useChartContext()
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const visibleGroups = useMemo(
    () => buildVisibleGroups(availableChartTypes),
    [availableChartTypes],
  )

  const activeGroup = useMemo(() => {
    const staticGroup = findGroupForType(chartType)
    if (!staticGroup) return undefined
    return visibleGroups.find((g) => g.primary === staticGroup.primary)
  }, [chartType, visibleGroups])

  if (visibleGroups.length <= 1 && (activeGroup?.visibleVariants.length ?? 0) <= 1) return null

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border/50 bg-background p-0.5 shadow-sm ${className ?? ''}`}
      role="tablist"
      aria-label="Chart type"
    >
      {visibleGroups.map((group) => {
        const isActive = activeGroup?.primary === group.primary
        const hasVariants = group.visibleVariants.length > 1
        return (
          <ChartTypeButton
            key={group.primary}
            group={group}
            isActive={isActive}
            hasVariants={hasVariants}
            isDropdownOpen={openGroup === group.primary}
            chartType={chartType}
            onSelect={() => {
              if (isActive) return
              if (availableChartTypes.includes(group.primary)) {
                setChartType(group.primary)
              } else if (group.visibleVariants.length > 0) {
                setChartType(group.visibleVariants[0]!.type)
              }
            }}
            onToggleDropdown={() => setOpenGroup(openGroup === group.primary ? null : group.primary)}
            onSelectVariant={(type) => {
              setChartType(type)
              setOpenGroup(null)
            }}
            onCloseDropdown={() => setOpenGroup(null)}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Button with optional chevron + dropdown
// ---------------------------------------------------------------------------

function ChartTypeButton({
  group,
  isActive,
  hasVariants,
  isDropdownOpen,
  chartType,
  onSelect,
  onToggleDropdown,
  onSelectVariant,
  onCloseDropdown,
}: {
  group: VisibleGroup
  isActive: boolean
  hasVariants: boolean
  isDropdownOpen: boolean
  chartType: ChartType
  onSelect: () => void
  onToggleDropdown: () => void
  onSelectVariant: (type: ChartType) => void
  onCloseDropdown: () => void
}) {
  const triggerRef = useRef<HTMLDivElement>(null)

  if (!hasVariants) {
    return (
      <button
        role="tab"
        aria-selected={isActive}
        onClick={onSelect}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
        }`}
      >
        {group.label}
      </button>
    )
  }

  return (
    <div
      ref={triggerRef}
      className={`relative flex items-center rounded-md transition-all ${
        isActive
          ? 'bg-primary/10'
          : 'hover:bg-muted/40'
      }`}
    >
      <button
        role="tab"
        aria-selected={isActive}
        onClick={() => {
          if (isActive) {
            onToggleDropdown()
          } else {
            onSelect()
          }
        }}
        className={`py-1 pl-2.5 pr-1 text-xs font-medium transition-colors ${
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {group.label}
      </button>

      <button
        aria-label={`${group.label} options`}
        onClick={(e) => {
          e.stopPropagation()
          if (!isActive) onSelect()
          onToggleDropdown()
        }}
        className={`py-1 pr-2 pl-0.5 transition-colors ${
          isActive
            ? 'text-primary/60 hover:text-primary'
            : 'text-muted-foreground/40 hover:text-muted-foreground'
        }`}
      >
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      <ChartDropdownPanel
        isOpen={isDropdownOpen}
        onClose={onCloseDropdown}
        triggerRef={triggerRef}
        minWidth="trigger"
        className="p-1"
      >
        {group.visibleVariants.map((variant) => (
          <button
            key={variant.type}
            onClick={() => onSelectVariant(variant.type)}
            className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-xs transition-colors ${
              variant.type === chartType
                ? 'bg-primary/8 font-medium text-primary'
                : 'text-foreground hover:bg-muted/60'
            }`}
          >
            {variant.label}
          </button>
        ))}
      </ChartDropdownPanel>
    </div>
  )
}
