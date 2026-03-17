import {createDashboard} from './create-dashboard.js'
import {useDashboard} from './use-dashboard.js'

type JobRow = {
  id: string
  ownerId: string | null
  createdAt: string
  status: 'open' | 'closed'
  salary: number
  internalId: string
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

type PersonRow = {
  id: string
  name: string
}

function expectType<T>(_value: T): void {}

function verifyInferredDashboardTyping() {
  const dashboardDefinition = createDashboard({
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
      candidates: [] as CandidateRow[],
    },
    datasets: {
      jobs: {
        columns: {
          internalId: false,
        },
      },
    },
    charts: {
      jobsByOwner: {
        data: 'jobs',
        xAxis: 'owner.name',
        metric: {column: 'salary', fn: 'avg'},
      },
      candidatesByStage: {
        data: 'candidates',
        xAxis: 'stage',
        metric: 'count',
      },
    },
    sharedFilters: ['owner', 'status'] as const,
  })

  const dashboard = useDashboard({
    definition: dashboardDefinition,
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
      candidates: [] as CandidateRow[],
    },
  })

  expectType<'jobs' | 'owners' | 'candidates'>(dashboard.chart('jobsByOwner').datasetId)

  dashboard.dataset('jobs')
  dashboard.dataset('owners')
  dashboard.sharedFilter('owner')
  dashboard.sharedFilter('status')

  // @ts-expect-error unknown dataset ids should fail
  dashboard.dataset('people')
  // @ts-expect-error unknown shared filter ids should fail
  dashboard.sharedFilter('missing')

  createDashboard({
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
    },
    charts: {
      // @ts-expect-error owners does not expose createdAt
      ownersByCreatedAt: {
        data: 'owners',
        xAxis: 'createdAt',
        metric: 'count',
      },
    },
  })

  createDashboard({
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
    },
    charts: {
      jobsByOwnerSnapshot: {
        data: 'jobs',
        // @ts-expect-error unknown lookup field should fail
        xAxis: 'owner.snapshot',
        metric: 'count',
      },
    },
  })

  createDashboard({
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
    },
    datasets: {
      jobs: {
        columns: {
          createdAt: false,
        },
      },
    },
    charts: {
      jobsByMonth: {
        data: 'jobs',
        // @ts-expect-error excluded fields should disappear from chart config typing
        xAxis: 'createdAt',
        metric: 'count',
      },
    },
  })

  createDashboard({
    data: {
      jobs: [] as JobRow[],
      owners: [] as OwnerRow[],
    },
    charts: {
      jobsByMonth: {
        data: 'jobs',
        xAxis: 'createdAt',
        metric: 'count',
      },
    },
    // @ts-expect-error unknown shared filters should fail
    sharedFilters: ['missing'] as const,
  })
}

function verifyExplicitRelationshipEscapeHatchTyping() {
  createDashboard({
    data: {
      jobs: [] as JobRow[],
      people: [] as PersonRow[],
    },
    relationships: {
      jobOwner: {
        from: {dataset: 'people', key: 'id'},
        to: {dataset: 'jobs', column: 'ownerId'},
      },
    },
    charts: {
      jobsByOwner: {
        data: 'jobs',
        xAxis: 'owner.name',
        metric: 'count',
      },
    },
    sharedFilters: ['owner'] as const,
  })

  createDashboard({
    data: {
      jobs: [] as JobRow[],
      people: [] as PersonRow[],
    },
    relationships: {
      jobOwner: {
        from: {dataset: 'people', key: 'id'},
        to: {dataset: 'jobs', column: 'ownerId'},
      },
    },
    charts: {
      jobsByPeople: {
        data: 'jobs',
        // @ts-expect-error the inferred alias comes from ownerId -> owner, not people
        xAxis: 'people.name',
        metric: 'count',
      },
    },
  })
}

void verifyInferredDashboardTyping
void verifyExplicitRelationshipEscapeHatchTyping
