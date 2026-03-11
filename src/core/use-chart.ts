import { useMemo, useState } from 'react'
import { getAvailableChartTypes, type ChartAxisType } from './chart-capabilities.js'
import { computeDateRange, filterByDateRange } from './date-utils.js'
import { inferColumnsFromData } from './infer-columns.js'
import { buildAvailableMetrics, DEFAULT_METRIC, resolveMetric } from './metric-utils.js'
import { applyFilters, extractAvailableFilters, runPipeline } from './pipeline.js'
import type {
  ChartColumn,
  ChartInstance,
  ChartType,
  ColumnHints,
  DataSource,
  DateColumn,
  DateRange,
  DateRangeFilter,
  FilterState,
  Metric,
  ResolvedColumnIdFromHints,
  SortConfig,
  TimeBucket
} from './types.js'
import { DEFAULT_TIME_BUCKET, type MultiSourceOptions, type SingleSourceOptions, type UseChartOptions } from './use-chart-options.js'
import { resolveReferenceDateId, resolveXAxisId, sanitizeFilters } from './use-chart-resolvers.js'

/**
 * Headless React hook that manages all chart configuration, state, and derived/transformed data for chart rendering.
 *
 * There are two major usage patterns:
 * - Single source: Provide plain `data` and optional `columnHints`.
 * - Multi-source: Provide a `sources` array, each having an `id`, `label`, `data`, `columns`.
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
export function useChart<T, const THints extends ColumnHints<T> | undefined = undefined>(
  options: SingleSourceOptions<T, THints>
): ChartInstance<T, ResolvedColumnIdFromHints<T, THints>>
export function useChart(options: MultiSourceOptions): ChartInstance<unknown>
export function useChart<T, const THints extends ColumnHints<T> | undefined = undefined>(
  options: UseChartOptions<T, THints>
): ChartInstance<T, ResolvedColumnIdFromHints<T, THints>> | ChartInstance<unknown> {
  if (options.sources && options.sources.length === 0) {
    throw new Error('useChart requires at least one source')
  }

  const singleSourceColumns = useMemo(
    () => ('sources' in options ? null : inferColumnsFromData(options.data, options.columnHints)),
    [options]
  )
  const sources = ('sources' in options
    ? options.sources
    : [
        {
          id: 'default',
          label: options.sourceLabel ?? 'Unnamed Source',
          data: options.data,
          columns: singleSourceColumns
        }
      ]) as unknown as DataSource<T, ResolvedColumnIdFromHints<T, THints>>[]
  const hasMultipleSources = sources.length > 1

  const [activeSourceId, setActiveSource] = useState(sources[0]?.id ?? 'default')
  const [chartType, setChartTypeRaw] = useState<ChartType>('bar')
  const [xAxisId, setXAxisRaw] = useState<ResolvedColumnIdFromHints<T, THints> | null>(null)
  const [groupById, setGroupBy] = useState<ResolvedColumnIdFromHints<T, THints> | null>(null)
  const [metric, setMetric] = useState<Metric<ResolvedColumnIdFromHints<T, THints>>>(DEFAULT_METRIC)
  const [timeBucket, setTimeBucket] = useState<TimeBucket>(DEFAULT_TIME_BUCKET)
  const [filters, setFilters] = useState<FilterState<ResolvedColumnIdFromHints<T, THints>>>(() => new Map())
  const [sorting, setSorting] = useState<SortConfig | null>(null)
  const [referenceDateIdRaw, setReferenceDateId] = useState<ResolvedColumnIdFromHints<T, THints> | null>(null)
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter | null>(null)

  const activeSource = sources.find(s => s.id === activeSourceId) ?? sources[0]!
  const activeColumns: readonly ChartColumn<T, ResolvedColumnIdFromHints<T, THints>>[] = activeSource.columns
  const rawData: readonly T[] = activeSource.data

  const dateColumns = useMemo(
    () => activeColumns.filter((column): column is DateColumn<T, ResolvedColumnIdFromHints<T, THints>> => column.type === 'date'),
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
    () =>
      activeColumns
        .filter(column => (column.type === 'category' || column.type === 'boolean') && column.id !== resolvedXAxisId)
        .map(column => ({ id: column.id, label: column.label })),
    [activeColumns, resolvedXAxisId]
  )

  const resolvedGroupById = groupById && availableGroupBys.some(column => column.id === groupById) ? groupById : null
  const availableMetrics = useMemo(() => buildAvailableMetrics(activeColumns), [activeColumns])
  const resolvedMetric = useMemo(() => resolveMetric(metric, activeColumns), [metric, activeColumns])
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

  const dateRange: DateRange<ResolvedColumnIdFromHints<T, THints>> | null = useMemo(() => {
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

  const setXAxis = (columnId: ResolvedColumnIdFromHints<T, THints>) => {
    setXAxisRaw(columnId)
    if (resolvedGroupById === columnId) {
      setGroupBy(null)
    }
  }

  const toggleFilter = (columnId: ResolvedColumnIdFromHints<T, THints>, value: string) => {
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

  const clearFilter = (columnId: ResolvedColumnIdFromHints<T, THints>) => {
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
  }
}
