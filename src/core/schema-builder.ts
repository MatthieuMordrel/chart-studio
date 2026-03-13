import {isSameMetric, normalizeMetricAllowances} from './metric-utils.js'
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
  ChartTypeConfig,
  FiltersConfig,
  GroupByConfig,
  Metric,
  MetricAllowance,
  MetricConfig,
  NumericAggregateFunction,
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

const COLUMN_HELPER: ColumnHelper<any> = {
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

function buildColumnsMap<TRow>(
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

function assertColumnEntries<TRow>(
  entries: readonly SchemaColumnEntry<TRow>[],
): void {
  if (!Array.isArray(entries)) {
    throw new TypeError('defineChartSchema().columns(...) must return an array of column entries.')
  }
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
  return {
    columns(defineColumns) {
      const entries = defineColumns(COLUMN_HELPER as ColumnHelper<TRow>)
      assertColumnEntries(entries)

      return createChartSchemaBuilder<
        TRow,
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
    },
    xAxis(defineXAxis) {
      const builder = defineXAxis(createSelectableControlBuilder({}, true))

      return createChartSchemaBuilder({
        ...state,
        xAxis: getSelectableControlConfig(builder),
      })
    },
    groupBy(defineGroupBy) {
      const builder = defineGroupBy(createSelectableControlBuilder({}, true))

      return createChartSchemaBuilder({
        ...state,
        groupBy: getSelectableControlConfig(builder),
      })
    },
    filters(defineFilters) {
      const builder = defineFilters(createSelectableControlBuilder({}, false))

      return createChartSchemaBuilder({
        ...state,
        filters: getSelectableControlConfig(builder),
      })
    },
    metric(defineMetric) {
      const builder = defineMetric(createMetricBuilder())

      return createChartSchemaBuilder({
        ...state,
        metric: getMetricBuilderConfig(builder),
      })
    },
    chartType(defineChartType) {
      const builder = defineChartType(createSelectableControlBuilder<ChartType, true>({}, true))

      return createChartSchemaBuilder({
        ...state,
        chartType: getSelectableControlConfig(builder),
      })
    },
    timeBucket(defineTimeBucket) {
      const builder = defineTimeBucket(createSelectableControlBuilder<TimeBucket, true>({}, true))

      return createChartSchemaBuilder({
        ...state,
        timeBucket: getSelectableControlConfig(builder),
      })
    },
    connectNulls(value) {
      return createChartSchemaBuilder({
        ...state,
        connectNulls: value,
      })
    },
    build() {
      return {
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
    },
  } as ChartSchemaBuilder<
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
}
