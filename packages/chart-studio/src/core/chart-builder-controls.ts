import {isSameMetric, normalizeMetricAllowances} from './metric-utils.js'
import type {
  MetricBuilder,
  MetricBuilderConfig,
  SelectableControlBuilder,
  SelectableControlBuilderConfig,
} from './schema-builder.types.js'
import type {
  Metric,
  MetricAllowance,
  NumericAggregateFunction,
} from './types.js'

const SELECTABLE_CONTROL_CONFIG = Symbol('chart-schema-selectable-control-config')
const METRIC_CONTROL_CONFIG = Symbol('chart-schema-metric-config')

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

type SelectableControlRuntime<TConfig extends object> = {
  readonly [SELECTABLE_CONTROL_CONFIG]: TConfig
}

type MetricControlRuntime<TConfig extends object> = {
  readonly [METRIC_CONTROL_CONFIG]: TConfig
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

export function createSelectableControlBuilder<
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

export function createMetricBuilder<
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

export function getSelectableControlConfig<TBuilder>(
  builder: TBuilder,
): SelectableControlBuilderConfig<TBuilder> {
  return (builder as SelectableControlRuntime<SelectableControlBuilderConfig<TBuilder>>)[SELECTABLE_CONTROL_CONFIG]
}

export function getMetricBuilderConfig<TBuilder>(
  builder: TBuilder,
): MetricBuilderConfig<TBuilder> {
  return (builder as MetricControlRuntime<MetricBuilderConfig<TBuilder>>)[METRIC_CONTROL_CONFIG]
}
