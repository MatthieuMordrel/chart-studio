import {defineDataset} from './define-dataset.js'
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

const salesSchema = defineDataset<SalesRecord>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('region'),
    c.number('revenue', {format: 'currency'}),
    c.exclude('internalId'),
  ])
  .chart()
  .groupBy((g) => g.allowed('region'))
  .metric((m) => m.aggregate('revenue', 'sum'))

const userSchema = defineDataset<UserRecord>()
  .columns((c) => [
    c.date('signedUpAt', {label: 'Signed Up'}),
    c.category('plan'),
    c.boolean('isActive'),
    c.exclude('city'),
  ])
  .chart()
  .groupBy((g) => g.allowed('plan', 'isActive'))

const salesDataset = defineDataset<SalesRecord>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('region'),
    c.number('revenue', {format: 'currency'}),
    c.exclude('internalId'),
  ])

const userDataset = defineDataset<UserRecord>()
  .columns((c) => [
    c.date('signedUpAt', {label: 'Signed Up'}),
    c.category('plan'),
    c.boolean('isActive'),
    c.exclude('city'),
  ])

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

  // @ts-expect-error unknown source ids should fail
  chart.setActiveSource('missing')
  // @ts-expect-error unknown filter ids should fail across the multi-source union
  chart.toggleFilter('missing', 'value')

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

function verifyDatasetBackedMultiSourceChartTyping() {
  const chart = useChart({
    sources: [
      {
        id: 'sales',
        label: 'Sales',
        data: [] as SalesRecord[],
        schema: salesDataset
          .chart('salesByRegion')
          .xAxis((x) => x.allowed('region').default('region'))
          .filters((f) => f.allowed('region')),
      },
      {
        id: 'users',
        label: 'Users',
        data: [] as UserRecord[],
        schema: userDataset
          .chart('usersByPlan')
          .xAxis((x) => x.allowed('plan').default('plan'))
          .groupBy((g) => g.allowed('isActive')),
      },
    ] as const,
    inputs: {
      filters: new Map<'region' | 'plan' | 'isActive', Set<string>>([
        ['region', new Set(['EMEA'])],
      ]),
      onFiltersChange(filters: Map<'region' | 'plan' | 'isActive', Set<string>>) {
        expectType<Map<'region' | 'plan' | 'isActive', Set<string>>>(filters)
      },
      referenceDateId: 'createdAt',
      onReferenceDateIdChange(columnId: 'createdAt' | 'signedUpAt' | null) {
        expectType<'createdAt' | 'signedUpAt' | null>(columnId)
      },
      dateRange: {
        preset: 'all-time',
        customFilter: null,
      },
    },
  })

  chart.setActiveSource('sales')
  chart.setActiveSource('users')

  if (chart.activeSourceId === 'sales') {
    chart.toggleFilter('region', 'EMEA')
    chart.setReferenceDateId('createdAt')
  } else {
    chart.toggleFilter('plan', 'Pro')
    chart.setReferenceDateId('signedUpAt')
  }

  useChart({
    sources: [
      {
        id: 'sales',
        label: 'Sales',
        data: [] as SalesRecord[],
        schema: salesDataset.chart('salesByRegion'),
      },
      {
        id: 'users',
        label: 'Users',
        data: [] as UserRecord[],
        schema: userDataset.chart('usersByPlan'),
      },
    ] as const,
    inputs: {
      // @ts-expect-error non-date ids cannot control the reference date in multi-source charts
      referenceDateId: 'region',
    },
  })
}

void verifyMultiSourceChartTyping
void verifyDatasetBackedMultiSourceChartTyping
