/**
 * GroupBy selector — premium custom dropdown replacing native <select>.
 */

import {Layers} from 'lucide-react'
import {CHART_TYPE_CONFIG} from '../core/chart-capabilities.js'
import {useChartContext} from './chart-context.js'
import {ChartSelect} from './chart-select.js'

/** Custom dropdown to select the groupBy column. */
export function ChartGroupBySelector({className, hideIcon}: {className?: string; hideIcon?: boolean}) {
  const {chartType, groupById, setGroupBy, availableGroupBys, isGroupByOptional} = useChartContext()

  const options = [
    ...(isGroupByOptional ? [{value: '', label: 'No grouping'}] : []),
    ...availableGroupBys.map((col) => ({value: col.id, label: col.label})),
  ]

  if (!CHART_TYPE_CONFIG[chartType].supportsGrouping || options.length <= 1) {
    return null
  }

  return (
    <ChartSelect
      value={groupById ?? ''}
      options={options}
      onChange={(v) => setGroupBy(v || null)}
      ariaLabel="Group by"
      icon={Layers}
      hideIcon={hideIcon}
      className={className}
    />
  )
}
