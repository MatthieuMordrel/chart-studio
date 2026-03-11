import type {
  AggregateMetric,
  CountMetric,
  ChartColumn,
  Metric,
  MetricAllowance,
  MetricConfig,
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
 * Expand declarative metric restriction entries into the normalized metric list
 * used by the runtime and typed chart state.
 */
export function normalizeMetricAllowances<TColumnId extends string>(
  allowedMetrics?: readonly MetricAllowance<TColumnId>[],
): Metric<TColumnId>[] | undefined {
  if (!allowedMetrics) {
    return undefined
  }

  const normalized: Metric<TColumnId>[] = []

  for (const allowedMetric of allowedMetrics) {
    if (allowedMetric.kind === 'count') {
      normalized.push(allowedMetric)
      continue
    }

    const aggregates = Array.isArray(allowedMetric.aggregate)
      ? allowedMetric.aggregate
      : [allowedMetric.aggregate]

    for (const aggregate of aggregates) {
      normalized.push({
        kind: 'aggregate',
        columnId: allowedMetric.columnId,
        aggregate,
        includeZeros: allowedMetric.includeZeros,
      } as AggregateMetric<TColumnId>)
    }
  }

  return normalized
}

/**
 * Apply a declarative metric whitelist to the inferred metric options.
 *
 * Metrics are matched structurally so callers can safely pass fresh object
 * literals in `config.metric.allowed`. The final order follows the declarative
 * restriction list, so the first allowed metric becomes the default.
 */
export function restrictAvailableMetrics<TColumnId extends string>(
  metrics: readonly Metric<TColumnId>[],
  config?: MetricConfig<TColumnId>,
): Metric<TColumnId>[] {
  const normalizedAllowedMetrics = normalizeMetricAllowances(config?.allowed)
  if (!normalizedAllowedMetrics) {
    const hiddenMetrics = config?.hidden
    if (!hiddenMetrics || hiddenMetrics.length === 0) {
      return [...metrics]
    }

    const visibleMetrics = metrics.filter(metric =>
      hiddenMetrics.every(hiddenMetric => !isSameMetric(metric, hiddenMetric))
    )

    return visibleMetrics.length > 0 ? visibleMetrics : [metrics[0] ?? DEFAULT_METRIC]
  }

  const allowedMetrics = normalizedAllowedMetrics.filter(allowedMetric =>
    metrics.some(metric => isSameMetric(metric, allowedMetric))
  )
  const hiddenMetrics = config?.hidden
  const restricted = !hiddenMetrics || hiddenMetrics.length === 0
    ? allowedMetrics
    : allowedMetrics.filter(metric =>
        hiddenMetrics.every(hiddenMetric => !isSameMetric(metric, hiddenMetric))
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
  configuredDefaultMetric?: Metric<TColumnId>,
): Metric<TColumnId> {
  if (availableMetrics && availableMetrics.length > 0) {
    const selectedMetric = availableMetrics.find(candidate => isSameMetric(candidate, metric))
    if (selectedMetric) {
      return selectedMetric
    }

    const defaultMetric = configuredDefaultMetric
      ? availableMetrics.find(candidate => isSameMetric(candidate, configuredDefaultMetric))
      : undefined

    return defaultMetric ?? availableMetrics[0]!
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
