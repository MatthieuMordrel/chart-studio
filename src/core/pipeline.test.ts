import {describe, expect, it} from 'vitest'
import {columns, defineColumns} from './columns.js'
import {runPipeline} from './pipeline.js'
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

    const chartColumns = defineColumns<RevenueRecord>([
      columns.date('dateAdded', {label: 'Date Added'}),
      columns.category('ownerName', {label: 'Owner'}),
      columns.boolean('isOpen', {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'}),
      columns.number('salary', {label: 'Salary'}),
    ])

    const metric: Metric = {columnId: 'salary', aggregate: 'sum', label: 'Sum of Salary'}
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

    const chartColumns = defineColumns<ScoreRecord>([
      columns.category('team', {label: 'Team'}),
      columns.boolean('isOpen', {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'}),
      columns.number('score', {label: 'Score'}),
    ])

    const metric: Metric = {
      columnId: 'score',
      aggregate: 'avg',
      includeZeros: false,
      label: 'Average Score',
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
      expect.objectContaining({dataKey: 'value', label: 'Average Score'}),
    ])
    expect(result.data).toEqual([
      expect.objectContaining({xKey: 'A', value: 10}),
      expect.objectContaining({xKey: 'B', value: 0}),
    ])
  })
})
