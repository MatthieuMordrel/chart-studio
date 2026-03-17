import {renderHook} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {defineDataModel} from './define-data-model.js'
import {defineDataset} from './define-dataset.js'
import {useChart} from './use-chart.js'

type JobRow = {
  id: string
  ownerId: string | null
  createdAt: string
  salary: number
  skillIds?: string[]
  internalId: string
}

type OwnerRow = {
  id: string
  name: string
  region: string
}

type SkillRow = {
  id: string
  name: string
}

type JobSkillRow = {
  jobId: string
  skillId: string
}

const jobs = defineDataset<JobRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.date('createdAt', {label: 'Created'}),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary >= 120 ? 'High' : 'Base'),
    }),
  ])

const owners = defineDataset<OwnerRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
    c.derived.category('displayName', {
      label: 'Owner Snapshot',
      accessor: (row) => `${row.name} (${row.region})`,
    }),
  ])

const skills = defineDataset<SkillRow>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Skill'}),
  ])

const validJobs: JobRow[] = [
  {
    id: 'job-1',
    ownerId: 'owner-1',
    createdAt: '2026-01-01',
    salary: 100,
    skillIds: ['skill-1'],
    internalId: 'internal-1',
  },
  {
    id: 'job-2',
    ownerId: 'owner-2',
    createdAt: '2026-02-01',
    salary: 140,
    skillIds: ['skill-1', 'skill-2'],
    internalId: 'internal-2',
  },
]

const validOwners: OwnerRow[] = [
  {id: 'owner-1', name: 'Alice', region: 'EU'},
  {id: 'owner-2', name: 'Bob', region: 'US'},
]

const validSkills: SkillRow[] = [
  {id: 'skill-1', name: 'SQL'},
  {id: 'skill-2', name: 'TypeScript'},
]

const validJobSkills: JobSkillRow[] = [
  {jobId: 'job-1', skillId: 'skill-1'},
  {jobId: 'job-2', skillId: 'skill-1'},
  {jobId: 'job-2', skillId: 'skill-2'},
]

