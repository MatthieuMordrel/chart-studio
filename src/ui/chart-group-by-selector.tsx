/**
 * GroupBy selector — premium custom dropdown replacing native <select>.
 */

import {Layers} from 'lucide-react'
import {CHART_TYPE_CONFIG} from '../core/chart-capabilities.js'
import {useChartContext} from './chart-context.js'
import {ChartSelect} from './chart-select.js'

/** Custom dropdown to select the groupBy column. */
export function ChartGroupBySelector({className}: {className?: string}) {
  const {chartType, groupById, setGroupBy, availableGroupBys} = useChartContext()

  if (!CHART_TYPE_CONFIG[chartType].supportsGrouping || availableGroupBys.length === 0) {
    return null
  }

  const options = [
    {value: '', label: 'No grouping'},
    ...availableGroupBys.map((col) => ({value: col.id, label: col.label})),
  ]

  return (
    <ChartSelect
      value={groupById ?? ''}
      options={options}
      onChange={(v) => setGroupBy(v || null)}
      ariaLabel="Group by"
      icon={Layers}
      className={className}
    />
  )
}
