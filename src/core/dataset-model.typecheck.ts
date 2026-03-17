import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {useChart} from './use-chart.js'

type JobRecord = {
  id: string
  ownerId: string | null
  createdAt: string
  salary: number
  skillIds?: string[]
  internalId: string
}

type OwnerRecord = {
  id: string
  name: string
  region: string
}

type SkillRecord = {
  id: string
  name: string
}

function expectType<T>(_value: T): void {}

const jobs = defineDataset<JobRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.date('createdAt'),
    c.number('salary'),
    c.exclude('internalId'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary >= 100 ? 'High' : 'Base'),
    }),
  ])

const owners = defineDataset<OwnerRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
    c.category('region'),
  ])

const skills = defineDataset<SkillRecord>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
  ])

function verifyDatasetTyping() {
  const datasetChart = jobs
    .chart('jobsByMonth')
    .xAxis((x) => x.allowed('createdAt', 'salaryBand').default('createdAt'))
    .groupBy((g) => g.allowed('salaryBand').default('salaryBand'))
    .filters((f) => f.allowed('salaryBand'))
    .metric((m) => m.count().aggregate('salary', 'sum'))

  const chart = useChart({
    data: [] as JobRecord[],
    schema: datasetChart,
  })

  chart.setXAxis('createdAt')
  chart.setXAxis('salaryBand')
  chart.setGroupBy('salaryBand')
  chart.setMetric({kind: 'count'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.toggleFilter('salaryBand', 'High')

  expectType<'createdAt' | 'salaryBand' | null>(chart.xAxisId)
  expectType<'salaryBand' | null>(chart.groupById)

  // @ts-expect-error dataset-backed chart builders should not redefine columns
  datasetChart.columns((c) => [c.date('createdAt')])
  // @ts-expect-error excluded raw ids should stay out of the chart API
  chart.setXAxis('internalId')
  // @ts-expect-error numeric columns remain invalid groupBy ids
  chart.setGroupBy('salary')
}

function verifyModelTyping() {
  const model = defineDataModel()
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
      data: [
        {jobId: 'job-1', skillId: 'skill-1'},
      ],
      columns: {
        from: 'jobId',
        to: 'skillId',
      },
    })
    .association('jobSkillsDerived', {
      from: {dataset: 'jobs', key: 'id'},
      to: {dataset: 'skills', key: 'id'},
      deriveFrom: {
        dataset: 'jobs',
        values: (row) => ('skillIds' in row ? row.skillIds ?? [] : []),
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

  model.validateData({
    jobs: [] as JobRecord[],
    owners: [] as OwnerRecord[],
    skills: [] as SkillRecord[],
  })

  // @ts-expect-error duplicate dataset ids should fail at compile time for literal ids
  defineDataModel().dataset('jobs', jobs).dataset('jobs', jobs)

  defineDataModel()
    .dataset('jobs', jobs)
    .dataset('owners', owners)
    .relationship('badOwner', {
      from: {
        dataset: 'owners',
        // @ts-expect-error relationships must point from the declared single key
        key: 'name',
      },
      to: {dataset: 'jobs', column: 'ownerId'},
    })

  defineDataModel()
    .dataset('jobs', jobs)
    .dataset('owners', owners)
    .relationship('missingForeignKey', {
      from: {dataset: 'owners', key: 'id'},
      to: {
        dataset: 'jobs',
        // @ts-expect-error foreign-key columns must exist on the target dataset row
        column: 'missingColumn',
      },
    })

  defineDataModel()
    .dataset('jobs', jobs)
    .dataset('skills', skills)
    // @ts-expect-error derived associations must derive from one of the association endpoints
    .association('badAssociation', {
      from: {dataset: 'jobs', key: 'id'},
      to: {dataset: 'skills', key: 'id'},
      deriveFrom: {
        dataset: 'owners',
        values: () => [],
      },
    })

  defineDataModel()
    .dataset('jobs', jobs)
    .dataset('owners', owners)
    .relationship('jobOwner', {
      from: {dataset: 'owners', key: 'id'},
      to: {dataset: 'jobs', column: 'ownerId'},
    })
    .attribute('missingOwner', {
      kind: 'select',
      source: {dataset: 'owners', key: 'id', label: 'name'},
      targets: [
        {
          dataset: 'jobs',
          column: 'ownerId',
          // @ts-expect-error model attributes must target a declared relationship or association id
          via: 'missingRelationship',
        },
      ] as const,
    })
}

void verifyDatasetTyping
void verifyModelTyping