describe('dataset builder', () => {
  it('builds a reusable dataset definition and derives chart schemas from its columns', () => {
    const dataset = jobs.build()
    const chart = jobs
      .chart('jobsByMonth')
      .xAxis((x) => x.allowed('createdAt').default('createdAt'))
      .groupBy((g) => g.allowed('salaryBand').default('salaryBand'))
      .metric((m) => m.aggregate('salary', 'sum'))
      .build()

    expect(dataset.key).toEqual(['id'])
    expect(dataset.columns).toMatchObject({
      createdAt: {type: 'date', label: 'Created'},
      salary: {type: 'number', format: 'currency'},
      salaryBand: {
        kind: 'derived',
        type: 'category',
        label: 'Salary Band',
      },
      internalId: false,
    })
    expect(chart).toEqual({
      columns: {
        id: {},
        ownerId: {},
        createdAt: {type: 'date', label: 'Created'},
        salary: {type: 'number', format: 'currency'},
        internalId: false,
        salaryBand: {
          kind: 'derived',
          type: 'category',
          label: 'Salary Band',
          accessor: expect.any(Function),
        },
      },
      xAxis: {
        allowed: ['createdAt'],
        default: 'createdAt',
      },
      groupBy: {
        allowed: ['salaryBand'],
        default: 'salaryBand',
      },
      metric: {
        allowed: [
          {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
        ],
      },
      __chartSchemaBrand: 'chart-schema-definition',
    })
  })

  it('keeps dataset-backed charts compatible with useChart({data, schema})', () => {
    const schema = jobs
      .chart('jobsByMonth')
      .xAxis((x) => x.allowed('createdAt').default('createdAt'))
      .groupBy((g) => g.allowed('salaryBand').default('salaryBand'))

    const {result} = renderHook(() =>
      useChart({
        data: validJobs,
        schema,
      }),
    )

    expect(result.current.columns.map((column) => column.id)).toEqual([
      'id',
      'ownerId',
      'createdAt',
      'salary',
      'salaryBand',
    ])
    expect(result.current.xAxisId).toBe('createdAt')
    expect(result.current.groupById).toBe('salaryBand')
  })

  it('hard-fails runtime key validation for duplicate dataset keys', () => {
    expect(() =>
      jobs.validateData([
        validJobs[0]!,
        {
          ...validJobs[0]!,
          salary: 999,
        },
      ]),
    ).toThrow('Dataset "dataset" key "id" must be unique. Duplicate value: job-1.')
  })

  it('hard-fails runtime key validation for missing composite key parts', () => {
    const jobSkills = defineDataset<JobSkillRow & {batchId: string | null}>()
      .key(['jobId', 'batchId'])

    expect(() =>
      jobSkills.validateData([
        {jobId: 'job-1', skillId: 'skill-1', batchId: null},
      ]),
    ).toThrow('Dataset "dataset" key "jobId, batchId" is missing a value')
  })
})

describe('data model builder', () => {
  it('derives reverse traversal metadata from the same relationship and keeps model attributes explicit', () => {
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
        data: validJobSkills,
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
        ],
      })
      .build()

    expect(model.relationships.jobOwner).toEqual({
      kind: 'relationship',
      id: 'jobOwner',
      from: {dataset: 'owners', key: 'id'},
      to: {dataset: 'jobs', column: 'ownerId'},
      reverse: {
        dataset: 'jobs',
        column: 'ownerId',
        to: {dataset: 'owners', key: 'id'},
      },
    })
    expect(model.associations.jobSkills.reverse).toEqual({
      dataset: 'skills',
      key: 'id',
      to: {dataset: 'jobs', key: 'id'},
    })
    expect(model.attributes.owner).toEqual({
      id: 'owner',
      kind: 'select',
      source: {dataset: 'owners', key: 'id', label: 'name'},
      targets: [
        {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
      ],
    })
  })

  it('validates dataset keys, relationships, and explicit association edge data together', () => {
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
        data: validJobSkills,
        columns: {
          from: 'jobId',
          to: 'skillId',
        },
      })

    expect(() =>
      model.validateData({
        jobs: validJobs,
        owners: validOwners,
        skills: validSkills,
      }),
    ).not.toThrow()
  })

  it('throws when a relationship foreign key points at no declared key value', () => {
    const model = defineDataModel()
      .dataset('jobs', jobs)
      .dataset('owners', owners)
      .relationship('jobOwner', {
        from: {dataset: 'owners', key: 'id'},
        to: {dataset: 'jobs', column: 'ownerId'},
      })

    expect(() =>
      model.validateData({
        jobs: [
          {
            ...validJobs[0]!,
            ownerId: 'owner-missing',
          },
        ],
        owners: validOwners,
      }),
    ).toThrow('Relationship "jobOwner" has an orphan foreign key "owner-missing"')
  })

  it('throws when a derived association points at a missing key on the far side', () => {
    const model = defineDataModel()
      .dataset('jobs', jobs)
      .dataset('skills', skills)
      .association('jobSkills', {
        from: {dataset: 'jobs', key: 'id'},
        to: {dataset: 'skills', key: 'id'},
        deriveFrom: {
          dataset: 'jobs',
          values: (row) => ('skillIds' in row ? row.skillIds ?? [] : []),
        },
      })

    expect(() =>
      model.validateData({
        jobs: [
          {
            ...validJobs[0]!,
            skillIds: ['skill-missing'],
          },
        ],
        skills: validSkills,
      }),
    ).toThrow('Association "jobSkills" has an orphan derived key "skill-missing"')
  })

  it('materializes lookup views explicitly and reuses declared related-table columns', () => {
    const model = defineDataModel()
      .dataset('jobs', jobs)
      .dataset('owners', owners)
      .relationship('jobOwner', {
        from: {dataset: 'owners', key: 'id'},
        to: {dataset: 'jobs', column: 'ownerId'},
      })

    const jobsWithOwner = model.materialize('jobsWithOwner', (m) =>
      m
        .from('jobs')
        .join('owner', {relationship: 'jobOwner'})
        .grain('job'),
    )

    const materializedRows = jobsWithOwner.materialize({
      jobs: validJobs,
      owners: validOwners,
    })
    const repeatedRows = jobsWithOwner.materialize({
      jobs: validJobs,
      owners: validOwners,
    })

    expect(materializedRows).toEqual([
      expect.objectContaining({
        id: 'job-1',
        ownerName: 'Alice',
        ownerRegion: 'EU',
        ownerDisplayName: 'Alice (EU)',
      }),
      expect.objectContaining({
        id: 'job-2',
        ownerName: 'Bob',
        ownerRegion: 'US',
        ownerDisplayName: 'Bob (US)',
      }),
    ])
    expect(repeatedRows).not.toBe(materializedRows)

    const builtView = jobsWithOwner.build()
    expect(builtView.key).toEqual(['id'])
    expect(builtView.materialization).toEqual({
      id: 'jobsWithOwner',
      baseDataset: 'jobs',
      grain: 'job',
      steps: [
        {
          kind: 'join',
          alias: 'owner',
          relationship: 'jobOwner',
          targetDataset: 'owners',
          projectedColumns: ['name', 'region', 'displayName'],
        },
      ],
    })
    expect(builtView.columns).toMatchObject({
      ownerName: {label: 'Owner', type: 'category'},
      ownerRegion: {label: 'Owner Region', type: 'category'},
      ownerDisplayName: {label: 'Owner Snapshot', type: 'category'},
    })

    const schema = jobsWithOwner
      .chart('jobsByOwner')
      .xAxis((x) => x.allowed('ownerName').default('ownerName'))
      .groupBy((g) => g.allowed('salaryBand').default('salaryBand'))
      .metric((m) => m.aggregate('salary', 'sum'))

    const {result} = renderHook(() =>
      useChart({
        data: materializedRows,
        schema,
      }),
    )

    expect(result.current.columns.map((column) => column.id)).toEqual([
      'id',
      'ownerId',
      'createdAt',
      'salary',
      'ownerName',
      'ownerRegion',
      'ownerDisplayName',
      'salaryBand',
    ])
    expect(result.current.xAxisId).toBe('ownerName')
  })

  it('materializes filtered lookup slices without validating unrelated associations', () => {
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
        data: validJobSkills,
        columns: {
          from: 'jobId',
          to: 'skillId',
        },
      })

    const jobsWithOwner = model.materialize('jobsWithOwner', (m) =>
      m
        .from('jobs')
        .join('owner', {relationship: 'jobOwner'})
        .grain('job'),
    )

    expect(() =>
      jobsWithOwner.materialize({
        jobs: [validJobs[0]!],
        owners: validOwners,
        skills: validSkills,
      }),
    ).not.toThrow()
  })

  it('materializes association views explicitly for many-to-many chart grains', () => {
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
        data: validJobSkills,
        columns: {
          from: 'jobId',
          to: 'skillId',
        },
      })

    const jobsWithSkills = model.materialize('jobsWithSkills', (m) =>
      m
        .from('jobs')
        .join('owner', {relationship: 'jobOwner'})
        .throughAssociation('skill', {association: 'jobSkills'})
        .grain('job-skill'),
    )

    const materializedInput = {
      jobs: validJobs,
      owners: validOwners,
      skills: validSkills,
    } as const
    const materializedRows = jobsWithSkills.materialize(materializedInput)
    const cachedRows = jobsWithSkills.materialize(materializedInput)

    expect(materializedRows).toEqual([
      expect.objectContaining({
        id: 'job-1',
        ownerName: 'Alice',
        skillId: 'skill-1',
        skillName: 'SQL',
      }),
      expect.objectContaining({
        id: 'job-2',
        ownerName: 'Bob',
        skillId: 'skill-1',
        skillName: 'SQL',
      }),
      expect.objectContaining({
        id: 'job-2',
        ownerName: 'Bob',
        skillId: 'skill-2',
        skillName: 'TypeScript',
      }),
    ])
    expect(cachedRows).toBe(materializedRows)

    const builtView = jobsWithSkills.build()
    expect(builtView.key).toEqual(['id', 'skillId'])
    expect(builtView.materialization).toEqual({
      id: 'jobsWithSkills',
      baseDataset: 'jobs',
      grain: 'job-skill',
      steps: [
        {
          kind: 'join',
          alias: 'owner',
          relationship: 'jobOwner',
          targetDataset: 'owners',
          projectedColumns: ['name', 'region', 'displayName'],
        },
        {
          kind: 'through-association',
          alias: 'skill',
          association: 'jobSkills',
          targetDataset: 'skills',
          projectedColumns: ['id', 'name'],
        },
      ],
    })

    expect(() =>
      model.materialize('jobsWithCollidingOwnerId', (m) =>
        m
          .from('jobs')
          .join('owner', {
            relationship: 'jobOwner',
            columns: ['id', 'name'],
          })
          .grain('job'),
      ),
    ).toThrow('ownerId')
  })

  it('materializes association views from a filtered base slice without treating hidden edges as orphans', () => {
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
        data: validJobSkills,
        columns: {
          from: 'jobId',
          to: 'skillId',
        },
      })

    const jobsWithSkills = model.materialize('jobsWithSkills', (m) =>
      m
        .from('jobs')
        .join('owner', {relationship: 'jobOwner'})
        .throughAssociation('skill', {association: 'jobSkills'})
        .grain('job-skill'),
    )

    const rows = jobsWithSkills.materialize({
      jobs: [validJobs[0]!],
      owners: validOwners,
      skills: validSkills,
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'job-1',
        ownerName: 'Alice',
        skillId: 'skill-1',
        skillName: 'SQL',
      }),
    ])
  })
})
