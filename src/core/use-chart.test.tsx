import {act, renderHook} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {candidateColumns, candidateData, jobColumns, jobData} from '../test/chart-test-fixtures.js'
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
          {id: 'jobs', label: 'Jobs', data: jobData, columns: jobColumns},
          {
            id: 'candidates',
            label: 'Candidates',
            data: candidateData,
            columns: candidateColumns,
          },
        ],
      }),
    )

    expect(result.current.hasMultipleSources).toBe(true)
    expect(result.current.activeSourceId).toBe('jobs')
    expect(result.current.xAxisId).toBe('dateAdded')

    act(() => {
      result.current.setGroupBy('ownerName')
      result.current.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
      result.current.toggleFilter('ownerName', 'Alice')
      result.current.setActiveSource('candidates')
    })

    expect(result.current.activeSourceId).toBe('candidates')
    expect(result.current.rawData).toEqual(candidateData)
    expect(result.current.xAxisId).toBe('stage')
    expect(result.current.groupById).toBeNull()
    expect(result.current.metric).toEqual({kind: 'count'})
    expect(result.current.filters.size).toBe(0)
    expect(result.current.transformedData).toEqual([
      expect.objectContaining({xKey: 'Screen', value: 1}),
      expect.objectContaining({xKey: 'Interview', value: 1}),
    ])
    expect(result.current.availableChartTypes).toEqual(['bar', 'pie', 'donut'])
    expect(result.current.availableDateColumns).toEqual([])
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

  it('throws when multi-source charts are created without sources', () => {
    expect(() =>
      renderHook(() =>
        useChart({
          sources: [] as unknown as [
            {
              id: string
              label: string
              data: typeof jobData
              columns: typeof jobColumns
            },
          ],
        }),
      ),
    ).toThrow('useChart requires at least one source')
  })
})
