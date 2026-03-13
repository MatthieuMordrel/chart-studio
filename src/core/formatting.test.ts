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

/**
 * Data-label formatting tests for every chart rendering engine.
 *
 * Each test exercises the exact path the LabelList formatter takes at runtime:
 * the value Recharts passes into the formatter + the column/range config the
 * renderer provides.
 *
 * For standard charts (bar, line, area, pie), LabelList passes the raw data
 * value and the renderer uses the original column config — these work fine.
 *
 * For percent-stacked charts (percent-bar, percent-area), stackOffset="expand"
 * normalizes values to 0–1.  The renderer's valueAccessor extracts the segment
 * proportion from Recharts' stacked [lower, upper] entry, so the formatter
 * receives a 0–1 value and format:'percent' correctly displays it
 * (e.g. 6/18 ≈ 0.333 → "33.3%").
 *
 * Realistic fixture — mirrors the Kitchen Sink / Home Cooking playground
 * with count metric grouped by cuisine:
 *
 *   Last time bucket: Italian=6, Mexican=5, Asian=3, American=4 (total=18)
 *   Large-value bucket: north=6400, south=5500, east=3200 (total=15100)
 */
describe('data label formatting per chart type', () => {
  // --- shared fixtures ---------------------------------------------------
  const allRawValues = [6400, 5500, 3200, 4800, 7200, 2100]
  const rawRange = createNumericRange(allRawValues)
  const defaultColumn = {type: 'number' as const, format: undefined}

  // Percent-stacked config — what the renderers currently pass to the formatter
  const percentColumn = {type: 'number' as const, format: 'percent' as const}
  const percentRange: {min: number; max: number} = {min: 0, max: 1}

  // --- bar / line / area (raw values, auto-format) -----------------------

  describe('bar chart — raw values, auto-detected compact format', () => {
    it('formats large values with compact notation on data-label surface', () => {
      expect(formatChartValue(6400, {column: defaultColumn, surface: 'data-label', numericRange: rawRange})).toBe('6.4K')
      expect(formatChartValue(2100, {column: defaultColumn, surface: 'data-label', numericRange: rawRange})).toBe('2.1K')
    })

    it('shows full precision on tooltip surface', () => {
      expect(formatChartValue(6400, {column: defaultColumn, surface: 'tooltip', numericRange: rawRange})).toBe('6,400')
      expect(formatChartValue(5500, {column: defaultColumn, surface: 'tooltip', numericRange: rawRange})).toBe('5,500')
    })
  })

  describe('line chart — raw values, small range', () => {
    const smallValues = [12, 47, 83]
    const smallRange = createNumericRange(smallValues)

    it('formats small raw values as plain numbers on data-label surface', () => {
      expect(formatChartValue(47, {column: defaultColumn, surface: 'data-label', numericRange: smallRange})).toBe('47')
    })
  })

  describe('area chart — raw values, same as bar/line', () => {
    it('uses same formatting pipeline as bar chart data labels', () => {
      expect(formatChartValue(3200, {column: defaultColumn, surface: 'data-label', numericRange: rawRange})).toBe('3.2K')
    })
  })

  // --- percent-bar / percent-area (100% stacked) -------------------------
  //
  // These tests reproduce the actual broken runtime path.
  //
  // At runtime, Recharts' LabelList passes the RAW data value to the
  // formatter, while the renderer wraps it with format:'percent' and
  // numericRange:{0,1}.  Intl.NumberFormat({ style:'percent' }) then
  // multiplies the raw value by 100, producing absurd labels.
  //
  // Home Cooking fixture:
  //   Italian=4  → formatter gets 4 → Intl says "400%"   (broken)
  //   Mexican=3  → formatter gets 3 → Intl says "300%"   (broken)
  //   Asian=6    → formatter gets 6 → Intl says "600%"   (broken)
  //   American=5 → formatter gets 5 → Intl says "500%"   (broken)

  describe('percent-bar chart — tooltip/axis (normalized 0-1 from Recharts, works)', () => {
    it('formats normalized values as clean percentages on axis', () => {
      const result = formatChartValue(0.4238, {column: percentColumn, surface: 'axis', numericRange: percentRange})
      expect(result).toBe('42.4%')
    })

    it('formats normalized values as clean percentages on tooltip', () => {
      const result = formatChartValue(0.4238, {column: percentColumn, surface: 'tooltip', numericRange: percentRange})
      expect(result).toBe('42.38%')
    })
  })

  describe('percent-bar chart — data labels (normalized proportions from valueAccessor)', () => {
    // With stackOffset="expand", Recharts normalizes values to 0–1.
    // The renderer's percentStackedValueAccessor extracts the segment
    // proportion (upper - lower) so the formatter receives 0.333 for
    // "6 out of 18", not the raw count 6.
    //
    // Kitchen Sink / Home Cooking last time bucket (count by cuisine):
    //   Italian=6, Mexican=5, Asian=3, American=4  (total=18)

    it('Italian=6 out of 18 should display ~33.3%', () => {
      const label = formatChartValue(6 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('33.3%')
    })

    it('Mexican=5 out of 18 should display ~27.8%', () => {
      const label = formatChartValue(5 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('27.8%')
    })

    it('Asian=3 out of 18 should display ~16.7%', () => {
      const label = formatChartValue(3 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('16.7%')
    })

    it('American=4 out of 18 should display ~22.2%', () => {
      const label = formatChartValue(4 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('22.2%')
    })
  })

  describe('percent-bar chart — data labels with large values', () => {
    // Same normalization at a larger scale: north=6400/15100 ≈ 0.4238 → "42.4%"

    it('north=6400 out of 15100 should display ~42.4%', () => {
      const label = formatChartValue(6400 / 15100, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('42.4%')
    })

    it('east=3200 out of 15100 should display ~21.2%', () => {
      const label = formatChartValue(3200 / 15100, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('21.2%')
    })
  })

  describe('percent-area chart — normalized proportions, same as percent-bar', () => {
    it('Italian=6 out of 18 should display ~33.3%', () => {
      const label = formatChartValue(6 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('33.3%')
    })

    it('American=4 out of 18 should display ~22.2%', () => {
      const label = formatChartValue(4 / 18, {column: percentColumn, surface: 'data-label', numericRange: percentRange})
      expect(label).toBe('22.2%')
    })
  })

  describe('percent-bar chart — segment proportions must sum to 100%', () => {
    // Italian=6, Mexican=5, Asian=3, American=4 (total=18)
    // The renderer normalizes each to its proportion: 6/18 + 5/18 + 3/18 + 4/18 = 1.0

    it('all segment labels should sum to 100%', () => {
      const rawCounts = [6, 5, 3, 4]
      const total = rawCounts.reduce((a, b) => a + b, 0)
      const labels = rawCounts.map((v) =>
        formatChartValue(v / total, {column: percentColumn, surface: 'data-label', numericRange: percentRange}),
      )
      const sum = labels.reduce((acc, label) => acc + parseFloat(label), 0)
      expect(sum).toBeCloseTo(100, 0)
    })
  })

  describe('percent-area chart — segment proportions must sum to 100%', () => {
    it('all segment labels should sum to 100%', () => {
      const rawCounts = [6, 5, 3, 4]
      const total = rawCounts.reduce((a, b) => a + b, 0)
      const labels = rawCounts.map((v) =>
        formatChartValue(v / total, {column: percentColumn, surface: 'data-label', numericRange: percentRange}),
      )
      const sum = labels.reduce((acc, label) => acc + parseFloat(label), 0)
      expect(sum).toBeCloseTo(100, 0)
    })
  })

  // --- pie / donut (raw values, standard column) -------------------------

  describe('pie chart — raw values, standard column', () => {
    it('formats data labels as compact values', () => {
      expect(formatChartValue(6400, {column: defaultColumn, surface: 'data-label', numericRange: rawRange})).toBe('6.4K')
    })
  })
})
