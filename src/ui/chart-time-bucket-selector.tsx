/**
 * Time bucket selector — premium custom dropdown.
 * Only renders when the X-axis is a date column.
 */

import {CHART_TYPE_CONFIG} from '../core/chart-capabilities.js'
import type {TimeBucket} from '../core/types.js'
import {useChartContext} from './chart-context.js'
import {ChartSelect} from './chart-select.js'

/** Labels for each time bucket. */
const BUCKET_LABELS: Record<TimeBucket, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
}

/** All bucket options in order. */
const BUCKET_OPTIONS: TimeBucket[] = ['day', 'week', 'month', 'quarter', 'year']

/** Custom dropdown to select time granularity. */
export function ChartTimeBucketSelector({className}: {className?: string}) {
  const {chartType, isTimeSeries, timeBucket, setTimeBucket} = useChartContext()

  if (!isTimeSeries || !CHART_TYPE_CONFIG[chartType].supportsTimeBucketing) {
    return null
  }

  const options = BUCKET_OPTIONS.map((bucket) => ({value: bucket, label: BUCKET_LABELS[bucket]}))

  return (
    <ChartSelect
      value={timeBucket}
      options={options}
      onChange={setTimeBucket}
      ariaLabel="Time granularity"
      className={className}
    />
  )
}
