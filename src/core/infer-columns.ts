import type {
  BooleanColumn,
  CategoryColumn,
  ChartColumn,
  ChartColumnType,
  ColumnFormatPreset,
  ColumnHints,
  ColumnInferenceMetadata,
  DateColumn,
  InferenceConfidence,
  InferableFieldKey,
  NumberColumn,
  ResolvedColumnIdFromHints,
} from './types.js'

const MAX_SAMPLE_COUNT = 50
const DATE_KEY_PATTERN = /(date|time|timestamp|created|updated|start|end|deadline|due|scheduled|posted|published|at)$/i
const CURRENCY_KEY_PATTERN = /(revenue|income|cost|price|amount|salary|budget|profit|sales|ebitda|gross|net|ticket)/i
const PERCENT_KEY_PATTERN = /(percent|percentage|ratio|rate|margin|ctr|conversion)/i
const DATETIME_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}/i
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}(-\d{2})?(?:[t\s].+)?$/i

type PrimitiveSample = string | number | boolean | Date
type RuntimeFieldKind = ChartColumnType | 'mixed' | 'empty' | 'unsupported'
type RuntimeColumnHint<T> = {
  label?: string
  format?: ColumnFormatPreset
  formatter?: ((value: unknown, item: T) => string) | undefined
  type?: ChartColumnType
  trueLabel?: string
  falseLabel?: string
}
type InferenceSignal = {
  type: ChartColumnType
  confidence: InferenceConfidence
  looksDateLike: boolean
}

/**
 * Humanize an object key into a UI label.
 */
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Return true when development warnings should be shown.
 */
function shouldWarn(): boolean {
  return typeof process !== 'undefined' ? process.env['NODE_ENV'] !== 'production' : true
}

/**
 * Emit a namespaced development warning.
 */
function warn(message: string): void {
  if (!shouldWarn()) return
  console.warn(`[chart-studio] ${message}`)
}

/**
 * Read a raw field value from an item.
 */
function getFieldValue<T>(item: T, key: string): unknown {
  return item[key as keyof T]
}

/**
 * Create an accessor that returns the raw field value.
 */
function createAccessor<T>(key: string): (item: T) => unknown {
  return (item: T) => getFieldValue(item, key)
}

/**
 * Check whether a runtime value can participate in automatic column inference.
 */
function isPrimitiveSample(value: unknown): value is PrimitiveSample {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  )
}

/**
 * Collect a bounded set of non-null samples for one field.
 */
function collectSamples<T>(data: readonly T[], key: string): PrimitiveSample[] {
  const samples: PrimitiveSample[] = []

  for (const item of data) {
    const value = getFieldValue(item, key)
    if (value == null) continue
    if (!isPrimitiveSample(value)) continue
    samples.push(value)
    if (samples.length >= MAX_SAMPLE_COUNT) {
      break
    }
  }

  return samples
}

/**
 * Gather all top-level field keys present in data or hints.
 */
function collectFieldKeys<T>(
  data: readonly T[],
  columnHints: ColumnHints<T> | undefined,
): string[] {
  const keys = new Set<string>()

  for (const item of data) {
    for (const key of Object.keys(item as Record<string, unknown>)) {
      keys.add(key)
    }
  }

  for (const key of Object.keys(columnHints ?? {})) {
    keys.add(key)
  }

  return [...keys]
}

/**
 * Classify the dominant runtime kind for a field.
 */
function classifyRuntimeField(samples: readonly PrimitiveSample[]): RuntimeFieldKind {
  if (samples.length === 0) {
    return 'empty'
  }

  const kinds = new Set<RuntimeFieldKind>()
  for (const value of samples) {
    if (value instanceof Date) {
      kinds.add('date')
      continue
    }

    switch (typeof value) {
      case 'string':
        kinds.add('category')
        break
      case 'number':
        kinds.add('number')
        break
      case 'boolean':
        kinds.add('boolean')
        break
      default:
        kinds.add('unsupported')
        break
    }
  }

  if (kinds.size > 1) {
    return 'mixed'
  }

  return kinds.values().next().value ?? 'unsupported'
}

/**
 * Detect whether string samples should be treated as dates.
 */
function detectStringDateSignal(key: string, samples: readonly string[]): InferenceSignal {
  if (samples.length === 0) {
    return {type: 'category', confidence: 'low', looksDateLike: false}
  }

  const parseableCount = samples.filter((value) => !Number.isNaN(Date.parse(value))).length
  const strongDatePatternCount = samples.filter(
    (value) => DATE_VALUE_PATTERN.test(value) || DATETIME_VALUE_PATTERN.test(value),
  ).length
  const parseRatio = parseableCount / samples.length
  const strongPatternRatio = strongDatePatternCount / samples.length
  const hasDateKeySignal = DATE_KEY_PATTERN.test(key)

  if (strongPatternRatio >= 0.8 || (parseRatio === 1 && hasDateKeySignal)) {
    return {type: 'date', confidence: 'high', looksDateLike: true}
  }

  if (parseRatio >= 0.8 && hasDateKeySignal) {
    return {type: 'date', confidence: 'medium', looksDateLike: true}
  }

  return {
    type: 'category',
    confidence: parseRatio >= 0.8 ? 'medium' : 'low',
    looksDateLike: parseRatio >= 0.8,
  }
}

