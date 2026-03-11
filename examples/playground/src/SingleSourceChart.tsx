import { useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar } from '@matthieumordrel/chart-studio/ui'
import { quarterlyFinancialData } from './mock-data'

/**
 * Dedicated single-source example for the inference-first API.
 * The raw dataset is passed directly to useChart and only the fields that need
 * nicer labels or formatting receive lightweight hints.
 */
export function SingleSourceChart() {
  const chart = useChart({
    data: quarterlyFinancialData,
    sourceLabel: 'Quarterly Financials'
  })

  return (
    <Chart chart={chart} className='space-y-4'>
      <div className='space-y-1'>
        <p className='text-sm font-medium text-foreground'>Inference-first single source</p>
        <p className='text-sm text-muted-foreground'>
          Pass raw data directly to <code className='font-semibold'>useChart()</code> and only override edge cases with{' '}
          <code className='font-semibold'>columnHints</code>.
        </p>
      </div>

      <div className='overflow-hidden rounded-2xl border border-border bg-background'>
        <div className='p-4'>
          <ChartToolbar pinned={['chartType', 'metric', 'groupBy', 'timeBucket']} />
        </div>

        <div className='border-t border-border p-4'>
          <ChartCanvas height={360} />
        </div>
      </div>

      <ChartDebug defaultOpen />
    </Chart>
  )
}
