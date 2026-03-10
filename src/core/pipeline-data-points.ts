/**
 * Bucket and aggregation steps for the chart transformation pipeline.
 */

import {isAggregateMetric} from './metric-utils.js'
import {aggregate, dateBucketKey, dateBucketLabel, getStringValue} from './pipeline-helpers.js'
import type {
  ChartColumn,
  DateColumn,
  Metric,
  NumberColumn,
  TimeBucket,
  TransformedDataPoint,
} from './types.js'

type BucketDefinition = {
  key: string
  label: string
}

type DataPointResult = {
  data: TransformedDataPoint[]
  groups: string[]
}

/**
 * Build chart-ready data points by bucketing the X-axis, pivoting groups, and
 * aggregating the selected metric.
 *
 * @param items - Filtered source data
 * @param xColumn - Active X-axis column
 * @param groupByColumn - Optional group-by column
 * @param metric - Selected metric configuration
 * @param numberColumns - Number columns available for metric lookup
 * @param timeBucket - Time bucket used for date X-axes
 * @returns Aggregated chart data points and group labels
 */
export function buildDataPoints<T, TColumnId extends string>(
  items: T[],
  xColumn: ChartColumn<T, TColumnId>,
  groupByColumn: ChartColumn<T, TColumnId> | null,
  metric: Metric<TColumnId>,
  numberColumns: NumberColumn<T, TColumnId>[],
  timeBucket: TimeBucket,
): DataPointResult {
  const groupSet = new Set<string>()
  if (groupByColumn) {
    for (const item of items) {
      groupSet.add(getStringValue(item, groupByColumn))
    }
  }

  const groups = groupByColumn ? [...groupSet].toSorted() : ['value']
  const metricColumn = isAggregateMetric(metric)
    ? (numberColumns.find((column) => column.id === metric.columnId) ?? null)
    : null

  if (xColumn.type === 'date') {
    return buildTimeBuckets(items, xColumn, groupByColumn, groups, metric, metricColumn, timeBucket)
  }

  return buildCategoryBuckets(items, xColumn, groupByColumn, groups, metric, metricColumn)
}

/**
 * Generate a continuous sequence of date buckets from the minimum to maximum
 * date found in the data.
 *
 * @param items - Filtered source data
 * @param xColumn - Active date column
 * @param bucket - Time bucket granularity
 * @returns Every bucket between the first and last date in the dataset
 */
function generateBucketsFromData<T, TColumnId extends string>(
  items: T[],
  xColumn: DateColumn<T, TColumnId>,
  bucket: TimeBucket,
): BucketDefinition[] {
  let min: Date | null = null
  let max: Date | null = null

  for (const item of items) {
    const rawValue = xColumn.accessor(item)
    if (rawValue == null) continue

    const date = new Date(rawValue)
    if (Number.isNaN(date.getTime())) continue
    if (!min || date < min) min = date
    if (!max || date > max) max = date
  }

  if (!min || !max) return []

  const buckets: BucketDefinition[] = []
  const cursor = startOfBucket(min, bucket)
  const seenKeys = new Set<string>()
  const maxBuckets = 500

  for (let bucketCount = 0; bucketCount < maxBuckets; bucketCount += 1) {
    if (cursor > max) break

    const key = dateBucketKey(cursor, bucket)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      buckets.push({key, label: dateBucketLabel(key, bucket)})
    }

    advanceBucketCursor(cursor, bucket)
  }

  return buckets
}

/**
 * Normalize a date to the start of its containing bucket.
 *
 * @param date - Source date
 * @param bucket - Time bucket granularity
 * @returns Start boundary for the bucket containing the source date
 */
function startOfBucket(date: Date, bucket: TimeBucket): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)

  switch (bucket) {
    case 'day':
      return normalized
    case 'week': {
      const day = normalized.getDay()
      normalized.setDate(normalized.getDate() - ((day + 6) % 7))
      return normalized
    }
    case 'month':
      normalized.setDate(1)
      return normalized
    case 'quarter':
      normalized.setMonth(Math.floor(normalized.getMonth() / 3) * 3, 1)
      return normalized
    case 'year':
      normalized.setMonth(0, 1)
      return normalized
  }
}

/**
 * Advance a mutable cursor by a single bucket interval.
 *
 * @param cursor - Current date cursor
 * @param bucket - Time bucket granularity
 */
