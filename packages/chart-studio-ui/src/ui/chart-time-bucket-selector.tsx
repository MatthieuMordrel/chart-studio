/**
 * Time bucket selector — premium custom dropdown.
 * Only renders when the X-axis is a date column.
 */

import {Clock} from 'lucide-react'
import {CHART_TYPE_CONFIG} from '@matthieumordrel/chart-studio/_internal'
import type {TimeBucket} from '@matthieumordrel/chart-studio'
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

/** Custom dropdown to select time granularity. */
export function ChartTimeBucketSelector({className, hideIcon}: {className?: string; hideIcon?: boolean}) {
  const {chartType, isTimeSeries, timeBucket, setTimeBucket, availableTimeBuckets} = useChartContext()

  if (!isTimeSeries || !CHART_TYPE_CONFIG[chartType].supportsTimeBucketing || availableTimeBuckets.length <= 1) {
    return null
  }

  const options = availableTimeBuckets.map((bucket) => ({value: bucket, label: BUCKET_LABELS[bucket as TimeBucket]}))

  return (
    <ChartSelect
      value={timeBucket}
      options={options}
      onChange={setTimeBucket}
      ariaLabel="Time granularity"
      icon={Clock}
      hideIcon={hideIcon}
      className={className}
    />
  )
}
