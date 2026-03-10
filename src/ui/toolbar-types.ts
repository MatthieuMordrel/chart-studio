/**
 * Toolbar control identifiers and registry.
 *
 * Each control has an ID, a label (for the overflow menu), a section
 * (for grouping in the overflow panel), and the React component to render.
 *
 * @property CONTROL_IDS - All valid control identifier strings
 * @property ControlId - Union type of all valid control identifiers
 * @property ControlEntry - Registry entry for a single toolbar control
 * @property CONTROL_REGISTRY - Ordered mapping of ControlId → ControlEntry
 */

import type {ComponentType} from 'react'
import {ChartDateRange} from './chart-date-range.js'
import {ChartFilters} from './chart-filters.js'
import {ChartGroupBySelector} from './chart-group-by-selector.js'
import {ChartMetricSelector} from './chart-metric-selector.js'
import {ChartSourceSwitcher} from './chart-source-switcher.js'
import {ChartTimeBucketSelector} from './chart-time-bucket-selector.js'
import {ChartTypeSelector} from './chart-type-selector.js'
import {ChartXAxisSelector} from './chart-x-axis-selector.js'

/** All valid toolbar control identifiers. */
export const CONTROL_IDS = [
  'source',
  'xAxis',
  'chartType',
  'groupBy',
  'timeBucket',
  'metric',
  'filters',
  'dateRange',
] as const

/** Union type of all valid toolbar control identifiers. */
export type ControlId = (typeof CONTROL_IDS)[number]

/** Section label for grouping controls in the overflow panel. */
export type ControlSection = 'data' | 'visualization' | 'filters'

/**
 * Registry entry for a single toolbar control.
 *
 * @property label - Human-readable label for the overflow menu
 * @property section - Section grouping in the overflow panel
 * @property component - React component to render
 */
export type ControlEntry = {
  label: string
  section: ControlSection
  component: ComponentType<{className?: string}>
}

/**
 * Ordered registry of all toolbar controls.
 * Controls render in this order both pinned and inside the overflow menu.
 */
export const CONTROL_REGISTRY: Record<ControlId, ControlEntry> = {
  source: {label: 'Data source', section: 'data', component: ChartSourceSwitcher},
  xAxis: {label: 'X-axis', section: 'data', component: ChartXAxisSelector},
  chartType: {label: 'Chart type', section: 'visualization', component: ChartTypeSelector},
  groupBy: {label: 'Group by', section: 'visualization', component: ChartGroupBySelector},
  timeBucket: {label: 'Time bucket', section: 'visualization', component: ChartTimeBucketSelector},
  metric: {label: 'Metric', section: 'visualization', component: ChartMetricSelector},
  filters: {label: 'Filters', section: 'filters', component: ChartFilters},
  dateRange: {label: 'Date range', section: 'filters', component: ChartDateRange},
}

/** Section metadata for the overflow panel. */
export const SECTIONS: Array<{id: ControlSection; label: string}> = [
  {id: 'data', label: 'Data'},
  {id: 'visualization', label: 'Visualization'},
  {id: 'filters', label: 'Filters'},
]
