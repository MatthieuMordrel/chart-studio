import {describe, expect, it} from 'vitest'
import {buildVisibleTickIndices, estimateMinimumTickStep, selectVisibleXAxisTicks} from './chart-axis-ticks.js'

describe('buildVisibleTickIndices', () => {
  it('shows every tick when the minimum step is one', () => {
    expect(buildVisibleTickIndices(5, 1)).toEqual([0, 1, 2, 3, 4])
  })

  it('keeps a uniform one-slot rhythm when the point count allows it', () => {
    expect(buildVisibleTickIndices(7, 2)).toEqual([0, 2, 4, 6])
  })

  it('uses a single wider fallback gap away from the end when needed', () => {
    expect(buildVisibleTickIndices(6, 2)).toEqual([0, 3, 5])
  })

  it('pushes multiple wider gaps toward the center for wider minimum steps', () => {
    expect(buildVisibleTickIndices(15, 3)).toEqual([0, 3, 7, 11, 14])
  })

  it('still keeps first and last visible when only two ticks can fit', () => {
    expect(buildVisibleTickIndices(5, 10)).toEqual([0, 4])
  })
})

describe('estimateMinimumTickStep', () => {
  it('keeps the step at one when labels fit the available plot width', () => {
    expect(estimateMinimumTickStep(['Jan', 'Feb', 'Mar'], 120, 8, (label) => label.length * 8)).toBe(1)
  })

  it('increases the step when the widest label would collide', () => {
    expect(estimateMinimumTickStep(['January', 'February', 'March'], 120, 8, (label) => label.length * 8)).toBe(2)
  })
})

describe('selectVisibleXAxisTicks', () => {
  it('returns evenly filtered tick values using the computed minimum step', () => {
    expect(
      selectVisibleXAxisTicks({
        values: ['A', 'B', 'C', 'D', 'E', 'F'],
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        plotWidth: 120,
        minimumTickGap: 8,
        measureLabelWidth: (label) => label.length * 8,
      }),
    ).toEqual(['A', 'D', 'F'])
  })
})
