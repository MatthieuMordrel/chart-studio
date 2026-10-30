import {describe, expect, it} from 'vitest'
import {getStackTotal, getStackTotalAnchorKey, getStackTotalLabelValue} from './stack-total-labels.js'

describe('stack-total-labels helpers', () => {
  const seriesKeys = ['Interim', 'Permanent', 'Freelance'] as const

  it('sums every numeric series value of a point', () => {
    expect(getStackTotal({xKey: '2026-01', Interim: 1200, Permanent: 800, Freelance: 500}, seriesKeys)).toBe(2500)
  })

  it('ignores nulls, missing series, and keys that are not series', () => {
    expect(getStackTotal({xKey: '2026-01', xLabel: 'Jan', Interim: 100, Permanent: null}, seriesKeys)).toBe(100)
  })

  it('returns null for an empty stack so no label is drawn', () => {
    expect(getStackTotal({xKey: '2026-01', Interim: null, Permanent: null}, seriesKeys)).toBeNull()
    expect(getStackTotalAnchorKey({xKey: '2026-01', Interim: null}, seriesKeys)).toBeNull()
  })

  it('anchors positive totals on the top segment', () => {
    expect(getStackTotalAnchorKey({Interim: 1, Permanent: 2, Freelance: 3}, seriesKeys)).toBe('Freelance')
  })

  it('anchors on the highest segment that has a value when upper series are empty', () => {
    expect(getStackTotalAnchorKey({Interim: 5, Permanent: 3, Freelance: null}, seriesKeys)).toBe('Permanent')
    expect(getStackTotalAnchorKey({Interim: 5, Permanent: 3, Freelance: 0}, seriesKeys)).toBe('Permanent')
  })

  it('anchors on the highest point of the stack when a later segment is negative', () => {
    // Cumulative ends: 10, 4, 6 → the stack peaks at the first segment.
    expect(getStackTotalAnchorKey({Interim: 10, Permanent: -6, Freelance: 2}, seriesKeys)).toBe('Interim')
  })

  it('anchors negative totals on the lowest point of the stack', () => {
    // Cumulative ends: -4, -9, -7 → the stack bottoms out at the second segment.
    expect(getStackTotalAnchorKey({Interim: -4, Permanent: -5, Freelance: 2}, seriesKeys)).toBe('Permanent')
  })

  it('draws no label when the total is zero', () => {
    expect(getStackTotalAnchorKey({Interim: 5, Permanent: -5}, seriesKeys)).toBeNull()
  })

  it('returns the total only for the anchor segment', () => {
    const payload = {xKey: '2026-01', Interim: 1200, Permanent: 800, Freelance: 500}

    expect(getStackTotalLabelValue(payload, 'Freelance', seriesKeys)).toBe(2500)
    expect(getStackTotalLabelValue(payload, 'Interim', seriesKeys)).toBeNull()
    expect(getStackTotalLabelValue(payload, 'Permanent', seriesKeys)).toBeNull()
  })

  it('only counts the series passed in', () => {
    const payload = {Interim: 1200, Permanent: 800, Freelance: 500}

    expect(getStackTotalLabelValue(payload, 'Permanent', ['Interim', 'Permanent'])).toBe(2000)
  })

  it('handles missing payloads', () => {
    expect(getStackTotalLabelValue(undefined, 'Interim', seriesKeys)).toBeNull()
  })
})
