import {useMemo, useState} from 'react'
import {getAvailableChartTypes, type ChartAxisType} from './chart-capabilities.js'
import {computeDateRange, filterByDateRange} from './date-utils.js'
import {buildAvailableMetrics, resolveMetric, DEFAULT_METRIC} from './metric-utils.js'
import {applyFilters, extractAvailableFilters, runPipeline} from './pipeline.js'
import type {
  ChartColumn,
  ColumnIdFromColumns,
  ChartInstance,
  ChartType,
  DateColumn,
  DateRange,
  DateRangeFilter,
  DataSource,
  FilterState,
  Metric,
  SortConfig,
  TimeBucket,
} from './types.js'
import {
  type MultiSourceOptions,
  type SingleSourceOptions,
  DEFAULT_TIME_BUCKET,
  type UseChartOptions,
} from './use-chart-options.js'
import {resolveReferenceDateId, resolveXAxisId, sanitizeFilters} from './use-chart-resolvers.js'

/**
 * Headless chart hook that manages chart state and derived data.
 */
export function useChart<T, const TColumns extends readonly ChartColumn<T, string>[]>(
  options: SingleSourceOptions<T, TColumns>,
): ChartInstance<T, ColumnIdFromColumns<TColumns>>
export function useChart(options: MultiSourceOptions): ChartInstance<unknown>
export function useChart<T, const TColumns extends readonly ChartColumn<T, string>[]>(
  options: UseChartOptions<T, TColumns>,
): ChartInstance<T, ColumnIdFromColumns<TColumns>> | ChartInstance<unknown> {
  if (options.sources && options.sources.length === 0) {
    throw new Error('useChart requires at least one source')
  }

  const sources = (options.sources ?? [
    {
      id: 'default',
      label: options.sourceLabel ?? 'Unnamed Source',
      data: options.data,
      columns: options.columns,
    },
  ]) as unknown as DataSource<T, ColumnIdFromColumns<TColumns>>[]
  const hasMultipleSources = sources.length > 1

  const [activeSourceId, setActiveSource] = useState(sources[0]?.id ?? 'default')
  const [chartType, setChartTypeRaw] = useState<ChartType>('bar')
  const [xAxisId, setXAxisRaw] = useState<ColumnIdFromColumns<TColumns> | null>(null)
  const [groupById, setGroupBy] = useState<ColumnIdFromColumns<TColumns> | null>(null)
  const [metric, setMetric] = useState<Metric<ColumnIdFromColumns<TColumns>>>(DEFAULT_METRIC)
  const [timeBucket, setTimeBucket] = useState<TimeBucket>(DEFAULT_TIME_BUCKET)
  const [filters, setFilters] = useState<FilterState<ColumnIdFromColumns<TColumns>>>(() => new Map())
  const [sorting, setSorting] = useState<SortConfig | null>(null)
  const [referenceDateIdRaw, setReferenceDateId] = useState<ColumnIdFromColumns<TColumns> | null>(
    null,
  )
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter | null>(null)

  const activeSource = sources.find((s) => s.id === activeSourceId) ?? sources[0]!
  const activeColumns: readonly ChartColumn<T, ColumnIdFromColumns<TColumns>>[] = activeSource.columns
  const rawData: readonly T[] = activeSource.data

  const dateColumns = useMemo(
    () =>
      activeColumns.filter(
        (
          column,
        ): column is DateColumn<T, ColumnIdFromColumns<TColumns>> => column.type === 'date',
      ),
    [activeColumns],
  )

  const availableDateColumns = useMemo(
    () => dateColumns.map((column) => ({id: column.id, label: column.label})),
    [dateColumns],
  )

  const resolvedXAxisId = useMemo(
    () => resolveXAxisId(xAxisId, activeColumns),
    [xAxisId, activeColumns],
  )
  const xColumn = activeColumns.find((column) => column.id === resolvedXAxisId) ?? null
  const resolvedXAxisType: ChartAxisType | null =
    xColumn && xColumn.type !== 'number' ? xColumn.type : null
  const isTimeSeries = resolvedXAxisType === 'date'
  const referenceDateId = useMemo(
    () => resolveReferenceDateId(referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries),
    [referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries],
  )

  const effectiveData: readonly T[] = useMemo(() => {
    const column = dateColumns.find((candidate) => candidate.id === referenceDateId)
    if (!column) return rawData

    if (dateRangeFilter === null) {
      return rawData
    }

    return filterByDateRange(rawData, column, dateRangeFilter)
  }, [rawData, dateRangeFilter, dateColumns, referenceDateId])

  const availableXAxes = useMemo(
    () =>
      activeColumns
        .filter((column) => column.type !== 'number')
        .map((column) => ({id: column.id, label: column.label, type: column.type})),
    [activeColumns],
  )

  const availableGroupBys = useMemo(
    () =>
      activeColumns
        .filter(
          (column) =>
            (column.type === 'category' || column.type === 'boolean') &&
            column.id !== resolvedXAxisId,
        )
        .map((column) => ({id: column.id, label: column.label})),
    [activeColumns, resolvedXAxisId],
  )

  const resolvedGroupById =
    groupById && availableGroupBys.some((column) => column.id === groupById) ? groupById : null
  const availableMetrics = useMemo(() => buildAvailableMetrics(activeColumns), [activeColumns])
  const resolvedMetric = useMemo(
    () => resolveMetric(metric, activeColumns),
    [metric, activeColumns],
  )
  const resolvedFilters = useMemo(
    () => sanitizeFilters(filters, activeColumns),
    [filters, activeColumns],
  )
  const availableChartTypes = useMemo(
    () =>
      getAvailableChartTypes({
        xAxisType: resolvedXAxisType,
        hasGroupBy: resolvedGroupById !== null,
      }),
    [resolvedGroupById, resolvedXAxisType],
  )

  const availableFilters = useMemo(
    () => extractAvailableFilters(effectiveData, activeColumns),
    [effectiveData, activeColumns],
  )

  const resolvedChartType = availableChartTypes.includes(chartType)
    ? chartType
    : (availableChartTypes[0] ?? 'bar')

  const pipelineResult = useMemo(() => {
    if (!resolvedXAxisId) return {data: [], series: [], groups: []}

    return runPipeline({
      data: effectiveData,
      columns: activeColumns,
      xAxisId: resolvedXAxisId,
      groupById: resolvedGroupById,
      metric: resolvedMetric,
      timeBucket,
      filters: resolvedFilters,
      sorting,
    })
  }, [
    effectiveData,
    activeColumns,
    resolvedXAxisId,
    resolvedGroupById,
    resolvedMetric,
    timeBucket,
    resolvedFilters,
    sorting,
  ])

  const dateRange: DateRange<ColumnIdFromColumns<TColumns>> | null = useMemo(() => {
    const column = dateColumns.find((candidate) => candidate.id === referenceDateId)
    if (!column) return null

    const filtered = applyFilters(effectiveData, activeColumns, resolvedFilters)
    const {min, max} = computeDateRange(filtered, column)
    return {columnId: column.id, label: column.label, min, max}
  }, [dateColumns, referenceDateId, effectiveData, activeColumns, resolvedFilters])

  const setChartType = (type: ChartType) => {
    if (availableChartTypes.includes(type)) {
      setChartTypeRaw(type)
    }
  }

  const setXAxis = (columnId: ColumnIdFromColumns<TColumns>) => {
    setXAxisRaw(columnId)
    if (resolvedGroupById === columnId) {
      setGroupBy(null)
    }
  }

  const toggleFilter = (columnId: ColumnIdFromColumns<TColumns>, value: string) => {
    setFilters((prev) => {
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

  const clearFilter = (columnId: ColumnIdFromColumns<TColumns>) => {
    setFilters((prev) => {
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
    sources: sources.map((s) => ({id: s.id, label: s.label})),
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
    recordCount: rawData.length,
  }
}
