import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar } from '@matthieumordrel/chart-studio/ui'
import { quarterlyFinancialData, type QuarterlyFinancialRecord } from '../mock-data'

const singleSourceChartSchema = defineChartSchema<QuarterlyFinancialRecord>()({
  columns: {
    periodEnd: { type: 'date', label: 'Period End' },
    segment: { type: 'category' },
    revenue: { type: 'number', label: 'Revenue', format: 'currency' },
    netIncome: {
      type: 'number',
      label: 'Net Income',
      format: {
        kind: 'number',
        options: {
          style: 'currency',
          currency: 'EUR',
          notation: 'compact',
          maximumFractionDigits: 1
        }
      }
    },
    ebitda: { type: 'number', label: 'EBITDA' },
    ebitdaMargin: {
      kind: 'derived',
      type: 'number',
      label: 'EBITDA Margin',
      format: 'percent',
      accessor: (record: QuarterlyFinancialRecord) => {
        if (record.revenue <= 0) {
          return null
        }

        return record.ebitda / record.revenue
      }
    },
    grossMargin: {
      kind: 'derived',
      type: 'number',
      label: 'Gross Margin',
      format: 'percent',
      accessor: (record: QuarterlyFinancialRecord) => {
        if (record.revenue <= 0) {
          return null
        }

        return record.grossProfit / record.revenue
      }
    },
    profitable: {
      kind: 'derived',
      type: 'boolean',
      label: 'Profitability',
      trueLabel: 'Profitable',
      falseLabel: 'Unprofitable',
      accessor: (record: QuarterlyFinancialRecord) => record.netIncome > 0
    }
  },
  xAxis: {
    allowed: ['periodEnd']
  },
  chartType: { allowed: ['bar', 'line'] },
  timeBucket: { allowed: ['year', 'quarter', 'month'] },
  groupBy: {
    allowed: ['segment', 'profitable']
  },
  filters: {
    allowed: ['segment', 'profitable']
  },
  metric: {
    allowed: [
      { kind: 'aggregate', columnId: 'ebitda', aggregate: ['sum', 'avg'] },
      { kind: 'aggregate', columnId: 'ebitdaMargin', aggregate: 'avg' },
      { kind: 'aggregate', columnId: 'grossMargin', aggregate: 'avg' },
      { kind: 'aggregate', columnId: 'revenue', aggregate: 'sum' },
      { kind: 'aggregate', columnId: 'netIncome', aggregate: 'sum' }
    ],
    default: { kind: 'aggregate', columnId: 'grossMargin', aggregate: 'avg' }
  }
})

/**
 * Dedicated single-source example for the formatting API.
 * It showcases surface-aware defaults, explicit `format` overrides, filter
 * labels, and opt-in chart data labels in one compact playground.
 */
export function SingleSourceChart() {
  const chart = useChart({
    data: quarterlyFinancialData,
    schema: singleSourceChartSchema,
    sourceLabel: 'Quarterly Financials'
  })

  return (
    <Chart chart={chart} className='space-y-4'>
      <div className='overflow-hidden rounded-xl border border-border bg-background'>
        <div className='p-4'>
          <ChartToolbar pinned={['source', 'chartType', 'metric', 'groupBy', 'filters', 'timeBucket']} />
        </div>

        <div className='border-t border-border p-4'>
          <ChartCanvas height={360} showDataLabels />
        </div>
      </div>

      <ChartDebug defaultOpen />
    </Chart>
  )
}
