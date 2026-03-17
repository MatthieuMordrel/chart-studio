import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {filterByDateRange} from './date-utils.js'
import {resolvePresetFilter} from './date-range-presets.js'
import {resolveDashboardDefinition} from './define-dashboard.js'
import {formatChartValue} from './formatting.js'
import {inferColumnsFromData} from './infer-columns.js'
import {extractAvailableFilters} from './pipeline.js'
import {getStringValue} from './pipeline-helpers.js'
import {useChart} from './use-chart.js'
import type {
  DashboardChartIdFromDefinition,
  DashboardChartInstanceFromDefinition,
  DashboardChartDataSource,
  DashboardDataInputFromDefinition,
  DashboardDatasetIdFromDefinition,
  DashboardDatasetRowsFromDefinition,
  DashboardDateRangeSelection,
  DashboardDefinition,
  DashboardResolvedChart,
  DashboardResolvedChartOwnership,
  DashboardRuntime,
  DashboardSharedDateRangeFilterRuntime,
  DashboardSharedFilterIdFromDefinition,
  DashboardSharedFilterRuntime,
  DashboardSharedFilterRuntimeFromDefinition,
  DashboardSharedSelectFilterRuntime,
  ResolvedDashboardFromDefinition,
} from './dashboard.types.js'
import type {
  ChartColumn,
  ChartInstance,
  DateColumn,
  DateRangeFilter,
} from './types.js'

type RuntimeDataset = {
  rows: readonly any[]
  columns: readonly ChartColumn<any, string>[]
  columnsById: ReadonlyMap<string, ChartColumn<any, string>>
}

type AssociationLookup = {
  fromKeyId: string
  toKeyId: string
  fromToValues: ReadonlyMap<string, ReadonlySet<string>>
  toFromValues: ReadonlyMap<string, ReadonlySet<string>>
}

type BroadDashboardRuntime = DashboardRuntime<DashboardDefinition<any, any, any>>

const DEFAULT_SHARED_DATE_RANGE_SELECTION: DashboardDateRangeSelection = {
  preset: 'all-time',
  customFilter: null,
}

const DashboardContext = createContext<BroadDashboardRuntime | null>(null)

function serializeKeyValue(value: unknown): string {
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  return `${typeof value}:${String(value)}`
}

