import {act, renderHook} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {candidateData, jobData} from '../test/chart-test-fixtures.js'
import {useChart} from './use-chart.js'

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
    expect(result.current.availableChartTypes).toEqual(['bar', 'line', 'area'])
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
    expect(result.current.availableChartTypes).toEqual(['bar', 'pie', 'donut'])
    expect(result.current.chartType).toBe('bar')
  })

  it('removes pie and donut when grouping is enabled on categorical charts', () => {
    const {result} = renderHook(() => useChart({data: jobData}))

    act(() => {
      result.current.setXAxis('ownerName')
      result.current.setGroupBy('isOpen')
    })

    expect(result.current.availableChartTypes).toEqual(['bar'])

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
            columnHints: {
              ownerName: {label: 'Owner'},
              salary: {format: 'currency'},
            } as const,
          },
          {
            id: 'candidates',
            label: 'Candidates',
            data: candidateData,
            columnHints: {
              stage: {label: 'Hiring Stage'},
              city: false,
            } as const,
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
    expect(result.current.availableChartTypes).toEqual(['bar', 'pie', 'donut'])
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

  it('uses typed column hints to exclude fields and override labels', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        columnHints: {
          ownerName: {label: 'Owner'},
          salary: {format: 'currency'},
          isOpen: false,
        } as const,
      }),
    )

    expect(result.current.columns.map((column) => column.id)).toEqual(['dateAdded', 'ownerName', 'salary'])
    expect(result.current.columns.find((column) => column.id === 'ownerName')?.label).toBe('Owner')
  })

  it('supports declarative groupBy and metric tool restrictions', () => {
    const {result} = renderHook(() =>
      useChart({
        data: jobData,
        columnHints: {
          dateAdded: {type: 'date'},
          ownerName: {type: 'category'},
          isOpen: {type: 'boolean'},
          salary: {type: 'number'},
        } as const,
        tools: {
          groupBy: {
            allowed: ['isOpen'],
          },
          metric: {
            allowed: [
              {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
            ],
          },
        },
      }),
    )

    expect(result.current.availableGroupBys).toEqual([{id: 'isOpen', label: 'Is Open'}])
    expect(result.current.availableMetrics).toEqual([{kind: 'aggregate', columnId: 'salary', aggregate: 'sum'}])
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})

    act(() => {
      result.current.setGroupBy('ownerName' as Parameters<typeof result.current.setGroupBy>[0])
      result.current.setMetric({kind: 'count'} as Parameters<typeof result.current.setMetric>[0])
    })

    expect(result.current.groupById).toBeNull()
    expect(result.current.metric).toEqual({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
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
        columnHints: {
          revenue: {label: 'Revenue'},
          internalId: false,
        } as const,
      }),
    )

    expect(result.current.xAxisId).toBe('bookedAt')
    expect(result.current.availableDateColumns).toEqual([{id: 'bookedAt', label: 'Booked At'}])
    expect(result.current.columns.find((column) => column.id === 'bookedAt')?.type).toBe('date')
    expect(result.current.columns.find((column) => column.id === 'revenue')?.format).toBe('currency')
    expect(result.current.columns.find((column) => column.id === 'conversionRate')?.format).toBe('percent')
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

  it('throws when multi-source charts are created without sources', () => {
    expect(() =>
      renderHook(() =>
        useChart({
          sources: [] as unknown as [
            {
              id: string
              label: string
              data: typeof jobData
              columnHints?: never
            },
          ],
        }),
      ),
    ).toThrow('useChart requires at least one source')
  })
})
