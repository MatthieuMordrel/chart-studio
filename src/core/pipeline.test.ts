import {describe, expect, it} from 'vitest'
import {defineChartSchema} from './define-chart-schema.js'
import {inferColumnsFromData} from './infer-columns.js'
import {extractAvailableFilters, runPipeline} from './pipeline.js'
import type {FilterState, Metric} from './types.js'

/**
 * Create filter state from a simple object map.
 */
function createFilters(entries: Record<string, string[]>): FilterState {
  return new Map(Object.entries(entries).map(([columnId, values]) => [columnId, new Set(values)]))
}

describe('runPipeline', () => {
  it('fills missing time buckets and aggregates grouped metric values', () => {
    type RevenueRecord = {
      dateAdded: string
      ownerName: string | null
      salary: number | null
      isOpen: boolean | null
    }

    const data: RevenueRecord[] = [
      {dateAdded: '2025-01-15', ownerName: 'Alice', salary: 100, isOpen: true},
      {dateAdded: '2025-01-20', ownerName: 'Bob', salary: 50, isOpen: false},
      {dateAdded: '2025-03-02', ownerName: 'Alice', salary: 200, isOpen: true},
    ]

    const chartColumns = inferColumnsFromData(data, {
      columns: {
        dateAdded: {type: 'date', label: 'Date Added'},
        ownerName: {label: 'Owner'},
        isOpen: {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'},
        salary: {label: 'Salary'},
      },
    })

    const metric: Metric = {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'}
    const result = runPipeline({
      data,
      columns: chartColumns,
      xAxisId: 'dateAdded',
      groupById: 'ownerName',
      metric,
      timeBucket: 'month',
      filters: new Map(),
      sorting: null,
    })

    expect(result.groups).toEqual(['Alice', 'Bob'])
    expect(result.series.map((series) => series.label)).toEqual(['Alice', 'Bob'])
    expect(result.data).toEqual([
      expect.objectContaining({xKey: '2025-01', Alice: 100, Bob: 50}),
      expect.objectContaining({xKey: '2025-02', Alice: 0, Bob: 0}),
      expect.objectContaining({xKey: '2025-03', Alice: 200, Bob: 0}),
    ])
  })

  it('applies filters, excludes zeros from averages, and keeps the metric label for single-series data', () => {
    type ScoreRecord = {
      team: string | null
      isOpen: boolean | null
      score: number | null
    }

    const data: ScoreRecord[] = [
      {team: 'A', isOpen: true, score: 0},
      {team: 'A', isOpen: true, score: 10},
      {team: 'A', isOpen: false, score: 999},
      {team: 'B', isOpen: true, score: 0},
    ]

    const chartColumns = inferColumnsFromData(data, {
      columns: {
        team: {label: 'Team'},
        isOpen: {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'},
        score: {label: 'Score'},
      },
    })

    const metric: Metric = {
      kind: 'aggregate',
      columnId: 'score',
      aggregate: 'avg',
      includeZeros: false,
    }

    const result = runPipeline({
      data,
      columns: chartColumns,
      xAxisId: 'team',
      groupById: null,
      metric,
      timeBucket: 'month',
      filters: createFilters({isOpen: ['Open']}),
      sorting: null,
    })

    expect(result.series).toEqual([
      expect.objectContaining({dataKey: 'value', label: 'Avg Score'}),
    ])
    expect(result.data).toEqual([
      expect.objectContaining({xKey: 'A', value: 10}),
      expect.objectContaining({xKey: 'B', value: 0}),
    ])
  })

  it('passes the raw item to formatter-backed filter labels when one exists', () => {
    type TeamRecord = {
      team: string | null
      region: string
    }

    const data: TeamRecord[] = [
      {team: 'A', region: 'North'},
      {team: 'B', region: 'South'},
    ]

    const schema = defineChartSchema<TeamRecord>()({
      columns: {
        team: {
          label: 'Team',
          formatter: (value: string | null | undefined, item?: TeamRecord) =>
            `${item?.region ?? 'Unknown'}: ${value ?? 'Unknown'}`,
        },
      },
    })
    const chartColumns = inferColumnsFromData(data, schema)

    const filters = extractAvailableFilters(data, chartColumns)
    const teamFilter = filters.find((filter) => filter.columnId === 'team')

    expect(teamFilter?.options).toEqual([
      expect.objectContaining({value: 'A', label: 'North: A'}),
      expect.objectContaining({value: 'B', label: 'South: B'}),
    ])
  })
})
