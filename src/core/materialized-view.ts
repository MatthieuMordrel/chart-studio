import {createDatasetChartBuilder} from './schema-builder.js'
import {validateDatasetData} from './define-dataset.js'
import type {
  DefinedDataModel,
  ModelAssociationDefinition,
  ModelAttributeDefinition,
  ModelDataInput,
  ModelRelationshipDefinition,
} from './data-model.types.js'
import type {DefinedDataset} from './dataset-builder.types.js'
import type {
  DefinedMaterializedView,
  MaterializedViewDefinition,
  MaterializedViewMetadata,
  MaterializedViewStepMetadata,
  ModelMaterializationBuilder,
  ModelMaterializationStartBuilder,
} from './materialized-view.types.js'

/**
 * Runtime implementation for Phase 7 materialized views.
 *
 * The helpers in this file intentionally keep behavior explicit:
 * lookup projection preserves grain, relationship/association traversal expands
 * grain, and every materialized row array is still a plain in-memory dataset
 * that `useChart({data, schema})` can consume directly.
 */

type PrimitiveKeyValue = string | number | boolean | bigint | symbol | Date
type KeyValuePart = PrimitiveKeyValue | null | undefined

type LookupStep = {
  kind: 'join'
  alias: string
  relationshipId: string
  targetDatasetId: string
  projectedColumns: readonly string[]
}

type RelationshipExpansionStep = {
  kind: 'through-relationship'
  alias: string
  relationshipId: string
  targetDatasetId: string
  projectedColumns: readonly string[]
}

type AssociationExpansionStep = {
  kind: 'through-association'
  alias: string
  associationId: string
  targetDatasetId: string
  projectedColumns: readonly string[]
}

type MaterializationStep =
  | LookupStep
  | RelationshipExpansionStep
  | AssociationExpansionStep

type MaterializationState = {
  id: string
  model: DefinedDataModel<any, any, any, any>
  baseDatasetId: string
  steps: readonly MaterializationStep[]
  hasExpansion: boolean
}

type DatasetKeyIndex = {
  keyId: string
  rowsByKey: ReadonlyMap<string, Record<string, unknown>>
}

type AssociationLookup = {
  fromKeyId: string
  toKeyId: string
  fromToValues: ReadonlyMap<string, ReadonlySet<string>>
  toFromValues: ReadonlyMap<string, ReadonlySet<string>>
}

