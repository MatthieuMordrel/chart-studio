import { useMemo, useState } from 'react'
import { getAvailableChartTypes, type ChartAxisType } from './chart-capabilities.js'
import { computeDateRange, filterByDateRange } from './date-utils.js'
import { inferColumnsFromData } from './infer-columns.js'
import { buildAvailableMetrics, DEFAULT_METRIC, resolveMetric, restrictAvailableMetrics } from './metric-utils.js'
import { applyFilters, extractAvailableFilters, runPipeline } from './pipeline.js'
import type {
  ChartColumn,
  ChartInstanceFromConfig,
  ChartToolsConfigFromHints,
  ChartType,
  ColumnHints,
  DateColumn,
  DateRange,
  DateRangeFilter,
  FilterState,
  Metric,
  MultiSourceChartInstance,
  NonEmptyChartSourceOptions,
  ResolvedChartSource,
  SortConfig,
  TimeBucket
} from './types.js'
import { DEFAULT_TIME_BUCKET, type MultiSourceOptions, type SingleSourceOptions } from './use-chart-options.js'
import { resolveReferenceDateId, resolveXAxisId, sanitizeFilters } from './use-chart-resolvers.js'

/**
 * Headless React hook that manages all chart configuration, state, and derived/transformed data for chart rendering.
 *
 * There are two major usage patterns:
 * - Single source: Provide plain `data` and optional `columnHints`.
 * - Multi-source: Provide a `sources` array, each having an `id`, `label`, `data`, and optional `columnHints`.
 *
 * @template T - The type of each data record in the dataset.
 * @template THints - Optional per-field overrides for inferred single-source columns.
 * @param {SingleSourceOptions<T, THints> | MultiSourceOptions} options
 *   Chart configuration options. Should provide either:
 *   - `data`, optional `columnHints`, and (optionally) `sourceLabel` for a single source
 *   - or `sources` array for multiple sources
 *
 * @returns {ChartInstance}
 *   An object representing chart configuration, state, and all derived data/operations:
 *   - `activeSourceId`: The current source id
 *   - `setActiveSource(id)`: Set the active source id (multi-source only)
 *   - `hasMultipleSources`: Whether more than one data source is present
 *   - `sources`: Array of `{ id, label }` describing available sources
 *   - `chartType`, `setChartType`, `availableChartTypes`: Current chart type, setter, and list of types
 *   - `xAxisId`, `setXAxis`, `availableXAxes`: Current, setter, and available columns for X axis
 *   - `groupById`, `setGroupBy`, `availableGroupBys`: Group by key, setter, and options
 *   - `metric`, `setMetric`, `availableMetrics`: Current aggregation metric, setter, and options
 *   - `timeBucket`, `setTimeBucket`: Date/time bucketing (if applicable), setter
 *   - `isTimeSeries`: Whether the chart is a time series (based on axis)
 *   - `filters`, `toggleFilter`, `clearFilter`, `clearAllFilters`, `availableFilters`: Current filters and their controls
 *   - `sorting`, `setSorting`: Current sorting config and setter
 *   - `dateRange`, `referenceDateId`, `setReferenceDateId`, `availableDateColumns`, `dateRangeFilter`, `setDateRangeFilter`: Date filtering state and controls
 *   - `transformedData`: Data after all transforms/pipeline stages
 *   - `series`: Array of chart series for the current chart config
 *   - `columns`: The active columns for the current data source
 *   - `rawData`: The raw input data for the active data source
 *   - `recordCount`: Number of records present in the current data source
 */
export function useChart<const TSources extends NonEmptyChartSourceOptions>(
  options: {
    data?: never
    columnHints?: never
    sourceLabel?: never
    sources: TSources
  }
): MultiSourceChartInstance<TSources>
export function useChart<
  T,
  const THints extends ColumnHints<T> | undefined = undefined,
  const TTools extends ChartToolsConfigFromHints<T, THints> | undefined = undefined,
>(
  options: SingleSourceOptions<T, THints> & {tools?: TTools}
): ChartInstanceFromConfig<T, THints, TTools>
export function useChart<
  T,
  const THints extends ColumnHints<T> | undefined = undefined,
  const TTools extends ChartToolsConfigFromHints<T, THints> | undefined = undefined,
