import { useChart, type ChartType } from '@matthieumordrel/chart-studio'
// No import from '@matthieumordrel/chart-studio/ui' — this scenario uses only the core package.
import { recipeLogData } from '../mock-data'

/**
 * Headless chart: the core useChart hook with zero UI package components.
 * Native HTML controls drive fully-typed chart state.
 * transformedData is the pipeline output — ready to pass to any charting library.
 */
export function HeadlessChart() {
  const chart = useChart({
    data: recipeLogData
  })

  return (
    <div className='space-y-4'>
      {/* Native controls backed by fully-typed chart state. */}
      {/* TypeScript enforces that setXAxis only accepts valid column IDs — try passing 'invalid' and it errors. */}
      <div className='flex flex-wrap gap-4 rounded-xl border border-border bg-background p-4'>
        <label className='flex flex-col gap-1'>
          <span className='text-xs text-muted-foreground'>X-Axis</span>
          <select
            value={chart.xAxisId ?? ''}
            onChange={e => chart.setXAxis(e.target.value as Parameters<typeof chart.setXAxis>[0])}
            className='rounded-sm border border-border bg-card px-2 py-1.5 text-sm text-foreground'>
            {chart.availableXAxes.map(ax => (
              <option key={ax.id} value={ax.id}>
                {ax.label}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-xs text-muted-foreground'>Chart Type</span>
          <select
            value={chart.chartType}
            onChange={e => chart.setChartType(e.target.value as ChartType)}
            className='rounded-sm border border-border bg-card px-2 py-1.5 text-sm text-foreground'>
            {chart.availableChartTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-xs text-muted-foreground'>Group By</span>
          <select
            value={chart.groupById ?? ''}
            onChange={e => chart.setGroupBy((e.target.value || null) as Parameters<typeof chart.setGroupBy>[0])}
            className='rounded-sm border border-border bg-card px-2 py-1.5 text-sm text-foreground'>
            <option value=''>None</option>
            {chart.availableGroupBys.map(col => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </select>
        </label>

        <label className='flex flex-col gap-1'>
          <span className='text-xs text-muted-foreground'>Time Bucket</span>
          <select
            value={chart.timeBucket}
            onChange={e => chart.setTimeBucket(e.target.value as Parameters<typeof chart.setTimeBucket>[0])}
            className='rounded-sm border border-border bg-card px-2 py-1.5 text-sm text-foreground'
            disabled={!chart.isTimeSeries}>
            {(['day', 'week', 'month', 'quarter', 'year'] as const).map(bucket => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Typed state read-out: these values are inferred from the column definitions you passed to useChart. */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {(
          [
            { label: 'xAxisId', value: chart.xAxisId },
            { label: 'chartType', value: chart.chartType },
            { label: 'groupById', value: chart.groupById ?? 'null' },
            { label: 'recordCount', value: chart.recordCount }
          ] satisfies Array<{ label: string; value: string | number | null }>
        ).map(({ label, value }) => (
          <div key={label} className='rounded-xl border border-border bg-background p-3'>
            <p className='text-xs text-muted-foreground'>chart.{label}</p>
            <p className='mt-1 font-mono text-sm font-semibold'>{String(value)}</p>
          </div>
        ))}
      </div>

      {/* chart.transformedData — the pipeline output after groupBy, time bucketing and aggregation. */}
      {/* This is exactly what ChartCanvas receives internally. Pass it to Recharts, Victory, or any renderer. */}
      <div className='overflow-hidden rounded-xl border border-border bg-background'>
        <div className='border-b border-border px-4 py-3'>
          <p className='font-mono text-xs font-medium text-muted-foreground'>
            chart.transformedData — first 8 of {chart.transformedData.length} rows
          </p>
        </div>
        <div className='overflow-x-auto'>
          {chart.transformedData.length === 0 ? (
            <p className='px-4 py-6 text-center text-xs text-muted-foreground'>No data</p>
          ) : (
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-border bg-card'>
                  {Object.keys(chart.transformedData[0]!).map(key => (
                    <th key={key} className='px-4 py-2 text-left font-mono font-medium text-muted-foreground'>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.transformedData.slice(0, 8).map((row, i) => (
                  <tr key={i} className='border-b border-border last:border-0'>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className='px-4 py-2 font-mono'>
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
