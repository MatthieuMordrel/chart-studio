/**
 * Data transformation pipeline.
 *
 * Pure functions that transform raw data into chart-ready format.
 * Pipeline: Raw Data -> Filter -> Bucket by X-axis -> Pivot by groupBy -> Aggregate -> Sort
 */

import {getSeriesColor} from './colors.js'
import {buildDataPoints} from './pipeline-data-points.js'
import {getStringValue} from './pipeline-helpers.js'
import type {
  AvailableFilter,
  BooleanColumn,
  CategoryColumn,
  ChartColumn,
  ChartSeries,
  FilterState,
  Metric,
  NumberColumn,
  SortConfig,
  TimeBucket,
  TransformedDataPoint,
} from './types.js'

/**
 * Input for the transformation pipeline.
 *
 * @property data - Raw data items
 * @property columns - Column definitions
 * @property xAxisId - Active X-axis column ID
 * @property groupById - Active groupBy column ID (null = no grouping)
 * @property metric - What the Y-axis measures
 * @property timeBucket - Time bucket size for date X-axes
 * @property filters - Active filter state
 * @property sorting - Sort configuration
 */
export type PipelineInput<T> = {
  data: T[]
  columns: ChartColumn<T>[]
  xAxisId: string
  groupById: string | null
  metric: Metric
  timeBucket: TimeBucket
  filters: FilterState
  sorting: SortConfig | null
}

/**
 * Output of the transformation pipeline.
 *
 * @property data - Transformed data points ready for recharts
 * @property series - Series definitions for rendering
 * @property groups - Unique group labels
 */
export type PipelineOutput = {
  data: TransformedDataPoint[]
  series: ChartSeries[]
  groups: string[]
}

/**
 * Apply active filters to the raw data.
 * Filters are AND-combined across columns and OR-combined within a column.
 *
 * @param data - Raw data items
 * @param columns - Column definitions used to read values
 * @param filters - Active filter state
 * @returns Filtered data items
 */
export function applyFilters<T>(data: T[], columns: ChartColumn<T>[], filters: FilterState): T[] {
  if (filters.size === 0) return data

  return data.filter((item) => {
    for (const [columnId, activeValues] of filters) {
      if (activeValues.size === 0) continue

      const column = columns.find((candidate) => candidate.id === columnId)
      if (!column) continue

      if (!activeValues.has(getStringValue(item, column))) {
        return false
      }
    }

    return true
  })
}

/**
 * Apply sorting to transformed data points.
 *
 * @param data - Aggregated chart data points
 * @param sorting - Explicit sort configuration
 * @param isTimeSeries - Whether the X-axis is date-based
 * @returns Sorted chart data points
 */
function applySorting(
  data: TransformedDataPoint[],
  sorting: SortConfig | null,
  isTimeSeries: boolean,
): TransformedDataPoint[] {
  if (isTimeSeries) {
    return data.toSorted((a, b) => String(a['xKey']).localeCompare(String(b['xKey'])))
  }

  if (!sorting) {
    return data.toSorted((a, b) => getPointTotal(b) - getPointTotal(a))
  }

  const direction = sorting.direction === 'asc' ? 1 : -1
  return data.toSorted((a, b) => {
    const aValue = a[sorting.key] ?? 0
    const bValue = b[sorting.key] ?? 0

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction
    }

    return String(aValue).localeCompare(String(bValue)) * direction
  })
}

/**
 * Sum all numeric series values for a transformed data point.
 *
 * @param point - Transformed chart data point
 * @returns Combined numeric total across series keys
 */
function getPointTotal(point: TransformedDataPoint): number {
  return Object.entries(point)
    .filter(([key]) => key !== 'xLabel' && key !== 'xKey')
    .reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0)
}

/**
 * Build recharts series definitions from group labels.
 *
 * @param groups - Group labels returned by the pivot step
 * @param metricLabel - Human-readable label for the selected metric
 * @param useShadcn - Whether to use shadcn-compatible color variables
 * @returns Recharts series metadata
 */
function buildSeries(groups: string[], metricLabel: string, useShadcn = true): ChartSeries[] {
  return groups.map((group, index) => ({
    dataKey: group,
    label: group === 'value' ? metricLabel : group,
    color: getSeriesColor(index, useShadcn),
  }))
}

/**
 * Run the full transformation pipeline.
 *
 * Raw Data -> Filter -> Bucket -> Pivot -> Aggregate -> Sort -> Output
 *
 * @param input - Pipeline configuration and source data
 * @returns Transformed data, series metadata, and group labels
 */
export function runPipeline<T>(input: PipelineInput<T>): PipelineOutput {
  const {data, columns, xAxisId, groupById, metric, timeBucket, filters, sorting} = input

  const xColumn = columns.find((column) => column.id === xAxisId)
  if (!xColumn) return {data: [], series: [], groups: []}

  const groupByColumn = groupById
    ? (columns.find((column) => column.id === groupById) ?? null)
    : null
  const numberColumns = columns.filter(
    (column): column is NumberColumn<T> => column.type === 'number',
  )
  const filtered = applyFilters(data, columns, filters)
  const {data: points, groups} = buildDataPoints(
    filtered,
    xColumn,
    groupByColumn,
    metric,
    numberColumns,
    timeBucket,
  )

  return {
    data: applySorting(points, sorting, xColumn.type === 'date'),
    series: buildSeries(groups, metric.label),
    groups,
  }
}

/**
 * Extract available filter options from data for every category and boolean
 * column.
 *
 * @param data - Raw data items
 * @param columns - Column definitions
 * @returns Filter metadata and option counts per filterable column
 */
export function extractAvailableFilters<T>(
  data: T[],
  columns: ChartColumn<T>[],
): AvailableFilter[] {
  const filterableColumns = columns.filter(
    (column): column is CategoryColumn<T> | BooleanColumn<T> =>
      column.type === 'category' || column.type === 'boolean',
  )

  return filterableColumns.map((column) => {
    const counts = new Map<string, number>()

    for (const item of data) {
      const value = getStringValue(item, column)
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    return {
      columnId: column.id,
      label: column.label,
      type: column.type,
      options: [...counts.entries()]
        .toSorted(([, a], [, b]) => b - a)
        .map(([value, count]) => ({value, label: value, count})),
    }
  })
}
