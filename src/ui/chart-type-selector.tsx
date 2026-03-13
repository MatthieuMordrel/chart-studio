/**
 * Chart type selector — two-level toggle: primary type + variant sub-selector.
 *
 * Primary types: Bar, Line, Area, Pie, Donut.
 * Variants (shown only when the active primary has more than one available):
 *   Bar  → Stacked, Grouped, 100%
 *   Area → Stacked, 100%
 */

import {useMemo} from 'react'
import type {ChartType} from '../core/types.js'
import {useChartContext} from './chart-context.js'

// ---------------------------------------------------------------------------
// Grouping definition (UI-only)
// ---------------------------------------------------------------------------

type ChartTypeVariant = {type: ChartType; label: string}

type ChartTypeGroup = {
  /** The "base" chart type that represents this group. */
  primary: ChartType
  /** Label shown on the primary toggle button. */
  label: string
  /** Variant options within this group (empty = no sub-selector). */
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
      // No variants — show if the primary is available.
      if (available.has(group.primary)) {
        result.push({...group, visibleVariants: []})
      }
    } else {
      // Has variants — show if at least one variant is available.
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

/** Two-level toggle buttons to select the chart type. */
export function ChartTypeSelector({className}: {className?: string}) {
  const {chartType, setChartType, availableChartTypes} = useChartContext()

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
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {/* Primary type selector */}
      <div
        className="inline-flex items-center rounded-lg border border-border/50 bg-muted/50 p-0.5 shadow-sm"
        role="tablist"
        aria-label="Chart type"
      >
        {visibleGroups.map((group) => {
          const isActive = activeGroup?.primary === group.primary
          return (
            <button
              key={group.primary}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (isActive) return
                // Select the group's primary type, or its first available variant
                if (availableChartTypes.includes(group.primary)) {
                  setChartType(group.primary)
                } else if (group.visibleVariants.length > 0) {
                  setChartType(group.visibleVariants[0].type)
                }
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              }`}
            >
              {group.label}
            </button>
          )
        })}
      </div>

      {/* Variant sub-selector — only shown when the active group has multiple visible variants */}
      {activeGroup && activeGroup.visibleVariants.length > 1 && (
        <div
          className="inline-flex items-center rounded-md border border-border/30 bg-muted/30 p-0.5"
          role="tablist"
          aria-label={`${activeGroup.label} variant`}
        >
          {activeGroup.visibleVariants.map((variant) => {
            const isActive = variant.type === chartType
            return (
              <button
                key={variant.type}
                role="tab"
                aria-selected={isActive}
                onClick={() => setChartType(variant.type)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                }`}
              >
                {variant.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