function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`
}

function getSingleDatasetKeyId(datasetId: string, dataset: {key?: readonly string[]}): string {
  if (!dataset.key || dataset.key.length !== 1) {
    throw new Error(`Dataset "${datasetId}" must declare exactly one key for dashboard relationship traversal.`)
  }

  const keyId = dataset.key[0]
  if (!keyId) {
    throw new Error(`Dataset "${datasetId}" must declare exactly one key for dashboard relationship traversal.`)
  }

  return keyId
}

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

function toReadonlyLookup(
  lookup: Map<string, Set<string>>,
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(
    [...lookup].map(([key, values]) => [key, new Set(values)]),
  )
}

function buildAssociationLookups(
  definition: ResolvedDashboardFromDefinition<any>,
  data: Record<string, readonly any[]>,
): Record<string, AssociationLookup> {
  const lookups: Record<string, AssociationLookup> = {}

  for (const [associationId, association] of Object.entries(
    definition.model.associations,
  ) as Array<[string, any]>) {
    const fromKeyId = getSingleDatasetKeyId(
      association.from.dataset,
      definition.model.datasets[association.from.dataset]!,
    )
    const toKeyId = getSingleDatasetKeyId(
      association.to.dataset,
      definition.model.datasets[association.to.dataset]!,
    )
    const fromToValues = new Map<string, Set<string>>()
    const toFromValues = new Map<string, Set<string>>()

    if (association.edge.kind === 'explicit') {
      association.edge.data.forEach((edgeRow: Record<string, unknown>) => {
        const fromValue = edgeRow[association.edge.columns.from]
        const toValue = edgeRow[association.edge.columns.to]

        if (fromValue == null || toValue == null) {
          return
        }

        const serializedFrom = serializeKeyValue(fromValue)
        const serializedTo = serializeKeyValue(toValue)
        addLookupEdge(fromToValues, serializedFrom, serializedTo)
        addLookupEdge(toFromValues, serializedTo, serializedFrom)
      })
    } else {
      const deriveDatasetId = association.edge.deriveFrom.dataset
      const deriveRows = data[deriveDatasetId] ?? []
      const deriveDataset = definition.model.datasets[deriveDatasetId]!
      const deriveKeyId = getSingleDatasetKeyId(deriveDatasetId, deriveDataset)

      deriveRows.forEach((row) => {
        const sourceKey = row[deriveKeyId]
        if (sourceKey == null) {
          return
        }

        const values = association.edge.deriveFrom.values(row) ?? []
        values.forEach((value: unknown) => {
          if (value == null) {
            return
          }

          const serializedSource = serializeKeyValue(sourceKey)
          const serializedValue = serializeKeyValue(value)

          if (deriveDatasetId === association.from.dataset) {
            addLookupEdge(fromToValues, serializedSource, serializedValue)
            addLookupEdge(toFromValues, serializedValue, serializedSource)
            return
          }

          addLookupEdge(fromToValues, serializedValue, serializedSource)
          addLookupEdge(toFromValues, serializedSource, serializedValue)
        })
      })
    }

    lookups[associationId] = {
      fromKeyId,
      toKeyId,
      fromToValues: toReadonlyLookup(fromToValues),
      toFromValues: toReadonlyLookup(toFromValues),
    }
  }

  return lookups
}

function buildRuntimeDatasets(
  definition: ResolvedDashboardFromDefinition<any>,
  data: Record<string, readonly any[]>,
): Record<string, RuntimeDataset> {
  const datasets: Record<string, RuntimeDataset> = {}

  for (const [datasetId, dataset] of Object.entries(
    definition.model.datasets,
  ) as Array<[string, any]>) {
    const rows = data[datasetId] ?? []
    const columns = inferColumnsFromData(
      rows,
      dataset.columns ? {columns: dataset.columns} : undefined,
    )

    datasets[datasetId] = {
      rows,
      columns,
      columnsById: new Map(columns.map((column) => [column.id, column])),
    }
  }

  return datasets
}

function resolveDashboardDateRangeFilter(
  selection: DashboardDateRangeSelection,
): DateRangeFilter | null {
  if (selection.preset === null) {
    return selection.customFilter
  }

  return resolvePresetFilter(selection.preset, 'month')
}

function matchesDateRange(
  row: unknown,
  column: DateColumn<any, string>,
  filter: DateRangeFilter,
): boolean {
  return filterByDateRange([row], column, filter).length > 0
}

function mergeSelectedOptions(
  options: Array<{value: string; label: string; count: number}>,
  selectedValues: ReadonlySet<string>,
): Array<{value: string; label: string; count: number}> {
  if (selectedValues.size === 0) {
    return options
  }

  const next = [...options]
  const knownValues = new Set(next.map((option) => option.value))

  selectedValues.forEach((value) => {
    if (knownValues.has(value)) {
      return
    }

    next.push({
      value,
      label: value,
      count: 0,
    })
  })

  return next
}

function applyDashboardOwnership(
  chart: ChartInstance<any, string>,
  ownership: DashboardResolvedChartOwnership,
): ChartInstance<any, string> {
  const visibleFilters = chart.availableFilters.filter(
    (filter) => !ownership.filterColumnIds.has(filter.columnId),
  )
  const visibleDateColumns = chart.availableDateColumns.filter(
    (column) => !ownership.dateColumnIds.has(column.id),
  )
  const nextFilters = new Map(
    [...chart.filters].filter(([columnId]) => !ownership.filterColumnIds.has(columnId)),
  )

  return {
    ...chart,
    filters: nextFilters,
    availableFilters: visibleFilters,
    toggleFilter(columnId, value) {
      if (ownership.filterColumnIds.has(columnId)) {
        throw new Error(
          `Chart-local filter "${columnId}" is owned by a dashboard shared filter for this chart.`,
        )
      }

      chart.toggleFilter(columnId, value)
    },
    clearFilter(columnId) {
      if (ownership.filterColumnIds.has(columnId)) {
        throw new Error(
          `Chart-local filter "${columnId}" is owned by a dashboard shared filter for this chart.`,
        )
      }

      chart.clearFilter(columnId)
    },
    availableDateColumns: visibleDateColumns,
    setReferenceDateId(columnId) {
      if (ownership.dateColumnIds.has(columnId)) {
        throw new Error(
          `Chart-local date column "${columnId}" is owned by a dashboard shared date range for this chart.`,
        )
      }

      chart.setReferenceDateId(columnId)
    },
  }
}

function getProjectedOwnedColumns(
  source: DashboardChartDataSource<string>,
  datasetId: string,
  columnId: string,
): string[] {
  if (source.kind !== 'materialized-view') {
    return []
  }

  return source.view.materialization.steps.flatMap((step) =>
    step.targetDataset === datasetId && step.projectedColumns.includes(columnId)
      ? [buildProjectedId(step.alias, columnId)]
      : [],
  )
}

/**
 * React hook that creates a live {@link DashboardRuntime} from a dashboard definition and data.
 *
 * The runtime manages all dashboard state including shared filter selections and
 * date range selections. It provides type-safe accessors for charts, datasets, and
 * shared filters.
 *
 * Wrap the returned runtime in a {@link DashboardProvider} to enable context-based
 * hooks like `useDashboardChart(chartId)` without passing the runtime explicitly.
 *
 * @param options - The dashboard hook options.
 * @param options.definition - A dashboard definition produced by `defineDashboard(...).build()`
 *   or {@link createDashboard}. The definition is resolved and memoized internally.
 * @param options.data - The data input for all datasets declared in the dashboard's model.
 *   Keys must match the dataset ids, and values are arrays of typed row objects.
 *   When data changes, the runtime recomputes filtered datasets and shared filter options.
 *
 * @returns A {@link DashboardRuntime} object with the following members:
 *   - `definition` — the resolved dashboard definition.
 *   - `chartIds` — array of all registered chart ids.
 *   - `sharedFilterIds` — array of all registered shared filter ids.
 *   - `chart(id)` — returns a resolved chart (data, schema, ownership) for a given chart id.
 *   - `dataset(id)` — returns the filtered rows for a given dataset id.
 *   - `sharedFilter(id)` — returns the runtime state and controls for a shared filter.
 *
 * @example
 * ```tsx
 * const dashboard = useDashboard({
 *   definition: myDashboardDefinition,
 *   data: { orders: ordersData, customers: customersData },
 * })
 *
 * return (
 *   <DashboardProvider dashboard={dashboard}>
 *     <MyChart />
 *   </DashboardProvider>
 * )
 * ```
 */
export function useDashboard<
  TDashboard extends DashboardDefinition<any, any, any>,
>(
  options: {
    definition: TDashboard
    data: DashboardDataInputFromDefinition<TDashboard>
  },
): DashboardRuntime<TDashboard> {
  const definition = useMemo(
    () => resolveDashboardDefinition(options.definition),
    [options.definition],
  )

  const [selectValuesById, setSelectValuesById] = useState<Map<string, Set<string>>>(
    () => new Map(),
  )
  const [dateRangeSelectionById, setDateRangeSelectionById] = useState<
    Map<string, DashboardDateRangeSelection>
  >(() => new Map())

  const dataByDataset = options.data as Record<string, readonly any[]>

  const runtimeDatasets = useMemo(() => {
    definition.model.validateData(options.data as any)
    return buildRuntimeDatasets(definition, dataByDataset)
  }, [dataByDataset, definition, options.data])

  const associationLookups = useMemo(
    () => buildAssociationLookups(definition, dataByDataset),
    [dataByDataset, definition],
  )

  return useMemo(() => {
    const sharedFilterEntries = Object.entries(
      definition.sharedFilters,
    ) as Array<[string, any]>
    const datasetCache = new Map<string, readonly any[]>()

    const getSelectValues = (filterId: string): ReadonlySet<string> =>
      selectValuesById.get(filterId) ?? new Set<string>()

    const getDateRangeSelection = (filterId: string): DashboardDateRangeSelection =>
      dateRangeSelectionById.get(filterId) ?? DEFAULT_SHARED_DATE_RANGE_SELECTION

    const rowMatchesSharedFilter = (
      datasetId: string,
      row: unknown,
      filterId: string,
      filterDefinition: any,
    ): boolean => {
      if (filterDefinition.kind === 'date-range') {
        const dateRangeFilter = resolveDashboardDateRangeFilter(
          getDateRangeSelection(filterId),
        )
        if (!dateRangeFilter) {
          return true
        }

        const targets = filterDefinition.targets.filter(
          (target: {dataset: string}) => target.dataset === datasetId,
        )

        if (targets.length === 0) {
          return true
        }

        const runtimeDataset = runtimeDatasets[datasetId]
        return targets.some((target: {column: string}) => {
          const column = runtimeDataset?.columnsById.get(target.column)
          return column?.type === 'date'
            ? matchesDateRange(row, column, dateRangeFilter)
            : false
        })
      }

      const selectedValues = getSelectValues(filterId)
      if (selectedValues.size === 0) {
        return true
      }

      if (filterDefinition.source.kind === 'attribute' && filterDefinition.source.dataset === datasetId) {
        return selectedValues.has(serializeKeyValue((row as Record<string, unknown>)[filterDefinition.source.key]))
      }

      const directTargets = filterDefinition.targets.filter(
        (target: {dataset: string}) => target.dataset === datasetId,
      )

      if (directTargets.length === 0) {
        return true
      }

      const runtimeDataset = runtimeDatasets[datasetId]

      return directTargets.some((target: any) => {
        if ('through' in target) {
          const lookup = associationLookups[target.through]
          if (!lookup) {
            return false
          }

          const keyField = definition.model.associations[target.through]!.from.dataset === datasetId
            ? lookup.fromKeyId
            : lookup.toKeyId
          const ownKey = (row as Record<string, unknown>)[keyField]
          if (ownKey == null) {
            return false
          }

          const ownKeyValue = serializeKeyValue(ownKey)
          const relatedValues = definition.model.associations[target.through]!.from.dataset === datasetId
            ? lookup.fromToValues.get(ownKeyValue)
            : lookup.toFromValues.get(ownKeyValue)

          return relatedValues
            ? [...relatedValues].some((value) => selectedValues.has(value))
            : false
        }

        if ('column' in target) {
          if (filterDefinition.source.kind === 'attribute') {
            return selectedValues.has(
              serializeKeyValue((row as Record<string, unknown>)[target.column]),
            )
          }

          const column = runtimeDataset?.columnsById.get(target.column)
          return column ? selectedValues.has(getStringValue(row, column)) : false
        }

        return false
      })
    }

    const getFilteredDatasetRows = (
      datasetId: string,
      excludedFilterId?: string,
    ): readonly any[] => {
      const cacheKey = `${datasetId}::${excludedFilterId ?? ''}`
      const cached = datasetCache.get(cacheKey)
      if (cached) {
        return cached
      }

      const rows = runtimeDatasets[datasetId]?.rows ?? []
      const nextRows = rows.filter((row) =>
        sharedFilterEntries.every(([filterId, filterDefinition]) =>
          filterId === excludedFilterId
            ? true
            : rowMatchesSharedFilter(datasetId, row, filterId, filterDefinition),
        ),
      )

      datasetCache.set(cacheKey, nextRows)
      return nextRows
    }

    const filteredDatasets = Object.fromEntries(
      Object.keys(definition.model.datasets).map((datasetId) => [
        datasetId,
        getFilteredDatasetRows(datasetId),
      ]),
    ) as Record<string, readonly any[]>

    const chartOwnershipById = Object.fromEntries(
      (Object.entries(definition.charts) as Array<[string, any]>).map(([chartId, registration]) => {
        const filterColumnIds = new Set<string>()
        const dateColumnIds = new Set<string>()
        const sharedFilterIds: string[] = []

        sharedFilterEntries.forEach(([filterId, filterDefinition]) => {
          if (filterDefinition.kind === 'date-range') {
            const ownedColumns = filterDefinition.targets
              .filter((target: {dataset: string}) => target.dataset === registration.datasetId)
              .map((target: {column: string}) => target.column)
            const projectedOwnedColumns = filterDefinition.targets.flatMap(
              (target: {dataset: string; column: string}) =>
                getProjectedOwnedColumns(registration.dataSource, target.dataset, target.column),
            )
            const allOwnedColumns = [...ownedColumns, ...projectedOwnedColumns]

            if (allOwnedColumns.length > 0) {
              sharedFilterIds.push(filterId)
              allOwnedColumns.forEach((columnId: string) => {
                dateColumnIds.add(columnId)
              })
            }

            return
          }

          if (filterDefinition.source.kind === 'attribute' && filterDefinition.source.dataset === registration.datasetId) {
            filterColumnIds.add(filterDefinition.source.key)
            sharedFilterIds.push(filterId)
          }

          if (filterDefinition.source.kind === 'attribute') {
            getProjectedOwnedColumns(
              registration.dataSource,
              filterDefinition.source.dataset,
              filterDefinition.source.key,
            ).forEach((columnId) => {
              filterColumnIds.add(columnId)
            })
            getProjectedOwnedColumns(
              registration.dataSource,
              filterDefinition.source.dataset,
              filterDefinition.source.label,
            ).forEach((columnId) => {
              filterColumnIds.add(columnId)
            })
          } else {
            getProjectedOwnedColumns(
              registration.dataSource,
              filterDefinition.source.dataset,
              filterDefinition.source.column,
            ).forEach((columnId) => {
              filterColumnIds.add(columnId)
            })
          }

          const ownedColumns = filterDefinition.targets
            .filter((target: {dataset: string; column?: string}) =>
              target.dataset === registration.datasetId && 'column' in target,
            )
            .map((target: {column: string}) => target.column)
          const projectedOwnedColumns = filterDefinition.targets.flatMap(
            (target: {dataset: string; column?: string}) =>
              'column' in target && typeof target.column === 'string'
                ? getProjectedOwnedColumns(registration.dataSource, target.dataset, target.column)
                : [],
          )
          const allOwnedColumns = [...ownedColumns, ...projectedOwnedColumns]

          if (allOwnedColumns.length > 0) {
            sharedFilterIds.push(filterId)
            allOwnedColumns.forEach((columnId: string) => {
              filterColumnIds.add(columnId)
            })
          }
        })

        return [
          chartId,
          {
            sharedFilterIds: [...new Set(sharedFilterIds)],
            filterColumnIds,
            dateColumnIds,
          },
        ]
      }),
    ) as Record<string, DashboardResolvedChartOwnership>

    const createSelectFilterRuntime = (
      filterId: string,
      filterDefinition: any,
    ): DashboardSharedSelectFilterRuntime => {
      const selectedValues = getSelectValues(filterId)

      if (filterDefinition.source.kind === 'attribute') {
        const sourceDataset = runtimeDatasets[filterDefinition.source.dataset]
        const sourceRows = getFilteredDatasetRows(filterDefinition.source.dataset, filterId)
        const labelColumn = sourceDataset?.columnsById.get(filterDefinition.source.label)
        const optionsByValue = new Map<string, {label: string; count: number}>()

        sourceRows.forEach((row) => {
          const keyValue = row[filterDefinition.source.key]
          if (keyValue == null) {
            return
          }

          const value = serializeKeyValue(keyValue)
          const label = labelColumn
            ? formatChartValue(labelColumn.accessor(row), {
                column: labelColumn,
                surface: 'tooltip',
                item: row,
              })
            : String(row[filterDefinition.source.label] ?? keyValue)
          const existing = optionsByValue.get(value)

          if (existing) {
            optionsByValue.set(value, {
              label: existing.label,
              count: existing.count + 1,
            })
            return
          }

          optionsByValue.set(value, {label, count: 1})
        })

        return {
          id: filterId,
          kind: 'select',
          label: filterDefinition.label,
          values: new Set(selectedValues),
          options: mergeSelectedOptions(
            [...optionsByValue.entries()]
              .map(([value, option]) => ({
                value,
                label: option.label,
                count: option.count,
              }))
              .toSorted((left, right) => right.count - left.count),
            selectedValues,
          ),
          toggleValue(value) {
            setSelectValuesById((current) => {
              const next = new Map(current)
              const existing = new Set(next.get(filterId) ?? [])
              if (existing.has(value)) {
                existing.delete(value)
              } else {
                existing.add(value)
              }

              if (existing.size === 0) {
                next.delete(filterId)
              } else {
                next.set(filterId, existing)
              }

              return next
            })
          },
          setValues(values) {
            setSelectValuesById((current) => {
              const next = new Map(current)
              const normalized = new Set(values)
              if (normalized.size === 0) {
                next.delete(filterId)
              } else {
                next.set(filterId, normalized)
              }

              return next
            })
          },
          clear() {
            setSelectValuesById((current) => {
              const next = new Map(current)
              next.delete(filterId)
              return next
            })
          },
        }
      }

      const sourceDataset = runtimeDatasets[filterDefinition.source.dataset]
      const sourceRows = getFilteredDatasetRows(filterDefinition.source.dataset, filterId)
      const sourceOptions = sourceDataset
        ? extractAvailableFilters(sourceRows, sourceDataset.columns).find(
            (option) => option.columnId === filterDefinition.source.column,
          )?.options ?? []
        : []

      return {
        id: filterId,
        kind: 'select',
        label: filterDefinition.label,
        values: new Set(selectedValues),
        options: mergeSelectedOptions(sourceOptions, selectedValues),
        toggleValue(value) {
          setSelectValuesById((current) => {
            const next = new Map(current)
            const existing = new Set(next.get(filterId) ?? [])
            if (existing.has(value)) {
              existing.delete(value)
            } else {
              existing.add(value)
            }

            if (existing.size === 0) {
              next.delete(filterId)
            } else {
              next.set(filterId, existing)
            }

            return next
          })
        },
        setValues(values) {
          setSelectValuesById((current) => {
            const next = new Map(current)
            const normalized = new Set(values)
            if (normalized.size === 0) {
              next.delete(filterId)
            } else {
              next.set(filterId, normalized)
            }

            return next
          })
        },
        clear() {
          setSelectValuesById((current) => {
            const next = new Map(current)
            next.delete(filterId)
            return next
          })
        },
      }
    }

    const createDateRangeFilterRuntime = (
      filterId: string,
      filterDefinition: any,
    ): DashboardSharedDateRangeFilterRuntime => {
      const selection = getDateRangeSelection(filterId)
      const dateRangeFilter = resolveDashboardDateRangeFilter(selection)

      return {
        id: filterId,
        kind: 'date-range',
        label: filterDefinition.label,
        selection,
        dateRangeFilter,
        setSelection(nextSelection) {
          setDateRangeSelectionById((current) => {
            const next = new Map(current)
            next.set(filterId, nextSelection)
            return next
          })
        },
        setDateRangePreset(preset) {
          setDateRangeSelectionById((current) => {
            const next = new Map(current)
            const previous = next.get(filterId) ?? DEFAULT_SHARED_DATE_RANGE_SELECTION
            next.set(filterId, {
              preset,
              customFilter: previous.customFilter,
            })
            return next
          })
        },
        setDateRangeFilter(filter) {
          setDateRangeSelectionById((current) => {
            const next = new Map(current)
            next.set(filterId, {
              preset: filter === null ? 'all-time' : null,
              customFilter: filter,
            })
            return next
          })
        },
        clear() {
          setDateRangeSelectionById((current) => {
            const next = new Map(current)
            next.delete(filterId)
            return next
          })
        },
      }
    }

    const runtime: BroadDashboardRuntime = {
      definition,
      chartIds: Object.keys(definition.charts) as string[],
      sharedFilterIds: Object.keys(definition.sharedFilters) as string[],
      chart(chartId) {
        const registration = definition.charts[chartId]
        if (!registration) {
          throw new Error(`Unknown dashboard chart id: "${chartId}"`)
        }

        const chartData = registration.dataSource.kind === 'materialized-view'
          ? registration.dataSource.view.materialize(filteredDatasets as any)
          : (filteredDatasets[registration.datasetId] ?? [])

        return {
          id: chartId,
          datasetId: registration.datasetId,
          source: registration.dataSource,
          data: chartData,
          schema: registration.schema,
          ownership: chartOwnershipById[chartId] ?? {
            sharedFilterIds: [],
            filterColumnIds: new Set<string>(),
            dateColumnIds: new Set<string>(),
          },
        } as DashboardResolvedChart<any, any>
      },
      dataset(datasetId) {
        if (!(datasetId in definition.model.datasets)) {
          throw new Error(`Unknown dashboard dataset id: "${datasetId}"`)
        }

        return (filteredDatasets[datasetId] ?? []) as readonly any[]
      },
      sharedFilter(filterId) {
        const filterDefinition = definition.sharedFilters[filterId]
        if (!filterDefinition) {
          throw new Error(`Unknown dashboard shared filter id: "${filterId}"`)
        }

        return (
          filterDefinition.kind === 'date-range'
            ? createDateRangeFilterRuntime(filterId, filterDefinition)
            : createSelectFilterRuntime(filterId, filterDefinition)
        ) as DashboardSharedFilterRuntime
      },
    }

    return runtime as DashboardRuntime<TDashboard>
  }, [
    associationLookups,
    dataByDataset,
    dateRangeSelectionById,
    definition,
    runtimeDatasets,
    selectValuesById,
  ])
}

/**
 * Provides a {@link DashboardRuntime} to descendant components via React context.
 *
 * When a `DashboardProvider` is present, context-based hook overloads like
 * `useDashboardChart(chartId)`, `useDashboardDataset(datasetId)`, and
 * `useDashboardSharedFilter(filterId)` can be called with just an id string
 * instead of passing the dashboard runtime explicitly.
 *
 * @param props.dashboard - The dashboard runtime obtained from {@link useDashboard}.
 * @param props.children - The React subtree that can access the dashboard context.
 *
 * @example
 * ```tsx
 * <DashboardProvider dashboard={dashboard}>
 *   <OrdersChart />
 *   <SharedFilterPanel />
 * </DashboardProvider>
 * ```
 */
export function DashboardProvider({
  dashboard,
  children,
}: {
  dashboard: BroadDashboardRuntime
  children: ReactNode
}) {
  return (
    <DashboardContext.Provider value={dashboard}>
      {children}
    </DashboardContext.Provider>
  )
}

/**
 * Returns the nearest {@link DashboardRuntime} from a parent {@link DashboardProvider}.
 *
 * @throws If called outside of a `DashboardProvider`.
 *
 * @returns The dashboard runtime from context.
 */
export function useDashboardContext(): BroadDashboardRuntime {
  const dashboard = useContext(DashboardContext)
  if (!dashboard) {
    throw new Error('useDashboardContext must be used within a <DashboardProvider>.')
  }

  return dashboard
}

/**
 * React hook that retrieves and instantiates a chart from a dashboard.
 *
 * This hook resolves the chart's filtered data from the dashboard runtime,
 * creates a live `ChartInstance` via `useChart`, and applies dashboard ownership
 * restrictions — hiding filter and date columns that are controlled by shared filters
 * and preventing local manipulation of those owned columns.
 *
 * Supports two calling conventions:
 *
 * **Explicit dashboard** — pass both the runtime and chart id for full type safety:
 * ```ts
 * const chart = useDashboardChart(dashboard, 'ordersByMonth')
 * ```
 *
 * **Context-based** — pass only the chart id when inside a {@link DashboardProvider}:
 * ```ts
 * const chart = useDashboardChart('ordersByMonth')
 * ```
 *
 * @param dashboard - The dashboard runtime (omit when using context).
 * @param chartId - The id of the chart to retrieve, as registered in the dashboard definition.
 *
 * @returns A `ChartInstance` with dashboard ownership applied. Owned filter and date
 *   columns are removed from `availableFilters` and `availableDateColumns`, and
 *   attempts to toggle or clear them will throw.
 *
 * @throws If called without a dashboard runtime and outside of a `DashboardProvider`.
 * @throws If the chart id does not exist in the dashboard definition.
 */
export function useDashboardChart<
  TDashboard extends DashboardDefinition<any, any, any>,
  TChartId extends DashboardChartIdFromDefinition<TDashboard>,
>(
  dashboard: DashboardRuntime<TDashboard>,
  chartId: TChartId,
): DashboardChartInstanceFromDefinition<TDashboard, TChartId>
/**
 * Context-based overload — retrieves a chart by id from the nearest {@link DashboardProvider}.
 *
 * @param chartId - The chart id to retrieve.
 * @returns A `ChartInstance` with dashboard ownership applied.
 */
export function useDashboardChart(
  chartId: string,
): ChartInstance<any, string>
export function useDashboardChart(
  dashboardOrChartId: unknown,
  chartId?: string,
): unknown {
  const contextDashboard = useContext(DashboardContext)
  const dashboard = typeof dashboardOrChartId === 'string'
    ? contextDashboard
    : (dashboardOrChartId as BroadDashboardRuntime | null)
  if (!dashboard) {
    throw new Error('useDashboardChart must receive a dashboard runtime or run within a <DashboardProvider>.')
  }
  const resolvedChart = dashboard.chart(
    (typeof dashboardOrChartId === 'string' ? dashboardOrChartId : chartId)!,
  )
  const chart = useChart({
    data: resolvedChart.data,
    schema: resolvedChart.schema,
  }) as unknown as ChartInstance<any, string>

  return useMemo(
    () => applyDashboardOwnership(chart, resolvedChart.ownership),
    [chart, resolvedChart],
  )
}

/**
 * React hook that retrieves the filtered rows for a dataset from a dashboard.
 *
 * The returned rows reflect all active shared filter selections — rows that do not
 * match the current shared filter state are excluded.
 *
 * Supports two calling conventions:
 *
 * **Explicit dashboard** — pass both the runtime and dataset id for full type safety:
 * ```ts
 * const rows = useDashboardDataset(dashboard, 'orders')
 * ```
 *
 * **Context-based** — pass only the dataset id when inside a {@link DashboardProvider}:
 * ```ts
 * const rows = useDashboardDataset('orders')
 * ```
 *
 * @param dashboard - The dashboard runtime (omit when using context).
 * @param datasetId - The id of the dataset to retrieve.
 *
 * @returns A readonly array of typed row objects, filtered by all active shared filters.
 *
 * @throws If called without a dashboard runtime and outside of a `DashboardProvider`.
 * @throws If the dataset id does not exist in the dashboard's data model.
 */
export function useDashboardDataset<
  TDashboard extends DashboardDefinition<any, any, any>,
  TDatasetId extends DashboardDatasetIdFromDefinition<TDashboard>,
>(
  dashboard: DashboardRuntime<TDashboard>,
  datasetId: TDatasetId,
): DashboardDatasetRowsFromDefinition<TDashboard, TDatasetId>
/**
 * Context-based overload — retrieves filtered dataset rows by id from the nearest {@link DashboardProvider}.
 *
 * @param datasetId - The dataset id to retrieve.
 * @returns A readonly array of row objects, filtered by all active shared filters.
 */
export function useDashboardDataset(
  datasetId: string,
): readonly any[]
export function useDashboardDataset(
  dashboardOrDatasetId: unknown,
  datasetId?: string,
): unknown {
  const contextDashboard = useContext(DashboardContext)
  const dashboard = typeof dashboardOrDatasetId === 'string'
    ? contextDashboard
    : (dashboardOrDatasetId as BroadDashboardRuntime | null)
  if (!dashboard) {
    throw new Error('useDashboardDataset must receive a dashboard runtime or run within a <DashboardProvider>.')
  }

  return dashboard.dataset(
    (typeof dashboardOrDatasetId === 'string' ? dashboardOrDatasetId : datasetId)!,
  ) as readonly any[]
}

/**
 * React hook that retrieves the runtime state and controls for a dashboard shared filter.
 *
 * The returned object varies based on the filter kind:
 *
 * - **`'select'` filters** (`DashboardSharedSelectFilterRuntime`) provide:
 *   - `values` — the currently selected values (`ReadonlySet<string>`).
 *   - `options` — available filter options with labels and counts.
 *   - `toggleValue(value)` — toggles a single value on/off.
 *   - `setValues(values)` — replaces the entire selection.
 *   - `clear()` — clears all selections.
 *
 * - **`'date-range'` filters** (`DashboardSharedDateRangeFilterRuntime`) provide:
 *   - `selection` — the current date range selection (preset or custom).
 *   - `dateRangeFilter` — the resolved `DateRangeFilter` or `null` for all-time.
 *   - `setSelection(selection)` — sets the full selection object.
 *   - `setDateRangePreset(preset)` — switches to a named preset.
 *   - `setDateRangeFilter(filter)` — sets a custom date range filter.
 *   - `clear()` — resets to the default (all-time).
 *
 * Supports two calling conventions:
 *
 * **Explicit dashboard** — pass both the runtime and filter id for full type safety:
 * ```ts
 * const filter = useDashboardSharedFilter(dashboard, 'customer')
 * ```
 *
 * **Context-based** — pass only the filter id when inside a {@link DashboardProvider}:
 * ```ts
 * const filter = useDashboardSharedFilter('customer')
 * ```
 *
 * @param dashboard - The dashboard runtime (omit when using context).
 * @param filterId - The id of the shared filter to retrieve.
 *
 * @returns A `DashboardSharedFilterRuntime` — either a select or date-range variant
 *   depending on how the filter was defined.
 *
 * @throws If called without a dashboard runtime and outside of a `DashboardProvider`.
 * @throws If the filter id does not exist in the dashboard definition.
 */
export function useDashboardSharedFilter<
  TDashboard extends DashboardDefinition<any, any, any>,
  TFilterId extends DashboardSharedFilterIdFromDefinition<TDashboard>,
>(
  dashboard: DashboardRuntime<TDashboard>,
  filterId: TFilterId,
): DashboardSharedFilterRuntimeFromDefinition<TDashboard, TFilterId>
/**
 * Context-based overload — retrieves a shared filter by id from the nearest {@link DashboardProvider}.
 *
 * @param filterId - The shared filter id to retrieve.
 * @returns A `DashboardSharedFilterRuntime` (select or date-range variant).
 */
export function useDashboardSharedFilter(
  filterId: string,
): DashboardSharedFilterRuntime
export function useDashboardSharedFilter(
  dashboardOrFilterId: unknown,
  filterId?: string,
): unknown {
  const contextDashboard = useContext(DashboardContext)
  const dashboard = typeof dashboardOrFilterId === 'string'
    ? contextDashboard
    : (dashboardOrFilterId as BroadDashboardRuntime | null)
  if (!dashboard) {
    throw new Error('useDashboardSharedFilter must receive a dashboard runtime or run within a <DashboardProvider>.')
  }

  return dashboard.sharedFilter(
    (typeof dashboardOrFilterId === 'string' ? dashboardOrFilterId : filterId)!,
  ) as DashboardSharedFilterRuntime
}
