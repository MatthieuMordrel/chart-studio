import {useMemo, type ReactNode} from 'react'
import {
  DashboardProvider,
  defineDashboard,
  defineDataModel,
  defineDataset,
  useDashboard,
  useDashboardChart,
  useDashboardDataset,
  useDashboardSharedFilter,
  type DashboardSharedDateRangeFilterRuntime,
  type DashboardSharedSelectFilterRuntime,
} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio/ui'
import {
  hiringNetworkData,
  type HiringJobSkillRecord,
  type HiringOwnerRecord,
  type HiringRequisitionRecord,
  type HiringSkillRecord,
} from '../mock-data'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat('en-US')

const {
  requisitions: requisitionRows,
  owners: ownerRows,
  skills: skillRows,
  jobSkills: jobSkillRows,
} = hiringNetworkData

const ownerById = new Map(
  ownerRows.map((owner) => [owner.id, owner] satisfies readonly [string, HiringOwnerRecord]),
)
const skillById = new Map(
  skillRows.map((skill) => [skill.id, skill] satisfies readonly [string, HiringSkillRecord]),
)

function differenceInDays(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()

  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)))
}

function toDateInputValue(date: Date | null): string {
  if (!date) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInputValue(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null
}

const requisitions = defineDataset<HiringRequisitionRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.category('roleFamily', {label: 'Function'}),
    c.category('team'),
    c.category('region'),
    c.category('office'),
    c.category('level'),
    c.category('hiringMotion', {label: 'Hiring Motion'}),
    c.category('employmentType', {label: 'Employment Type'}),
    c.category('status'),
    c.date('openedAt', {label: 'Opened'}),
    c.date('targetStartAt', {label: 'Target Start'}),
    c.date('closedAt', {label: 'Closed'}),
    c.number('salaryMidpoint', {label: 'Salary Midpoint', format: 'currency'}),
    c.number('headcount', {label: 'Headcount'}),
    c.number('applicants', {label: 'Applicants'}),
    c.number('onsiteCount', {label: 'Onsites'}),
    c.number('offersExtended', {label: 'Offers Extended'}),
    c.number('offersAccepted', {label: 'Offers Accepted'}),
    c.derived.category('ownerName', {
      label: 'Hiring Owner',
      accessor: (row) => ownerById.get(row.ownerId)?.name ?? 'Unassigned',
    }),
    c.derived.category('ownerPortfolio', {
      label: 'Owner Portfolio',
      accessor: (row) => ownerById.get(row.ownerId)?.portfolio ?? 'Unknown',
    }),
    c.derived.category('statusBucket', {
      label: 'Status Bucket',
      accessor: (row) => (
        row.status === 'Open' || row.status === 'Paused' ? 'Active Plan' : 'Closed'
      ),
    }),
    c.derived.number('daysToClose', {
      label: 'Days To Close',
      format: {kind: 'duration', unit: 'days'},
      accessor: (row) => (row.closedAt ? differenceInDays(row.openedAt, row.closedAt) : null),
    }),
    c.derived.number('annualizedBudget', {
      label: 'Annualized Budget',
      format: 'currency',
      accessor: (row) => row.salaryMidpoint * row.headcount,
    }),
    c.derived.number('offerConversion', {
      label: 'Offer Conversion',
      format: 'percent',
      accessor: (row) => (
        row.offersExtended > 0 ? row.offersAccepted / row.offersExtended : null
      ),
    }),
  ])

const owners = defineDataset<HiringOwnerRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
    c.category('portfolio'),
  ])

const skills = defineDataset<HiringSkillRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Skill'}),
    c.category('domain'),
  ])

const hiringVolumeSchema = requisitions
  .chart('hiringVolume')
  .xAxis((x) => x.allowed('openedAt').default('openedAt'))
  .groupBy((g) => g.allowed('roleFamily').default('roleFamily'))
  .filters((f) => f.allowed('region', 'hiringMotion', 'employmentType', 'statusBucket', 'ownerPortfolio'))
  .metric((m) => m.count().defaultCount())
  .chartType((t) => t.allowed('area', 'line', 'bar').default('area'))
  .timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))

