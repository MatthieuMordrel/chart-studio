/**
 * Chart canvas — renders the actual recharts chart based on the current state.
 *
 * Supports: bar, grouped-bar, percent-bar, line, area, percent-area (time-series), bar, grouped-bar, percent-bar, pie, donut (categorical).
 * Automatically switches between chart types based on the chart instance state.
 */

import {type ComponentType, type ReactNode} from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createNumericRange,
  formatChartValue,
  formatTimeBucketLabel,
  getSeriesColor,
  resolveShowDataLabels,
  shouldAllowDecimalTicks,
  useElementSize,
  useRootCssVariable,
  DATA_LABEL_DEFAULTS,
  type ChartValueSurface,
  type DataLabelStyle,
  type NumericRange,
} from '@matthieumordrel/chart-studio/_internal'
import type {ChartColumn} from '@matthieumordrel/chart-studio'
import {useChartContext} from './chart-context.js'
import {selectVisibleXAxisTicks} from './chart-axis-ticks.js'
import {getPercentStackedDisplayValue} from './percent-stacked.js'

/**
 * Estimates the pixel width the YAxis needs so no label is ever clipped.
 * Considers both the visible range and the likely "nice" axis boundary Recharts
 * may choose above it, then measures the widest formatted label and adds a
 * small gutter for tick spacing.
 */
function estimateYAxisWidth(
  numericRange: NumericRange | null,
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format' | 'formatter'>,
): number {
  const labels = getYAxisLabelCandidates(numericRange, valueColumn)
  const widestLabel = labels.reduce((maxWidth, label) => Math.max(maxWidth, measureAxisLabelWidth(label)), 0)
  return Math.max(MIN_Y_AXIS_WIDTH, Math.ceil(widestLabel + Y_AXIS_WIDTH_GUTTER))
}

/**
 * Font used by the shared chart axis ticks (`text-xs` in the default theme).
 */
const AXIS_TICK_FONT = '12px system-ui, sans-serif'

/**
 * Canvas measurement can be unavailable in some environments, so keep a
 * slightly generous character-width fallback.
 */
const FALLBACK_AXIS_CHARACTER_WIDTH = 8

/**
 * Minimum width so short numeric axes still have breathing room.
 */
const MIN_Y_AXIS_WIDTH = 48

/**
 * Extra space for tick margin plus a small anti-clipping buffer.
 */
const Y_AXIS_WIDTH_GUTTER = 18

/**
 * Horizontal breathing room kept between two visible X-axis labels.
 */
const X_AXIS_MINIMUM_TICK_GAP = 8

/**
 * Build a small set of realistic axis labels and size for the widest one.
 * This catches cases where the chart data tops out below the rounded axis
 * tick, such as `950` minutes producing a `1000` minute top tick.
 */
function getYAxisLabelCandidates(
  numericRange: NumericRange | null,
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format'>,
): string[] {
  const candidates = getYAxisCandidateValues(numericRange)
  return candidates.map((value) =>
    formatChartValue(value, {
      column: valueColumn,
      surface: 'axis',
      numericRange,
    }),
  )
}

/**
 * Include the visible extrema plus rounded axis boundaries so the width
 * estimate matches what the axis is likely to render.
 */
function getYAxisCandidateValues(numericRange: NumericRange | null): number[] {
  if (!numericRange) {
    return [0]
  }

  const maxAbs = Math.max(Math.abs(numericRange.min), Math.abs(numericRange.max))
  const niceMaxAbs = getNiceAxisBoundary(maxAbs)
  const values = new Set<number>([0, numericRange.min, numericRange.max, maxAbs, niceMaxAbs])

  if (numericRange.min < 0) {
    values.add(-niceMaxAbs)
  }

  return Array.from(values)
}

/**
 * Approximate the rounded outer tick value chart libraries tend to choose for
 * a human-friendly numeric axis.
 */
function getNiceAxisBoundary(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const fraction = value / magnitude

  if (fraction <= 1) return magnitude
  if (fraction <= 2) return 2 * magnitude
  if (fraction <= 5) return 5 * magnitude
  return 10 * magnitude
}

