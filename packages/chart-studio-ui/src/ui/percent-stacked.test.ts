import {describe, expect, it} from 'vitest'
import {
  getPercentStackedDisplayValue,
  getPercentStackedProportion,
  getPercentStackedProportionFromPayload,
} from './percent-stacked.js'

describe('percent-stacked helpers', () => {
  const seriesKeys = ['Italian', 'Mexican', 'Asian', 'American'] as const
  const payload = {
    xKey: '2026-03',
    Italian: 6,
    Mexican: 5,
    Asian: 3,
    American: 4,
  }

  it('extracts a stacked segment proportion from Recharts graphical bounds', () => {
    expect(getPercentStackedProportion({value: [0.6111111111, 0.9444444444]})).toBeCloseTo(6 / 18, 6)
  })

  it('derives a tooltip proportion from the raw transformed row', () => {
    expect(getPercentStackedProportionFromPayload(payload, 'Italian', seriesKeys)).toBeCloseTo(6 / 18, 6)
    expect(getPercentStackedProportionFromPayload(payload, 'American', seriesKeys)).toBeCloseTo(4 / 18, 6)
  })

  it('prefers raw payload proportions so tooltip entries no longer format raw counts as percents', () => {
    const tooltipEntry = {
      dataKey: 'Italian',
      value: 6,
      payload,
    }

    expect(getPercentStackedDisplayValue(tooltipEntry, 'Italian', seriesKeys)).toBeCloseTo(6 / 18, 6)
  })

  it('still supports stacked graphical entries when payload data is unavailable', () => {
    const labelEntry = {
      value: [0.3333333333, 0.6111111111],
    }

    expect(getPercentStackedDisplayValue(labelEntry, 'Mexican', seriesKeys)).toBeCloseTo(5 / 18, 6)
  })
})
