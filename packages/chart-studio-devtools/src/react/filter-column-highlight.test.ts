import {describe, expect, it} from 'vitest'
import type {ChartStudioDevtoolsFilterSummary} from '@matthieumordrel/chart-studio/_internal'
import {getFilterHighlightedFieldIds} from './filter-column-highlight.js'
import type {DatasetFieldVm, NormalizedNodeVm} from './types.js'

function field(partial: Partial<DatasetFieldVm> & {id: string}): DatasetFieldVm {
  return {
    label: partial.id,
    type: 'category',
    formatHint: null,
    inferenceHint: null,
    derivedSummary: null,
    isPrimaryKey: false,
    isForeignKey: false,
    isAssociationField: false,
    isDerived: false,
    joinProjection: null,
    mvBaseDatasetId: null,
    sourceHandleId: `${partial.id}::out`,
    targetHandleId: `${partial.id}::in`,
    ...partial,
  }
}

describe('getFilterHighlightedFieldIds', () => {
  it('matches join-projected columns for attribute filters', () => {
    const node: NormalizedNodeVm = {
      id: 'mv:projectCapabilityView',
      kind: 'materialized-view',
      label: 'Project capability view',
      datasetId: 'projectCapabilityView',
      rowCount: 1,
      estimatedBytes: 1,
      attributeIds: [],
      rawRows: [],
      fields: [
        field({
          id: 'capabilityId',
          joinProjection: {
            targetDataset: 'capabilities',
            via: 'projectCapabilities',
            alias: 'capability',
            stepKind: 'through-association',
          },
        }),
        field({id: 'status', mvBaseDatasetId: 'projectPlans'}),
      ],
      definition: {} as NormalizedNodeVm['definition'],
    }

    const filterSummary: ChartStudioDevtoolsFilterSummary[] = [{
      filterId: 'capability',
      columnId: 'id',
      label: 'Capability',
      values: ['string:skill-1'],
      sourceDatasetId: 'capabilities',
    }]

    expect([...getFilterHighlightedFieldIds(node, filterSummary)]).toEqual(['capabilityId'])
  })

  it('resolves attribute filters via model when sourceDatasetId is missing', () => {
    const node: NormalizedNodeVm = {
      id: 'mv:projectCapabilityView',
      kind: 'materialized-view',
      label: 'Project capability view',
      datasetId: 'projectCapabilityView',
      rowCount: 1,
      estimatedBytes: 1,
      attributeIds: [],
      rawRows: [],
      fields: [
        field({
          id: 'capabilityId',
          joinProjection: {
            targetDataset: 'capabilities',
            via: 'projectCapabilities',
            alias: 'capability',
            stepKind: 'through-association',
          },
        }),
      ],
      definition: {} as NormalizedNodeVm['definition'],
    }

    const filterSummary: ChartStudioDevtoolsFilterSummary[] = [{
      filterId: 'capability',
      columnId: 'id',
      label: 'Capability',
      values: ['TypeScript'],
    }]

    const model = {
      datasets: {},
      relationships: {},
      associations: {},
      attributes: {
        capability: {
          id: 'capability',
          source: {dataset: 'capabilities', key: 'id', label: 'name'},
          targets: [],
        },
      },
    }

    expect([...getFilterHighlightedFieldIds(node, filterSummary, model)]).toEqual(['capabilityId'])
  })

  it('matches base grain columns for column filters', () => {
    const node: NormalizedNodeVm = {
      id: 'ds:projectPlans',
      kind: 'dataset',
      label: 'Project plans',
      datasetId: 'projectPlans',
      rowCount: 1,
      estimatedBytes: 1,
      attributeIds: [],
      rawRows: [],
      fields: [
        field({id: 'status'}),
      ],
      definition: {} as NormalizedNodeVm['definition'],
    }

    const filterSummary: ChartStudioDevtoolsFilterSummary[] = [{
      filterId: 'status',
      columnId: 'status',
      label: 'Status',
      values: ['Planned'],
      sourceDatasetId: 'projectPlans',
    }]

    expect([...getFilterHighlightedFieldIds(node, filterSummary)]).toEqual(['status'])
  })
})
