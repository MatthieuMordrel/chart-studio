/**
 * React context for sharing the chart instance across composable UI components.
 */

import {createContext, useContext, useMemo, type ReactElement, type ReactNode} from 'react'
import type {
  ChartColumn,
  ChartInstance,
  ChartInstanceFromConfig,
  ColumnHints,
  DefinedChartConfigFromHints,
  Metric,
  ResolvedChartConfigFromDefinition,
} from '../core/types.js'

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

type AnyChartInstance = {
  activeSourceId: string
  setActiveSource: (...args: any[]) => unknown
  hasMultipleSources: boolean
  sources: Array<{id: string; label: string}>
  chartType: ChartContextChart['chartType']
  setChartType: (...args: any[]) => unknown
  availableChartTypes: ChartContextChart['availableChartTypes']
  xAxisId: string | null
  setXAxis: (...args: any[]) => unknown
  availableXAxes: ChartContextChart['availableXAxes']
  groupById: string | null
  setGroupBy: (...args: any[]) => unknown
  availableGroupBys: ChartContextChart['availableGroupBys']
  metric: Metric<any>
  setMetric: (...args: any[]) => unknown
  availableMetrics: ChartContextChart['availableMetrics']
  timeBucket: ChartContextChart['timeBucket']
  setTimeBucket: (...args: any[]) => unknown
  availableTimeBuckets: ChartContextChart['availableTimeBuckets']
  isTimeSeries: boolean
  filters: Map<any, Set<string>>
  toggleFilter: (...args: any[]) => unknown
  clearFilter: (...args: any[]) => unknown
  clearAllFilters: () => void
  availableFilters: ChartContextChart['availableFilters']
  sorting: ChartContextChart['sorting']
  setSorting: (...args: any[]) => unknown
  dateRange: ChartContextChart['dateRange']
  referenceDateId: string | null
  setReferenceDateId: (...args: any[]) => unknown
  availableDateColumns: ChartContextChart['availableDateColumns']
  dateRangeFilter: ChartContextChart['dateRangeFilter']
  setDateRangeFilter: (...args: any[]) => unknown
  transformedData: ChartContextChart['transformedData']
  series: ChartContextChart['series']
  columns: readonly ChartColumn<any, string>[]
  rawData: readonly unknown[]
  recordCount: number
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
 * Create the broad-but-safe chart shape shared through React context.
 */
function createChartContextChart(chart: AnyChartInstance): ChartContextChart {
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
      if (!isKnownColumnId<string>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      ;(chart.setXAxis as (columnId: string) => void)(columnId)
    },
    availableXAxes: chart.availableXAxes,
    groupById: chart.groupById,
    setGroupBy: (columnId) => {
      if (columnId === null) {
        ;(chart.setGroupBy as (columnId: string | null) => void)(null)
        return
      }

      if (!isKnownColumnId<string>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      ;(chart.setGroupBy as (columnId: string | null) => void)(columnId)
    },
    availableGroupBys: chart.availableGroupBys,
    metric: chart.metric,
    setMetric: (metric) => {
      if (metric.kind === 'aggregate' && !isKnownColumnId<string>(columnIds, metric.columnId)) {
        throw new Error(`Unknown metric column ID: "${metric.columnId}"`)
      }

      ;(chart.setMetric as (metric: Metric<string>) => void)(metric)
    },
    availableMetrics: chart.availableMetrics,
    timeBucket: chart.timeBucket,
    setTimeBucket: chart.setTimeBucket,
    availableTimeBuckets: chart.availableTimeBuckets,
    isTimeSeries: chart.isTimeSeries,
    filters: new Map(chart.filters),
    toggleFilter: (columnId, value) => {
      if (!isKnownColumnId<string>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      ;(chart.toggleFilter as (columnId: string, value: string) => void)(columnId, value)
    },
    clearFilter: (columnId) => {
      if (!isKnownColumnId<string>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      ;(chart.clearFilter as (columnId: string) => void)(columnId)
    },
    clearAllFilters: chart.clearAllFilters,
    availableFilters: chart.availableFilters,
    sorting: chart.sorting,
    setSorting: chart.setSorting,
    dateRange: chart.dateRange,
    referenceDateId: chart.referenceDateId,
    setReferenceDateId: (columnId) => {
      if (!isKnownColumnId<string>(columnIds, columnId)) {
        throw new Error(`Unknown chart column ID: "${columnId}"`)
      }

      ;(chart.setReferenceDateId as (columnId: string) => void)(columnId)
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
 * This hook stays intentionally broad so the default UI primitives remain safe
 * for both single-source and multi-source charts.
 */
export function useChartContext(): ChartContextChart
export function useChartContext() {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useChartContext must be used within a <Chart> provider')
  }

  return ctx.chart
}

/**
 * Typed single-source chart context escape hatch for inferred charts.
 * React cannot infer provider generics through arbitrary subtrees, so callers
 * provide the row type (and optional hint type) explicitly.
 */
export function useTypedChartContext<
  T,
  const THints extends ColumnHints<T> | undefined = undefined,
  const TConfig extends DefinedChartConfigFromHints<T, THints> | undefined = undefined,
>(): ChartInstanceFromConfig<T, THints, ResolvedChartConfigFromDefinition<TConfig>> {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useTypedChartContext must be used within a <Chart> provider')
  }

  if (ctx.chart.hasMultipleSources) {
    throw new Error(
      'useTypedChartContext only supports single-source charts right now. Multi-source charts stay broad because the active source schema can change.',
    )
  }

  return ctx.typedChart as ChartInstanceFromConfig<T, THints, ResolvedChartConfigFromDefinition<TConfig>>
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
export function Chart({
  chart,
  children,
  className,
}: {
  chart: AnyChartInstance
  children: ReactNode
  className?: string
}): ReactElement
export function Chart({
  chart,
  children,
  className,
}: {
  chart: AnyChartInstance
  children: ReactNode
  className?: string
}): ReactElement {
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
