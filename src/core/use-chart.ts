import { useMemo, useState } from 'react'
import { TIME_BUCKET_ORDER, resolveConfiguredIdSelection, resolveConfiguredValue, restrictConfiguredIdOptions, restrictConfiguredValues } from './config-utils.js'
import { CHART_TYPE_CONFIG, getAvailableChartTypes, type ChartAxisType } from './chart-capabilities.js'
import { computeDateRange, filterByDateRange } from './date-utils.js'
import { resolvePresetFilter, type DateRangePresetId } from './date-range-presets.js'
import { inferColumnsFromData } from './infer-columns.js'
import { buildAvailableMetrics, DEFAULT_METRIC, isSameMetric, resolveMetric, restrictAvailableMetrics } from './metric-utils.js'
import { applyFilters, extractAvailableFilters, runPipeline } from './pipeline.js'
import type {
  AvailableFilter,
  ChartColumn,
  ChartInstance,
  ChartInstanceFromSchema,
  ChartSchema,
  ChartType,
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

type RuntimeChartInstance = ChartInstance<any, string>

/**
 * Reapply the public overload return type after the hook has built a broad
 * runtime chart instance.
 *
 * The implementation must be able to execute for both single-source and
 * multi-source inputs, so React state is assembled once with broad internal
 * types and then narrowed back to the caller-facing contract at this boundary.
 */
function finalizeChartReturn<const TSources extends NonEmptyChartSourceOptions>(
  _options: {sources: TSources},
  chart: RuntimeChartInstance,
): MultiSourceChartInstance<TSources>
function finalizeChartReturn<
  T,
  const TSchema extends ChartSchema<T, any> | undefined = undefined,
>(
  _options: SingleSourceOptions<T, TSchema>,
  chart: RuntimeChartInstance,
): ChartInstanceFromSchema<T, TSchema>
function finalizeChartReturn(
  _options: SingleSourceOptions<any, any> | MultiSourceOptions,
  chart: RuntimeChartInstance,
): ChartInstanceFromSchema<any, any> | MultiSourceChartInstance<NonEmptyChartSourceOptions> {
  return chart as unknown as
    | ChartInstanceFromSchema<any, any>
    | MultiSourceChartInstance<NonEmptyChartSourceOptions>
}

/**
 * Build a lookup map of filterable values by column.
 */
function createAvailableFilterValueMap<TColumnId extends string>(
  availableFilters: readonly AvailableFilter<TColumnId>[],
): ReadonlyMap<TColumnId, ReadonlySet<string>> {
  return new Map(
    availableFilters.map(filter => [
      filter.columnId,
      new Set(filter.options.map(option => option.value)),
    ]),
  )
}

/**
 * Headless React hook that manages all chart configuration, state, and derived/transformed data for chart rendering.
 *
 * There are two major usage patterns:
 * - Single source: Provide plain `data` and optional `schema`.
 * - Multi-source: Provide a `sources` array, each having an `id`, `label`, `data`, and optional `schema`.
 *
 * @template T - The type of each data record in the dataset.
 * @template TSchema - Optional explicit schema for inferred single-source columns.
 * @param {SingleSourceOptions<T, TSchema> | MultiSourceOptions} options
 *   Chart configuration options. Should provide either:
 *   - `data`, optional `schema`, and (optionally) `sourceLabel` for a single source
 *   - or `sources` array for multiple sources
 *   Any explicit single-source or per-source schema should be created with
 *   `defineChartSchema<Row>()(...)` so the schema shape stays exact and strongly typed.
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
 *   - `timeBucket`, `setTimeBucket`, `availableTimeBuckets`: Date/time bucketing state, setter, and options
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
    schema?: never
    sourceLabel?: never
    sources: TSources
  }
): MultiSourceChartInstance<TSources>
export function useChart<
  T,
  const TSchema extends ChartSchema<T, any> | undefined = undefined,
>(
  options: SingleSourceOptions<T, TSchema>
): ChartInstanceFromSchema<T, TSchema>
export function useChart<
  T,
  const TSchema extends ChartSchema<T, any> | undefined = undefined,
>(
  options: SingleSourceOptions<T, TSchema> | MultiSourceOptions
): ChartInstanceFromSchema<T, TSchema> | MultiSourceChartInstance<NonEmptyChartSourceOptions> {
  if ('sources' in options && options.sources?.length === 0) {
    throw new Error('useChart requires at least one source')
  }

  const sources = useMemo<ResolvedChartSource<any, string>[]>(() => {
    if ('sources' in options && options.sources) {
      return options.sources.map(source => ({
        id: source.id,
        label: source.label,
        data: source.data,
        columns: inferColumnsFromData(source.data, source.schema),
        schema: source.schema,
      }))
    }

    return [
      {
        id: 'default',
        label: options.sourceLabel ?? 'Unnamed Source',
        data: options.data,
        columns: inferColumnsFromData(options.data, options.schema),
        schema: options.schema,
      },
    ]
  }, [options])
  const hasMultipleSources = sources.length > 1

  const [activeSourceIdRaw, setActiveSourceRaw] = useState(sources[0]?.id ?? 'default')
  const [chartType, setChartTypeRaw] = useState<ChartType>('bar')
  const [xAxisId, setXAxisRaw] = useState<string | null>(null)
  const [groupById, setGroupByRaw] = useState<string | null>(null)
  const [metric, setMetricRaw] = useState<Metric<string>>(DEFAULT_METRIC)
  const [timeBucket, setTimeBucketRaw] = useState<TimeBucket>(DEFAULT_TIME_BUCKET)
  const [filters, setFilters] = useState<FilterState<string>>(() => new Map())
  const [sorting, setSorting] = useState<SortConfig | null>(null)
  const [referenceDateIdRaw, setReferenceDateIdRaw] = useState<string | null>(null)
  const [dateRangePreset, setDateRangePresetRaw] = useState<DateRangePresetId | null>('all-time')
  const [customDateRangeFilter, setCustomDateRangeFilter] = useState<DateRangeFilter | null>(null)

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
  const availableDateColumnIds = useMemo(
    () => new Set(availableDateColumns.map(option => option.id)),
    [availableDateColumns]
  )

  const availableXAxes = useMemo(
    () => restrictConfiguredIdOptions(
      activeColumns
        .filter(column => column.type !== 'number')
        .map(column => ({ id: column.id, label: column.label, type: column.type })),
      activeSource.schema?.xAxis as any,
      true
    ),
    [activeColumns, activeSource.schema]
  )
  const availableXAxisIds = useMemo(() => new Set(availableXAxes.map(option => option.id)), [availableXAxes])
  const resolvedXAxisId = useMemo(
    () => resolveConfiguredIdSelection(
      xAxisId,
      availableXAxes,
      activeSource.schema?.xAxis?.default as any,
      resolveXAxisId(null, activeColumns)
    ),
    [xAxisId, availableXAxes, activeSource.schema, activeColumns]
  )
  const xColumn = activeColumns.find(column => column.id === resolvedXAxisId) ?? null
  const resolvedXAxisType: ChartAxisType | null = xColumn && xColumn.type !== 'number' ? xColumn.type : null
  const isTimeSeries = resolvedXAxisType === 'date'
  const referenceDateId = useMemo(
    () => resolveReferenceDateId(referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries),
    [referenceDateIdRaw, dateColumns, resolvedXAxisId, isTimeSeries]
  )

  const availableGroupBys = useMemo(
    () =>
      restrictConfiguredIdOptions(
        activeColumns
          .filter(column => (column.type === 'category' || column.type === 'boolean') && column.id !== resolvedXAxisId)
          .map(column => ({ id: column.id, label: column.label })),
        activeSource.schema?.groupBy as any
      ),
    [activeColumns, activeSource.schema, resolvedXAxisId]
  )
  const availableGroupByIds = useMemo(() => new Set(availableGroupBys.map(option => option.id)), [availableGroupBys])
  const resolvedGroupById = useMemo(
    () => resolveConfiguredIdSelection(groupById, availableGroupBys, activeSource.schema?.groupBy?.default as any, null, false),
    [groupById, availableGroupBys, activeSource.schema]
  )
  const availableMetrics = useMemo(
    () => restrictAvailableMetrics(buildAvailableMetrics(activeColumns), activeSource.schema?.metric as any),
    [activeColumns, activeSource.schema]
  )
  const isMetricSelectable = (candidate: Metric<string>) => availableMetrics.some(metricOption => isSameMetric(metricOption, candidate))
  const resolvedMetric = useMemo(
    () => resolveMetric(metric, activeColumns, availableMetrics, activeSource.schema?.metric?.default as any),
    [metric, activeColumns, availableMetrics, activeSource.schema]
  )
  const availableChartTypes = useMemo(
    () => restrictConfiguredValues(
      getAvailableChartTypes({
        xAxisType: resolvedXAxisType,
        hasGroupBy: resolvedGroupById !== null
      }),
      activeSource.schema?.chartType as any,
      true
    ),
    [resolvedGroupById, resolvedXAxisType, activeSource.schema]
  )
  const resolvedChartType = useMemo(
    () => resolveConfiguredValue(chartType, availableChartTypes, activeSource.schema?.chartType?.default as any),
    [chartType, availableChartTypes, activeSource.schema]
  )
  const availableTimeBuckets = useMemo(
    () => {
      const baseBuckets = isTimeSeries && resolvedXAxisType !== null && CHART_TYPE_CONFIG[resolvedChartType as ChartType].supportsTimeBucketing
        ? TIME_BUCKET_ORDER
        : []

      return restrictConfiguredValues(baseBuckets, activeSource.schema?.timeBucket as any, true)
    },
    [isTimeSeries, resolvedXAxisType, resolvedChartType, activeSource.schema]
  )
  const resolvedTimeBucket = useMemo(
    () => resolveConfiguredValue(timeBucket, availableTimeBuckets, activeSource.schema?.timeBucket?.default as any),
    [timeBucket, availableTimeBuckets, activeSource.schema]
  )

  // Derive the effective date range filter from the active preset or custom range.
  // When a preset is active, the filter is computed from the preset definition.
  // The 'auto' preset reacts to time bucket changes automatically.
  const dateRangeFilter: DateRangeFilter | null = useMemo(() => {
    if (dateRangePreset !== null) {
      return resolvePresetFilter(dateRangePreset, resolvedTimeBucket)
    }
    return customDateRangeFilter
  }, [dateRangePreset, customDateRangeFilter, resolvedTimeBucket])

  const effectiveData: readonly T[] = useMemo(() => {
    const column = dateColumns.find(candidate => candidate.id === referenceDateId)
    if (!column) return rawData

    if (dateRangeFilter === null) {
      return rawData
    }

    return filterByDateRange(rawData, column, dateRangeFilter)
  }, [rawData, dateRangeFilter, dateColumns, referenceDateId])

  const availableFilters = useMemo(
    () => {
      const extractedFilters = extractAvailableFilters(effectiveData, activeColumns)
      const selectableFilters = extractedFilters.map(filter => ({
        ...filter,
        id: filter.columnId,
      }))

      return restrictConfiguredIdOptions(selectableFilters, activeSource.schema?.filters as any).map(({id: _id, ...filter}) => filter)
    },
    [effectiveData, activeColumns, activeSource.schema]
  )
  const availableFilterValues = useMemo(
    () => createAvailableFilterValueMap(availableFilters),
    [availableFilters]
  )
  const filterColumns = useMemo(
    () => activeColumns.filter(column => availableFilters.some(filter => filter.columnId === column.id)),
    [activeColumns, availableFilters]
  )
  const resolvedFilters = useMemo(() => sanitizeFilters(filters, filterColumns), [filters, filterColumns])

  const pipelineResult = useMemo(() => {
    if (!resolvedXAxisId) return { data: [], series: [], groups: [] }

    return runPipeline({
      data: effectiveData,
      columns: activeColumns,
      xAxisId: resolvedXAxisId,
      groupById: resolvedGroupById,
      metric: resolvedMetric,
      timeBucket: resolvedTimeBucket,
      filters: resolvedFilters,
      sorting
    })
  }, [effectiveData, activeColumns, resolvedXAxisId, resolvedGroupById, resolvedMetric, resolvedTimeBucket, resolvedFilters, sorting])

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
    if (!availableXAxisIds.has(columnId)) {
      return
    }

    setXAxisRaw(columnId)
    if (resolvedGroupById === columnId) {
      setGroupByRaw(null)
    }
  }
  const setGroupBy = (columnId: string | null) => {
    if (columnId === null) {
      setGroupByRaw(null)
      return
    }

    if (!availableGroupByIds.has(columnId)) {
      return
    }

    setGroupByRaw(columnId)
  }
  const setMetric = (nextMetric: Metric<string>) => {
    if (!isMetricSelectable(nextMetric)) {
      return
    }

    setMetricRaw(nextMetric)
  }
  const setTimeBucket = (nextTimeBucket: TimeBucket) => {
    if (!availableTimeBuckets.includes(nextTimeBucket)) {
      return
    }

    setTimeBucketRaw(nextTimeBucket)
  }

  const toggleFilter = (columnId: string, value: string) => {
    const availableValues = availableFilterValues.get(columnId)
    if (!availableValues?.has(value)) {
      return
    }

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
    if (!availableFilterValues.has(columnId)) {
      return
    }

    setFilters(prev => {
      const next = new Map(prev)
      next.delete(columnId)
      return next
    })
  }

  const clearAllFilters = () => {
    setFilters(new Map())
  }
  const setReferenceDateId = (columnId: string) => {
    if (!availableDateColumnIds.has(columnId)) {
      return
    }

    setReferenceDateIdRaw(columnId)
  }

  const setDateRangePreset = (preset: DateRangePresetId) => {
    setDateRangePresetRaw(preset)
  }

  const setDateRangeFilter = (filter: DateRangeFilter | null) => {
    // Direct filter sets clear the active preset (entering custom mode).
    // Passing null is equivalent to clearing the custom range (all time).
    if (filter === null) {
      setDateRangePresetRaw('all-time')
      setCustomDateRangeFilter(null)
    } else {
      setDateRangePresetRaw(null)
      setCustomDateRangeFilter(filter)
    }
  }

  const chart: RuntimeChartInstance = {
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
    timeBucket: resolvedTimeBucket,
    setTimeBucket,
    availableTimeBuckets,
    isTimeSeries,
    connectNulls: activeSource.schema?.connectNulls ?? true,
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
    dateRangePreset,
    setDateRangePreset,
    dateRangeFilter,
    setDateRangeFilter,
    transformedData: pipelineResult.data,
    series: pipelineResult.series,
    columns: activeColumns,
    rawData,
    recordCount: rawData.length
  }

  if ('sources' in options && options.sources) {
    return finalizeChartReturn(options, chart)
  }

  return finalizeChartReturn(options, chart)
}
