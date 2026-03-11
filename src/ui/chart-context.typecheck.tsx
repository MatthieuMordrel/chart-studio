import {defineChartSchema} from '../core/define-chart-schema.js'
import {useChart} from '../core/use-chart.js'
import {Chart, useTypedChartContext} from './chart-context.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleSchema = defineChartSchema<ExampleRecord>()({
  columns: {
    createdAt: {type: 'date', label: 'Created'},
    ownerName: {type: 'category', label: 'Owner'},
    isOpen: {type: 'boolean'},
    salary: {type: 'number', format: 'currency'},
    internalId: false,
  },
  groupBy: {
    allowed: ['isOpen'],
  },
  metric: {
    allowed: [
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ],
  },
})

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * Type-only probe that verifies the typed UI context path.
 */
function TypedSingleSourceProbe() {
  const chart = useTypedChartContext<ExampleRecord, typeof exampleSchema>()

  expectType<ExampleRecord[]>([...chart.rawData])
  expectType<'createdAt' | 'ownerName' | 'isOpen' | null>(chart.xAxisId)
  expectType<'ownerName' | 'isOpen' | null>(chart.groupById)
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

  // @ts-expect-error explicit numeric schema entries should keep number columns out of groupBy
  chart.setGroupBy('salary')

  // @ts-expect-error groupBy restrictions should remain active through typed context
  chart.setGroupBy('ownerName')

  // @ts-expect-error explicit numeric schema entries should keep number columns out of the X-axis API
  chart.setXAxis('salary')

  // @ts-expect-error explicit date schema entries should keep date columns out of filters
  chart.toggleFilter('createdAt', '2026-01-01')

  // @ts-expect-error metric restrictions should remain active through typed context
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
    schema: exampleSchema,
  })

  return (
    <Chart chart={chart}>
      <TypedSingleSourceProbe />
    </Chart>
  )
}

void verifyChartContextTyping
