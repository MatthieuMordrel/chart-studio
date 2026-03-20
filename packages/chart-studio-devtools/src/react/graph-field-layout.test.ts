import {
  defineDataModel,
  defineDataset,
} from '@matthieumordrel/chart-studio'
import {describe, expect, it} from 'vitest'
import {computeCanvasFieldOrderByNodeId} from './graph-field-layout.js'
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

describe('graph-field-layout', () => {
  it('can lift a foreign key above a primary key when neighboring nodes would otherwise cross', () => {
    const source = createNormalizedGraph()
    const orderByNodeId = computeCanvasFieldOrderByNodeId(
      source,
      {
        owners: {x: 0, y: 0},
        jobs: {x: 300, y: 160},
        jobsWithOwner: {x: 600, y: 420},
      },
      new Set(),
    )

    expect(orderByNodeId.get('jobs')?.slice(0, 3)).toEqual(['ownerId', 'id', 'title'])
  })
})
