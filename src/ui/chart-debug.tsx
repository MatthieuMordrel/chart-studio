/**
 * Debug panel — shows raw data, transformed data, series, and current state.
 * Drop `<ChartDebug />` inside a `<Chart>` to inspect what's happening.
 */

import {useState} from 'react'
import {useChartContext} from './chart-context.js'

type Tab = 'raw' | 'transformed' | 'series' | 'state'

const TABS: Array<{id: Tab; label: string}> = [
  {id: 'raw', label: 'Raw'},
  {id: 'transformed', label: 'Transformed'},
  {id: 'series', label: 'Series'},
  {id: 'state', label: 'State'},
]

/**
 * Resolve the currently selected debug payload.
 */
function getDebugContent(chart: ReturnType<typeof useChartContext>, activeTab: Tab) {
  switch (activeTab) {
    case 'raw':
      return chart.rawData
    case 'transformed':
      return chart.transformedData
    case 'series':
      return chart.series
    case 'state':
      return {
        activeSourceId: chart.activeSourceId,
        chartType: chart.chartType,
        xAxisId: chart.xAxisId,
        groupById: chart.groupById,
        metric: chart.metric,
        timeBucket: chart.timeBucket,
        isTimeSeries: chart.isTimeSeries,
        filters: Object.fromEntries([...chart.filters.entries()].map(([k, v]) => [k, [...v]])),
        sorting: chart.sorting,
        availableChartTypes: chart.availableChartTypes,
        availableGroupBys: chart.availableGroupBys,
        availableMetrics: chart.availableMetrics,
        availableFilters: chart.availableFilters.map((filter) => ({
          ...filter,
          options:
            filter.options.length > 5
              ? [
                  ...filter.options.slice(0, 5),
                  {value: '...', label: `+${filter.options.length - 5} more`, count: 0},
                ]
              : filter.options,
        })),
      }
  }
}

/** Tab bar button. */
function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: (typeof TABS)[number]
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-1.5 text-[11px] font-mono transition-colors ${
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {tab.label}
    </button>
  )
}

/** Debug panel that renders chart internals as formatted JSON. */
export function ChartDebug({
  className,
  defaultOpen = false,
}: {
  className?: string
  defaultOpen?: boolean
}) {
  const chart = useChartContext()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<Tab>('raw')
  const content = getDebugContent(chart, activeTab)

  return (
    <div
      className={`overflow-hidden rounded-lg border border-dashed border-border bg-background ${className ?? ''}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-mono text-foreground transition-colors hover:bg-muted/50"
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>chart-studio debug</span>
        <span className="text-muted-foreground">
          ({chart.rawData.length} raw, {chart.transformedData.length} points, {chart.series.length}{' '}
          series)
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-dashed border-border">
          {/* Tab bar */}
          <div className="flex gap-0 border-b border-border bg-muted/20">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Content */}
          <pre
            className="max-h-64 overflow-auto bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-foreground"
            onWheel={(e) => e.stopPropagation()}
          >
            {JSON.stringify(content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
