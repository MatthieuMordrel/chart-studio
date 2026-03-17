import type {
  BooleanColumn,
  CategoryColumn,
  ChartColumn,
  ColumnFormat,
  ChartSchemaDefinition,
  ChartSchema,
  ChartColumnType,
  ColumnInferenceMetadata,
  DerivedBooleanColumnSchema,
  DerivedCategoryColumnSchema,
  DerivedColumnSchema,
  DerivedDateColumnSchema,
  DerivedNumberColumnSchema,
  DateColumn,
  InferenceConfidence,
  InferableFieldKey,
  NumberColumn,
  ResolvedChartSchemaFromDefinition,
  RawColumnSchemaMap,
  ResolvedColumnIdFromSchema,
} from './types.js'
import { resolveChartSchemaDefinition } from './schema-builder.js'

const MAX_SAMPLE_COUNT = 50
const DATE_KEY_PATTERN = /(date|time|timestamp|created|updated|start|end|deadline|due|scheduled|posted|published|at)$/i
const DATETIME_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}/i
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}(-\d{2})?(?:[t\s].+)?$/i

type PrimitiveSample = string | number | boolean | Date
type RuntimeFieldKind = ChartColumnType | 'mixed' | 'empty' | 'unsupported'
type RuntimeFormatterValue<TFormatter> =
  TFormatter extends (value: infer TValue, item?: any) => string ? TValue : never
type RuntimeColumnSchema<T> = {
  label?: string
  format?: ColumnFormat
  formatter?: ((value: unknown, item?: T) => string) | undefined
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
 * Treat one runtime string key as an inferable top-level field key.
 *
 * `collectFieldKeys()` only emits keys from the raw data objects and from the
 * raw-field section of `schema.columns`, so this cast is the narrow boundary between runtime
 * string discovery and the strongly typed inference pipeline.
 */
function toInferableFieldKey<T>(key: string): InferableFieldKey<T> {
  return key as InferableFieldKey<T>
}

/**
 * Adapt a strongly typed field formatter to the looser runtime formatter shape.
 *
 * The runtime inference layer does not know the exact field value type after a
 * hint is selected, so the formatter is widened once here instead of repeating
 * casts across each column builder.
 */
function toRuntimeFormatter<T, TFormatter extends ((value: any, item?: any) => string) | undefined>(
  formatter: TFormatter,
): RuntimeColumnSchema<T>['formatter'] {
  if (!formatter) {
    return undefined
  }

  return (value, item) => formatter(value as RuntimeFormatterValue<TFormatter>, item)
}

/**
 * Normalize one raw-field schema override into the runtime shape used by the inference layer.
 *
 * Schema formatters are intentionally more specific than the runtime pipeline can
 * express, so this helper contains the one widening step that keeps the rest of
 * the implementation free of repeated formatter casts.
 */
function toRuntimeColumnSchema<T, TId extends InferableFieldKey<T>>(
  columnSchema: RawColumnSchemaMap<T>[TId] | undefined,
): RuntimeColumnSchema<T> | undefined {
  if (!columnSchema || columnSchema === false) {
    return undefined
  }

  return {
    ...columnSchema,
    formatter: toRuntimeFormatter(columnSchema.formatter),
  }
}

/**
 * Extract raw-field schema entries from the full schema object.
 */
function getRawColumnSchemaMap<T>(
  schema: ChartSchema<T, any> | undefined,
): RawColumnSchemaMap<T> | undefined {
  if (!schema?.columns) {
    return undefined
  }

  const rawColumns: RawColumnSchemaMap<T> = {}
  for (const [key, value] of Object.entries(schema.columns)) {
    if (value !== false && typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'derived') {
      continue
    }

    rawColumns[key as InferableFieldKey<T>] = value as RawColumnSchemaMap<T>[InferableFieldKey<T>]
  }

  return rawColumns
}

/**
 * Extract derived column definitions from the full schema object.
 *
 * Derived ids are additive-only. If callers attempt to reuse a raw field id,
 * the explicit derived definition is ignored so runtime behavior stays aligned
 * with the public contract even in untyped JavaScript or unsafe casts.
 */
function getDerivedColumnSchemas<T>(
  schema: ChartSchema<T, any> | undefined,
  rawFieldIds: ReadonlySet<string>,
): Array<[string, DerivedColumnSchema<T>]> {
  if (!schema?.columns) {
    return []
  }

  return Object.entries(schema.columns).flatMap(([key, value]) => {
    if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'derived') {
      const derivedColumn = value as DerivedColumnSchema<T>

      if (rawFieldIds.has(key)) {
        warn(`schema.columns.${key} cannot be derived because derived columns must use a new id instead of replacing a raw field.`)
        return []
      }

      if (derivedColumn.label.trim().length === 0) {
        warn(`schema.columns.${key} should declare a non-empty label so derived columns stay intentional in the UI.`)
      }

      return [[key, derivedColumn]]
    }

    return []
  })
}

