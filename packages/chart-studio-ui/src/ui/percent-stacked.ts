type ChartPoint = Record<string, string | number | null>

type StackEntry = {
  value?: unknown
  payload?: unknown
}

/**
 * Recharts stacked graphical entries expose [lower, upper] bounds after
 * stackOffset="expand". The visible segment size is upper - lower.
 */
export function getPercentStackedProportion(entry: Pick<StackEntry, 'value'>): number | null {
  const value = entry.value
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return value[1] - value[0]
  }
  return null
}

/**
 * Recharts tooltip payload entries are rebuilt from the raw transformed row,
 * so value stays as the raw metric and payload contains the full bucket.
 */
export function getPercentStackedProportionFromPayload(
  payload: unknown,
  dataKey: string,
  seriesKeys: readonly string[],
): number | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const point = payload as ChartPoint
  const rawValue = point[dataKey]
  if (typeof rawValue !== 'number') {
    return null
  }

  let total = 0
  for (const seriesKey of seriesKeys) {
    const seriesValue = point[seriesKey]
    if (typeof seriesValue === 'number') {
      total += seriesValue
    }
  }

  if (total <= 0) {
    return null
  }

  return rawValue / total
}

/**
 * Prefer the raw-row calculation because it works for both tooltip payloads
 * and label entries, then fall back to stacked bounds when present.
 */
export function getPercentStackedDisplayValue(
  entry: StackEntry,
  dataKey: string,
  seriesKeys: readonly string[],
): number | null {
  return getPercentStackedProportionFromPayload(entry.payload, dataKey, seriesKeys) ?? getPercentStackedProportion(entry)
}
