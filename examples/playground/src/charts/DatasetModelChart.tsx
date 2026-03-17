import {useMemo} from 'react'
import {defineDataModel, defineDataset, useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio/ui'

type JobRecord = {
  id: string
  ownerId: string
  team: 'Platform' | 'Enterprise' | 'Product'
  createdAt: string
  salary: number
  isOpen: boolean
}

type OwnerRecord = {
  id: string
  name: string
  region: 'EU' | 'US'
}

type SkillRecord = {
  id: string
  name: string
}

type JobSkillEdge = {
  jobId: string
  skillId: string
}

const jobRows: JobRecord[] = [
  {id: 'job-1', ownerId: 'owner-1', team: 'Platform', createdAt: '2026-01-05', salary: 132000, isOpen: true},
  {id: 'job-2', ownerId: 'owner-2', team: 'Enterprise', createdAt: '2026-01-21', salary: 118000, isOpen: false},
  {id: 'job-3', ownerId: 'owner-1', team: 'Product', createdAt: '2026-02-12', salary: 149000, isOpen: true},
  {id: 'job-4', ownerId: 'owner-3', team: 'Platform', createdAt: '2026-02-28', salary: 124000, isOpen: true},
  {id: 'job-5', ownerId: 'owner-2', team: 'Enterprise', createdAt: '2026-03-09', salary: 141000, isOpen: false},
  {id: 'job-6', ownerId: 'owner-3', team: 'Product', createdAt: '2026-03-24', salary: 156000, isOpen: true},
]

const ownerRows: OwnerRecord[] = [
  {id: 'owner-1', name: 'Avery Stone', region: 'EU'},
  {id: 'owner-2', name: 'Morgan Lee', region: 'US'},
  {id: 'owner-3', name: 'Riley Chen', region: 'EU'},
]

const skillRows: SkillRecord[] = [
  {id: 'skill-1', name: 'TypeScript'},
  {id: 'skill-2', name: 'SQL'},
  {id: 'skill-3', name: 'Kubernetes'},
  {id: 'skill-4', name: 'React'},
]

const jobSkillEdges: JobSkillEdge[] = [
  {jobId: 'job-1', skillId: 'skill-1'},
  {jobId: 'job-1', skillId: 'skill-3'},
  {jobId: 'job-2', skillId: 'skill-2'},
  {jobId: 'job-3', skillId: 'skill-1'},
  {jobId: 'job-3', skillId: 'skill-4'},
  {jobId: 'job-4', skillId: 'skill-3'},
  {jobId: 'job-5', skillId: 'skill-2'},
  {jobId: 'job-6', skillId: 'skill-4'},
]

const jobs = defineDataset<JobRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.category('team'),
    c.date('createdAt', {label: 'Created'}),
    c.number('salary', {format: 'currency'}),
    c.boolean('isOpen', {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'}),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary >= 140000 ? 'Premium' : 'Standard'),
    }),
  ])

const owners = defineDataset<OwnerRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
  ])

const skills = defineDataset<SkillRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Skill'}),
  ])

const jobsByMonth = jobs
  .chart('jobsByMonth')
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .groupBy((g) => g.allowed('team', 'salaryBand').default('team'))
  .metric((m) => m.count().aggregate('salary', 'sum').defaultCount())
  .chartType((t) => t.allowed('bar', 'line').default('bar'))
  .timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))

const jobsByTeam = jobs
  .chart('jobsByTeam')
  .xAxis((x) => x.allowed('team', 'salaryBand').default('team'))
  .groupBy((g) => g.allowed('isOpen').default('isOpen'))
  .metric((m) => m.count().aggregate('salary', 'avg').defaultCount())
  .chartType((t) => t.allowed('grouped-bar', 'bar', 'donut').default('grouped-bar'))

const hiringModel = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillEdges,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
    ] as const,
  })
  .attribute('skill', {
    kind: 'select',
    source: {dataset: 'skills', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', through: 'jobSkills', mode: 'exists'},
    ] as const,
  })
  .build()

const jobsDataset = jobs.build()
const ownersDataset = owners.build()
const skillsDataset = skills.build()

function MetadataCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className='overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm'>
      <div className='border-b border-border/60 px-4 py-3'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='mt-1 text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='space-y-3 px-4 py-4'>{children}</div>
    </section>
  )
}

function StatLine({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-center justify-between gap-4 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground'>{value}</code>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className='overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm'>
      <div className='border-b border-border/60 px-4 py-3'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='mt-1 text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='p-4'>{children}</div>
    </div>
  )
}

/**
 * Showcase for Phase 1 and Phase 2:
 * one reusable dataset feeds multiple charts, while a linked data model
 * validates keys, relationships, associations, and reusable attributes.
 */
