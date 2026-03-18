import type {
  BaseColumnHint,
  ChartTypeConfig,
  CountMetric,
  DerivedBooleanColumnSchema,
  DerivedCategoryColumnSchema,
  DerivedDateColumnSchema,
  DerivedNumberColumnSchema,
  FiltersConfig,
  GroupByConfig,
  InferableFieldKey,
  Metric,
  MetricConfig,
  NumericAggregateFunction,
  RawColumnSchemaFor,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'

type Nullish = null | undefined

type NonNullish<T> = Exclude<T, Nullish>

type Simplify<T> = {
  [TKey in keyof T]: T[TKey]
} & {}

type NonEmptyReadonlyArray<TValue> = readonly [TValue, ...TValue[]]

type FieldKeyMatchingValue<T, TValue> = Extract<
  {
    [TKey in InferableFieldKey<T>]-?:
      [NonNullish<T[TKey]>] extends [TValue]
        ? TKey
        : never
  }[InferableFieldKey<T>],
  string
>

type ReplaceConfigValue<TConfig, TKey extends PropertyKey, TValue> = Simplify<
  Omit<TConfig, TKey> & {
    [TProperty in TKey]: TValue
  }
>

type AppendConfigValue<TConfig, TKey extends PropertyKey, TValue> = Simplify<
  Omit<TConfig, TKey> & {
    [TProperty in TKey]:
      TConfig extends Record<TKey, infer TExisting extends readonly unknown[]>
        ? readonly [...TExisting, TValue]
        : readonly [TValue]
  }
>

type AppendManyConfigValues<
  TConfig,
  TKey extends PropertyKey,
  TValues extends readonly unknown[],
> = Simplify<
  Omit<TConfig, TKey> & {
    [TProperty in TKey]:
      TConfig extends Record<TKey, infer TExisting extends readonly unknown[]>
        ? readonly [...TExisting, ...TValues]
        : TValues
  }
>

type AggregateSelectionFromList<TAggregates extends readonly NumericAggregateFunction[]> =
  TAggregates extends readonly [infer TOnlyAggregate extends NumericAggregateFunction]
    ? TOnlyAggregate
    : TAggregates

type MetricColumnIdFromMetric<TMetric> = Extract<
  TMetric extends {kind: 'aggregate'; columnId: infer TColumnId extends string}
    ? TColumnId
    : never,
  string
>

type MetricAggregateFromMetric<
  TMetric,
  TColumnId extends string,
> = Extract<
  Extract<TMetric, {kind: 'aggregate'; columnId: TColumnId}> extends {
    aggregate: infer TAggregate extends NumericAggregateFunction
  }
    ? TAggregate
    : never,
  NumericAggregateFunction
>

type AggregateMetricUnionFromSelection<
  TColumnId extends string,
  TAggregates extends readonly NumericAggregateFunction[],
> = {
  [TIndex in keyof TAggregates]:
    TAggregates[TIndex] extends NumericAggregateFunction
      ? {
          kind: 'aggregate'
          columnId: TColumnId
          aggregate: TAggregates[TIndex]
        }
      : never
}[number]

type AggregateMetricTupleFromSelection<
  TColumnId extends string,
  TAggregates extends readonly NumericAggregateFunction[],
> = TAggregates extends readonly [
  infer THead extends NumericAggregateFunction,
  ...infer TTail extends NumericAggregateFunction[],
]
  ? readonly [
      {
        kind: 'aggregate'
        columnId: TColumnId
        aggregate: THead
      },
      ...AggregateMetricTupleFromSelection<TColumnId, TTail>,
    ]
  : readonly []

type SelectableMetricUnion<
  TMetricColumnId extends string,
  TAllowedMetric,
> = [TAllowedMetric] extends [never]
  ? Metric<TMetricColumnId>
  : TAllowedMetric

type VisibleMetricUnion<
  TMetricColumnId extends string,
  TAllowedMetric,
  THiddenMetric,
> = Exclude<SelectableMetricUnion<TMetricColumnId, TAllowedMetric>, THiddenMetric>

type DerivedColumnId<
  TRow,
  TColumnId extends string,
> = TColumnId extends InferableFieldKey<TRow>
  ? never
  : TColumnId

type ColumnEntryId<TEntry> = TEntry extends {id: infer TId extends string}
  ? TId
  : never

type DuplicateColumnIds<
  TEntries extends readonly unknown[],
  TSeen extends string = never,
> = TEntries extends readonly [infer THead, ...infer TTail]
  ? ColumnEntryId<THead> extends TSeen
    ? ColumnEntryId<THead> | DuplicateColumnIds<TTail, TSeen>
    : DuplicateColumnIds<TTail, TSeen | ColumnEntryId<THead>>
  : never

type DuplicateColumnIdError<TColumnId extends string> = {
  __columnBuilderError__: `Duplicate column id "${TColumnId}"`
}

export type StringFieldKey<T> = FieldKeyMatchingValue<T, string>

export type NumberFieldKey<T> = FieldKeyMatchingValue<T, number>

export type BooleanFieldKey<T> = FieldKeyMatchingValue<T, boolean>

export type DateLikeFieldKey<T> = Extract<
  {
    [TKey in InferableFieldKey<T>]-?:
      [NonNullish<T[TKey]>] extends [string | number | Date]
        ? TKey
        : never
  }[InferableFieldKey<T>],
  string
>

export type SharedColumnOptions<TRow, TValue> = BaseColumnHint<TRow, TValue>

export type FieldColumnOptions<
  TRow,
  TFieldId extends InferableFieldKey<TRow>,
> = RawColumnSchemaFor<TRow[TFieldId], TRow>

export type DateColumnOptions<TRow> = SharedColumnOptions<TRow, string | number | Date>

export type CategoryColumnOptions<TRow> = SharedColumnOptions<TRow, string>

export type NumberColumnOptions<TRow> = SharedColumnOptions<TRow, number>

export type BooleanColumnOptions<TRow> = SharedColumnOptions<TRow, boolean> & {
  trueLabel?: string
  falseLabel?: string
}

export type DerivedDateColumnOptions<TRow> = Omit<
  DerivedDateColumnSchema<TRow>,
  'kind' | 'type'
>

export type DerivedCategoryColumnOptions<TRow> = Omit<
  DerivedCategoryColumnSchema<TRow>,
  'kind' | 'type'
>

export type DerivedBooleanColumnOptions<TRow> = Omit<
  DerivedBooleanColumnSchema<TRow>,
  'kind' | 'type'
>

export type DerivedNumberColumnOptions<TRow> = Omit<
  DerivedNumberColumnSchema<TRow>,
  'kind' | 'type'
>

export type RawFieldColumnEntry<
  TRow,
  TFieldId extends InferableFieldKey<TRow>,
  TColumn,
> = {
  readonly kind: 'raw'
  readonly id: TFieldId
  readonly column: TColumn
}

export type ExcludedFieldColumnEntry<
  TRow,
  TFieldId extends InferableFieldKey<TRow>,
> = {
  readonly kind: 'exclude'
  readonly id: TFieldId
  readonly column: false
}

export type DerivedColumnEntry<
  TRow,
  TColumnId extends string,
  TColumn extends
    | DerivedDateColumnSchema<TRow>
    | DerivedCategoryColumnSchema<TRow>
    | DerivedBooleanColumnSchema<TRow>
    | DerivedNumberColumnSchema<TRow>,
> = {
  readonly kind: 'derived'
  readonly id: TColumnId
  readonly column: TColumn
}

export type SchemaColumnEntry<TRow> =
  | RawFieldColumnEntry<TRow, InferableFieldKey<TRow>, unknown>
  | ExcludedFieldColumnEntry<TRow, InferableFieldKey<TRow>>
  | DerivedColumnEntry<
      TRow,
      string,
      | DerivedDateColumnSchema<TRow>
      | DerivedCategoryColumnSchema<TRow>
      | DerivedBooleanColumnSchema<TRow>
      | DerivedNumberColumnSchema<TRow>
    >

export type ValidateColumnEntries<
  TEntries extends readonly unknown[],
> = [DuplicateColumnIds<TEntries>] extends [never]
  ? unknown
  : DuplicateColumnIdError<Extract<DuplicateColumnIds<TEntries>, string>>

export type ColumnsFromEntries<
  TRow,
  TEntries extends readonly SchemaColumnEntry<TRow>[],
> = Simplify<
  {
    [TEntry in TEntries[number] as TEntry['id']]: TEntry['column']
  }
>

export interface ColumnHelper<TRow> {
  /**
   * Override one existing raw field using the raw-field schema surface.
   *
   * Use this when you want the full hint surface for a field, including type
   * overrides on string/number columns.
   */
  field<const TFieldId extends InferableFieldKey<TRow>>(
    id: TFieldId,
    options?: FieldColumnOptions<TRow, TFieldId>,
  ): RawFieldColumnEntry<
    TRow,
    TFieldId,
    FieldColumnOptions<TRow, TFieldId>
  >

  /**
   * Treat one raw field as a date column.
   *
   * Supports raw `string`, `number`, and `Date` fields that should behave as a
   * time-series axis.
   */
  date<const TFieldId extends DateLikeFieldKey<TRow>>(
    id: TFieldId,
    options?: DateColumnOptions<TRow>,
  ): RawFieldColumnEntry<
    TRow,
    TFieldId,
    {
      type: 'date'
    } & DateColumnOptions<TRow>
  >

  /**
   * Treat one raw string field as a category column.
   *
   * Category columns are eligible for the X-axis, grouping, and filters.
   */
  category<const TFieldId extends StringFieldKey<TRow>>(
    id: TFieldId,
    options?: CategoryColumnOptions<TRow>,
  ): RawFieldColumnEntry<
    TRow,
    TFieldId,
    {
      type: 'category'
    } & CategoryColumnOptions<TRow>
  >

  /**
   * Treat one raw numeric field as a number column.
   *
   * Number columns participate in metric aggregation.
   */
  number<const TFieldId extends NumberFieldKey<TRow>>(
    id: TFieldId,
    options?: NumberColumnOptions<TRow>,
  ): RawFieldColumnEntry<
    TRow,
    TFieldId,
    {
      type: 'number'
    } & NumberColumnOptions<TRow>
  >

  /**
   * Treat one raw boolean field as a boolean column.
   *
   * Boolean columns are useful for grouping and filters.
   */
  boolean<const TFieldId extends BooleanFieldKey<TRow>>(
    id: TFieldId,
    options?: BooleanColumnOptions<TRow>,
  ): RawFieldColumnEntry<
    TRow,
    TFieldId,
    {
      type: 'boolean'
    } & BooleanColumnOptions<TRow>
  >

  /**
   * Remove one raw field from the chart schema entirely.
   */
  exclude<const TFieldId extends InferableFieldKey<TRow>>(
    id: TFieldId,
  ): ExcludedFieldColumnEntry<TRow, TFieldId>

  /** Helper group for declaring new derived columns. */
  readonly derived: {
    /**
     * Add one derived date column.
     *
     * The accessor receives the original row type.
     */
    date<const TColumnId extends string>(
      id: DerivedColumnId<TRow, TColumnId>,
      options: DerivedDateColumnOptions<TRow>,
    ): DerivedColumnEntry<
      TRow,
      TColumnId,
      {
        kind: 'derived'
        type: 'date'
      } & DerivedDateColumnOptions<TRow>
    >

    /**
     * Add one derived category column.
     *
     * The accessor receives the original row type.
     */
    category<const TColumnId extends string>(
      id: DerivedColumnId<TRow, TColumnId>,
      options: DerivedCategoryColumnOptions<TRow>,
    ): DerivedColumnEntry<
      TRow,
      TColumnId,
      {
        kind: 'derived'
        type: 'category'
      } & DerivedCategoryColumnOptions<TRow>
    >

    /**
     * Add one derived boolean column.
     *
     * The accessor receives the original row type.
     */
    boolean<const TColumnId extends string>(
      id: DerivedColumnId<TRow, TColumnId>,
      options: DerivedBooleanColumnOptions<TRow>,
    ): DerivedColumnEntry<
      TRow,
      TColumnId,
      {
        kind: 'derived'
        type: 'boolean'
      } & DerivedBooleanColumnOptions<TRow>
    >

    /**
     * Add one derived numeric column.
     *
     * The accessor receives the original row type.
     */
    number<const TColumnId extends string>(
      id: DerivedColumnId<TRow, TColumnId>,
      options: DerivedNumberColumnOptions<TRow>,
    ): DerivedColumnEntry<
      TRow,
      TColumnId,
      {
        kind: 'derived'
        type: 'number'
      } & DerivedNumberColumnOptions<TRow>
    >
  }
}

export type SelectableControlBuilderConfig<TBuilder> =
  TBuilder extends SelectableControlBuilder<any, any, any, any, infer TConfig>
    ? TConfig
    : never

export interface SelectableControlBuilder<
  TOption extends string,
  TSupportsDefault extends boolean,
  TAllowedOption extends TOption = TOption,
  THiddenOption extends TOption = never,
  TConfig extends object = {},
> {
  /**
   * Keep only the listed options visible and selectable.
   *
   * Calling `allowed(...)` again replaces the previous allowed list.
   */
  allowed<const TOptions extends NonEmptyReadonlyArray<TOption>>(
    ...options: TOptions
  ): SelectableControlBuilder<
    TOption,
    TSupportsDefault,
    Extract<TOptions[number], TOption>,
    Extract<THiddenOption, Extract<TOptions[number], TOption>>,
    ReplaceConfigValue<TConfig, 'allowed', TOptions>
  >

  /**
   * Hide one or more options after the allowed set is resolved.
   *
   * Hidden options can still exist in the broader schema; they simply stop
   * appearing in the public control surface.
   */
  hidden<const TOptions extends NonEmptyReadonlyArray<Exclude<TAllowedOption, THiddenOption>>>(
    ...options: TOptions
  ): SelectableControlBuilder<
    TOption,
    TSupportsDefault,
    TAllowedOption,
    THiddenOption | Extract<TOptions[number], TOption>,
    AppendConfigValue<TConfig, 'hidden', TOptions[number]>
  >

  /**
   * Set the preferred fallback option when the current selection is missing or
   * invalid for the current schema.
   */
  default: TSupportsDefault extends true
    ? <const TDefaultOption extends Exclude<TAllowedOption, THiddenOption>>(
        option: TDefaultOption,
      ) => SelectableControlBuilder<
        TOption,
        TSupportsDefault,
        TAllowedOption,
        THiddenOption,
        ReplaceConfigValue<TConfig, 'default', TDefaultOption>
      >
    : never
}

export type MetricBuilderConfig<TBuilder> =
  TBuilder extends MetricBuilder<any, any, any, infer TConfig>
    ? TConfig
    : never

export interface MetricBuilder<
  TMetricColumnId extends string,
  TAllowedMetric = never,
  THiddenMetric = never,
  TConfig extends object = {},
> {
  /**
   * Allow the built-in row count metric.
   */
  count(): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric | CountMetric,
    THiddenMetric,
    AppendConfigValue<TConfig, 'allowed', CountMetric>
  >

  /**
   * Allow one or more numeric aggregates for the given column.
   *
   * Example: `aggregate('salary', 'sum', 'avg')`
   */
  aggregate<
    const TColumnId extends TMetricColumnId,
    const TAggregates extends NonEmptyReadonlyArray<NumericAggregateFunction>,
  >(
    columnId: TColumnId,
    ...aggregates: TAggregates
  ): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric | AggregateMetricUnionFromSelection<TColumnId, TAggregates>,
    THiddenMetric,
    AppendConfigValue<
      TConfig,
      'allowed',
      {
        kind: 'aggregate'
        columnId: TColumnId
        aggregate: AggregateSelectionFromList<TAggregates>
      }
    >
  >

  /**
   * Hide the row count metric from the public metric picker.
   */
  hideCount(
    ...args: CountMetric extends VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>
      ? []
      : [never]
  ): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric,
    THiddenMetric | CountMetric,
    AppendConfigValue<TConfig, 'hidden', CountMetric>
  >

  /**
   * Hide one or more aggregate metrics for a numeric column.
   */
  hideAggregate<
    const TColumnId extends MetricColumnIdFromMetric<VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>>,
    const TAggregates extends NonEmptyReadonlyArray<
      MetricAggregateFromMetric<VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>, TColumnId>
    >,
  >(
    columnId: TColumnId,
    ...aggregates: TAggregates
  ): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric,
    THiddenMetric | AggregateMetricUnionFromSelection<TColumnId, TAggregates>,
    AppendManyConfigValues<
      TConfig,
      'hidden',
      AggregateMetricTupleFromSelection<TColumnId, TAggregates>
    >
  >

  /**
   * Prefer the row count metric when the current metric becomes invalid.
   */
  defaultCount(
    ...args: CountMetric extends VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>
      ? []
      : [never]
  ): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric,
    THiddenMetric,
    ReplaceConfigValue<TConfig, 'default', CountMetric>
  >

  /**
   * Prefer one aggregate metric when the current metric becomes invalid.
   */
  defaultAggregate<
    const TColumnId extends MetricColumnIdFromMetric<VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>>,
    const TAggregate extends MetricAggregateFromMetric<
      VisibleMetricUnion<TMetricColumnId, TAllowedMetric, THiddenMetric>,
      TColumnId
    >,
  >(
    columnId: TColumnId,
    aggregate: TAggregate,
  ): MetricBuilder<
    TMetricColumnId,
    TAllowedMetric,
    THiddenMetric,
    ReplaceConfigValue<
      TConfig,
      'default',
      {
        kind: 'aggregate'
        columnId: TColumnId
        aggregate: TAggregate
      }
    >
  >
}

export type SchemaFromBuilder<
  TColumns extends Record<string, unknown> | undefined,
  TXAxis extends XAxisConfig<any> | undefined,
  TGroupBy extends GroupByConfig<any> | undefined,
  TFilters extends FiltersConfig<any> | undefined,
  TMetric extends MetricConfig<any> | undefined,
  TChartType extends ChartTypeConfig | undefined,
  TTimeBucket extends TimeBucketConfig | undefined,
  TConnectNulls extends boolean | undefined,
> = {
  columns?: Extract<TColumns, Record<string, unknown> | undefined>
  xAxis?: Extract<TXAxis, XAxisConfig<any> | undefined>
  groupBy?: Extract<TGroupBy, GroupByConfig<any> | undefined>
  filters?: Extract<TFilters, FiltersConfig<any> | undefined>
  metric?: Extract<TMetric, MetricConfig<any> | undefined>
  chartType?: Extract<TChartType, ChartTypeConfig | undefined>
  timeBucket?: Extract<TTimeBucket, TimeBucketConfig | undefined>
  connectNulls?: Extract<TConnectNulls, boolean | undefined>
}

export type BuilderSchemaState<
  TColumns extends Record<string, unknown> | undefined,
  TXAxis extends XAxisConfig<any> | undefined,
  TGroupBy extends GroupByConfig<any> | undefined,
  TFilters extends FiltersConfig<any> | undefined,
  TMetric extends MetricConfig<any> | undefined,
  TChartType extends ChartTypeConfig | undefined,
  TTimeBucket extends TimeBucketConfig | undefined,
  TConnectNulls extends boolean | undefined,
> = {
  columns?: TColumns
  xAxis?: TXAxis
  groupBy?: TGroupBy
  filters?: TFilters
  metric?: TMetric
  chartType?: TChartType
  timeBucket?: TTimeBucket
  connectNulls?: TConnectNulls
}