/**
 * Measure axis text width in the browser and fall back to a safe character
 * estimate in non-DOM environments.
 */
function measureAxisLabelWidth(label: string): number {
  if (typeof document === 'undefined') {
    return label.length * FALLBACK_AXIS_CHARACTER_WIDTH
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return label.length * FALLBACK_AXIS_CHARACTER_WIDTH
  }

  context.font = AXIS_TICK_FONT
  return context.measureText(label).width
}

/**
 * Approximate the drawable X-axis width after margins, Y-axis labels, and axis
 * padding have taken their share of the SVG width.
 */
function getCartesianPlotWidth(totalWidth: number, yAxisWidth: number): number {
  return Math.max(
    1,
    totalWidth
      - yAxisWidth
      - CARTESIAN_BASE_MARGIN.left
      - CARTESIAN_BASE_MARGIN.right
      - CARTESIAN_X_AXIS_PADDING.left
      - CARTESIAN_X_AXIS_PADDING.right,
  )
}

/**
 * Resolve the raw categorical tick value used by Recharts for one transformed
 * pipeline point.
 */
function getXAxisTickValue(point: Record<string, string | number | null>): string | number {
  return typeof point['xKey'] === 'string' || typeof point['xKey'] === 'number'
    ? point['xKey']
    : String(point['xLabel'])
}

/**
 * Props for ChartCanvas.
 *
 * @property height - Chart height in pixels (default: 300)
 * @property className - Additional CSS classes
 * @property showDataLabels - Control data label visibility: `true`/`false` for explicit control,
 *   or `'auto'` (default) to let {@link DATA_LABEL_DEFAULTS} decide per chart type and time bucket.
 */
type ChartCanvasProps = {
  /** Chart height in pixels (default: 300) */
  height?: number
  /** Additional CSS classes */
  className?: string
  /**
   * Control data label visibility.
   * - `true`  — always show
   * - `false` — always hide
   * - `'auto'` — resolved from {@link DATA_LABEL_DEFAULTS} per chart type and time bucket
   */
  showDataLabels?: boolean | 'auto'
}

/**
 * Important recharts styling — mirrors shadcn's ChartContainer CSS.
 * Ensures proper text colors, grid lines, and outline handling.
 */
const RECHARTS_STYLES = [
  'text-xs',
  '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
  "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
  '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
  '[&_.recharts-layer]:outline-hidden',
  '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted',
  "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
  '[&_.recharts-sector]:outline-hidden',
  '[&_.recharts-surface]:outline-hidden',
].join(' ')

/**
 * Reserve enough top padding for the tallest bar/point label plus its offset so
 * data labels never clip against the SVG edge.
 */
const CARTESIAN_BASE_MARGIN = {top: 4, right: 8, left: 0, bottom: 0} as const

/**
 * Vertical headroom required for one top-positioned cartesian data label.
 */
const CARTESIAN_DATA_LABEL_TOP_CLEARANCE = 28

/**
 * Expand the cartesian chart margin only when top-positioned data labels are
 * enabled.
 */
function getCartesianChartMargin(showDataLabels: boolean) {
  return showDataLabels
    ? {
        ...CARTESIAN_BASE_MARGIN,
        top: CARTESIAN_BASE_MARGIN.top + CARTESIAN_DATA_LABEL_TOP_CLEARANCE,
      }
    : CARTESIAN_BASE_MARGIN
}

/**
 * Keep the first and last rendered values from hugging the chart edges.
 */
const CARTESIAN_X_AXIS_PADDING = {left: 12, right: 12} as const

/**
 * Hook that measures a container's width using ResizeObserver.
 * Avoids the ResponsiveContainer issues with flexbox/grid layouts.
 */
function useContainerWidth() {
  const {ref, size} = useElementSize<HTMLDivElement>()

  return {ref, width: size.width}
}

/**
 * Read the resolved `--cs-radius` CSS variable and convert it to a pixel value
 * suitable for recharts bar corner radius (roughly half the theme radius).
 * Observes style attribute mutations on the root element so the chart reacts
 * when the consumer changes `--radius` at runtime.
 */