/**
 * Detect whether numeric samples should be treated as timestamps.
 */
function detectNumericDateSignal(key: string, samples: readonly number[]): InferenceSignal {
  if (!DATE_KEY_PATTERN.test(key) || samples.length === 0) {
    return {type: 'number', confidence: 'high', looksDateLike: false}
  }

  const plausibleTimestampCount = samples.filter((value) => {
    if (!Number.isFinite(value)) return false
    const milliseconds = value > 1e12 ? value : value * 1000
    return milliseconds >= Date.UTC(2000, 0, 1) && milliseconds <= Date.UTC(2100, 0, 1)
  }).length

  const ratio = plausibleTimestampCount / samples.length
  if (ratio === 1) {
    return {type: 'date', confidence: 'high', looksDateLike: true}
  }

  if (ratio >= 0.8) {
    return {type: 'date', confidence: 'medium', looksDateLike: true}
  }

  return {type: 'number', confidence: 'high', looksDateLike: false}
}

/**
 * Infer the best-fit column type for one field.
 */
function inferColumnType(
  key: string,
  samples: readonly PrimitiveSample[],
): {type: ChartColumnType | null; confidence: InferenceConfidence; looksDateLike: boolean} {
  const runtimeKind = classifyRuntimeField(samples)
  switch (runtimeKind) {
    case 'boolean':
      return {type: 'boolean', confidence: 'high', looksDateLike: false}
    case 'date':
      return {type: 'date', confidence: 'high', looksDateLike: true}
    case 'number': {
      const signal = detectNumericDateSignal(key, samples as readonly number[])
      return {type: signal.type, confidence: signal.confidence, looksDateLike: signal.looksDateLike}
    }
    case 'category': {
      const signal = detectStringDateSignal(key, samples as readonly string[])
      return {type: signal.type, confidence: signal.confidence, looksDateLike: signal.looksDateLike}
    }
    case 'empty':
      return {type: null, confidence: 'low', looksDateLike: false}
    default:
      return {type: null, confidence: 'low', looksDateLike: false}
  }
}

/**
 * Pick a default formatter preset for one inferred column.
 */
function inferDefaultFormat(key: string, type: ChartColumnType): ColumnFormatPreset | undefined {
  if (type === 'date') {
    return /time|timestamp|at$/i.test(key) ? 'datetime' : 'date'
  }

  if (type !== 'number') {
    return undefined
  }

  if (CURRENCY_KEY_PATTERN.test(key)) {
    return 'currency'
  }

  if (PERCENT_KEY_PATTERN.test(key)) {
    return 'percent'
  }

  return 'number'
}

/**
 * Build reusable debug metadata for one resolved column.
 */
function createInferenceMetadata(
  detectedType: ChartColumnType,
  confidence: InferenceConfidence,
  hinted: boolean,
): ColumnInferenceMetadata {
  return {detectedType, confidence, hinted}
}

/**
 * Normalize numeric timestamps so second-based Unix values also behave like dates.
 */
function normalizeDateValue(value: string | number | Date): string | number | Date {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value
  }

  if (value >= 1e9 && value < 1e12) {
    return value * 1000
  }

  return value
}

/**
 * Build a date column for one field.
 */
function createDateColumn<T, TId extends string>(
  key: TId,
  hint: RuntimeColumnHint<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): DateColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'date',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' && hint?.format ? hint.format : inferDefaultFormat(key, 'date'),
    formatter: typeof hint === 'object' ? (hint.formatter as DateColumn<T, TId>['formatter']) : undefined,
    inference: createInferenceMetadata('date', confidence, hinted),
    accessor: (item: T) => {
      const value = accessor(item)
      return value instanceof Date || typeof value === 'string' || typeof value === 'number'
        ? normalizeDateValue(value)
        : null
    },
  }
}

/**
 * Build a category column for one field.
 */
function createCategoryColumn<T, TId extends string>(
  key: TId,
  hint: RuntimeColumnHint<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): CategoryColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'category',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' ? hint.format : undefined,
    formatter: typeof hint === 'object'
      ? (hint.formatter as CategoryColumn<T, TId>['formatter'])
      : undefined,
    inference: createInferenceMetadata('category', confidence, hinted),
    accessor: (item: T) => {
      const value = accessor(item)
      return value == null ? null : String(value)
    },
  }
}

