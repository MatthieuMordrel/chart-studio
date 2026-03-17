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
  useChart,
  type DashboardSharedDateRangeFilterRuntime,
  type DashboardSharedSelectFilterRuntime,
} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio/ui'
import {
  hiringNetworkData as projectPlanningSeedData,
} from '../mock-data'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const integerFormatter = new Intl.NumberFormat('en-US')

/**
 * Playground domain note.
 *
 * The underlying seed data still comes from the hiring generator, but this file
 * intentionally remaps it into a project-planning domain because "project plan
 * -> manager -> capability" is easier to understand while preserving the same
 * relational shape and the same Phase 7 needs.
 */
const {
  requisitions: seedProjectPlanRows,
  owners: seedManagerRows,
  skills: seedCapabilityRows,
  jobSkills: seedProjectCapabilityRows,
} = projectPlanningSeedData

/** Map seed role families into clearer project initiative buckets for the demo. */
const initiativeTypeByRoleFamily = {
  Engineering: 'Platform',
  Data: 'Analytics',
  Security: 'Security',
  Design: 'Experience',
  Revenue: 'Growth',
  Operations: 'Operations',
} as const

/** Translate the source leveling system into a neutral delivery tier scale. */
const deliveryTierByLevel = {
  IC4: 'Tier 1',
  IC5: 'Tier 2',
  Staff: 'Tier 3',
  Manager: 'Tier 4',
  Director: 'Tier 5',
} as const

/** Reframe hiring motion as the reason a delivery plan exists. */
const deliveryMotionBySourceMotion = {
  Backfill: 'Stabilize',
  Growth: 'Grow',
  Expansion: 'Expand',
} as const

/** Reframe employment type as how the work will be executed. */
const executionModeBySourceType = {
  'Full Time': 'Internal',
  Contract: 'Partner',
} as const

/** Reframe hiring lifecycle statuses into project-planning lifecycle statuses. */
const projectStatusBySourceStatus = {
  Open: 'Planned',
  Filled: 'Completed',
  Paused: 'On Hold',
  Cancelled: 'Cancelled',
} as const

/** Map owner portfolios into clearer manager program areas for the demo. */
const programAreaByPortfolio = {
  Platform: 'Platform',
  Revenue: 'Commercial',
  Data: 'Analytics',
  Security: 'Security',
  Product: 'Product',
  Operations: 'Operations',
  Growth: 'Growth',
  Design: 'Experience',
} as const

/** Map skill domains into capability areas that read naturally for delivery teams. */
const capabilityDomainBySourceDomain = {
  Frontend: 'Experience',
  Backend: 'Service Delivery',
  Infrastructure: 'Platform',
  Data: 'Analytics',
  Growth: 'Growth',
  Revenue: 'Commercial',
  Product: 'Product',
  Design: 'Experience Design',
  Security: 'Security',
  Operations: 'Operations',
} as const

type InitiativeType = (typeof initiativeTypeByRoleFamily)[keyof typeof initiativeTypeByRoleFamily]
type DeliveryTier = (typeof deliveryTierByLevel)[keyof typeof deliveryTierByLevel]
type DeliveryMotion = (typeof deliveryMotionBySourceMotion)[keyof typeof deliveryMotionBySourceMotion]
type ExecutionMode = (typeof executionModeBySourceType)[keyof typeof executionModeBySourceType]
type ProjectStatus = (typeof projectStatusBySourceStatus)[keyof typeof projectStatusBySourceStatus]
type ProgramArea = (typeof programAreaByPortfolio)[keyof typeof programAreaByPortfolio]
type CapabilityDomain = (typeof capabilityDomainBySourceDomain)[keyof typeof capabilityDomainBySourceDomain]

/**
 * One approved project delivery plan.
 *
 * Grain:
 * one row = one project plan.
 *
 * Each plan belongs to exactly one manager, but can require multiple
 * capabilities through the explicit `projectCapabilities` bridge rows.
 */
type ProjectPlanRecord = {
  id: string
  managerId: string
  initiativeType: InitiativeType
  department: string
  region: 'AMER' | 'EMEA' | 'APAC'
  hub: string
  deliveryTier: DeliveryTier
  deliveryMotion: DeliveryMotion
  executionMode: ExecutionMode
  status: ProjectStatus
  plannedAt: string
  targetLaunchAt: string
  completedAt: string | null
  budgetMidpoint: number
  staffingCount: number
  requestCount: number
  reviewCount: number
  approvalsRequested: number
  approvalsGranted: number
}

