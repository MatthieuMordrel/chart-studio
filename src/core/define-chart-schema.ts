import type {
  ChartSchema,
  DefinedChartSchema,
} from './types.js'

/**
 * Define one explicit chart schema with strict exact-object checking.
 *
 * The schema is the single advanced authoring surface for chart-studio:
 * `columns` can override or exclude inferred raw fields and also define derived
 * columns, while the top-level control sections restrict the public chart
 * contract.
 */
export function defineChartSchema<T>() {
  /**
   * Brand one schema object while preserving its literal types.
   */
  return function defineSchema<const TSchema extends ChartSchema<T, any>>(
    schema: TSchema,
  ): DefinedChartSchema<T, TSchema> {
    return {
      ...schema,
      __chartSchemaBrand: 'chart-schema-definition',
    } as DefinedChartSchema<T, TSchema>
  }
}
