/**
 * React context for sharing the chart instance across composable UI components.
 */

import {createContext, useContext, useMemo, type ReactNode} from 'react'
import type {
  ChartColumn,
  ChartInstance,
  ColumnHints,
  ColumnIdFromColumns,
  Metric,
  ResolvedColumnIdFromHints,
} from '../core/types.js'

type AnyChartColumns = readonly ChartColumn<any, string>[]
type RowFromColumns<TColumns extends AnyChartColumns> =
  TColumns[number] extends ChartColumn<infer TRow, string> ? TRow : never
type TypedChartFromColumns<TColumns extends AnyChartColumns> = ChartInstance<
  RowFromColumns<TColumns>,
  ColumnIdFromColumns<TColumns>
>

/**
 * Type-erased chart instance stored in React context.
 * This keeps the default UI primitives honest and safe for both single-source
 * and multi-source charts.
 */
type ChartContextChart = Omit<ChartInstance<unknown, string>, 'columns' | 'filters'> & {
  columns: readonly ChartColumn<any, string>[]
  filters: Map<string, Set<string>>
}

type ChartContextValue = {
  chart: ChartContextChart
  typedChart: unknown
}

const ChartContext = createContext<ChartContextValue | null>(null)

/**
 * Check whether a candidate column ID exists in the current chart.
 */
function isKnownColumnId<TColumnId extends string>(
  columnIds: ReadonlySet<string>,
  columnId: string,
): columnId is TColumnId {
  return columnIds.has(columnId)
}

/**
 * Check whether a metric is safe to forward into the typed chart instance.
 */
function isSupportedMetric<TColumnId extends string>(
  columnIds: ReadonlySet<string>,
  metric: Metric<string>,
): metric is Metric<TColumnId> {
  return metric.kind === 'count' || isKnownColumnId<TColumnId>(columnIds, metric.columnId)
}

/**
 * Compare a typed column tuple with the active chart columns.
 */
function hasMatchingColumns(expectedColumns: AnyChartColumns, actualColumns: readonly ChartColumn<any, string>[]) {
  return (
    expectedColumns.length === actualColumns.length &&
    expectedColumns.every((column, index) => column.id === actualColumns[index]?.id)
  )
}

/**
 * Create the broad-but-safe chart shape shared through React context.
 */
function createChartContextChart<T, TColumnId extends string>(
  chart: ChartInstance<T, TColumnId>,
): ChartContextChart {
  const columnIds = new Set(chart.columns.map((column) => column.id))

  return {
    activeSourceId: chart.activeSourceId,
    setActiveSource: chart.setActiveSource,
    hasMultipleSources: chart.hasMultipleSources,
    sources: chart.sources,
    chartType: chart.chartType,
    setChartType: chart.setChartType,
    availableChartTypes: chart.availableChartTypes,
    xAxisId: chart.xAxisId,
    setXAxis: (columnId) => {
      if (!isKnownColumnId<TColumnId>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      chart.setXAxis(columnId)
    },
    availableXAxes: chart.availableXAxes,
    groupById: chart.groupById,
    setGroupBy: (columnId) => {
      if (columnId === null) {
        chart.setGroupBy(null)
        return
      }

      if (!isKnownColumnId<TColumnId>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      chart.setGroupBy(columnId)
    },
    availableGroupBys: chart.availableGroupBys,
    metric: chart.metric,
    setMetric: (metric) => {
      if (!isSupportedMetric<TColumnId>(columnIds, metric)) {
        throw new Error(`Unknown metric column ID: "${metric.columnId}"`)
      }

      chart.setMetric(metric)
    },
    availableMetrics: chart.availableMetrics,
    timeBucket: chart.timeBucket,
    setTimeBucket: chart.setTimeBucket,
    isTimeSeries: chart.isTimeSeries,
    filters: new Map(chart.filters),
    toggleFilter: (columnId, value) => {
      if (!isKnownColumnId<TColumnId>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      chart.toggleFilter(columnId, value)
    },
    clearFilter: (columnId) => {
      if (!isKnownColumnId<TColumnId>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      chart.clearFilter(columnId)
    },
    clearAllFilters: chart.clearAllFilters,
    availableFilters: chart.availableFilters,
    sorting: chart.sorting,
    setSorting: chart.setSorting,
    dateRange: chart.dateRange,
    referenceDateId: chart.referenceDateId,
    setReferenceDateId: (columnId) => {
      if (!isKnownColumnId<TColumnId>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      chart.setReferenceDateId(columnId)
    },
    availableDateColumns: chart.availableDateColumns,
    dateRangeFilter: chart.dateRangeFilter,
    setDateRangeFilter: chart.setDateRangeFilter,
    transformedData: chart.transformedData,
    series: chart.series,
    columns: chart.columns,
    rawData: chart.rawData,
    recordCount: chart.recordCount,
  }
}

/**
 * Hook to access the chart instance from context.
 * Must be used within a `<Chart>` provider.
 *
 * Pass the original single-source column tuple to recover the full chart type
 * safely across the React context boundary.
 */
export function useChartContext(): ChartContextChart
export function useChartContext<const TColumns extends AnyChartColumns>(
  columns: TColumns,
): TypedChartFromColumns<TColumns>
export function useChartContext<const TColumns extends AnyChartColumns>(columns?: TColumns) {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useChartContext must be used within a <Chart> provider')
  }

  if (!columns) {
    return ctx.chart
  }

  if (ctx.chart.hasMultipleSources) {
    throw new Error(
      'useChartContext(columns) only supports single-source charts right now. Multi-source charts stay broad because the active source schema can change.',
    )
  }

  if (!hasMatchingColumns(columns, ctx.chart.columns)) {
    throw new Error(
      'useChartContext(columns) must receive the same column tuple that was passed to useChart().',
    )
  }

  return ctx.typedChart as TypedChartFromColumns<TColumns>
}

/**
 * Typed single-source chart context escape hatch for inferred charts.
 * React cannot infer provider generics through arbitrary subtrees, so callers
 * provide the row type (and optional hint type) explicitly.
 */
export function useTypedChartContext<T, const THints extends ColumnHints<T> | undefined = undefined>():
  ChartInstance<T, ResolvedColumnIdFromHints<T, THints>> {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useTypedChartContext must be used within a <Chart> provider')
  }

  if (ctx.chart.hasMultipleSources) {
    throw new Error(
      'useTypedChartContext only supports single-source charts right now. Multi-source charts stay broad because the active source schema can change.',
    )
  }

  return ctx.typedChart as ChartInstance<T, ResolvedColumnIdFromHints<T, THints>>
}

/**
 * Root provider component. Wraps children with the chart instance context.
 *
 * @example
 * ```tsx
 * <Chart chart={chart}>
 *   <ChartToolbar />
 *   <ChartCanvas />
 * </Chart>
 * ```
 */
export function Chart<T, TColumnId extends string>({
  chart,
  children,
  className,
}: {
  chart: ChartInstance<T, TColumnId>
  children: ReactNode
  className?: string
}) {
  const contextValue = useMemo<ChartContextValue>(
    () => ({
      chart: createChartContextChart(chart),
      typedChart: chart,
    }),
    [chart],
  )

  return (
    <ChartContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </ChartContext.Provider>
  )
}
