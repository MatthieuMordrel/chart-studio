/**
 * X-axis selector — premium custom dropdown for choosing which column drives the X-axis.
 */

import {useChartContext} from './chart-context.js'
import {ChartSelect} from './chart-select.js'

/** Custom dropdown to select the X-axis column. */
export function ChartXAxisSelector({className}: {className?: string}) {
  const {xAxisId, setXAxis, availableXAxes} = useChartContext()

  if (availableXAxes.length <= 1) return null

  const options = availableXAxes.map((col) => ({value: col.id, label: `X-axis: ${col.label}`}))

  return (
    <ChartSelect
      value={xAxisId ?? ''}
      options={options}
      onChange={(v) => setXAxis(v)}
      ariaLabel="X-axis"
      className={className}
    />
  )
}