const ownerLoadSchema = requisitions
  .chart('ownerLoad')
  .xAxis((x) => x.allowed('ownerName').default('ownerName'))
  .groupBy((g) => g.allowed('statusBucket').default('statusBucket'))
  .filters((f) => f.allowed('region', 'roleFamily', 'hiringMotion'))
  .metric((m) => m.count().defaultCount())
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

const compensationSchema = requisitions
  .chart('compensationMix')
  .xAxis((x) => x.allowed('level').default('level'))
  .groupBy((g) => g.allowed('region').default('region'))
  .filters((f) => f.allowed('roleFamily', 'employmentType', 'office'))
  .metric((m) => m.aggregate('salaryMidpoint', 'avg').defaultAggregate('salaryMidpoint', 'avg'))
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

const timeToFillSchema = requisitions
  .chart('timeToFill')
  .xAxis((x) => x.allowed('roleFamily').default('roleFamily'))
  .groupBy((g) => g.allowed('region').default('region'))
  .filters((f) => f.allowed('hiringMotion', 'employmentType', 'status'))
  .metric((m) => m.aggregate('daysToClose', 'avg').defaultAggregate('daysToClose', 'avg'))
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

const hiringModel = defineDataModel()
  .dataset('requisitions', requisitions)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('requisitionOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'requisitions', column: 'ownerId'},
  })
  .association('requisitionSkills', {
    from: {dataset: 'requisitions', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillRows,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'requisitions', column: 'ownerId', via: 'requisitionOwner'},
    ] as const,
  })
  .attribute('skill', {
    kind: 'select',
    source: {dataset: 'skills', key: 'id', label: 'name'},
    targets: [
      {dataset: 'requisitions', through: 'requisitionSkills', mode: 'exists'},
    ] as const,
  })
  .build()

const hiringDashboard = defineDashboard(hiringModel)
  .chart('hiringVolume', hiringVolumeSchema)
  .chart('ownerLoad', ownerLoadSchema)
  .chart('compensationMix', compensationSchema)
  .chart('timeToFill', timeToFillSchema)
  .sharedFilter('owner')
  .sharedFilter('skill')
  .sharedFilter('status', {
    kind: 'select',
    source: {dataset: 'requisitions', column: 'status'},
  })
  .sharedFilter('activityDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'requisitions', column: 'openedAt'},
    ] as const,
  })
  .build()

const requisitionsDataset = requisitions.build()

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className='rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm'>
      <div className='text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>{label}</div>
      <div className='mt-2 text-2xl font-semibold text-foreground'>{value}</div>
      <div className='mt-1 text-xs leading-5 text-muted-foreground'>{detail}</div>
    </div>
  )
}

function DashboardCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className='overflow-hidden rounded-3xl border border-border/60 bg-background shadow-sm'>
      <div className='border-b border-border/60 px-4 py-3'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='mt-1 text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='p-4'>{children}</div>
    </section>
  )
}

function MetadataLine({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-center justify-between gap-4 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{value}</code>
    </div>
  )
}