/**
 * Manager lookup row referenced by `projectPlans.managerId`.
 *
 * Keeping manager data on its own table lets the materialized view example
 * project manager fields without redefining `managerName`, `managerRegion`, and
 * `managerProgramArea` as derived columns on every project dataset.
 */
type ProjectManagerRecord = {
  id: string
  name: string
  region: 'AMER' | 'EMEA' | 'APAC'
  programArea: ProgramArea
}

/**
 * Capability lookup row used by many project plans.
 *
 * This stays normalized on purpose so the many-to-many materialized view has a
 * meaningful role in the example.
 */
type CapabilityRecord = {
  id: string
  name: string
  domain: CapabilityDomain
}

/** Explicit bridge row linking one project plan to one required capability. */
type ProjectCapabilityEdgeRecord = {
  projectId: string
  capabilityId: string
}

/** Project planning rows remapped from the shared seed data into clearer business language. */
const projectPlanRows: ProjectPlanRecord[] = seedProjectPlanRows.map((row) => ({
  id: row.id,
  managerId: row.ownerId,
  initiativeType: initiativeTypeByRoleFamily[row.roleFamily],
  department: row.team,
  region: row.region,
  hub: row.office,
  deliveryTier: deliveryTierByLevel[row.level],
  deliveryMotion: deliveryMotionBySourceMotion[row.hiringMotion],
  executionMode: executionModeBySourceType[row.employmentType],
  status: projectStatusBySourceStatus[row.status],
  plannedAt: row.openedAt,
  targetLaunchAt: row.targetStartAt,
  completedAt: row.closedAt,
  budgetMidpoint: row.salaryMidpoint,
  staffingCount: row.headcount,
  requestCount: row.applicants,
  reviewCount: row.onsiteCount,
  approvalsRequested: row.offersExtended,
  approvalsGranted: row.offersAccepted,
}))

/** Manager lookup rows remapped from the shared seed data. */
const managerRows: ProjectManagerRecord[] = seedManagerRows.map((row) => ({
  id: row.id,
  name: row.name,
  region: row.region,
  programArea: programAreaByPortfolio[row.portfolio],
}))

/** Capability lookup rows remapped from the shared seed data. */
const capabilityRows: CapabilityRecord[] = seedCapabilityRows.map((row) => ({
  id: row.id,
  name: row.name,
  domain: capabilityDomainBySourceDomain[row.domain],
}))

/** Explicit many-to-many bridge rows linking project plans to capabilities. */
const projectCapabilityRows: ProjectCapabilityEdgeRecord[] = seedProjectCapabilityRows.map((row) => ({
  projectId: row.jobId,
  capabilityId: row.skillId,
}))

/**
 * Full normalized project-planning dataset passed to the model and dashboard runtime.
 *
 * Domain meaning:
 * - `projectPlans` are approved initiatives, one row per project plan
 * - `managers` are the accountable leaders referenced by `projectPlans.managerId`
 * - `capabilities` are reusable capabilities attached to project plans through
 *   the explicit `projectCapabilities` bridge data
 */
const planningModelData = {
  projectPlans: projectPlanRows,
  managers: managerRows,
  capabilities: capabilityRows,
} as const

/** Compute elapsed whole days between two ISO timestamps for duration-style derived fields. */
function differenceInDays(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()

  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)))
}

