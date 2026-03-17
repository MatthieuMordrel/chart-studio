import {createChartSchemaBuilder} from './schema-builder.js'

/**
 * Define one explicit chart schema for the simple single-chart case.
 *
 * Treat this as the chart-first shortcut used with
 * `useChart({data, schema})`.
 *
 * `.columns(...)` is the authoring entry point: declare raw overrides,
 * exclusions, and derived columns first so later sections can narrow against
 * the declared column ids and roles.
 *
 * Typical shape:
 *
 * ```ts
 * const schema = defineChartSchema<Row>()
 *   .columns((c) => [
 *     c.date('createdAt', {label: 'Created'}),
 *     c.category('ownerName', {label: 'Owner'}),
 *     c.number('salary', {format: 'currency'}),
 *     c.exclude('internalId'),
 *     c.derived.category('salaryBand', {
 *       label: 'Salary Band',
 *       accessor: row => row.salary != null && row.salary > 100_000 ? 'High' : 'Base',
 *     }),
 *   ])
 *   .xAxis((x) => x.allowed('createdAt').default('createdAt'))
 *   .groupBy((g) => g.allowed('ownerName', 'salaryBand'))
 *   .metric((m) =>
 *     m
 *       .count()
 *       .aggregate('salary', 'sum', 'avg')
 *       .defaultAggregate('salary', 'sum')
 *   )
 *
 * // Pass the builder directly to useChart(...) or inferColumnsFromData(...),
 * // or call build() if you need the plain schema object.
 * ```
 */
export function defineChartSchema<TRow>() {
  return createChartSchemaBuilder<TRow>()
}
