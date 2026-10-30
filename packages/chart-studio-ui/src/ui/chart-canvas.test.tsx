import {render} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {defineDataset, useChart} from '@matthieumordrel/chart-studio'
import {Chart} from './chart-context.js'
import {ChartCanvas} from './chart-canvas.js'

type RevenueRow = {
  month: string
  type: string
  revenue: number
}

/**
 * Two months, each split into three employment types so the default `bar`
 * chart renders one stack per month.
 */
const revenueRows: RevenueRow[] = [
  {month: 'Jan', type: 'Interim', revenue: 1200},
  {month: 'Jan', type: 'Permanent', revenue: 800},
  {month: 'Jan', type: 'Freelance', revenue: 500},
  {month: 'Feb', type: 'Interim', revenue: 300},
  {month: 'Feb', type: 'Permanent', revenue: 200},
]

const revenueDataset = defineDataset<RevenueRow>().columns((c) => [
  c.category('month'),
  c.category('type'),
  c.number('revenue'),
])

const stackedSchema = revenueDataset
  .chart('revenueByType')
  .xAxis((x) => x.allowed('month').default('month'))
  .groupBy((g) => g.allowed('type').default('type'))
  .metric((m) => m.aggregate('revenue', 'sum').defaultAggregate('revenue', 'sum'))
  .chartType((t) => t.allowed('bar').default('bar'))

const groupedSchema = revenueDataset
  .chart('revenueByTypeSideBySide')
  .xAxis((x) => x.allowed('month').default('month'))
  .groupBy((g) => g.allowed('type').default('type'))
  .metric((m) => m.aggregate('revenue', 'sum').defaultAggregate('revenue', 'sum'))
  .chartType((t) => t.allowed('grouped-bar').default('grouped-bar'))

const ungroupedSchema = revenueDataset
  .chart('revenue')
  .xAxis((x) => x.allowed('month').default('month'))
  .metric((m) => m.aggregate('revenue', 'sum').defaultAggregate('revenue', 'sum'))
  .chartType((t) => t.allowed('bar').default('bar'))

type CanvasProps = Parameters<typeof ChartCanvas>[0]

function StackedHarness({rows = revenueRows, ...props}: CanvasProps & {rows?: RevenueRow[]}) {
  const chart = useChart({data: rows, schema: stackedSchema})
  return (
    <Chart chart={chart}>
      <ChartCanvas {...props} />
    </Chart>
  )
}

function GroupedHarness(props: CanvasProps) {
  const chart = useChart({data: revenueRows, schema: groupedSchema})
  return (
    <Chart chart={chart}>
      <ChartCanvas {...props} />
    </Chart>
  )
}

function UngroupedHarness(props: CanvasProps) {
  const chart = useChart({data: revenueRows, schema: ungroupedSchema})
  return (
    <Chart chart={chart}>
      <ChartCanvas {...props} />
    </Chart>
  )
}

/**
 * Text of every rendered data label (Recharts gives each label list a
 * `recharts-label-list` layer).
 */
function getDataLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.recharts-label-list text'))
    .map((node) => node.textContent ?? '')
    .filter((text) => text !== '')
}

/**
 * jsdom has no layout, so give the canvas a fixed size and a ResizeObserver
 * that never fires (the canvas reads the size once on mount). Reporting
 * `prefers-reduced-motion` turns off Recharts' bar animation, which otherwise
 * keeps labels hidden until it finishes.
 */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // Only the canvas root reports a size; Recharts' own measurements (legend,
  // tooltip) stay at zero so they do not eat the plot area.
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.style.height === '300px' && !this.classList.contains('recharts-wrapper')) {
      return DOMRect.fromRect({width: 600, height: 300})
    }
    return originalGetBoundingClientRect.call(this)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ChartCanvas stacked data labels', () => {
  it('labels every segment of a stacked bar by default', () => {
    const {container} = render(<StackedHarness showDataLabels />)

    // Jan has three segments and Feb two: one label each.
    expect(getDataLabels(container)).toHaveLength(5)
  })

  it("labels each stack once with its total when stackedDataLabels is 'total'", () => {
    const {container} = render(<StackedHarness showDataLabels stackedDataLabels="total" />)

    // Jan: 1200 + 800 + 500, Feb: 300 + 200 (no Freelance row).
    expect(getDataLabels(container).sort()).toEqual(['2.5K', '500'])
  })

  it('labels mixed-sign and negative stacks once with their net total', () => {
    const rows: RevenueRow[] = [
      {month: 'Jan', type: 'Interim', revenue: 400},
      {month: 'Jan', type: 'Permanent', revenue: -100},
      {month: 'Feb', type: 'Interim', revenue: -400},
      {month: 'Feb', type: 'Permanent', revenue: 100},
      {month: 'Mar', type: 'Interim', revenue: 200},
      {month: 'Mar', type: 'Permanent', revenue: -200},
    ]
    const {container} = render(<StackedHarness rows={rows} showDataLabels stackedDataLabels="total" />)

    // Mar nets to zero, so it gets no label (zero labels are always hidden).
    expect(getDataLabels(container).sort()).toEqual(['-300', '300'])
  })

  it('styles total labels neutrally rather than with a series color', () => {
    const {container} = render(<StackedHarness showDataLabels stackedDataLabels="total" />)
    const labels = Array.from(container.querySelectorAll('.recharts-label-list text')).filter(
      (node) => node.textContent,
    )

    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label.getAttribute('class')).toContain('fill-foreground')
    }
  })

  it('renders no labels when data labels are hidden, even in total mode', () => {
    const {container} = render(<StackedHarness showDataLabels={false} stackedDataLabels="total" />)

    expect(getDataLabels(container)).toEqual([])
  })

  it('keeps per-bar labels on charts that are not stacked', () => {
    const {container} = render(<UngroupedHarness showDataLabels stackedDataLabels="total" />)

    expect(getDataLabels(container).sort()).toEqual(['2.5K', '500'])
  })

  it('leaves grouped (side-by-side) bars labelled per series', () => {
    const {container} = render(<GroupedHarness showDataLabels stackedDataLabels="total" />)

    expect(getDataLabels(container).sort()).toEqual(['1.2K', '200', '300', '500', '800'])
  })
})