>(
  options: (SingleSourceOptions<T, THints> & {tools?: TTools}) | MultiSourceOptions
): ChartInstanceFromConfig<T, THints, TTools> | MultiSourceChartInstance<NonEmptyChartSourceOptions> {
  if ('sources' in options && options.sources?.length === 0) {
    throw new Error('useChart requires at least one source')
  }

  const sources = useMemo<ResolvedChartSource<any, string>[]>(() => {
    if ('sources' in options && options.sources) {
      return options.sources.map(source => ({
        id: source.id,
        label: source.label,
        data: source.data,
        columns: inferColumnsFromData(source.data, source.columnHints),
        tools: source.tools,
      }))
    }

    return [
      {
        id: 'default',
        label: options.sourceLabel ?? 'Unnamed Source',
        data: options.data,
        columns: inferColumnsFromData(options.data, options.columnHints),
        tools: options.tools,
      },
    ]
  }, [options])
  const hasMultipleSources = sources.length > 1

  const [activeSourceIdRaw, setActiveSourceRaw] = useState(sources[0]?.id ?? 'default')
  const [chartType, setChartTypeRaw] = useState<ChartType>('bar')
  const [xAxisId, setXAxisRaw] = useState<string | null>(null)
  const [groupById, setGroupBy] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric<string>>(DEFAULT_METRIC)
  const [timeBucket, setTimeBucket] = useState<TimeBucket>(DEFAULT_TIME_BUCKET)
  const [filters, setFilters] = useState<FilterState<string>>(() => new Map())
  const [sorting, setSorting] = useState<SortConfig | null>(null)
  const [referenceDateIdRaw, setReferenceDateId] = useState<string | null>(null)
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter | null>(null)

  const sourceIds = useMemo(() => new Set(sources.map(source => source.id)), [sources])
  const activeSourceId = sourceIds.has(activeSourceIdRaw) ? activeSourceIdRaw : (sources[0]?.id ?? 'default')
  const setActiveSource = (sourceId: string) => {
    if (!sourceIds.has(sourceId)) {
      throw new Error(`Unknown chart source ID: "${sourceId}"`)
    }

    setActiveSourceRaw(sourceId)
  }
  const activeSource = sources.find(s => s.id === activeSourceId) ?? sources[0]!
  const activeColumns: readonly ChartColumn<any, string>[] = activeSource.columns
  const rawData: readonly any[] = activeSource.data

  const dateColumns = useMemo(
    () => activeColumns.filter((column): column is DateColumn<any, string> => column.type === 'date'),
    [activeColumns]
  )

  const availableDateColumns = useMemo(() => dateColumns.map(column => ({ id: column.id, label: column.label })), [dateColumns])

  const resolvedXAxisId = useMemo(() => resolveXAxisId(xAxisId, activeColumns), [xAxisId, activeColumns])
  const xColumn = activeColumns.find(column => column.id === resolvedXAxisId) ?? null
  const resolvedXAxisType: ChartAxisType | null = xColumn && xColumn.type !== 'number' ? xColumn.type : null
  const isTimeSeries = resolvedXAxisType === 'date'
  const referenceDateId = useMemo(
    () => resolveReferenceDateId(referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries),
    [referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries]
  )

  const effectiveData: readonly T[] = useMemo(() => {
    const column = dateColumns.find(candidate => candidate.id === referenceDateId)
    if (!column) return rawData

    if (dateRangeFilter === null) {
      return rawData
    }

    return filterByDateRange(rawData, column, dateRangeFilter)
  }, [rawData, dateRangeFilter, dateColumns, referenceDateId])

  const availableXAxes = useMemo(
    () => activeColumns.filter(column => column.type !== 'number').map(column => ({ id: column.id, label: column.label, type: column.type })),
    [activeColumns]
  )

  const availableGroupBys = useMemo(
    () => {
      const allowedGroupByIds = activeSource.tools?.groupBy?.allowed
      const allowedGroupByIdSet = allowedGroupByIds ? new Set(allowedGroupByIds) : null

      return activeColumns
        .filter(column => (column.type === 'category' || column.type === 'boolean') && column.id !== resolvedXAxisId)
        .filter(column => (allowedGroupByIdSet ? allowedGroupByIdSet.has(column.id) : true))
        .map(column => ({ id: column.id, label: column.label }))
    },
    [activeColumns, activeSource.tools, resolvedXAxisId]
  )

  const resolvedGroupById = groupById && availableGroupBys.some(column => column.id === groupById) ? groupById : null
  const availableMetrics = useMemo(
    () => restrictAvailableMetrics(buildAvailableMetrics(activeColumns), activeSource.tools?.metric?.allowed),
    [activeColumns, activeSource.tools]
  )
  const resolvedMetric = useMemo(
    () => resolveMetric(metric, activeColumns, availableMetrics),
    [metric, activeColumns, availableMetrics]
  )
  const resolvedFilters = useMemo(() => sanitizeFilters(filters, activeColumns), [filters, activeColumns])
  const availableChartTypes = useMemo(
    () =>
      getAvailableChartTypes({
        xAxisType: resolvedXAxisType,
        hasGroupBy: resolvedGroupById !== null
      }),
    [resolvedGroupById, resolvedXAxisType]
  )

  const availableFilters = useMemo(() => extractAvailableFilters(effectiveData, activeColumns), [effectiveData, activeColumns])

  const resolvedChartType = availableChartTypes.includes(chartType) ? chartType : (availableChartTypes[0] ?? 'bar')

  const pipelineResult = useMemo(() => {
    if (!resolvedXAxisId) return { data: [], series: [], groups: [] }

    return runPipeline({
      data: effectiveData,
      columns: activeColumns,
      xAxisId: resolvedXAxisId,
      groupById: resolvedGroupById,
      metric: resolvedMetric,
      timeBucket,
      filters: resolvedFilters,
      sorting
    })
  }, [effectiveData, activeColumns, resolvedXAxisId, resolvedGroupById, resolvedMetric, timeBucket, resolvedFilters, sorting])

  const dateRange: DateRange<string> | null = useMemo(() => {
    const column = dateColumns.find(candidate => candidate.id === referenceDateId)
    if (!column) return null

    const filtered = applyFilters(effectiveData, activeColumns, resolvedFilters)
    const { min, max } = computeDateRange(filtered, column)
    return { columnId: column.id, label: column.label, min, max }
  }, [dateColumns, referenceDateId, effectiveData, activeColumns, resolvedFilters])

  const setChartType = (type: ChartType) => {
    if (availableChartTypes.includes(type)) {
      setChartTypeRaw(type)
    }
  }

  const setXAxis = (columnId: string) => {
    setXAxisRaw(columnId)
    if (resolvedGroupById === columnId) {
      setGroupBy(null)
    }
  }

  const toggleFilter = (columnId: string, value: string) => {
    setFilters(prev => {
      const next = new Map(prev)
      const current = next.get(columnId) ?? new Set<string>()
      const updated = new Set(current)

      if (updated.has(value)) {
        updated.delete(value)
      } else {
        updated.add(value)
      }

      if (updated.size === 0) {
        next.delete(columnId)
      } else {
        next.set(columnId, updated)
      }

      return next
    })
  }

  const clearFilter = (columnId: string) => {
    setFilters(prev => {
      const next = new Map(prev)
      next.delete(columnId)
      return next
    })
  }

  const clearAllFilters = () => {
    setFilters(new Map())
  }

  return {
    activeSourceId,
    setActiveSource,
    hasMultipleSources,
    sources: sources.map(s => ({ id: s.id, label: s.label })),
    chartType: resolvedChartType,
    setChartType,
    availableChartTypes,
    xAxisId: resolvedXAxisId,
    setXAxis,
    availableXAxes,
    groupById: resolvedGroupById,
    setGroupBy,
    availableGroupBys,
    metric: resolvedMetric,
    setMetric,
    availableMetrics,
    timeBucket,
    setTimeBucket,
    isTimeSeries,
    filters: resolvedFilters,
    toggleFilter,
    clearFilter,
    clearAllFilters,
    availableFilters,
    sorting,
    setSorting,
    dateRange,
    referenceDateId,
    setReferenceDateId,
    availableDateColumns,
    dateRangeFilter,
    setDateRangeFilter,
    transformedData: pipelineResult.data,
    series: pipelineResult.series,
    columns: activeColumns,
    rawData,
    recordCount: rawData.length
  } as unknown as ChartInstanceFromConfig<T, THints, TTools> | MultiSourceChartInstance<NonEmptyChartSourceOptions>
}
