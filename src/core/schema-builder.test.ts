import {describe, expect, it} from 'vitest'
import {defineChartSchema} from './define-chart-schema.js'

type ExampleRow = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

describe('defineChartSchema builder', () => {
  it('builds the existing runtime schema shape from the fluent api', () => {
    const schema = defineChartSchema<ExampleRow>()
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
    const schema = defineChartSchema<ExampleRow>()
      .columns((c) => [
        c.date('createdAt'),
        c.category('ownerName'),
      ])
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
      defineChartSchema<ExampleRow>()
        .columns((c) => [
          c.date('createdAt'),
          c.field('createdAt', {label: 'Created Again'}),
        ] as unknown as ReturnType<typeof c.date>[])
        .build()
    ).toThrow('Duplicate chart schema column id: "createdAt"')
  })
})
