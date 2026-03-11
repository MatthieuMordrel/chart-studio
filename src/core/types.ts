/**
 * Core types for chart-studio.
 *
 * The type system is built around two concepts:
 * 1. **Columns** describe the shape of your data (date, category, boolean, number)
 * 2. **Chart state** tracks what the user has selected (chart type, groupBy, filters, etc.)
 *
 * Column types determine what operations are available:
 * - `date`     → X-axis candidate, time bucketing (day/week/month/quarter/year)
 * - `category` → X-axis candidate, groupBy candidate, multi-select filter
 * - `boolean`  → groupBy candidate, toggle filter
 * - `number`   → metric/aggregation (count, sum, avg, min, max)
 */

// ---------------------------------------------------------------------------
// Inference and column definitions
// ---------------------------------------------------------------------------

type Nullish = null | undefined

/** Primitive field values that chart-studio can infer directly from raw data. */
export type InferableColumnValue = string | number | boolean | Date | Nullish

/** Top-level dataset keys whose values can be charted without a custom accessor. */
export type InferableFieldKey<T> = Extract<
  {
    [TKey in keyof T]-?: Exclude<T[TKey], Nullish> extends InferableColumnValue ? TKey : never
  }[keyof T],
  string
>

/** Display formatter presets supported by inferred and manual columns. */
export type ColumnFormatPreset =
  | 'number'
  | 'compact-number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'

/** Column kinds understood by the chart pipeline. */
export type ChartColumnType = 'date' | 'category' | 'boolean' | 'number'

/** Confidence attached to runtime field inference. */
export type InferenceConfidence = 'low' | 'medium' | 'high'

/** Debug metadata describing how a column was inferred. */
export type ColumnInferenceMetadata = {
  detectedType: ChartColumnType
  confidence: InferenceConfidence
  hinted: boolean
}

/** Shared hint options supported by every inferred field. */
type BaseColumnHint<T, TValue> = {
  /** Override the humanized field key used by default in the UI. */
  label?: string
  /** Apply a reusable formatter preset in chart UI. */
  format?: ColumnFormatPreset
  /** Format values with full control per field. */
  formatter?: (value: TValue | null | undefined, item: T) => string
}

/** Override options for string-like fields. */
export type StringColumnHint<T> = BaseColumnHint<T, string> & {
  type?: 'category' | 'date'
}

/** Override options for numeric fields. */
export type NumberColumnHint<T> = BaseColumnHint<T, number> & {
  type?: 'number' | 'date'
}

/** Override options for boolean fields. */
export type BooleanColumnHint<T> = BaseColumnHint<T, boolean> & {
  type?: 'boolean'
  trueLabel?: string
  falseLabel?: string
}

/** Override options for Date-valued fields. */
export type DateValueColumnHint<T> = BaseColumnHint<T, string | number | Date> & {
  type?: 'date'
}

/** Override options for mixed primitive fields when runtime values need the final say. */
export type MixedPrimitiveColumnHint<T, TValue> = BaseColumnHint<T, TValue> & {
  type?: ChartColumnType
  trueLabel?: string
  falseLabel?: string
}

/** Type-safe override options for one inferable field. */
export type ColumnHintFor<TValue, T> =
  [Exclude<TValue, Nullish>] extends [boolean] ? BooleanColumnHint<T>
  : [Exclude<TValue, Nullish>] extends [Date] ? DateValueColumnHint<T>
  : [Exclude<TValue, Nullish>] extends [number] ? NumberColumnHint<T>
  : [Exclude<TValue, Nullish>] extends [string] ? StringColumnHint<T>
  : MixedPrimitiveColumnHint<T, Exclude<TValue, Nullish>>

/** Partial per-field overrides layered on top of automatic inference. */
export type ColumnHints<T> = Partial<{
  [TKey in InferableFieldKey<T>]: ColumnHintFor<T[TKey], T> | false
}>

type ExcludedHintKeys<THints> = Extract<
  {
    [TKey in keyof THints]-?: THints[TKey] extends false ? TKey : never
  }[keyof THints],
  string
>

/** Column ID union after removing any fields explicitly disabled by hints. */
export type ResolvedColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = Exclude<InferableFieldKey<T>, THints extends ColumnHints<T> ? ExcludedHintKeys<THints> : never>

/** Base properties shared by all column types. */
type ColumnBase<T, TId extends string> = {
  /** Unique identifier — typically the field key in the data object. */
  id: TId
  /** Human-readable label for the UI. */
  label: string
  /** Optional display formatter preset used by the UI layer. */
  format?: ColumnFormatPreset
  /** Optional per-value formatter used by the UI layer. */
  formatter?: (value: unknown, item: T) => string
  /** Optional debug metadata describing how the column was inferred. */
  inference?: ColumnInferenceMetadata
}

/**
 * A date column — eligible as a time-series X-axis.
 *
 * @property accessor - Extracts a date value from a data item
 */
