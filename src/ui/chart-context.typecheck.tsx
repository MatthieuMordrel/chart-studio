import {useChart} from '../core/use-chart.js'
import {columns} from '../core/columns.js'
import {Chart, useChartContext} from './chart-context.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
}

const exampleColumns = [
  columns.date<ExampleRecord>('createdAt'),
  columns.category<ExampleRecord>('ownerName'),
  columns.boolean<ExampleRecord>('isOpen', {trueLabel: 'Open', falseLabel: 'Closed'}),
  columns.number<ExampleRecord>('salary'),
] as const

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * Type-only probe that verifies the typed UI context path.
 */
function TypedSingleSourceProbe() {
  const chart = useChartContext(exampleColumns)

  expectType<ExampleRecord[]>([...chart.rawData])
  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.xAxisId)
  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.groupById)
  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.referenceDateId)

  chart.setXAxis('ownerName')
  chart.setGroupBy('isOpen')
  chart.toggleFilter('ownerName', 'Alice')
  chart.clearFilter('ownerName')
  chart.setReferenceDateId('createdAt')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})

  // @ts-expect-error invalid column IDs should fail through the typed UI context
  chart.setXAxis('missingField')

  // @ts-expect-error invalid metric column IDs should fail through the typed UI context
  chart.setMetric({kind: 'aggregate', columnId: 'missingField', aggregate: 'sum'})

  return null
}

/**
 * Type-only harness that exercises the normal single-source UI composition path.
 */
function verifyChartContextTyping() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    columns: exampleColumns,
  })

  return (
    <Chart chart={chart}>
      <TypedSingleSourceProbe />
    </Chart>
  )
}

void verifyChartContextTyping
