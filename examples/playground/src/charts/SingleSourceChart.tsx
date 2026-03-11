import { defineChartConfig, useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar } from '@matthieumordrel/chart-studio/ui'
import { quarterlyFinancialData } from '../mock-data'

const singleSourceChartHints = {
  periodEnd: { type: 'date', label: 'Period End' },
  segment: { type: 'category' },
  revenue: { type: 'number', label: 'Revenue' },
  netIncome: { type: 'number', label: 'Net Income' },
  ebitda: { type: 'number', label: 'EBITDA' },
  grossProfit: { type: 'number', label: 'Gross Profit' }
} as const

/**
 * Dedicated single-source example for the inference-first API.
 * The raw dataset is passed directly to useChart and only the fields that need
 * nicer labels, stronger typing, or tool restrictions receive lightweight hints.
 */
export function SingleSourceChart() {
  const chart = useChart({
    data: quarterlyFinancialData,
    columnHints: singleSourceChartHints,
    config: defineChartConfig<(typeof quarterlyFinancialData)[number], typeof singleSourceChartHints>({
      xAxis: {
        allowed: ['periodEnd']
      },
      timeBucket: { allowed: ['year', 'quarter', 'month'] },
      chartType: { allowed: ['bar', 'line'] },
      groupBy: {
        allowed: ['segment']
      },
      metric: {
        allowed: [
          { kind: 'aggregate', columnId: 'ebitda', aggregate: ['sum', 'avg'] },
          { kind: 'aggregate', columnId: 'revenue', aggregate: 'sum' },
          { kind: 'aggregate', columnId: 'netIncome', aggregate: 'sum' }
        ]
      }
    }),
    sourceLabel: 'Quarterly Financials'
  })

  return (
    <Chart chart={chart} className='space-y-4'>
      <div className='overflow-hidden rounded-2xl border border-border bg-background'>
        <div className='p-4'>
          <ChartToolbar pinned={['source', 'chartType', 'metric', 'groupBy', 'timeBucket']} />
        </div>

        <div className='border-t border-border p-4'>
          <ChartCanvas height={360} />
        </div>
      </div>

      <ChartDebug defaultOpen />
    </Chart>
  )
}