function advanceBucketCursor(cursor: Date, bucket: TimeBucket) {
  switch (bucket) {
    case 'day':
      cursor.setDate(cursor.getDate() + 1)
      break
    case 'week':
      cursor.setDate(cursor.getDate() + 7)
      break
    case 'month':
      cursor.setMonth(cursor.getMonth() + 1)
      break
    case 'quarter':
      cursor.setMonth(cursor.getMonth() + 3)
      break
    case 'year':
      cursor.setFullYear(cursor.getFullYear() + 1)
      break
  }
}

/**
 * Build data points for a date X-axis.
 *
 * @param items - Filtered source data
 * @param xColumn - Active date column
 * @param groupByColumn - Optional group-by column
 * @param groups - Resolved group labels
 * @param metric - Selected metric configuration
 * @param metricColumn - Resolved numeric metric column
 * @param timeBucket - Time bucket granularity
 * @returns Aggregated date-bucketed data points
 */
function buildTimeBuckets<T, TColumnId extends string>(
  items: T[],
  xColumn: DateColumn<T, TColumnId>,
  groupByColumn: ChartColumn<T, TColumnId> | null,
  groups: string[],
  metric: Metric<TColumnId>,
  metricColumn: NumberColumn<T, TColumnId> | null,
  timeBucket: TimeBucket,
): DataPointResult {
  const allBuckets = generateBucketsFromData(items, xColumn, timeBucket)
  const accumulator = new Map<string, Map<string, number[]>>()

  for (const {key} of allBuckets) {
    const groupMap = new Map<string, number[]>()
    for (const group of groups) {
      groupMap.set(group, [])
    }
    accumulator.set(key, groupMap)
  }

  for (const item of items) {
    const rawValue = xColumn.accessor(item)
    if (rawValue == null) continue

    const date = new Date(rawValue)
    const key = dateBucketKey(date, timeBucket)
    const groupMap = accumulator.get(key)
    if (!groupMap) continue

    const group = groupByColumn ? getStringValue(item, groupByColumn) : 'value'
    const values = groupMap.get(group)
    if (!values) continue

    if (metricColumn) {
      const metricValue = metricColumn.accessor(item)
      if (metricValue != null) values.push(metricValue)
    } else {
      values.push(1)
    }
  }

  const data = allBuckets.map(({key, label}) => {
    const point: TransformedDataPoint = {xLabel: label, xKey: key}
    const groupMap = accumulator.get(key)!

    for (const group of groups) {
      point[group] = aggregate(
        groupMap.get(group) ?? [],
        metric.kind === 'aggregate' ? metric.aggregate : 'count',
        metric.kind === 'aggregate' ? (metric.includeZeros ?? true) : true,
      )
    }

    return point
  })

  return {data, groups}
}

/**
 * Build data points for a categorical or boolean X-axis.
 *
 * @param items - Filtered source data
 * @param xColumn - Active X-axis column
 * @param groupByColumn - Optional group-by column
 * @param groups - Resolved group labels
 * @param metric - Selected metric configuration
 * @param metricColumn - Resolved numeric metric column
 * @returns Aggregated category-bucketed data points
 */
function buildCategoryBuckets<T, TColumnId extends string>(
  items: T[],
  xColumn: ChartColumn<T, TColumnId>,
  groupByColumn: ChartColumn<T, TColumnId> | null,
  groups: string[],
  metric: Metric<TColumnId>,
  metricColumn: NumberColumn<T, TColumnId> | null,
): DataPointResult {
  const xValues = new Set<string>()
  for (const item of items) {
    xValues.add(getStringValue(item, xColumn))
  }

  const accumulator = new Map<string, Map<string, number[]>>()
  for (const xValue of xValues) {
    const groupMap = new Map<string, number[]>()
    for (const group of groups) {
      groupMap.set(group, [])
    }
    accumulator.set(xValue, groupMap)
  }

  for (const item of items) {
    const xValue = getStringValue(item, xColumn)
    const groupMap = accumulator.get(xValue)
    if (!groupMap) continue

    const group = groupByColumn ? getStringValue(item, groupByColumn) : 'value'
    const values = groupMap.get(group)
    if (!values) continue

    if (metricColumn) {
      const metricValue = metricColumn.accessor(item)
      if (metricValue != null) values.push(metricValue)
    } else {
      values.push(1)
    }
  }

  const data = [...xValues].map((xValue) => {
    const point: TransformedDataPoint = {xLabel: xValue, xKey: xValue}
    const groupMap = accumulator.get(xValue)!

    for (const group of groups) {
      point[group] = aggregate(
        groupMap.get(group) ?? [],
        metric.kind === 'aggregate' ? metric.aggregate : 'count',
        metric.kind === 'aggregate' ? (metric.includeZeros ?? true) : true,
      )
    }

    return point
  })

  return {data, groups}
}
