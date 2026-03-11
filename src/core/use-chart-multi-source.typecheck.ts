import {defineChartSchema} from './define-chart-schema.js'
import {useChart} from './use-chart.js'

type SalesRecord = {
  createdAt: string
  region: string | null
  revenue: number | null
  internalId: string
}

type UserRecord = {
  signedUpAt: string
  plan: string | null
  isActive: boolean | null
  city: string | null
}

const salesSchema = defineChartSchema<SalesRecord>()({
  columns: {
    createdAt: {type: 'date', label: 'Created'},
    region: {type: 'category'},
    revenue: {type: 'number', format: 'currency'},
    internalId: false,
  },
  groupBy: {allowed: ['region']},
  metric: {allowed: [{kind: 'aggregate', columnId: 'revenue', aggregate: 'sum'}]},
})

const userSchema = defineChartSchema<UserRecord>()({
  columns: {
    signedUpAt: {type: 'date', label: 'Signed Up'},
    plan: {type: 'category'},
    isActive: {type: 'boolean'},
    city: false,
  },
  groupBy: {allowed: ['plan', 'isActive']},
})

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * This function never runs.
 * It only exists so TypeScript checks the inferred multi-source public API.
 */
function verifyMultiSourceChartTyping() {
  const chart = useChart({
    sources: [
      {
        id: 'sales',
        label: 'Sales',
        data: [] as SalesRecord[],
        schema: salesSchema,
      },
      {
        id: 'users',
        label: 'Users',
        data: [] as UserRecord[],
        schema: userSchema,
      },
    ] as const,
  })

  expectType<'sales' | 'users'>(chart.activeSourceId)

  chart.setActiveSource('sales')
  chart.setActiveSource('users')

  // @ts-expect-error unknown source IDs should fail
  chart.setActiveSource('missing')

  if (chart.activeSourceId === 'sales') {
    expectType<readonly SalesRecord[]>(chart.rawData)
    expectType<'createdAt' | 'region' | null>(chart.xAxisId)
    expectType<'region' | null>(chart.groupById)
    expectType<'createdAt' | null>(chart.referenceDateId)

    chart.setXAxis('region')
    chart.setGroupBy('region')
    chart.setGroupBy(null)
    chart.toggleFilter('region', 'EMEA')
    chart.clearFilter('region')
    chart.setReferenceDateId('createdAt')
    chart.setMetric({kind: 'aggregate', columnId: 'revenue', aggregate: 'sum'})
  } else {
    expectType<readonly UserRecord[]>(chart.rawData)
    expectType<'signedUpAt' | 'plan' | 'isActive' | null>(chart.xAxisId)
    expectType<'plan' | 'isActive' | null>(chart.groupById)
    expectType<'signedUpAt' | null>(chart.referenceDateId)

    chart.setXAxis('plan')
    chart.setGroupBy('isActive')
    chart.setGroupBy(null)
    chart.toggleFilter('plan', 'Pro')
    chart.clearFilter('plan')
    chart.setReferenceDateId('signedUpAt')
  }
}

void verifyMultiSourceChartTyping
