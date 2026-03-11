import type {
  ChartType,
  TimeBucket,
} from './types.js'

type IdOption<TId extends string> = {
  id: TId
}

type IdControlConfig<TId extends string> = {
  allowed?: readonly TId[]
  hidden?: readonly TId[]
  default?: TId
}

type ValueControlConfig<TValue extends string> = {
  allowed?: readonly TValue[]
  hidden?: readonly TValue[]
  default?: TValue
}

/**
 * Restrict an ID-keyed option list with `allowed`/`hidden`.
 *
 * When `fallbackToBaseIfEmpty` is enabled, required controls keep their base
 * runtime options even if the config does not match the active source.
 */
export function restrictConfiguredIdOptions<TId extends string, TOption extends IdOption<TId>>(
  options: readonly TOption[],
  config: IdControlConfig<TId> | undefined,
  fallbackToBaseIfEmpty = false,
): TOption[] {
  const visibleOptions = options
    .filter(option => (config?.allowed ? config.allowed.includes(option.id) : true))
    .filter(option => (config?.hidden ? !config.hidden.includes(option.id) : true))

  if (fallbackToBaseIfEmpty && visibleOptions.length === 0) {
    return [...options]
  }

  return visibleOptions
}

/**
 * Resolve one ID-based selection against the current option list.
 */
export function resolveConfiguredIdSelection<TId extends string>(
  currentValue: TId | null,
  options: readonly IdOption<TId>[],
  configuredDefault: TId | undefined,
  fallbackValue: TId | null,
  preferFirstAvailable = true,
): TId | null {
  if (currentValue && options.some(option => option.id === currentValue)) {
    return currentValue
  }

  if (configuredDefault && options.some(option => option.id === configuredDefault)) {
    return configuredDefault
  }

  if (preferFirstAvailable) {
    return options[0]?.id ?? fallbackValue
  }

  return fallbackValue
}

/**
 * Restrict a primitive option list with `allowed`/`hidden`.
 */
export function restrictConfiguredValues<TValue extends string>(
  values: readonly TValue[],
  config: ValueControlConfig<TValue> | undefined,
  fallbackToBaseIfEmpty = false,
): TValue[] {
  const visibleValues = values
    .filter(value => (config?.allowed ? config.allowed.includes(value) : true))
    .filter(value => (config?.hidden ? !config.hidden.includes(value) : true))

  if (fallbackToBaseIfEmpty && visibleValues.length === 0) {
    return [...values]
  }

  return visibleValues
}

/**
 * Resolve one primitive selection against the current option list.
 */
export function resolveConfiguredValue<TValue extends string>(
  currentValue: TValue,
  values: readonly TValue[],
  configuredDefault: TValue | undefined,
): TValue {
  if (values.includes(currentValue)) {
    return currentValue
  }

  if (configuredDefault && values.includes(configuredDefault)) {
    return configuredDefault
  }

  return values[0] ?? currentValue
}

/**
 * Ordered time buckets exposed by the headless API.
 */
export const TIME_BUCKET_ORDER: readonly TimeBucket[] = ['day', 'week', 'month', 'quarter', 'year']

/**
 * Ordered chart types exposed by the headless API.
 */
export const CHART_TYPE_ORDER: readonly ChartType[] = ['bar', 'line', 'area', 'pie', 'donut']
