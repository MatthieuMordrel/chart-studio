import {createDatasetChartBuilder, COLUMN_HELPER, buildColumnsMap, assertColumnEntries} from './schema-builder.js'
import type {
  DatasetBuilder,
  DatasetBuilderState,
  DatasetDefinition,
  DatasetKey,
  DefinedDataset,
  ResolvedDatasetFromDefinition,
} from './dataset-builder.types.js'
import type {
  ColumnHelper,
  ColumnsFromEntries,
} from './schema-builder.types.js'
import type {InferableFieldKey} from './types.js'

type KeyValuePart = string | number | boolean | bigint | symbol | Date | null | undefined

function normalizeDatasetKey<TRow>(
  key: InferableFieldKey<TRow> | DatasetKey<TRow>,
): DatasetKey<TRow> {
  return (Array.isArray(key) ? key : [key]) as DatasetKey<TRow>
}

function formatKeyValue(value: readonly KeyValuePart[]): string {
  return value.length === 1
    ? String(value[0])
    : `[${value.map(part => String(part)).join(', ')}]`
}

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

function validateDatasetRows<TRow>(
  key: readonly InferableFieldKey<TRow>[] | undefined,
  rows: readonly TRow[],
  datasetLabel: string,
): void {
  if (!key || key.length === 0) {
    return
  }

  const seen = new Map<string, readonly KeyValuePart[]>()

  rows.forEach((row, index) => {
    const parts = key.map(keyId => row[keyId] as KeyValuePart)
    const missingKeyId = parts.findIndex(part => part == null)

    if (missingKeyId >= 0) {
      throw new Error(
        `Dataset "${datasetLabel}" key "${key.join(', ')}" is missing a value at row ${index} for "${key[missingKeyId]}".`,
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

export function resolveDatasetDefinition<
  TDataset extends DatasetDefinition<any, any, any>,
>(
  dataset: TDataset,
): ResolvedDatasetFromDefinition<TDataset> {
  return dataset.build() as ResolvedDatasetFromDefinition<TDataset>
}

export function validateDatasetData<
  TDataset extends DatasetDefinition<any, any, any>,
>(
  dataset: TDataset,
  rows: Parameters<ResolvedDatasetFromDefinition<TDataset>['validateData']>[0],
  datasetLabel = 'dataset',
): void {
  const resolvedDataset = resolveDatasetDefinition(dataset)
  validateDatasetRows(
    resolvedDataset.key as readonly InferableFieldKey<any>[] | undefined,
    rows as readonly any[],
    datasetLabel,
  )
}

function createDefinedDataset<
  TRow,
  TColumns extends Record<string, unknown> | undefined,
  TKey extends DatasetKey<TRow> | undefined,
>(
  state: DatasetBuilderState<TColumns, TKey>,
): DefinedDataset<TRow, TColumns, TKey> {
  let cachedDataset: DefinedDataset<TRow, TColumns, TKey> | undefined

  const build = (): DefinedDataset<TRow, TColumns, TKey> => {
    if (cachedDataset) {
      return cachedDataset
    }

    const definedDataset: DefinedDataset<TRow, TColumns, TKey> = {
      ...(state.key !== undefined ? {key: state.key} : {}),
      ...(state.columns !== undefined ? {columns: state.columns} : {}),
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
          any,
          DefinedDataset<TRow, TColumns, TKey>
        >({
          ...(state.columns !== undefined ? {columns: state.columns} : {}),
        }, {
          dataset: definedDataset,
          chartId: id,
        })
      },
      validateData(data) {
        validateDatasetRows(state.key, data, 'dataset')
      },
      build() {
        return definedDataset
      },
      __datasetBrand: 'dataset-definition',
    }

    cachedDataset = definedDataset
    return definedDataset
  }

  return build()
}

function createDatasetBuilder<
  TRow,
  TColumns extends Record<string, unknown> | undefined = undefined,
  TKey extends DatasetKey<TRow> | undefined = undefined,
>(
  state: DatasetBuilderState<TColumns, TKey> = {},
): DatasetBuilder<TRow, TColumns, TKey> {
  let cachedDataset: DefinedDataset<TRow, TColumns, TKey> | undefined
  const getOrBuildDataset = () => {
    if (cachedDataset) {
      return cachedDataset
    }

    cachedDataset = createDefinedDataset(state)
    return cachedDataset
  }

  return {
    key(keyOrKeys: InferableFieldKey<TRow> | DatasetKey<TRow>) {
      return createDatasetBuilder<TRow, TColumns, any>({
        ...state,
        key: normalizeDatasetKey(keyOrKeys) as any,
      })
    },
    columns(defineColumns) {
      const entries = defineColumns(COLUMN_HELPER as ColumnHelper<TRow>)
      assertColumnEntries(entries, 'defineDataset')

      return createDatasetBuilder<
        TRow,
        ColumnsFromEntries<TRow, typeof entries>,
        TKey
      >({
        ...state,
        columns: buildColumnsMap(entries) as ColumnsFromEntries<TRow, typeof entries>,
      })
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
        any,
        DefinedDataset<TRow, TColumns, TKey>
      >({
        ...(state.columns !== undefined ? {columns: state.columns} : {}),
      }, {
        dataset: getOrBuildDataset(),
        chartId: id,
      })
    },
    validateData(data) {
      validateDatasetRows(state.key, data, 'dataset')
    },
    build() {
      return getOrBuildDataset()
    },
  } as DatasetBuilder<TRow, TColumns, TKey>
}

/**
 * Define one reusable dataset contract for columns, derived fields, and row identity.
 *
 * Dataset-owned `.columns(...)` is the canonical reusable meaning.
 * Use `.chart(...)` to derive chart definitions from that shared contract.
 */
export function defineDataset<TRow>() {
  return createDatasetBuilder<TRow>()
}
