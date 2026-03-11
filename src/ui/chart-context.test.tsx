import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'
import {useChart} from '../core/use-chart.js'
import {candidateData, jobData, type JobRecord} from '../test/chart-test-fixtures.js'
import {Chart, useTypedChartContext} from './chart-context.js'

/**
 * Probe component that reads the typed single-source chart context.
 */
function TypedSingleSourceProbe() {
  const chart = useTypedChartContext<JobRecord>()

  return (
    <div>
      <span data-testid="record-count">{chart.recordCount}</span>
      <span data-testid="x-axis">{chart.xAxisId ?? 'null'}</span>
    </div>
  )
}

/**
 * Single-source harness used to verify the typed UI path.
 */
function SingleSourceHarness() {
  const chart = useChart({data: jobData})

  return (
    <Chart chart={chart}>
      <TypedSingleSourceProbe />
    </Chart>
  )
}

/**
 * Probe component that intentionally asks for a typed context from a
 * multi-source chart so the runtime guard can reject it.
 */
function InvalidMultiSourceProbe() {
  useTypedChartContext<JobRecord>()
  return null
}

/**
 * Multi-source harness used to verify the honest runtime limitation.
 */
function MultiSourceHarness() {
  const chart = useChart({
    sources: [
      {id: 'jobs', label: 'Jobs', data: jobData},
      {id: 'candidates', label: 'Candidates', data: candidateData},
    ],
  })

  return (
    <Chart chart={chart}>
      <InvalidMultiSourceProbe />
    </Chart>
  )
}

describe('useTypedChartContext', () => {
  it('supports typed single-source context for inferred charts', () => {
    render(<SingleSourceHarness />)

    expect(screen.getByTestId('record-count').textContent).toBe('3')
    expect(screen.getByTestId('x-axis').textContent).toBe('dateAdded')
  })

  it('rejects typed narrowing for multi-source charts', () => {
    expect(() => render(<MultiSourceHarness />)).toThrowError(
      'useTypedChartContext only supports single-source charts right now. Multi-source charts stay broad because the active source schema can change.',
    )
  })
})
