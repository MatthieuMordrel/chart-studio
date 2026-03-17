import {DATASET_CHART_METADATA} from './dataset-chart-metadata.js'
import type {DatasetChartMetadata} from './dataset-chart-metadata.js'
import type {
  DashboardBuilder,
  DashboardChartDataSource,
  DashboardCharts,
  DashboardDefinition,
  DashboardInputModel,
  DashboardSharedFilters,
  DefinedDashboard,
  ResolvedDashboardFromDefinition,
} from './dashboard.types.js'
import type {
  DataModelDefinition,
  DefinedDataModel,
} from './data-model.types.js'

type UniqueStateId = Record<string, unknown>

type DashboardState<
  TModel extends DefinedDataModel,
  TCharts extends DashboardCharts,
  TSharedFilters extends DashboardSharedFilters<TModel>,
> = {
  model: TModel
  charts: TCharts
  sharedFilters: TSharedFilters
}

function humanizeId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function assertUniqueId(
  collection: UniqueStateId,
  kind: string,
  id: string,
): void {
  if (id in collection) {
    throw new Error(`Duplicate ${kind} id: "${id}"`)
  }
}

function getDatasetChartMetadata(
  chart: unknown,
): DatasetChartMetadata<string | undefined> | undefined {
  if (chart && typeof chart === 'object' && DATASET_CHART_METADATA in chart) {
    return (chart as Record<PropertyKey, unknown>)[DATASET_CHART_METADATA] as DatasetChartMetadata<string | undefined>
  }

  if (chart && typeof chart === 'object' && 'build' in chart && typeof chart.build === 'function') {
    const built = chart.build()
    if (built && typeof built === 'object' && DATASET_CHART_METADATA in built) {
      return (built as Record<PropertyKey, unknown>)[DATASET_CHART_METADATA] as DatasetChartMetadata<string | undefined>
    }
  }

  return undefined
}

function findModelDatasetId(
  model: DefinedDataModel,
  dataset: unknown,
): string | undefined {
  return Object.entries(model.datasets).find(([, candidate]) => candidate === dataset)?.[0]
}

function isMaterializedView(
  source: unknown,
): source is {
  readonly materialization: {
    readonly baseDataset: string
  }
  build(): unknown
} {
  return (
    !!source
    && typeof source === 'object'
    && '__materializedViewBrand' in source
    && 'materialization' in source
    && 'build' in source
    && typeof source.build === 'function'
  )
}

function resolveChartDataSource(
  model: DefinedDataModel,
  datasetOrView: unknown,
): DashboardChartDataSource<string> | undefined {
  const datasetId = findModelDatasetId(model, datasetOrView)
  if (datasetId) {
    return {
      kind: 'dataset',
      datasetId,
    }
  }

  if (!isMaterializedView(datasetOrView)) {
    return undefined
  }

  const view = datasetOrView as any
  const baseDatasetId = view.materialization.baseDataset

  if (!(baseDatasetId in model.datasets)) {
    return undefined
  }

  return {
    kind: 'materialized-view',
    datasetId: baseDatasetId,
    view,
  }
}

function createDefinedDashboard<
  TModel extends DefinedDataModel,
  TCharts extends DashboardCharts,
  TSharedFilters extends DashboardSharedFilters<TModel>,
>(
  state: DashboardState<TModel, TCharts, TSharedFilters>,
): DefinedDashboard<TModel, TCharts, TSharedFilters> {
  let cachedDashboard: DefinedDashboard<TModel, TCharts, TSharedFilters> | undefined

  const build = (): DefinedDashboard<TModel, TCharts, TSharedFilters> => {
    if (cachedDashboard) {
      return cachedDashboard
    }

    const definedDashboard: DefinedDashboard<TModel, TCharts, TSharedFilters> = {
      model: state.model,
      charts: state.charts,
      sharedFilters: state.sharedFilters,
      build() {
        return definedDashboard
      },
      __dashboardBrand: 'dashboard-definition',
    }

    cachedDashboard = definedDashboard
    return definedDashboard
  }

  return build()
}

