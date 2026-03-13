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

/**
 * Built-in format presets for `schema.columns.*.format`.
 *
 * Use these for the common cases before reaching for the object form:
 * - `'number'` for a normal numeric display such as `12,340`
 * - `'compact-number'` for short numeric display such as `12.3K`
 * - `'currency'` for money such as `$12.3K` / `$12,340`
 * - `'percent'` for ratios such as `27.8%`
 * - `'date'` for date-only values such as `Mar 11, 2026`
 * - `'datetime'` for date+time values such as `Mar 11, 2026, 3:30 PM`
 */
export type ColumnFormatPreset =
  | 'number'
  | 'compact-number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'

/**
 * Fixed-size duration units that can be converted reliably without calendar
 * ambiguity.
 *
 * These are used by `format: {kind: 'duration', unit: ...}` to tell the chart
 * system what one raw numeric value represents.
 */
export type DurationInputUnit = 'seconds' | 'minutes' | 'hours' | 'days'

/**
 * `Intl.NumberFormat` options for `format: {kind: 'number', ...}`.
 *
 * This is still a native `Intl` passthrough, but the most common properties are
 * re-documented here so new users can understand them directly from editor
 * hover text without opening MDN first.
 *
 * Typical example:
 *
 * ```ts
 * format: {
 *   kind: 'number',
 *   options: {
 *     style: 'currency',
 *     currency: 'USD',
 *     notation: 'compact',
 *     maximumFractionDigits: 1,
 *   },
 * }
 * ```
 */
export type ChartNumberFormatOptions = Omit<
  Intl.NumberFormatOptions,
  'style' | 'currency' | 'notation' | 'maximumFractionDigits'
> & {
  /**
   * Which numeric family to render.
   *
   * Common values:
   * - `'decimal'` -> `1,234`
   * - `'currency'` -> `$1,234`
   * - `'percent'` -> `27.8%`
   */
  style?: Intl.NumberFormatOptions['style']
  /**
   * Currency code used when `style: 'currency'`.
   *
   * Common examples:
   * - `'USD'`
   * - `'EUR'`
   * - `'GBP'`
   */
  currency?: string
  /**
   * Whether large values should stay full length or use compact suffixes.
   *
   * Common values:
   * - `'standard'` -> `1,200,000`
   * - `'compact'` -> `1.2M`
   */
  notation?: Intl.NumberFormatOptions['notation']
  /**
   * Maximum number of digits shown after the decimal separator.
   *
   * Examples:
   * - `0` -> `1M`
   * - `1` -> `1.2M`
   * - `2` -> `1.23M`
   */
  maximumFractionDigits?: number
}

/**
 * `Intl.DateTimeFormat` options for `format: {kind: 'date', ...}`.
 *
 * Like `ChartNumberFormatOptions`, this is still a native `Intl` passthrough
 * with friendlier docs for the properties chart users reach for most often.
 *
 * Typical example:
 *
 * ```ts
 * format: {
 *   kind: 'date',
 *   options: {
 *     month: 'short',
 *     year: 'numeric',
 *   },
 * }
 * ```
 */
export type ChartDateFormatOptions = Omit<
  Intl.DateTimeFormatOptions,
  'dateStyle' | 'timeStyle' | 'year' | 'month' | 'day'
> & {
  /**
   * Prebuilt date preset.
   *
   * Examples:
   * - `'short'` -> `3/11/26`
   * - `'medium'` -> `Mar 11, 2026`
   * - `'long'` -> `March 11, 2026`
   */
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  /**
   * Prebuilt time preset.
   *
   * Examples:
   * - `'short'` -> `3:30 PM`
   * - `'medium'` -> `3:30:00 PM`
   */
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
  /** How the year should render, for example `'numeric'` or `'2-digit'`. */
  year?: Intl.DateTimeFormatOptions['year']
  /** How the month should render, for example `'numeric'`, `'short'`, or `'long'`. */
  month?: Intl.DateTimeFormatOptions['month']
  /** How the day should render, usually `'numeric'` or `'2-digit'`. */
  day?: Intl.DateTimeFormatOptions['day']
}

/**
 * Explicit number formatting object.
 *
 * Use this when the preset strings are close, but you want to control the
 * locale or specific `Intl.NumberFormat` options yourself.
 */
export type NumberColumnFormat = {
  /** Marks this object as the number-format form of `format`. */
  kind: 'number'
  /**
   * Optional locale passed to `Intl.NumberFormat`.
   *
   * Examples:
   * - `'en-US'`
   * - `'fr-FR'`
   * - `'de-DE'`
   */
  locale?: string
  /**
   * Native `Intl.NumberFormat` options.
   *
   * This is where you customize things like currency, compact notation, and the
   * number of decimal places to show.
   */
  options?: ChartNumberFormatOptions
}

/**
 * Explicit date formatting object.
 *
 * Use this when the preset strings are close, but you want to control the
 * locale or specific `Intl.DateTimeFormat` options yourself.
 */
export type DateColumnFormat = {
  /** Marks this object as the date-format form of `format`. */
  kind: 'date'
  /**
   * Optional locale passed to `Intl.DateTimeFormat`.
   *
   * Examples:
   * - `'en-US'`
   * - `'fr-FR'`
   * - `'ja-JP'`
   */
  locale?: string
  /**
   * Native `Intl.DateTimeFormat` options.
   *
   * This is where you customize things like month/year-only displays, long
   * versus short month names, or full date+time output.
   */
  options?: ChartDateFormatOptions
}

/**
 * Explicit duration formatting object for numeric values that represent elapsed
 * time.
 *
 * Use this when the charted value is a duration and you want chart-studio to
 * render compact labels like `36s`, `1h36m`, or `1d5h`.
 *
 * Typical example:
 *
 * ```ts
 * format: {
 *   kind: 'duration',
 *   unit: 'minutes',
 * }
 * ```
 */
export type DurationColumnFormat = {
  /** Marks this object as the duration-format form of `format`. */
  kind: 'duration'
  /**
   * Unit represented by one raw numeric value.
   *
   * Examples:
   * - `'seconds'` when `90` means ninety seconds
   * - `'minutes'` when `45` means forty-five minutes
   * - `'hours'` when `1.5` means one hour and thirty minutes
   * - `'days'` when `2` means two days
   */
  unit: DurationInputUnit
}

/**
 * Full declarative formatting surface accepted by `schema.columns.*.format`.
 *
 * Start with a preset string for the common case. Move to the object form when
 * you need to customize locale, low-level `Intl` options, or duration units.
 */