/**
 * Extract only string samples after runtime classification has selected the
 * string/category path.
 */
function getStringSamples(samples: readonly PrimitiveSample[]): readonly string[] {
  return samples.filter((value): value is string => typeof value === 'string')
}

/**
 * Extract only numeric samples after runtime classification has selected the
 * numeric path.
 */
function getNumberSamples(samples: readonly PrimitiveSample[]): readonly number[] {
  return samples.filter((value): value is number => typeof value === 'number')
}

/**
 * Narrow the final inferred columns array back to the literal column-id union
 * derived from the caller's hints.
 *
 * Inference happens over runtime strings, but every column in this array was
 * constructed from keys collected by `collectFieldKeys()` and filtered through
 * `buildColumn()`. This cast is therefore the final boundary between runtime
 * discovery and the exported literal-id API.
 */
function finalizeResolvedColumns<
  T,
  TColumnId extends string,
>(
  columns: readonly ChartColumn<T, string>[],
): readonly ChartColumn<T, TColumnId>[] {
  return columns as unknown as readonly ChartColumn<T, TColumnId>[]
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
 * Gather all top-level raw field keys present in data or raw schema overrides.
 */
function collectFieldKeys<T>(
  data: readonly T[],
  rawColumnSchema: RawColumnSchemaMap<T> | undefined,
): string[] {
  const keys = new Set<string>()

  for (const item of data) {
    for (const key of Object.keys(item as Record<string, unknown>)) {
      keys.add(key)
    }
  }

  for (const key of Object.keys(rawColumnSchema ?? {})) {
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
    // `Date.parse()` accepts many id-like strings such as `req-1`, so only
    // surface the date-like warning when the key or the values provide an
    // actual date signal instead of relying on parseability alone.
    looksDateLike: strongPatternRatio >= 0.8 || (parseRatio >= 0.8 && hasDateKeySignal),
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
      const signal = detectNumericDateSignal(key, getNumberSamples(samples))
      return {type: signal.type, confidence: signal.confidence, looksDateLike: signal.looksDateLike}
    }
    case 'category': {
      const signal = detectStringDateSignal(key, getStringSamples(samples))
      return {type: signal.type, confidence: signal.confidence, looksDateLike: signal.looksDateLike}
    }
    case 'empty':
      return {type: null, confidence: 'low', looksDateLike: false}
    default:
      return {type: null, confidence: 'low', looksDateLike: false}
  }
}

/**
 * Keep inferred columns neutral unless the caller opts into a specific format.
 */
