import { defineDataset, useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartDebug, ChartToolbar, type StackedDataLabelMode } from '@matthieumordrel/chart-studio-ui'
import { useState } from 'react'
import { quarterlyFinancialData, type QuarterlyFinancialRecord } from '../mock-data'

const STACKED_LABEL_MODES = [
  { id: 'segments', label: 'Segments' },
  { id: 'total', label: 'Total' }
] as const satisfies ReadonlyArray<{ id: StackedDataLabelMode; label: string }>

const quarterlyFinancials = defineDataset<QuarterlyFinancialRecord>()
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

const singleSourceChartSchema = quarterlyFinancials
  .chart('quarterlyFinancials')
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
 * labels, and opt-in chart data labels in one compact playground. Group by a
 * column on the bar chart to compare per-segment labels with stack totals.
 */
export function SingleSourceChart() {
  const chart = useChart({
    data: quarterlyFinancialData,
    schema: singleSourceChartSchema,
    sourceLabel: 'Quarterly Financials'
  })
  const [stackedDataLabels, setStackedDataLabels] = useState<StackedDataLabelMode>('segments')

  return (
    <Chart chart={chart} className='space-y-4'>
      <div className='overflow-hidden rounded-xl border border-border bg-background'>
        <div className='p-4'>
          <ChartToolbar pinned={['source', 'chartType', 'metric', 'groupBy', 'filters', 'timeBucket']} />
        </div>

        <div className='flex items-center justify-between gap-3 border-t border-border px-4 py-2.5'>
          <p className='text-xs text-muted-foreground'>
            Stacked bar labels <code className='font-semibold'>{`stackedDataLabels="${stackedDataLabels}"`}</code>
          </p>
          <div className='inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5'>
            {STACKED_LABEL_MODES.map(mode => {
              const active = stackedDataLabels === mode.id
              return (
                <button
                  key={mode.id}
                  type='button'
                  onClick={() => setStackedDataLabels(mode.id)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  {mode.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className='border-t border-border p-4'>
          <ChartCanvas height={360} showDataLabels stackedDataLabels={stackedDataLabels} />
        </div>
      </div>

      <ChartDebug defaultOpen />
    </Chart>
  )
}
