import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {useChart} from '../core/use-chart.js'
import {jobData} from '../test/chart-test-fixtures.js'
import {Chart, useChartContext} from './chart-context.js'
import {ChartFilters} from './chart-filters.js'

/**
 * Small probe component that exposes the active filter count to the test.
 */
function ActiveFilterCount() {
  const {filters} = useChartContext()
  const count = [...filters.values()].reduce((sum, values) => sum + values.size, 0)

  return <span data-testid="active-filter-count">{count}</span>
}

/**
 * End-to-end harness for the chart filters UI.
 */
function ChartFiltersHarness() {
  const chart = useChart({data: jobData})

  return (
    <Chart chart={chart}>
      <ChartFilters />
      <ActiveFilterCount />
    </Chart>
  )
}

describe('ChartFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the filter panel and toggles filter state through the UI', () => {
    render(<ChartFiltersHarness />)

    fireEvent.click(screen.getByRole('button', {name: /filters/i}))
    fireEvent.click(screen.getByRole('button', {name: /alice/i}))

    expect(screen.getByText(/1 filter active/i).textContent).toContain('1 filter active')
    expect(screen.getByRole('button', {name: /clear all filters/i})).toBeTruthy()
    expect(screen.getByTestId('active-filter-count').textContent).toBe('1')

    fireEvent.click(screen.getByRole('button', {name: /clear all filters/i}))

    expect(screen.queryByText(/1 filter active/i)).toBeNull()
    expect(screen.getByTestId('active-filter-count').textContent).toBe('0')
  })
})
