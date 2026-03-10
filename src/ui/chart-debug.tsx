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
      className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
        isActive
          ? 'bg-orange-500/10 text-orange-500 border-b-2 border-orange-500'
          : 'text-orange-400/60 hover:text-orange-400'
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

  const content = () => {
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
          availableFilters: chart.availableFilters.map((f) => ({
            ...f,
            options:
              f.options.length > 5
                ? [
                    ...f.options.slice(0, 5),
                    {value: '...', label: `+${f.options.length - 5} more`, count: 0},
                  ]
                : f.options,
          })),
        }
    }
  }

  return (
    <div className={`border border-dashed border-orange-400/50 rounded-lg ${className ?? ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-mono text-orange-500 hover:bg-orange-500/5"
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>chart-studio debug</span>
        <span className="text-orange-400/60">
          ({chart.rawData.length} raw, {chart.transformedData.length} points, {chart.series.length}{' '}
          series)
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-dashed border-orange-400/50">
          {/* Tab bar */}
          <div className="flex gap-0 border-b border-orange-400/30">
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
            className="max-h-64 overflow-auto p-3 text-[11px] leading-relaxed font-mono text-orange-300/80 bg-orange-950/20"
            onWheel={(e) => e.stopPropagation()}
          >
            {JSON.stringify(content(), null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
