import {
  createMetricBuilder,
  createSelectableControlBuilder,
  getMetricBuilderConfig,
  getSelectableControlConfig,
} from './chart-builder-controls.js'
import type {DatasetChartBuilder} from './dataset-builder.types.js'
import type {DatasetChartMetadata} from './dataset-chart-metadata.js'
import {DATASET_CHART_METADATA} from './dataset-chart-metadata.js'
import type {
  BooleanColumnOptions,
  BuilderSchemaState,
  CategoryColumnOptions,
  ColumnHelper,
  DateColumnOptions,
  NumberColumnOptions,
  SchemaColumnEntry,
} from './schema-builder.types.js'
import type {
  ChartType,
  ChartSchemaDefinition,
  ChartTypeConfig,
  FiltersConfig,
  GroupByConfig,
  MetricConfig,
  ResolvedChartSchemaFromDefinition,
  TimeBucket,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'

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
  owner = 'defineDataset',
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
  TOwner = unknown,
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
  metadata?: DatasetChartMetadata<TChartId, TOwner>,
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
  TChartId,
  TOwner
> {
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
  ) => createDatasetChartBuilder<
    TRow,
    TNextColumns,
    TNextXAxis,
    TNextGroupBy,
    TNextFilters,
    TNextMetric,
    TNextChartType,
    TNextTimeBucket,
    TNextConnectNulls,
    TChartId,
    TOwner
  >(nextState, metadata)

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
          DatasetChartBuilder<
            TRow,
            TColumns,
            TXAxis,
            TGroupBy,
            TFilters,
            TMetric,
            TChartType,
            TTimeBucket,
            TConnectNulls,
            TChartId,
            TOwner
          >['build']
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

      if (metadata) {
        Object.defineProperty(cachedSchema as object, DATASET_CHART_METADATA, {
          value: metadata,
          enumerable: false,
          configurable: false,
          writable: false,
        })
      }

      return cachedSchema as ReturnType<
        DatasetChartBuilder<
          TRow,
          TColumns,
          TXAxis,
          TGroupBy,
          TFilters,
          TMetric,
          TChartType,
          TTimeBucket,
          TConnectNulls,
          TChartId,
          TOwner
        >['build']
      >
    },
  }

  if (metadata) {
    Object.defineProperty(builder, DATASET_CHART_METADATA, {
      value: metadata,
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }

  return builder as DatasetChartBuilder<
    TRow,
    TColumns,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls,
    TChartId,
    TOwner
  >
}
