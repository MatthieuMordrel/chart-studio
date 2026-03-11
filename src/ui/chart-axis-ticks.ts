/**
 * Shared axis tick value type for cartesian X axes.
 */
export type AxisTickValue = string | number

/**
 * Options used to select the visible X-axis ticks for a categorical chart.
 */
type SelectVisibleXAxisTicksOptions = {
  values: readonly AxisTickValue[]
  labels: readonly string[]
  plotWidth: number
  minimumTickGap?: number
  measureLabelWidth?: (label: string) => number
}

/**
 * Default horizontal breathing room kept between two rendered tick labels.
 */
const DEFAULT_MINIMUM_TICK_GAP = 8

/**
 * Select visible X-axis tick values so labels stay readable, the first and last
 * values always remain visible, and any unavoidable wider gaps are pushed away
 * from the chart edges.
 */
export function selectVisibleXAxisTicks({
  values,
  labels,
  plotWidth,
  minimumTickGap = DEFAULT_MINIMUM_TICK_GAP,
  measureLabelWidth = measureLabelWidthByCharacterCount,
}: SelectVisibleXAxisTicksOptions): AxisTickValue[] {
  if (values.length <= 2) {
    return [...values]
  }

  const minimumStep = estimateMinimumTickStep(labels, plotWidth, minimumTickGap, measureLabelWidth)
  const visibleIndices = buildVisibleTickIndices(values.length, minimumStep)
  return visibleIndices.map((index) => values[index]!)
}

/**
 * Estimate the minimum index distance required between rendered labels so they
 * can fit inside the available plot width without overlapping.
 */
export function estimateMinimumTickStep(
  labels: readonly string[],
  plotWidth: number,
  minimumTickGap: number,
  measureLabelWidth: (label: string) => number,
): number {
  if (labels.length <= 1) {
    return 1
  }

  const widestLabel = labels.reduce((maxWidth, label) => Math.max(maxWidth, measureLabelWidth(label)), 0)
  const slotWidth = plotWidth / Math.max(labels.length - 1, 1)
  return Math.max(1, Math.ceil((widestLabel + minimumTickGap) / Math.max(slotWidth, 1)))
}

/**
 * Build the visible tick indices for a given point count and minimum step.
 *
 * The selector keeps the first and last tick, shows as many intermediate ticks
 * as possible, and places any wider fallback gaps near the center so the edges
 * stay visually balanced.
 */
export function buildVisibleTickIndices(pointCount: number, minimumStep: number): number[] {
  if (pointCount <= 0) {
    return []
  }

  if (pointCount <= 2) {
    return Array.from({length: pointCount}, (_, index) => index)
  }

  const safeMinimumStep = Math.max(1, Math.floor(minimumStep))
  if (safeMinimumStep === 1) {
    return Array.from({length: pointCount}, (_, index) => index)
  }

  const gapCount = Math.floor((pointCount - 1) / safeMinimumStep)
  if (gapCount === 0) {
    return [0, pointCount - 1]
  }

  const gaps = Array.from({length: gapCount}, () => safeMinimumStep)
  const remainder = (pointCount - 1) - safeMinimumStep * gapCount
  for (const gapIndex of getCenteredGapOrder(gapCount).slice(0, remainder)) {
    const gap = gaps[gapIndex]
    if (gap !== undefined) {
      gaps[gapIndex] = gap + 1
    }
  }

  const visibleIndices = [0]
  for (const gap of gaps) {
    visibleIndices.push(visibleIndices[visibleIndices.length - 1]! + gap)
  }

  return visibleIndices
}

/**
 * Order gap positions from the center outward so any larger fallback gaps land
 * away from the chart edges.
 */
function getCenteredGapOrder(gapCount: number): number[] {
  const center = (gapCount - 1) / 2
  return Array.from({length: gapCount}, (_, index) => index).sort(
    (left, right) => Math.abs(left - center) - Math.abs(right - center) || left - right,
  )
}

/**
 * Lightweight default width estimate used by tests and non-DOM callers.
 */
function measureLabelWidthByCharacterCount(label: string): number {
  return label.length
}
