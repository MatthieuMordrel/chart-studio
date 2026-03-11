import type {
  AggregateMetric,
  CountMetric,
  ChartColumn,
  Metric,
  NumberColumn,
  NumericAggregateFunction,
} from './types.js'

/**
 * Default metric used when no numeric aggregation is selected.
 */
export const DEFAULT_METRIC: CountMetric = {kind: 'count'}

/**
 * Type guard for aggregate metrics.
 */
export function isAggregateMetric<TColumnId extends string>(
  metric: Metric<TColumnId>,
): metric is AggregateMetric<TColumnId> {
  return metric.kind === 'aggregate'
}

/**
 * Compare two metric definitions for semantic equality.
 */
export function isSameMetric<TColumnId extends string>(
  left: Metric<TColumnId>,
  right: Metric<TColumnId>,
): boolean {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'count') {
    return true
  }

  return (
    right.kind === 'aggregate'
    && left.columnId === right.columnId
    && left.aggregate === right.aggregate
    && (left.includeZeros ?? true) === (right.includeZeros ?? true)
  )
}

/**
 * Human-readable label for a numeric aggregate.
 */
export function getAggregateMetricLabel(
  columnLabel: string,
  aggregate: NumericAggregateFunction,
): string {
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
 * Human-readable label for a metric.
 */
export function getMetricLabel<T, TColumnId extends string>(
  metric: Metric<TColumnId>,
  columns: readonly ChartColumn<T, TColumnId>[],
): string {
  if (!isAggregateMetric(metric)) {
    return 'Count'
  }

  const column = columns.find(
    (candidate): candidate is NumberColumn<T, TColumnId> =>
      candidate.type === 'number' && candidate.id === metric.columnId,
  )
  if (!column) {
    return 'Count'
  }

  return getAggregateMetricLabel(column.label, metric.aggregate)
}

/**
 * Build the metric options available for a set of columns.
 */
export function buildAvailableMetrics<T, TColumnId extends string>(
  columns: readonly ChartColumn<T, TColumnId>[],
): Metric<TColumnId>[] {
  const metrics: Metric<TColumnId>[] = [DEFAULT_METRIC]
  const numberColumns = columns.filter(
    (column): column is NumberColumn<T, TColumnId> => column.type === 'number',
  )

  for (const column of numberColumns) {
    metrics.push(
      {kind: 'aggregate', columnId: column.id, aggregate: 'sum'},
      {kind: 'aggregate', columnId: column.id, aggregate: 'avg'},
      {kind: 'aggregate', columnId: column.id, aggregate: 'min'},
      {kind: 'aggregate', columnId: column.id, aggregate: 'max'},
    )
  }

  return metrics
}

/**
 * Apply a declarative metric whitelist to the inferred metric options.
 *
 * Metrics are matched structurally so callers can safely pass fresh object
 * literals in `tools.metric.allowed`.
 */
export function restrictAvailableMetrics<TColumnId extends string>(
  metrics: readonly Metric<TColumnId>[],
  allowedMetrics?: readonly Metric<TColumnId>[],
): Metric<TColumnId>[] {
  if (!allowedMetrics) {
    return [...metrics]
  }

  const restricted = metrics.filter(metric =>
    allowedMetrics.some(allowedMetric => isSameMetric(metric, allowedMetric))
  )

  // A chart always needs one active metric. Fall back to the inferred default if
  // the whitelist ends up empty or does not match the active source.
  return restricted.length > 0 ? restricted : [metrics[0] ?? DEFAULT_METRIC]
}

/**
 * Validate a metric against the active source.
 */
export function resolveMetric<T, TColumnId extends string>(
  metric: Metric<TColumnId>,
  columns: readonly ChartColumn<T, TColumnId>[],
  availableMetrics?: readonly Metric<TColumnId>[],
): Metric<TColumnId> {
  if (availableMetrics && availableMetrics.length > 0) {
    return availableMetrics.find(candidate => isSameMetric(candidate, metric)) ?? availableMetrics[0]!
  }

  if (!isAggregateMetric(metric)) {
    return DEFAULT_METRIC
  }

  const column = columns.find(
    (candidate): candidate is NumberColumn<T, TColumnId> =>
      candidate.type === 'number' && candidate.id === metric.columnId,
  )

  if (!column) {
    return DEFAULT_METRIC
  }

  return metric
}
