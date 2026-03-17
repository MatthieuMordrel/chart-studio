import {act, renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {createDashboard} from './create-dashboard.js'
import {useDashboard, useDashboardChart, useDashboardDataset, useDashboardSharedFilter} from './use-dashboard.js'

type JobRow = {
  id: string
  ownerId: string | null
  createdAt: string
  status: 'open' | 'closed'
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

const jobRows: JobRow[] = [
  {id: 'job-1', ownerId: 'owner-1', createdAt: '2026-01-10', status: 'open', salary: 100},
  {id: 'job-2', ownerId: 'owner-1', createdAt: '2026-02-10', status: 'closed', salary: 120},
  {id: 'job-3', ownerId: 'owner-2', createdAt: '2026-03-01', status: 'open', salary: 150},
]

const ownerRows: OwnerRow[] = [
  {id: 'owner-1', name: 'Alice', region: 'EU'},
  {id: 'owner-2', name: 'Bob', region: 'US'},
]

const candidateRows: CandidateRow[] = [
  {id: 'candidate-1', ownerId: 'owner-1', stage: 'applied', appliedAt: '2026-01-12'},
  {id: 'candidate-2', ownerId: 'owner-2', stage: 'onsite', appliedAt: '2026-03-02'},
]

describe('createDashboard', () => {
  it('compiles lookup paths into materialized-view-backed dashboard charts and infers shared owner filtering', () => {
    const dashboardDefinition = createDashboard({
      data: {
        jobs: jobRows,
        owners: ownerRows,
        candidates: candidateRows,
      },
      charts: {
        jobsByOwner: {
          data: 'jobs',
          xAxis: 'owner.name',
          metric: 'count',
        },
        candidatesByStage: {
          data: 'candidates',
          xAxis: 'stage',
          metric: 'count',
        },
      },
      sharedFilters: ['owner'] as const,
    })

    const {result} = renderHook(() => {
      const dashboard = useDashboard({
        definition: dashboardDefinition,
        data: {
          jobs: jobRows,
          owners: ownerRows,
          candidates: candidateRows,
        },
      })

      return {
        resolvedJobsChart: dashboard.chart('jobsByOwner'),
        jobsChart: useDashboardChart(dashboard, 'jobsByOwner'),
        jobsRows: useDashboardDataset(dashboard, 'jobs'),
        candidateRows: useDashboardDataset(dashboard, 'candidates'),
        ownerFilter: useDashboardSharedFilter(dashboard, 'owner'),
      }
    })

    expect(result.current.resolvedJobsChart.source.kind).toBe('materialized-view')
    if (result.current.resolvedJobsChart.source.kind !== 'materialized-view') {
      throw new Error('Expected jobsByOwner to resolve through a materialized view.')
    }

    expect(result.current.resolvedJobsChart.source.view.materialization).toEqual({
      id: '__inferred_jobsByOwner',
      baseDataset: 'jobs',
      grain: 'jobs',
      steps: [
        {
          kind: 'join',
          alias: 'owner',
          relationship: 'jobs.ownerId -> owners.id',
          targetDataset: 'owners',
          projectedColumns: ['name'],
        },
      ],
    })
    expect(result.current.jobsChart.availableFilters.map((filter) => filter.columnId)).not.toContain('ownerName')
    expect(result.current.jobsChart.recordCount).toBe(3)

    const aliceValue = result.current.ownerFilter.kind === 'select'
      ? result.current.ownerFilter.options.find((option) => option.label === 'Alice')?.value
      : null

    expect(aliceValue).toBeTruthy()

    act(() => {
      if (result.current.ownerFilter.kind === 'select' && aliceValue) {
        result.current.ownerFilter.toggleValue(aliceValue)
      }
    })

    expect(result.current.jobsRows).toEqual([
      expect.objectContaining({id: 'job-1'}),
      expect.objectContaining({id: 'job-2'}),
    ])
    expect(result.current.candidateRows).toEqual([
      expect.objectContaining({id: 'candidate-1'}),
    ])
    expect(result.current.jobsChart.recordCount).toBe(2)
  })

  it('rewrites inferred foreign-key validation failures with exclusion guidance', () => {
    const dashboardDefinition = createDashboard({
      data: {
        jobs: jobRows,
        owners: ownerRows,
      },
      charts: {
        jobsByMonth: {
          data: 'jobs',
          xAxis: 'createdAt',
          metric: 'count',
        },
      },
      sharedFilters: ['owner'] as const,
    })

    expect(() =>
      renderHook(() =>
        useDashboard({
          definition: dashboardDefinition,
          data: {
            jobs: [
              ...jobRows,
              {
                id: 'job-4',
                ownerId: 'owner-99',
                createdAt: '2026-04-01',
                status: 'open',
                salary: 180,
              },
            ],
            owners: ownerRows,
          },
        }),
      ),
    ).toThrow(`exclude: ['jobs.ownerId']`)
  })
})
