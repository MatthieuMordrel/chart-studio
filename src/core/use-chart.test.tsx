import {act, renderHook} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {candidateData, jobData, type JobRecord} from '../test/chart-test-fixtures.js'
import {defineChartSchema} from './define-chart-schema.js'
import {useChart} from './use-chart.js'

const jobSchemaBuilder = defineChartSchema<JobRecord>()
  .columns((c) => [
    c.date('dateAdded'),
    c.category('ownerName'),
    c.boolean('isOpen'),
    c.number('salary'),
  ])

const configuredJobSchema = jobSchemaBuilder.build()

const derivedJobSchema = defineChartSchema<JobRecord>()
  .columns((c) => [
    c.date('dateAdded'),
    c.category('ownerName'),
    c.boolean('isOpen'),
    c.number('salary'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => (row.salary != null && row.salary >= 100 ? 'High' : 'Low'),
    }),
    c.derived.boolean('hasOwner', {
      label: 'Has Owner',
      accessor: (row) => row.ownerName != null,
      trueLabel: 'Assigned',
      falseLabel: 'Unassigned',
    }),
    c.derived.date('salaryDate', {
      label: 'Salary Date',
      accessor: (row) => row.dateAdded,
    }),
    c.derived.number('salaryValue', {
      label: 'Salary Value',
      format: 'currency',
      accessor: (row) => row.salary,
    }),
  ])
  .build()

const jobDisplaySchema = defineChartSchema<JobRecord>()
  .columns((c) => [
    c.field('ownerName', {label: 'Owner'}),
    c.field('salary', {format: 'currency'}),
  ])
  .build()

const candidateDisplaySchema = defineChartSchema<(typeof candidateData)[number]>()
  .columns((c) => [
    c.field('stage', {label: 'Hiring Stage'}),
    c.exclude('city'),
  ])
  .build()

const restrictedJobSchema = jobSchemaBuilder
  .groupBy((g) => g.allowed('isOpen'))
  .metric((m) => m.aggregate('salary', 'avg', 'sum'))
  .build()

