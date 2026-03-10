import type {DateColumn, FilterState} from './types.js'
import type {ChartColumn} from './types.js'

/**
 * Resolve the active X-axis, preferring date columns first.
 */
export function resolveXAxisId<T>(
  xAxisId: string | null,
  activeColumns: ChartColumn<T>[],
): string | null {
  if (xAxisId && activeColumns.some((column) => column.id === xAxisId)) {
    return xAxisId
  }

  const dateColumn = activeColumns.find((column) => column.type === 'date')
  if (dateColumn) return dateColumn.id

  const categoryColumn = activeColumns.find((column) => column.type === 'category')
  if (categoryColumn) return categoryColumn.id

  return activeColumns[0]?.id ?? null
}

/**
 * Resolve the date column used for date-range filtering.
 */
export function resolveReferenceDateId<T>(
  referenceDateIdRaw: string | null,
  dateColumns: DateColumn<T>[],
  resolvedXAxisId: string | null,
  isTimeSeries: boolean,
): string | null {
  if (referenceDateIdRaw && dateColumns.some((column) => column.id === referenceDateIdRaw)) {
    return referenceDateIdRaw
  }

  if (isTimeSeries && resolvedXAxisId) {
    return resolvedXAxisId
  }

  return dateColumns[0]?.id ?? null
}

/**
 * Remove filters that target columns not present in the active source.
 */
export function sanitizeFilters<T>(
  filters: FilterState,
  activeColumns: ChartColumn<T>[],
): FilterState {
  const validColumnIds = new Set(activeColumns.map((column) => column.id))
  const next = new Map<string, Set<string>>()

  for (const [columnId, values] of filters) {
    if (!validColumnIds.has(columnId)) {
      continue
    }

    next.set(columnId, new Set(values))
  }

  return next
}
