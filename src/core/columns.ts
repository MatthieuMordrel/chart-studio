/**
 * Column definition helpers.
 *
 * Provides a fluent API for defining chart columns with proper type inference.
 *
 * @example
 * ```tsx
 * import { columns } from '@matthieumordrel/chart-studio'
 *
 * const jobColumns = [
 *   columns.date('dateAdded', { label: 'Date Added' }),
 *   columns.category('ownerName', { label: 'Consultant' }),
 *   columns.boolean('isOpen', { trueLabel: 'Open', falseLabel: 'Closed' }),
 *   columns.number('salary', { label: 'Salary' }),
 * ]
 * ```
 */

import type {BooleanColumn, CategoryColumn, ChartColumn, DateColumn, NumberColumn} from './types.js'

type Nullish = null | undefined

/**
 * Keys whose non-null values are assignable to the requested value type.
 */
type KeysMatchingValue<T, TValue> = Extract<
  {
    [TKey in keyof T]-?: Exclude<T[TKey], Nullish> extends TValue ? TKey : never
  }[keyof T],
  string
>

type DateColumnKey<T> = KeysMatchingValue<T, string | number | Date>
type CategoryColumnKey<T> = KeysMatchingValue<T, string>
type BooleanColumnKey<T> = KeysMatchingValue<T, boolean>
type NumberColumnKey<T> = KeysMatchingValue<T, number>

// ---------------------------------------------------------------------------
// Helper types for column option overrides
// ---------------------------------------------------------------------------

/**
 * Options for a date column.
 * @property label - Display label (defaults to the field key)
 * @property accessor - Custom accessor (defaults to `item[key]`)
 */
type DateColumnOptions<T> = {
  label?: string
  accessor?: (item: T) => string | number | Date | null | undefined
}

/**
 * Options for a category column.
 * @property label - Display label (defaults to the field key)
 * @property accessor - Custom accessor (defaults to `item[key]`)
 */
type CategoryColumnOptions<T> = {
  label?: string
  accessor?: (item: T) => string | null | undefined
}

/**
 * Options for a boolean column.
 * @property label - Display label (defaults to the field key)
 * @property trueLabel - Label for the true group
 * @property falseLabel - Label for the false group
 * @property accessor - Custom accessor (defaults to `item[key]`)
 */
type BooleanColumnOptions<T> = {
  trueLabel: string
  falseLabel: string
  label?: string
  accessor?: (item: T) => boolean | null | undefined
}

/**
 * Options for a number column.
 * @property label - Display label (defaults to the field key)
 * @property accessor - Custom accessor (defaults to `item[key]`)
 */
type NumberColumnOptions<T> = {
  label?: string
  accessor?: (item: T) => number | null | undefined
}

// ---------------------------------------------------------------------------
// Default accessor factory
// ---------------------------------------------------------------------------

/** Creates a default accessor that reads `item[key]`. */
function defaultAccessor<T, TKey extends keyof T>(key: TKey): (item: T) => T[TKey] {
  return (item: T) => item[key]
}

/** Capitalize the first letter and add spaces before uppercase letters. */
function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// ---------------------------------------------------------------------------
// Column builder functions
// ---------------------------------------------------------------------------

/** Create a date column definition. */
function dateColumn<T, TKey extends DateColumnKey<T> = DateColumnKey<T>>(
  key: TKey,
  options?: DateColumnOptions<T>,
): DateColumn<T, TKey> {
  return {
    id: key,
    type: 'date',
    label: options?.label ?? humanize(key),
    accessor: options?.accessor ?? (defaultAccessor(key) as DateColumn<T, TKey>['accessor']),
  }
}

/** Create a category column definition. */
function categoryColumn<T, TKey extends CategoryColumnKey<T> = CategoryColumnKey<T>>(
  key: TKey,
  options?: CategoryColumnOptions<T>,
): CategoryColumn<T, TKey> {
  return {
    id: key,
    type: 'category',
    label: options?.label ?? humanize(key),
    accessor:
      options?.accessor ?? (defaultAccessor(key) as CategoryColumn<T, TKey>['accessor']),
  }
}

/** Create a boolean column definition. */
function booleanColumn<T, TKey extends BooleanColumnKey<T> = BooleanColumnKey<T>>(
  key: TKey,
  options: BooleanColumnOptions<T>,
): BooleanColumn<T, TKey> {
  return {
    id: key,
    type: 'boolean',
    label: options.label ?? humanize(key),
    accessor: options.accessor ?? (defaultAccessor(key) as BooleanColumn<T, TKey>['accessor']),
    trueLabel: options.trueLabel,
    falseLabel: options.falseLabel,
  }
}

/** Create a number column definition. */
function numberColumn<T, TKey extends NumberColumnKey<T> = NumberColumnKey<T>>(
  key: TKey,
  options?: NumberColumnOptions<T>,
): NumberColumn<T, TKey> {
  return {
    id: key,
    type: 'number',
    label: options?.label ?? humanize(key),
    accessor: options?.accessor ?? (defaultAccessor(key) as NumberColumn<T, TKey>['accessor']),
  }
}

/**
 * Namespace of column definition helpers.
 * Each function creates a typed column definition with sensible defaults.
 *
 * @example
 * ```tsx
 * const jobColumns = [
 *   columns.date<Job>('dateAdded', { label: 'Date Added' }),
 *   columns.category<Job>('ownerName', { label: 'Consultant' }),
 *   columns.boolean<Job>('isOpen', { trueLabel: 'Open', falseLabel: 'Closed' }),
 *   columns.number<Job>('salary', { label: 'Salary' }),
 * ]
 * ```
 */
export const columns = {
  date: dateColumn,
  category: categoryColumn,
  boolean: booleanColumn,
  number: numberColumn,
} as const

/**
 * Utility to create an array of columns with shared generic type.
 * Provides better type inference when defining columns inline.
 *
 * @example
 * ```tsx
 * const cols = defineColumns<Job>([
 *   columns.date('dateAdded', { label: 'Date Added' }),
 *   columns.category('ownerName', { label: 'Consultant' }),
 * ])
 * ```
 */
export function defineColumns<
  T,
  const TColumns extends readonly ChartColumn<T, string>[] = readonly ChartColumn<T, string>[],
>(
  cols: TColumns,
): TColumns {
  return cols
}