/** Adapt one `Date | null` value for the native `<input type="date">` controls in the demo. */
function toDateInputValue(date: Date | null): string {
  if (!date) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parse one native date input value back into the dashboard date-range runtime shape. */
function fromDateInputValue(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null
}

/**
 * Base project-planning dataset.
 *
 * Grain:
 * one row = one approved project plan.
 *
 * This stays the normalized source of truth for the dashboard charts. Phase 7
 * does not denormalize it by default.
 */
const projectPlans = defineDataset<ProjectPlanRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('managerId'),
    c.category('initiativeType', {label: 'Initiative'}),
    c.category('department'),
    c.category('region'),
    c.category('hub'),
    c.category('deliveryTier', {label: 'Delivery Tier'}),
    c.category('deliveryMotion', {label: 'Delivery Motion'}),
    c.category('executionMode', {label: 'Execution Mode'}),
    c.category('status'),
    c.date('plannedAt', {label: 'Planned'}),
    c.date('targetLaunchAt', {label: 'Target Launch'}),
    c.date('completedAt', {label: 'Completed'}),
    c.number('budgetMidpoint', {label: 'Budget Midpoint', format: 'currency'}),
    c.number('staffingCount', {label: 'Staffing'}),
    c.number('requestCount', {label: 'Requests'}),
    c.number('reviewCount', {label: 'Reviews'}),
    c.number('approvalsRequested', {label: 'Approvals Requested'}),
    c.number('approvalsGranted', {label: 'Approvals Granted'}),
    c.derived.category('statusBucket', {
      label: 'Status Bucket',
      accessor: (row) => (row.status === 'Planned' || row.status === 'On Hold' ? 'Active Plan' : 'Closed'),
    }),
    c.derived.number('daysToComplete', {
      label: 'Days To Complete',
      format: {kind: 'duration', unit: 'days'},
      accessor: (row) => (row.completedAt ? differenceInDays(row.plannedAt, row.completedAt) : null),
    }),
    c.derived.number('totalBudget', {
      label: 'Total Budget',
      format: 'currency',
      accessor: (row) => row.budgetMidpoint * row.staffingCount,
    }),
    c.derived.number('approvalRate', {
      label: 'Approval Rate',
      format: 'percent',
      accessor: (row) => (
        row.approvalsRequested > 0 ? row.approvalsGranted / row.approvalsRequested : null
      ),
    }),
  ])

/**
 * Manager lookup dataset.
 *
 * Each row is one manager referenced by `projectPlans.managerId`. These fields
 * are intentionally kept on their own table so the materialized-view example
 * can project them without repeating derived columns on the project plan
 * dataset.
 */
const managers = defineDataset<ProjectManagerRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Manager'}),
    c.category('region'),
    c.category('programArea', {label: 'Program Area'}),
  ])

/**
 * Capability lookup dataset.
 *
 * Each row is one reusable capability that can be linked to many project plans
 * through the explicit many-to-many `projectCapabilities` association.
 */
const capabilities = defineDataset<CapabilityRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Capability'}),
    c.category('domain', {label: 'Capability Area'}),
  ])

/** Normalized dashboard chart: plan creation volume over time by initiative. */
const planningVolumeSchema = projectPlans
  .chart('planningVolume')
  .xAxis((x) => x.allowed('plannedAt').default('plannedAt'))
  .groupBy((g) => g.allowed('initiativeType').default('initiativeType'))
  .filters((f) => f.allowed('region', 'deliveryMotion', 'executionMode', 'statusBucket'))
  .metric((m) => m.count().defaultCount())
  .chartType((t) => t.allowed('area', 'line', 'bar').default('area'))
  .timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))

/** Normalized dashboard chart: budget mix stays fully within the project-plan grain. */
const budgetMixSchema = projectPlans
  .chart('budgetMix')
  .xAxis((x) => x.allowed('deliveryTier').default('deliveryTier'))
  .groupBy((g) => g.allowed('region').default('region'))
  .filters((f) => f.allowed('initiativeType', 'executionMode', 'hub'))
  .metric((m) => m.aggregate('budgetMidpoint', 'avg').defaultAggregate('budgetMidpoint', 'avg'))
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

/** Normalized dashboard chart: time-to-complete analysis still reads one project row at a time. */
const timeToCompleteSchema = projectPlans
  .chart('timeToComplete')
  .xAxis((x) => x.allowed('initiativeType').default('initiativeType'))
  .groupBy((g) => g.allowed('region').default('region'))
  .filters((f) => f.allowed('deliveryMotion', 'executionMode', 'status'))
  .metric((m) => m.aggregate('daysToComplete', 'avg').defaultAggregate('daysToComplete', 'avg'))
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

/**
 * Linked delivery-planning model.
 *
 * Relationship semantics:
 * - `projectManager`: `managers.id -> projectPlans.managerId`
 *
 * Association semantics:
 * - `projectCapabilities`: explicit bridge rows linking project plans to capabilities
 *
 * Shared-filter semantics:
 * - `manager` and `capability` let the dashboard coordinate normalized datasets
 *   without turning the chart runtime into a hidden join engine
 */