export type ColumnFormat = ColumnFormatPreset | NumberColumnFormat | DateColumnFormat | DurationColumnFormat

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

/**
 * Shared schema properties available on both raw-field overrides and derived
 * columns.
 *
 * Most users will interact with these through `schema.columns.someField`.
 */
export interface BaseColumnHint<T, TValue> {
  /**
   * User-facing column label shown in selectors, tooltips, legends, and filter
   * headers.
   *
   * Example: `revenuePerSeat` becomes `Revenue Per Seat` by default, but you can
   * override it with `label: 'Revenue / Seat'`.
   */
  label?: string
  /**
   * How this column should be displayed in the chart UI.
   *
   * Use a preset like `'currency'` or `'percent'` for the common case. Use the
   * object form when you need to control locale, specific `Intl` options, or
   * duration units like `'minutes'`.
   *
   * This affects display surfaces such as:
   * - axis tick labels
   * - tooltip values
   * - chart data labels
   * - filter option labels when the values are typed
   */
  format?: ColumnFormat
  /**
   * Final escape hatch for fully custom display logic.
   *
   * Receives the resolved field value and, when the UI surface still maps to a
   * single raw row, that source item as well. Prefer `format` first when a
   * declarative option is enough, and use `formatter` only when the output
   * really depends on custom business logic.
   */
  formatter?: (value: TValue | null | undefined, item?: T) => string
}

/**
 * Schema override for a raw string field.
 *
 * Use this when a dataset field already exists and you want to relabel it,
 * force its type, or change how it formats in the chart UI.
 */
export interface StringColumnHint<T> extends BaseColumnHint<T, string> {
  /**
   * How this string field should behave in the chart system.
   *
   * - `'category'` keeps it as a label-like field
   * - `'date'` tells chart-studio to parse it as a date/time field
   */
  type?: 'category' | 'date'
}

/**
 * Schema override for a raw numeric field.
 *
 * This is the most common place to use `format: 'currency'`,
 * `format: 'percent'`, or a `kind: 'number'` object.
 */
export interface NumberColumnHint<T> extends BaseColumnHint<T, number> {
  /**
   * How this numeric field should behave in the chart system.
   *
   * - `'number'` keeps it as an aggregatable metric
   * - `'date'` is useful for Unix timestamps or numeric date representations
   */
  type?: 'number' | 'date'
}

/**
 * Schema override for a raw boolean field.
 *
 * These fields are useful for grouping and filtering, especially when paired
 * with `trueLabel` / `falseLabel`.
 */
export interface BooleanColumnHint<T> extends BaseColumnHint<T, boolean> {
  /** Boolean fields always resolve to the `'boolean'` column type. */
  type?: 'boolean'
  /** Label shown in the UI when the value is `true`, for example `'Open'`. */
  trueLabel?: string
  /** Label shown in the UI when the value is `false`, for example `'Closed'`. */
  falseLabel?: string
}

/**
 * Schema override for a raw date-like field.
 *
 * This is useful when your field is already a `Date`, ISO string, or timestamp
 * and you want date-specific behavior with an optional custom display format.
 */
export interface DateValueColumnHint<T> extends BaseColumnHint<T, string | number | Date> {
  /** Date-valued fields always resolve to the `'date'` column type. */
  type?: 'date'
}

/** Override options for mixed primitive fields when runtime values need the final say. */
export interface MixedPrimitiveColumnHint<T, TValue> extends BaseColumnHint<T, TValue> {
  /** Explicitly pin the runtime-inferred field to one chart column type. */
  type?: ChartColumnType
  /** Human-facing label used when a mixed field is interpreted as boolean `true`. */
  trueLabel?: string
  /** Human-facing label used when a mixed field is interpreted as boolean `false`. */
  falseLabel?: string
}

/**
 * Type-safe schema entry for one raw dataset field.
 *
 * The available properties depend on the field's runtime type, so a boolean
 * field gets boolean-specific options, a number field gets numeric options, and
 * so on.
 */
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

/**
 * Override or exclude one inferred raw field inside `schema.columns`.
 *
 * This lightweight shape intentionally matches the inference override story so
 * callers can keep the common case terse while the surrounding `schema` object
 * becomes the single explicit chart contract.
 */
export type RawColumnSchemaFor<TValue, T> = ColumnHintFor<TValue, T>

/**
 * Raw-field schema entries keyed by existing top-level dataset fields.
 *
 * Set a field to `false` to exclude it from the chart API entirely.
 */
export type RawColumnSchemaMap<T> = Partial<{
  [TKey in InferableFieldKey<T>]: RawColumnSchemaFor<T[TKey], T> | false
}>

/**
 * Shared contract for every explicit derived column declared in `schema.columns`.
 *
 * Derived columns are how you add a brand new chart field that does not exist as
 * a raw property on the input row.
 *
 * They are intentionally narrow:
 * - they are additive-only and must use a new id
 * - they compute from one row at a time via `accessor`
 * - they reuse the same labeling and formatting surface as raw columns
 * - they do not currently expose any extra metadata channel
 */
interface DerivedColumnSchemaBase<T, TValue, TType extends ChartColumnType>
  extends Omit<BaseColumnHint<T, TValue>, 'label'> {
  /**
   * Marks this schema entry as a derived column.
   *
   * Without `kind: 'derived'`, a `schema.columns` entry is interpreted as an
   * override for an existing raw field.
   */
  kind: 'derived'
  /** User-facing label for this new derived column. */
  label: string
  /**
   * Declared column role.
   *
   * This controls how the derived column behaves:
   * - `'date'` can be used on time-series X-axes
   * - `'category'` can be used for X-axis, group-by, and filters
   * - `'boolean'` can be used for group-by and filters
   * - `'number'` can be aggregated as a metric
   */
  type: TType
}

/** Explicit derived date column definition. */
export interface DerivedDateColumnSchema<T> extends DerivedColumnSchemaBase<T, string | number | Date, 'date'> {
  /** Compute one date-like value from a row for time-series usage. */
  accessor: (item: T) => string | number | Date | null | undefined
}

/** Explicit derived category column definition. */
export interface DerivedCategoryColumnSchema<T> extends DerivedColumnSchemaBase<T, string, 'category'> {
  /** Compute one category label from a row. */
  accessor: (item: T) => string | null | undefined
}

/** Explicit derived boolean column definition. */
export interface DerivedBooleanColumnSchema<T> extends DerivedColumnSchemaBase<T, boolean, 'boolean'> {
  /** Compute one boolean value from a row. */
  accessor: (item: T) => boolean | null | undefined
  /** Human-facing label used when the derived value is `true`. */
  trueLabel?: string
  /** Human-facing label used when the derived value is `false`. */
  falseLabel?: string
}

