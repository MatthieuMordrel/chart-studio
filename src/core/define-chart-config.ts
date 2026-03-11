import type {
  ChartConfigFromHints,
  ColumnHints,
  DefinedChartConfigFromHints,
  ValidatedChartConfigFromHints,
} from './types.js'

/**
 * Define one explicit chart config with strict exact-object checking.
 *
 * This single-call helper preserves literal narrowing while rejecting unknown
 * top-level and nested config keys at compile time. It is the canonical
 * entrypoint for any explicit chart config so callers get one predictable
 * TypeScript path.
 */
export function defineChartConfig<
  T,
  const THints extends ColumnHints<T> | undefined = undefined,
  const TConfig = ChartConfigFromHints<T, THints>,
>(
  config: TConfig & ValidatedChartConfigFromHints<T, THints, TConfig>,
): DefinedChartConfigFromHints<T, THints, Extract<TConfig, ChartConfigFromHints<T, THints>>> {
  return {
    ...config,
    __chartConfigBrand: 'chart-config-definition',
  } as DefinedChartConfigFromHints<T, THints, Extract<TConfig, ChartConfigFromHints<T, THints>>>
}
