import type {ChartConfigFromHints, ColumnHints, ValidatedChartConfigFromHints} from './types.js'

/**
 * Create a chart-config helper with strict exact-object checking.
 *
 * This factory preserves literal narrowing while rejecting unknown top-level
 * and nested config keys at compile time. It is especially useful for
 * extracted configs, where TypeScript would otherwise skip excess-property
 * checks.
 */
export function defineChartConfig<
  T,
  const THints extends ColumnHints<T> | undefined = undefined,
>(): <
  const TConfig extends ChartConfigFromHints<T, THints>,
>(
  config: ValidatedChartConfigFromHints<T, THints, TConfig>,
) => TConfig {
  /**
   * Validate one config object against the row/hint-specific chart config
   * shape and return it unchanged.
   */
  return config => config
}