/** Explicit derived numeric column definition. */
export interface DerivedNumberColumnSchema<T> extends DerivedColumnSchemaBase<T, number, 'number'> {
  /** Compute one numeric value from a row for aggregation. */
  accessor: (item: T) => number | null | undefined
}

/** Any explicit derived column accepted in `schema.columns`. */
export type DerivedColumnSchema<T> =
  | DerivedDateColumnSchema<T>
  | DerivedCategoryColumnSchema<T>
  | DerivedBooleanColumnSchema<T>
  | DerivedNumberColumnSchema<T>

/**
 * Broad contextual typing surface used while authoring `schema.columns`.
 *
 * The validator stays stricter than this helper surface. This type exists so
 * editors can still suggest known raw dataset keys while callers are also free
 * to add arbitrary derived column ids inline.
 */
export type ChartColumnsAuthoringSurface<T> = RawColumnSchemaMap<T> & {
  [TKey: string]: RawColumnSchemaFor<InferableColumnValue, T> | DerivedColumnSchema<T> | false
}

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

type ExplicitHintedColumnType<THint> = Extract<
  THint extends {type?: infer TType} ? TType : never,
  ChartColumnType
>

type PotentialColumnTypeFromValue<TValue> =
  [Exclude<TValue, Nullish>] extends [boolean] ? 'boolean'
  : [Exclude<TValue, Nullish>] extends [Date] ? 'date'
  : [Exclude<TValue, Nullish>] extends [number] ? 'date' | 'number'
  : [Exclude<TValue, Nullish>] extends [string] ? 'date' | 'category'
  : ChartColumnType

type PotentialColumnTypeFromHints<
  T,
  THints extends ColumnHints<T> | undefined,
  TKey extends ResolvedColumnIdFromHints<T, THints>,
> =
  THints extends ColumnHints<T>
    ? [ExplicitHintedColumnType<THints[TKey]>] extends [never]
      ? PotentialColumnTypeFromValue<T[TKey]>
      : ExplicitHintedColumnType<THints[TKey]>
    : PotentialColumnTypeFromValue<T[TKey]>

type ColumnIdsMatchingPotentialTypes<
  T,
  THints extends ColumnHints<T> | undefined,
  TAllowedType extends ChartColumnType,
> = Extract<
  {
    [TKey in ResolvedColumnIdFromHints<T, THints>]:
      Extract<PotentialColumnTypeFromHints<T, THints, TKey>, TAllowedType> extends never ? never : TKey
  }[ResolvedColumnIdFromHints<T, THints>],
  string
>

/** Column IDs that can safely be treated as X-axis candidates from static information. */
export type ResolvedXAxisColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ColumnIdsMatchingPotentialTypes<T, THints, 'date' | 'category' | 'boolean'>

/** Column IDs that can safely be treated as groupBy candidates from static information. */
export type ResolvedGroupByColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ColumnIdsMatchingPotentialTypes<T, THints, 'category' | 'boolean'>

/** Column IDs that can safely be treated as filter candidates from static information. */
export type ResolvedFilterColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ColumnIdsMatchingPotentialTypes<T, THints, 'category' | 'boolean'>

/** Column IDs that can safely be treated as metric candidates from static information. */
export type ResolvedMetricColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ColumnIdsMatchingPotentialTypes<T, THints, 'number'>

/** Column IDs that can safely be treated as date candidates from static information. */
export type ResolvedDateColumnIdFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ColumnIdsMatchingPotentialTypes<T, THints, 'date'>

/** Explicit config derived from the resolved role-aware IDs for one dataset. */
export type ChartConfigFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ChartConfig<
  ResolvedXAxisColumnIdFromHints<T, THints>,
  ResolvedGroupByColumnIdFromHints<T, THints>,
  ResolvedFilterColumnIdFromHints<T, THints>,
  ResolvedMetricColumnIdFromHints<T, THints>
>

type ConfigSection<TConfig, TKey extends string> =
  TKey extends keyof TConfig ? TConfig[TKey] : never

type AllowedOptionFromControlConfig<TControlConfig> =
  TControlConfig extends {allowed?: readonly (infer TAllowedOption)[]} ? TAllowedOption : never

type HiddenOptionFromControlConfig<TControlConfig> =
  TControlConfig extends {hidden?: readonly (infer THiddenOption)[]} ? THiddenOption : never

type RestrictUnionOrFallback<TAllowed, TFallback> =
  [Extract<TAllowed, TFallback>] extends [never] ? TFallback : Extract<TAllowed, TFallback>

type ExcludeHiddenOrFallback<TBase, THidden> =
  [Extract<THidden, TBase>] extends [TBase] ? TBase : Exclude<TBase, Extract<THidden, TBase>>

type RestrictOptionsFromControlConfig<TBaseOption, TControlConfig> = ExcludeHiddenOrFallback<
  RestrictUnionOrFallback<AllowedOptionFromControlConfig<TControlConfig>, TBaseOption>,
  Extract<HiddenOptionFromControlConfig<TControlConfig>, TBaseOption>
>

type AllowedMetricFromConfig<TConfig> =
  TConfig extends {metric?: {allowed?: readonly (infer TAllowedMetric)[]}} ? TAllowedMetric : never

type HiddenMetricFromConfig<TConfig> =
  TConfig extends {metric?: {hidden?: readonly (infer THiddenMetric)[]}} ? THiddenMetric : never

type ExpandMetricAllowance<TMetricAllowance> =
  TMetricAllowance extends CountMetric ? CountMetric
  : TMetricAllowance extends {
      kind: 'aggregate'
      columnId: infer TColumnId extends string
      aggregate: infer TAggregate
      includeZeros?: infer TIncludeZeros
    }
    ? TAggregate extends readonly NumericAggregateFunction[]
      ? {
          [TSelectedAggregate in TAggregate[number]]: {
            kind: 'aggregate'
            columnId: TColumnId
            aggregate: TSelectedAggregate
            includeZeros?: Extract<TIncludeZeros, boolean | undefined>
          }
        }[TAggregate[number]]
      : TAggregate extends NumericAggregateFunction
        ? {
            kind: 'aggregate'
            columnId: TColumnId
            aggregate: TAggregate
            includeZeros?: Extract<TIncludeZeros, boolean | undefined>
          }
        : never
    : never

