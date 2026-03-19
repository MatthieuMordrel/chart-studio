import {
  createMetricBuilder,
  createSelectableControlBuilder,
  getMetricBuilderConfig,
  getSelectableControlConfig,
} from './chart-builder-controls.js'
import type {
  AnyDefinedDataModel,
  DefinedDataModel,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import {createDatasetChartBuilder} from './schema-builder.js'
import type {
  BuilderSchemaState,
  MetricBuilder,
  SelectableControlBuilder,
} from './schema-builder.types.js'
import {resolveRelationshipAlias} from './model-inference.js'
import type {
  CompileModelChartDefinition,
  InferredModelChartBuilder,
  ModelChartBuilder,
  ModelChartStartBuilder,
} from './model-chart.types.js'
import type {
  ChartType,
  ChartTypeConfig,
  FiltersConfig,
  GroupByConfig,
  Metric,
  MetricConfig,
  TimeBucket,
  TimeBucketConfig,
  XAxisConfig,
} from './types.js'

const MODEL_CHART_STATE = Symbol('model-chart-state')

type ModelChartRuntimeState = {
  baseDatasetId?: string
  xAxis?: XAxisConfig<string>
  groupBy?: GroupByConfig<string>
  filters?: FiltersConfig<string>
  metric?: MetricConfig<string>
  chartType?: ChartTypeConfig
  timeBucket?: TimeBucketConfig
  connectNulls?: boolean
}

type RuntimeRelationship = ModelRelationshipDefinition<string, string, string, string>

type ResolvedChartField = {
  compiledId: string
  lookup?: {
    alias: string
    relationship: RuntimeRelationship
    columnId: string
  }
}

function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`
}

function getModelChartState<TBuilder>(
  builder: TBuilder,
): ModelChartRuntimeState {
  return (builder as Record<PropertyKey, unknown>)[MODEL_CHART_STATE] as ModelChartRuntimeState
}

function getQualifiedBaseDatasetId(
  model: AnyDefinedDataModel,
  fieldId: string,
): string | undefined {
  const [datasetId, ...rest] = fieldId.split('.')
  if (!datasetId || rest.length === 0) {
    return undefined
  }

  return datasetId in model.datasets ? datasetId : undefined
}

function inferBaseDatasetId(
  model: AnyDefinedDataModel,
  chartId: string,
  fieldIds: readonly string[],
): string | undefined {
  const baseDatasetIds = [...new Set(
    fieldIds
      .map(fieldId => getQualifiedBaseDatasetId(model, fieldId))
      .filter((datasetId): datasetId is string => !!datasetId),
  )]

  if (baseDatasetIds.length === 0) {
    return undefined
  }

  if (baseDatasetIds.length > 1) {
    throw new Error(
      `Model chart "${chartId}" references multiple base datasets (${baseDatasetIds.join(', ')}). Add .from(datasetId) with relative fields, or keep all qualified fields anchored to one dataset.`,
    )
  }

  return baseDatasetIds[0]
}

function indexLookupRelationships(
  model: AnyDefinedDataModel,
): ReadonlyMap<string, ReadonlyMap<string, RuntimeRelationship>> {
  const indexed = new Map<string, Map<string, RuntimeRelationship>>()

  ;(Object.values(model.relationships) as RuntimeRelationship[]).forEach((relationship) => {
    const alias = resolveRelationshipAlias(relationship)
    if (!alias) {
      return
    }

    const relationshipsForDataset = indexed.get(relationship.to.dataset) ?? new Map<string, RuntimeRelationship>()
    const existing = relationshipsForDataset.get(alias)
    if (existing && (
      existing.from.dataset !== relationship.from.dataset
      || existing.to.column !== relationship.to.column
      || existing.from.key !== relationship.from.key
    )) {
      throw new Error(
        `Lookup alias "${alias}" is ambiguous on dataset "${relationship.to.dataset}". Add explicit relationships with distinct foreign-key column names.`,
      )
    }
    relationshipsForDataset.set(alias, relationship)
    indexed.set(relationship.to.dataset, relationshipsForDataset)
  })

  return indexed
}

function resolveChartField(
  relationshipsByDataset: ReadonlyMap<string, ReadonlyMap<string, RuntimeRelationship>>,
  datasetId: string,
  fieldId: string,
): ResolvedChartField {
  const segments = fieldId.split('.')

  if (segments.length === 1) {
    return {compiledId: fieldId}
  }

  if (segments.length !== 2) {
    throw new Error(
      `Field path "${fieldId}" is not supported. Model charts allow one lookup hop such as "owner.name".`,
    )
  }

  const [alias, columnId] = segments as [string, string]
  const relationship = relationshipsByDataset.get(datasetId)?.get(alias)
  if (!relationship) {
    throw new Error(`Cannot resolve lookup path "${fieldId}" from dataset "${datasetId}".`)
  }

  return {
    compiledId: buildProjectedId(alias, columnId),
    lookup: {
      alias,
      relationship,
      columnId,
    },
  }
}

function normalizeFieldId(
  model: AnyDefinedDataModel,
  baseDatasetId: string,
  fieldId: string,
): string {
  const qualifiedBaseDatasetId = getQualifiedBaseDatasetId(model, fieldId)
  if (!qualifiedBaseDatasetId) {
    return fieldId
  }

  if (qualifiedBaseDatasetId !== baseDatasetId) {
    throw new Error(
      `Field "${fieldId}" is anchored to dataset "${qualifiedBaseDatasetId}", but this chart compiles from "${baseDatasetId}".`,
    )
  }

  return fieldId.slice(baseDatasetId.length + 1)
}

function collectConfigFieldIds(
  state: ModelChartRuntimeState,
): string[] {
  const fieldIds = new Set<string>()
  const addSelectableConfig = (
    config: {allowed?: readonly string[]; hidden?: readonly string[]; default?: string} | undefined,
  ) => {
    config?.allowed?.forEach(fieldId => fieldIds.add(fieldId))
    config?.hidden?.forEach(fieldId => fieldIds.add(fieldId))
    if (config?.default) {
      fieldIds.add(config.default)
    }
  }
  const addMetricConfig = (
    config: {allowed?: readonly Metric<string>[]; hidden?: readonly Metric<string>[]; default?: Metric<string>} | undefined,
  ) => {
    config?.allowed?.forEach((metric) => {
      if (metric.kind === 'aggregate') {
        fieldIds.add(metric.columnId)
      }
    })
    config?.hidden?.forEach((metric) => {
      if (metric.kind === 'aggregate') {
        fieldIds.add(metric.columnId)
      }
    })
    if (config?.default?.kind === 'aggregate') {
      fieldIds.add(config.default.columnId)
    }
  }

  addSelectableConfig(state.xAxis)
  addSelectableConfig(state.groupBy)
  addSelectableConfig(state.filters)
  addMetricConfig(state.metric as {
    allowed?: readonly Metric<string>[]
    hidden?: readonly Metric<string>[]
    default?: Metric<string>
  } | undefined)

  return [...fieldIds]
}

function mapSelectableConfig(
  config: {allowed?: readonly string[]; hidden?: readonly string[]; default?: string} | undefined,
  compileFieldId: (fieldId: string) => string,
): {allowed?: readonly string[]; hidden?: readonly string[]; default?: string} | undefined {
  if (!config) {
    return undefined
  }

  return {
    ...(config.allowed ? {allowed: config.allowed.map(compileFieldId)} : {}),
    ...(config.hidden ? {hidden: config.hidden.map(compileFieldId)} : {}),
    ...(config.default ? {default: compileFieldId(config.default)} : {}),
  }
}

function mapMetricConfig(
  config: MetricConfig<string> | undefined,
  compileFieldId: (fieldId: string) => string,
): MetricConfig<string> | undefined {
  if (!config) {
    return undefined
  }

  const mapMetric = (metric: Metric<string>): Metric<string> =>
    metric.kind === 'aggregate'
      ? {
          ...metric,
          columnId: compileFieldId(metric.columnId),
        }
      : metric
  const mapMetricAllowance = (
    metric: NonNullable<MetricConfig<string>['allowed']>[number],
  ) =>
    metric.kind === 'aggregate'
      ? {
          ...metric,
          columnId: compileFieldId(metric.columnId),
        }
      : metric

  return {
    ...(config.allowed ? {allowed: config.allowed.map(mapMetricAllowance)} : {}),
    ...(config.hidden ? {hidden: config.hidden.map(mapMetric)} : {}),
    ...(config.default ? {default: mapMetric(config.default)} : {}),
  }
}

function buildLookupSource(
  model: AnyDefinedDataModel,
  chartId: string,
  baseDatasetId: string,
  resolvedFields: readonly ResolvedChartField[],
  hiddenViewIdPrefix: string,
): {
  readonly dataset: {
    readonly columns?: Record<string, unknown>
  }
  readonly metadataTarget: unknown
} {
  const lookups = new Map<string, {relationship: RuntimeRelationship; columns: Set<string>}>()

  resolvedFields.forEach((field) => {
    if (!field.lookup) {
      return
    }

    const existing = lookups.get(field.lookup.alias) ?? {
      relationship: field.lookup.relationship,
      columns: new Set<string>(),
    }
    existing.columns.add(field.lookup.columnId)
    lookups.set(field.lookup.alias, existing)
  })

  if (lookups.size === 0) {
    return {
      dataset: (model.datasets as Record<string, {columns?: Record<string, unknown>}>)[baseDatasetId]!,
      metadataTarget: (model.datasets as Record<string, unknown>)[baseDatasetId]!,
    }
  }

  const view = (model as any).materialize(`${hiddenViewIdPrefix}${chartId}`, (m: any) => {
    let builder: any = m.from(baseDatasetId as any)

    lookups.forEach(({relationship, columns}, alias) => {
      builder = builder.join(alias, {
        relationship: relationship.id,
        columns: [...columns],
      })
    })

    return builder.grain(baseDatasetId)
  })

  return {
    dataset: view,
    metadataTarget: view,
  }
}

function createChartBuilderMembers(
  state: ModelChartRuntimeState,
  createNext: (nextState: ModelChartRuntimeState) => unknown,
): Record<string, unknown> {
  return {
    xAxis(defineXAxis: (xAxis: SelectableControlBuilder<string, true>) => unknown) {
      const nextBuilder = defineXAxis(createSelectableControlBuilder({}, true))
      return createNext({
        ...state,
        xAxis: getSelectableControlConfig(nextBuilder),
      })
    },
    groupBy(defineGroupBy: (groupBy: SelectableControlBuilder<string, true>) => unknown) {
      const nextBuilder = defineGroupBy(createSelectableControlBuilder({}, true))
      return createNext({
        ...state,
        groupBy: getSelectableControlConfig(nextBuilder),
      })
    },
    filters(defineFilters: (filters: SelectableControlBuilder<string, false>) => unknown) {
      const nextBuilder = defineFilters(createSelectableControlBuilder({}, false))
      return createNext({
        ...state,
        filters: getSelectableControlConfig(nextBuilder),
      })
    },
    metric(defineMetric: (metric: MetricBuilder<string>) => unknown) {
      const nextBuilder = defineMetric(createMetricBuilder())
      return createNext({
        ...state,
        metric: getMetricBuilderConfig(nextBuilder),
      })
    },
    chartType(defineChartType: (chartType: SelectableControlBuilder<ChartType, true>) => unknown) {
      const nextBuilder = defineChartType(createSelectableControlBuilder<ChartType, true>({}, true))
      return createNext({
        ...state,
        chartType: getSelectableControlConfig(nextBuilder),
      })
    },
    timeBucket(defineTimeBucket: (timeBucket: SelectableControlBuilder<TimeBucket, true>) => unknown) {
      const nextBuilder = defineTimeBucket(createSelectableControlBuilder<TimeBucket, true>({}, true))
      return createNext({
        ...state,
        timeBucket: getSelectableControlConfig(nextBuilder),
      })
    },
    connectNulls(value: boolean) {
      return createNext({
        ...state,
        connectNulls: value,
      })
    },
  }
}

function createModelChartBuilder<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends Extract<keyof TDatasets, string>,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
>(
  state: ModelChartRuntimeState,
): ModelChartBuilder<
  TDatasets,
  TRelationships,
  TBaseDatasetId,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls
> {
  const createNext = (nextState: ModelChartRuntimeState) =>
    createModelChartBuilder<any, any, any, any, any, any, any, any, any, any>(nextState)
  const builder = createChartBuilderMembers(state, createNext)

  Object.defineProperty(builder, MODEL_CHART_STATE, {
    value: state,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return builder as unknown as ModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >
}

function createInferredModelChartBuilder<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TBaseDatasetId extends Extract<keyof TDatasets, string> | undefined = undefined,
  TXAxis extends XAxisConfig<any> | undefined = undefined,
  TGroupBy extends GroupByConfig<any> | undefined = undefined,
  TFilters extends FiltersConfig<any> | undefined = undefined,
  TMetric extends MetricConfig<any> | undefined = undefined,
  TChartType extends ChartTypeConfig | undefined = undefined,
  TTimeBucket extends TimeBucketConfig | undefined = undefined,
  TConnectNulls extends boolean | undefined = undefined,
>(
  state: ModelChartRuntimeState,
): InferredModelChartBuilder<
  TDatasets,
  TRelationships,
  TBaseDatasetId,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket,
  TConnectNulls
> {
  const createNext = (nextState: ModelChartRuntimeState) =>
    createInferredModelChartBuilder<any, any, any, any, any, any, any, any, any, any>(nextState)

  const builder = createChartBuilderMembers(state, createNext)

  Object.defineProperty(builder, MODEL_CHART_STATE, {
    value: state,
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return builder as unknown as InferredModelChartBuilder<
    TDatasets,
    TRelationships,
    TBaseDatasetId,
    TXAxis,
    TGroupBy,
    TFilters,
    TMetric,
    TChartType,
    TTimeBucket,
    TConnectNulls
  >
}

function createModelChartStartBuilder<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
>(): ModelChartStartBuilder<TDatasets, TRelationships> {
  const inferredBuilder = createInferredModelChartBuilder<TDatasets, TRelationships>({})

  return {
    ...inferredBuilder,
    from(dataset) {
      return createModelChartBuilder({
        baseDatasetId: dataset,
      })
    },
  }
}

export function compileModelChartFromState<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TChartId extends string,
  TBuilder,
>(
  model: DefinedDataModel<TDatasets, TRelationships, any, any>,
  chartId: TChartId,
  state: ModelChartRuntimeState,
  options: {
    hiddenViewIdPrefix?: string
  } = {},
): CompileModelChartDefinition<TDatasets, TRelationships, TBuilder, TChartId> {
  const fieldIds = collectConfigFieldIds(state)
  const baseDatasetId = state.baseDatasetId ?? inferBaseDatasetId(model, chartId, fieldIds)
  if (!baseDatasetId) {
    throw new Error(
      'Model charts must choose a base dataset with .from(datasetId), or qualify all referenced fields from one dataset such as "tests.takenAt".',
    )
  }

  const relationshipsByDataset = indexLookupRelationships(model)
  const resolvedFields = fieldIds.map(fieldId =>
    resolveChartField(
      relationshipsByDataset,
      baseDatasetId,
      normalizeFieldId(model, baseDatasetId, fieldId),
    ),
  )
  const compileFieldId = (fieldId: string) =>
    resolveChartField(
      relationshipsByDataset,
      baseDatasetId,
      normalizeFieldId(model, baseDatasetId, fieldId),
    ).compiledId
  const source = buildLookupSource(
    model,
    chartId,
    baseDatasetId,
    resolvedFields,
    options.hiddenViewIdPrefix ?? '__lookup_',
  )

  const compiledState: BuilderSchemaState<
    Record<string, unknown> | undefined,
    XAxisConfig<string> | undefined,
    GroupByConfig<string> | undefined,
    FiltersConfig<string> | undefined,
    MetricConfig<string> | undefined,
    ChartTypeConfig | undefined,
    TimeBucketConfig | undefined,
    boolean | undefined
  > = {
    columns: source.dataset.columns,
    xAxis: mapSelectableConfig(state.xAxis, compileFieldId),
    groupBy: mapSelectableConfig(state.groupBy, compileFieldId),
    filters: mapSelectableConfig(state.filters, compileFieldId),
    metric: mapMetricConfig(state.metric, compileFieldId),
    chartType: state.chartType,
    timeBucket: state.timeBucket,
    connectNulls: state.connectNulls,
  }

  return createDatasetChartBuilder(compiledState, {
    dataset: source.metadataTarget,
    chartId,
  }).build() as CompileModelChartDefinition<TDatasets, TRelationships, TBuilder, TChartId>
}

export function compileModelChart<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  const TChartId extends string,
  const TBuilder extends ModelChartBuilder<TDatasets, TRelationships, any, any, any, any, any, any, any, any>,
>(
  model: DefinedDataModel<TDatasets, TRelationships, any, any>,
  chartId: TChartId,
  defineChart: (
    chart: ModelChartStartBuilder<TDatasets, TRelationships>,
  ) => TBuilder,
  options?: {
    hiddenViewIdPrefix?: string
  },
): CompileModelChartDefinition<TDatasets, TRelationships, TBuilder, TChartId>

export function compileModelChart<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  const TChartId extends string,
  const TBuilder extends InferredModelChartBuilder<TDatasets, TRelationships, any, any, any, any, any, any, any, any>,
>(
  model: DefinedDataModel<TDatasets, TRelationships, any, any>,
  chartId: TChartId,
  defineChart: (
    chart: ModelChartStartBuilder<TDatasets, TRelationships>,
  ) => TBuilder,
  options?: {
    hiddenViewIdPrefix?: string
  },
): CompileModelChartDefinition<TDatasets, TRelationships, TBuilder, TChartId>

export function compileModelChart<
  TDatasets extends Record<string, any>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  const TChartId extends string,
  const TBuilder extends
    | ModelChartBuilder<TDatasets, TRelationships, any, any, any, any, any, any, any, any>
    | InferredModelChartBuilder<TDatasets, TRelationships, any, any, any, any, any, any, any, any>,
>(
  model: DefinedDataModel<TDatasets, TRelationships, any, any>,
  chartId: TChartId,
  defineChart: (
    chart: ModelChartStartBuilder<TDatasets, TRelationships>,
  ) => TBuilder,
  options: {
    hiddenViewIdPrefix?: string
  } = {},
): CompileModelChartDefinition<TDatasets, TRelationships, TBuilder, TChartId> {
  const builder = defineChart(createModelChartStartBuilder<TDatasets, TRelationships>())
  const state = getModelChartState(builder)

  return compileModelChartFromState<TDatasets, TRelationships, TChartId, TBuilder>(
    model,
    chartId,
    state,
    options,
  )
}
