/**
 * Chart canvas — renders the actual recharts chart based on the current state.
 *
 * Supports: bar, line, area (time-series), bar, pie, donut (categorical).
 * Automatically switches between chart types based on the chart instance state.
 */

import {type ComponentType, type ReactNode, useEffect, useRef, useState} from 'react'
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
  shouldAllowDecimalTicks,
  type NumericRange,
} from '../core/formatting.js'
import {useChartContext} from './chart-context.js'
import {getSeriesColor} from '../core/colors.js'
import type {ChartColumn} from '../core/types.js'

/**
 * Estimates the pixel width the YAxis needs so no label is ever clipped.
 * Finds the largest absolute value in the data, formats it, then multiplies
 * character count by ~7 px (text-xs) and adds 8 px of padding.
 */
function estimateYAxisWidth(
  numericRange: NumericRange | null,
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format'>,
): number {
  const maxAbs = numericRange ? Math.max(Math.abs(numericRange.min), Math.abs(numericRange.max)) : 0
  const label = formatChartValue(maxAbs, {
    column: valueColumn,
    surface: 'axis',
    numericRange,
  })
  return Math.max(40, label.length * 7 + 8)
}

/**
 * Props for ChartCanvas.
 *
 * @property height - Chart height in pixels (default: 300)
 * @property className - Additional CSS classes
 * @property showDataLabels - Opt into cartesian/pie value labels using the shared formatting rules.
 */
type ChartCanvasProps = {
  height?: number
  className?: string
  showDataLabels?: boolean
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
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {ref, width}
}

/** Renders the appropriate recharts chart based on the chart instance state. */
export function ChartCanvas({height = 300, className, showDataLabels = false}: ChartCanvasProps) {
  const chart = useChartContext()
  const {chartType, transformedData, series} = chart
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
            timeBucket={chart.isTimeSeries ? chart.timeBucket : undefined}
            showDataLabels={showDataLabels}
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
            timeBucket={chart.isTimeSeries ? chart.timeBucket : undefined}
            showDataLabels={showDataLabels}
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
            timeBucket={chart.isTimeSeries ? chart.timeBucket : undefined}
            showDataLabels={showDataLabels}
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
            timeBucket={chart.isTimeSeries ? chart.timeBucket : undefined}
            showDataLabels={showDataLabels}
          />
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart type renderers
// ---------------------------------------------------------------------------

type SeriesItem = {dataKey: string; label: string; color: string}

type RendererProps = {
  data: Record<string, string | number>[]
  series: SeriesItem[]
  width: number
  height: number
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format'>
  valueRange: NumericRange | null
  allowDecimalTicks: boolean
  xColumn: ChartColumn<any> | null
  timeBucket?: 'day' | 'week' | 'month' | 'quarter' | 'year'
  showDataLabels: boolean
}

/**
 * Minimal interface covering the props we pass to any recharts Cartesian root
 * (BarChart, LineChart, AreaChart). Keeps CartesianChartShell type-safe without
 * coupling it to a specific chart component.
 */
type CartesianChartComponent = ComponentType<{
  data: Record<string, string | number>[]
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
}: CartesianShellProps) {
  const yAxisWidth = estimateYAxisWidth(valueRange, valueColumn)
  return (
    <Chart data={data} width={width} height={height} margin={getCartesianChartMargin(showDataLabels)}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="xLabel"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        interval="preserveStartEnd"
        padding={CARTESIAN_X_AXIS_PADDING}
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

  if (xColumn.type === 'date' && timeBucket && typeof rawXValue === 'string') {
    return formatTimeBucketLabel(rawXValue, timeBucket, 'tooltip')
  }

  return formatChartValue(
    rawXValue,
    {
      column: xColumn,
      surface: 'tooltip',
      timeBucket,
    },
  )
}

function BarChartRenderer(props: RendererProps) {
  const {series, showDataLabels, valueColumn, valueRange} = props
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
          radius={[4, 4, 0, 0]}
          stackId={series.length > 1 ? 'stack' : undefined}
        >
          {showDataLabels && (
            <LabelList
              position="top"
              offset={8}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Bar>
      )}
    />
  )
}

function LineChartRenderer(props: RendererProps) {
  const {showDataLabels, valueColumn, valueRange} = props
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
        >
          {showDataLabels && (
            <LabelList
              position="top"
              offset={8}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Line>
      )}
    />
  )
}

function AreaChartRenderer(props: RendererProps) {
  const {series, showDataLabels, valueColumn, valueRange} = props
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
          stackId={series.length > 1 ? 'stack' : undefined}
        >
          {showDataLabels && (
            <LabelList
              position="top"
              offset={8}
              formatter={(value: unknown) => formatDataLabel(value, valueColumn, valueRange)}
            />
          )}
        </Area>
      )}
    />
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
  showDataLabels,
}: PieRendererProps) {
  const valueKey = series[0]?.dataKey
  const pieData = data.map((point, index) => {
    return {
      name: point['xLabel'] as string,
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
  valueColumn: Pick<ChartColumn<any>, 'type' | 'format'>,
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
  return typeof value === 'number' && value === 0
}
