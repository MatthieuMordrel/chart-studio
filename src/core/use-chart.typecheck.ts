import {useChart} from './use-chart.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleHints = {
  createdAt: {type: 'date', label: 'Created'},
  ownerName: {label: 'Owner'},
  salary: {format: 'currency'},
  internalId: false,
} as const

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * This function never runs.
 * It only exists so TypeScript checks the inferred public API.
 */
function verifyUseChartColumnIds() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
  })

  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.xAxisId)
  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.groupById)
  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'salary' | null>(chart.referenceDateId)

  chart.setXAxis('ownerName')
  chart.setGroupBy('isOpen')
  chart.setGroupBy(null)
  chart.toggleFilter('ownerName', 'Alice')
  chart.clearFilter('ownerName')
  chart.setReferenceDateId('createdAt')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})

  // @ts-expect-error invalid column IDs should fail
  chart.setXAxis('missingField')

  // @ts-expect-error invalid metric column IDs should fail
  chart.setMetric({kind: 'aggregate', columnId: 'missingField', aggregate: 'sum'})

  // @ts-expect-error invalid filter column IDs should fail
  chart.toggleFilter('missingField', 'Alice')

  // @ts-expect-error explicitly excluded fields should be removed from the chart API
  chart.setXAxis('internalId')
}

void verifyUseChartColumnIds
