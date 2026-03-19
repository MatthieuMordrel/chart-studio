export const DATASET_CHART_METADATA = Symbol('dataset-chart-metadata')

export type DatasetChartMetadata<
  TChartId extends string | undefined = string | undefined,
  TOwner = unknown,
> = {
  readonly dataset: TOwner
  readonly chartId: TChartId
}