type MetricColumnIdFromMetric<TMetric> = Extract<
  TMetric extends AggregateMetric<infer TColumnId> ? TColumnId : never,
  string
>

type StaticConfigError<TMessage extends string> = {
  __configError__: TMessage
}

type IsExactly<TLeft, TRight> =
  [TLeft] extends [TRight]
    ? [TRight] extends [TLeft]
      ? true
      : false
    : false

type IsTuple<TArray extends readonly unknown[]> = number extends TArray['length'] ? false : true

type NarrowConfigLiteral<TValue, TWide> = IsExactly<TValue, TWide> extends true ? never : TValue

type RequiredKeys<TObject> = Extract<
  {
    [TKey in keyof TObject]-?: undefined extends TObject[TKey] ? never : TKey
  }[keyof TObject],
  PropertyKey
>

export type ExactShape<TExpected, TActual> =
  TExpected extends unknown
    ? TActual extends readonly (infer TActualItem)[]
      ? TExpected extends readonly (infer TExpectedItem)[]
        ? readonly ExactShape<TExpectedItem, TActualItem>[]
        : never
      : TActual extends (...args: never[]) => unknown
        ? TActual extends TExpected
          ? TActual
          : never
        : TActual extends object
          ? TExpected extends object
            ? {
                [TKey in keyof TActual]:
                  TKey extends keyof TExpected
                    ? ExactShape<TExpected[TKey], TActual[TKey]>
                    : never
              } & {
                [TKey in Exclude<RequiredKeys<TExpected>, keyof TActual>]-?: never
              }
            : never
          : TActual extends TExpected
            ? TActual
            : never
    : never

export type SchemaColumnsValidationShape<
  T,
  TColumns extends Record<string, unknown> | undefined,
> = TColumns extends Record<string, unknown>
  ? {
      [TKey in keyof TColumns]:
        TKey extends InferableFieldKey<T>
          ? RawColumnSchemaFor<T[TKey], T> | false
          : DerivedColumnSchema<T>
    }
  : never

export type ValidateLiteralDefaultNotHidden<
  TSection,
  TWideOption,
  TSectionName extends string,
> = TSection extends {default?: infer TDefault; hidden?: infer THidden}
  ? THidden extends readonly unknown[]
    ? IsTuple<THidden> extends true
      ? [NarrowConfigLiteral<Exclude<TDefault, undefined>, TWideOption>] extends [never]
        ? unknown
        : [Extract<NarrowConfigLiteral<Exclude<TDefault, undefined>, TWideOption>, THidden[number]>] extends [never]
          ? unknown
          : StaticConfigError<`${TSectionName}.default cannot also appear in ${TSectionName}.hidden`>
      : unknown
    : unknown
  : unknown

type ValidateChartConfigLiterals<
  T,
  THints extends ColumnHints<T> | undefined,
  TConfig extends ChartConfigFromHints<T, THints>,
> =
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TConfig, 'xAxis'>,
    ResolvedXAxisColumnIdFromHints<T, THints>,
    'xAxis'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TConfig, 'groupBy'>,
    ResolvedGroupByColumnIdFromHints<T, THints>,
    'groupBy'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TConfig, 'metric'>,
    Metric<ResolvedMetricColumnIdFromHints<T, THints>>,
    'metric'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TConfig, 'chartType'>,
    ChartType,
    'chartType'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TConfig, 'timeBucket'>,
    TimeBucket,
    'timeBucket'
  >

export type ValidatedChartConfigFromHints<
  T,
  THints extends ColumnHints<T> | undefined,
  TConfig,
> = TConfig extends ChartConfigFromHints<T, THints>
  ? ExactShape<ChartConfigFromHints<T, THints>, TConfig>
    & TConfig
    & ValidateChartConfigLiterals<T, THints, TConfig>
  : TConfig

/** Strict config object returned by `defineChartConfig(...)`. */
export type DefinedChartConfigFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> = ChartConfigFromHints<T, THints>,
> = ValidatedChartConfigFromHints<T, THints, TConfig> & ChartConfigDefinitionBrand

type ValidateChartSchemaLiterals<
  T,
  TSchema extends ChartSchema<T, any>,
> =
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TSchema, 'xAxis'>,
    ResolvedXAxisColumnIdFromSchema<T, TSchema>,
    'xAxis'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TSchema, 'groupBy'>,
    ResolvedGroupByColumnIdFromSchema<T, TSchema>,
    'groupBy'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TSchema, 'metric'>,
    Metric<ResolvedMetricColumnIdFromSchema<T, TSchema>>,
    'metric'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TSchema, 'chartType'>,
    ChartType,
    'chartType'
  >
  & ValidateLiteralDefaultNotHidden<
    ConfigSection<TSchema, 'timeBucket'>,
    TimeBucket,
    'timeBucket'
  >

type ChartSchemaValidationTarget<
  T,
  TSchema extends ChartSchema<T, any>,
> = {
  columns?: SchemaColumnsValidationShape<T, ExtractSchemaColumns<TSchema>>
  xAxis?: XAxisConfig<ResolvedXAxisColumnIdFromSchema<T, TSchema>>
  groupBy?: GroupByConfig<ResolvedGroupByColumnIdFromSchema<T, TSchema>>
  filters?: FiltersConfig<ResolvedFilterColumnIdFromSchema<T, TSchema>>
  metric?: MetricConfig<ResolvedMetricColumnIdFromSchema<T, TSchema>>
  chartType?: ChartTypeConfig
  timeBucket?: TimeBucketConfig
}

/** Strict schema object returned by `defineChartSchema(...)`. */
export type ValidatedChartSchema<
  T,
  TSchema,
> = TSchema extends ChartSchema<T, any>
  ? TSchema
    & ExactShape<ChartSchemaValidationTarget<T, TSchema>, TSchema>
    & ValidateChartSchemaLiterals<T, TSchema>
  : TSchema

/** Strict schema object returned by `defineChartSchema(...)`. */
export type DefinedChartSchema<
  T,
  TSchema extends ChartSchema<T, any> = ChartSchema<T, any>,
> = TSchema & ChartSchemaDefinitionBrand

export type ResolvedChartSchemaFromDefinition<TSchema> =
  TSchema extends DefinedChartSchema<any, infer TResolvedSchema> ? TResolvedSchema : undefined

export type ResolvedChartConfigFromDefinition<TConfig> =
  TConfig extends DefinedChartConfigFromHints<any, any, infer TResolvedConfig> ? TResolvedConfig : undefined

