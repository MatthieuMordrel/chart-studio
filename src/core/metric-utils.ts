import type {AggregateFunction, ChartColumn, Metric, NumberColumn} from './types.js'

/**
 * Default metric used when no numeric aggregation is selected.
 */
export const DEFAULT_METRIC: Metric = {columnId: null, aggregate: 'count', label: 'Count'}

/**
 * Human-readable label for a metric.
 */
export function getMetricLabel(columnLabel: string | null, aggregate: AggregateFunction): string {
  if (aggregate === 'count' || columnLabel === null) {
    return 'Count'
  }

  switch (aggregate) {
    case 'sum':
      return `Sum of ${columnLabel}`
    case 'avg':
      return `Avg ${columnLabel}`
    case 'min':
      return `Min ${columnLabel}`
    case 'max':
      return `Max ${columnLabel}`
  }
}

/**
 * Build the metric options available for a set of columns.
 */
export function buildAvailableMetrics<T>(columns: ChartColumn<T>[]): Metric[] {
  const metrics: Metric[] = [DEFAULT_METRIC]
  const numberColumns = columns.filter(
    (column): column is NumberColumn<T> => column.type === 'number',
  )

  for (const column of numberColumns) {
    metrics.push(
      {columnId: column.id, aggregate: 'sum', label: getMetricLabel(column.label, 'sum')},
      {columnId: column.id, aggregate: 'avg', label: getMetricLabel(column.label, 'avg')},
      {columnId: column.id, aggregate: 'min', label: getMetricLabel(column.label, 'min')},
      {columnId: column.id, aggregate: 'max', label: getMetricLabel(column.label, 'max')},
    )
  }

  return metrics
}

/**
 * Validate a metric against the active source and normalize its label.
 */
export function resolveMetric<T>(metric: Metric, columns: ChartColumn<T>[]): Metric {
  if (metric.columnId === null) {
    return DEFAULT_METRIC
  }

  if (metric.aggregate === 'count') {
    return DEFAULT_METRIC
  }

  const column = columns.find(
    (candidate): candidate is NumberColumn<T> =>
      candidate.type === 'number' && candidate.id === metric.columnId,
  )

  if (!column) {
    return DEFAULT_METRIC
  }

  return {
    ...metric,
    label: getMetricLabel(column.label, metric.aggregate),
  }
}
