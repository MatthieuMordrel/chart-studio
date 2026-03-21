import {describe, expect, it} from 'vitest'
import {
  DEFAULT_DEVTOOLS_ELK_LAYOUT,
  devtoolsElkLayoutToElkOptions,
} from './layout-options.js'

describe('layout-options', () => {
  it('adds edge-aware layered defaults for cleaner graph layouts', () => {
    const options = devtoolsElkLayoutToElkOptions(DEFAULT_DEVTOOLS_ELK_LAYOUT)

    expect(options['elk.edgeRouting']).toBe('ORTHOGONAL')
    expect(options['elk.layered.nodePlacement.favorStraightEdges']).toBe('true')
    expect(options['elk.layered.considerModelOrder.strategy']).toBe('NODES_AND_EDGES')
    expect(options['elk.layered.considerModelOrder.groupModelOrder.cmGroupOrderStrategy']).toBe('ENFORCED')
    expect(options['elk.spacing.edgeNode']).toBe('28')
    expect(options['elk.layered.spacing.edgeNodeBetweenLayers']).toBe('27')
    expect(options['elk.layered.spacing.edgeEdgeBetweenLayers']).toBe('19')
  })
})
