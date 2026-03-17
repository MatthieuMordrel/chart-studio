import type {
  DataModelDefinition,
  DefinedDataModel,
  ModelAttributeDefinition,
  ModelDataInput,
  ModelDatasetId,
  ModelDatasets,
  ResolvedDataModelFromDefinition,
} from './data-model.types.js'
import type {MaterializedViewDefinition} from './materialized-view.types.js'
import type {
  DatasetChartDefinition,
  DatasetRow,
} from './dataset-builder.types.js'
import type {
  ChartInstanceFromSchemaDefinition,
  DateRangeFilter,
  DateRangePresetId,
  ResolvedDateColumnIdFromSchema,
  ResolvedFilterColumnIdFromSchema,
} from './types.js'

type UniqueId<TId extends string, TExisting extends string> =
  TId extends TExisting
    ? never
    : TId

type AnyDatasetChartDefinition = DatasetChartDefinition<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

type DatasetFilterColumnId<TDataset> =
  TDataset extends {columns?: Record<string, unknown> | undefined} | undefined
    ? ResolvedFilterColumnIdFromSchema<DatasetRow<TDataset>, TDataset>
    : never

type DatasetDateColumnId<TDataset> =
  TDataset extends {columns?: Record<string, unknown> | undefined} | undefined
    ? ResolvedDateColumnIdFromSchema<DatasetRow<TDataset>, TDataset>
    : never

export type DashboardChartRegistration<
  TDatasetId extends string = string,
  TChart extends AnyDatasetChartDefinition = AnyDatasetChartDefinition,
> = {
  readonly id: string
  readonly datasetId: TDatasetId
  readonly schema: TChart
  readonly dataSource: DashboardChartDataSource<TDatasetId>
}

export type DashboardCharts = Record<string, DashboardChartRegistration>

export type DashboardDatasetChartDataSource<
  TDatasetId extends string = string,
> = {
  readonly kind: 'dataset'
  readonly datasetId: TDatasetId
}

export type DashboardMaterializedViewChartDataSource<
  TDatasetId extends string = string,
  TView extends MaterializedViewDefinition<any, any, any, any> = MaterializedViewDefinition<any, any, any, any>,
> = {
  readonly kind: 'materialized-view'
  readonly datasetId: TDatasetId
  readonly view: TView
}

export type DashboardChartDataSource<
  TDatasetId extends string = string,
> =
  | DashboardDatasetChartDataSource<TDatasetId>
  | DashboardMaterializedViewChartDataSource<TDatasetId>

export type DashboardLocalSharedSelectFilterConfig<
  TDatasets extends ModelDatasets,
  TSourceDatasetId extends ModelDatasetId<TDatasets>,
  TSourceColumnId extends DatasetFilterColumnId<TDatasets[TSourceDatasetId]>,
  TTargets extends readonly DashboardSharedSelectTarget<TDatasets>[] | undefined = undefined,
> = {
  readonly kind: 'select'
  readonly label?: string
  readonly source: {
    readonly dataset: TSourceDatasetId
    readonly column: TSourceColumnId
  }
  readonly targets?: TTargets
}

export type DashboardSharedSelectTarget<
  TDatasets extends ModelDatasets,
  TDatasetId extends ModelDatasetId<TDatasets> = ModelDatasetId<TDatasets>,
> = {
  readonly dataset: TDatasetId
  readonly column: DatasetFilterColumnId<TDatasets[TDatasetId]>
}

export type DashboardSharedDateRangeTarget<
  TDatasets extends ModelDatasets,
  TDatasetId extends ModelDatasetId<TDatasets> = ModelDatasetId<TDatasets>,
> = {
  readonly dataset: TDatasetId
  readonly column: DatasetDateColumnId<TDatasets[TDatasetId]>
}

export type DashboardSharedDateRangeFilterConfig<
  TDatasets extends ModelDatasets,
  TTargets extends readonly DashboardSharedDateRangeTarget<TDatasets>[] = readonly DashboardSharedDateRangeTarget<TDatasets>[],
> = {
  readonly kind: 'date-range'
  readonly label?: string
  readonly targets: TTargets
}

export type DashboardModelSharedFilterDefinition<
  TId extends string = string,
  TAttribute extends ModelAttributeDefinition = ModelAttributeDefinition,
> = {
  readonly id: TId
  readonly kind: 'select'
  readonly label: string
  readonly source: {
    readonly kind: 'attribute'
    readonly dataset: TAttribute['source']['dataset']
    readonly key: TAttribute['source']['key']
    readonly label: TAttribute['source']['label']
  }
  readonly targets: TAttribute['targets']
  readonly attribute: TId
}

export type DashboardLocalSharedSelectFilterDefinition<
  TId extends string = string,
  TDatasets extends ModelDatasets = ModelDatasets,
