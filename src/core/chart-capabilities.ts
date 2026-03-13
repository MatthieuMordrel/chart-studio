import type {ChartType} from './types.js'
import {CHART_TYPE_ORDER} from './config-utils.js'

/**
 * X-axis kinds understood by chart-studio when validating chart types.
 */
export type ChartAxisType = 'date' | 'category' | 'boolean'

/**
 * Declarative chart-type capability matrix.
 *
 * Centralizing these rules keeps UI controls and state validation aligned as
 * more chart types are added later.
 */
export type ChartTypeCapabilities = {
  supportedXAxisTypes: readonly ChartAxisType[]
  supportsGrouping: boolean
  supportsTimeBucketing: boolean
}

/**
 * Capabilities for each supported chart type.
 */
export const CHART_TYPE_CONFIG = {
  bar: {
    supportedXAxisTypes: ['date', 'category', 'boolean'],
    supportsGrouping: true,
    supportsTimeBucketing: true,
  },
  line: {
    supportedXAxisTypes: ['date'],
    supportsGrouping: true,
    supportsTimeBucketing: true,
  },
  area: {
    supportedXAxisTypes: ['date'],
    supportsGrouping: true,
    supportsTimeBucketing: true,
  },
  'percent-area': {
    supportedXAxisTypes: ['date'],
    supportsGrouping: true,
    supportsTimeBucketing: true,
  },
  pie: {
    supportedXAxisTypes: ['category', 'boolean'],
    supportsGrouping: false,
    supportsTimeBucketing: false,
  },
  donut: {
    supportedXAxisTypes: ['category', 'boolean'],
    supportsGrouping: false,
    supportsTimeBucketing: false,
  },
} as const satisfies Record<ChartType, ChartTypeCapabilities>

type ChartTypeAvailability = {
  hasGroupBy: boolean
  xAxisType: ChartAxisType | null
}

/**
 * Whether a chart type can represent the current chart state.
 */
export function isChartTypeAvailable(
  chartType: ChartType,
  availability: ChartTypeAvailability,
): boolean {
  const {hasGroupBy, xAxisType} = availability
  if (xAxisType === null) return false

  const capabilities = CHART_TYPE_CONFIG[chartType]
  const supportedXAxisTypes: readonly ChartAxisType[] = capabilities.supportedXAxisTypes
  if (!supportedXAxisTypes.includes(xAxisType)) {
    return false
  }

  if (hasGroupBy && !capabilities.supportsGrouping) {
    return false
  }

  return true
}

/**
 * Chart types valid for the current axis + feature combination.
 */
export function getAvailableChartTypes(availability: ChartTypeAvailability): ChartType[] {
  return CHART_TYPE_ORDER.filter((chartType) => isChartTypeAvailable(chartType, availability))
}
