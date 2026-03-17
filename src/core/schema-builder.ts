import {isSameMetric, normalizeMetricAllowances} from './metric-utils.js'
import type {DatasetChartBuilder} from './dataset-builder.types.js'
import type {DatasetChartMetadata} from './dataset-chart-metadata.js'
import {DATASET_CHART_METADATA} from './dataset-chart-metadata.js'
import type {
  BooleanColumnOptions,
  BuilderSchemaState,
  CategoryColumnOptions,
  ChartSchemaBuilder,
  ColumnHelper,
  ColumnsFromEntries,
  DateColumnOptions,
  MetricBuilder,
  MetricBuilderConfig,
  NumberColumnOptions,
  SchemaColumnEntry,
  SelectableControlBuilder,
  SelectableControlBuilderConfig,
} from './schema-builder.types.js'
import type {
  ChartType,
  ChartSchemaDefinition,
  ChartTypeConfig,
  FiltersConfig,
  GroupByConfig,
  Metric,
  MetricAllowance,
  MetricConfig,
  NumericAggregateFunction,
  ResolvedChartSchemaFromDefinition,
  TimeBucket,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'

const SELECTABLE_CONTROL_CONFIG = Symbol('chart-schema-selectable-control-config')
const METRIC_CONTROL_CONFIG = Symbol('chart-schema-metric-config')

type SelectableControlRuntime<TConfig extends object> = {
  readonly [SELECTABLE_CONTROL_CONFIG]: TConfig
}

type MetricControlRuntime<TConfig extends object> = {
  readonly [METRIC_CONTROL_CONFIG]: TConfig
}

type RuntimeSelectableConfig<TOption extends string> = {
  allowed?: readonly TOption[]
  hidden?: readonly TOption[]
  default?: TOption
}

type RuntimeMetricConfig<TColumnId extends string> = {
  allowed?: readonly MetricAllowance<TColumnId>[]
  hidden?: readonly Metric<TColumnId>[]
  default?: Metric<TColumnId>
}

export const COLUMN_HELPER: ColumnHelper<any> = {
  field(id, options = {}) {
    return {
      kind: 'raw',
      id,
      column: options,
    }
  },
  date(id, options: DateColumnOptions<any> = {}) {
    return {
      kind: 'raw',
      id,
      column: {
        type: 'date',
        ...options,
      },
    }
  },
  category(id, options: CategoryColumnOptions<any> = {}) {
    return {
      kind: 'raw',
      id,
      column: {
        type: 'category',
        ...options,
      },
    }
  },
  number(id, options: NumberColumnOptions<any> = {}) {
    return {
      kind: 'raw',
      id,
      column: {
        type: 'number',
        ...options,
      },
    }
  },
  boolean(id, options: BooleanColumnOptions<any> = {}) {
    return {
      kind: 'raw',
      id,
      column: {
        type: 'boolean',
        ...options,
      },
    }
  },
  exclude(id) {
    return {
      kind: 'exclude',
      id,
      column: false,
    }
  },
  derived: {
    date(id, options) {
      return {
        kind: 'derived',
        id,
        column: {
          kind: 'derived',
          type: 'date',
          ...options,
        },
      }
    },
    category(id, options) {
      return {
        kind: 'derived',
        id,
        column: {
          kind: 'derived',
          type: 'category',
          ...options,
        },
      }
    },
    boolean(id, options) {
      return {
        kind: 'derived',
        id,
        column: {
          kind: 'derived',
          type: 'boolean',
          ...options,
        },
      }
    },
    number(id, options) {
      return {
        kind: 'derived',
        id,
        column: {
          kind: 'derived',
          type: 'number',
          ...options,
        },
      }
    },
  },
}

function uniqueValues<TValue>(
  values: readonly TValue[] | undefined,
): TValue[] | undefined {
  if (!values || values.length === 0) {
    return undefined
  }

  return [...new Set(values)]
}

function sanitizeSelectableControlConfig<TOption extends string>(
  config: RuntimeSelectableConfig<TOption>,
  supportsDefault: boolean,
): RuntimeSelectableConfig<TOption> {
  const allowed = uniqueValues(config.allowed)
  let hidden = uniqueValues(config.hidden)

  if (allowed && hidden) {
    const allowedSet = new Set(allowed)
    hidden = hidden.filter(option => allowedSet.has(option))
  }

  let nextDefault = supportsDefault ? config.default : undefined
  if (nextDefault !== undefined) {
    if (allowed && !allowed.includes(nextDefault)) {
      nextDefault = undefined
    }

    if (nextDefault !== undefined && hidden?.includes(nextDefault)) {
      nextDefault = undefined
    }
  }

  const nextConfig: RuntimeSelectableConfig<TOption> = {}
  if (allowed && allowed.length > 0) {
    nextConfig.allowed = allowed
  }
  if (hidden && hidden.length > 0) {
    nextConfig.hidden = hidden
  }
  if (nextDefault !== undefined) {
    nextConfig.default = nextDefault
  }

  return nextConfig
}

function createSelectableControlBuilder<
  TOption extends string,
  TSupportsDefault extends boolean,
  TAllowedOption extends TOption = TOption,
  THiddenOption extends TOption = never,
  TConfig extends object = {},
>(
  config: RuntimeSelectableConfig<TOption> = {},
  supportsDefault: TSupportsDefault,
): SelectableControlBuilder<
  TOption,
  TSupportsDefault,
  TAllowedOption,
  THiddenOption,
  TConfig
> & SelectableControlRuntime<TConfig> {
  const nextConfig = sanitizeSelectableControlConfig(config, supportsDefault)

  return {
    allowed(...options: TOption[]) {
      return createSelectableControlBuilder(
        {
          ...nextConfig,
          allowed: options,
        },
        supportsDefault,
      )
    },
    hidden(...options: TOption[]) {
      return createSelectableControlBuilder(
        {
          ...nextConfig,
          hidden: [
            ...(nextConfig.hidden ?? []),
            ...options,
          ],
        },
        supportsDefault,
      )
    },
    default(option: TOption) {
      return createSelectableControlBuilder(
        {
          ...nextConfig,
          default: option,
        },
        supportsDefault,
      )
    },
    [SELECTABLE_CONTROL_CONFIG]: nextConfig as TConfig,
  } as unknown as SelectableControlBuilder<
    TOption,
    TSupportsDefault,
    TAllowedOption,
    THiddenOption,
    TConfig
  > & SelectableControlRuntime<TConfig>
}

function uniqueMetrics<TColumnId extends string>(
  metrics: readonly Metric<TColumnId>[] | undefined,
): Metric<TColumnId>[] | undefined {
  if (!metrics || metrics.length === 0) {
    return undefined
  }

  const unique: Metric<TColumnId>[] = []

  for (const metric of metrics) {
    if (!unique.some(candidate => isSameMetric(candidate, metric))) {
      unique.push(metric)
    }
  }

  return unique
}

function sanitizeMetricConfig<TColumnId extends string>(
  config: RuntimeMetricConfig<TColumnId>,
): RuntimeMetricConfig<TColumnId> {
  const allowed = config.allowed && config.allowed.length > 0
    ? [...config.allowed]
    : undefined
  let hidden = uniqueMetrics(config.hidden)
  const expandedAllowed = normalizeMetricAllowances(allowed)

  if (expandedAllowed && hidden) {
    hidden = hidden.filter(metric =>
      expandedAllowed.some(allowedMetric => isSameMetric(allowedMetric, metric))
    )
  }

  let nextDefault = config.default
  if (nextDefault) {
    const defaultMetric = nextDefault

    if (expandedAllowed && !expandedAllowed.some(metric => isSameMetric(metric, defaultMetric))) {
      nextDefault = undefined
    }

    if (nextDefault) {
      const visibleDefault = nextDefault

      if (hidden?.some(metric => isSameMetric(metric, visibleDefault))) {
        nextDefault = undefined
      }
    }
  }

  const nextConfig: RuntimeMetricConfig<TColumnId> = {}
  if (allowed && allowed.length > 0) {
    nextConfig.allowed = allowed
  }
  if (hidden && hidden.length > 0) {
    nextConfig.hidden = hidden
  }
  if (nextDefault) {
    nextConfig.default = nextDefault
  }

  return nextConfig
}

function createMetricBuilder<
  TColumnId extends string,
  TAllowedMetric = never,
  THiddenMetric = never,
  TConfig extends object = {},
>(
  config: RuntimeMetricConfig<TColumnId> = {},
): MetricBuilder<TColumnId, TAllowedMetric, THiddenMetric, TConfig> & MetricControlRuntime<TConfig> {
  const nextConfig = sanitizeMetricConfig(config)

  return {
    count() {
      return createMetricBuilder({
        ...nextConfig,
        allowed: [
          ...(nextConfig.allowed ?? []),
          {kind: 'count'},
        ],
      })
    },
    aggregate(
      columnId: TColumnId,
      firstAggregate: NumericAggregateFunction,
      ...restAggregates: NumericAggregateFunction[]
    ) {
      const aggregates = [firstAggregate, ...restAggregates]
      const selection = restAggregates.length === 0 ? firstAggregate : aggregates

      return createMetricBuilder({
        ...nextConfig,
        allowed: [
          ...(nextConfig.allowed ?? []),
          {
            kind: 'aggregate',
            columnId,
            aggregate: selection,
          },
        ],
      })
    },
    hideCount() {
      return createMetricBuilder({
        ...nextConfig,
        hidden: [
          ...(nextConfig.hidden ?? []),
          {kind: 'count'},
        ],
      })
    },
    hideAggregate(
      columnId: TColumnId,
      firstAggregate: NumericAggregateFunction,
      ...restAggregates: NumericAggregateFunction[]
    ) {
      const aggregates = [firstAggregate, ...restAggregates]

      return createMetricBuilder({
        ...nextConfig,
        hidden: [
          ...(nextConfig.hidden ?? []),
          ...aggregates.map(aggregate => ({
            kind: 'aggregate' as const,
            columnId,
            aggregate,
          })),
        ],
      })
    },
    defaultCount() {
      return createMetricBuilder({
        ...nextConfig,
        default: {kind: 'count'},
      })
    },
    defaultAggregate(columnId: TColumnId, aggregate: NumericAggregateFunction) {
      return createMetricBuilder({
        ...nextConfig,
        default: {
          kind: 'aggregate',
          columnId,
          aggregate,
        },
      })
    },
    [METRIC_CONTROL_CONFIG]: nextConfig as TConfig,
  } as unknown as MetricBuilder<TColumnId, TAllowedMetric, THiddenMetric, TConfig> & MetricControlRuntime<TConfig>
}

function getSelectableControlConfig<TBuilder>(
  builder: TBuilder,
): SelectableControlBuilderConfig<TBuilder> {
  return (builder as SelectableControlRuntime<SelectableControlBuilderConfig<TBuilder>>)[SELECTABLE_CONTROL_CONFIG]
}

function getMetricBuilderConfig<TBuilder>(
  builder: TBuilder,
): MetricBuilderConfig<TBuilder> {
  return (builder as MetricControlRuntime<MetricBuilderConfig<TBuilder>>)[METRIC_CONTROL_CONFIG]
}

export function buildColumnsMap<TRow>(
  entries: readonly SchemaColumnEntry<TRow>[],
): Record<string, unknown> {
  const columns: Record<string, unknown> = {}

  for (const entry of entries) {
    if (entry.id in columns) {
      throw new Error(`Duplicate chart schema column id: "${entry.id}"`)
    }

    columns[entry.id] = entry.column
  }

  return columns
}

export function assertColumnEntries<TRow>(
  entries: readonly SchemaColumnEntry<TRow>[],
  owner = 'defineChartSchema',
): void {
  if (!Array.isArray(entries)) {
    throw new TypeError(`${owner}().columns(...) must return an array of column entries.`)
  }
}

export function resolveChartSchemaDefinition<
  T,
  TSchema extends ChartSchemaDefinition<T, any> | undefined,
>(
  schema: TSchema,
): ResolvedChartSchemaFromDefinition<TSchema> {
  if (!schema) {
    return undefined as ResolvedChartSchemaFromDefinition<TSchema>
  }

  if (typeof schema === 'object' && 'build' in schema && typeof schema.build === 'function') {
    return schema.build() as ResolvedChartSchemaFromDefinition<TSchema>
  }

  return schema as ResolvedChartSchemaFromDefinition<TSchema>
}

function createChartDefinitionBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
  TAllowColumns extends boolean = true,
  TChartId extends string | undefined = undefined,
>(
  state: BuilderSchemaState<
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  > = {},
  options: {
    allowColumns: TAllowColumns
    datasetChartMetadata?: DatasetChartMetadata<TChartId>
  },
): (
  TAllowColumns extends true
    ? ChartSchemaBuilder<
        TRow,
        TColumns,
        TXAxis,
        TGroupBy,
        TFilters,
        TMetric,
        TChartType,
        TTimeBucket,
        TConnectNulls
      >
    : DatasetChartBuilder<
        TRow,
        TColumns,
        TXAxis,
        TGroupBy,
        TFilters,
        TMetric,
        TChartType,
        TTimeBucket,
        TConnectNulls,
        TChartId
      >
) {
  let cachedSchema: unknown

  const createNext = <
    TNextColumns extends Record<string, unknown> | undefined = TColumns,
    TNextXAxis extends XAxisConfig<any> | undefined = TXAxis,
    TNextGroupBy extends GroupByConfig<any> | undefined = TGroupBy,
    TNextFilters extends FiltersConfig<any> | undefined = TFilters,
    TNextMetric extends MetricConfig<any> | undefined = TMetric,
    TNextChartType extends ChartTypeConfig | undefined = TChartType,
    TNextTimeBucket extends TimeBucketConfig | undefined = TTimeBucket,
    TNextConnectNulls extends boolean | undefined = TConnectNulls,
  >(
    nextState: BuilderSchemaState<
      TNextColumns,
      TNextXAxis,
      TNextGroupBy,
      TNextFilters,
      TNextMetric,
      TNextChartType,
      TNextTimeBucket,
      TNextConnectNulls
    >,
  ) => createChartDefinitionBuilder<
    TRow,
    TNextColumns,
    TNextXAxis,
    TNextGroupBy,
    TNextFilters,
    TNextMetric,
    TNextChartType,
    TNextTimeBucket,
    TNextConnectNulls,
    TAllowColumns,
    TChartId
  >(nextState, options)

  const builder: Record<string, unknown> = {
    xAxis(defineXAxis: any) {
      const builder = defineXAxis(createSelectableControlBuilder({}, true))

      return createNext({
        ...state,
        xAxis: getSelectableControlConfig(builder),
      })
    },
    groupBy(defineGroupBy: any) {
      const builder = defineGroupBy(createSelectableControlBuilder({}, true))

      return createNext({
        ...state,
        groupBy: getSelectableControlConfig(builder),
      })
    },
    filters(defineFilters: any) {
      const builder = defineFilters(createSelectableControlBuilder({}, false))

      return createNext({
        ...state,
        filters: getSelectableControlConfig(builder),
      })
    },
    metric(defineMetric: any) {
      const builder = defineMetric(createMetricBuilder())

      return createNext({
        ...state,
        metric: getMetricBuilderConfig(builder),
      })
    },
    chartType(defineChartType: any) {
      const builder = defineChartType(createSelectableControlBuilder<ChartType, true>({}, true))

      return createNext({
        ...state,
        chartType: getSelectableControlConfig(builder),
      })
    },
    timeBucket(defineTimeBucket: any) {
      const builder = defineTimeBucket(createSelectableControlBuilder<TimeBucket, true>({}, true))

      return createNext({
        ...state,
        timeBucket: getSelectableControlConfig(builder),
      })
    },
    connectNulls(value: any) {
      return createNext({
        ...state,
        connectNulls: value,
      })
    },
    build() {
      if (cachedSchema) {
        return cachedSchema as ReturnType<
          (
            TAllowColumns extends true
              ? ChartSchemaBuilder<
                  TRow,
                  TColumns,
                  TXAxis,
                  TGroupBy,
                  TFilters,
                  TMetric,
                  TChartType,
                  TTimeBucket,
                  TConnectNulls
                >
              : DatasetChartBuilder<
                  TRow,
                  TColumns,
                  TXAxis,
                  TGroupBy,
                  TFilters,
                  TMetric,
                  TChartType,
                  TTimeBucket,
                  TConnectNulls,
                  TChartId
                >
          )['build']
        >
      }

      cachedSchema = {
        ...(state.columns !== undefined ? {columns: state.columns} : {}),
        ...(state.xAxis !== undefined ? {xAxis: state.xAxis} : {}),
        ...(state.groupBy !== undefined ? {groupBy: state.groupBy} : {}),
        ...(state.filters !== undefined ? {filters: state.filters} : {}),
        ...(state.metric !== undefined ? {metric: state.metric} : {}),
        ...(state.chartType !== undefined ? {chartType: state.chartType} : {}),
        ...(state.timeBucket !== undefined ? {timeBucket: state.timeBucket} : {}),
        ...(state.connectNulls !== undefined ? {connectNulls: state.connectNulls} : {}),
        __chartSchemaBrand: 'chart-schema-definition',
      }

      if (options.datasetChartMetadata) {
        Object.defineProperty(cachedSchema as object, DATASET_CHART_METADATA, {
          value: options.datasetChartMetadata,
          enumerable: false,
          configurable: false,
          writable: false,
        })
      }

      return cachedSchema as ReturnType<
        (
          TAllowColumns extends true
            ? ChartSchemaBuilder<
                TRow,
                TColumns,
                TXAxis,
                TGroupBy,
                TFilters,
                TMetric,
                TChartType,
                TTimeBucket,
                TConnectNulls
              >
            : DatasetChartBuilder<
                TRow,
                TColumns,
                TXAxis,
                TGroupBy,
                TFilters,
                TMetric,
                TChartType,
                TTimeBucket,
                TConnectNulls,
                TChartId
              >
        )['build']
      >
    },
  }

  if (options.datasetChartMetadata) {
    Object.defineProperty(builder, DATASET_CHART_METADATA, {
      value: options.datasetChartMetadata,
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }

  if (options.allowColumns) {
    builder['columns'] = (defineColumns: (columns: ColumnHelper<TRow>) => readonly SchemaColumnEntry<TRow>[]) => {
      const entries = defineColumns(COLUMN_HELPER as ColumnHelper<TRow>)
      assertColumnEntries(entries)

      return createNext<
        ColumnsFromEntries<TRow, typeof entries>,
        TXAxis,
        TGroupBy,
        TFilters,
        TMetric,
        TChartType,
        TTimeBucket,
        TConnectNulls
      >({
        ...state,
        columns: buildColumnsMap(entries) as ColumnsFromEntries<TRow, typeof entries>,
      })
    }
  }

  return builder as (
    TAllowColumns extends true
      ? ChartSchemaBuilder<
          TRow,
          TColumns,
          TXAxis,
          TGroupBy,
          TFilters,
          TMetric,
          TChartType,
          TTimeBucket,
          TConnectNulls
        >
      : DatasetChartBuilder<
          TRow,
          TColumns,
          TXAxis,
          TGroupBy,
          TFilters,
          TMetric,
          TChartType,
          TTimeBucket,
          TConnectNulls,
          TChartId
        >
  )
}

export function createChartSchemaBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
>(
  state: BuilderSchemaState<
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  > = {},
): ChartSchemaBuilder<
  TRow,
  TColumns,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls
> {
  return createChartDefinitionBuilder(state, {allowColumns: true})
}

export function createDatasetChartBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
  TChartId extends string | undefined = undefined,
>(
  state: BuilderSchemaState<
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  > = {},
  metadata?: DatasetChartMetadata<TChartId>,
): DatasetChartBuilder<
  TRow,
  TColumns,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls,
  TChartId
> {
  return createChartDefinitionBuilder(state, {
    allowColumns: false,
    datasetChartMetadata: metadata,
  })
}
