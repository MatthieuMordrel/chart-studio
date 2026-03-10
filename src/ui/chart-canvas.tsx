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
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {useChartContext} from './chart-context.js'
import {getSeriesColor} from '../core/colors.js'

/**
 * Formats a numeric value into a compact, human-readable string.
 * Uses at most 3 significant figures to keep labels concise.
 *
 * @example formatAxisNumber(12_000_000) → "12M"
 * @example formatAxisNumber(1_500)      → "1.5K"
 * @example formatAxisNumber(-4_200_000) → "-4.2M"
 */
function formatAxisNumber(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${+(abs / 1e12).toPrecision(3)}T`
  if (abs >= 1e9) return `${sign}${+(abs / 1e9).toPrecision(3)}B`
  if (abs >= 1e6) return `${sign}${+(abs / 1e6).toPrecision(3)}M`
  if (abs >= 1e3) return `${sign}${+(abs / 1e3).toPrecision(3)}K`
  return String(value)
}

/**
 * Estimates the pixel width the YAxis needs so no label is ever clipped.
 * Finds the largest absolute value in the data, formats it, then multiplies
 * character count by ~7 px (text-xs) and adds 8 px of padding.
 */
function estimateYAxisWidth(
  data: Record<string, string | number>[],
  series: Array<{dataKey: string}>,
): number {
  let maxAbs = 0
  for (const point of data) {
    for (const s of series) {
      const v = point[s.dataKey]
      if (typeof v === 'number' && Math.abs(v) > maxAbs) maxAbs = Math.abs(v)
    }
  }
  const label = formatAxisNumber(maxAbs)
  return Math.max(40, label.length * 7 + 8)
}

/**
 * Props for ChartCanvas.
 *
 * @property height - Chart height in pixels (default: 300)
 * @property className - Additional CSS classes
 */
type ChartCanvasProps = {
  height?: number
  className?: string
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
export function ChartCanvas({height = 300, className}: ChartCanvasProps) {
  const chart = useChartContext()
  const {chartType, transformedData, series} = chart
  const {ref, width} = useContainerWidth()

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
          />
        ) : chartType === 'line' ? (
          <LineChartRenderer data={transformedData} series={series} width={width} height={height} />
        ) : chartType === 'area' ? (
          <AreaChartRenderer data={transformedData} series={series} width={width} height={height} />
        ) : (
          <BarChartRenderer data={transformedData} series={series} width={width} height={height} />
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
function CartesianChartShell({data, series, width, height, Chart, renderSeries}: CartesianShellProps) {
  const yAxisWidth = estimateYAxisWidth(data, series)
  return (
    <Chart data={data} width={width} height={height} margin={{top: 4, right: 8, left: 0, bottom: 0}}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        allowDecimals={false}
        width={yAxisWidth}
        tickFormatter={formatAxisNumber}
      />
      <Tooltip formatter={(value) => (typeof value === 'number' ? formatAxisNumber(value) : value)} />
      {series.length > 1 && <Legend />}
      {series.map(renderSeries)}
    </Chart>
  )
}

function BarChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <CartesianChartShell
      data={data}
      series={series}
      width={width}
      height={height}
      Chart={BarChart}
      renderSeries={(s) => (
        <Bar
          key={s.dataKey}
          dataKey={s.dataKey}
          name={s.label}
          fill={s.color}
          radius={[4, 4, 0, 0]}
          stackId={series.length > 1 ? 'stack' : undefined}
        />
      )}
    />
  )
}

function LineChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <CartesianChartShell
      data={data}
      series={series}
      width={width}
      height={height}
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
        />
      )}
    />
  )
}

function AreaChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <CartesianChartShell
      data={data}
      series={series}
      width={width}
      height={height}
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
        />
      )}
    />
  )
}

type PieRendererProps = RendererProps & {innerRadius: boolean}

function PieChartRenderer({data, series, innerRadius, width, height}: PieRendererProps) {
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
      <Tooltip formatter={(value) => (typeof value === 'number' ? formatAxisNumber(value) : value)} />
      <Legend />
      <Pie
        data={pieData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={innerRadius ? '40%' : 0}
        outerRadius="80%"
        label={({name, value}: {name?: string | number; value?: number}) =>
          `${name}: ${typeof value === 'number' ? formatAxisNumber(value) : value}`
        }
        labelLine={false}
      />
    </PieChart>
  )
}