const deliveryModel = defineDataModel()
  .dataset('projectPlans', projectPlans)
  .dataset('managers', managers)
  .dataset('capabilities', capabilities)
  .relationship('projectManager', {
    from: {dataset: 'managers', key: 'id'},
    to: {dataset: 'projectPlans', column: 'managerId'},
  })
  .association('projectCapabilities', {
    from: {dataset: 'projectPlans', key: 'id'},
    to: {dataset: 'capabilities', key: 'id'},
    data: projectCapabilityRows,
    columns: {
      from: 'projectId',
      to: 'capabilityId',
    },
  })
  .attribute('manager', {
    kind: 'select',
    source: {dataset: 'managers', key: 'id', label: 'name'},
    targets: [
      {dataset: 'projectPlans', column: 'managerId', via: 'projectManager'},
    ] as const,
  })
  .attribute('capability', {
    kind: 'select',
    source: {dataset: 'capabilities', key: 'id', label: 'name'},
    targets: [
      {dataset: 'projectPlans', through: 'projectCapabilities', mode: 'exists'},
    ] as const,
  })
  .build()

/**
 * Dashboard composition stays additive and normalized.
 *
 * These charts still run directly on the project-plan dataset, with shared
 * filters narrowing the visible slice before each chart's local filters run.
 */
const deliveryPlanningDashboard = defineDashboard(deliveryModel)
  .chart('planningVolume', planningVolumeSchema)
  .chart('budgetMix', budgetMixSchema)
  .chart('timeToComplete', timeToCompleteSchema)
  .sharedFilter('manager')
  .sharedFilter('capability')
  .sharedFilter('status', {
    kind: 'select',
    source: {dataset: 'projectPlans', column: 'status'},
  })
  .sharedFilter('planningDate', {
    kind: 'date-range',
    targets: [
      {dataset: 'projectPlans', column: 'plannedAt'},
    ] as const,
  })
  .build()

/**
 * Phase 7 lookup-style materialized view.
 *
 * Grain:
 * one row = one project plan.
 *
 * This view preserves the project-plan grain while projecting related manager
 * fields like `managerName`, `managerRegion`, and `managerProgramArea`.
 */
const projectPlansWithManager = deliveryModel.materialize('projectPlansWithManager', (m) =>
  m
    .from('projectPlans')
    .join('manager', {relationship: 'projectManager'})
    .grain('project-plan'),
)

/**
 * Phase 7 many-to-many materialized view.
 *
 * Grain:
 * one row = one project-plan-capability pair.
 *
 * This is the explicit row-expanding path: a project plan may now appear
 * several times, once for each linked capability. That multiplication is
 * visible in both the view name and the declared grain label.
 */
const projectCapabilityView = deliveryModel.materialize('projectCapabilityView', (m) =>
  m
    .from('projectPlans')
    .join('manager', {relationship: 'projectManager'})
    .throughAssociation('capability', {association: 'projectCapabilities'})
    .grain('project-plan-capability'),
)

/** Cross-dataset chart authored against the explicit `projectPlansWithManager` view. */
const managerLoadSchema = projectPlansWithManager
  .chart('managerLoad')
  .xAxis((x) => x.allowed('managerName').default('managerName'))
  .groupBy((g) => g.allowed('statusBucket').default('statusBucket'))
  .filters((f) => f.allowed('managerRegion', 'managerProgramArea', 'initiativeType', 'deliveryMotion'))
  .metric((m) => m.count().defaultCount())
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

/** Cross-dataset chart authored against the explicit `projectCapabilityView` many-to-many grain. */
const capabilityDemandSchema = projectCapabilityView
  .chart('capabilityDemand')
  .xAxis((x) => x.allowed('capabilityName').default('capabilityName'))
  .groupBy((g) => g.allowed('managerRegion').default('managerRegion'))
  .filters((f) => f.allowed('capabilityDomain', 'initiativeType', 'statusBucket'))
  .metric((m) => m.count().defaultCount())
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))

/** Resolved dataset metadata used in the diagnostics section of the playground card. */
const projectPlansDataset = projectPlans.build()

/** Small KPI card used across the dashboard summary section. */
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

/** Shared card shell so dataset, model, dashboard, and materialized-view sections read consistently. */
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

/** Lightweight metadata row used in the explanatory diagnostics panels. */
function MetadataLine({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-center justify-between gap-4 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{value}</code>
    </div>
  )
}

/**
 * Aggregate the most-requested capabilities from the already-materialized
 * project-plan-capability grain.
 *
 * This is intentionally not another chart. It demonstrates that explicit
 * materialized views are also useful for non-chart consumers when that grain is
 * the honest shape of the analysis.
 */
