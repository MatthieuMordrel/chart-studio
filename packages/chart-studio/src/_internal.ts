export {CHART_TYPE_CONFIG} from './core/chart-capabilities.js'
export {getSeriesColor, buildColorMap} from './core/colors.js'
export {
  DATA_LABEL_DEFAULTS,
  resolveShowDataLabels,
  type DataLabelDefaults,
  type DataLabelStyle,
  type DataLabelPosition,
} from './core/data-label-defaults.js'
export {
  DATE_RANGE_PRESETS,
  autoFilterForBucket,
  resolvePresetFilter,
  getPresetLabel,
  type DateRangePreset,
} from './core/date-range-presets.js'
export {computeDateRange, filterByDateRange} from './core/date-utils.js'
export {
  createNumericRange,
  formatChartValue,
  formatNumericSurfaceValue,
  formatTimeBucketLabel,
  shouldAllowDecimalTicks,
  type ChartValueSurface,
  type NumericRange,
} from './core/formatting.js'
export {
  DEFAULT_METRIC,
  getAggregateMetricLabel,
  getMetricLabel,
  isAggregateMetric,
  isSameMetric,
} from './core/metric-utils.js'
export {applyFilters} from './core/pipeline.js'
