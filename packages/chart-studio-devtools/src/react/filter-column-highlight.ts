import type {ChartStudioDevtoolsFilterSummary} from '@matthieumordrel/chart-studio/_internal'
import type {AnyDevtoolsModel, DatasetFieldVm, NormalizedNodeVm} from './types.js'

/**
 * Builds the same projected field id used by materialized views (alias + source column id).
 */
function buildProjectedId(alias: string, columnId: string): string {
  return `${alias}${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`
}

/**
 * Returns field ids that correspond to active dashboard filters for the given graph node,
 * so the inspect table can highlight those columns (base columns, join projections, MV grain).
 */
export function getFilterHighlightedFieldIds(
  node: NormalizedNodeVm,
  filterSummary: readonly ChartStudioDevtoolsFilterSummary[] | undefined,
  model?: AnyDevtoolsModel,
): Set<string> {
  const highlighted = new Set<string>()
  if (!filterSummary?.length) {
    return highlighted
  }

  for (const filter of filterSummary) {
    if (filter.dateRangeTargets?.length) {
      for (const target of filter.dateRangeTargets) {
        for (const field of node.fields) {
          if (fieldMatchesDateTarget(node, field, target.datasetId, target.columnId)) {
            highlighted.add(field.id)
          }
        }
      }
      continue
    }

    let sourceDatasetId = filter.sourceDatasetId
    let columnId = filter.columnId

    if (sourceDatasetId === undefined && model?.attributes?.[filter.filterId]) {
      const attribute = model.attributes[filter.filterId]!
      sourceDatasetId = attribute.source.dataset
      columnId = attribute.source.key
    }

    if (sourceDatasetId === undefined) {
      continue
    }

    for (const field of node.fields) {
      if (field.joinProjection?.targetDataset === sourceDatasetId
        && buildProjectedId(field.joinProjection.alias, columnId) === field.id) {
        highlighted.add(field.id)
        continue
      }

      if (node.datasetId === sourceDatasetId && field.id === columnId) {
        highlighted.add(field.id)
        continue
      }

      if (field.mvBaseDatasetId === sourceDatasetId && field.id === columnId) {
        highlighted.add(field.id)
      }
    }
  }

  return highlighted
}

/**
 * Whether a field represents the given dataset column, including MV join renames.
 */
function fieldMatchesDateTarget(
  node: NormalizedNodeVm,
  field: DatasetFieldVm,
  targetDatasetId: string,
  targetColumnId: string,
): boolean {
  if (field.joinProjection?.targetDataset === targetDatasetId
    && buildProjectedId(field.joinProjection.alias, targetColumnId) === field.id) {
    return true
  }

  if (node.datasetId === targetDatasetId && field.id === targetColumnId) {
    return true
  }

  if (field.mvBaseDatasetId === targetDatasetId && field.id === targetColumnId) {
    return true
  }

  return false
}