function createDashboardBuilder<
  TModel extends DefinedDataModel,
  TCharts extends DashboardCharts = {},
  TSharedFilters extends DashboardSharedFilters<TModel> = {},
>(
  state: DashboardState<TModel, TCharts, TSharedFilters>,
): DashboardBuilder<TModel, TCharts, TSharedFilters> {
  let cachedDashboard: DefinedDashboard<TModel, TCharts, TSharedFilters> | undefined

  return {
    chart(id: any, chart: any) {
      assertUniqueId(state.charts, 'dashboard chart', id)

      const metadata = getDatasetChartMetadata(chart)
      if (!metadata) {
        throw new Error(
          `Dashboard chart "${id}" must come from defineDataset(...).chart(...). Standalone defineChartSchema(...) definitions stay single-chart only.`,
        )
      }

      if (metadata.chartId && metadata.chartId !== id) {
        throw new Error(
          `Dashboard chart "${id}" does not match the chart authoring id "${metadata.chartId}".`,
        )
      }

      const dataSource = resolveChartDataSource(state.model, metadata.dataset)
      if (!dataSource) {
        throw new Error(
          `Dashboard chart "${id}" references a dataset or materialized view that is not registered in this data model.`,
        )
      }

      return createDashboardBuilder({
        ...state,
        charts: {
          ...state.charts,
          [id]: {
            id,
            datasetId: dataSource.datasetId,
            schema: chart,
            dataSource,
          },
        },
      })
    },
    sharedFilter(id: any, config?: any) {
      assertUniqueId(state.sharedFilters, 'shared filter', id)

      if (config === undefined) {
        const attribute = (state.model.attributes as Record<string, any>)[id]
        if (!attribute) {
          throw new Error(`Unknown model attribute id: "${id}"`)
        }

        return createDashboardBuilder({
          ...state,
          sharedFilters: {
            ...state.sharedFilters,
            [id]: {
              id,
              kind: 'select',
              label: humanizeId(id),
              source: {
                kind: 'attribute',
                dataset: attribute.source.dataset,
                key: attribute.source.key,
                label: attribute.source.label,
              },
              targets: attribute.targets,
              attribute: id,
            },
          },
        })
      }

      if (config.kind === 'select') {
        return createDashboardBuilder({
          ...state,
          sharedFilters: {
            ...state.sharedFilters,
            [id]: {
              id,
              kind: 'select',
              label: config.label ?? humanizeId(id),
              source: {
                kind: 'column',
                dataset: config.source.dataset,
                column: config.source.column,
              },
              targets: config.targets ?? [
                {
                  dataset: config.source.dataset,
                  column: config.source.column,
                },
              ],
            },
          },
        })
      }

      if (!Array.isArray(config.targets) || config.targets.length === 0) {
        throw new Error(`Dashboard shared date-range filter "${id}" requires at least one target.`)
      }

      return createDashboardBuilder({
        ...state,
        sharedFilters: {
          ...state.sharedFilters,
          [id]: {
            id,
            kind: 'date-range',
            label: config.label ?? humanizeId(id),
            targets: config.targets,
          },
        },
      })
    },
    build() {
      if (cachedDashboard) {
        return cachedDashboard
      }

      cachedDashboard = createDefinedDashboard(state)
      return cachedDashboard
    },
  } as DashboardBuilder<TModel, TCharts, TSharedFilters>
}

export function resolveDashboardDefinition<
  TDashboard extends DashboardDefinition<any, any, any>,
>(
  dashboard: TDashboard,
): ResolvedDashboardFromDefinition<TDashboard> {
  return dashboard.build() as ResolvedDashboardFromDefinition<TDashboard>
}

export function defineDashboard<
  TModel extends DataModelDefinition<any, any, any, any>,
>(
  model: TModel,
): DashboardBuilder<DashboardInputModel<TModel>> {
  return createDashboardBuilder({
    model: model.build() as DashboardInputModel<TModel>,
    charts: {},
    sharedFilters: {},
  })
}
