import {
  defineDataModel,
  defineDataset,
} from '@matthieumordrel/chart-studio'
import {describe, expect, it} from 'vitest'
import {buildElkLayoutGraph, extractElkEdgeRoutes} from './layout.js'
import {normalizeSource} from './normalize.js'

function createNormalizedGraph() {
  const owners = defineDataset<{id: string; name: string}>()
    .key('id')
    .columns((column) => [
      column.field('id', {label: 'Owner ID'}),
      column.category('name', {label: 'Owner'}),
    ])

  const jobs = defineDataset<{id: string; ownerId: string; title: string}>()
    .key('id')
    .columns((column) => [
      column.field('id', {label: 'Job ID'}),
      column.field('title', {label: 'Title'}),
      column.field('ownerId', {label: 'Owner ID'}),
    ])

  const model = defineDataModel()
    .dataset('owners', owners)
    .dataset('jobs', jobs)
    .infer({
      relationships: true,
      attributes: true,
    })
    .build()

  const jobsWithOwner = model.materialize('jobsWithOwner', (materialize) =>
    materialize
      .from('jobs')
      .join('owner', {
        relationship: 'jobs.ownerId -> owners.id',
      })
      .grain('job'),
  )

  return normalizeSource({
    id: 'test-source',
    label: 'Test Source',
    snapshot: {
      model,
      data: {
        owners: [
          {id: 'owner-1', name: 'Alice'},
        ],
        jobs: [
          {id: 'job-1', ownerId: 'owner-1', title: 'Staff Engineer'},
        ],
      },
      materializedViews: {
        jobsWithOwner,
      },
    },
  })
}

describe('layout', () => {
  it('groups materialized views and materialization edges after structural graph elements', () => {
    const source = createNormalizedGraph()
    const graph = buildElkLayoutGraph(source, new Set())

    expect(graph.children?.find((node) => node.id === 'owners')?.layoutOptions?.['elk.layered.considerModelOrder.groupModelOrder.crossingMinimizationId']).toBe('0')
    expect(graph.children?.find((node) => node.id === 'jobsWithOwner')?.layoutOptions?.['elk.layered.considerModelOrder.groupModelOrder.crossingMinimizationId']).toBe('1')
    expect(graph.edges?.find((edge) => edge.id === 'jobs.ownerId -> owners.id')?.layoutOptions?.['elk.layered.considerModelOrder.groupModelOrder.crossingMinimizationId']).toBe('0')
    expect(graph.edges?.find((edge) => edge.id.includes('jobsWithOwner:base'))?.layoutOptions?.['elk.layered.considerModelOrder.groupModelOrder.crossingMinimizationId']).toBe('1')
  })

  it('extracts orthogonal edge routes from ELK layout sections', () => {
    const routes = extractElkEdgeRoutes({
      edges: [
        {
          id: 'owners.id -> jobs.ownerId',
          sources: ['owners'],
          targets: ['jobs'],
          sections: [
            {
              startPoint: {x: 276, y: 88},
              bendPoints: [
                {x: 340, y: 88},
                {x: 340, y: 12},
              ],
              endPoint: {x: 420, y: 12},
            },
          ],
        },
      ],
    })

    expect(routes).toEqual({
      'owners.id -> jobs.ownerId': [
        {x: 276, y: 88},
        {x: 340, y: 88},
        {x: 340, y: 12},
        {x: 420, y: 12},
      ],
    })
  })
})
