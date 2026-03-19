/**
 * Metric panel content — reusable by both ChartMetricSelector (inside a popover)
 * and ChartToolbarOverflow (rendered inline).
 *
 * Shows a "Count" option plus grouped number columns with aggregate buttons
 * (Sum, Avg, Min, Max) and an "Exclude zeros" toggle per column.
 */

import type {ReactNode} from 'react'
import {useMemo} from 'react'
import {ArrowDownToLine, ArrowUpToLine, Divide, Hash, Sigma} from 'lucide-react'
import {DEFAULT_METRIC, isAggregateMetric} from '@matthieumordrel/chart-studio/_internal'
import type {
  ChartColumn,
  Metric,
  NumericAggregateFunction,
  NumberColumn,
} from '@matthieumordrel/chart-studio'
import {useChartContext} from './chart-context.js'

// ---------------------------------------------------------------------------
// Aggregate button config
// ---------------------------------------------------------------------------

type AggregateOption = {
  fn: NumericAggregateFunction
  label: string
  shortLabel: string
  icon: ReactNode
}

const AGGREGATE_OPTIONS: AggregateOption[] = [
  {fn: 'sum', label: 'Sum', shortLabel: 'Sum', icon: <Sigma className="h-3.5 w-3.5 shrink-0" />},
  {
    fn: 'avg',
    label: 'Average',
    shortLabel: 'Avg',
    icon: <Divide className="h-3.5 w-3.5 shrink-0" />,
  },
  {
    fn: 'min',
    label: 'Minimum',
    shortLabel: 'Min',
    icon: <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" />,
  },
  {
    fn: 'max',
    label: 'Maximum',
    shortLabel: 'Max',
    icon: <ArrowUpToLine className="h-3.5 w-3.5 shrink-0" />,
  },
]

/** Aggregates where the "Exclude zeros" toggle is relevant */
const ZERO_TOGGLE_AGGREGATES = new Set<NumericAggregateFunction>(['avg', 'min', 'max'])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract number columns from the chart column list.
 */
function getNumberColumns(columns: readonly ChartColumn<unknown>[]): NumberColumn<unknown>[] {
  return columns.filter((column): column is NumberColumn<unknown> => column.type === 'number')
}

/**
 * Group the allowed aggregate metrics by number column while preserving column order.
 */
