type ChartPoint = Record<string, string | number | null>

/**
 * How data labels are drawn on stacked bar charts.
 *
 * - `'segments'` — one label per segment, showing that segment's own value (default)
 * - `'total'` — one label per stack, showing the sum of all visible segments
 */
export type StackedDataLabelMode = 'segments' | 'total'

/**
 * Sum the numeric series values of one transformed point.
 *
 * Returns `null` when no series has a numeric value so empty stacks render
 * no label at all.
 */
export function getStackTotal(point: ChartPoint, seriesKeys: readonly string[]): number | null {
  let total: number | null = null
  for (const seriesKey of seriesKeys) {
    const value = point[seriesKey]
    if (typeof value === 'number' && Number.isFinite(value)) {
      total = (total ?? 0) + value
    }
  }
  return total
}

/**
 * Pick the series whose segment reaches the outer edge of the stack on the
 * side of the total: the highest point for a positive total, the lowest for a
 * negative one.
 *
 * Recharts stacks series in order on top of the running sum (missing values
 * count as zero), so segment `i` ends at the cumulative sum of series `0..i`.
 * The first series reaching the extreme always has a value of the same sign as
 * the total, so a `'top'` label on it lands just outside the stack.
 */
export function getStackTotalAnchorKey(point: ChartPoint, seriesKeys: readonly string[]): string | null {
  const total = getStackTotal(point, seriesKeys)
  if (total == null || total === 0) {
    return null
  }

  let cumulative = 0
  let extreme: number | null = null
  let anchorKey: string | null = null
  for (const seriesKey of seriesKeys) {
    const value = point[seriesKey]
    cumulative += typeof value === 'number' && Number.isFinite(value) ? value : 0
    const isBeyondExtreme = extreme == null || (total > 0 ? cumulative > extreme : cumulative < extreme)
    if (isBeyondExtreme) {
      extreme = cumulative
      anchorKey = seriesKey
    }
  }
  return anchorKey
}

/**
 * Label value for one stacked segment in `'segments'` mode: the segment's own
 * value from the transformed point.
 *
 * Recharts' default label accessor reads the stacked `[lower, upper]` bounds
 * and returns `upper`, i.e. the running total up to that segment, so stacked
 * labels must read the raw value instead.
 */
export function getStackSegmentLabelValue(payload: unknown, dataKey: string): number | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const value = (payload as ChartPoint)[dataKey]
  return typeof value === 'number' ? value : null
}

/**
 * Label value for one stacked segment in `'total'` mode: the stack total on
 * the anchor segment, `null` (no label) on every other segment.
 */
export function getStackTotalLabelValue(
  payload: unknown,
  dataKey: string,
  seriesKeys: readonly string[],
): number | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const point = payload as ChartPoint
  return getStackTotalAnchorKey(point, seriesKeys) === dataKey ? getStackTotal(point, seriesKeys) : null
}
