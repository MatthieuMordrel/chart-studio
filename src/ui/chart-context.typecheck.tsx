import {useChart} from '../core/use-chart.js'
import {Chart, useTypedChartContext} from './chart-context.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleHints = {
  createdAt: {type: 'date', label: 'Created'},
  ownerName: {type: 'category', label: 'Owner'},
  isOpen: {type: 'boolean'},
  salary: {type: 'number', format: 'currency'},
  internalId: false,
} as const

const exampleTools = {
  groupBy: {
    allowed: ['isOpen'],
  },
  metric: {
    allowed: [
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ],
  },
} as const

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * Type-only probe that verifies the typed UI context path.
 */
function TypedSingleSourceProbe() {
  const chart = useTypedChartContext<ExampleRecord, typeof exampleHints, typeof exampleTools>()

  expectType<ExampleRecord[]>([...chart.rawData])
  expectType<'createdAt' | 'ownerName' | 'isOpen' | null>(chart.xAxisId)
  expectType<'isOpen' | null>(chart.groupById)
  expectType<'createdAt' | null>(chart.referenceDateId)

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

  // @ts-expect-error explicit numeric hints should keep number columns out of groupBy
  chart.setGroupBy('salary')

  // @ts-expect-error tool restrictions should keep undeclared groupBy IDs out of typed context
  chart.setGroupBy('ownerName')

  // @ts-expect-error explicit numeric hints should keep number columns out of the X-axis API
  chart.setXAxis('salary')

  // @ts-expect-error explicit date hints should keep date columns out of filters
  chart.toggleFilter('createdAt', '2026-01-01')

  // @ts-expect-error tool restrictions should keep undeclared metrics out of typed context
  chart.setMetric({kind: 'count'})

  // @ts-expect-error excluded fields should stay unavailable through typed context
  chart.setXAxis('internalId')

  return null
}

/**
 * Type-only harness that exercises the normal single-source UI composition path.
 */
function verifyChartContextTyping() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    tools: exampleTools,
  })

  return (
    <Chart chart={chart}>
      <TypedSingleSourceProbe />
    </Chart>
  )
}

void verifyChartContextTyping
