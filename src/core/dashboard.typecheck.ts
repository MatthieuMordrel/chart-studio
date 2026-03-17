import {defineChartSchema} from './define-chart-schema.js'
import {defineDashboard} from './define-dashboard.js'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {
  useDashboard,
  useDashboardChart,
  useDashboardContext,
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
  expectType<'jobs'>(chartConfig.datasetId)

  const chart = useDashboardChart(runtime, 'jobsByMonth')
  expectType<'createdAt' | null>(chart.xAxisId)
  expectType<readonly JobRecord[]>(useDashboardDataset(runtime, 'jobs'))

  const contextChart = useDashboardChart(dashboard, 'jobsByMonth')
  expectType<'createdAt' | null>(contextChart.xAxisId)
  expectType<readonly JobRecord[]>(useDashboardDataset(dashboard, 'jobs'))
  useDashboardContext(dashboard).chart('jobsByMonth')

  const ownerFilter = useDashboardSharedFilter(runtime, 'owner')
  ownerFilter.toggleValue('string:key')
  useDashboardSharedFilter(dashboard, 'owner').clear()

  const activityDate = useDashboardSharedFilter(runtime, 'activityDate')
  activityDate.setDateRangePreset('last-30-days')

  // @ts-expect-error dashboard-owned select filters are removed from the chart-local contract
  chart.toggleFilter('status', 'open')

  // @ts-expect-error dashboard-owned date controls are removed from the chart-local contract
  chart.setReferenceDateId('createdAt')

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

function verifyInferredDashboardTyping() {
  const inferredModel = defineDataModel()
    .dataset('jobs', defineDataset<JobRecord>()
      .key('id')
      .columns((c) => [
        c.date('createdAt'),
        c.number('salary'),
      ]))
    .dataset('owners', defineDataset<OwnerRecord>()
      .key('id')
      .columns((c) => [
        c.category('name'),
      ]))
    .infer({
      relationships: true,
      attributes: true,
    })

  const dashboard = defineDashboard(inferredModel)
    .chart(
      'jobsByOwner',
      inferredModel.chart('jobsByOwner', (chart) =>
        chart
          .from('jobs')
          .xAxis((x) => x.allowed('owner.name').default('owner.name'))
          .metric((m) => m.count())),
    )
    .sharedFilter('owner')

  const runtime = useDashboard({
    definition: dashboard,
    data: {
      jobs: [] as JobRecord[],
      owners: [] as OwnerRecord[],
    },
  })

  const chart = useDashboardChart(runtime, 'jobsByOwner')
  expectType<'ownerName' | null>(chart.xAxisId)
  expectType<'ownerName' | null>(useDashboardChart(dashboard, 'jobsByOwner').xAxisId)

  // @ts-expect-error projected lookup filters owned by shared model attributes are removed too
  chart.toggleFilter('ownerName', 'Alice')

  useDashboardSharedFilter(runtime, 'owner').clear()

  // @ts-expect-error inferred shared filters stay typed
  defineDashboard(inferredModel).sharedFilter('missing')
}

void verifyDashboardTyping
void verifyInferredDashboardTyping