> = {
  readonly id: TId
  readonly kind: 'select'
  readonly label: string
  readonly source: {
    readonly kind: 'column'
    readonly dataset: ModelDatasetId<TDatasets>
    readonly column: DatasetFilterColumnId<TDatasets[ModelDatasetId<TDatasets>]>
  }
  readonly targets: readonly DashboardSharedSelectTarget<TDatasets>[]
}

export type DashboardSharedDateRangeFilterDefinition<
  TId extends string = string,
  TDatasets extends ModelDatasets = ModelDatasets,
> = {
  readonly id: TId
  readonly kind: 'date-range'
  readonly label: string
  readonly targets: readonly DashboardSharedDateRangeTarget<TDatasets>[]
}

export type DashboardSharedFilterDefinition<
  TModel extends DefinedDataModel = DefinedDataModel,
> =
  | DashboardModelSharedFilterDefinition<string, ModelAttributeDefinition>
  | DashboardLocalSharedSelectFilterDefinition<string, TModel['datasets']>
  | DashboardSharedDateRangeFilterDefinition<string, TModel['datasets']>

export type DashboardSharedFilters<
  TModel extends DefinedDataModel = DefinedDataModel,
> = Record<string, DashboardSharedFilterDefinition<TModel>>

export type DefinedDashboard<
  TModel extends DefinedDataModel = DefinedDataModel,
  TCharts extends DashboardCharts = {},
  TSharedFilters extends DashboardSharedFilters<TModel> = {},
> = {
  readonly model: TModel
  readonly charts: TCharts
  readonly sharedFilters: TSharedFilters
  build(): DefinedDashboard<TModel, TCharts, TSharedFilters>
  readonly __dashboardBrand: 'dashboard-definition'
}

export type DashboardDefinition<
  TModel extends DefinedDataModel = DefinedDataModel,
  TCharts extends DashboardCharts = {},
  TSharedFilters extends DashboardSharedFilters<TModel> = {},
> = {
  build(): DefinedDashboard<TModel, TCharts, TSharedFilters>
}

export type ResolvedDashboardFromDefinition<TDashboard> =
  TDashboard extends DashboardDefinition<any, any, any>
    ? ReturnType<TDashboard['build']>
    : never

export type DashboardChartIdFromDefinition<TDashboard> = Extract<
  keyof ResolvedDashboardFromDefinition<TDashboard>['charts'],
  string
>

export type DashboardSharedFilterIdFromDefinition<TDashboard> = Extract<
  keyof ResolvedDashboardFromDefinition<TDashboard>['sharedFilters'],
  string
>

export type DashboardDatasetIdFromDefinition<TDashboard> = Extract<
  keyof ResolvedDashboardFromDefinition<TDashboard>['model']['datasets'],
  string
>

export type DashboardDataInputFromDefinition<
  TDashboard extends DashboardDefinition<any, any, any>,
> = ModelDataInput<ResolvedDashboardFromDefinition<TDashboard>['model']['datasets']>

export type DashboardChartDefinitionFromDefinition<
  TDashboard,
  TChartId extends DashboardChartIdFromDefinition<TDashboard>,
> = ResolvedDashboardFromDefinition<TDashboard>['charts'][TChartId]['schema']

export type DashboardChartInstanceFromDefinition<
  TDashboard,
  TChartId extends DashboardChartIdFromDefinition<TDashboard>,
> = DashboardChartDefinitionFromDefinition<TDashboard, TChartId> extends DatasetChartDefinition<
  infer TRow,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? ChartInstanceFromSchemaDefinition<
      TRow,
      DashboardChartDefinitionFromDefinition<TDashboard, TChartId>
    >
  : never

export type DashboardDatasetRowsFromDefinition<
  TDashboard,
  TDatasetId extends DashboardDatasetIdFromDefinition<TDashboard>,
> = readonly DatasetRow<
  ResolvedDashboardFromDefinition<TDashboard>['model']['datasets'][TDatasetId]
>[]

export type DashboardSharedDateRangePresetId = Exclude<DateRangePresetId, 'auto'>

export type DashboardDateRangeSelection = {
  preset: DashboardSharedDateRangePresetId | null
  customFilter: DateRangeFilter | null
}

export type DashboardSharedSelectFilterRuntime = {
  readonly id: string
  readonly kind: 'select'
  readonly label: string
  readonly values: ReadonlySet<string>
  readonly options: Array<{value: string; label: string; count: number}>
  toggleValue(value: string): void
  setValues(values: Iterable<string>): void
  clear(): void
}

export type DashboardSharedDateRangeFilterRuntime = {
  readonly id: string
  readonly kind: 'date-range'
  readonly label: string
  readonly selection: DashboardDateRangeSelection
  readonly dateRangeFilter: DateRangeFilter | null
  setSelection(selection: DashboardDateRangeSelection): void
  setDateRangePreset(preset: DashboardSharedDateRangePresetId): void
  setDateRangeFilter(filter: DateRangeFilter | null): void
  clear(): void
}

export type DashboardSharedFilterRuntime =
  | DashboardSharedSelectFilterRuntime
  | DashboardSharedDateRangeFilterRuntime

