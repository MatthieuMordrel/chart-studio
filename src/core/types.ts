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

/**
 * Override or exclude one inferred raw field inside `schema.columns`.
 *
 * This lightweight shape intentionally matches the inference override story so
 * callers can keep the common case terse while the surrounding `schema` object
 * becomes the single explicit chart contract.
 */
export type RawColumnSchemaFor<TValue, T> = ColumnHintFor<TValue, T>

/** Raw-field schema entries that target existing top-level dataset keys. */
export type RawColumnSchemaMap<T> = Partial<{
  [TKey in InferableFieldKey<T>]: RawColumnSchemaFor<T[TKey], T> | false
}>

/** Shared properties supported by every explicit derived column. */
type DerivedColumnSchemaBase<T, TValue, TType extends ChartColumnType> = BaseColumnHint<T, TValue> & {
  kind: 'derived'
  type: TType
}

/** Explicit derived date column definition. */
export type DerivedDateColumnSchema<T> = DerivedColumnSchemaBase<T, string | number | Date, 'date'> & {
  accessor: (item: T) => string | number | Date | null | undefined
}

/** Explicit derived category column definition. */
export type DerivedCategoryColumnSchema<T> = DerivedColumnSchemaBase<T, string, 'category'> & {
  accessor: (item: T) => string | null | undefined
}

/** Explicit derived boolean column definition. */
export type DerivedBooleanColumnSchema<T> = DerivedColumnSchemaBase<T, boolean, 'boolean'> & {
  accessor: (item: T) => boolean | null | undefined
  trueLabel?: string
  falseLabel?: string
}

/** Explicit derived numeric column definition. */
export type DerivedNumberColumnSchema<T> = DerivedColumnSchemaBase<T, number, 'number'> & {
  accessor: (item: T) => number | null | undefined
}

/** Any explicit derived column accepted in `schema.columns`. */
export type DerivedColumnSchema<T> =
  | DerivedDateColumnSchema<T>
  | DerivedCategoryColumnSchema<T>
  | DerivedBooleanColumnSchema<T>
  | DerivedNumberColumnSchema<T>

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

/** Single authoritative explicit chart schema. */
export type ChartSchema<
  T,
  TColumns extends Record<string, unknown> | undefined = Record<string, unknown> | undefined,
> = {
  columns?: TColumns & Partial<Record<InferableFieldKey<T>, unknown>>
  xAxis?: XAxisConfig<string>
  groupBy?: GroupByConfig<string>
  filters?: FiltersConfig<string>
  metric?: MetricConfig<string>
  chartType?: ChartTypeConfig
  timeBucket?: TimeBucketConfig
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
