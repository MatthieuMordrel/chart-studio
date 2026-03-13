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
 * Build the visible runtime option list after applying config restrictions.
 *
 * The pipeline is always:
 * 1. start from runtime-valid options
 * 2. if `allowed` exists, keep only allowed entries in declared order
 * 3. if `hidden` exists, subtract hidden entries
 *
 * When `fallbackToBaseIfEmpty` is enabled, required controls can recover their
 * base runtime options if the config leaves nothing selectable for the active
 * source. This recovery is intentionally separate from default resolution.
 */
function restrictConfiguredCollection<TItem, TKey extends string>(
  items: readonly TItem[],
  config:
    | {
        allowed?: readonly TKey[]
        hidden?: readonly TKey[]
      }
    | undefined,
  getKey: (item: TItem) => TKey,
  fallbackToBaseIfEmpty: boolean,
): TItem[] {
  const keyedItems = new Map(items.map(item => [getKey(item), item] as const))
  const allowedKeys = config?.allowed
  const hiddenKeys = config?.hidden ? new Set(config.hidden) : undefined

  const orderedItems = allowedKeys
    ? allowedKeys.flatMap(allowedKey => {
        const match = keyedItems.get(allowedKey)
        return match ? [match] : []
      })
    : [...items]

  const visibleItems = hiddenKeys
    ? orderedItems.filter(item => !hiddenKeys.has(getKey(item)))
    : orderedItems

  if (fallbackToBaseIfEmpty && visibleItems.length === 0) {
    return [...items]
  }

  return visibleItems
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
  return restrictConfiguredCollection(options, config, option => option.id, fallbackToBaseIfEmpty)
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
  return restrictConfiguredCollection(values, config, value => value, fallbackToBaseIfEmpty)
}

/**
 * Resolve one primitive selection against the current option list.
 */
export function resolveConfiguredValue<TValue extends string>(
  currentValue: TValue | null,
  values: readonly TValue[],
  configuredDefault: TValue | undefined,
  globalDefault?: TValue,
): TValue {
  // When the user has explicitly selected a value and it's still valid, keep it.
  if (currentValue !== null && values.includes(currentValue)) {
    return currentValue
  }

  // Schema-level default takes priority over the global default.
  if (configuredDefault && values.includes(configuredDefault)) {
    return configuredDefault
  }

  // Global default (e.g. 'month' for timeBucket, 'bar' for chartType).
  if (globalDefault && values.includes(globalDefault)) {
    return globalDefault
  }

  return values[0] ?? currentValue!
}

/**
 * Ordered time buckets exposed by the headless API.
 */
export const TIME_BUCKET_ORDER: readonly TimeBucket[] = ['day', 'week', 'month', 'quarter', 'year']

/**
 * Ordered chart types exposed by the headless API.
 */
export const CHART_TYPE_ORDER: readonly ChartType[] = ['bar', 'grouped-bar', 'percent-bar', 'line', 'area', 'percent-area', 'pie', 'donut']