/** Humanize one identifier for labels and metadata. */
function humanizeId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Convert one projected source column into its flat output field id. */
function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`
}

/** Build a readable label for one projected output column. */
function buildProjectedLabel(alias: string, columnId: string, sourceLabel: string): string {
  const aliasLabel = humanizeId(alias).trim()
  const nextLabel = sourceLabel.trim().length > 0 ? sourceLabel.trim() : humanizeId(columnId)
  const normalizedAlias = aliasLabel.toLowerCase()
  const normalizedLabel = nextLabel.toLowerCase()

  if (normalizedLabel === normalizedAlias || normalizedLabel.startsWith(`${normalizedAlias} `)) {
    return nextLabel
  }

  return `${aliasLabel} ${nextLabel}`
}

/** Serialize one key value so runtime indexes can use stable string keys. */
function serializeKeyValue(value: PrimitiveKeyValue): string {
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  return `${typeof value}:${String(value)}`
}

/** Format one composite key value for validation errors. */
function formatKeyValue(value: readonly KeyValuePart[]): string {
  return value.length === 1
    ? String(value[0])
    : `[${value.map((part) => String(part)).join(', ')}]`
}

/** Format one runtime value for validation-style error messages. */
function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

/** Best-effort formatter for serialized lookup keys used in error messages. */
function formatSerializedKeyValue(value: string): string {
  const separatorIndex = value.indexOf(':')

  return separatorIndex >= 0
    ? value.slice(separatorIndex + 1)
    : value
}

/** Build a deterministic fingerprint for one runtime key tuple. */
function buildKeyFingerprint(parts: readonly KeyValuePart[]): string {
  return JSON.stringify(
    parts.map((part) => {
      if (part instanceof Date) {
        return {type: 'date', value: part.toISOString()}
      }

      return {
        type: typeof part,
        value: part,
      }
    }),
  )
}

/** Re-run dataset-style key validation on materialized output rows. */
function validateMaterializedRows(
  key: readonly string[] | undefined,
  rows: readonly Record<string, unknown>[],
  datasetLabel: string,
): void {
  if (!key || key.length === 0) {
    return
  }

  const seen = new Map<string, readonly KeyValuePart[]>()

  rows.forEach((row, index) => {
    const parts = key.map((keyId) => row[keyId] as KeyValuePart)
    const missingKeyIndex = parts.findIndex((part) => part == null)

    if (missingKeyIndex >= 0) {
      throw new Error(
        `Dataset "${datasetLabel}" key "${key.join(', ')}" is missing a value at row ${index} for "${key[missingKeyIndex]}".`,
      )
    }

    const fingerprint = buildKeyFingerprint(parts)
    const existing = seen.get(fingerprint)

    if (existing) {
      throw new Error(
        `Dataset "${datasetLabel}" key "${key.join(', ')}" must be unique. Duplicate value: ${formatKeyValue(parts)}.`,
      )
    }

    seen.set(fingerprint, parts)
  })
}

/** Read the single declared key from one dataset or fail fast. */
function getSingleDatasetKeyId(datasetId: string, dataset: {key?: readonly string[]}): string {
  if (!dataset.key || dataset.key.length !== 1) {
    throw new Error(`Dataset "${datasetId}" must declare exactly one key to participate in materialization joins.`)
  }

  const keyId = dataset.key[0]
  if (!keyId) {
    throw new Error(`Dataset "${datasetId}" must declare exactly one key to participate in materialization joins.`)
  }

  return keyId
}

/** Resolve the default projection list for one joined or expanded dataset. */
function getDeclaredProjectionColumnIds(
  dataset: DefinedDataset<any, any, any>,
  includeKey: boolean,
): string[] {
  const columns = dataset.columns
  if (!columns) {
    return includeKey && dataset.key?.length === 1
      ? [dataset.key[0]!]
      : []
  }

  const keyId = dataset.key?.length === 1 ? dataset.key[0] : undefined
  const projectedIds = Object.entries(columns)
    .filter(([, column]) => column !== false)
    .map(([columnId]) => columnId)

  if (!includeKey && keyId) {
    return projectedIds.filter((columnId) => columnId !== keyId)
  }

  if (includeKey && keyId && !projectedIds.includes(keyId)) {
    return [keyId, ...projectedIds]
  }

  return projectedIds
}

/** Normalize one caller-provided projection list and enforce key visibility rules. */
function resolveProjectedColumns(
  datasetId: string,
  dataset: DefinedDataset<any, any, any>,
  requestedColumns: readonly string[] | undefined,
  includeKey: boolean,
): string[] {
  const projectedIds = requestedColumns
    ? [...new Set(requestedColumns)]
    : getDeclaredProjectionColumnIds(dataset, includeKey)

  if (includeKey) {
    const keyId = getSingleDatasetKeyId(datasetId, dataset)
    if (!projectedIds.includes(keyId)) {
      projectedIds.unshift(keyId)
    }
  }

  projectedIds.forEach((columnId) => {
    if (dataset.columns?.[columnId] === false) {
      throw new Error(
        `Materialized view cannot project excluded column "${columnId}" from dataset "${datasetId}".`,
      )
    }
  })

  return projectedIds
}

/** Read one projected source column, including dataset-level derived columns. */
function readSourceColumnValue(
  dataset: DefinedDataset<any, any, any>,
  columnId: string,
  row: Record<string, unknown>,
): unknown {
  const column = dataset.columns?.[columnId]

  if (column && typeof column === 'object' && 'kind' in column && column.kind === 'derived') {
    return column.accessor(row)
  }

  return row[columnId]
}

/** Resolve the best available display label for one source column. */
function getSourceColumnLabel(
  dataset: DefinedDataset<any, any, any>,
  columnId: string,
): string {
  const column = dataset.columns?.[columnId]

  if (column && typeof column === 'object' && 'label' in column && typeof column.label === 'string' && column.label.trim().length > 0) {
    return column.label
  }

  return humanizeId(columnId)
}

/** Convert one source column definition into the flattened output column config. */
function buildProjectedColumnConfig(
  alias: string,
  dataset: DefinedDataset<any, any, any>,
  columnId: string,
): Record<string, unknown> {
  const sourceColumn = dataset.columns?.[columnId]
  const label = buildProjectedLabel(alias, columnId, getSourceColumnLabel(dataset, columnId))

  if (!sourceColumn || sourceColumn === false) {
    return {label}
  }

  if (typeof sourceColumn === 'object' && 'kind' in sourceColumn && sourceColumn.kind === 'derived') {
    const nextColumn: Record<string, unknown> = {
      type: sourceColumn.type,
      label,
    }

    if ('format' in sourceColumn && sourceColumn.format !== undefined) {
      nextColumn['format'] = sourceColumn.format
    }
    if ('formatter' in sourceColumn && sourceColumn.formatter !== undefined) {
      nextColumn['formatter'] = sourceColumn.formatter
    }
    if ('trueLabel' in sourceColumn && sourceColumn.trueLabel !== undefined) {
      nextColumn['trueLabel'] = sourceColumn.trueLabel
    }
    if ('falseLabel' in sourceColumn && sourceColumn.falseLabel !== undefined) {
      nextColumn['falseLabel'] = sourceColumn.falseLabel
    }

    return nextColumn
  }

  const nextColumn: Record<string, unknown> = {
    label,
  }
  const rawColumn = sourceColumn as Record<string, unknown>

  if ('type' in rawColumn && rawColumn['type'] !== undefined) {
    nextColumn['type'] = rawColumn['type']
  }
  if ('format' in rawColumn && rawColumn['format'] !== undefined) {
    nextColumn['format'] = rawColumn['format']
  }
  if ('formatter' in rawColumn && rawColumn['formatter'] !== undefined) {
    nextColumn['formatter'] = rawColumn['formatter']
  }
  if ('trueLabel' in rawColumn && rawColumn['trueLabel'] !== undefined) {
    nextColumn['trueLabel'] = rawColumn['trueLabel']
  }
  if ('falseLabel' in rawColumn && rawColumn['falseLabel'] !== undefined) {
    nextColumn['falseLabel'] = rawColumn['falseLabel']
  }

  return nextColumn
}

/** Return true when one dataset column definition is a derived field. */
function isDerivedDatasetColumn(
  column: unknown,
): column is {
  kind: 'derived'
} {
  return !!column && typeof column === 'object' && 'kind' in column && column.kind === 'derived'
}

/**
 * Resolve the raw base columns that a materialized view should preserve.
 *
 * Keys remain available by default, explicit lookup joins preserve their
 * foreign-key columns, and omitted fields stay omitted unless they are one of
 * those structural columns. Explicit `false` exclusions still win.
 */
function getMaterializedBaseRawColumnIds(
  model: DefinedDataModel<any, any, any, any>,
  baseDatasetId: string,
  steps: readonly MaterializationStep[],
): string[] {
  const baseDataset = model.datasets[baseDatasetId]!
  const baseColumns = baseDataset.columns ?? {}
  const columnIds: string[] = []

  const includeColumnId = (columnId: string) => {
    if (baseColumns[columnId] === false || columnIds.includes(columnId)) {
      return
    }

    columnIds.push(columnId)
  }

  baseDataset.key?.forEach((columnId: string) => {
    includeColumnId(columnId)
  })

  steps.forEach((step) => {
    if (step.kind !== 'join') {
      return
    }

    const relationship = model.relationships[step.relationshipId] as ModelRelationshipDefinition
    if (relationship.to.dataset === baseDatasetId) {
      includeColumnId(relationship.to.column)
    }
  })

  Object.entries(baseColumns).forEach(([columnId, column]) => {
    if (column === false || isDerivedDatasetColumn(column)) {
      return
    }

    includeColumnId(columnId)
  })

  return columnIds
}

/** Copy only the declared materialized base-row fields into one output row. */
function buildBaseOutputRow(
  model: DefinedDataModel<any, any, any, any>,
  baseDatasetId: string,
  steps: readonly MaterializationStep[],
  row: Record<string, unknown>,
): Record<string, unknown> {
  const outputRow: Record<string, unknown> = {}

  getMaterializedBaseRawColumnIds(model, baseDatasetId, steps).forEach((columnId) => {
    outputRow[columnId] = row[columnId]
  })

  return outputRow
}

/** Build a key lookup for one dataset so lookup joins and expansions stay fast. */
function buildDatasetKeyIndex(
  _datasetId: string,
  keyId: string,
  rows: readonly Record<string, unknown>[],
): DatasetKeyIndex {
  const rowsByKey = new Map<string, Record<string, unknown>>()

  rows.forEach((row) => {
    const value = row[keyId]
    if (value == null) {
      return
    }

    rowsByKey.set(serializeKeyValue(value as PrimitiveKeyValue), row)
  })

  return {
    keyId,
    rowsByKey,
  }
}

/** Validate only the datasets a materialized view actually reads from. */
function validateMaterializationDatasets(
  definition: {
    model: DefinedDataModel<any, any, any, any>
    baseDatasetId: string
    steps: readonly MaterializationStep[]
  },
  data: ModelDataInput<any>,
): void {
  const requiredDatasetIds = new Set<string>([definition.baseDatasetId])

  definition.steps.forEach((step) => {
    requiredDatasetIds.add(step.targetDatasetId)
  })

  requiredDatasetIds.forEach((datasetId) => {
    const rows = data[datasetId]

    if (!Array.isArray(rows)) {
      throw new Error(`Missing dataset data for "${datasetId}".`)
    }

    validateDatasetData(
      definition.model.datasets[datasetId]!,
      rows as readonly Record<string, unknown>[],
      datasetId,
    )
  })
}

/** Add one edge to a symmetric association lookup map. */
function addLookupEdge(
  lookup: Map<string, Set<string>>,
  source: string,
  target: string,
): void {
  const existing = lookup.get(source)
  if (existing) {
    existing.add(target)
    return
  }

  lookup.set(source, new Set([target]))
}

/** Freeze a mutable lookup map into the readonly shape used at runtime. */
function toReadonlyLookup(
  lookup: Map<string, Set<string>>,
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(
    [...lookup].map(([key, values]) => [key, new Set(values)]),
  )
}

/** Build one association lookup from either explicit edge rows or derived edge values. */
function buildAssociationLookup(
  model: DefinedDataModel<any, any, any, any>,
  associationId: string,
  data: ModelDataInput<any>,
): AssociationLookup {
  const association = model.associations[associationId] as ModelAssociationDefinition
  const fromDataset = model.datasets[association.from.dataset]!
  const toDataset = model.datasets[association.to.dataset]!
  const fromKeyId = getSingleDatasetKeyId(association.from.dataset, fromDataset)
  const toKeyId = getSingleDatasetKeyId(association.to.dataset, toDataset)
  const fromToValues = new Map<string, Set<string>>()
  const toFromValues = new Map<string, Set<string>>()

  if (association.edge.kind === 'explicit') {
    const explicitEdge = association.edge

    explicitEdge.data.forEach((edgeRow) => {
      const fromValue = edgeRow[explicitEdge.columns.from]
      const toValue = edgeRow[explicitEdge.columns.to]

      if (fromValue == null || toValue == null) {
        return
      }

      const serializedFrom = serializeKeyValue(fromValue as PrimitiveKeyValue)
      const serializedTo = serializeKeyValue(toValue as PrimitiveKeyValue)
      addLookupEdge(fromToValues, serializedFrom, serializedTo)
      addLookupEdge(toFromValues, serializedTo, serializedFrom)
    })
  } else {
    const derivedEdge = association.edge
    const deriveDatasetId = derivedEdge.deriveFrom.dataset
    const deriveDataset = model.datasets[deriveDatasetId]!
    const deriveRows = data[deriveDatasetId] as readonly Record<string, unknown>[]
    const deriveKeyId = getSingleDatasetKeyId(deriveDatasetId, deriveDataset)

    deriveRows.forEach((row) => {
      const sourceKey = row[deriveKeyId]
      if (sourceKey == null) {
        return
      }

      const sourceFingerprint = serializeKeyValue(sourceKey as PrimitiveKeyValue)
      const values = derivedEdge.deriveFrom.values(row) ?? []

      values.forEach((value: unknown) => {
        if (value == null) {
          return
        }

        const valueFingerprint = serializeKeyValue(value as PrimitiveKeyValue)

        if (deriveDatasetId === association.from.dataset) {
          addLookupEdge(fromToValues, sourceFingerprint, valueFingerprint)
          addLookupEdge(toFromValues, valueFingerprint, sourceFingerprint)
          return
        }

        addLookupEdge(fromToValues, valueFingerprint, sourceFingerprint)
        addLookupEdge(toFromValues, sourceFingerprint, valueFingerprint)
      })
    })
  }

  return {
    fromKeyId,
    toKeyId,
    fromToValues: toReadonlyLookup(fromToValues),
    toFromValues: toReadonlyLookup(toFromValues),
  }
}

/** Copy projected values from one linked row into the flat materialized output row. */
function applyProjectedColumns(
  outputRow: Record<string, unknown>,
  alias: string,
  dataset: DefinedDataset<any, any, any>,
  sourceRow: Record<string, unknown> | null,
  projectedColumns: readonly string[],
  nullable: boolean,
): void {
  projectedColumns.forEach((columnId) => {
    const outputId = buildProjectedId(alias, columnId)

    if (Object.prototype.hasOwnProperty.call(outputRow, outputId)) {
      throw new Error(
        `Materialized view projection "${outputId}" collides with an existing output field. Choose a different alias or projected column set.`,
      )
    }

    outputRow[outputId] = sourceRow
      ? readSourceColumnValue(dataset, columnId, sourceRow)
      : (nullable ? null : undefined)
  })
}

/** Group child rows by parent key for explicit one-to-many expansion. */
function buildRelationshipChildrenByKey(
  relationship: ModelRelationshipDefinition,
  data: ModelDataInput<any>,
): ReadonlyMap<string, readonly Record<string, unknown>[]> {
  const children = new Map<string, Record<string, unknown>[]>()
  const childRows = data[relationship.to.dataset] as readonly Record<string, unknown>[]

  childRows.forEach((row) => {
    const value = row[relationship.to.column]
    if (value == null) {
      return
    }

    const serialized = serializeKeyValue(value as PrimitiveKeyValue)
    const existing = children.get(serialized)
    if (existing) {
      existing.push(row)
      return
    }

    children.set(serialized, [row])
  })

  return children
}

/** Convert an internal step into the public inspection metadata shape. */
function toStepMetadata(step: MaterializationStep): MaterializedViewStepMetadata {
  if (step.kind === 'join') {
    return {
      kind: 'join',
      alias: step.alias,
      relationship: step.relationshipId,
      targetDataset: step.targetDatasetId,
      projectedColumns: [...step.projectedColumns],
    }
  }

  if (step.kind === 'through-relationship') {
    return {
      kind: 'through-relationship',
      alias: step.alias,
      relationship: step.relationshipId,
      targetDataset: step.targetDatasetId,
      projectedColumns: [...step.projectedColumns],
    }
  }

  return {
    kind: 'through-association',
    alias: step.alias,
    association: step.associationId,
    targetDataset: step.targetDatasetId,
    projectedColumns: [...step.projectedColumns],
  }
}

/** Build the output column map for one materialized view. */
function buildMaterializedColumns(
  model: DefinedDataModel<any, any, any, any>,
  baseDatasetId: string,
  steps: readonly MaterializationStep[],
): Record<string, unknown> | undefined {
  const baseDataset = model.datasets[baseDatasetId]!
  const baseColumns = baseDataset.columns ?? {}

  const nextColumns: Record<string, unknown> = {}
  const derivedColumns: Record<string, unknown> = {}

  getMaterializedBaseRawColumnIds(model, baseDatasetId, steps).forEach((columnId) => {
    const column = baseColumns[columnId]
    nextColumns[columnId] = column && !isDerivedDatasetColumn(column)
      ? column
      : {}
  })

  Object.entries(baseColumns).forEach(([columnId, column]) => {
    if (column === false || !isDerivedDatasetColumn(column)) {
      return
    }

    derivedColumns[columnId] = column
  })

  steps.forEach((step) => {
    const targetDataset = model.datasets[step.targetDatasetId]!

    step.projectedColumns.forEach((columnId) => {
      const outputId = buildProjectedId(step.alias, columnId)

      if (Object.prototype.hasOwnProperty.call(nextColumns, outputId) ||
          Object.prototype.hasOwnProperty.call(derivedColumns, outputId)) {
        throw new Error(
          `Materialized view projection "${outputId}" collides with an existing output field. Choose a different alias or projected column set.`,
        )
      }

      nextColumns[outputId] = buildProjectedColumnConfig(step.alias, targetDataset, columnId)
    })
  })

  Object.assign(nextColumns, derivedColumns)

  return Object.keys(nextColumns).length > 0 ? nextColumns : undefined
}

/** Build the output key for one materialized view, extending it when grain expands. */
function buildMaterializedKey(
  model: DefinedDataModel<any, any, any, any>,
  baseDatasetId: string,
  steps: readonly MaterializationStep[],
): readonly string[] | undefined {
  const baseKey = model.datasets[baseDatasetId]!.key
  const expansionStep = steps.find((step) => step.kind !== 'join')

  if (!expansionStep) {
    return baseKey
  }

  const targetDataset = model.datasets[expansionStep.targetDatasetId]!
  const targetKeyId = getSingleDatasetKeyId(expansionStep.targetDatasetId, targetDataset)
  const expandedKeyId = buildProjectedId(expansionStep.alias, targetKeyId)

  return baseKey
    ? [...baseKey, expandedKeyId]
    : [expandedKeyId]
}

/** Create the concrete dataset-like object returned by `model.materialize(...)`. */
function createDefinedMaterializedView<
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
  TModel extends DefinedDataModel<any, any, any, any>,
  TId extends string,
  TBaseDatasetId extends string,
  TGrain extends string,
>(
  definition: {
    id: TId
    model: TModel
    baseDatasetId: TBaseDatasetId
    grain: TGrain
    steps: readonly MaterializationStep[]
    columns: TColumns
    key: TKey
  },
): DefinedMaterializedView<TRow, TColumns, TKey, TModel, TId, TBaseDatasetId, TGrain> {
  let cachedView:
    | DefinedMaterializedView<TRow, TColumns, TKey, TModel, TId, TBaseDatasetId, TGrain>
    | undefined
  /** Cache materialized rows per input object identity so explicit reuse stays cheap. */
  const materializedRowsCache = new WeakMap<object, readonly TRow[]>()

  const build = () => {
    if (cachedView) {
      return cachedView
    }

    const metadata: MaterializedViewMetadata<TId, TBaseDatasetId, TGrain> = {
      id: definition.id,
      baseDataset: definition.baseDatasetId,
      grain: definition.grain,
      steps: definition.steps.map(toStepMetadata),
    }

    const definedView: DefinedMaterializedView<
      TRow,
      TColumns,
      TKey,
      TModel,
      TId,
      TBaseDatasetId,
      TGrain
    > = {
      ...(definition.key !== undefined ? {key: definition.key} : {}),
      ...(definition.columns !== undefined ? {columns: definition.columns} : {}),
      materialize(data) {
        const cacheKey = data as object
        const cachedRows = materializedRowsCache.get(cacheKey)
        if (cachedRows) {
          return cachedRows
        }

        validateMaterializationDatasets(definition, data as ModelDataInput<any>)

        const baseDataset = definition.model.datasets[definition.baseDatasetId]!
        const baseRows = data[definition.baseDatasetId] as readonly Record<string, unknown>[]
        const datasetIndexCache = new Map<string, DatasetKeyIndex>()
        const relationshipChildrenCache = new Map<string, ReadonlyMap<string, readonly Record<string, unknown>[]>>()
        const associationLookupCache = new Map<string, AssociationLookup>()
        const expansionStep = definition.steps.find((step) => step.kind !== 'join')

        /** Lazily build per-dataset lookup indexes only when a step needs them. */
        const getDatasetIndex = (datasetId: string): DatasetKeyIndex => {
          const existing = datasetIndexCache.get(datasetId)
          if (existing) {
            return existing
          }

          const dataset = definition.model.datasets[datasetId]!
          const relationship = definition.steps.find((step) =>
            step.kind === 'join'
            && step.targetDatasetId === datasetId,
          ) as LookupStep | undefined
          const index = buildDatasetKeyIndex(
            datasetId,
            relationship
              ? (definition.model.relationships[relationship.relationshipId] as ModelRelationshipDefinition).from.key
              : getSingleDatasetKeyId(datasetId, dataset),
            data[datasetId] as readonly Record<string, unknown>[],
          )
          datasetIndexCache.set(datasetId, index)
          return index
        }

        /** Lazily build one-to-many child groupings only when needed. */
        const getRelationshipChildren = (
          relationshipId: string,
        ): ReadonlyMap<string, readonly Record<string, unknown>[]> => {
          const existing = relationshipChildrenCache.get(relationshipId)
          if (existing) {
            return existing
          }

          const relationship = definition.model.relationships[relationshipId] as ModelRelationshipDefinition
          const children = buildRelationshipChildrenByKey(relationship, data as ModelDataInput<any>)
          relationshipChildrenCache.set(relationshipId, children)
          return children
        }

        /** Lazily build association indexes so many-to-many traversals stay explicit and reusable. */
        const getAssociationLookup = (associationId: string): AssociationLookup => {
          const existing = associationLookupCache.get(associationId)
          if (existing) {
            return existing
          }

          const lookup = buildAssociationLookup(definition.model, associationId, data as ModelDataInput<any>)
          associationLookupCache.set(associationId, lookup)
          return lookup
        }

        const materializedRows: TRow[] = []

        /** Start from the base row, then project lookups, then optionally expand grain once. */
        baseRows.forEach((baseRow, baseRowIndex) => {
          const baseOutputRow = buildBaseOutputRow(
            definition.model,
            definition.baseDatasetId,
            definition.steps,
            baseRow,
          )

          definition.steps.forEach((step) => {
            if (step.kind !== 'join') {
              return
            }

            const relationship = definition.model.relationships[step.relationshipId] as ModelRelationshipDefinition
            const targetDataset = definition.model.datasets[step.targetDatasetId]!
            const foreignKeyValue = baseRow[relationship.to.column]

            if (foreignKeyValue == null) {
              applyProjectedColumns(baseOutputRow, step.alias, targetDataset, null, step.projectedColumns, true)
              return
            }

            const targetIndex = getDatasetIndex(step.targetDatasetId)
            const targetRow = targetIndex.rowsByKey.get(
              serializeKeyValue(foreignKeyValue as PrimitiveKeyValue),
            ) ?? null

            if (!targetRow) {
              throw new Error(
                `Relationship "${relationship.id}" has an orphan foreign key "${formatValue(foreignKeyValue)}" in dataset "${relationship.to.dataset}" column "${relationship.to.column}" at row ${baseRowIndex}.`,
              )
            }

            applyProjectedColumns(baseOutputRow, step.alias, targetDataset, targetRow, step.projectedColumns, true)
          })

          if (!expansionStep) {
            materializedRows.push(baseOutputRow as TRow)
            return
          }

          if (expansionStep.kind === 'through-relationship') {
            const baseKeyId = getSingleDatasetKeyId(definition.baseDatasetId, baseDataset)
            const baseKeyValue = baseRow[baseKeyId]

            if (baseKeyValue == null) {
              return
            }

            const childRows = getRelationshipChildren(expansionStep.relationshipId).get(
              serializeKeyValue(baseKeyValue as PrimitiveKeyValue),
            ) ?? []
            const targetDataset = definition.model.datasets[expansionStep.targetDatasetId]!

            childRows.forEach((childRow) => {
              const nextRow: Record<string, unknown> = {
                ...baseOutputRow,
              }
              applyProjectedColumns(nextRow, expansionStep.alias, targetDataset, childRow, expansionStep.projectedColumns, false)
              materializedRows.push(nextRow as TRow)
            })

            return
          }

          const association = definition.model.associations[expansionStep.associationId] as ModelAssociationDefinition
          const lookup = getAssociationLookup(expansionStep.associationId)
          const targetDataset = definition.model.datasets[expansionStep.targetDatasetId]!
          const baseIsFrom = definition.baseDatasetId === association.from.dataset
          const baseKeyId = baseIsFrom ? lookup.fromKeyId : lookup.toKeyId
          const relationLookup = baseIsFrom ? lookup.fromToValues : lookup.toFromValues
          const baseKeyValue = baseRow[baseKeyId]

          if (baseKeyValue == null) {
            return
          }

          const targetIndex = getDatasetIndex(expansionStep.targetDatasetId)
          const targetFingerprints = relationLookup.get(
            serializeKeyValue(baseKeyValue as PrimitiveKeyValue),
          ) ?? new Set<string>()

          targetFingerprints.forEach((targetFingerprint) => {
            const targetRow = targetIndex.rowsByKey.get(targetFingerprint)
            if (!targetRow) {
              if (association.edge.kind === 'explicit') {
                const orphanColumn = baseIsFrom
                  ? association.edge.columns.to
                  : association.edge.columns.from

                throw new Error(
                  `Association "${association.id}" has an orphan "${orphanColumn}" value "${formatSerializedKeyValue(targetFingerprint)}" for dataset "${expansionStep.targetDatasetId}".`,
                )
              }

              throw new Error(
                `Association "${association.id}" has an orphan derived key "${formatSerializedKeyValue(targetFingerprint)}" targeting dataset "${expansionStep.targetDatasetId}".`,
              )
            }

            const nextRow: Record<string, unknown> = {
              ...baseOutputRow,
            }
            applyProjectedColumns(nextRow, expansionStep.alias, targetDataset, targetRow, expansionStep.projectedColumns, false)
            materializedRows.push(nextRow as TRow)
          })
        })

        validateMaterializedRows(definition.key, materializedRows as readonly Record<string, unknown>[], definition.id)
        materializedRowsCache.set(cacheKey, materializedRows)
        return materializedRows
      },
      chart(id) {
        return createDatasetChartBuilder<
          TRow,
          TColumns,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          any
        >({
          ...(definition.columns !== undefined ? {columns: definition.columns} : {}),
        }, {
          dataset: definedView,
          chartId: id,
        })
      },
      validateData(rows) {
        validateMaterializedRows(definition.key, rows as readonly Record<string, unknown>[], definition.id)
      },
      build() {
        return definedView
      },
      materialization: metadata,
      __datasetBrand: 'dataset-definition',
      __materializedViewBrand: 'materialized-view-definition',
    }

    cachedView = definedView
    return definedView
  }

  return build()
}

/** Create the fluent step builder used after `.from(datasetId)`. */
function createMaterializationBuilder<
  TDatasets extends Record<string, DefinedDataset<any, any, any>>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
  TViewId extends string,
  TBaseDatasetId extends Extract<keyof TDatasets, string>,
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends readonly string[] | undefined,
  TAliases extends string,
  THasExpansion extends boolean,
>(
  state: MaterializationState,
): ModelMaterializationBuilder<
  TDatasets,
  TRelationships,
  TAssociations,
  TAttributes,
  TViewId,
  TBaseDatasetId,
  TRow,
  TColumns,
  TKey,
  TAliases,
  THasExpansion
> {
  const assertUnusedAlias = (alias: string) => {
    if (state.steps.some((step) => step.alias === alias)) {
      throw new Error(`Duplicate materialized view alias: "${alias}"`)
    }
  }

  return {
    join(alias: any, config: any) {
      assertUnusedAlias(alias)

      const relationship = state.model.relationships[config.relationship]
      if (!relationship) {
        throw new Error(`Unknown relationship id: "${config.relationship}"`)
      }

      if (relationship.to.dataset !== state.baseDatasetId) {
        throw new Error(
          `Materialized lookup "${config.relationship}" must start from the foreign-key dataset "${relationship.to.dataset}", not "${state.baseDatasetId}".`,
        )
      }

      const targetDatasetId = relationship.from.dataset
      const targetDataset = state.model.datasets[targetDatasetId]!
      const projectedColumns = resolveProjectedColumns(
        targetDatasetId,
        targetDataset,
        config.columns,
        false,
      )

      return createMaterializationBuilder({
        ...state,
        steps: [
          ...state.steps,
          {
            kind: 'join',
            alias,
            relationshipId: config.relationship,
            targetDatasetId,
            projectedColumns,
          },
        ],
      })
    },
    throughRelationship(alias: any, config: any) {
      assertUnusedAlias(alias)

      if (state.hasExpansion) {
        throw new Error('Materialized views currently support at most one row-expanding traversal.')
      }

      const relationship = state.model.relationships[config.relationship]
      if (!relationship) {
        throw new Error(`Unknown relationship id: "${config.relationship}"`)
      }

      if (relationship.from.dataset !== state.baseDatasetId) {
        throw new Error(
          `Materialized relationship expansion "${config.relationship}" must start from the relationship source dataset "${relationship.from.dataset}", not "${state.baseDatasetId}".`,
        )
      }

      const targetDatasetId = relationship.to.dataset
      const targetDataset = state.model.datasets[targetDatasetId]!
      const projectedColumns = resolveProjectedColumns(
        targetDatasetId,
        targetDataset,
        config.columns,
        true,
      )

      return createMaterializationBuilder({
        ...state,
        hasExpansion: true,
        steps: [
          ...state.steps,
          {
            kind: 'through-relationship',
            alias,
            relationshipId: config.relationship,
            targetDatasetId,
            projectedColumns,
          },
        ],
      })
    },
    throughAssociation(alias: any, config: any) {
      assertUnusedAlias(alias)

      if (state.hasExpansion) {
        throw new Error('Materialized views currently support at most one row-expanding traversal.')
      }

      const association = state.model.associations[config.association]
      if (!association) {
        throw new Error(`Unknown association id: "${config.association}"`)
      }

      if (association.from.dataset !== state.baseDatasetId && association.to.dataset !== state.baseDatasetId) {
        throw new Error(
          `Materialized association expansion "${config.association}" must start from either "${association.from.dataset}" or "${association.to.dataset}", not "${state.baseDatasetId}".`,
        )
      }

      const targetDatasetId = association.from.dataset === state.baseDatasetId
        ? association.to.dataset
        : association.from.dataset
      const targetDataset = state.model.datasets[targetDatasetId]!
      const projectedColumns = resolveProjectedColumns(
        targetDatasetId,
        targetDataset,
        config.columns,
        true,
      )

      return createMaterializationBuilder({
        ...state,
        hasExpansion: true,
        steps: [
          ...state.steps,
          {
            kind: 'through-association',
            alias,
            associationId: config.association,
            targetDatasetId,
            projectedColumns,
          },
        ],
      })
    },
    grain(grain: any) {
      const columns = buildMaterializedColumns(state.model, state.baseDatasetId, state.steps) as TColumns
      const key = buildMaterializedKey(state.model, state.baseDatasetId, state.steps) as TKey

      return createDefinedMaterializedView({
        id: state.id as TViewId,
        model: state.model as DefinedDataModel<any, any, any, any>,
        baseDatasetId: state.baseDatasetId as TBaseDatasetId,
        grain,
        steps: state.steps,
        columns,
        key,
      }) as unknown as MaterializedViewDefinition<any, any, any, any, any, any, any>
    },
  } as ModelMaterializationBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId,
    TBaseDatasetId,
    TRow,
    TColumns,
    TKey,
    TAliases,
    THasExpansion
  >
}

/**
 * Create the starting builder used by `model.materialize(id, (m) => ...)`.
 *
 * The returned object is intentionally tiny so the materialization contract
 * reads clearly from the first step.
 */
export function createMaterializationStartBuilder<
  TDatasets extends Record<string, DefinedDataset<any, any, any>>,
  TRelationships extends Record<string, ModelRelationshipDefinition>,
  TAssociations extends Record<string, ModelAssociationDefinition>,
  TAttributes extends Record<string, ModelAttributeDefinition>,
  TViewId extends string,
>(
  id: TViewId,
  model: DefinedDataModel<TDatasets, TRelationships, TAssociations, any>,
): ModelMaterializationStartBuilder<
  TDatasets,
  TRelationships,
  TAssociations,
  TAttributes,
  TViewId
> {
  return {
    from(dataset) {
      return createMaterializationBuilder({
        id,
        model,
        baseDatasetId: dataset,
        steps: [],
        hasExpansion: false,
      })
    },
  } as ModelMaterializationStartBuilder<
    TDatasets,
    TRelationships,
    TAssociations,
    TAttributes,
    TViewId
  >
}
