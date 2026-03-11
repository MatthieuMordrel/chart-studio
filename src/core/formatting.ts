import type {ChartColumn, ColumnFormat, DurationColumnFormat, DurationInputUnit, TimeBucket} from './types.js'

/** Formatting surfaces exposed by the chart UI. */
export type ChartValueSurface = 'axis' | 'tooltip' | 'data-label' | 'raw'

/** Numeric extent used to choose sensible default precision. */
export type NumericRange = {
  min: number
  max: number
}

type NumberFormatMode =
  | 'number'
  | 'compact-number'
  | 'currency'
  | 'compact-currency'
  | 'percent'

type DateValueFormatMode = 'date' | 'datetime'

type DurationPart = {
  value: number
  suffix: 'd' | 'h' | 'm' | 's'
}

const DURATION_UNIT_TO_SECONDS: Record<DurationInputUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
}

type FormatColumnLike<T> = {
  type: ChartColumn<T>['type']
  format?: ColumnFormat
  trueLabel?: string
  falseLabel?: string
}

type FormatValueOptions<T> = {
  column: FormatColumnLike<T>
  surface: ChartValueSurface
  timeBucket?: TimeBucket
  numericRange?: NumericRange | null
  locale?: string
}

/**
 * Build a numeric range from chart values.
 */
export function createNumericRange(values: readonly number[]): NumericRange | null {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) {
    return null
  }

  let min = finiteValues[0]!
  let max = finiteValues[0]!
  for (const value of finiteValues) {
    if (value < min) min = value
    if (value > max) max = value
  }

  return {min, max}
}

/**
 * Decide whether an axis should keep decimal ticks for the current visible
 * numeric values.
 */
export function shouldAllowDecimalTicks(values: readonly number[]): boolean {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) {
    return false
  }

  const numericRange = createNumericRange(finiteValues)
  if (shouldUsePercentByDefault(numericRange)) {
    return true
  }

  return finiteValues.some((value) => !isEffectivelyInteger(value))
}

/**
 * Format one chart value for a specific UI surface.
 */
export function formatChartValue<T>(
  value: string | number | boolean | Date | null | undefined,
  options: FormatValueOptions<T>,
): string {
  const {column, surface, timeBucket, numericRange, locale = 'en-US'} = options

  if (value == null) {
    return 'Unknown'
  }

  switch (column.type) {
    case 'boolean':
      return formatBooleanValue(value, column)
    case 'category':
      return String(value)
    case 'date':
      return value instanceof Date || typeof value === 'string' || typeof value === 'number'
        ? formatDateValue(value, column.format, surface, timeBucket, locale)
        : String(value)
    case 'number':
      return typeof value === 'number'
        ? formatNumberValue(value, column.format, surface, numericRange, locale)
        : String(value)
  }
}

/**
 * Format a date bucket label from the machine-friendly pipeline key.
 */
export function formatTimeBucketLabel(
  key: string,
  bucket: TimeBucket,
  surface: ChartValueSurface,
  locale = 'en-US',
): string {
  switch (bucket) {
    case 'day':
      return formatDateWithOptions(parseBucketDate(key), locale, getBucketDayOptions(surface))
    case 'week': {
      const date = parseBucketDate(key)
      const prefix = surface === 'tooltip' ? 'Week of ' : 'Wk of '
      return `${prefix}${formatDateWithOptions(date, locale, getBucketWeekOptions(surface))}`
    }
    case 'month':
      return formatDateWithOptions(parseBucketMonth(key), locale, {month: 'short', year: 'numeric'})
    case 'quarter': {
      const {year, quarter} = parseQuarterKey(key)
      return `Q${quarter} ${year}`
    }
    case 'year':
      return key
  }
}

/**
 * Format the Y-axis or label width estimate with the same surface rules used in
 * the visible chart.
 */
export function formatNumericSurfaceValue(
  value: number,
  surface: ChartValueSurface,
  numericRange?: NumericRange | null,
  format?: ColumnFormat,
  locale = 'en-US',
): string {
  return formatNumberValue(value, format, surface, numericRange, locale)
}

/**
 * Resolve the boolean labels while keeping null handling in the shared entry
 * point above.
 */
function formatBooleanValue<T>(
  value: string | number | boolean | Date,
  column: Pick<FormatColumnLike<T>, 'trueLabel' | 'falseLabel'>,
): string {
  if (value === true) {
    return column.trueLabel ?? 'True'
  }

  if (value === false) {
    return column.falseLabel ?? 'False'
  }

  return String(value)
}

/**
 * Format numeric values with surface-aware defaults and optional overrides.
 */