function topCapabilityDemand(
  rows: ReadonlyArray<{
    capabilityId: string
    capabilityName: string
    capabilityDomain: string | null
  }>,
): Array<{name: string; domain: string; count: number}> {
  const counts = new Map<string, {name: string; domain: string; count: number}>()

  rows.forEach((row) => {
    const existing = counts.get(row.capabilityId)

    if (existing) {
      existing.count += 1
      return
    }

    counts.set(row.capabilityId, {
      name: row.capabilityName,
      domain: row.capabilityDomain ?? 'Unknown',
      count: 1,
    })
  })

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
}

/** Render one reusable select-style shared filter card. */
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

/** Render one shared date-range filter card driven by the dashboard runtime. */
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

/** Panel explaining how model attributes and dashboard-local filters compose in the example. */
function SharedFiltersPanel() {
  const managerFilter = useDashboardSharedFilter('manager')
  const capabilityFilter = useDashboardSharedFilter('capability')
  const statusFilter = useDashboardSharedFilter('status')
  const planningDateFilter = useDashboardSharedFilter('planningDate')

  if (
    managerFilter.kind !== 'select'
    || capabilityFilter.kind !== 'select'
    || statusFilter.kind !== 'select'
    || planningDateFilter.kind !== 'date-range'
  ) {
    throw new Error('Unexpected shared filter shape in DatasetModelChart.')
  }

  return (
    <DashboardCard
      title='Dashboard Shared Filters'
      subtitle='Phase 6 explicitly coordinates model attributes, one-off dashboard filters, and a shared date range.'>
      <div className='space-y-3'>
        <SharedSelectFilterCard
          filter={managerFilter}
          description='Model attribute reused from managers.id -> projectPlans.managerId.'
        />
        <SharedSelectFilterCard
          filter={capabilityFilter}
          description='Model association filter using projectPlans.id <-> capabilities.id edges.'
        />
        <SharedSelectFilterCard
          filter={statusFilter}
          description='Dashboard-local one-off filter scoped directly to projectPlans.status.'
        />
        <SharedDateRangeCard filter={planningDateFilter} />
      </div>
    </DashboardCard>
  )
}

/** KPI section that proves normalized dashboard consumers still work without any materialization. */
function DashboardSummarySection() {
  const filteredProjectPlans = useDashboardDataset('projectPlans')

  const dashboardSummary = useMemo(() => {
    const active = filteredProjectPlans.filter(
      (row) => row.status === 'Planned' || row.status === 'On Hold',
    )
    const completed = filteredProjectPlans.filter((row) => row.status === 'Completed')
    const recentlyCompleted = completed.filter((row) => {
      if (!row.completedAt) {
        return false
      }

      return differenceInDays(row.completedAt, new Date().toISOString()) <= 90
    })
    const avgDaysToComplete = completed.reduce(
      (sum, row) => sum + differenceInDays(row.plannedAt, row.completedAt!),
      0,
    ) / Math.max(1, completed.length)
    const totalActiveBudget = active.reduce(
      (sum, row) => sum + row.budgetMidpoint * row.staffingCount,
      0,
    )
    const activeManagers = new Set(active.map((row) => row.managerId)).size

    return {
      activePlans: active.length,
      recentlyCompleted: recentlyCompleted.length,
      avgDaysToComplete,
      totalActiveBudget,
      activeManagers,
    }
  }, [filteredProjectPlans])

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      <SummaryMetric
        label='Active Plans'
        value={integerFormatter.format(dashboardSummary.activePlans)}
        detail='Globally filtered planned and on-hold initiatives still in the active portfolio.'
      />
      <SummaryMetric
        label='Completed In 90 Days'
        value={integerFormatter.format(dashboardSummary.recentlyCompleted)}
        detail='Recently completed initiatives after the shared dashboard slice is applied.'
      />
      <SummaryMetric
        label='Avg Time To Complete'
        value={`${integerFormatter.format(Math.round(dashboardSummary.avgDaysToComplete))} days`}
        detail='Average days from planning to completion for the filtered cohort.'
      />
      <SummaryMetric
        label='Active Budget'
        value={currencyFormatter.format(dashboardSummary.totalActiveBudget)}
        detail='Total midpoint budget on active project plans after global filtering.'
      />
      <SummaryMetric
        label='Active Managers'
        value={integerFormatter.format(dashboardSummary.activeManagers)}
        detail='Distinct managers attached to the currently visible project portfolio.'
      />
      <SummaryMetric
        label='Visible Plans'
        value={integerFormatter.format(filteredProjectPlans.length)}
        detail='This KPI card reads the same filtered slice as the charts.'
      />
    </div>
  )
}

