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
    <div className='overflow-hidden rounded-2xl border border-border bg-background shadow-sm'>
      <div className='border-b border-border px-5 py-4'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='mt-1 text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='p-5'>{children}</div>
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
    <div className='space-y-5'>
      <div className='rounded-2xl border border-primary/15 bg-primary/5 p-5'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <div className='inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary'>
              Inferred Dashboard API
            </div>
            <div className='space-y-1'>
              <h2 className='text-lg font-semibold text-foreground'>One call, three datasets, no explicit model boilerplate</h2>
              <p className='max-w-3xl text-sm text-muted-foreground'>
                This dashboard infers <code className='rounded bg-background px-1 py-0.5 text-[11px]'>jobs.ownerId -&gt; owners.id</code>, exposes one
                shared owner filter, and compiles <code className='rounded bg-background px-1 py-0.5 text-[11px]'>owner.name</code> into a hidden lookup
                materialized view behind the existing dashboard runtime.
              </p>
            </div>
          </div>

          <div className='flex flex-wrap gap-2 text-xs'>
            <div className='rounded-full border border-border bg-background px-3 py-1.5 text-foreground'>
              {filteredJobs.length} filtered jobs
            </div>
            <div className='rounded-full border border-border bg-background px-3 py-1.5 text-foreground'>
              {filteredCandidates.length} filtered candidates
            </div>
          </div>
        </div>

        {ownerFilter.kind === 'select' && (
          <div className='mt-4 flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => ownerFilter.clear()}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                ownerFilter.values.size === 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/40'
              }`}>
              All owners
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
          </div>
        )}
      </div>

      <div className='grid gap-4 lg:grid-cols-[1.35fr_1fr]'>
        <DashboardPanel
          title='Average Salary by Owner'
          subtitle='The x-axis comes from owners.name even though salary lives on jobs.'>
          <Chart chart={jobsByOwner}>
            <ChartCanvas height={280} />
          </Chart>
        </DashboardPanel>

        <DashboardPanel
          title='Candidate Stage Mix'
          subtitle='The same inferred owner filter also scopes the separate candidates dataset.'>
          <Chart chart={candidatesByStage}>
            <ChartCanvas height={280} showDataLabels />
          </Chart>
        </DashboardPanel>
      </div>
    </div>
  )
}