function formatNumberValue(
  value: number,
  format: ColumnFormat | undefined,
  surface: ChartValueSurface,
  numericRange: NumericRange | null | undefined,
  locale: string,
): string {
  if (!Number.isFinite(value)) {
    return String(value)
  }

  if (typeof format === 'object' && format.kind === 'duration') {
    return formatDurationValue(value, format)
  }

  if (typeof format === 'object' && format.kind === 'number') {
    return new Intl.NumberFormat(format.locale ?? locale, format.options).format(value)
  }

  const mode = resolveNumberFormatMode(format, surface, numericRange, value)
  return new Intl.NumberFormat(locale, getNumberFormatOptions(mode, surface, numericRange, value)).format(value)
}

/**
 * Format one numeric duration into a compact, surface-agnostic label such as
 * `36s`, `1h36m`, or `1d5h`.
 */
function formatDurationValue(value: number, format: DurationColumnFormat): string {
  const sign = value < 0 ? '-' : ''
  const totalSeconds = Math.round(Math.abs(value) * DURATION_UNIT_TO_SECONDS[format.unit])

  if (totalSeconds === 0) {
    return `${sign}0${getDurationZeroSuffix(format.unit)}`
  }

  const parts = buildDurationParts(totalSeconds)
  return `${sign}${parts.slice(0, 2).map((part) => `${part.value}${part.suffix}`).join('')}`
}

/**
 * Build the ordered duration parts used by the compact formatter.
 */
function buildDurationParts(totalSeconds: number): DurationPart[] {
  const parts: DurationPart[] = []
  let remainingSeconds = totalSeconds

  const units: ReadonlyArray<{seconds: number; suffix: DurationPart['suffix']}> = [
    {seconds: DURATION_UNIT_TO_SECONDS.days, suffix: 'd'},
    {seconds: DURATION_UNIT_TO_SECONDS.hours, suffix: 'h'},
    {seconds: DURATION_UNIT_TO_SECONDS.minutes, suffix: 'm'},
    {seconds: DURATION_UNIT_TO_SECONDS.seconds, suffix: 's'},
  ]

  for (const unit of units) {
    if (remainingSeconds < unit.seconds) {
      continue
    }

    const unitValue = Math.floor(remainingSeconds / unit.seconds)
    remainingSeconds -= unitValue * unit.seconds
    parts.push({value: unitValue, suffix: unit.suffix})
  }

  return parts.length > 0 ? parts : [{value: 0, suffix: 's'}]
}

/**
 * Keep zero durations aligned with the unit declared by the schema author.
 */
function getDurationZeroSuffix(unit: DurationInputUnit): DurationPart['suffix'] {
  switch (unit) {
    case 'seconds':
      return 's'
    case 'minutes':
      return 'm'
    case 'hours':
      return 'h'
    case 'days':
      return 'd'
  }
}

/**
 * Format date values with either a caller-specified `Intl` config or the shared
 * time-bucket-aware defaults.
 */
function formatDateValue(
  value: string | number | Date,
  format: ColumnFormat | undefined,
  surface: ChartValueSurface,
  timeBucket: TimeBucket | undefined,
  locale: string,
): string {
  if (typeof format === 'object' && format.kind === 'date') {
    return formatDateWithOptions(value, format.locale ?? locale, format.options ?? {})
  }

  if (timeBucket) {
    const date = toDate(value)
    if (date) {
      return formatDateWithOptions(date, locale, getBucketDateOptions(timeBucket, surface))
    }
  }

  const mode = resolveDateFormatMode(format)
  return formatDateWithOptions(value, locale, getDateValueOptions(mode, surface))
}

/**
 * Convert a broad value into a valid Date when possible.
 */
function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Safely format a parsed date, falling back to the raw string when parsing
 * fails.
 */
function formatDateWithOptions(
  value: string | number | Date | null,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = value == null ? null : toDate(value)
  if (!date) {
    return value == null ? 'Unknown' : String(value)
  }

  return new Intl.DateTimeFormat(locale, options).format(date)
}

/**
 * Decide which number family should power the current surface.
 */
function resolveNumberFormatMode(
  format: ColumnFormat | undefined,
  surface: ChartValueSurface,
  numericRange: NumericRange | null | undefined,
  value: number,
): NumberFormatMode {
  if (typeof format === 'string') {
    switch (format) {
      case 'currency':
        return surface === 'tooltip' ? 'currency' : 'compact-currency'
      case 'compact-number':
        return 'compact-number'
      case 'percent':
        return 'percent'
      case 'number':
      case 'date':
      case 'datetime':
        return surface === 'tooltip'
          ? 'number'
          : shouldUseCompactNumber(numericRange, value) ? 'compact-number' : 'number'
    }
  }

  if (shouldUsePercentByDefault(numericRange)) {
    return 'percent'
  }

  if (surface !== 'tooltip' && shouldUseCompactNumber(numericRange, value)) {
    return 'compact-number'
  }

  return 'number'
}

