/**
 * React context for sharing the chart instance across composable UI components.
 */

import {createContext, useContext, type ReactNode} from 'react'
import type {ChartColumn, ChartInstance} from '../core/types.js'

/**
 * Type-erased chart instance stored in React context.
 * The runtime value keeps its full generic shape, while consumers can recover
 * their expected item type through `useChartContext<T>()`.
 */
type ChartContextValue = Omit<ChartInstance<unknown>, 'columns'> & {
  columns: ChartColumn<never>[]
}

const ChartContext = createContext<ChartContextValue | null>(null)

/**
 * Hook to access the chart instance from context.
 * Must be used within a `<Chart>` provider.
 */
export function useChartContext<T = unknown>(): ChartInstance<T> {
  const ctx = useContext(ChartContext)
  if (!ctx) {
    throw new Error('useChartContext must be used within a <Chart> provider')
  }
  return ctx as unknown as ChartInstance<T>
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
