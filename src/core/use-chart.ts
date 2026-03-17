import { useMemo, useState } from 'react'
import { TIME_BUCKET_ORDER, resolveConfiguredIdSelection, resolveConfiguredValue, restrictConfiguredIdOptions, restrictConfiguredValues } from './config-utils.js'
import { CHART_TYPE_CONFIG, getAvailableChartTypes, type ChartAxisType } from './chart-capabilities.js'
import { computeDateRange, filterByDateRange } from './date-utils.js'
import { resolvePresetFilter, type DateRangePresetId } from './date-range-presets.js'
import { inferColumnsFromData } from './infer-columns.js'
import { buildAvailableMetrics, isSameMetric, resolveMetric, restrictAvailableMetrics } from './metric-utils.js'
import { applyFilters, computeFilteredCounts, extractAvailableFilters, runPipeline } from './pipeline.js'
import { resolveChartSchemaDefinition } from './schema-builder.js'
import type {
  AvailableFilter,
  ChartColumn,
  ChartDataScopeControlState,
  ChartDateRangeSelection,
  ChartInstance,
  ChartInstanceFromSchemaDefinition,
  ChartSchemaDefinition,
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
import { cloneFilterState, resolveReferenceDateId, resolveXAxisId, sanitizeFilters } from './use-chart-resolvers.js'

type RuntimeChartInstance = ChartInstance<any, string>

function hasOwn<TObject extends object, TKey extends PropertyKey>(
  value: TObject | undefined,
  key: TKey,
): value is TObject & Record<TKey, unknown> {
  return value !== undefined && Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeDateRangeSelection(
  selection: ChartDateRangeSelection,
): ChartDateRangeSelection {
  return {
    preset: selection.preset,
    customFilter: selection.customFilter,
  }
}

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
  const TSchema extends ChartSchemaDefinition<T, any> | undefined = undefined,
>(
  _options: SingleSourceOptions<T, TSchema>,
  chart: RuntimeChartInstance,
): ChartInstanceFromSchemaDefinition<T, TSchema>
function finalizeChartReturn(
  _options: SingleSourceOptions<any, any> | {sources: NonEmptyChartSourceOptions},
  chart: RuntimeChartInstance,
): unknown {
  return chart as unknown as
    | ChartInstanceFromSchemaDefinition<any, any>
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
 * Headless React hook that manages one chart's configuration, state, and
 * derived/transformed data for rendering.
 *
 * The stable primary path is single-source:
 * - `useChart({data})` for zero-config inference
 * - `useChart({data, schema})` when one chart needs an explicit contract
 *
 * Multi-source `sources` support exists for source-switching between
 * interchangeable datasets, but it is intentionally separate from the
 * single-chart schema contract and is not dashboard composition.
 *
 * @template T - The type of each data record in the dataset.
 * @template TSchema - Optional explicit schema for inferred single-source columns.
 * @param {SingleSourceOptions<T, TSchema> | MultiSourceOptions} options
 *   Chart configuration options. Should provide either:
 *   - `data`, optional `schema`, and (optionally) `sourceLabel` for a single source
 *   - or `sources` array for multiple sources
 *   - and optional `inputs` when filters/reference-date/date-range state is
 *     driven externally
 *   Any explicit single-source or per-source schema is usually authored with
 *   either `defineChartSchema<Row>()...` or `defineDataset<Row>().chart(...)`.
 *   Builders can be passed directly; plain schema objects are also accepted.
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
 *   - `dataScopeControl`: Which data-scope slices are controlled externally
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
  options: MultiSourceOptions<TSources>
): MultiSourceChartInstance<TSources>
export function useChart<
  T,
  const TSchema extends ChartSchemaDefinition<T, any> | undefined = undefined,
>(
  options: SingleSourceOptions<T, TSchema>
): ChartInstanceFromSchemaDefinition<T, TSchema>
export function useChart(
  options: SingleSourceOptions<any, any> | MultiSourceOptions<NonEmptyChartSourceOptions>
): unknown {
  if ('sources' in options && options.sources?.length === 0) {
    throw new Error('useChart requires at least one source')
  }

  const sourceOptions = 'sources' in options ? options.sources : undefined
  const singleSourceData = 'data' in options ? options.data : undefined
  const singleSourceSchema = 'schema' in options ? options.schema : undefined
  const singleSourceLabel = 'sourceLabel' in options ? options.sourceLabel : undefined

  const sources = useMemo<ResolvedChartSource<any, string>[]>(() => {
    if (sourceOptions) {
      return sourceOptions.map(source => {
        const schema = resolveChartSchemaDefinition(source.schema)

        return {
          id: source.id,
          label: source.label,
          data: source.data,
          columns: inferColumnsFromData(source.data, schema),
          schema,
        }
      })
    }

    const schema = resolveChartSchemaDefinition(singleSourceSchema)

    return [
      {
        id: 'default',
        label: singleSourceLabel ?? 'Unnamed Source',
        data: singleSourceData as readonly any[],
        columns: inferColumnsFromData(singleSourceData as readonly any[], schema),
        schema,
      },
    ]
  }, [singleSourceData, singleSourceLabel, singleSourceSchema, sourceOptions])
  const hasMultipleSources = sources.length > 1

  const [activeSourceIdRaw, setActiveSourceRaw] = useState(sources[0]?.id ?? 'default')
  const [chartType, setChartTypeRaw] = useState<ChartType | null>(null)
  const [xAxisId, setXAxisRaw] = useState<string | null>(null)
  const [groupById, setGroupByRaw] = useState<string | null>(null)
  const [metric, setMetricRaw] = useState<Metric<string> | null>(null)
  const [timeBucket, setTimeBucketRaw] = useState<TimeBucket | null>(null)
  const [filtersState, setFiltersState] = useState<FilterState<string>>(() => new Map())
  const [sorting, setSorting] = useState<SortConfig | null>(null)
  const [referenceDateIdState, setReferenceDateIdState] = useState<string | null>(null)
  const [dateRangePresetState, setDateRangePresetState] = useState<DateRangePresetId | null>('all-time')
  const [customDateRangeFilterState, setCustomDateRangeFilterState] = useState<DateRangeFilter | null>(null)

  const inputState = options.inputs
  const isFiltersControlled = inputState?.filters !== undefined
  const isReferenceDateControlled = hasOwn(inputState, 'referenceDateId')
  const isDateRangeControlled = inputState?.dateRange !== undefined
  const onFiltersChange = inputState?.onFiltersChange as ((filters: FilterState<string>) => void) | undefined
  const onReferenceDateIdChange = inputState?.onReferenceDateIdChange as ((columnId: string | null) => void) | undefined
  const onDateRangeChange = inputState?.onDateRangeChange as ((selection: ChartDateRangeSelection) => void) | undefined

  const requestedFilters = useMemo(
    () => (isFiltersControlled ? cloneFilterState(inputState.filters as FilterState<string>) : filtersState),
    [filtersState, inputState?.filters, isFiltersControlled],
  )
  const requestedReferenceDateId = isReferenceDateControlled
    ? (inputState.referenceDateId as string | null | undefined) ?? null
    : referenceDateIdState
  const requestedDateRangeSelection = useMemo(
    () =>
      isDateRangeControlled
        ? normalizeDateRangeSelection(inputState.dateRange as ChartDateRangeSelection)
        : {
            preset: dateRangePresetState,
            customFilter: customDateRangeFilterState,
          },
    [customDateRangeFilterState, dateRangePresetState, inputState?.dateRange, isDateRangeControlled],
  )
  const dateRangePreset = requestedDateRangeSelection.preset
  const customDateRangeFilter = requestedDateRangeSelection.customFilter
  const dataScopeControl: ChartDataScopeControlState = {
    filters: isFiltersControlled ? 'controlled' : 'uncontrolled',
    referenceDateId: isReferenceDateControlled ? 'controlled' : 'uncontrolled',
    dateRange: isDateRangeControlled ? 'controlled' : 'uncontrolled',
  }

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
    () => resolveReferenceDateId(requestedReferenceDateId, dateColumns, resolvedXAxisId, isTimeSeries),
    [requestedReferenceDateId, dateColumns, resolvedXAxisId, isTimeSeries]
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
    () => resolveConfiguredValue(chartType, availableChartTypes, activeSource.schema?.chartType?.default as any, 'bar'),
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
    () => resolveConfiguredValue(timeBucket, availableTimeBuckets, activeSource.schema?.timeBucket?.default as any, DEFAULT_TIME_BUCKET),
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

  const effectiveData = useMemo(() => {
    const column = dateColumns.find(candidate => candidate.id === referenceDateId)
    if (!column) return rawData

    if (dateRangeFilter === null) {
      return rawData
    }

    return filterByDateRange(rawData, column, dateRangeFilter)
  }, [rawData, dateRangeFilter, dateColumns, referenceDateId])

  const baseAvailableFilters = useMemo(
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
  // Build toggleable filter values from the full raw data so that values
  // excluded by the date-range filter can still be selected. The UI counts
  // (availableFilters) use effectiveData for relevance, but the toggle guard
  // must accept any value present in the unfiltered dataset.
  const toggleableFilterValues = useMemo(
    () => {
      if (rawData === effectiveData) {
        return createAvailableFilterValueMap(baseAvailableFilters)
      }

      const rawFilters = extractAvailableFilters(rawData, activeColumns)
      const selectableRawFilters = rawFilters.map(filter => ({
        ...filter,
        id: filter.columnId,
      }))

      const restrictedRawFilters = restrictConfiguredIdOptions(selectableRawFilters, activeSource.schema?.filters as any)
        .map(({id: _id, ...filter}) => filter)

      return createAvailableFilterValueMap(restrictedRawFilters)
    },
    [rawData, effectiveData, baseAvailableFilters, activeColumns, activeSource.schema]
  )
  const filterColumns = useMemo(
    () => activeColumns.filter(column => baseAvailableFilters.some(filter => filter.columnId === column.id)),
    [activeColumns, baseAvailableFilters]
  )
  const filterColumnIds = useMemo(() => new Set(filterColumns.map((column) => column.id)), [filterColumns])
  const resolvedFilters = useMemo(
    () => sanitizeFilters(requestedFilters, filterColumns, toggleableFilterValues),
    [requestedFilters, filterColumns, toggleableFilterValues],
  )

  // Cross-filtered counts: for each column, counts reflect filters on all *other* columns
  const availableFilters = useMemo(
    () => computeFilteredCounts(baseAvailableFilters, effectiveData, activeColumns, resolvedFilters),
    [baseAvailableFilters, effectiveData, activeColumns, resolvedFilters]
  )

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

  const commitFilters = (
    updater: (previous: FilterState<string>) => FilterState<string>,
  ) => {
    if (isFiltersControlled) {
      const next = cloneFilterState(updater(requestedFilters))
      onFiltersChange?.(next)
      return
    }

    let next: FilterState<string> | null = null
    setFiltersState((previous) => {
      next = cloneFilterState(updater(previous))
      return next
    })

    if (next) {
      onFiltersChange?.(cloneFilterState(next))
    }
  }

  const commitReferenceDateId = (nextReferenceDateId: string | null) => {
    if (!isReferenceDateControlled) {
      setReferenceDateIdState(nextReferenceDateId)
    }

    onReferenceDateIdChange?.(nextReferenceDateId)
  }

  const commitDateRangeSelection = (
    nextSelection: ChartDateRangeSelection,
  ) => {
    const normalized = normalizeDateRangeSelection(nextSelection)

    if (!isDateRangeControlled) {
      setDateRangePresetState(normalized.preset)
      setCustomDateRangeFilterState(normalized.customFilter)
    }

    onDateRangeChange?.(normalized)
  }

  const toggleFilter = (columnId: string, value: string) => {
    const availableValues = toggleableFilterValues.get(columnId)
    if (!availableValues?.has(value)) {
      return
    }

    commitFilters((previous) => {
      const next = cloneFilterState(previous)
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
    if (!filterColumnIds.has(columnId)) {
      return
    }

    commitFilters((previous) => {
      const next = cloneFilterState(previous)
      next.delete(columnId)
      return next
    })
  }

  const clearAllFilters = () => {
    commitFilters(() => new Map())
  }
  const setReferenceDateId = (columnId: string) => {
    if (!availableDateColumnIds.has(columnId)) {
      return
    }

    commitReferenceDateId(columnId)
  }

  const setDateRangePreset = (preset: DateRangePresetId) => {
    commitDateRangeSelection({
      preset,
      customFilter: requestedDateRangeSelection.customFilter,
    })
  }

  const setDateRangeFilter = (filter: DateRangeFilter | null) => {
    // Direct filter sets clear the active preset (entering custom mode).
    // Passing null is equivalent to clearing the custom range (all time).
    if (filter === null) {
      commitDateRangeSelection({preset: 'all-time', customFilter: null})
    } else {
      commitDateRangeSelection({preset: null, customFilter: filter})
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
    dataScopeControl,
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
