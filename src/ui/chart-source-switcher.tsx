/**
 * Data source control — adapts based on single vs multi-source.
 *
 * Single source: read-only badge showing source label + record count.
 * Multi source: toggle buttons to switch between data sources.
 */

import {Database} from 'lucide-react'
import {useChartContext} from './chart-context.js'

/** Format a number with locale-aware separators (e.g. 1,247). */
function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Data source display/switcher.
 *
 * - Single source → read-only badge: "[icon] Jobs · 1,247 records"
 * - Multi source → toggle buttons to switch between sources
 */
export function ChartSourceSwitcher({className}: {className?: string}) {
  const {hasMultipleSources, sources, activeSourceId, setActiveSource, recordCount} =
    useChartContext()

  // Single source — read-only info badge
  if (!hasMultipleSources) {
    const label = sources[0]?.label ?? 'Unnamed Source'
    return (
      <div
        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground ${className ?? ''}`}
      >
        <Database className="h-3 w-3 shrink-0" />
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground/40">·</span>
        <span>{formatCount(recordCount)} records</span>
      </div>
    )
  }

  // Multi source — toggle buttons
  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border/50 bg-muted/50 p-0.5 shadow-sm ${className ?? ''}`}
      role="tablist"
      aria-label="Data source"
    >
      {sources.map((source) => {
        const isActive = source.id === activeSourceId
        return (
          <button
            key={source.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveSource(source.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            }`}
          >
            {source.label}
          </button>
        )
      })}
    </div>
  )
}