/**
 * Build a boolean column for one field.
 */
function createBooleanColumn<T, TId extends string>(
  key: TId,
  hint: RuntimeColumnHint<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): BooleanColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  const trueLabel = typeof hint === 'object' && 'trueLabel' in hint && hint.trueLabel ? hint.trueLabel : 'True'
  const falseLabel = typeof hint === 'object' && 'falseLabel' in hint && hint.falseLabel ? hint.falseLabel : 'False'

  return {
    id: key,
    type: 'boolean',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' ? hint.format : undefined,
    formatter: typeof hint === 'object'
      ? (hint.formatter as BooleanColumn<T, TId>['formatter'])
      : undefined,
    inference: createInferenceMetadata('boolean', confidence, hinted),
    trueLabel,
    falseLabel,
    accessor: (item: T) => {
      const value = accessor(item)
      return typeof value === 'boolean' ? value : null
    },
  }
}

/**
 * Build a number column for one field.
 */
function createNumberColumn<T, TId extends string>(
  key: TId,
  hint: RuntimeColumnHint<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): NumberColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'number',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' && hint?.format ? hint.format : inferDefaultFormat(key, 'number'),
    formatter: typeof hint === 'object' ? (hint.formatter as NumberColumn<T, TId>['formatter']) : undefined,
    inference: createInferenceMetadata('number', confidence, hinted),
    accessor: (item: T) => {
      const value = accessor(item)
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    },
  }
}

/**
 * Build one resolved column from data samples and optional hint overrides.
 */
function buildColumn<T, TId extends InferableFieldKey<T>>(
  key: TId,
  samples: readonly PrimitiveSample[],
  hint: ColumnHints<T>[TId] | undefined,
): ChartColumn<T, TId> | null {
  if (hint === false) {
    return null
  }

  const runtimeHint = hint ? (hint as unknown as RuntimeColumnHint<T>) : undefined
  const inferred = inferColumnType(key, samples)
  const hintedType = runtimeHint?.type
  const resolvedType = hintedType ?? inferred.type
  if (!resolvedType) {
    return null
  }

  if (hintedType && inferred.type && hintedType !== inferred.type) {
    warn(`columnHints.${key} overrides inferred type "${inferred.type}" with "${hintedType}".`)
  }

  if (inferred.looksDateLike && inferred.type !== 'date' && !hintedType) {
    warn(`Field "${key}" looks date-like but was inferred as category. Add columnHints.${key}.type = 'date' if that is intentional.`)
  }

  const confidence = hintedType ? 'high' : inferred.confidence
  switch (resolvedType) {
    case 'date':
      return createDateColumn(key, runtimeHint, confidence, hintedType != null)
    case 'category':
      return createCategoryColumn(key, runtimeHint, confidence, hintedType != null)
    case 'boolean':
      return createBooleanColumn(key, runtimeHint, confidence, hintedType != null)
    case 'number':
      return createNumberColumn(key, runtimeHint, confidence, hintedType != null)
  }
}

/**
 * Order resolved columns so the best default chart choices appear first.
 */
function sortResolvedColumns<T>(
  columns: readonly ChartColumn<T, string>[],
): ChartColumn<T, string>[] {
  const typeRank: Record<ChartColumnType, number> = {
    date: 0,
    category: 1,
    boolean: 2,
    number: 3,
  }

  return [...columns].sort((left, right) => {
    const byType = typeRank[left.type] - typeRank[right.type]
    if (byType !== 0) {
      return byType
    }

    const leftIdLike = /(^id$|id$|uuid|slug|token|hash)/i.test(left.id)
    const rightIdLike = /(^id$|id$|uuid|slug|token|hash)/i.test(right.id)
    if (leftIdLike !== rightIdLike) {
      return leftIdLike ? 1 : -1
    }

    return left.label.localeCompare(right.label)
  })
}

/**
 * Infer chart columns directly from raw single-source data and optional hints.
 */
export function inferColumnsFromData<T, const THints extends ColumnHints<T> | undefined = undefined>(
  data: readonly T[],
  columnHints?: THints,
): readonly ChartColumn<T, ResolvedColumnIdFromHints<T, THints>>[] {
  const fields = collectFieldKeys(data, columnHints)
  const inferredColumns: ChartColumn<T, string>[] = []

  for (const field of fields) {
    const samples = collectSamples(data, field)
    const column = buildColumn(field as InferableFieldKey<T>, samples, columnHints?.[field as InferableFieldKey<T>])
    if (column) {
      inferredColumns.push(column)
    }
  }

  if (inferredColumns.length === 0) {
    warn('No inferable primitive fields were found. Provide non-empty data or columnHints.')
  }

  return sortResolvedColumns(inferredColumns) as unknown as readonly ChartColumn<
    T,
    ResolvedColumnIdFromHints<T, THints>
  >[]
}