function topSkillDemand(
  rows: readonly HiringRequisitionRecord[],
  edges: readonly HiringJobSkillRecord[],
): Array<{name: string; domain: string; count: number}> {
  const visibleRequisitionIds = new Set(rows.map((row) => row.id))
  const counts = new Map<string, number>()

  edges.forEach((edge) => {
    if (!visibleRequisitionIds.has(edge.jobId)) {
      return
    }

    counts.set(edge.skillId, (counts.get(edge.skillId) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([skillId, count]) => {
      const skill = skillById.get(skillId)

      return {
        name: skill?.name ?? skillId,
        domain: skill?.domain ?? 'Unknown',
        count,
      }
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
}

function SharedSelectFilterCard({
  description,
  filter,
}: {
  description: string
  filter: DashboardSharedSelectFilterRuntime
}) {
  return (
    <div className='rounded-2xl border border-border/60 bg-muted/10 p-3'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            {filter.label}
          </div>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>{description}</p>
        </div>
        <button
          type='button'
          onClick={() => filter.clear()}
          className='rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary'>
          Clear
        </button>
      </div>

      <div className='mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1'>
        {filter.options.map((option) => {
          const isActive = filter.values.has(option.value)

          return (
            <button
              key={option.value}
              type='button'
              onClick={() => filter.toggleValue(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}>
              {option.label}
              <span className='ml-1.5 text-[11px] opacity-75'>{integerFormatter.format(option.count)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SharedDateRangeCard({
  filter,
}: {
  filter: DashboardSharedDateRangeFilterRuntime
}) {
  const selection = filter.selection
  const customFrom = selection.customFilter?.from ?? null
  const customTo = selection.customFilter?.to ?? null

  return (
    <div className='rounded-2xl border border-border/60 bg-muted/10 p-3'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <div className='text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            {filter.label}
          </div>
          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
            Shared date scope applied before each chart&apos;s local filters and metrics.
          </p>
        </div>
        <button
          type='button'
          onClick={() => filter.clear()}
          className='rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary'>
          Reset
        </button>
      </div>

      <div className='mt-3 flex flex-wrap gap-2'>
        {[
          {id: 'all-time', label: 'All Time'},
          {id: 'last-30-days', label: 'Last 30 Days'},
          {id: 'last-12-months', label: 'Last 12 Months'},
        ].map((preset) => {
          const isActive = selection.preset === preset.id

          return (
            <button
              key={preset.id}
              type='button'
              onClick={() => filter.setDateRangePreset(preset.id as 'all-time' | 'last-30-days' | 'last-12-months')}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}>
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
        <label className='space-y-1 text-xs text-muted-foreground'>
          <span>From</span>
          <input
            type='date'
            value={toDateInputValue(customFrom)}
            onChange={(event) =>
              filter.setDateRangeFilter({
                from: fromDateInputValue(event.target.value),
                to: customTo,
              })
            }
            className='w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-foreground outline-hidden transition focus:border-primary/40'
          />
        </label>

        <label className='space-y-1 text-xs text-muted-foreground'>
          <span>To</span>
          <input
            type='date'
            value={toDateInputValue(customTo)}
            onChange={(event) =>
              filter.setDateRangeFilter({
                from: customFrom,
                to: fromDateInputValue(event.target.value),
              })
            }
            className='w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-foreground outline-hidden transition focus:border-primary/40'
          />
        </label>
      </div>
    </div>
  )
}

function SharedFiltersPanel() {
  const ownerFilter = useDashboardSharedFilter('owner')
  const skillFilter = useDashboardSharedFilter('skill')
  const statusFilter = useDashboardSharedFilter('status')
  const activityDateFilter = useDashboardSharedFilter('activityDate')

  if (
    ownerFilter.kind !== 'select'
    || skillFilter.kind !== 'select'
    || statusFilter.kind !== 'select'
    || activityDateFilter.kind !== 'date-range'
  ) {
    throw new Error('Unexpected shared filter shape in DatasetModelChart.')
  }

  return (
    <DashboardCard
      title='Dashboard Shared Filters'
      subtitle='Phase 6 explicitly coordinates model attributes, one-off dashboard filters, and a shared date range.'>
      <div className='space-y-3'>
        <SharedSelectFilterCard
          filter={ownerFilter}
          description='Model attribute reused from owners.id -> requisitions.ownerId.'
        />
        <SharedSelectFilterCard
          filter={skillFilter}
          description='Model association filter using requisitions.id <-> skills.id edges.'
        />
        <SharedSelectFilterCard
          filter={statusFilter}
          description='Dashboard-local one-off filter scoped directly to requisitions.status.'
        />
        <SharedDateRangeCard filter={activityDateFilter} />
      </div>
    </DashboardCard>
  )
}

function DashboardSummarySection() {
  const filteredRequisitions = useDashboardDataset('requisitions')

  const dashboardSummary = useMemo(() => {
    const active = filteredRequisitions.filter(
      (row) => row.status === 'Open' || row.status === 'Paused',
    )
    const filled = filteredRequisitions.filter((row) => row.status === 'Filled')
    const recentlyFilled = filled.filter((row) => {
      if (!row.closedAt) {
        return false
      }

      return differenceInDays(row.closedAt, new Date().toISOString()) <= 90
    })
    const avgDaysToClose = filled.reduce(
      (sum, row) => sum + differenceInDays(row.openedAt, row.closedAt!),
      0,
    ) / Math.max(1, filled.length)
    const totalOpenBudget = active.reduce(
      (sum, row) => sum + row.salaryMidpoint * row.headcount,
      0,
    )
    const activeOwners = new Set(active.map((row) => row.ownerId)).size

    return {
      activeRequisitions: active.length,
      recentlyFilled: recentlyFilled.length,
      avgDaysToClose,
      totalOpenBudget,
      activeOwners,
    }
  }, [filteredRequisitions])

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      <SummaryMetric
        label='Active Reqs'
        value={integerFormatter.format(dashboardSummary.activeRequisitions)}
        detail='Globally filtered open and paused roles still in the active plan.'
      />
      <SummaryMetric
        label='Filled In 90 Days'
        value={integerFormatter.format(dashboardSummary.recentlyFilled)}
        detail='Recently closed roles after the shared dashboard slice is applied.'
      />
      <SummaryMetric
        label='Avg Time To Fill'
        value={`${integerFormatter.format(Math.round(dashboardSummary.avgDaysToClose))} days`}
        detail='Average days from open to close for the filtered cohort.'
      />
      <SummaryMetric
        label='Open Budget'
        value={currencyFormatter.format(dashboardSummary.totalOpenBudget)}
        detail='Annualized midpoint budget on active requisitions after global filtering.'
      />
      <SummaryMetric
        label='Active Owners'
        value={integerFormatter.format(dashboardSummary.activeOwners)}
        detail='Distinct hiring owners attached to the currently visible plan.'
      />
      <SummaryMetric
        label='Visible Reqs'
        value={integerFormatter.format(filteredRequisitions.length)}
        detail='This KPI card reads the same filtered slice as the charts.'
      />
    </div>
  )
}

function HiringVolumeCard() {
  const chart = useDashboardChart('hiringVolume')

  return (
    <DashboardCard
      title='Opening Volume'
      subtitle='Hiring demand over time by function, resolved from the dashboard chart registry.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'timeBucket', 'filters']} hidden={['source']} />
        <div className='mt-4'>
          <ChartCanvas height={300} />
        </div>
      </Chart>
    </DashboardCard>
  )
}

function OwnerLoadCard() {
  const chart = useDashboardChart('ownerLoad')

  return (
    <DashboardCard
      title='Owner Load'
      subtitle='Which hiring owners are carrying the biggest active backlog today.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} showDataLabels />
        </div>
      </Chart>
    </DashboardCard>
  )
}

function CompensationMixCard() {
  const chart = useDashboardChart('compensationMix')

  return (
    <DashboardCard
      title='Compensation Mix'
      subtitle='Average salary midpoint by level and region to compare the shape of the plan.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} />
        </div>
      </Chart>
    </DashboardCard>
  )
}

function TimeToFillCard() {
  const chart = useDashboardChart('timeToFill')

  return (
    <DashboardCard
      title='Time To Fill'
      subtitle='Average close time by function and region for roles that have already closed.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} showDataLabels />
        </div>
      </Chart>
    </DashboardCard>
  )
}

function MetadataSection({validation}: {validation: string}) {
  const filteredRequisitions = useDashboardDataset('requisitions')

  const hottestSkills = useMemo(
    () => topSkillDemand(filteredRequisitions, jobSkillRows),
    [filteredRequisitions],
  )

  return (
    <div className='grid gap-4 lg:grid-cols-3'>
      <DashboardCard
        title='Dataset Layer'
        subtitle='Reusable dataset-owned columns still feed every requisition chart in this tab.'>
        <div className='space-y-3'>
          <MetadataLine label='Requisition key' value={(requisitionsDataset.key ?? []).join(', ')} />
          <MetadataLine
            label='Column count'
            value={integerFormatter.format(Object.keys(requisitionsDataset.columns ?? {}).length)}
          />
          <MetadataLine label='Chart registry' value={Object.keys(hiringDashboard.charts).join(', ')} />
          <p className='text-xs leading-5 text-muted-foreground'>
            `defineDataset(...).columns(...)` stays the reusable source of truth. The dashboard only registers charts by id and resolves them later.
          </p>
        </div>
      </DashboardCard>

      <DashboardCard
        title='Dashboard Runtime'
        subtitle='Phase 5 composes dataset-backed charts; Phase 6 coordinates shared filters explicitly.'>
        <div className='space-y-3'>
          <MetadataLine label='Shared filters' value={Object.keys(hiringDashboard.sharedFilters).join(', ')} />
          <MetadataLine label='Model attributes' value={Object.keys(hiringModel.attributes).join(', ')} />
          <MetadataLine label='Non-chart consumer' value='useDashboardDataset("requisitions")' />
          <p className='rounded-2xl border border-border/60 bg-muted/25 px-3 py-3 text-xs leading-5 text-muted-foreground'>
            {validation === 'Validated'
              ? 'Runtime validation passed: dataset keys are unique, owner foreign keys resolve, and every skill edge points at a registered skill. The summary cards and skill list below read the same shared dashboard slice as the charts.'
              : validation}
          </p>
        </div>
      </DashboardCard>

      <DashboardCard
        title='Most Requested Skills'
        subtitle='Association edges still stay explicit while non-chart consumers react to shared filters.'>
        <div className='space-y-2'>
          {hottestSkills.map((skill) => (
            <div
              key={skill.name}
              className='flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2'>
              <div>
                <div className='text-sm font-medium text-foreground'>{skill.name}</div>
                <div className='text-xs text-muted-foreground'>{skill.domain}</div>
              </div>
              <div className='rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground'>
                {integerFormatter.format(skill.count)} reqs
              </div>
            </div>
          ))}
          <p className='pt-1 text-xs leading-5 text-muted-foreground'>
            This list is not a joined chart. It derives from `useDashboardDataset(...)` plus explicit requisition-skill edges, which keeps many-to-many behavior visible.
          </p>
        </div>
      </DashboardCard>
    </div>
  )
}

function DatasetModelDashboard({validation}: {validation: string}) {
  return (
    <div className='space-y-6'>
      <div className='overflow-hidden rounded-[28px] border border-primary/20 bg-linear-to-br from-primary/8 via-background to-background shadow-sm'>
        <div className='grid gap-6 px-5 py-5 xl:grid-cols-[1.2fr_0.8fr]'>
          <div className='space-y-4'>
            <div className='inline-flex rounded-full border border-primary/20 bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary'>
              Dataset + Model + Dashboard
            </div>
            <div>
              <h2 className='text-xl font-semibold text-foreground'>Global hiring planning dashboard</h2>
              <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                This scenario now uses the full additive stack: reusable dataset-owned columns, an explicit linked model for owners and skills, a typed dashboard chart registry,
                and shared dashboard filters that coordinate both charts and non-chart consumers without changing the simple `useChart({'{'}data, schema{'}'})` path.
              </p>
            </div>

            <DashboardSummarySection />
          </div>

          <SharedFiltersPanel />
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <HiringVolumeCard />
        <OwnerLoadCard />
        <CompensationMixCard />
        <TimeToFillCard />
      </div>

      <MetadataSection validation={validation} />

      <div className='rounded-3xl border border-border/60 bg-background px-5 py-4 text-xs leading-6 text-muted-foreground shadow-sm'>
        The contract stays strict: each chart still executes against one flat requisition dataset, while the dashboard runtime composes registered charts by id and applies explicit shared filters first.
        There are still no hidden joins, linked metrics, or automatic denormalization.
      </div>
    </div>
  )
}

/**
 * Playground showcase for Phases 1 through 6:
 * dataset-owned columns, a linked model, typed dashboard composition, explicit
 * shared filters, and non-chart consumers all layered on top of the existing
 * single-chart runtime.
 */
export function DatasetModelChart() {
  const dashboard = useDashboard({
    definition: hiringDashboard,
    data: {
      requisitions: requisitionRows,
      owners: ownerRows,
      skills: skillRows,
    },
  })

  const validation = useMemo(() => {
    try {
      hiringModel.validateData({
        requisitions: requisitionRows,
        owners: ownerRows,
        skills: skillRows,
      })

      return 'Validated'
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }, [])

  return (
    <DashboardProvider dashboard={dashboard}>
      <DatasetModelDashboard validation={validation} />
    </DashboardProvider>
  )
}