export type DashboardSharedFilterRuntimeFromDefinition<
  TDashboard,
  TFilterId extends DashboardSharedFilterIdFromDefinition<TDashboard>,
> = ResolvedDashboardFromDefinition<TDashboard>['sharedFilters'][TFilterId] extends {
  kind: 'date-range'
}
  ? DashboardSharedDateRangeFilterRuntime
  : DashboardSharedSelectFilterRuntime

export type DashboardResolvedChartOwnership = {
  readonly sharedFilterIds: readonly string[]
  readonly filterColumnIds: ReadonlySet<string>
  readonly dateColumnIds: ReadonlySet<string>
}

export type DashboardResolvedChart<
  TDashboard,
  TChartId extends DashboardChartIdFromDefinition<TDashboard>,
> = DashboardChartDefinitionFromDefinition<TDashboard, TChartId> extends DatasetChartDefinition<
  infer TRow,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? {
      readonly id: TChartId
      readonly datasetId: ResolvedDashboardFromDefinition<TDashboard>['charts'][TChartId]['datasetId']
      readonly source: ResolvedDashboardFromDefinition<TDashboard>['charts'][TChartId]['dataSource']
      readonly data: readonly TRow[]
      readonly schema: DashboardChartDefinitionFromDefinition<TDashboard, TChartId>
      readonly ownership: DashboardResolvedChartOwnership
    }
  : never

export type DashboardRuntime<
  TDashboard extends DashboardDefinition<any, any, any> = DashboardDefinition<any, any, any>,
> = {
  readonly definition: ResolvedDashboardFromDefinition<TDashboard>
  readonly chartIds: DashboardChartIdFromDefinition<TDashboard>[]
  readonly sharedFilterIds: DashboardSharedFilterIdFromDefinition<TDashboard>[]
  chart<TChartId extends DashboardChartIdFromDefinition<TDashboard>>(
    id: TChartId,
  ): DashboardResolvedChart<TDashboard, TChartId>
  dataset<TDatasetId extends DashboardDatasetIdFromDefinition<TDashboard>>(
    id: TDatasetId,
  ): DashboardDatasetRowsFromDefinition<TDashboard, TDatasetId>
  sharedFilter<TFilterId extends DashboardSharedFilterIdFromDefinition<TDashboard>>(
    id: TFilterId,
  ): DashboardSharedFilterRuntimeFromDefinition<TDashboard, TFilterId>
}

export interface DashboardBuilder<
  TModel extends DefinedDataModel = DefinedDataModel,
  TCharts extends DashboardCharts = {},
  TSharedFilters extends DashboardSharedFilters<TModel> = {},
> extends DashboardDefinition<TModel, TCharts, TSharedFilters> {
  chart<
    const TId extends string,
    const TChart extends AnyDatasetChartDefinition,
  >(
    id: UniqueId<TId, Extract<keyof TCharts, string>>,
    chart: TChart,
  ): DashboardBuilder<
    TModel,
    TCharts & Record<TId, DashboardChartRegistration<string, TChart>>,
    TSharedFilters
  >

  sharedFilter<
    const TId extends Extract<keyof TModel['attributes'], string>,
  >(
    id: UniqueId<TId, Extract<keyof TSharedFilters, string>>,
  ): DashboardBuilder<
    TModel,
    TCharts,
    TSharedFilters & Record<
      TId,
      DashboardModelSharedFilterDefinition<TId, ModelAttributeDefinition>
    >
  >

  sharedFilter<
    const TId extends string,
    const TSourceDatasetId extends ModelDatasetId<TModel['datasets']>,
    const TSourceColumnId extends DatasetFilterColumnId<TModel['datasets'][TSourceDatasetId]>,
    const TTargets extends readonly DashboardSharedSelectTarget<TModel['datasets']>[] | undefined = undefined,
  >(
    id: UniqueId<TId, Extract<keyof TSharedFilters, string>>,
    config: DashboardLocalSharedSelectFilterConfig<
      TModel['datasets'],
      TSourceDatasetId,
      TSourceColumnId,
      TTargets
    >,
  ): DashboardBuilder<
    TModel,
    TCharts,
    TSharedFilters & Record<
      TId,
      DashboardLocalSharedSelectFilterDefinition<TId, TModel['datasets']>
    >
  >

  sharedFilter<
    const TId extends string,
    const TTargets extends readonly DashboardSharedDateRangeTarget<TModel['datasets']>[],
  >(
    id: UniqueId<TId, Extract<keyof TSharedFilters, string>>,
    config: DashboardSharedDateRangeFilterConfig<TModel['datasets'], TTargets>,
  ): DashboardBuilder<
    TModel,
    TCharts,
    TSharedFilters & Record<
      TId,
      DashboardSharedDateRangeFilterDefinition<TId, TModel['datasets']>
    >
  >
}

export type DashboardInputModel<
  TModel extends DataModelDefinition<any, any, any, any>,
> = ResolvedDataModelFromDefinition<TModel>
