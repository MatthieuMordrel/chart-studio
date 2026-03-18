import {renderHook, act} from '@testing-library/react'
import type {ReactNode} from 'react'
import {describe, expect, it} from 'vitest'
import {defineDashboard} from './define-dashboard.js'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {
  DashboardProvider,
  useDashboard,
  useDashboardChart,
  useDashboardContext,
  useDashboardDataset,
  useDashboardSharedFilter,
} from './use-dashboard.js'

type JobRow = {
  id: string
  ownerId: string | null
  status: 'open' | 'closed'
  createdAt: string
  salary: number
}

type OwnerRow = {
  id: string
  name: string
  region: 'EU' | 'US'
}

type CandidateRow = {
  id: string
  ownerId: string | null
  stage: 'applied' | 'onsite'
  appliedAt: string
}

const jobs = defineDataset<JobRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.category('status'),
    c.date('createdAt'),
    c.number('salary'),
  ])

const owners = defineDataset<OwnerRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
  ])

const candidates = defineDataset<CandidateRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.category('stage'),
    c.date('appliedAt'),
  ])

const jobsByMonth = jobs
  .chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .filters((f) => f.allowed('status'))
  .metric((m) => m.count())

const candidatesByStage = candidates
  .chart('candidatesByStage')
  .xAxis((x) => x.allowed('stage').default('stage'))
  .metric((m) => m.count())

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('candidates', candidates)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .relationship('candidateOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'candidates', column: 'ownerId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
      {dataset: 'candidates', column: 'ownerId', via: 'candidateOwner'},
    ] as const,
  })

const hiringDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .chart('candidatesByStage', candidatesByStage)
  .sharedFilter('owner')
  .sharedFilter('status', {
    kind: 'select',
    source: {dataset: 'jobs', column: 'status'},
  })
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'jobs', column: 'createdAt'},
      {dataset: 'candidates', column: 'appliedAt'},
    ] as const,
  })

const secondaryDashboard = defineDashboard(hiringModel)
  .chart('jobsByMonth', jobsByMonth)
  .build()

const jobRows: JobRow[] = [
  {id: 'job-1', ownerId: 'owner-1', status: 'open', createdAt: '2026-01-10', salary: 100},
  {id: 'job-2', ownerId: 'owner-1', status: 'closed', createdAt: '2026-02-10', salary: 110},
  {id: 'job-3', ownerId: 'owner-2', status: 'open', createdAt: '2026-03-05', salary: 120},
]

const ownerRows: OwnerRow[] = [
  {id: 'owner-1', name: 'Alice', region: 'EU'},
  {id: 'owner-2', name: 'Bob', region: 'US'},
]

const candidateRows: CandidateRow[] = [
  {id: 'candidate-1', ownerId: 'owner-1', stage: 'applied', appliedAt: '2026-01-15'},
  {id: 'candidate-2', ownerId: 'owner-2', stage: 'onsite', appliedAt: '2026-03-20'},
]