/** Normalized dashboard chart card resolved through the dashboard registry. */
function PlanningVolumeCard() {
  const chart = useDashboardChart('planningVolume')

  return (
    <DashboardCard
      title='Planning Volume'
      subtitle='Project plans created over time by initiative, resolved from the dashboard chart registry.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'timeBucket', 'filters']} hidden={['source']} />
        <div className='mt-4'>
          <ChartCanvas height={300} />
        </div>
      </Chart>
    </DashboardCard>
  )
}

/**
 * Cross-dataset chart card backed by the explicit `projectPlansWithManager` view.
 *
 * The dashboard still supplies the normalized filtered project-plan slice
 * first, and only then do we materialize the manager lookup projection for this
 * chart.
 */
function MaterializedManagerLoadCard() {
  const filteredProjectPlans = useDashboardDataset('projectPlans')
  const rows = useMemo(
    () => projectPlansWithManager.materialize({
      ...planningModelData,
      projectPlans: filteredProjectPlans,
    }),
    [filteredProjectPlans],
  )
  const chart = useChart({
    data: rows,
    schema: managerLoadSchema,
  })

  return (
    <DashboardCard
      title='Manager Load'
      subtitle='Explicit materialized project-plan grain with manager columns projected from the linked model.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} showDataLabels />
        </div>
      </Chart>
    </DashboardCard>
  )
}

/**
 * Cross-dataset chart card backed by the explicit `projectCapabilityView`.
 *
 * This is the many-to-many smoke test for Phase 7 in the playground.
 */
function MaterializedCapabilityDemandCard() {
  const filteredProjectPlans = useDashboardDataset('projectPlans')
  const rows = useMemo(
    () => projectCapabilityView.materialize({
      ...planningModelData,
      projectPlans: filteredProjectPlans,
    }),
    [filteredProjectPlans],
  )
  const chart = useChart({
    data: rows,
    schema: capabilityDemandSchema,
  })

  return (
    <DashboardCard
      title='Capability Demand'
      subtitle='Explicit project-plan-capability grain derived through the model association and reused like a normal dataset.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} />
        </div>
      </Chart>
    </DashboardCard>
  )
}

/** Normalized dashboard chart card for delivery-tier and region budget analysis. */
function BudgetMixCard() {
  const chart = useDashboardChart('budgetMix')

  return (
    <DashboardCard
      title='Budget Mix'
      subtitle='Average midpoint budget by delivery tier and region to compare the shape of the plan.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} />
        </div>
      </Chart>
    </DashboardCard>
  )
}

/** Normalized dashboard chart card for project completion-time analysis. */
function TimeToCompleteCard() {
  const chart = useDashboardChart('timeToComplete')

  return (
    <DashboardCard
      title='Time To Complete'
      subtitle='Average completion time by initiative and region for projects that have already finished.'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['groupBy', 'filters', 'metric']} hidden={['source', 'timeBucket']} />
        <div className='mt-4'>
          <ChartCanvas height={300} showDataLabels />
        </div>
      </Chart>
    </DashboardCard>
  )
}

/**
 * Diagnostics section for the example.
 *
 * It shows the split between:
 * - dataset-owned column contracts
 * - dashboard-level shared state
 * - explicit materialized views for cross-dataset grains
 */