export type DateColumn<T, TId extends string = string> = ColumnBase<T, TId> & {
  type: 'date'
  accessor: (item: T) => string | number | Date | null | undefined
}

/**
 * A category column — eligible for X-axis, groupBy, and filtering.
 *
 * @property accessor - Extracts a string category value from a data item
 */
export type CategoryColumn<T, TId extends string = string> = ColumnBase<T, TId> & {
  type: 'category'
  accessor: (item: T) => string | null | undefined
}

/**
 * A boolean column — eligible for groupBy (2 groups) and toggle filtering.
 *
 * @property accessor - Extracts a boolean value from a data item
 * @property trueLabel - Label for the `true` group (e.g. "Open")
 * @property falseLabel - Label for the `false` group (e.g. "Closed")
 */
export type BooleanColumn<T, TId extends string = string> = ColumnBase<T, TId> & {
  type: 'boolean'
  accessor: (item: T) => boolean | null | undefined
  trueLabel: string
  falseLabel: string
}

/**
 * A number column — eligible as a metric for aggregation.
 *
 * @property accessor - Extracts a numeric value from a data item
 */
export type NumberColumn<T, TId extends string = string> = ColumnBase<T, TId> & {
  type: 'number'
  accessor: (item: T) => number | null | undefined
}

/** Union of all column types. */
export type ChartColumn<T, TId extends string = string> =
  | DateColumn<T, TId>
  | CategoryColumn<T, TId>
  | BooleanColumn<T, TId>
  | NumberColumn<T, TId>

/** Extract the union of IDs from a readonly column tuple. */
export type ColumnIdFromColumns<TColumns extends readonly ChartColumn<any, string>[]> =
  TColumns[number]['id']

// ---------------------------------------------------------------------------
// Chart type
// ---------------------------------------------------------------------------

/** Chart types available for time-series (date X-axis). */
export type TimeSeriesChartType = 'bar' | 'line' | 'area'

/** Chart types available for categorical (category/boolean X-axis). */
export type CategoricalChartType = 'bar' | 'pie' | 'donut'

/** All supported chart types. */
export type ChartType = TimeSeriesChartType | CategoricalChartType

// ---------------------------------------------------------------------------
// Time bucketing
// ---------------------------------------------------------------------------

/** Time bucket sizes for date X-axis. */
export type TimeBucket = 'day' | 'week' | 'month' | 'quarter' | 'year'

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Aggregation functions for the Y-axis metric. */
export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

/** Numeric aggregation functions that operate on number columns. */
export type NumericAggregateFunction = Exclude<AggregateFunction, 'count'>

/**
 * A metric definition — what the Y-axis measures.
 *
 * `count` represents item count.
 * `aggregate` represents a numeric column aggregation.
 */
export type CountMetric = {
  kind: 'count'
}

/**
 * A numeric aggregation metric.
 *
 * @property columnId - The number column to aggregate
 * @property aggregate - The numeric aggregation function to apply
 * @property includeZeros - Whether zero values are included in aggregation
 */
export type AggregateMetric<TColumnId extends string = string> = {
  kind: 'aggregate'
  columnId: TColumnId
  aggregate: NumericAggregateFunction
  includeZeros?: boolean
}

/** Metric union returned by the chart hook. */
export type Metric<TColumnId extends string = string> = CountMetric | AggregateMetric<TColumnId>

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/**
 * Active filter state per column.
 * - For category columns: Set of selected values (empty = no filter = show all)
 * - For boolean columns: true/false/null (null = no filter)
 */
export type FilterState<TColumnId extends string = string> = Map<TColumnId, Set<string>>

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'

/**
 * Sort configuration.
 *
 * @property key - The data key to sort by (e.g. "count", a group label)
 * @property direction - Sort direction
 */
export type SortConfig = {
  key: string
  direction: SortDirection
}

// ---------------------------------------------------------------------------
// Data source
// ---------------------------------------------------------------------------

/**
 * A named data source for multi-source charts.
 *
 * @property id - Unique identifier for this source
 * @property label - Display label in the source switcher
 * @property data - Array of raw data items
 * @property columns - Column definitions for this source
 */
export type DataSource<T, TColumnId extends string = string> = {
  id: string
  label: string
  data: readonly T[]
  columns: readonly ChartColumn<T, TColumnId>[]
}

// ---------------------------------------------------------------------------
// Chart state (returned by useChart)
// ---------------------------------------------------------------------------

/**
 * A single series to render in the chart.
 *
 * @property dataKey - Key in the transformed data row
 * @property label - Display label for tooltips/legend
 * @property color - CSS color value (shadcn chart variable)
 */
export type ChartSeries = {
  dataKey: string
  label: string
  color: string
}

/**
 * A single data point in the transformed output.
 * Keys are dynamic based on groupBy values.
 */
export type TransformedDataPoint = Record<string, string | number>

