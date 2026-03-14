import type {ChartType, TimeBucket} from './types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Position of the data label relative to the data point (cartesian charts only). */
export type DataLabelPosition = 'top' | 'center'

/** Visual style applied to cartesian data labels. */
export type DataLabelStyle = {
  /** Where the label sits relative to the data point. */
  position: DataLabelPosition
  /** Pixel distance from the data point. */
  offset: number
}

/**
 * Declarative data-label configuration for a single chart type.
 *
 * `showByDefault` controls whether data labels appear when the consumer
 * uses the `'auto'` mode (which is the default):
 * - `true`  — always show data labels
 * - `false` — never show data labels
 * - `Partial<Record<TimeBucket, boolean>>` — show only for listed time buckets;
 *   non-time-series charts and unlisted buckets fall back to `false`.
 */
export type DataLabelDefaults = {
  showByDefault: boolean | Partial<Record<TimeBucket, boolean>>
  style: DataLabelStyle
}

// ---------------------------------------------------------------------------
// Shared style presets
// ---------------------------------------------------------------------------

const STYLE_TOP: DataLabelStyle = {position: 'top', offset: 8}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default data-label behaviour for each chart type.
 *
 * This is the single source of truth consumed by `<ChartCanvas>` when the
 * consumer leaves `showDataLabels` at its default `'auto'` value.  Edit
 * this object to change which charts show labels and how they look.
 */
export const DATA_LABEL_DEFAULTS = {
  bar:            {showByDefault: true, style: STYLE_TOP},
  'grouped-bar':  {showByDefault: true, style: STYLE_TOP},
  'percent-bar':  {showByDefault: true, style: STYLE_TOP},
  line:           {showByDefault: {day: false, week: false, month: false, quarter: true, year: true}, style: STYLE_TOP},
  area:           {showByDefault: {day: false, week: false, month: false, quarter: false, year: false}, style: STYLE_TOP},
  'percent-area': {showByDefault: false, style: STYLE_TOP},
  pie:            {showByDefault: true, style: STYLE_TOP},
  donut:          {showByDefault: true, style: STYLE_TOP},
} as const satisfies Record<ChartType, DataLabelDefaults>

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve whether data labels should be shown for the current chart state.
 *
 * When the consumer passes `true` or `false`, their explicit choice wins.
 * When `'auto'` (the default), the declarative config in
 * {@link DATA_LABEL_DEFAULTS} decides based on chart type and — for
 * time-series charts — the active time bucket.
 */
export function resolveShowDataLabels(
  chartType: ChartType,
  timeBucket: TimeBucket | undefined,
  override: boolean | 'auto',
): boolean {
  if (override !== 'auto') return override

  const {showByDefault} = DATA_LABEL_DEFAULTS[chartType]
  if (typeof showByDefault === 'boolean') return showByDefault
  return timeBucket ? (showByDefault[timeBucket] ?? false) : false
}
