import {
  createDashboard,
  useDashboard,
  useDashboardChart,
  useDashboardDataset,
  useDashboardSharedFilter,
} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas} from '@matthieumordrel/chart-studio/ui'
import type {ReactNode} from 'react'

type JobRow = {
  id: string
  ownerId: string
  title: string
  createdAt: string
  status: 'Open' | 'Closed'
  salary: number
}

type OwnerRow = {
  id: string
  name: string
  region: 'EMEA' | 'AMER'
}

type CandidateRow = {
  id: string
  ownerId: string
  stage: 'Applied' | 'Onsite' | 'Offer'
  appliedAt: string
}

const jobs: JobRow[] = [
  {id: 'job-1', ownerId: 'owner-1', title: 'Platform Engineer', createdAt: '2026-01-08', status: 'Open', salary: 145000},
  {id: 'job-2', ownerId: 'owner-2', title: 'Product Designer', createdAt: '2026-01-26', status: 'Closed', salary: 132000},
  {id: 'job-3', ownerId: 'owner-1', title: 'Data Engineer', createdAt: '2026-02-11', status: 'Open', salary: 158000},
  {id: 'job-4', ownerId: 'owner-3', title: 'Security Analyst', createdAt: '2026-03-03', status: 'Open', salary: 149000},
]

const owners: OwnerRow[] = [
  {id: 'owner-1', name: 'Alice Chen', region: 'EMEA'},
  {id: 'owner-2', name: 'Marcus Bell', region: 'AMER'},
  {id: 'owner-3', name: 'Priya Nair', region: 'EMEA'},
]

const candidates: CandidateRow[] = [
  {id: 'candidate-1', ownerId: 'owner-1', stage: 'Applied', appliedAt: '2026-01-10'},
  {id: 'candidate-2', ownerId: 'owner-1', stage: 'Onsite', appliedAt: '2026-01-19'},
  {id: 'candidate-3', ownerId: 'owner-2', stage: 'Offer', appliedAt: '2026-02-02'},
  {id: 'candidate-4', ownerId: 'owner-3', stage: 'Applied', appliedAt: '2026-03-08'},
  {id: 'candidate-5', ownerId: 'owner-3', stage: 'Onsite', appliedAt: '2026-03-15'},
]

const inferredHiringDashboard = createDashboard({
  data: {
    jobs,
    owners,
    candidates,
  },
  charts: {
    avgSalaryByOwner: {
      data: 'jobs',
      xAxis: 'owner.name',
      metric: {column: 'salary', fn: 'avg'},
      chartType: 'bar',
    },
    candidatesByStage: {
      data: 'candidates',
      xAxis: 'stage',
      metric: 'count',
      chartType: 'donut',
    },
  },
  sharedFilters: ['owner'],
})

function DashboardPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className='overflow-hidden rounded-xl border border-border bg-background'>
      <div className='border-b border-border px-4 py-3'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='p-4'>{children}</div>
    </div>
  )
}

export function InferredDashboardChart() {
  const dashboard = useDashboard({
    definition: inferredHiringDashboard,
    data: {
      jobs,
      owners,
      candidates,
    },
  })
  const jobsByOwner = useDashboardChart(dashboard, 'avgSalaryByOwner')
  const candidatesByStage = useDashboardChart(dashboard, 'candidatesByStage')
  const filteredJobs = useDashboardDataset(dashboard, 'jobs')
  const filteredCandidates = useDashboardDataset(dashboard, 'candidates')
  const ownerFilter = useDashboardSharedFilter(dashboard, 'owner')

  return (
    <div className='space-y-4'>
      {ownerFilter.kind === 'select' && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs font-medium text-muted-foreground'>Owner</span>
          <button
            type='button'
            onClick={() => ownerFilter.clear()}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              ownerFilter.values.size === 0
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:border-primary/40'
            }`}>
            All
          </button>

          {ownerFilter.options.map((option) => {
            const isActive = ownerFilter.values.has(option.value)

            return (
              <button
                key={option.value}
                type='button'
                onClick={() => ownerFilter.toggleValue(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}>
                {option.label} <span className='opacity-70'>({option.count})</span>
              </button>
            )
          })}

          <span className='ml-auto text-xs text-muted-foreground'>
            {filteredJobs.length} jobs · {filteredCandidates.length} candidates
          </span>
        </div>
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        <DashboardPanel
          title='Average Salary by Owner'
          subtitle='X-axis from owners.name, metric from jobs.salary'>
          <Chart chart={jobsByOwner}>
            <ChartCanvas height={280} />
          </Chart>
        </DashboardPanel>

        <DashboardPanel
          title='Candidate Stage Mix'
          subtitle='Scoped by the shared owner filter across datasets'>
          <Chart chart={candidatesByStage}>
            <ChartCanvas height={280} showDataLabels />
          </Chart>
        </DashboardPanel>
      </div>
    </div>
  )
}