describe('dashboard composition', () => {
  it('rejects standalone chart definitions during dashboard registration', () => {
    const standaloneSchema = {
      columns: {createdAt: {type: 'date'}},
      __chartSchemaBrand: 'chart-schema-definition',
    }

    expect(() =>
      defineDashboard(hiringModel).chart(
        'standalone',
        standaloneSchema as any,
      ),
    ).toThrow('must come from defineDataset(...).chart(...)')
  })

  it('coordinates model and dashboard shared filters through typed provider hooks', () => {
    function Wrapper({children}: {children: ReactNode}) {
      const dashboard = useDashboard({
        definition: hiringDashboard,
        data: {
          jobs: jobRows,
          owners: ownerRows,
          candidates: candidateRows,
        },
      })

      return (
        <DashboardProvider dashboard={dashboard}>
          {children}
        </DashboardProvider>
      )
    }

    const {result} = renderHook(() => ({
      jobsChart: useDashboardChart(hiringDashboard, 'jobsByMonth'),
      typedDashboard: useDashboardContext(hiringDashboard),
      jobsRows: useDashboardDataset(hiringDashboard, 'jobs'),
      candidateRows: useDashboardDataset(hiringDashboard, 'candidates'),
      ownerFilter: useDashboardSharedFilter(hiringDashboard, 'owner'),
      statusFilter: useDashboardSharedFilter(hiringDashboard, 'status'),
    }), {wrapper: Wrapper})

    expect(result.current.jobsChart.recordCount).toBe(3)
    expect(result.current.jobsChart.availableFilters).toEqual([])
    expect(result.current.typedDashboard.chartIds).toEqual(['jobsByMonth', 'candidatesByStage'])

    const aliceValue = result.current.ownerFilter.kind === 'select'
      ? result.current.ownerFilter.options.find((option) => option.label === 'Alice')?.value
      : null

    expect(aliceValue).toBeTruthy()

    act(() => {
      if (result.current.ownerFilter.kind === 'select' && aliceValue) {
        result.current.ownerFilter.toggleValue(aliceValue)
      }
    })

    expect(result.current.jobsRows).toHaveLength(2)
    expect(result.current.candidateRows).toHaveLength(1)
    expect(result.current.jobsChart.recordCount).toBe(2)

    act(() => {
      if (result.current.statusFilter.kind === 'select') {
        result.current.statusFilter.toggleValue('open')
      }
    })

    expect(result.current.jobsRows).toEqual([
      expect.objectContaining({id: 'job-1', status: 'open'}),
    ])
    expect(result.current.jobsChart.recordCount).toBe(1)
    const unsafeToggleFilter = result.current.jobsChart.toggleFilter as (columnId: string, value: string) => void
    expect(() => unsafeToggleFilter('status', 'open')).toThrow(
      'owned by a dashboard shared filter',
    )
  })

  it('applies shared date ranges across datasets and suppresses local date controls by default', () => {
    const {result} = renderHook(() => {
      const dashboard = useDashboard({
        definition: hiringDashboard,
        data: {
          jobs: jobRows,
          owners: ownerRows,
          candidates: candidateRows,
        },
      })

      return {
        jobsChart: useDashboardChart(dashboard, 'jobsByMonth'),
        candidatesChart: useDashboardChart(dashboard, 'candidatesByStage'),
        jobsRows: useDashboardDataset(dashboard, 'jobs'),
        candidateRows: useDashboardDataset(dashboard, 'candidates'),
        dateFilter: useDashboardSharedFilter(dashboard, 'activityDate'),
      }
    })

    expect(result.current.jobsChart.availableDateColumns).toEqual([])
    expect(result.current.candidatesChart.availableDateColumns).toEqual([])

    act(() => {
      if (result.current.dateFilter.kind === 'date-range') {
        result.current.dateFilter.setDateRangeFilter({
          from: new Date('2026-03-01T00:00:00Z'),
          to: null,
        })
      }
    })

    expect(result.current.jobsRows).toEqual([
      expect.objectContaining({id: 'job-3'}),
    ])
    expect(result.current.candidateRows).toEqual([
      expect.objectContaining({id: 'candidate-2'}),
    ])
    const unsafeSetReferenceDateId = result.current.jobsChart.setReferenceDateId as (columnId: string) => void
    expect(() => unsafeSetReferenceDateId('createdAt')).toThrow(
      'owned by a dashboard shared date range',
    )
  })

  it('rejects definition-anchored hooks when the provider dashboard does not match', () => {
    function Wrapper({children}: {children: ReactNode}) {
      const dashboard = useDashboard({
        definition: hiringDashboard,
        data: {
          jobs: jobRows,
          owners: ownerRows,
          candidates: candidateRows,
        },
      })

      return (
        <DashboardProvider dashboard={dashboard}>
          {children}
        </DashboardProvider>
      )
    }

    expect(() =>
      renderHook(() => useDashboardChart(secondaryDashboard, 'jobsByMonth'), {wrapper: Wrapper}),
    ).toThrow('does not match the nearest <DashboardProvider>')
  })
})