function useCssBarRadius(): number {
  const radiusToken = useRootCssVariable('--cs-radius', '0.5')

  if (typeof document === 'undefined') {
    return 4
  }

  const rem = parseFloat(radiusToken)

  if (Number.isNaN(rem)) {
    return 4
  }

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.max(0, Math.round((rem * rootFontSize) / 2))
}

/** Renders the appropriate recharts chart based on the chart instance state.
 * @param height - Chart height in pixels (default: 300)
 * @param className - Additional CSS classes
 * @param showDataLabels - Control data label visibility: `true`/`false` for explicit control, or `'auto'` (default) to let {@link DATA_LABEL_DEFAULTS} decide per chart type and time bucket.
 */
export function ChartCanvas({height = 300, className, showDataLabels = 'auto'}: ChartCanvasProps) {
  const chart = useChartContext()
  const {chartType, transformedData, series, connectNulls} = chart
  const timeBucket = chart.isTimeSeries ? chart.timeBucket : undefined
  const resolvedShowDataLabels = resolveShowDataLabels(chartType, timeBucket, showDataLabels)
  const dataLabelStyle = DATA_LABEL_DEFAULTS[chartType].style
  const {ref, width} = useContainerWidth()
  const xColumn = chart.columns.find((column) => column.id === chart.xAxisId) ?? null
  const aggregateMetric = chart.metric.kind === 'aggregate' ? chart.metric : null
  const metricColumn =
    aggregateMetric
      ? chart.columns.find((column) => column.id === aggregateMetric.columnId && column.type === 'number')
      : null
  const valueColumn: Pick<ChartColumn<any>, 'type' | 'format'> = metricColumn ?? {type: 'number', format: undefined}
  const numericValues = transformedData.flatMap((point) =>
    series.flatMap((seriesItem) => {
      const value = point[seriesItem.dataKey]
      return typeof value === 'number' ? [value] : []
    }),
  )
  const valueRange = createNumericRange(numericValues)
  const allowDecimalTicks = shouldAllowDecimalTicks(numericValues)

  if (transformedData.length === 0) {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-center text-sm text-muted-foreground ${className ?? ''}`}
        style={{height}}
      >
        No data available
      </div>
    )
  }

  if (chartType === 'table') {
    return (
      <div ref={ref}>
        <TableRenderer
          data={transformedData}
          series={series}
          height={height}
          className={className}
          valueColumn={valueColumn}
          valueRange={valueRange}
          xColumn={xColumn}
          timeBucket={timeBucket}
        />
      </div>
    )
  }

  return (
    <div ref={ref} className={`${RECHARTS_STYLES} ${className ?? ''}`} style={{height}}>
      {width > 0 &&
        (chartType === 'pie' || chartType === 'donut' ? (
          <PieChartRenderer
            data={transformedData}
            series={series}
            innerRadius={chartType === 'donut'}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : chartType === 'line' ? (
          <LineChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : chartType === 'percent-area' ? (
          <PercentAreaChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : chartType === 'area' ? (
          <AreaChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : chartType === 'grouped-bar' ? (
          <GroupedBarChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : chartType === 'percent-bar' ? (
          <PercentBarChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ) : (
          <BarChartRenderer
            data={transformedData}
            series={series}
            width={width}
            height={height}
            valueColumn={valueColumn}
            valueRange={valueRange}
            allowDecimalTicks={allowDecimalTicks}
            xColumn={xColumn}
            timeBucket={timeBucket}
            showDataLabels={resolvedShowDataLabels}
            dataLabelStyle={dataLabelStyle}
            connectNulls={connectNulls}
          />
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart type renderers
// ---------------------------------------------------------------------------

type SeriesItem = {dataKey: string; label: string; color: string}

/**
 * Percent-stacked charts use stackOffset="expand" which normalizes values to
 * the 0–1 range.  These constants let the shared formatting pipeline treat
 * them as proper percentages via Intl.NumberFormat({ style: 'percent' }).
 */
const PERCENT_STACKED_COLUMN: Pick<ChartColumn<any>, 'type' | 'format'> = {type: 'number', format: 'percent'}
const PERCENT_STACKED_RANGE: NumericRange = {min: 0, max: 1}


type RendererProps = {
  data: Record<string, string | number | null>[]
  series: SeriesItem[]
  width: number
  height: number
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format' | 'formatter'>
  valueRange: NumericRange | null
  allowDecimalTicks: boolean
  xColumn: ChartColumn<any> | null
  timeBucket?: 'day' | 'week' | 'month' | 'quarter' | 'year'
  showDataLabels: boolean
  dataLabelStyle: DataLabelStyle
  connectNulls: boolean
}

/**
 * Minimal interface covering the props we pass to any recharts Cartesian root
 * (BarChart, LineChart, AreaChart). Keeps CartesianChartShell type-safe without
 * coupling it to a specific chart component.
 */
type CartesianChartComponent = ComponentType<{
  data: Record<string, string | number | null>[]
  width: number
  height: number
  margin?: {top?: number; right?: number; bottom?: number; left?: number}
  children?: ReactNode
}>

type CartesianShellProps = RendererProps & {
  /** The recharts root component (BarChart, LineChart, AreaChart). */
  Chart: CartesianChartComponent
  /** Renders each series element (Bar, Line, Area, …) inside the chart. */
  renderSeries: (s: SeriesItem) => ReactNode
  /** Optional tooltip item sorter for charts where visual series order matters. */
  tooltipItemSorter?: (item: {dataKey?: unknown; name?: unknown}) => number
}

function createStackedTooltipItemSorter(series: SeriesItem[]) {
  const order = new Map(series.map((s, index) => [s.dataKey, index]))
  return (item: {dataKey?: unknown; name?: unknown}) => {
    const dataKey = typeof item.dataKey === 'string' ? item.dataKey : typeof item.name === 'string' ? item.name : ''
    return -(order.get(dataKey) ?? -1)
  }
}

/**
 * Remove data points where every series value is null.
 *
 * Stacked charts (percent-area, percent-bar) cannot represent null in the
 * stack — d3's stack layout coerces missing values to 0 which distorts the
 * visual.  Dropping entirely-empty buckets lets `connectNulls` bridge the
 * gap while keeping partially-populated buckets intact (null → 0 is
 * acceptable there because the segment genuinely contributes nothing to the
 * total).
 */
function filterAllNullPoints(
  data: Record<string, string | number | null>[],
  series: SeriesItem[],
): Record<string, string | number | null>[] {
  return data.filter((point) => series.some((s) => point[s.dataKey] != null))
}

/**
 * Shared shell for all Cartesian chart types.
 * Owns the grid, axes, tooltip, and legend — the only things that change
 * per chart type are the root component and the series element.
 */
function CartesianChartShell({
  data,
  series,
  width,
  height,
  valueColumn,
  valueRange,
  allowDecimalTicks,
  xColumn,
  timeBucket,
  showDataLabels,
  Chart,
  renderSeries,
  tooltipItemSorter,
}: CartesianShellProps) {
  const yAxisWidth = estimateYAxisWidth(valueRange, valueColumn)
  const xAxisTickValues = selectVisibleXAxisTicks({
    values: data.map(getXAxisTickValue),
    labels: data.map((point) => formatXAxisValue(getXAxisTickValue(point), xColumn, timeBucket, 'axis')),
    plotWidth: getCartesianPlotWidth(width, yAxisWidth),
    minimumTickGap: X_AXIS_MINIMUM_TICK_GAP,
    measureLabelWidth: measureAxisLabelWidth,
  })
  return (
    <Chart data={data} width={width} height={height} margin={getCartesianChartMargin(showDataLabels)}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="xKey"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval={0}
        padding={CARTESIAN_X_AXIS_PADDING}
        ticks={xAxisTickValues}
        tickFormatter={(value) => formatXAxisValue(value, xColumn, timeBucket, 'axis')}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        allowDecimals={allowDecimalTicks}
        width={yAxisWidth}
        tickFormatter={(value) =>
          typeof value === 'number'
            ? formatChartValue(value, {
                column: valueColumn,
                surface: 'axis',
                numericRange: valueRange,
              })
            : String(value)
        }
      />
      <Tooltip
        itemSorter={tooltipItemSorter}
        formatter={(value) =>
          typeof value === 'number'
            ? formatChartValue(value, {
                column: valueColumn,
                surface: 'tooltip',
                numericRange: valueRange,
              })
            : value
        }
        labelFormatter={(label, payload) => formatTooltipLabel(label, payload, xColumn, timeBucket)}
      />
      {series.length > 1 && <Legend />}
      {series.map(renderSeries)}
    </Chart>
  )
}

/**
 * Resolve the most descriptive tooltip label from the transformed data point.
 */
function formatTooltipLabel(
  label: string | number,
  payload: ReadonlyArray<{payload?: Record<string, unknown>}> | undefined,
  xColumn: ChartColumn<any> | null,
  timeBucket: RendererProps['timeBucket'],
): string {
  if (!xColumn) {
    return String(label)
  }

  const point = payload?.[0]?.payload
  const rawXValue = typeof point?.['xKey'] === 'string' || typeof point?.['xKey'] === 'number'
    ? point['xKey']
    : label

  return formatXAxisValue(rawXValue, xColumn, timeBucket, 'tooltip')
}

/**
 * Format one X-axis value using the same shared column rules as the rest of the
 * chart while preserving the special bucket labels for inferred date buckets.
 */
function formatXAxisValue(
  value: string | number,
  xColumn: ChartColumn<any> | null,
  timeBucket: RendererProps['timeBucket'],
  surface: ChartValueSurface,
): string {
  if (!xColumn) {
    return String(value)
  }

  if (xColumn.type === 'date' && timeBucket && typeof value === 'string' && !xColumn.formatter) {
    return formatTimeBucketLabel(value, timeBucket, surface)
  }

  return formatChartValue(value, {
    column: xColumn,
    surface,
    timeBucket,
  })
}

function BarChartRenderer(props: RendererProps) {
  const {series, showDataLabels, dataLabelStyle, valueColumn, valueRange} = props
  const barRadius = useCssBarRadius()
  const isStacked = series.length > 1
  const topSeriesKey = series[series.length - 1]?.dataKey
  return (
    <CartesianChartShell
      {...props}
      Chart={BarChart}
      tooltipItemSorter={isStacked ? createStackedTooltipItemSorter(series) : undefined}
      renderSeries={(s) => {
        const isTop = !isStacked || s.dataKey === topSeriesKey
        return (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.label}
            fill={s.color}
            fillOpacity={0.7}
            radius={isTop ? [barRadius, barRadius, 0, 0] : 0}
            stackId={isStacked ? 'stack' : undefined}
          >
            {showDataLabels && (
              <LabelList
                position={dataLabelStyle.position}
                offset={dataLabelStyle.offset}
                formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
              />
            )}
          </Bar>
        )
      }}
    />
  )
}

function LineChartRenderer(props: RendererProps) {
  const {showDataLabels, dataLabelStyle, valueColumn, valueRange, connectNulls} = props
  return (
    <CartesianChartShell
      {...props}
      Chart={LineChart}
      renderSeries={(s) => (
        <Line
          key={s.dataKey}
          type="monotone"
          dataKey={s.dataKey}
          name={s.label}
          stroke={s.color}
          strokeWidth={2}
          dot={{r: 3}}
          activeDot={{r: 5}}
          connectNulls={connectNulls}
        >
          {showDataLabels && (
            <LabelList
              position={dataLabelStyle.position}
              offset={dataLabelStyle.offset}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Line>
      )}
    />
  )
}

function AreaChartRenderer(props: RendererProps) {
  const {showDataLabels, dataLabelStyle, valueColumn, valueRange, connectNulls} = props
  return (
    <CartesianChartShell
      {...props}
      Chart={AreaChart}
      renderSeries={(s) => (
        <Area
          key={s.dataKey}
          type="monotone"
          dataKey={s.dataKey}
          name={s.label}
          stroke={s.color}
          fill={s.color}
          fillOpacity={0.3}
          connectNulls={connectNulls}
        >
          {showDataLabels && (
            <LabelList
              position={dataLabelStyle.position}
              offset={dataLabelStyle.offset}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Area>
      )}
    />
  )
}

function PercentAreaChartRenderer(props: RendererProps) {
  const {series, data, xColumn, timeBucket, showDataLabels, dataLabelStyle, connectNulls, width, height} = props
  const seriesKeys = series.map((s) => s.dataKey)
  const tooltipItemSorter = createStackedTooltipItemSorter(series)

  const stackableData = filterAllNullPoints(data, series)
  const yAxisWidth = estimateYAxisWidth(PERCENT_STACKED_RANGE, PERCENT_STACKED_COLUMN)
  const xAxisTickValues = selectVisibleXAxisTicks({
    values: stackableData.map(getXAxisTickValue),
    labels: stackableData.map((point) => formatXAxisValue(getXAxisTickValue(point), xColumn, timeBucket, 'axis')),
    plotWidth: getCartesianPlotWidth(width, yAxisWidth),
    minimumTickGap: X_AXIS_MINIMUM_TICK_GAP,
    measureLabelWidth: measureAxisLabelWidth,
  })

  return (
    <AreaChart data={stackableData} width={width} height={height} margin={getCartesianChartMargin(showDataLabels)} stackOffset="expand">
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="xKey"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval={0}
        padding={CARTESIAN_X_AXIS_PADDING}
        ticks={xAxisTickValues}
        tickFormatter={(value) => formatXAxisValue(value, xColumn, timeBucket, 'axis')}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        tickFormatter={(value) =>
          typeof value === 'number'
            ? formatChartValue(value, {column: PERCENT_STACKED_COLUMN, surface: 'axis', numericRange: PERCENT_STACKED_RANGE})
            : String(value)
        }
        width={yAxisWidth}
      />
      <Tooltip
        itemSorter={tooltipItemSorter}
        formatter={(_value, _name, entry) => {
          const proportion = getPercentStackedDisplayValue(entry, String(entry.dataKey ?? ''), seriesKeys)
          if (proportion != null) {
            return formatChartValue(proportion, {column: PERCENT_STACKED_COLUMN, surface: 'tooltip', numericRange: PERCENT_STACKED_RANGE})
          }
          return typeof _value === 'number'
            ? formatChartValue(_value, {column: PERCENT_STACKED_COLUMN, surface: 'tooltip', numericRange: PERCENT_STACKED_RANGE})
            : _value
        }}
        labelFormatter={(label, payload) => formatTooltipLabel(label, payload, xColumn, timeBucket)}
      />
      {series.length > 1 && <Legend />}
      {series.map((s) => (
        <Area
          key={s.dataKey}
          type="monotone"
          dataKey={s.dataKey}
          name={s.label}
          stroke={s.color}
          fill={s.color}
          fillOpacity={0.3}
          stackId="percent"
          connectNulls={connectNulls}
        >
          {showDataLabels && (
            <LabelList
              position={dataLabelStyle.position}
              offset={dataLabelStyle.offset}
              valueAccessor={(entry) => getPercentStackedDisplayValue(entry, s.dataKey, seriesKeys) ?? 0}
              formatter={(value: unknown) => formatDataLabel(value, PERCENT_STACKED_COLUMN, PERCENT_STACKED_RANGE)}
            />
          )}
        </Area>
      ))}
    </AreaChart>
  )
}

function GroupedBarChartRenderer(props: RendererProps) {
  const {showDataLabels, dataLabelStyle, valueColumn, valueRange} = props
  const barRadius = useCssBarRadius()
  return (
    <CartesianChartShell
      {...props}
      Chart={BarChart}
      renderSeries={(s) => (
        <Bar
          key={s.dataKey}
          dataKey={s.dataKey}
          name={s.label}
          fill={s.color}
          fillOpacity={0.7}
          radius={[barRadius, barRadius, 0, 0]}
        >
          {showDataLabels && (
            <LabelList
              position={dataLabelStyle.position}
              offset={dataLabelStyle.offset}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Bar>
      )}
    />
  )
}

function PercentBarChartRenderer(props: RendererProps) {
  const {series, data, xColumn, timeBucket, showDataLabels, dataLabelStyle, width, height} = props
  const barRadius = useCssBarRadius()
  const topSeriesKey = series[series.length - 1]?.dataKey
  const seriesKeys = series.map((s) => s.dataKey)
  const tooltipItemSorter = createStackedTooltipItemSorter(series)

  const yAxisWidth = estimateYAxisWidth(PERCENT_STACKED_RANGE, PERCENT_STACKED_COLUMN)
  const xAxisTickValues = selectVisibleXAxisTicks({
    values: data.map(getXAxisTickValue),
    labels: data.map((point) => formatXAxisValue(getXAxisTickValue(point), xColumn, timeBucket, 'axis')),
    plotWidth: getCartesianPlotWidth(width, yAxisWidth),
    minimumTickGap: X_AXIS_MINIMUM_TICK_GAP,
    measureLabelWidth: measureAxisLabelWidth,
  })

  return (
    <BarChart data={data} width={width} height={height} margin={getCartesianChartMargin(showDataLabels)} stackOffset="expand">
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="xKey"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval={0}
        padding={CARTESIAN_X_AXIS_PADDING}
        ticks={xAxisTickValues}
        tickFormatter={(value) => formatXAxisValue(value, xColumn, timeBucket, 'axis')}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        tickFormatter={(value) =>
          typeof value === 'number'
            ? formatChartValue(value, {column: PERCENT_STACKED_COLUMN, surface: 'axis', numericRange: PERCENT_STACKED_RANGE})
            : String(value)
        }
        width={yAxisWidth}
      />
      <Tooltip
        itemSorter={tooltipItemSorter}
        formatter={(_value, _name, entry) => {
          const proportion = getPercentStackedDisplayValue(entry, String(entry.dataKey ?? ''), seriesKeys)
          if (proportion != null) {
            return formatChartValue(proportion, {column: PERCENT_STACKED_COLUMN, surface: 'tooltip', numericRange: PERCENT_STACKED_RANGE})
          }
          return typeof _value === 'number'
            ? formatChartValue(_value, {column: PERCENT_STACKED_COLUMN, surface: 'tooltip', numericRange: PERCENT_STACKED_RANGE})
            : _value
        }}
        labelFormatter={(label, payload) => formatTooltipLabel(label, payload, xColumn, timeBucket)}
      />
      {series.length > 1 && <Legend />}
      {series.map((s) => {
        const isTop = s.dataKey === topSeriesKey
        return (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.label}
            fill={s.color}
            fillOpacity={0.7}
            radius={isTop ? [barRadius, barRadius, 0, 0] : 0}
            stackId="percent"
          >
            {showDataLabels && (
              <LabelList
                position={dataLabelStyle.position}
                offset={dataLabelStyle.offset}
                valueAccessor={(entry) => getPercentStackedDisplayValue(entry, s.dataKey, seriesKeys) ?? 0}
                formatter={(value: unknown) => formatDataLabel(value, PERCENT_STACKED_COLUMN, PERCENT_STACKED_RANGE)}
              />
            )}
          </Bar>
        )
      })}
    </BarChart>
  )
}

type PieRendererProps = RendererProps & {innerRadius: boolean}

function PieChartRenderer({
  data,
  series,
  innerRadius,
  width,
  height,
  valueColumn,
  valueRange,
  xColumn,
  timeBucket,
  showDataLabels,
}: PieRendererProps) {
  const valueKey = series[0]?.dataKey
  const pieData = data.map((point, index) => {
    return {
      name: typeof point['xKey'] === 'string' || typeof point['xKey'] === 'number'
        ? formatXAxisValue(point['xKey'], xColumn, timeBucket, 'tooltip')
        : String(point['xLabel']),
      value: valueKey && typeof point[valueKey] === 'number' ? point[valueKey] : 0,
      fill: getSeriesColor(index),
    }
  })

  return (
    <PieChart width={width} height={height}>
      <Tooltip
        formatter={(value) =>
          typeof value === 'number'
            ? formatChartValue(value, {
                column: valueColumn,
                surface: 'tooltip',
                numericRange: valueRange,
              })
            : value
        }
      />
      <Legend />
      <Pie
        data={pieData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={innerRadius ? '40%' : 0}
        outerRadius="80%"
        label={showDataLabels
          ? ({name, value}: {name?: string | number; value?: number}) =>
              shouldHideDataLabel(value)
                ? ''
                : `${name}: ${typeof value === 'number'
                  ? formatChartValue(value, {
                      column: valueColumn,
                      surface: 'data-label',
                      numericRange: valueRange,
                    })
                  : value}`
          : false}
        labelLine={false}
      />
    </PieChart>
  )
}

/**
 * Format one cartesian data label with the same surface-aware rules used
 * elsewhere in the chart UI.
 */
function formatDataLabel(
  value: unknown,
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format' | 'formatter'>,
  valueRange: NumericRange | null,
): string {
  if (shouldHideDataLabel(value)) {
    return ''
  }

  if (typeof value !== 'number') {
    return String(value)
  }

  return formatChartValue(value, {
    column: valueColumn,
    surface: 'data-label',
    numericRange: valueRange,
  })
}

/**
 * Suppress zero-value labels in the built-in UI so charts stay quieter by
 * default while tooltips and raw values remain unchanged.
 */
function shouldHideDataLabel(value: unknown): boolean {
  return value == null || (typeof value === 'number' && value === 0)
}

// ---------------------------------------------------------------------------
// Table renderer
// ---------------------------------------------------------------------------

type TableRendererProps = {
  data: Record<string, string | number | null>[]
  series: SeriesItem[]
  height: number
  className?: string
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format' | 'formatter'>
  valueRange: NumericRange | null
  xColumn: ChartColumn<any> | null
  timeBucket?: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

/**
 * Table renderer — shows the pipeline output as an HTML table.
 *
 * Applies the same formatting pipeline as the chart renderers (dates respect
 * time-bucket labels, numbers use full-precision `table-cell` surface rules).
 * Scrolls both axes when the data overflows the configured height.
 */
function TableRenderer({data, series, height, className, valueColumn, valueRange, xColumn, timeBucket}: TableRendererProps) {
  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-muted-foreground ${className ?? ''}`}
        style={{height}}
      >
        No data available
      </div>
    )
  }

  return (
    <div
      className={`overflow-auto border border-border/50 rounded-md ${className ?? ''}`}
      style={{maxHeight: height}}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
          <tr>
            <th className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {xColumn?.label ?? 'Category'}
            </th>
            {series.map((s) => (
              <th
                key={s.dataKey}
                className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground"
              >
                <span className="inline-flex items-center justify-end gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{backgroundColor: s.color}}
                    aria-hidden
                  />
                  <span className="overflow-hidden text-ellipsis">{s.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-border/30 transition-colors hover:bg-muted/30"
            >
              <td className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 font-medium text-foreground">
                {formatTableXValue(point, xColumn, timeBucket)}
              </td>
              {series.map((s) => (
                <td
                  key={s.dataKey}
                  className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-foreground"
                >
                  {formatTableCellValue(point[s.dataKey], valueColumn, valueRange)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Format the X-axis value for a table row using the same logic as the chart
 * renderers: time-bucket-aware date labels, column formatters, etc.
 */
function formatTableXValue(
  point: Record<string, string | number | null>,
  xColumn: ChartColumn<any> | null,
  timeBucket: TableRendererProps['timeBucket'],
): string {
  const rawValue = typeof point['xKey'] === 'string' || typeof point['xKey'] === 'number'
    ? point['xKey']
    : point['xLabel']

  if (rawValue == null) return 'Unknown'

  return formatXAxisValue(rawValue, xColumn, timeBucket, 'table-cell')
}

/**
 * Format one metric cell value with full precision (matches tooltip depth).
 */
function formatTableCellValue(
  value: string | number | null | undefined,
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format' | 'formatter'>,
  valueRange: NumericRange | null,
): string {
  if (value == null) return '—'
  if (typeof value !== 'number') return String(value)

  return formatChartValue(value, {
    column: valueColumn,
    surface: 'table-cell',
    numericRange: valueRange,
  })
}