function MetadataSection({validation}: {validation: string}) {
  const filteredProjectPlans = useDashboardDataset('projectPlans')
  const filteredProjectCapabilities = useMemo(
    () => projectCapabilityView.materialize({
      ...planningModelData,
      projectPlans: filteredProjectPlans,
    }),
    [filteredProjectPlans],
  )

  const hottestCapabilities = useMemo(
    () => topCapabilityDemand(filteredProjectCapabilities),
    [filteredProjectCapabilities],
  )

  return (
    <div className='grid gap-4 lg:grid-cols-3'>
      <DashboardCard
        title='Dataset Layer'
        subtitle='Reusable dataset-owned columns still feed every project-planning chart in this tab.'>
        <div className='space-y-3'>
          <MetadataLine label='Project plan key' value={(projectPlansDataset.key ?? []).join(', ')} />
          <MetadataLine
            label='Column count'
            value={integerFormatter.format(Object.keys(projectPlansDataset.columns ?? {}).length)}
          />
          <MetadataLine label='Chart registry' value={Object.keys(deliveryPlanningDashboard.charts).join(', ')} />
          <p className='text-xs leading-5 text-muted-foreground'>
            `defineDataset(...).columns(...)` stays the reusable source of truth. The dashboard only registers charts by id and resolves them later.
          </p>
        </div>
      </DashboardCard>

      <DashboardCard
        title='Dashboard Runtime'
        subtitle='Phase 5 composes dataset-backed charts; Phase 6 coordinates shared filters explicitly.'>
        <div className='space-y-3'>
          <MetadataLine label='Shared filters' value={Object.keys(deliveryPlanningDashboard.sharedFilters).join(', ')} />
          <MetadataLine label='Model attributes' value={Object.keys(deliveryModel.attributes).join(', ')} />
          <MetadataLine
            label='Materialized views'
            value={[projectPlansWithManager.materialization.id, projectCapabilityView.materialization.id].join(', ')}
          />
          <MetadataLine label='Non-chart consumer' value='useDashboardDataset("projectPlans")' />
          <p className='rounded-2xl border border-border/60 bg-muted/25 px-3 py-3 text-xs leading-5 text-muted-foreground'>
            {validation === 'Validated'
              ? 'Runtime validation passed: dataset keys are unique, manager foreign keys resolve, and every capability edge points at a registered capability. The cards below combine normalized dashboard slices with explicit materialized views instead of hidden joins.'
              : validation}
          </p>
        </div>
      </DashboardCard>

      <DashboardCard
        title='Most Requested Capabilities'
        subtitle='A non-chart consumer can still reuse an explicit materialized project-plan-capability view when that grain is the honest shape.'>
        <div className='space-y-2'>
          {hottestCapabilities.map((capability) => (
            <div
              key={capability.name}
              className='flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2'>
              <div>
                <div className='text-sm font-medium text-foreground'>{capability.name}</div>
                <div className='text-xs text-muted-foreground'>{capability.domain}</div>
              </div>
              <div className='rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground'>
                {integerFormatter.format(capability.count)} plans
              </div>
            </div>
          ))}
          <p className='pt-1 text-xs leading-5 text-muted-foreground'>
            This list reads the shared project-plan slice first, then explicitly materializes `projectCapabilityView` to keep the many-to-many grain visible instead of rebuilding lookup maps by hand.
          </p>
        </div>
      </DashboardCard>
    </div>
  )
}

/** Compose the full dataset/model/dashboard/materialized-view example into one screen. */
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
              <h2 className='text-xl font-semibold text-foreground'>Global project planning dashboard</h2>
              <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                This scenario now uses the full additive stack: reusable dataset-owned columns, an explicit linked model for managers and capabilities, a typed dashboard chart registry,
                shared dashboard filters that coordinate both charts and non-chart consumers, and explicit model-derived views for the cross-dataset grains that genuinely need them.
              </p>
            </div>

            <DashboardSummarySection />
          </div>

          <SharedFiltersPanel />
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <PlanningVolumeCard />
        <BudgetMixCard />
        <TimeToCompleteCard />
        <MaterializedManagerLoadCard />
        <MaterializedCapabilityDemandCard />
      </div>

      <MetadataSection validation={validation} />

      <div className='rounded-3xl border border-border/60 bg-background px-5 py-4 text-xs leading-6 text-muted-foreground shadow-sm'>
        The contract stays strict: dashboard charts still execute against one flat project-plan dataset, while cross-dataset charts come from explicit model-derived views with visible grains like `project-plan` and `project-plan-capability`.
        The joins stay opt-in, the many-to-many expansion stays visible, and `useChart({'{'}data, schema{'}'})` remains the simple path underneath both examples.
      </div>
    </div>
  )
}

/**
 * Playground showcase for Phases 1 through 7:
 * dataset-owned columns, a linked model, typed dashboard composition, explicit
 * shared filters, and model-derived materialized views all layered on top of
 * the existing single-chart runtime.
 */
export function DatasetModelChart() {
  const dashboard = useDashboard({
    definition: deliveryPlanningDashboard,
    data: planningModelData,
  })

  const validation = useMemo(() => {
    try {
      deliveryModel.validateData(planningModelData)

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
