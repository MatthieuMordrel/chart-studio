import type {ChartColumn, DateColumn, FilterState} from './types.js'

/**
 * Resolve the active X-axis, preferring date columns first.
 */
export function resolveXAxisId<T, TColumnId extends string>(
  xAxisId: TColumnId | null,
  activeColumns: readonly ChartColumn<T, TColumnId>[],
): TColumnId | null {
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
export function resolveReferenceDateId<T, TColumnId extends string>(
  referenceDateIdRaw: TColumnId | null,
  dateColumns: readonly DateColumn<T, TColumnId>[],
  resolvedXAxisId: TColumnId | null,
  isTimeSeries: boolean,
): TColumnId | null {
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
export function sanitizeFilters<T, TColumnId extends string>(
  filters: FilterState<TColumnId>,
  activeColumns: readonly ChartColumn<T, TColumnId>[],
): FilterState<TColumnId> {
  const validColumnIds = new Set(activeColumns.map((column) => column.id))
  const next = new Map<TColumnId, Set<string>>()

  for (const [columnId, values] of filters) {
    if (!validColumnIds.has(columnId)) {
      continue
    }

    next.set(columnId, new Set(values))
  }

  return next
}
