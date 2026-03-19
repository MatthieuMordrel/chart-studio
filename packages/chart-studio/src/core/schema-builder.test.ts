import {describe, expect, it} from 'vitest'
import {defineDataset} from './define-dataset.js'
import {inferColumnsFromData} from './infer-columns.js'

type ExampleRow = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

describe('defineDataset chart builder', () => {
  it('builds the existing runtime schema shape from the fluent api', () => {
    const schema = defineDataset<ExampleRow>()
      .columns((c) => [
        c.date('createdAt', {label: 'Created'}),
        c.category('ownerName', {label: 'Owner'}),
        c.boolean('isOpen'),
        c.number('salary', {format: 'currency'}),
        c.exclude('internalId'),
        c.derived.category('salaryBand', {
          label: 'Salary Band',
          accessor: (row) => (row.salary != null && row.salary > 100000 ? 'High' : 'Base'),
        }),
      ])
      .chart()
      .xAxis((x) => x.allowed('createdAt').default('createdAt'))
      .groupBy((g) => g.allowed('ownerName', 'salaryBand'))
      .filters((f) => f.allowed('ownerName', 'salaryBand'))
      .metric((m) =>
        m
          .count()
          .aggregate('salary', 'sum', 'avg')
          .defaultAggregate('salary', 'sum')
      )
      .chartType((t) => t.allowed('bar', 'line').default('line'))
      .timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))
      .connectNulls(false)
      .build()

    expect(schema).toEqual({
      columns: {
        createdAt: {type: 'date', label: 'Created'},
        ownerName: {type: 'category', label: 'Owner'},
        isOpen: {type: 'boolean'},
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
        allowed: ['ownerName', 'salaryBand'],
      },
      filters: {
        allowed: ['ownerName', 'salaryBand'],
      },
      metric: {
        allowed: [
          {kind: 'count'},
          {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
        ],
        default: {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
      },
      chartType: {
        allowed: ['bar', 'line'],
        default: 'line',
      },
      timeBucket: {
        allowed: ['month', 'quarter'],
        default: 'month',
      },
      connectNulls: false,
      __chartSchemaBrand: 'chart-schema-definition',
    })
  })

  it('replaces repeated top-level section calls instead of merging them', () => {
    const schema = defineDataset<ExampleRow>()
      .columns((c) => [
        c.date('createdAt'),
        c.category('ownerName'),
      ])
      .chart()
      .xAxis((x) => x.allowed('createdAt'))
      .xAxis((x) => x.allowed('ownerName').default('ownerName'))
      .chartType((t) => t.allowed('bar'))
      .chartType((t) => t.allowed('line').default('line'))
      .build()

    expect(schema.xAxis).toEqual({
      allowed: ['ownerName'],
      default: 'ownerName',
    })
    expect(schema.chartType).toEqual({
      allowed: ['line'],
      default: 'line',
    })
  })

  it('throws at runtime when duplicate column ids slip through', () => {
    expect(() =>
      defineDataset<ExampleRow>()
        .columns((c) => [
          c.date('createdAt'),
          c.field('createdAt', {label: 'Created Again'}),
        ] as unknown as ReturnType<typeof c.date>[])
    ).toThrow('Duplicate chart schema column id: "createdAt"')
  })

  it('can be passed directly to inference without calling build', () => {
    const data: ExampleRow[] = [
      {
        createdAt: '2026-01-01',
        ownerName: 'Alice',
        isOpen: true,
        salary: 120000,
        internalId: 'job-1',
      },
    ]

    const schema = defineDataset<ExampleRow>()
      .columns((c) => [
        c.date('createdAt', {label: 'Created'}),
        c.category('ownerName', {label: 'Owner'}),
        c.number('salary', {format: 'currency'}),
        c.exclude('internalId'),
      ])
      .chart()

    const columns = inferColumnsFromData(data, schema)

    expect(columns.map((column) => column.id)).toEqual(['createdAt', 'ownerName', 'isOpen', 'salary'])
    expect(columns.find((column) => column.id === 'createdAt')?.label).toBe('Created')
    expect(columns.find((column) => column.id === 'salary')?.format).toBe('currency')
  })

  it('memoizes the built schema object per builder instance', () => {
    const builder = defineDataset<ExampleRow>()
      .columns((c) => [
        c.date('createdAt'),
        c.category('ownerName'),
      ])
      .chart()

    expect(builder.build()).toBe(builder.build())
  })

  it('keeps base builders reusable when branching into chart variants', () => {
    const dataset = defineDataset<ExampleRow>()
      .columns((c) => [
        c.date('createdAt'),
        c.category('ownerName'),
        c.number('salary'),
      ])

    const grouped = dataset
      .chart()
      .groupBy((g) => g.allowed('ownerName'))
      .build()
    const metered = dataset
      .chart()
      .metric((m) => m.aggregate('salary', 'sum'))
      .build()

    expect(dataset.chart().build()).toEqual({
      columns: {
        createdAt: {type: 'date'},
        ownerName: {type: 'category'},
        salary: {type: 'number'},
      },
      __chartSchemaBrand: 'chart-schema-definition',
    })
    expect(grouped.groupBy).toEqual({
      allowed: ['ownerName'],
    })
    expect(metered.metric).toEqual({
      allowed: [
        {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
      ],
    })
  })
})