/** GroupBy IDs narrowed by explicit config when present. */
export type RestrictedGroupByColumnIdFromConfig<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedGroupByColumnIdFromHints<T, THints>,
  ConfigSection<TConfig, 'groupBy'>
>

/** X-axis IDs narrowed by explicit config when present. */
export type RestrictedXAxisColumnIdFromConfig<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedXAxisColumnIdFromHints<T, THints>,
  ConfigSection<TConfig, 'xAxis'>
>

/** Filter column IDs narrowed by explicit config when present. */
export type RestrictedFilterColumnIdFromConfig<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedFilterColumnIdFromHints<T, THints>,
  ConfigSection<TConfig, 'filters'>
>

/** Metric union narrowed by explicit config when present. */
export type RestrictedMetricFromConfig<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = ExcludeHiddenOrFallback<
  RestrictUnionOrFallback<
    ExpandMetricAllowance<AllowedMetricFromConfig<TConfig>>,
    Metric<ResolvedMetricColumnIdFromHints<T, THints>>
  >,
  HiddenMetricFromConfig<TConfig>
>

/** Chart types narrowed by explicit config when present. */
export type RestrictedChartTypeFromConfig<TConfig> = RestrictOptionsFromControlConfig<
  ChartType,
  ConfigSection<TConfig, 'chartType'>
>

/** Time buckets narrowed by explicit config when present. */
export type RestrictedTimeBucketFromConfig<TConfig> = RestrictOptionsFromControlConfig<
  TimeBucket,
  ConfigSection<TConfig, 'timeBucket'>
>

/** GroupBy IDs narrowed by explicit schema restrictions when present. */
export type RestrictedGroupByColumnIdFromSchema<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedGroupByColumnIdFromSchema<T, TSchema>,
  ConfigSection<TSchema, 'groupBy'>
>

/** X-axis IDs narrowed by explicit schema restrictions when present. */
export type RestrictedXAxisColumnIdFromSchema<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedXAxisColumnIdFromSchema<T, TSchema>,
  ConfigSection<TSchema, 'xAxis'>
>

/** Filter column IDs narrowed by explicit schema restrictions when present. */
export type RestrictedFilterColumnIdFromSchema<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = RestrictOptionsFromControlConfig<
  ResolvedFilterColumnIdFromSchema<T, TSchema>,
  ConfigSection<TSchema, 'filters'>
>

/** Metric union narrowed by explicit schema restrictions when present. */
export type RestrictedMetricFromSchema<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = ExcludeHiddenOrFallback<
  RestrictUnionOrFallback<
    ExpandMetricAllowance<AllowedMetricFromConfig<TSchema>>,
    Metric<ResolvedMetricColumnIdFromSchema<T, TSchema>>
  >,
  HiddenMetricFromConfig<TSchema>
>

/** Chart types narrowed by explicit schema restrictions when present. */
export type RestrictedChartTypeFromSchema<TSchema> = RestrictOptionsFromControlConfig<
  ChartType,
  ConfigSection<TSchema, 'chartType'>
>

/** Time buckets narrowed by explicit schema restrictions when present. */
export type RestrictedTimeBucketFromSchema<TSchema> = RestrictOptionsFromControlConfig<
  TimeBucket,
  ConfigSection<TSchema, 'timeBucket'>
>

