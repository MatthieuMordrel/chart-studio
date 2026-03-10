/**
 * React context for sharing the chart instance across composable UI components.
 */

import {createContext, useContext, type ReactNode} from 'react'
import type {ChartColumn, ChartInstance} from '../core/types.js'

/**
 * Type-erased chart instance stored in React context.
 * The UI layer does not preserve row typing through React context, so the
 * public hook intentionally returns `ChartInstance<unknown>`.
 */
type ChartContextValue = Omit<ChartInstance<unknown>, 'columns'> & {
  columns: ChartColumn<any>[]
}

const ChartContext = createContext<ChartContextValue | null>(null)

/**
 * Hook to access the chart instance from context.
 * Must be used within a `<Chart>` provider.
 */
export function useChartContext(): ChartInstance<unknown> {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useChartContext must be used within a <Chart> provider')
  }
  return ctx
}

/**
 * Root provider component. Wraps children with the chart instance context.
 *
 * @example
 * ```tsx
 * <Chart chart={chart}>
 *   <ChartToolbar />
 *   <ChartCanvas />
 * </Chart>
 * ```
 */
export function Chart<T>({
  chart,
  children,
  className,
}: {
  chart: ChartInstance<T>
  children: ReactNode
  className?: string
}) {
  return (
    <ChartContext.Provider value={chart as unknown as ChartContextValue}>
      <div className={className}>{children}</div>
    </ChartContext.Provider>
  )
}