function inferDefaultFormat(_key: string, _type: ChartColumnType): undefined {
  return undefined
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
  hint: RuntimeColumnSchema<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): DateColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'date',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' && hint?.format ? hint.format : inferDefaultFormat(key, 'date'),
    formatter: hint?.formatter,
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
  hint: RuntimeColumnSchema<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): CategoryColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'category',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' ? hint.format : undefined,
    formatter: hint?.formatter,
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
  hint: RuntimeColumnSchema<T> | undefined,
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
    formatter: hint?.formatter,
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
  hint: RuntimeColumnSchema<T> | undefined,
  confidence: InferenceConfidence,
  hinted: boolean,
): NumberColumn<T, TId> {
  const accessor = createAccessor<T>(key)
  return {
    id: key,
    type: 'number',
    label: typeof hint === 'object' && hint?.label ? hint.label : humanizeKey(key),
    format: typeof hint === 'object' && hint?.format ? hint.format : inferDefaultFormat(key, 'number'),
    formatter: hint?.formatter,
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
function buildRawColumn<T, TId extends InferableFieldKey<T>>(
  key: TId,
  samples: readonly PrimitiveSample[],
  columnSchema: RawColumnSchemaMap<T>[TId] | undefined,
): ChartColumn<T, TId> | null {
  if (columnSchema === false) {
    return null
  }

  const runtimeSchema = toRuntimeColumnSchema(columnSchema)
  const inferred = inferColumnType(key, samples)
  const hintedType = runtimeSchema?.type
  const resolvedType = hintedType ?? inferred.type
  if (!resolvedType) {
    return null
  }

  if (hintedType && inferred.type && hintedType !== inferred.type) {
    warn(`schema.columns.${key} overrides inferred type "${inferred.type}" with "${hintedType}".`)
  }

  if (inferred.looksDateLike && inferred.type !== 'date' && !hintedType) {
    warn(`Field "${key}" looks date-like but was inferred as category. Add schema.columns.${key}.type = 'date' if that is intentional.`)
  }

  const confidence = hintedType ? 'high' : inferred.confidence
  switch (resolvedType) {
    case 'date':
      return createDateColumn(key, runtimeSchema, confidence, hintedType != null)
    case 'category':
      return createCategoryColumn(key, runtimeSchema, confidence, hintedType != null)
    case 'boolean':
      return createBooleanColumn(key, runtimeSchema, confidence, hintedType != null)
    case 'number':
      return createNumberColumn(key, runtimeSchema, confidence, hintedType != null)
  }
}

/**
 * Adapt one explicit derived column definition into the shared runtime shape.
 */
function toRuntimeDerivedSchema<T>(columnSchema: DerivedColumnSchema<T>): RuntimeColumnSchema<T> {
  return {
    ...columnSchema,
    formatter: toRuntimeFormatter(columnSchema.formatter),
  }
}

/**
 * Build one resolved derived column from the explicit schema.
 */
function buildDerivedColumn<T>(
  key: string,
  columnSchema:
    | DerivedDateColumnSchema<T>
    | DerivedCategoryColumnSchema<T>
    | DerivedBooleanColumnSchema<T>
    | DerivedNumberColumnSchema<T>,
): ChartColumn<T, string> {
  const runtimeSchema = toRuntimeDerivedSchema(columnSchema)
  switch (columnSchema.type) {
    case 'date':
      return {
        ...createDateColumn(key, runtimeSchema, 'high', true),
        accessor: columnSchema.accessor,
      }
    case 'category':
      return {
        ...createCategoryColumn(key, runtimeSchema, 'high', true),
        accessor: columnSchema.accessor,
      }
    case 'boolean':
      return {
        ...createBooleanColumn(key, runtimeSchema, 'high', true),
        accessor: columnSchema.accessor,
      }
    case 'number':
      return {
        ...createNumberColumn(key, runtimeSchema, 'high', true),
        accessor: columnSchema.accessor,
      }
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
 * Reorder resolved columns so that schema-declared columns maintain their
 * declaration order while inferred-only columns keep their default sorted
 * positions.
 *
 * The algorithm first sorts all columns with the default heuristic, then
 * replaces the positions occupied by declared columns with those same
 * columns in schema declaration order. This preserves type-rank placement
 * for inferred columns while honouring the author's intent for explicitly
 * declared ones.
 *
 * When no schema columns are declared, all columns are sorted using the
 * default heuristic.
 */
function orderResolvedColumns<T>(
  columns: readonly ChartColumn<T, string>[],
  schemaColumnOrder: readonly string[] | null,
): ChartColumn<T, string>[] {
  const sorted = sortResolvedColumns(columns)

  if (!schemaColumnOrder || schemaColumnOrder.length === 0) {
    return sorted
  }

  const declaredIds = new Set(schemaColumnOrder)

  // Collect the sorted-array positions occupied by declared columns.
  const declaredPositions: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (declaredIds.has(sorted[i]!.id)) {
      declaredPositions.push(i)
    }
  }

  // Collect the declared columns in their schema declaration order.
  const schemaOrderIndex = new Map(schemaColumnOrder.map((id, index) => [id, index]))
  const declaredInSchemaOrder = sorted
    .filter(column => declaredIds.has(column.id))
    .sort((a, b) => schemaOrderIndex.get(a.id)! - schemaOrderIndex.get(b.id)!)

  // Place declaration-ordered columns back into their sorted positions.
  const result = [...sorted]
  for (let i = 0; i < declaredPositions.length; i++) {
    result[declaredPositions[i]!] = declaredInSchemaOrder[i]!
  }

  return result
}

/**
 * Resolve chart columns directly from raw data and an optional explicit schema.
 */
export function inferColumnsFromData<
  T,
  const TSchema extends ChartSchemaDefinition<T, any> | undefined = undefined,
>(
  data: readonly T[],
  schema?: TSchema,
): readonly ChartColumn<T, ResolvedColumnIdFromSchema<T, ResolvedChartSchemaFromDefinition<TSchema>>>[] {
  const resolvedSchema = resolveChartSchemaDefinition(schema) as ChartSchema<T, any> | undefined
  const rawColumnSchema = getRawColumnSchemaMap<T>(resolvedSchema)
  const fields = collectFieldKeys(data, rawColumnSchema)
  const rawFieldIds = new Set(fields)
  const resolvedColumns: ChartColumn<T, string>[] = []

  for (const field of fields) {
    const samples = collectSamples(data, field)
    const typedField = toInferableFieldKey<T>(field)
    const column = buildRawColumn(typedField, samples, rawColumnSchema?.[typedField])
    if (column) {
      resolvedColumns.push(column)
    }
  }

  for (const [key, columnSchema] of getDerivedColumnSchemas(resolvedSchema, rawFieldIds)) {
    resolvedColumns.push(buildDerivedColumn(key, columnSchema))
  }

  if (resolvedColumns.length === 0) {
    warn('No inferable or explicit chart columns were found. Provide non-empty data or schema.columns.')
  }

  const schemaColumnOrder = resolvedSchema?.columns
    ? Object.keys(resolvedSchema.columns)
    : null

  return finalizeResolvedColumns<
    T,
    ResolvedColumnIdFromSchema<T, ResolvedChartSchemaFromDefinition<TSchema>>
  >(orderResolvedColumns(resolvedColumns, schemaColumnOrder))
}
