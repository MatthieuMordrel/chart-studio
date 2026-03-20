import {describe, expect, it} from 'vitest'
import {defineDataModel, defineDataset} from '@matthieumordrel/chart-studio'
import {normalizeSource} from './normalize.js'

describe('normalizeSource', () => {
  it('keeps key columns first, foreign keys next, and surfaces inferred relationships and materialized views', () => {
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

    const normalized = normalizeSource({
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

    const jobsNode = normalized.nodeMap.get('jobs')
    expect(jobsNode?.fields.map((field) => field.id)).toEqual(['id', 'ownerId', 'title'])

    expect(normalized.nodeMap.has('jobsWithOwner')).toBe(true)
    expect(
      normalized.edges.some((edge) => edge.kind === 'relationship' && edge.id === 'jobs.ownerId -> owners.id' && edge.inferred),
    ).toBe(true)
    expect(
      normalized.issues.some((issue) => issue.id === 'inferred:jobs.ownerId -> owners.id'),
    ).toBe(true)
  })
})