export function DatasetModelChart() {
  const jobsTrendChart = useChart({
    data: jobRows,
    schema: jobsByMonth,
    sourceLabel: 'Jobs',
  })

  const teamMixChart = useChart({
    data: jobRows,
    schema: jobsByTeam,
    sourceLabel: 'Jobs',
  })

  const validation = useMemo(() => {
    try {
      hiringModel.validateData({
        jobs: jobRows,
        owners: ownerRows,
        skills: skillRows,
      })

      return {
        status: 'Validated',
        message: 'Declared dataset keys, relationship foreign keys, and association edges all passed runtime validation.',
      }
    } catch (error) {
      return {
        status: 'Validation Failed',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }, [])

  return (
    <div className='space-y-5'>
      <div className='overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-primary/8 via-background to-background shadow-sm'>
        <div className='grid gap-5 px-5 py-5 lg:grid-cols-[1.4fr_0.9fr]'>
          <div className='space-y-3'>
            <div className='inline-flex rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary'>
              Phase 1 + Phase 2
            </div>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>Reusable datasets first, linked models second</h2>
              <p className='mt-2 max-w-2xl text-sm leading-6 text-muted-foreground'>
                The jobs dataset owns the reusable <code className='rounded bg-muted px-1 font-mono text-[11px]'>.columns(...)</code> contract and feeds two
                different charts. The linked model then registers owners and skills, declares explicit relationships, stores reusable attributes, and validates
                the graph at runtime without changing the current single-chart execution model.
              </p>
            </div>
          </div>

          <div className='rounded-2xl border border-border/60 bg-background/90 p-4'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-sm font-semibold text-foreground'>Runtime validation</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  validation.status === 'Validated'
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                }`}>
                {validation.status}
              </span>
            </div>
            <p className='mt-3 text-xs leading-5 text-muted-foreground'>{validation.message}</p>
            <div className='mt-4 space-y-2'>
              <StatLine label='Jobs key' value='jobs.id' />
              <StatLine label='Relationship' value='owners.id -> jobs.ownerId' />
              <StatLine label='Association' value='jobs.id <-> skills.id' />
              <StatLine label='Attribute ids' value='owner, skill' />
            </div>
          </div>
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <ChartCard title='Jobs By Month' subtitle='One reusable dataset, chart-local control restrictions'>
          <Chart chart={jobsTrendChart}>
            <ChartToolbar pinned={['chartType', 'groupBy', 'metric', 'timeBucket']} hidden={['source']} />
            <div className='mt-4'>
              <ChartCanvas height={280} />
            </div>
          </Chart>
        </ChartCard>

        <ChartCard title='Jobs By Team' subtitle='A second chart definition from the same dataset columns'>
          <Chart chart={teamMixChart}>
            <ChartToolbar pinned={['chartType', 'groupBy', 'metric']} hidden={['source', 'timeBucket']} />
            <div className='mt-4'>
              <ChartCanvas height={280} showDataLabels />
            </div>
          </Chart>
        </ChartCard>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <MetadataCard
          title='Datasets'
          subtitle='The dataset layer owns reusable columns and optional keys.'>
          <StatLine label='Jobs columns' value={Object.keys(jobsDataset.columns ?? {}).join(', ')} />
          <StatLine label='Owners key' value={(ownersDataset.key ?? []).join(', ')} />
          <StatLine label='Skills key' value={(skillsDataset.key ?? []).join(', ')} />
          <p className='text-xs leading-5 text-muted-foreground'>
            Charts still read one flat row shape at a time, so owner names and skills remain model-level facts instead of automatically joining into the jobs chart.
          </p>
        </MetadataCard>

        <MetadataCard
          title='Relationships'
          subtitle='One public primitive: declared key to foreign-key column.'>
          {Object.values(hiringModel.relationships).map((relationship) => (
            <div key={relationship.id} className='rounded-xl border border-border/60 bg-muted/20 p-3 text-xs'>
              <div className='font-semibold text-foreground'>{relationship.id}</div>
              <div className='mt-2 text-muted-foreground'>
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {relationship.from.dataset}.{relationship.from.key}
                </code>{' '}
                {'->'}{' '}
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {relationship.to.dataset}.{relationship.to.column}
                </code>
              </div>
              <div className='mt-2 text-muted-foreground'>
                reverse:{' '}
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {relationship.reverse.dataset}.{relationship.reverse.column}
                </code>{' '}
                {'->'}{' '}
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {relationship.reverse.to.dataset}.{relationship.reverse.to.key}
                </code>
              </div>
            </div>
          ))}
        </MetadataCard>

        <MetadataCard
          title='Associations & Attributes'
          subtitle='Many-to-many stays explicit, and shared filter semantics live on the model.'>
          {Object.values(hiringModel.associations).map((association) => (
            <div key={association.id} className='rounded-xl border border-border/60 bg-muted/20 p-3 text-xs'>
              <div className='font-semibold text-foreground'>{association.id}</div>
              <div className='mt-2 text-muted-foreground'>
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {association.from.dataset}.{association.from.key}
                </code>{' '}
                {'<->'}{' '}
                <code className='rounded bg-background px-1 py-0.5 font-mono text-[11px]'>
                  {association.to.dataset}.{association.to.key}
                </code>
              </div>
            </div>
          ))}

          {Object.values(hiringModel.attributes).map((attribute) => (
            <div key={attribute.id} className='rounded-xl border border-border/60 bg-background p-3 text-xs text-muted-foreground'>
              <div className='font-semibold text-foreground'>{attribute.id}</div>
              <div className='mt-2'>
                source:{' '}
                <code className='rounded bg-muted px-1 py-0.5 font-mono text-[11px]'>
                  {attribute.source.dataset}.{attribute.source.label}
                </code>
              </div>
              <div className='mt-2'>
                targets:{' '}
                <code className='rounded bg-muted px-1 py-0.5 font-mono text-[11px]'>
                  {attribute.targets.length}
                </code>
              </div>
            </div>
          ))}
        </MetadataCard>
      </div>
    </div>
  )
}
