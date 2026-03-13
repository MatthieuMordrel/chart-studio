import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar } from '@matthieumordrel/chart-studio/ui'
import { quarterlyFinancialData, type QuarterlyFinancialRecord } from '../mock-data'

const singleSourceChartSchema = defineChartSchema<QuarterlyFinancialRecord>()
  .columns((c) => [
    c.date('periodEnd', {label: 'Period End'}),
    c.category('segment'),
    c.number('revenue', {label: 'Revenue', format: 'currency'}),
    c.number('netIncome', {
      label: 'Net Income',
      format: {
        kind: 'number',
        options: {
          style: 'currency',
          currency: 'EUR',
          notation: 'compact',
          maximumFractionDigits: 1,
        },
      },
    }),
    c.number('ebitda', {
      label: 'EBITDA',
      format: {
        kind: 'number',
        options: {
          style: 'currency',
          currency: 'EUR',
          notation: 'compact',
          maximumFractionDigits: 1,
        },
      },
    }),
    c.derived.number('ebitdaMargin', {
      label: 'EBITDA Margin',
      format: 'percent',
      accessor: (record) => {
        if (record.revenue <= 0) {
          return null
        }

        return record.ebitda / record.revenue
      },
    }),
    c.derived.number('grossMargin', {
      label: 'Gross Margin',
      format: 'percent',
      accessor: (record) => {
        if (record.revenue <= 0) {
          return null
        }

        return record.grossProfit / record.revenue
      },
    }),
    c.derived.boolean('profitable', {
      label: 'Profitability',
      trueLabel: 'Profitable',
      falseLabel: 'Unprofitable',
      accessor: (record) => record.netIncome > 0,
    }),
  ])
  .xAxis((x) => x.allowed('periodEnd'))
  .chartType((t) => t.allowed('bar', 'line'))
  .timeBucket((tb) => tb.allowed('year', 'quarter', 'month').default('quarter'))
  .groupBy((g) => g.allowed('segment', 'profitable'))
  .filters((f) => f.allowed('segment', 'profitable'))
  .metric((m) =>
    m
      .aggregate('ebitda', 'sum')
      .aggregate('ebitdaMargin', 'avg')
      .aggregate('grossMargin', 'avg')
      .aggregate('revenue', 'sum')
      .aggregate('netIncome', 'sum')
      .defaultAggregate('ebitda', 'sum')
  )

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
