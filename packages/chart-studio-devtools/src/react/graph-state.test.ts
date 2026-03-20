import type {NodeChange} from '@xyflow/react'
import {
  defineDataModel,
  defineDataset,
} from '@matthieumordrel/chart-studio'
import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  applyFlowNodePositionChanges,
  buildFlowEdges,
  buildFlowNodes,
  type FlowNode,
} from './graph-state.js'
import {
  filterGraphVisibleSource,
  normalizeSource,
} from './normalize.js'

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

describe('graph-state', () => {
  it('rebuilds the full graph after materialized views are hidden and shown again', () => {
    const source = createNormalizedGraph()
    const hiddenSource = filterGraphVisibleSource(source, false)

    const fullNodeIds = buildFlowNodes(source, {}, null).map((node) => node.id)
    const fullEdgeIds = buildFlowEdges(source, null).map((edge) => edge.id).toSorted()
    const hiddenEdges = buildFlowEdges(hiddenSource, null)

    expect(buildFlowNodes(hiddenSource, {}, null).map((node) => node.id)).toEqual(['owners', 'jobs'])
    expect(
      hiddenEdges.every((edge) => edge.source !== 'jobsWithOwner' && edge.target !== 'jobsWithOwner'),
    ).toBe(true)
    expect(hiddenEdges.length).toBeLessThan(fullEdgeIds.length)

    expect(buildFlowNodes(source, {}, null).map((node) => node.id)).toEqual(fullNodeIds)
    expect(buildFlowEdges(source, null).map((edge) => edge.id).toSorted()).toEqual(fullEdgeIds)
  })

  it('ignores structural React Flow changes and only updates visible node positions', () => {
    const source = createNormalizedGraph()
    const hiddenSource = filterGraphVisibleSource(source, false)
    const replacementNode = buildFlowNodes(hiddenSource, {}, null)[0]!
    const changes: NodeChange<FlowNode>[] = [
      {id: 'jobs', type: 'remove'},
      {id: 'owners', type: 'select', selected: true},
      {type: 'add', item: {...replacementNode, id: 'synthetic'}},
      {id: 'jobs', type: 'replace', item: replacementNode},
      {id: 'owners', type: 'position', position: {x: 220, y: 140}},
      {id: 'jobsWithOwner', type: 'position', position: {x: 999, y: 999}},
      {id: 'ghost', type: 'position', position: {x: 1, y: 2}},
    ]

    const nextPositions = applyFlowNodePositionChanges(
      {
        owners: {x: 10, y: 20},
        jobs: {x: 30, y: 40},
      },
      changes,
      hiddenSource,
    )

    expect(nextPositions).toEqual({
      owners: {x: 220, y: 140},
      jobs: {x: 30, y: 40},
    })
  })
})