/**
 * Decide which date family should power the current surface.
 */
function resolveDateFormatMode(format: ColumnFormat | undefined): DateValueFormatMode {
  return format === 'datetime' ? 'datetime' : 'date'
}

/**
 * Use percentage defaults only when the visible values all live in the
 * percentage-like range.
 */
function shouldUsePercentByDefault(numericRange: NumericRange | null | undefined): boolean {
  if (!numericRange) {
    return false
  }

  const maxAbs = Math.max(Math.abs(numericRange.min), Math.abs(numericRange.max))
  return maxAbs > 0 && maxAbs <= 1
}

/**
 * Compact large values on short surfaces while leaving small ranges readable.
 */
function shouldUseCompactNumber(
  numericRange: NumericRange | null | undefined,
  value: number,
): boolean {
  const maxAbs = numericRange
    ? Math.max(Math.abs(numericRange.min), Math.abs(numericRange.max))
    : Math.abs(value)

  return maxAbs >= 1000
}

/**
 * Treat floating-point noise around whole numbers as integers so axis policy
 * follows the actual metric shape rather than binary rounding artifacts.
 */
function isEffectivelyInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-9
}

/**
 * Produce the final `Intl.NumberFormat` options for one numeric mode.
 */
function getNumberFormatOptions(
  mode: NumberFormatMode,
  surface: ChartValueSurface,
  numericRange: NumericRange | null | undefined,
  value: number,
): Intl.NumberFormatOptions {
  switch (mode) {
    case 'compact-currency':
      return {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }
    case 'currency':
      return {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: getStandardFractionDigits(surface, numericRange, value),
      }
    case 'compact-number':
      return {
        notation: 'compact',
        maximumFractionDigits: 1,
      }
    case 'percent':
      return {
        style: 'percent',
        maximumFractionDigits: surface === 'tooltip' ? 2 : 1,
      }
    case 'number':
      return {
        maximumFractionDigits: getStandardFractionDigits(surface, numericRange, value),
      }
  }
}

/**
 * Keep tooltip values more precise than axis and data-label surfaces.
 */
function getStandardFractionDigits(
  surface: ChartValueSurface,
  numericRange: NumericRange | null | undefined,
  value: number,
): number {
  const span = numericRange ? Math.abs(numericRange.max - numericRange.min) : Math.abs(value)

  if (surface === 'tooltip') {
    if (span < 1) return 3
    if (span < 10) return 2
    if (span < 100) return 1
    return 0
  }

  if (span < 1) return 2
  if (span < 10) return 1
  return 0
}

/**
 * Match raw date values to a clear default display.
 */
function getDateValueOptions(
  mode: DateValueFormatMode,
  surface: ChartValueSurface,
): Intl.DateTimeFormatOptions {
  if (mode === 'datetime') {
    return surface === 'tooltip'
      ? {dateStyle: 'medium', timeStyle: 'short'}
      : {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}
  }

  return surface === 'tooltip'
    ? {dateStyle: 'medium'}
    : {month: 'short', day: 'numeric', year: 'numeric'}
}

/**
 * Match bucketed dates to the active time bucket.
 */
function getBucketDateOptions(
  bucket: TimeBucket,
  surface: ChartValueSurface,
): Intl.DateTimeFormatOptions {
  switch (bucket) {
    case 'day':
      return getBucketDayOptions(surface)
    case 'week':
      return getBucketWeekOptions(surface)
    case 'month':
      return {month: 'short', year: 'numeric'}
    case 'quarter':
      return {month: 'short', year: 'numeric'}
    case 'year':
      return {year: 'numeric'}
  }
}

/**
 * Keep day buckets short on axes and clearer in tooltips.
 */
function getBucketDayOptions(surface: ChartValueSurface): Intl.DateTimeFormatOptions {
  return surface === 'tooltip'
    ? {month: 'short', day: 'numeric', year: 'numeric'}
    : {month: 'short', day: 'numeric'}
}

/**
 * Keep week buckets short on axes and clearer in tooltips.
 */
function getBucketWeekOptions(surface: ChartValueSurface): Intl.DateTimeFormatOptions {
  return surface === 'tooltip'
    ? {month: 'short', day: 'numeric', year: 'numeric'}
    : {month: 'short', day: 'numeric'}
}

/**
 * Parse a `YYYY-MM-DD` bucket key.
 */
function parseBucketDate(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

/**
 * Parse a `YYYY-MM` bucket key.
 */
function parseBucketMonth(key: string): Date {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
}

/**
 * Parse a `YYYY-QN` quarter key.
 */
function parseQuarterKey(key: string): {year: string; quarter: string} {
  const [year, quarter] = key.split('-Q')
  return {year: year ?? key, quarter: quarter ?? '1'}
}