describe('useChart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves the default time-series axis and auto-corrects invalid chart types when the axis changes', () => {
    const {result} = renderHook(() => useChart({data: jobData}))

    expect(result.current.xAxisId).toBe('dateAdded')
    expect(result.current.availableChartTypes).toEqual(['bar', 'grouped-bar', 'percent-bar', 'line', 'area', 'percent-area'])
    expect(result.current.chartType).toBe('bar')

    act(() => {
      result.current.setChartType('line')
      result.current.setGroupBy('ownerName')
    })

    expect(result.current.groupById).toBe('ownerName')

    act(() => {
      result.current.setXAxis('ownerName')
    })

    expect(result.current.xAxisId).toBe('ownerName')
    expect(result.current.groupById).toBeNull()
    expect(result.current.availableChartTypes).toEqual(['bar', 'grouped-bar', 'percent-bar', 'pie', 'donut'])
    expect(result.current.chartType).toBe('bar')
  })

  it('removes pie and donut when grouping is enabled on categorical charts', () => {
    const {result} = renderHook(() => useChart({data: jobData}))

    act(() => {
      result.current.setXAxis('ownerName')
      result.current.setGroupBy('isOpen')
    })

    expect(result.current.availableChartTypes).toEqual(['bar', 'grouped-bar', 'percent-bar'])

    act(() => {
      result.current.setChartType('pie')
    })

    expect(result.current.chartType).toBe('bar')
  })

  it('switches multi-source charts to the new source data and resolves stale state', () => {
    const {result} = renderHook(() =>
      useChart({
        sources: [
          {
            id: 'jobs',
            label: 'Jobs',
            data: jobData,
            schema: jobDisplaySchema,
          },
          {
            id: 'candidates',
            label: 'Candidates',
            data: candidateData,
            schema: candidateDisplaySchema,
          },
        ],
      }),
    )

    expect(result.current.hasMultipleSources).toBe(true)
    expect(result.current.activeSourceId).toBe('jobs')
    expect(result.current.xAxisId).toBe('dateAdded')
    expect(result.current.columns.find((column) => column.id === 'ownerName')?.label).toBe('Owner')

    act(() => {
      result.current.setGroupBy('ownerName')
      result.current.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
      result.current.toggleFilter('ownerName', 'Alice')
      result.current.setReferenceDateId('dateAdded')
      result.current.setDateRangeFilter({from: new Date('2026-01-01T00:00:00Z'), to: null})
      result.current.setActiveSource('candidates')
    })

    expect(result.current.activeSourceId).toBe('candidates')
    expect(result.current.rawData).toEqual(candidateData)
    expect(result.current.xAxisId).toBe('stage')
    expect(result.current.groupById).toBeNull()
    expect(result.current.metric).toEqual({kind: 'count'})
    expect(result.current.filters.size).toBe(0)
    expect(result.current.referenceDateId).toBeNull()
    expect(result.current.columns.find((column) => column.id === 'stage')?.label).toBe('Hiring Stage')
    expect(result.current.transformedData).toEqual([
      expect.objectContaining({xKey: 'Screen', value: 1}),
      expect.objectContaining({xKey: 'Interview', value: 1}),
    ])
    expect(result.current.availableChartTypes).toEqual(['bar', 'grouped-bar', 'percent-bar', 'pie', 'donut'])
    expect(result.current.availableDateColumns).toEqual([])
  })

  it('throws when switching to an unknown source id', () => {
    const {result} = renderHook(() =>
      useChart({
        sources: [
          {id: 'jobs', label: 'Jobs', data: jobData},
          {id: 'candidates', label: 'Candidates', data: candidateData},
        ],
      }),
    )
    const setActiveSource = result.current.setActiveSource as (sourceId: string) => void

    expect(() => {
      act(() => {
        setActiveSource('missing')
      })
    }).toThrow('Unknown chart source ID: "missing"')

    expect(result.current.activeSourceId).toBe('jobs')
    expect(result.current.rawData).toEqual(jobData)
  })

  it('treats a null date range filter as all time', () => {
    const datedData = [
      {dateAdded: '2024-01-10', ownerName: 'Alice', isOpen: true, salary: 100},
      ...jobData,
    ]
    const {result} = renderHook(() => useChart({data: datedData}))

    expect(result.current.transformedData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({xKey: '2024-01', value: 1}),
        expect.objectContaining({xKey: '2026-01', value: 2}),
        expect.objectContaining({xKey: '2026-03', value: 1}),
      ]),
    )

    act(() => {
      result.current.setDateRangeFilter({from: new Date('2026-01-01T00:00:00Z'), to: null})
    })

    expect(result.current.transformedData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({xKey: '2026-01', value: 2}),
        expect.objectContaining({xKey: '2026-03', value: 1}),
      ]),
    )
    expect(result.current.transformedData).not.toEqual(
      expect.arrayContaining([expect.objectContaining({xKey: '2024-01'})]),
    )

    act(() => {
      result.current.setDateRangeFilter(null)
    })

    expect(result.current.transformedData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({xKey: '2024-01', value: 1}),
        expect.objectContaining({xKey: '2026-01', value: 2}),
        expect.objectContaining({xKey: '2026-03', value: 1}),
      ]),
    )
  })

  it('uses schema columns to exclude fields and override labels', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: defineChartSchema<(typeof jobData)[number]>()
          .columns((c) => [
            c.field('ownerName', {label: 'Owner'}),
            c.field('salary', {format: 'currency'}),
            c.exclude('isOpen'),
          ])
          .build(),
      }),
    )

    expect(result.current.columns.map((column) => column.id)).toEqual(['dateAdded', 'ownerName', 'salary'])
    expect(result.current.columns.find((column) => column.id === 'ownerName')?.label).toBe('Owner')
  })

  it('supports declarative groupBy and metric schema restrictions', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: restrictedJobSchema,
      }),
    )

    expect(result.current.availableGroupBys).toEqual([{id: 'isOpen', label: 'Is Open'}])
    expect(result.current.availableMetrics).toEqual([
      {kind: 'aggregate', columnId: 'salary', aggregate: 'avg'},
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ])
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})

    act(() => {
      const unsafeSetMetric = result.current.setMetric as (
        metric:
          | {kind: 'count'}
          | {kind: 'aggregate'; columnId: string; aggregate: 'sum' | 'avg' | 'min' | 'max'}
      ) => void
      result.current.setGroupBy('ownerName' as Parameters<typeof result.current.setGroupBy>[0])
      unsafeSetMetric({kind: 'count'})
    })

    expect(result.current.groupById).toBeNull()
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})
  })

  it('lets derived columns participate in every compatible chart control', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: derivedJobSchema,
      }),
    )

    expect(result.current.availableXAxes).toEqual(
      expect.arrayContaining([
        {id: 'salaryBand', label: 'Salary Band', type: 'category'},
        {id: 'hasOwner', label: 'Has Owner', type: 'boolean'},
        {id: 'salaryDate', label: 'Salary Date', type: 'date'},
      ]),
    )
    expect(result.current.availableGroupBys).toEqual(
      expect.arrayContaining([
        {id: 'salaryBand', label: 'Salary Band'},
        {id: 'hasOwner', label: 'Has Owner'},
      ]),
    )
    expect(result.current.availableFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({columnId: 'salaryBand', label: 'Salary Band'}),
        expect.objectContaining({columnId: 'hasOwner', label: 'Has Owner'}),
      ]),
    )
    expect(result.current.availableDateColumns).toEqual(
      expect.arrayContaining([
        {id: 'dateAdded', label: 'Date Added'},
        {id: 'salaryDate', label: 'Salary Date'},
      ]),
    )
    expect(result.current.availableMetrics).toEqual(
      expect.arrayContaining([
        {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
        {kind: 'aggregate', columnId: 'salaryValue', aggregate: 'sum'},
      ]),
    )

    act(() => {
      result.current.setXAxis('salaryBand')
      result.current.setGroupBy('hasOwner')
      result.current.toggleFilter('salaryBand', 'High')
      result.current.setReferenceDateId('salaryDate')
      result.current.setMetric({kind: 'aggregate', columnId: 'salaryValue', aggregate: 'sum'})
    })

    expect(result.current.xAxisId).toBe('salaryBand')
    expect(result.current.groupById).toBe('hasOwner')
    expect(result.current.referenceDateId).toBe('salaryDate')
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salaryValue', aggregate: 'sum'})
    expect(result.current.filters.get('salaryBand')).toEqual(new Set(['High']))
    expect(result.current.transformedData).toEqual([
      expect.objectContaining({xKey: 'High', Assigned: 300}),
    ])
  })

  it('keeps runtime setters aligned with the resolved option lists', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: restrictedJobSchema,
      }),
    )

    expect(result.current.availableGroupBys).toEqual([{id: 'isOpen', label: 'Is Open'}])
    expect(result.current.availableMetrics).toEqual([
      {kind: 'aggregate', columnId: 'salary', aggregate: 'avg'},
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ])

    act(() => {
      const unsafeSetXAxis = result.current.setXAxis as (columnId: string) => void
      const unsafeSetGroupBy = result.current.setGroupBy as (columnId: string | null) => void
      const unsafeSetMetric = result.current.setMetric as (
        metric:
          | {kind: 'count'}
          | {kind: 'aggregate'; columnId: string; aggregate: 'sum' | 'avg' | 'min' | 'max'}
      ) => void
      const unsafeSetReferenceDateId = result.current.setReferenceDateId as (columnId: string) => void
      const unsafeToggleFilter = result.current.toggleFilter as (columnId: string, value: string) => void

      unsafeSetXAxis('salary')
      unsafeSetGroupBy('ownerName')
      unsafeSetMetric({kind: 'count'})
      unsafeSetReferenceDateId('ownerName')
      unsafeToggleFilter('dateAdded', '2026-01-15')
      unsafeToggleFilter('ownerName', 'Missing Owner')
    })

    expect(result.current.xAxisId).toBe('dateAdded')
    expect(result.current.groupById).toBeNull()
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})
    expect(result.current.referenceDateId).toBe('dateAdded')
    expect(result.current.filters.size).toBe(0)
  })

  it('supports generalized schema defaults and restrictions across tools', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .xAxis((x) => x.allowed('dateAdded').default('dateAdded'))
          .groupBy((g) => g.allowed('ownerName', 'isOpen').hidden('ownerName').default('isOpen'))
          .filters((f) => f.allowed('ownerName', 'isOpen').hidden('isOpen'))
          .metric((m) =>
            m
              .aggregate('salary', 'sum', 'avg')
              .hideAggregate('salary', 'avg')
              .defaultAggregate('salary', 'sum')
          )
          .chartType((t) => t.allowed('line', 'area').default('area'))
          .timeBucket((tb) => tb.allowed('quarter', 'year').hidden('year').default('quarter'))
          .build(),
      }),
    )

    expect(result.current.availableXAxes).toEqual([{id: 'dateAdded', label: 'Date Added', type: 'date'}])
    expect(result.current.xAxisId).toBe('dateAdded')
    expect(result.current.availableGroupBys).toEqual([{id: 'isOpen', label: 'Is Open'}])
    expect(result.current.groupById).toBe('isOpen')
    expect(result.current.availableFilters.map(filter => filter.columnId)).toEqual(['ownerName'])
    expect(result.current.availableMetrics).toEqual([
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ])
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
    expect(result.current.availableChartTypes).toEqual(['line', 'area'])
    expect(result.current.chartType).toBe('area')
    expect(result.current.availableTimeBuckets).toEqual(['quarter'])
    expect(result.current.timeBucket).toBe('quarter')
  })

  it('uses allowed order as the fallback default when explicit defaults are absent', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .xAxis((x) => x.allowed('ownerName', 'dateAdded'))
          .groupBy((g) => g.allowed('isOpen', 'ownerName'))
          .filters((f) => f.allowed('isOpen', 'ownerName'))
          .metric((m) => m.aggregate('salary', 'max', 'sum'))
          .chartType((t) => t.allowed('area', 'line'))
          .timeBucket((tb) => tb.allowed('year', 'quarter'))
          .build(),
      }),
    )

    expect(result.current.xAxisId).toBe('ownerName')
    expect(result.current.groupById).toBeNull()
    expect(result.current.availableGroupBys).toEqual([{id: 'isOpen', label: 'Is Open'}])
    expect(result.current.availableFilters.map(filter => filter.columnId)).toEqual(['isOpen', 'ownerName'])
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'max'})
    expect(result.current.availableMetrics).toEqual([
      {kind: 'aggregate', columnId: 'salary', aggregate: 'max'},
      {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    ])

    act(() => {
      result.current.setXAxis('dateAdded')
    })

    expect(result.current.availableChartTypes).toEqual(['area', 'line'])
    expect(result.current.chartType).toBe('area')
    expect(result.current.availableTimeBuckets).toEqual(['year', 'quarter'])
    expect(result.current.timeBucket).toBe('year')
  })

  it('keeps time buckets unavailable when the active runtime state cannot support them', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .xAxis((x) => x.allowed('dateAdded', 'ownerName').default('dateAdded'))
          .chartType((t) => t.allowed('bar', 'pie'))
          .timeBucket((tb) => tb.allowed('year'))
          .build(),
      }),
    )

    expect(result.current.availableTimeBuckets).toEqual(['year'])
    expect(result.current.timeBucket).toBe('year')

    act(() => {
      result.current.setXAxis('ownerName')
      result.current.setChartType('pie')
    })

    expect(result.current.isTimeSeries).toBe(false)
    expect(result.current.availableTimeBuckets).toEqual([])
  })

  it('handles complex single-source inference with timestamps, hints, and unsupported fields', () => {
    const data = [
      {
        bookedAt: 1767225600,
        region: 'EMEA',
        isActive: true,
        revenue: 1200,
        conversionRate: 0.12,
        internalId: 'acct-1',
        metadata: {owner: 'Alice'},
      },
      {
        bookedAt: 1769904000,
        region: 'NA',
        isActive: false,
        revenue: 900,
        conversionRate: 0.18,
        internalId: 'acct-2',
        metadata: {owner: 'Bob'},
      },
    ] as const

    const {result} = renderHook(() =>
      useChart({
        data,
        schema: defineChartSchema<(typeof data)[number]>()
          .columns((c) => [
            c.field('revenue', {label: 'Revenue'}),
            c.exclude('internalId'),
          ])
          .build(),
      }),
    )

    expect(result.current.xAxisId).toBe('bookedAt')
    expect(result.current.availableDateColumns).toEqual([{id: 'bookedAt', label: 'Booked At'}])
    expect(result.current.columns.find((column) => column.id === 'bookedAt')?.type).toBe('date')
    expect(result.current.columns.find((column) => column.id === 'revenue')?.format).toBeUndefined()
    expect(result.current.columns.find((column) => column.id === 'conversionRate')?.format).toBeUndefined()
    const columnIds = result.current.columns.map((column) => column.id)
    expect(columnIds).not.toContain('internalId')
    expect(columnIds).not.toContain('metadata')
    expect(result.current.transformedData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({xKey: '2026-01', value: 1}),
        expect.objectContaining({xKey: '2026-02', value: 1}),
      ]),
    )
  })

  it('respects schema default for timeBucket even when the global default is in the allowed list', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .timeBucket((tb) => tb.allowed('month', 'quarter', 'year').default('quarter'))
          .build(),
      }),
    )

    expect(result.current.availableTimeBuckets).toEqual(['month', 'quarter', 'year'])
    expect(result.current.timeBucket).toBe('quarter')
  })

  it('respects schema default for chartType even when the global default is in the allowed list', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .chartType((t) => t.allowed('bar', 'line', 'area').default('line'))
          .build(),
      }),
    )

    expect(result.current.availableChartTypes).toEqual(['bar', 'line', 'area'])
    expect(result.current.chartType).toBe('line')
  })

  it('respects schema default for metric even when count is available', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .metric((m) => m.count().aggregate('salary', 'sum', 'avg').defaultAggregate('salary', 'sum'))
          .build(),
      }),
    )

    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  })

  it('preserves explicit user selection over schema defaults', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: jobSchemaBuilder
          .chartType((t) => t.allowed('bar', 'line', 'area').default('line'))
          .timeBucket((tb) => tb.allowed('month', 'quarter', 'year').default('quarter'))
          .metric((m) => m.count().aggregate('salary', 'sum', 'avg').defaultAggregate('salary', 'sum'))
          .build(),
      }),
    )

    expect(result.current.chartType).toBe('line')
    expect(result.current.timeBucket).toBe('quarter')
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})

    act(() => {
      result.current.setChartType('bar')
      result.current.setTimeBucket('month')
      result.current.setMetric({kind: 'count'})
    })

    expect(result.current.chartType).toBe('bar')
    expect(result.current.timeBucket).toBe('month')
    expect(result.current.metric).toEqual({kind: 'count'})
  })

  it('resets to schema default when switching sources', () => {
    const {result} = renderHook(() =>
      useChart({
        sources: [
          {
            id: 'jobs',
            label: 'Jobs',
            data: jobData,
            schema: jobSchemaBuilder
              .chartType((t) => t.allowed('bar', 'line').default('line'))
              .timeBucket((tb) => tb.allowed('month', 'quarter').default('quarter'))
              .metric((m) => m.aggregate('salary', 'sum', 'avg').defaultAggregate('salary', 'avg'))
              .build(),
          },
          {
            id: 'candidates',
            label: 'Candidates',
            data: candidateData,
            schema: candidateDisplaySchema,
          },
        ],
      }),
    )

    expect(result.current.chartType).toBe('line')
    expect(result.current.timeBucket).toBe('quarter')
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})

    act(() => {
      result.current.setChartType('bar')
      result.current.setTimeBucket('month')
      result.current.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
    })

    expect(result.current.chartType).toBe('bar')
    expect(result.current.timeBucket).toBe('month')

    act(() => {
      result.current.setActiveSource('candidates')
    })

    // Candidates source has no schema defaults for chartType/timeBucket,
    // so the global defaults should apply.
    expect(result.current.metric).toEqual({kind: 'count'})

    act(() => {
      result.current.setActiveSource('jobs')
    })

    // Switching back: the user's previous explicit selections ('bar', 'month')
    // are still in state and valid, so they should be preserved.
    expect(result.current.chartType).toBe('bar')
    expect(result.current.timeBucket).toBe('month')
  })

  it('falls back to global default when no schema default is configured', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        schema: configuredJobSchema,
      }),
    )

    expect(result.current.chartType).toBe('bar')
    expect(result.current.timeBucket).toBe('month')
    expect(result.current.metric).toEqual({kind: 'count'})
  })

  it('throws when multi-source charts are created without sources', () => {
    expect(() =>
      renderHook(() =>
        useChart({
          sources: [] as unknown as [
            {
              id: string
              label: string
              data: typeof jobData
              schema?: never
            },
          ],
        }),
      ),
    ).toThrow('useChart requires at least one source')
  })
})