/**
 * Available filter options extracted from the data for a column.
 *
 * @property columnId - The column this filter belongs to
 * @property label - Column label
 * @property type - Column type (category or boolean)
 * @property options - Available values with counts
 */
export type AvailableFilter<TColumnId extends string = string> = {
  columnId: TColumnId
  label: string
  type: 'category' | 'boolean'
  options: Array<{value: string; label: string; count: number}>
}

/**
 * Date range for a date column computed from the (filtered) data.
 *
 * @property columnId - The date column this range belongs to
 * @property label - Column display label
 * @property min - Earliest date in the data (null if no valid dates)
 * @property max - Latest date in the data (null if no valid dates)
 */
export type DateRange<TColumnId extends string = string> = {
  columnId: TColumnId
  label: string
  min: Date | null
  max: Date | null
}

/**
 * User-selected date range filter applied to the reference date column.
 * Both bounds are inclusive. Null = no bound on that side.
 *
 * @property from - Start date (inclusive), null = no lower bound
 * @property to - End date (inclusive), null = no upper bound
 */
export type DateRangeFilter = {
  from: Date | null
  to: Date | null
}

/**
 * Full chart state returned by the useChart hook.
 * Contains both controlled state and derived computations.
 */
export type ChartInstance<T, TColumnId extends string = string> = {
  // -- Source --
  /** Active source ID (only relevant for multi-source). */
  activeSourceId: string
  /** Switch to a different data source. */
  setActiveSource: (sourceId: string) => void
  /** Whether multiple sources are available. */
  hasMultipleSources: boolean
  /** Labels for all available sources. */
  sources: Array<{id: string; label: string}>

  // -- Chart type --
  /** Current chart type. */
  chartType: ChartType
  /** Change the chart type. */
  setChartType: (type: ChartType) => void
  /** Chart types available given the current X-axis. */
  availableChartTypes: ChartType[]

  // -- X-axis --
  /** Current X-axis column ID. */
  xAxisId: TColumnId | null
  /** Change the X-axis column. */
  setXAxis: (columnId: TColumnId) => void
  /** Columns eligible for X-axis (date + category). */
  availableXAxes: Array<{id: TColumnId; label: string; type: 'date' | 'category' | 'boolean'}>

  // -- Group by --
  /** Current groupBy column ID (null = no grouping). */
  groupById: TColumnId | null
  /** Change the groupBy column. */
  setGroupBy: (columnId: TColumnId | null) => void
  /** Columns eligible for groupBy (category + boolean, excluding current X-axis). */
  availableGroupBys: Array<{id: TColumnId; label: string}>

  // -- Metric --
  /** Current metric (what the Y-axis measures). */
  metric: Metric<TColumnId>
  /** Change the metric. */
  setMetric: (metric: Metric<TColumnId>) => void
  /** Available metrics (count + one per number column with sum/avg/min/max). */
  availableMetrics: Metric<TColumnId>[]

  // -- Time bucket --
  /** Current time bucket (only relevant when X-axis is date). */
  timeBucket: TimeBucket
  /** Change the time bucket. */
  setTimeBucket: (bucket: TimeBucket) => void
  /** Whether time bucketing controls should be shown. */
  isTimeSeries: boolean

  // -- Filters --
  /** Active filter values per column. */
  filters: FilterState<TColumnId>
  /** Toggle a specific filter value on/off for a column. */
  toggleFilter: (columnId: TColumnId, value: string) => void
  /** Clear all filters for a column. */
  clearFilter: (columnId: TColumnId) => void
  /** Clear all filters. */
  clearAllFilters: () => void
  /** Available filter options extracted from the data. */
  availableFilters: AvailableFilter<TColumnId>[]

  // -- Sorting --
  /** Current sort configuration (null = default order). */
  sorting: SortConfig | null
  /** Change sorting. */
  setSorting: (sorting: SortConfig | null) => void

  // -- Date range --
  /** Date range for the active reference date column (computed from filtered data). */
  dateRange: DateRange<TColumnId> | null
  /** Which date column provides the visible date range context. */
  referenceDateId: TColumnId | null
  /** Change the reference date column. */
  setReferenceDateId: (columnId: TColumnId) => void
  /** All date columns available as reference dates. */
  availableDateColumns: Array<{id: TColumnId; label: string}>
  /** Active date range filter (null = all time). */
  dateRangeFilter: DateRangeFilter | null
  /** Set the date range filter. Pass null to clear (show all time). */
  setDateRangeFilter: (filter: DateRangeFilter | null) => void

  // -- Derived data --
  /** Transformed data points ready for recharts. */
  transformedData: TransformedDataPoint[]
  /** Auto-generated series definitions for recharts. */
  series: ChartSeries[]
  /** Active columns for the current source. */
  columns: readonly ChartColumn<T, TColumnId>[]
  /** Raw data for the active source. */
  rawData: readonly T[]
  /** Total number of records in the active source (before filtering). */
  recordCount: number
}
