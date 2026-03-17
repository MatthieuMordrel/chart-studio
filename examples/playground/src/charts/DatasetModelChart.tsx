import {useMemo} from 'react'
import {defineDataModel, defineDataset, useChart} from '@matthieumordrel/chart-studio'
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

const {requisitions: requisitionRows, owners: ownerRows, skills: skillRows, jobSkills: jobSkillRows} = hiringNetworkData

const ownerById = new Map(ownerRows.map(owner => [owner.id, owner] satisfies readonly [string, HiringOwnerRecord]))
const skillById = new Map(skillRows.map(skill => [skill.id, skill] satisfies readonly [string, HiringSkillRecord]))

function differenceInDays(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()

  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)))
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
      accessor: (row) => (row.status === 'Open' || row.status === 'Paused' ? 'Active Plan' : 'Closed'),
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
      accessor: (row) => (row.offersExtended > 0 ? row.offersAccepted / row.offersExtended : null),
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
  children: React.ReactNode
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
  edges: readonly HiringJobSkillRecord[],
): Array<{name: string; domain: string; count: number}> {
  const counts = new Map<string, number>()

  edges.forEach((edge) => {
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
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
}

/**
 * Phase 1 + Phase 2 playground showcase:
 * a realistic hiring planning dataset powers a small dashboard, while the
 * linked model validates owners and skill edges explicitly.
 */
export function DatasetModelChart() {
  const hiringVolumeChart = useChart({
    data: requisitionRows,
    schema: hiringVolumeSchema,
    sourceLabel: 'Hiring Plan',
  })

  const ownerLoadChart = useChart({
    data: requisitionRows,
    schema: ownerLoadSchema,
    sourceLabel: 'Hiring Plan',
  })

  const compensationChart = useChart({
    data: requisitionRows,
    schema: compensationSchema,
    sourceLabel: 'Hiring Plan',
  })

  const timeToFillChart = useChart({
    data: requisitionRows,
    schema: timeToFillSchema,
    sourceLabel: 'Hiring Plan',
  })

  const dashboardSummary = useMemo(() => {
    const active = requisitionRows.filter(row => row.status === 'Open' || row.status === 'Paused')
    const filled = requisitionRows.filter(row => row.status === 'Filled')
    const recentlyFilled = filled.filter((row) => {
      if (!row.closedAt) {
        return false
      }

      return differenceInDays(row.closedAt, new Date().toISOString()) <= 90
    })
    const avgDaysToClose = filled.reduce((sum, row) => sum + differenceInDays(row.openedAt, row.closedAt!), 0) / Math.max(1, filled.length)
    const totalOpenBudget = active.reduce((sum, row) => sum + row.salaryMidpoint * row.headcount, 0)
    const activeOwners = new Set(active.map(row => row.ownerId)).size

    return {
      activeRequisitions: active.length,
      recentlyFilled: recentlyFilled.length,
      avgDaysToClose,
      totalOpenBudget,
      activeOwners,
      skillLinks: jobSkillRows.length,
    }
  }, [])

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

  const hottestSkills = useMemo(() => topSkillDemand(jobSkillRows), [])

  return (
    <div className='space-y-6'>
      <div className='overflow-hidden rounded-[28px] border border-primary/20 bg-linear-to-br from-primary/8 via-background to-background shadow-sm'>
        <div className='grid gap-6 px-5 py-5 xl:grid-cols-[1.35fr_0.95fr]'>
          <div className='space-y-4'>
            <div className='inline-flex rounded-full border border-primary/20 bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary'>
              Dataset-First + Linked Model
            </div>
            <div>
              <h2 className='text-xl font-semibold text-foreground'>Global hiring planning dashboard</h2>
              <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                This scenario uses a generated hiring network with {integerFormatter.format(requisitionRows.length)} requisitions,{' '}
                {integerFormatter.format(ownerRows.length)} hiring owners, {integerFormatter.format(skillRows.length)} skills, and{' '}
                {integerFormatter.format(jobSkillRows.length)} explicit many-to-many skill edges. The charts run on one flat requisition dataset,
                while the model layer validates the owner relationship and the skill association separately.
              </p>
            </div>

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
              <SummaryMetric
                label='Active Reqs'
                value={integerFormatter.format(dashboardSummary.activeRequisitions)}
                detail='Open and paused roles still in the hiring plan.'
              />
              <SummaryMetric
                label='Filled In 90 Days'
                value={integerFormatter.format(dashboardSummary.recentlyFilled)}
                detail='Recently closed roles to show current throughput.'
              />
              <SummaryMetric
                label='Avg Time To Fill'
                value={`${integerFormatter.format(Math.round(dashboardSummary.avgDaysToClose))} days`}
                detail='Average days from open to close for filled roles.'
              />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1'>
            <SummaryMetric
              label='Open Budget'
              value={currencyFormatter.format(dashboardSummary.totalOpenBudget)}
              detail='Annualized salary midpoint budget tied to active requisitions.'
            />
            <SummaryMetric
              label='Active Owners'
              value={integerFormatter.format(dashboardSummary.activeOwners)}
              detail='Distinct hiring owners attached to the active plan.'
            />
            <SummaryMetric
              label='Skill Links'
              value={integerFormatter.format(dashboardSummary.skillLinks)}
              detail='Explicit requisition-skill edges registered in the association layer.'
            />
          </div>
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <DashboardCard
          title='Opening Volume'
          subtitle='Hiring demand over time by function. Best for planning trend and mix shifts.'>
          <Chart chart={hiringVolumeChart}>
            <ChartToolbar pinned={['groupBy', 'timeBucket', 'filters']} hidden={['source']} />
            <div className='mt-4'>
              <ChartCanvas height={300} />
            </div>
          </Chart>
        </DashboardCard>

        <DashboardCard
          title='Owner Load'
          subtitle='Which hiring owners are carrying the biggest active backlog today.'>
          <Chart chart={ownerLoadChart}>
            <ChartToolbar pinned={['groupBy', 'filters']} hidden={['source', 'timeBucket']} />
            <div className='mt-4'>
              <ChartCanvas height={300} showDataLabels />
            </div>
          </Chart>
        </DashboardCard>

        <DashboardCard
          title='Compensation Mix'
          subtitle='Average salary midpoint by level and region to compare the shape of the plan.'>
          <Chart chart={compensationChart}>
            <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
            <div className='mt-4'>
              <ChartCanvas height={300} />
            </div>
          </Chart>
        </DashboardCard>

        <DashboardCard
          title='Time To Fill'
          subtitle='Average close time by function and region for roles that have already closed.'>
          <Chart chart={timeToFillChart}>
            <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
            <div className='mt-4'>
              <ChartCanvas height={300} showDataLabels />
            </div>
          </Chart>
        </DashboardCard>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <DashboardCard
          title='Dataset Layer'
          subtitle='Reusable dataset-owned columns feed every requisition chart in this tab.'>
          <div className='space-y-3'>
            <MetadataLine label='Requisition key' value={(requisitionsDataset.key ?? []).join(', ')} />
            <MetadataLine label='Column count' value={integerFormatter.format(Object.keys(requisitionsDataset.columns ?? {}).length)} />
            <MetadataLine label='Chart reuse' value='4 schemas from 1 dataset' />
            <p className='text-xs leading-5 text-muted-foreground'>
              `defineDataset(...).columns(...)` is the reusable source of truth here. Each chart narrows controls differently without redefining columns.
            </p>
          </div>
        </DashboardCard>

        <DashboardCard
          title='Model Validation'
          subtitle='The linked model validates owners and skills separately from chart execution.'>
          <div className='space-y-3'>
            <MetadataLine label='Relationship' value='owners.id -> requisitions.ownerId' />
            <MetadataLine label='Association' value='requisitions.id <-> skills.id' />
            <MetadataLine label='Attributes' value={Object.keys(hiringModel.attributes).join(', ')} />
            <p className='rounded-2xl border border-border/60 bg-muted/25 px-3 py-3 text-xs leading-5 text-muted-foreground'>
              {validation === 'Validated'
                ? 'Runtime validation passed: dataset keys are unique, owner foreign keys resolve, and every skill edge points at a registered skill.'
                : validation}
            </p>
          </div>
        </DashboardCard>

        <DashboardCard
          title='Most Requested Skills'
          subtitle='Association edges surface where the plan is most concentrated even without automatic denormalization.'>
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
              This is intentionally shown as model-level metadata, not as an automatically joined chart, because many-to-many chart grain is still deferred to later phases.
            </p>
          </div>
        </DashboardCard>
      </div>

      <div className='rounded-3xl border border-border/60 bg-background px-5 py-4 text-xs leading-6 text-muted-foreground shadow-sm'>
        The current contract stays strict: the charts above execute against one flat requisition dataset, while the linked model handles owner lookups,
        explicit skill associations, reusable filter semantics, and runtime validation. That keeps the single-chart experience simple without hiding
        cross-dataset behavior behind automatic joins.
      </div>
    </div>
  )
}
