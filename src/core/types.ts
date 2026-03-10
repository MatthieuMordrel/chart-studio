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
// Column definitions
// ---------------------------------------------------------------------------

/** Base properties shared by all column types. */
type ColumnBase = {
  /** Unique identifier — typically the field key in the data object. */
  id: string
  /** Human-readable label for the UI. */
  label: string
}

/**
 * A date column — eligible as a time-series X-axis.
 *
 * @property accessor - Extracts a date value from a data item
 */
export type DateColumn<T> = ColumnBase & {
  type: 'date'
  accessor: (item: T) => string | number | Date | null | undefined
}

/**
 * A category column — eligible for X-axis, groupBy, and filtering.
 *
 * @property accessor - Extracts a string category value from a data item
 */
export type CategoryColumn<T> = ColumnBase & {
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
export type BooleanColumn<T> = ColumnBase & {
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
export type NumberColumn<T> = ColumnBase & {
  type: 'number'
  accessor: (item: T) => number | null | undefined
}

/** Union of all column types. */
export type ChartColumn<T> = DateColumn<T> | CategoryColumn<T> | BooleanColumn<T> | NumberColumn<T>

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

/**
 * A metric definition — what the Y-axis measures.
 *
 * @property columnId - The number column to aggregate (null = count of items)
 * @property aggregate - The aggregation function to apply
 * @property label - Display label (auto-generated if not provided)
 * @property includeZeros - Whether zero values are included in aggregation (default: true). Only affects avg/min/max — sum always includes zeros.
 */
export type Metric = {
  columnId: string | null
  aggregate: AggregateFunction
  label: string
  includeZeros?: boolean
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/**
 * Active filter state per column.
 * - For category columns: Set of selected values (empty = no filter = show all)
 * - For boolean columns: true/false/null (null = no filter)
 */
export type FilterState = Map<string, Set<string>>

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
export type DataSource<T> = {
  id: string
  label: string
  data: T[]
  columns: ChartColumn<T>[]
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
export type AvailableFilter = {
  columnId: string
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
export type DateRange = {
  columnId: string
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
export type ChartInstance<T> = {
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
  xAxisId: string | null
  /** Change the X-axis column. */
  setXAxis: (columnId: string) => void
  /** Columns eligible for X-axis (date + category). */
  availableXAxes: Array<{id: string; label: string; type: 'date' | 'category' | 'boolean'}>

  // -- Group by --
  /** Current groupBy column ID (null = no grouping). */
  groupById: string | null
  /** Change the groupBy column. */
  setGroupBy: (columnId: string | null) => void
  /** Columns eligible for groupBy (category + boolean, excluding current X-axis). */
  availableGroupBys: Array<{id: string; label: string}>

  // -- Metric --
  /** Current metric (what the Y-axis measures). */
  metric: Metric
  /** Change the metric. */
  setMetric: (metric: Metric) => void
  /** Available metrics (count + one per number column with sum/avg/min/max). */
  availableMetrics: Metric[]

  // -- Time bucket --
  /** Current time bucket (only relevant when X-axis is date). */
  timeBucket: TimeBucket
  /** Change the time bucket. */
  setTimeBucket: (bucket: TimeBucket) => void
  /** Whether time bucketing controls should be shown. */
  isTimeSeries: boolean

  // -- Filters --
  /** Active filter values per column. */
  filters: FilterState
  /** Toggle a specific filter value on/off for a column. */
  toggleFilter: (columnId: string, value: string) => void
  /** Clear all filters for a column. */
  clearFilter: (columnId: string) => void
  /** Clear all filters. */
  clearAllFilters: () => void
  /** Available filter options extracted from the data. */
  availableFilters: AvailableFilter[]

  // -- Sorting --
  /** Current sort configuration (null = default order). */
  sorting: SortConfig | null
  /** Change sorting. */
  setSorting: (sorting: SortConfig | null) => void

  // -- Date range --
  /** Date range for the active reference date column (computed from filtered data). */
  dateRange: DateRange | null
  /** Which date column provides the visible date range context. */
  referenceDateId: string | null
  /** Change the reference date column. */
  setReferenceDateId: (columnId: string) => void
  /** All date columns available as reference dates. */
  availableDateColumns: Array<{id: string; label: string}>
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
  columns: ChartColumn<T>[]
  /** Raw data for the active source. */
  rawData: T[]
  /** Total number of records in the active source (before filtering). */
  recordCount: number
}
