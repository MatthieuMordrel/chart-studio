import {render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'
import {
  defineDataModel,
  defineDataset,
} from '@matthieumordrel/chart-studio'
import {
  removeChartStudioDevtoolsSnapshot,
  upsertChartStudioDevtoolsSnapshot,
} from '@matthieumordrel/chart-studio/_internal'
import {useDevtoolsSources} from './use-devtools-sources.js'
import type {
  ChartStudioDevtoolsInputSnapshot,
  ChartStudioDevtoolsProps,
} from './types.js'

const INTERNAL_SOURCE_ID = 'devtools-hook-switch'

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
    column.field('ownerId', {label: 'Owner ID'}),
    column.category('title', {label: 'Title'}),
  ])

const model = defineDataModel()
  .dataset('owners', owners)
  .dataset('jobs', jobs)
  .infer({relationships: true})
  .build()

function createSnapshot(): ChartStudioDevtoolsInputSnapshot {
  return {
    model,
    data: {
      owners: [
        {id: 'owner-1', name: 'Alice'},
      ],
      jobs: [
        {id: 'job-1', ownerId: 'owner-1', title: 'Staff Engineer'},
      ],
    },
  }
}

function SourcesHarness(props: ChartStudioDevtoolsProps) {
  const sources = useDevtoolsSources(props)

  return (
    <div data-testid='sources'>
      {sources.map((source) => source.label).join(', ') || 'none'}
    </div>
  )
}

afterEach(() => {
  removeChartStudioDevtoolsSnapshot(INTERNAL_SOURCE_ID)
})

describe('useDevtoolsSources', () => {
  it('supports switching between internal and external snapshot modes on rerender', () => {
    const internalSnapshot = {
      label: 'Internal Source',
      model,
      data: createSnapshot().data,
    }

    upsertChartStudioDevtoolsSnapshot(INTERNAL_SOURCE_ID, internalSnapshot)

    const externalSnapshot = createSnapshot()
    const {rerender} = render(<SourcesHarness />)

    expect(screen.getByTestId('sources').textContent).toBe('Internal Source')

    rerender(
      <SourcesHarness
        getSnapshot={() => externalSnapshot}
        subscribe={() => () => {}}
      />,
    )

    expect(screen.getByTestId('sources').textContent).toBe('Snapshot')

    rerender(<SourcesHarness />)

    expect(screen.getByTestId('sources').textContent).toBe('Internal Source')
  })
})
