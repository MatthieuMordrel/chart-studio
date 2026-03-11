import {describe, expect, it} from 'vitest'
import {createNumericRange, formatChartValue, formatTimeBucketLabel, shouldAllowDecimalTicks} from './formatting.js'

describe('formatting', () => {
  it('uses short numeric defaults on axes and clearer numeric defaults in tooltips', () => {
    const numericRange = createNumericRange([3_412_442, 1_200_000])
    const column = {type: 'number' as const, format: undefined}

    expect(formatChartValue(3_412_442, {column, surface: 'axis', numericRange})).toBe('3.4M')
    expect(formatChartValue(3_412_442, {column, surface: 'tooltip', numericRange})).toBe('3,412,442')
  })

  it('uses percent-style defaults when the visible numeric range stays between -1 and 1', () => {
    const numericRange = createNumericRange([0.2778, 0.1032])
    const column = {type: 'number' as const, format: undefined}

    expect(formatChartValue(0.2778, {column, surface: 'axis', numericRange})).toBe('27.8%')
    expect(formatChartValue(0.2778, {column, surface: 'tooltip', numericRange})).toBe('27.78%')
  })

  it('keeps decimal ticks for fractional percentage-like values', () => {
    expect(shouldAllowDecimalTicks([0.571, 0.48, 0.513])).toBe(true)
  })

  it('keeps integer-only ticks for whole-number metrics', () => {
    expect(shouldAllowDecimalTicks([12, 18, 24])).toBe(false)
  })

  it('lets explicit intl format objects override the shared defaults', () => {
    const column = {
      type: 'number' as const,
      format: {
        kind: 'number' as const,
        options: {
          style: 'currency' as const,
          currency: 'EUR',
          maximumFractionDigits: 0,
        },
      },
    }

    expect(formatChartValue(1_250_000, {column, surface: 'axis'})).toBe('€1,250,000')
    expect(formatChartValue(1_250_000, {column, surface: 'tooltip'})).toBe('€1,250,000')
  })

  it('lets formatter override the shared defaults even when no source row is available', () => {
    const column = {
      type: 'number' as const,
      formatter: (value: unknown) => value == null ? 'Missing' : `${String(value)} per seat`,
    }

    expect(formatChartValue(1_200, {column, surface: 'axis'})).toBe('1200 per seat')
    expect(formatChartValue(null, {column, surface: 'tooltip'})).toBe('Missing')
  })

  it('formats duration values compactly when the schema declares the input unit', () => {
    const minuteColumn = {
      type: 'number' as const,
      format: {kind: 'duration' as const, unit: 'minutes' as const},
    }
    const secondColumn = {
      type: 'number' as const,
      format: {kind: 'duration' as const, unit: 'seconds' as const},
    }
    const hourColumn = {
      type: 'number' as const,
      format: {kind: 'duration' as const, unit: 'hours' as const},
    }

    expect(formatChartValue(36, {column: minuteColumn, surface: 'axis'})).toBe('36m')
    expect(formatChartValue(96, {column: minuteColumn, surface: 'tooltip'})).toBe('1h36m')
    expect(formatChartValue(1_500, {column: minuteColumn, surface: 'data-label'})).toBe('1d1h')
    expect(formatChartValue(96, {column: secondColumn, surface: 'axis'})).toBe('1m36s')
    expect(formatChartValue(1.5, {column: hourColumn, surface: 'tooltip'})).toBe('1h30m')
  })

  it('formats time buckets differently for axes and tooltips', () => {
    expect(formatTimeBucketLabel('2026-03', 'month', 'axis')).toBe('Mar 26')
    expect(formatTimeBucketLabel('2026-03-11', 'day', 'tooltip')).toBe('Mar 11, 26')
    expect(formatTimeBucketLabel('2026-Q1', 'quarter', 'axis')).toBe('Q1 26')
  })
})