function getMetricColumnGroups(
  availableMetrics: readonly Metric<string>[],
  columns: readonly ChartColumn<unknown>[],
): Array<{columnId: string; label: string; aggregates: NumericAggregateFunction[]}> {
  const aggregateMap = new Map<string, Set<NumericAggregateFunction>>()

  for (const metric of availableMetrics) {
    if (metric.kind !== 'aggregate') {
      continue
    }

    const aggregates = aggregateMap.get(metric.columnId) ?? new Set<NumericAggregateFunction>()
    aggregates.add(metric.aggregate)
    aggregateMap.set(metric.columnId, aggregates)
  }

  return getNumberColumns(columns)
    .filter(column => aggregateMap.has(column.id))
    .map(column => ({
      columnId: column.id,
      label: column.label,
      aggregates: [...(aggregateMap.get(column.id) ?? new Set<NumericAggregateFunction>())],
    }))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single number column section with aggregate buttons + optional zero toggle. */
function MetricColumnGroup({
  group,
  isActiveColumn,
  activeAggregate,
  includeZeros,
  onSelectAggregate,
  onToggleZeros,
}: {
  group: {columnId: string; label: string; aggregates: NumericAggregateFunction[]}
  isActiveColumn: boolean
  activeAggregate: NumericAggregateFunction | null
  includeZeros: boolean
  onSelectAggregate: (fn: NumericAggregateFunction) => void
  onToggleZeros: () => void
}) {
  const isZeroToggleEnabled =
    isActiveColumn && activeAggregate !== null && ZERO_TOGGLE_AGGREGATES.has(activeAggregate)
  const isZeroToggleDisabled = isActiveColumn && activeAggregate === 'sum'

  return (
    <div className="space-y-2">
      {/* Column label + exclude zeros toggle */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </div>

        {/* Exclude zeros — visible when column is active, disabled for sum */}
        {isActiveColumn && (
          <button
            onClick={isZeroToggleDisabled ? undefined : onToggleZeros}
            className={`flex items-center gap-1.5 text-[10px] transition-colors ${
              isZeroToggleDisabled
                ? 'cursor-not-allowed text-muted-foreground/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isZeroToggleDisabled}
            title={
              isZeroToggleDisabled
                ? 'Not applicable for Sum'
                : 'Exclude zero values from calculation'
            }
          >
            <div
              className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                isZeroToggleEnabled && !includeZeros
                  ? 'border-primary bg-primary'
                  : isZeroToggleDisabled
                    ? 'border-muted-foreground/20'
                    : 'border-muted-foreground/30'
              }`}
            >
              {isZeroToggleEnabled && !includeZeros && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            Excl. zeros
          </button>
        )}
      </div>

      {/* Aggregate buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {AGGREGATE_OPTIONS.filter(opt => group.aggregates.includes(opt.fn)).map((opt) => {
          const isActive = isActiveColumn && activeAggregate === opt.fn
          return (
            <button
              key={opt.fn}
              onClick={() => onSelectAggregate(opt.fn)}
              className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border text-xs transition-colors ${
                isActive
                  ? 'border-primary/50 bg-primary/10 font-medium text-primary'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={opt.label}
            >
              {opt.icon}
              {opt.shortLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Metric panel content (no popover wrapper).
 *
 * @property onClose - Optional callback when user makes a definitive selection (e.g. "Count")
 * @property className - Additional CSS classes
 */
export function ChartMetricPanel({onClose, className}: {onClose?: () => void; className?: string}) {
  const {metric, setMetric, columns, availableMetrics} = useChartContext()
  const countMetricEnabled = useMemo(
    () => availableMetrics.some(candidate => candidate.kind === 'count'),
    [availableMetrics]
  )
  const metricColumnGroups = useMemo(
    () => getMetricColumnGroups(availableMetrics, columns),
    [availableMetrics, columns]
  )

  const isCount = metric.kind === 'count'
  const includeZeros = isAggregateMetric(metric) ? (metric.includeZeros ?? true) : true

  const handleSelectCount = () => {
    if (!countMetricEnabled) {
      return
    }

    setMetric(DEFAULT_METRIC)
    onClose?.()
  }

  const handleSelectAggregate = (columnId: string, fn: NumericAggregateFunction) => {
    setMetric({
      kind: 'aggregate',
      columnId,
      aggregate: fn,
      includeZeros: isAggregateMetric(metric) && metric.columnId === columnId ? includeZeros : true,
    })
  }

  const handleToggleZeros = () => {
    if (!isAggregateMetric(metric)) {
      return
    }

    setMetric({...metric, includeZeros: !includeZeros})
  }

  return (
    <div className={className}>
      {/* Count option */}
      {countMetricEnabled && (
        <button
          onClick={handleSelectCount}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
            isCount ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-md ${
              isCount ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="font-medium">Count</div>
            <div className="text-[10px] text-muted-foreground">Number of items</div>
          </div>
        </button>
      )}

      {/* Separator */}
      {countMetricEnabled && metricColumnGroups.length > 0 && <div className="my-4 border-t border-border" />}

      {/* Number column groups */}
      <div className="space-y-4">
        {metricColumnGroups.map((group) => (
          <MetricColumnGroup
            key={group.columnId}
            group={group}
            isActiveColumn={isAggregateMetric(metric) && metric.columnId === group.columnId}
            activeAggregate={
              isAggregateMetric(metric) && metric.columnId === group.columnId ? metric.aggregate : null
            }
            includeZeros={includeZeros}
            onSelectAggregate={(fn) => handleSelectAggregate(group.columnId, fn)}
            onToggleZeros={handleToggleZeros}
          />
        ))}
      </div>
    </div>
  )
}