/** Base properties shared by all column types. */
type ColumnBase<T, TId extends string> = {
  /** Unique identifier — typically the field key in the data object. */
  id: TId
  /** Human-readable label for the UI. */
  label: string
  /** Optional display formatter preset used by the UI layer. */
  format?: ColumnFormat
  /**
   * Optional per-value formatter used by the UI layer.
   *
   * The source `item` is passed when the rendered value still maps to one raw
   * row, such as filter option labels. Aggregated chart values do not have a
   * single backing row, so `item` is optional there by design.
   */
  formatter?: (value: unknown, item?: T) => string
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

// ---------------------------------------------------------------------------
// Chart type
// ---------------------------------------------------------------------------

/** Chart types available for time-series (date X-axis). */
export type TimeSeriesChartType = 'bar' | 'grouped-bar' | 'percent-bar' | 'line' | 'area' | 'percent-area'

/** Chart types available for categorical (category/boolean X-axis). */
export type CategoricalChartType = 'bar' | 'grouped-bar' | 'percent-bar' | 'pie' | 'donut'

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

/** One or many numeric aggregates accepted by declarative metric restrictions. */
export type NumericAggregateSelection =
  | NumericAggregateFunction
  | readonly NumericAggregateFunction[]

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

/**
 * Aggregate metric restriction accepted by `config.metric.allowed`.
 *
 * Unlike `AggregateMetric`, the `aggregate` field may be either one aggregate
 * or an array shorthand that expands into several allowed metrics.
 */
export type AggregateMetricAllowance<TColumnId extends string = string> = {
  kind: 'aggregate'
  columnId: TColumnId
  aggregate: NumericAggregateSelection
  includeZeros?: boolean
}

/** One declarative metric entry accepted by `config.metric.allowed`. */
export type MetricAllowance<TColumnId extends string = string> =
  | CountMetric
  | AggregateMetricAllowance<TColumnId>

// ---------------------------------------------------------------------------
// Chart config
// ---------------------------------------------------------------------------

/** Shared config shape for one selectable control. */
export type SelectableControlConfig<TOption extends string = string> = {
  /** Optional whitelist of options that remain visible/selectable. */
  allowed?: readonly TOption[]
  /** Optional blacklist of options to hide after whitelisting. */
  hidden?: readonly TOption[]
  /** Preferred selection when the current value is missing or invalid. */
  default?: TOption
}

/** Declarative config for the X-axis control. */
export type XAxisConfig<TColumnId extends string = string> = SelectableControlConfig<TColumnId>

/** Declarative config for the groupBy control. */
export type GroupByConfig<TColumnId extends string = string> = SelectableControlConfig<TColumnId>

/**
 * Declarative config for which columns may appear in the filters UI.
 *
 * Filter value restrictions are intentionally out of scope for now. This keeps
 * `filters` aligned with the existing column-first headless model.
 */
export type FiltersConfig<TColumnId extends string = string> = Omit<
  SelectableControlConfig<TColumnId>,
  'default'
>

/**
 * Declarative config for the metric control.
 *
 * `allowed` keeps the shorthand array-expansion form while `hidden` and
 * `default` operate on fully resolved metric objects.
 */
export type MetricConfig<TColumnId extends string = string> = {
  allowed?: readonly MetricAllowance<TColumnId>[]
  hidden?: readonly Metric<TColumnId>[]
  default?: Metric<TColumnId>
}

/** Declarative config for chart-type selection. */
export type ChartTypeConfig = SelectableControlConfig<ChartType>

/** Declarative config for time-bucket selection. */
export type TimeBucketConfig = SelectableControlConfig<TimeBucket>

/**
 * Explicit chart config supported by `useChart()`.
 *
 * `columnHints` stays convenience-first and influences inference.
 * `config` becomes authoritative when callers want to restrict the public chart contract.
 */
export type ChartConfig<
  TXAxisColumnId extends string = string,
  TGroupByColumnId extends string = string,
  TFilterColumnId extends string = string,
  TMetricColumnId extends string = string,
> = {
  xAxis?: XAxisConfig<TXAxisColumnId>
  groupBy?: GroupByConfig<TGroupByColumnId>
  filters?: FiltersConfig<TFilterColumnId>
  metric?: MetricConfig<TMetricColumnId>
  chartType?: ChartTypeConfig
  timeBucket?: TimeBucketConfig
}

type ChartConfigDefinitionBrand = {
  readonly __chartConfigBrand: 'chart-config-definition'
}

type ExtractSchemaColumns<TSchema> =
  TSchema extends {columns?: infer TColumns}
    ? Extract<TColumns, Record<string, unknown>>
    : undefined

type RawSchemaColumnsFromColumns<
  T,
  TColumns extends Record<string, unknown> | undefined,
> = TColumns extends Record<string, unknown>
  ? {
      [TKey in keyof TColumns as TKey extends InferableFieldKey<T> ? TKey : never]: TColumns[TKey]
    }
  : undefined

type RawSchemaColumns<T, TSchema> = RawSchemaColumnsFromColumns<T, ExtractSchemaColumns<TSchema>>

type DerivedColumnIdsFromColumns<TColumns extends Record<string, unknown> | undefined> = Extract<
  TColumns extends Record<string, unknown>
    ? {
        [TKey in keyof TColumns]-?: TColumns[TKey] extends DerivedColumnSchema<any> ? TKey : never
      }[keyof TColumns]
    : never,
  string
>

type DerivedColumnIdsByTypeFromColumns<
  TColumns extends Record<string, unknown> | undefined,
  TAllowedType extends ChartColumnType,
> = Extract<
  TColumns extends Record<string, unknown>
    ? {
        [TKey in keyof TColumns]-?:
          TColumns[TKey] extends {kind: 'derived'; type: infer TType}
            ? Extract<TType, TAllowedType> extends never
              ? never
              : TKey
            : never
      }[keyof TColumns]
    : never,
  string
>

/** Column ID union resolved from one explicit schema definition. */
export type ResolvedColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsFromColumns<ExtractSchemaColumns<TSchema>>

/** X-axis IDs resolved from one explicit schema definition. */
export type ResolvedXAxisColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedXAxisColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsByTypeFromColumns<ExtractSchemaColumns<TSchema>, 'date' | 'category' | 'boolean'>

/** GroupBy IDs resolved from one explicit schema definition. */
export type ResolvedGroupByColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedGroupByColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsByTypeFromColumns<ExtractSchemaColumns<TSchema>, 'category' | 'boolean'>

/** Filter IDs resolved from one explicit schema definition. */
export type ResolvedFilterColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedFilterColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsByTypeFromColumns<ExtractSchemaColumns<TSchema>, 'category' | 'boolean'>

/** Metric column IDs resolved from one explicit schema definition. */
export type ResolvedMetricColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedMetricColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsByTypeFromColumns<ExtractSchemaColumns<TSchema>, 'number'>

/** Date column IDs resolved from one explicit schema definition. */
export type ResolvedDateColumnIdFromSchema<
  T,
  TSchema extends {columns?: Record<string, unknown>} | undefined = undefined,
> =
  | ResolvedDateColumnIdFromHints<T, Extract<RawSchemaColumns<T, TSchema>, ColumnHints<T> | undefined>>
  | DerivedColumnIdsByTypeFromColumns<ExtractSchemaColumns<TSchema>, 'date'>

/**
 * Single authoritative explicit chart schema accepted by `useChart({schema})`.
 *
 * Think of this as the contract that sits on top of inference:
 * - `columns` shapes what fields exist and how they behave
 * - the top-level sections shape what the user is allowed to select in the UI
 */
export type ChartSchema<
  T,
  TColumns extends Record<string, unknown> | undefined = Record<string, unknown> | undefined,
> = {
  /**
   * Override raw inferred fields, exclude raw fields with `false`, or declare
   * brand new derived columns.
   */
  columns?: TColumns & Partial<Record<InferableFieldKey<T>, unknown>>
  /** Restrict which non-numeric columns can be selected on the X-axis. */
  xAxis?: XAxisConfig<string>
  /** Restrict which categorical/boolean columns can split the chart into series. */
  groupBy?: GroupByConfig<string>
  /** Restrict which categorical/boolean columns appear in the filters UI. */
  filters?: FiltersConfig<string>
  /** Restrict which metrics and aggregations can be selected. */
  metric?: MetricConfig<string>
  /** Restrict which chart types are available to the user. */
  chartType?: ChartTypeConfig
  /** Restrict which time buckets are available for date X-axes. */
  timeBucket?: TimeBucketConfig
  /**
   * Whether line and area charts should connect across null (empty bucket)
   * data points instead of showing a gap.
   *
   * When `true` (default), the line bridges across empty buckets.
   * When `false`, empty time buckets produce a visible gap in the line/area.
   *
   * This is useful for sparse datasets (e.g. quarterly data displayed in a
   * monthly time bucket) where connecting across gaps produces a cleaner
   * visual than showing drops to zero.
   */
  connectNulls?: boolean
}

type ChartSchemaDefinitionBrand = {
  readonly __chartSchemaBrand: 'chart-schema-definition'
}

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
// Data source input
// ---------------------------------------------------------------------------

/**
 * Inference-first source definition accepted by multi-source charts.
 *
 * @property id - Unique identifier for this source
 * @property label - Display label in the source switcher
 * @property data - Array of raw data items
 * @property schema - Optional explicit schema layered on top of inference
 */
export type ChartSourceOptions<
  TId extends string = string,
  T = unknown,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = {
  id: TId
  label: string
  data: readonly T[]
  schema?: DefinedChartSchema<T, Exclude<TSchema, undefined>>
}

/** Convenience alias for any multi-source input definition. */
export type AnyChartSourceOptions = {
  id: string
  label: string
  data: readonly any[]
  schema?: any
}

/** Multi-source charts require at least one source so an active source always exists. */
export type NonEmptyChartSourceOptions = readonly [
  AnyChartSourceOptions,
  ...AnyChartSourceOptions[],
]

// ---------------------------------------------------------------------------
// Resolved source
// ---------------------------------------------------------------------------

/**
 * Internal normalized source shape after inference has resolved columns.
 *
 * @property id - Unique identifier for this source
 * @property label - Display label in the source switcher
 * @property data - Array of raw data items
 * @property columns - Column definitions for this source
 */
export type ResolvedChartSource<T, TColumnId extends string = string> = {
  id: string
  label: string
  data: readonly T[]
  columns: readonly ChartColumn<T, TColumnId>[]
  schema?: ChartSchema<T, any>
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
export type TransformedDataPoint = Record<string, string | number | null>

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
 * Re-exported from `date-range-presets.ts` for convenience.
 * See that module for the full preset registry and resolution logic.
 */
export type {DateRangePresetId} from './date-range-presets.js'

/**
 * Full chart state returned by the useChart hook.
 * Contains both controlled state and derived computations.
 */
export type ChartInstance<
  T,
  TColumnId extends string = string,
  TChartType extends ChartType = ChartType,
  TXAxisId extends TColumnId = TColumnId,
  TGroupById extends TColumnId = TColumnId,
  TMetricColumnId extends TColumnId = TColumnId,
  TMetric extends Metric<any> = Metric<TMetricColumnId>,
  TFilterColumnId extends TColumnId = TColumnId,
  TDateColumnId extends TColumnId = TColumnId,
  TTimeBucket extends TimeBucket = TimeBucket,
> = {
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
  chartType: TChartType
  /** Change the chart type. Runtime accepts only values in `availableChartTypes`. */
  setChartType: (type: TChartType) => void
  /** Chart types currently available given the active axis, grouping, and config. */
  availableChartTypes: TChartType[]

  // -- X-axis --
  /** Current X-axis column ID. */
  xAxisId: TXAxisId | null
  /**
   * Change the X-axis column.
   * Runtime accepts only IDs currently present in `availableXAxes`.
   */
  setXAxis: (columnId: TXAxisId) => void
  /**
   * Columns currently eligible for X-axis at runtime.
   * Typing narrows only from explicit `columnHints.type`, not from runtime inference.
   */
  availableXAxes: Array<{id: TXAxisId; label: string; type: 'date' | 'category' | 'boolean'}>

  // -- Group by --
  /** Current groupBy column ID (null = no grouping). */
  groupById: TGroupById | null
  /**
   * Change the groupBy column.
   * Runtime accepts only `null` or IDs currently present in `availableGroupBys`.
   */
  setGroupBy: (columnId: TGroupById | null) => void
  /**
   * Columns currently eligible for groupBy at runtime.
   * Explicit `config.groupBy.allowed` further narrows this list and the setter type.
   */
  availableGroupBys: Array<{id: TGroupById; label: string}>

  // -- Metric --
  /** Current metric (what the Y-axis measures). */
  metric: TMetric
  /**
   * Change the metric.
   * Runtime accepts only metrics currently present in `availableMetrics`.
   */
  setMetric: (metric: TMetric) => void
  /**
   * Metrics currently available at runtime.
   * Explicit `config.metric.allowed` narrows both this list and the setter type.
   */
  availableMetrics: TMetric[]

  // -- Time bucket --
  /** Current time bucket (only relevant when X-axis is date). */
  timeBucket: TTimeBucket
  /** Change the time bucket. Runtime accepts only values in `availableTimeBuckets`. */
  setTimeBucket: (bucket: TTimeBucket) => void
  /** Time buckets currently available for the active chart state and config. */
  availableTimeBuckets: TTimeBucket[]
  /** Whether time bucketing controls should be shown. */
  isTimeSeries: boolean
  /**
   * Whether line and area charts connect across null data points.
   * Derived from the schema's `connectNulls` option.
   */
  connectNulls: boolean

  // -- Filters --
  /** Active filter values per column. */
  filters: FilterState<TFilterColumnId>
  /**
   * Toggle a specific filter value on/off for a column.
   * Runtime accepts only values currently exposed through `availableFilters`.
   */
  toggleFilter: (columnId: TFilterColumnId, value: string) => void
  /** Clear all filters for a column when that column is currently filterable. */
  clearFilter: (columnId: TFilterColumnId) => void
  /** Clear all filters. */
  clearAllFilters: () => void
  /** Filter options currently available from the runtime data. */
  availableFilters: AvailableFilter<TFilterColumnId>[]

  // -- Sorting --
  /** Current sort configuration (null = default order). */
  sorting: SortConfig | null
  /** Change sorting. */
  setSorting: (sorting: SortConfig | null) => void

  // -- Date range --
  /** Date range for the active reference date column (computed from filtered data). */
  dateRange: DateRange<TDateColumnId> | null
  /** Which date column provides the visible date range context. */
  referenceDateId: TDateColumnId | null
  /**
   * Change the reference date column.
   * Runtime accepts only IDs currently present in `availableDateColumns`.
   */
  setReferenceDateId: (columnId: TDateColumnId) => void
  /** Date columns currently available as reference dates at runtime. */
  availableDateColumns: Array<{id: TDateColumnId; label: string}>
  /** Active date range preset (null = custom range via `dateRangeFilter`). */
  dateRangePreset: import('./date-range-presets.js').DateRangePresetId | null
  /**
   * Select a named date range preset.
   * The `dateRangeFilter` is derived automatically from the preset.
   * For `'auto'`, the filter adjusts reactively when the time bucket changes.
   */
  setDateRangePreset: (preset: import('./date-range-presets.js').DateRangePresetId) => void
  /** Active date range filter (null = all time). Derived from the preset when one is active. */
  dateRangeFilter: DateRangeFilter | null
  /**
   * Set the date range filter directly (custom range).
   * Clears any active preset — the range becomes "Custom".
   * Pass null to clear (show all time, equivalent to selecting 'all-time' preset).
   */
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

/** Single-source chart instance whose role-aware IDs are derived from `columnHints`. */
export type ChartInstanceFromHints<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
> = ChartInstance<
  T,
  ResolvedColumnIdFromHints<T, THints>,
  ChartType,
  ResolvedXAxisColumnIdFromHints<T, THints>,
  ResolvedGroupByColumnIdFromHints<T, THints>,
  ResolvedMetricColumnIdFromHints<T, THints>,
  Metric<ResolvedMetricColumnIdFromHints<T, THints>>,
  ResolvedFilterColumnIdFromHints<T, THints>,
  ResolvedDateColumnIdFromHints<T, THints>,
  TimeBucket
>

/** Single-source chart instance narrowed by both explicit hints and explicit config. */
export type ChartInstanceFromConfig<
  T,
  THints extends ColumnHints<T> | undefined = undefined,
  TConfig extends ChartConfigFromHints<T, THints> | undefined = undefined,
> = ChartInstance<
  T,
  ResolvedColumnIdFromHints<T, THints>,
  RestrictedChartTypeFromConfig<TConfig>,
  RestrictedXAxisColumnIdFromConfig<T, THints, TConfig>,
  RestrictedGroupByColumnIdFromConfig<T, THints, TConfig>,
  Extract<
    MetricColumnIdFromMetric<RestrictedMetricFromConfig<T, THints, TConfig>>,
    ResolvedMetricColumnIdFromHints<T, THints>
  >,
  RestrictedMetricFromConfig<T, THints, TConfig>,
  RestrictedFilterColumnIdFromConfig<T, THints, TConfig>,
  ResolvedDateColumnIdFromHints<T, THints>,
  RestrictedTimeBucketFromConfig<TConfig>
>

/** Single-source chart instance narrowed by one explicit schema. */
export type ChartInstanceFromSchema<
  T,
  TSchema extends ChartSchema<T, any> | undefined = undefined,
> = ChartInstance<
  T,
  ResolvedColumnIdFromSchema<T, TSchema>,
  RestrictedChartTypeFromSchema<TSchema>,
  RestrictedXAxisColumnIdFromSchema<T, TSchema>,
  RestrictedGroupByColumnIdFromSchema<T, TSchema>,
  Extract<
    MetricColumnIdFromMetric<RestrictedMetricFromSchema<T, TSchema>>,
    ResolvedMetricColumnIdFromSchema<T, TSchema>
  >,
  RestrictedMetricFromSchema<T, TSchema>,
  RestrictedFilterColumnIdFromSchema<T, TSchema>,
  ResolvedDateColumnIdFromSchema<T, TSchema>,
  RestrictedTimeBucketFromSchema<TSchema>
>

type SourceIdFromSource<TSource extends AnyChartSourceOptions> = TSource['id']
type SourceRowFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, any> ? TRow : never
type SourceColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? ResolvedColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
    : never
type SourceXAxisColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? RestrictedXAxisColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
    : never
type SourceGroupByColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? RestrictedGroupByColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
    : never
type SourceMetricColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? Extract<
        MetricColumnIdFromMetric<RestrictedMetricFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>>,
        ResolvedMetricColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
      >
    : never
type SourceFilterColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? RestrictedFilterColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
    : never
type SourceDateColumnIdFromSource<TSource extends AnyChartSourceOptions> =
  TSource extends ChartSourceOptions<string, infer TRow, infer TSchema>
    ? ResolvedDateColumnIdFromSchema<TRow, Extract<TSchema, ChartSchema<TRow> | undefined>>
    : never
type SourceIdFromSources<TSources extends NonEmptyChartSourceOptions> =
  Extract<TSources[number]['id'], string>
type SourceColumnIdFromSources<TSources extends NonEmptyChartSourceOptions> =
  TSources[number] extends infer TSource
    ? TSource extends AnyChartSourceOptions
      ? SourceColumnIdFromSource<TSource>
      : never
    : never

type MultiSourceChartBranch<
  TSources extends NonEmptyChartSourceOptions,
  TSource extends AnyChartSourceOptions,
> = Omit<
  ChartInstance<
    SourceRowFromSource<TSource>,
    SourceColumnIdFromSources<TSources>
  >,
  | 'activeSourceId'
  | 'setActiveSource'
  | 'sources'
  | 'xAxisId'
  | 'setXAxis'
  | 'availableXAxes'
  | 'groupById'
  | 'setGroupBy'
  | 'availableGroupBys'
  | 'metric'
  | 'setMetric'
  | 'availableMetrics'
  | 'filters'
  | 'toggleFilter'
  | 'clearFilter'
  | 'availableFilters'
  | 'dateRange'
  | 'referenceDateId'
  | 'setReferenceDateId'
  | 'availableDateColumns'
  | 'columns'
> & {
  activeSourceId: SourceIdFromSource<TSource>
  setActiveSource: (sourceId: SourceIdFromSources<TSources>) => void
  sources: Array<{id: SourceIdFromSources<TSources>; label: string}>
  xAxisId: SourceXAxisColumnIdFromSource<TSource> | null
  setXAxis: (columnId: SourceColumnIdFromSources<TSources>) => void
  availableXAxes: Array<{id: SourceXAxisColumnIdFromSource<TSource>; label: string; type: 'date' | 'category' | 'boolean'}>
  groupById: SourceGroupByColumnIdFromSource<TSource> | null
  setGroupBy: (columnId: SourceColumnIdFromSources<TSources> | null) => void
  availableGroupBys: Array<{id: SourceGroupByColumnIdFromSource<TSource>; label: string}>
  metric: Metric<SourceMetricColumnIdFromSource<TSource>>
  setMetric: (metric: Metric<SourceColumnIdFromSources<TSources>>) => void
  availableMetrics: Metric<SourceMetricColumnIdFromSource<TSource>>[]
  filters: FilterState<SourceFilterColumnIdFromSource<TSource>>
  toggleFilter: (columnId: SourceColumnIdFromSources<TSources>, value: string) => void
  clearFilter: (columnId: SourceColumnIdFromSources<TSources>) => void
  availableFilters: AvailableFilter<SourceFilterColumnIdFromSource<TSource>>[]
  dateRange: DateRange<SourceDateColumnIdFromSource<TSource>> | null
  referenceDateId: SourceDateColumnIdFromSource<TSource> | null
  setReferenceDateId: (columnId: SourceColumnIdFromSources<TSources>) => void
  availableDateColumns: Array<{id: SourceDateColumnIdFromSource<TSource>; label: string}>
  columns: readonly ChartColumn<SourceRowFromSource<TSource>, SourceColumnIdFromSource<TSource>>[]
}

/**
 * Direct multi-source hook return type.
 * Narrow on `activeSourceId` to recover the source-specific row and column IDs.
 */
export type MultiSourceChartInstance<TSources extends NonEmptyChartSourceOptions> =
  TSources[number] extends infer TSource
    ? TSource extends AnyChartSourceOptions
      ? MultiSourceChartBranch<TSources, TSource>
      : never
    : never
