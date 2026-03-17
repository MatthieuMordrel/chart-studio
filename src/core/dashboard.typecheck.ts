import {defineChartSchema} from './define-chart-schema.js'
import {defineDashboard} from './define-dashboard.js'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {
  useDashboard,
  useDashboardChart,
  useDashboardDataset,
  useDashboardSharedFilter,
} from './use-dashboard.js'

type JobRecord = {
  id: string
  ownerId: string | null
  status: 'open' | 'closed'
  createdAt: string
  salary: number
}

type OwnerRecord = {
  id: string
  name: string
}

function expectType<T>(_value: T): void {}

const jobs = defineDataset<JobRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.category('status'),
    c.date('createdAt'),
    c.number('salary'),
  ])

const owners = defineDataset<OwnerRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
  ])

const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
    ] as const,
  })

const dashboard = defineDashboard(model)
  .chart(
    'jobsByMonth',
    jobs
      .chart('jobsByMonth')
      .xAxis((x) => x.allowed('createdAt').default('createdAt'))
      .filters((f) => f.allowed('status'))
      .metric((m) => m.count()),
  )
  .sharedFilter('owner')
  .sharedFilter('status', {
    kind: 'select',
    source: {dataset: 'jobs', column: 'status'},
  })
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'jobs', column: 'createdAt'},
    ] as const,
  })

function verifyDashboardTyping() {
  const runtime = useDashboard({
    definition: dashboard,
    data: {
      jobs: [] as JobRecord[],
      owners: [] as OwnerRecord[],
    },
  })

  const chartConfig = runtime.chart('jobsByMonth')
  expectType<readonly JobRecord[]>(chartConfig.data)

  const chart = useDashboardChart(runtime, 'jobsByMonth')
  expectType<'createdAt' | null>(chart.xAxisId)
  expectType<readonly JobRecord[]>(useDashboardDataset(runtime, 'jobs'))

  const ownerFilter = useDashboardSharedFilter(runtime, 'owner')
  ownerFilter.toggleValue('string:key')

  const activityDate = useDashboardSharedFilter(runtime, 'activityDate')
  activityDate.setDateRangePreset('last-30-days')

  defineDashboard(model).chart(
    'quick',
    // @ts-expect-error dashboard charts must be dataset-backed definitions
    defineChartSchema<JobRecord>()
      .columns((c) => [c.date('createdAt')])
      .xAxis((x) => x.allowed('createdAt')),
  )

  // @ts-expect-error unknown model attributes need an explicit local sharedFilter config
  defineDashboard(model).sharedFilter('missing')

  // @ts-expect-error numeric columns are not valid shared select sources
  defineDashboard(model).sharedFilter('salary', {
    kind: 'select',
    source: {dataset: 'jobs', column: 'salary'},
  })

  // @ts-expect-error non-date columns are not valid shared date-range targets
  defineDashboard(model).sharedFilter('badDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'jobs', column: 'status'},
    ],
  })

  // @ts-expect-error dashboard shared date ranges do not support auto
  activityDate.setDateRangePreset('auto')
}

void verifyDashboardTyping
