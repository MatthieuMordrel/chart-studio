/**
 * Chart canvas — renders the actual recharts chart based on the current state.
 *
 * Supports: bar, line, area (time-series), bar, pie, donut (categorical).
 * Automatically switches between chart types based on the chart instance state.
 */

import {useEffect, useRef, useState} from 'react'
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

type RendererProps = {
  data: Record<string, string | number>[]
  series: Array<{dataKey: string; label: string; color: string}>
  width: number
  height: number
}

function BarChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <BarChart data={data} width={width} height={height}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} tickMargin={4} allowDecimals={false} width={40} />
      <Tooltip />
      {series.length > 1 && <Legend />}
      {series.map((s) => (
        <Bar
          key={s.dataKey}
          dataKey={s.dataKey}
          name={s.label}
          fill={s.color}
          radius={[4, 4, 0, 0]}
          stackId={series.length > 1 ? 'stack' : undefined}
        />
      ))}
    </BarChart>
  )
}

function LineChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <LineChart data={data} width={width} height={height}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} tickMargin={4} allowDecimals={false} width={40} />
      <Tooltip />
      {series.length > 1 && <Legend />}
      {series.map((s) => (
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
      ))}
    </LineChart>
  )
}

function AreaChartRenderer({data, series, width, height}: RendererProps) {
  return (
    <AreaChart data={data} width={width} height={height}>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} tickMargin={4} allowDecimals={false} width={40} />
      <Tooltip />
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
          stackId={series.length > 1 ? 'stack' : undefined}
        />
      ))}
    </AreaChart>
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
      <Tooltip />
      <Legend />
      <Pie
        data={pieData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={innerRadius ? '40%' : 0}
        outerRadius="80%"
        label={({name, value}: {name?: string | number; value?: string | number}) =>
          `${name}: ${value}`
        }
        labelLine={false}
      />
    </PieChart>
  )
}
