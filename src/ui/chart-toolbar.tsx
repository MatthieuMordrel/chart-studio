/**
 * Composable, configurable toolbar with pinned controls and an ellipsis
 * overflow menu — inspired by Notion's clean database view toolbar.
 *
 * Default behavior: the date range stays pinned so the active time window is
 * always visible, while the remaining controls live inside the overflow menu.
 * Developers can pin additional controls to the toolbar row and hide others.
 *
 * @example
 * ```tsx
 * // Date range pinned by default, everything else in overflow
 * <ChartToolbar />
 *
 * // Pin chart type and group-by to the toolbar row
 * <ChartToolbar pinned={['chartType', 'groupBy']} />
 *
 * // Hide time bucket and x-axis entirely
 * <ChartToolbar hidden={['timeBucket', 'xAxis']} />
 *
 * // Combine both
 * <ChartToolbar pinned={['chartType', 'metric']} hidden={['source']} />
 * ```
 */

import {useMemo} from 'react'
import {ChartToolbarOverflow} from './chart-toolbar-overflow.js'
import type {ControlId} from './toolbar-types.js'
import {CONTROL_IDS, CONTROL_REGISTRY} from './toolbar-types.js'

const DEFAULT_PINNED_CONTROLS = ['dateRange'] as const satisfies readonly ControlId[]

/**
 * Props for ChartToolbar.
 *
 * @property className - Additional CSS classes for the toolbar container
 * @property pinned - Control IDs to always show in the toolbar row (outside the overflow menu)
 * @property hidden - Control IDs to completely hide (not in toolbar, not in overflow)
 */
type ChartToolbarProps = {
  className?: string
  pinned?: readonly ControlId[]
  hidden?: readonly ControlId[]
}

/**
 * Composable toolbar with pinned controls and an ellipsis overflow menu.
 *
 * Controls are rendered in registry order. Each sub-component still
 * auto-hides when not relevant (e.g. time bucket only shows for date X-axis).
 */
export function ChartToolbar({
  className,
  pinned = DEFAULT_PINNED_CONTROLS,
  hidden = [],
}: ChartToolbarProps) {
  const pinnedSet = useMemo(() => new Set(pinned), [pinned])
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])

  // Pinned controls in registry order
  const pinnedControls = CONTROL_IDS.filter((id) => pinnedSet.has(id) && !hiddenSet.has(id))

  return (
    <div className={`flex items-start justify-between gap-2 ${className ?? ''}`}>
      {/* Pinned controls wrap on the left while the overflow trigger stays anchored top-right. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {pinnedControls.map((id) => {
          const Component = CONTROL_REGISTRY[id].component
          return <Component key={id} />
        })}
      </div>

      <ChartToolbarOverflow pinned={pinnedSet} hidden={hiddenSet} className="shrink-0 self-start" />
    </div>
  )
}
