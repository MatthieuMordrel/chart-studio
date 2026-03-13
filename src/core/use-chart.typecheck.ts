import {defineChartSchema} from './define-chart-schema.js'
import {useChart} from './use-chart.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleSchemaBuilder = defineChartSchema<ExampleRecord>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('ownerName', {label: 'Owner'}),
    c.boolean('isOpen'),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('marginBucket', {
      label: 'Margin Bucket',
      accessor: (row) => (row.salary != null && row.salary > 100000 ? 'High' : 'Base'),
    }),
    c.derived.boolean('hasSalary', {
      label: 'Has Salary',
      accessor: (row) => row.salary != null,
    }),
    c.derived.date('createdDay', {
      label: 'Created Day',
      accessor: (row) => row.createdAt,
    }),
    c.derived.number('salaryValue', {
      label: 'Salary Value',
      format: {
        kind: 'number',
        options: {
          style: 'currency',
          currency: 'EUR',
        },
      },
      accessor: (row) => row.salary ?? 0,
    }),
  ])

const exampleSchema = exampleSchemaBuilder.build()

const restrictedSchema = exampleSchemaBuilder
  .groupBy((g) => g.allowed('ownerName', 'isOpen', 'marginBucket'))
  .metric((m) => m.count().aggregate('salary', 'sum', 'avg'))
  .build()

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

function verifyBuilderTyping() {
  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      c.field('ownerName', {label: 'Owner'}),
      c.date('createdAt'),
      c.number('salary'),
      c.boolean('isOpen'),
    ])
    .xAxis((x) => x.allowed('createdAt', 'ownerName').default('createdAt'))
    .groupBy((g) => g.allowed('ownerName', 'isOpen').default('ownerName'))
    .filters((f) => f.allowed('ownerName', 'isOpen'))
    .metric((m) => m.count().aggregate('salary', 'sum').defaultAggregate('salary', 'sum'))
    .build()

  defineChartSchema<ExampleRecord>().columns((c) => [
    c.derived.number('netSalary', {
      label: 'Net Salary',
      accessor: (row) => {
        expectType<ExampleRecord>(row)

        return row.salary ?? 0
      },
    }),
  ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      c.exclude('internalId'),
    ])
    // @ts-expect-error excluded raw ids should disappear from later sections
    .xAxis((x) => x.allowed('internalId'))

  defineChartSchema<ExampleRecord>()
    // @ts-expect-error duplicate column ids should fail
    .columns((c) => [
      c.date('createdAt'),
      c.field('createdAt', {label: 'Created Again'}),
    ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      // @ts-expect-error number helper should only accept numeric raw fields
      c.number('ownerName'),
    ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      // @ts-expect-error existing raw ids cannot be reused for derived columns
      c.derived.category('ownerName', {
        label: 'Owner Copy',
        accessor: () => 'Owner',
      }),
    ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      c.derived.number('derivedMetric', {
        label: 'Derived Metric',
        accessor: (row) => row.salary ?? 0,
        // @ts-expect-error derived options should reject unknown nested keys
        fallback: 1,
      }),
    ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      // @ts-expect-error derived columns require a label
      c.derived.category('missingLabel', {
        accessor: () => 'Missing',
      }),
    ])

  defineChartSchema<ExampleRecord>()
    .columns((c) => [
      c.date('createdAt'),
    ])
    .xAxis((x) =>
      // @ts-expect-error hidden options cannot also be the default
      x.allowed('createdAt').hidden('createdAt').default('createdAt')
    )

  // @ts-expect-error unknown top-level builder methods should fail
  defineChartSchema<ExampleRecord>().grouping((g: {allowed: (...values: string[]) => unknown}) => g.allowed('ownerName'))
}

function verifyUseChartColumnIds() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    schema: exampleSchema,
  })

  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'marginBucket' | 'hasSalary' | 'createdDay' | null>(chart.xAxisId)
  expectType<'ownerName' | 'isOpen' | 'marginBucket' | 'hasSalary' | null>(chart.groupById)
  expectType<'createdAt' | 'createdDay' | null>(chart.referenceDateId)

  chart.setXAxis('ownerName')
  chart.setGroupBy('isOpen')
  chart.setGroupBy(null)
  chart.toggleFilter('ownerName', 'Alice')
  chart.clearFilter('ownerName')
  chart.setReferenceDateId('createdAt')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setXAxis('marginBucket')
  chart.setGroupBy('marginBucket')
  chart.toggleFilter('marginBucket', 'High')
  chart.setGroupBy('hasSalary')
  chart.toggleFilter('hasSalary', 'True')
  chart.setReferenceDateId('createdDay')
  chart.setMetric({kind: 'aggregate', columnId: 'salaryValue', aggregate: 'sum'})

  // @ts-expect-error invalid column ids should fail
  chart.setXAxis('missingField')
  // @ts-expect-error invalid metric column ids should fail
  chart.setMetric({kind: 'aggregate', columnId: 'missingField', aggregate: 'sum'})
  // @ts-expect-error invalid filter column ids should fail
  chart.toggleFilter('missingField', 'Alice')
  // @ts-expect-error explicit numeric schema entries keep number columns out of groupBy
  chart.setGroupBy('salary')
  // @ts-expect-error derived number columns stay out of groupBy
  chart.setGroupBy('salaryValue')
  // @ts-expect-error explicit numeric schema entries keep number columns out of the X-axis API
  chart.setXAxis('salary')
  // @ts-expect-error explicit date schema entries keep date columns out of filters
  chart.toggleFilter('createdAt', '2026-01-01')
  // @ts-expect-error non-date columns cannot be reference dates
  chart.setReferenceDateId('ownerName')
  // @ts-expect-error derived category columns cannot be reference dates
  chart.setReferenceDateId('marginBucket')
  // @ts-expect-error explicitly excluded fields should disappear from the chart API
  chart.setXAxis('internalId')
}

function verifyToolRestrictionsTyping() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    schema: restrictedSchema,
  })

  chart.setGroupBy('ownerName')
  chart.setGroupBy('isOpen')
  chart.setGroupBy('marginBucket')
  chart.setMetric({kind: 'count'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})

  // @ts-expect-error groupBy restrictions should narrow the setter to the declared subset
  chart.setGroupBy('createdAt')
  // @ts-expect-error metric restrictions should keep undeclared aggregates out of the setter type
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'min'})
}

function verifyGeneralizedSchemaTyping() {
  const generalizedSchema = exampleSchemaBuilder
    .xAxis((x) => x.allowed('createdAt', 'ownerName', 'marginBucket').hidden('ownerName').default('createdAt'))
    .groupBy((g) => g.allowed('ownerName', 'isOpen', 'marginBucket').hidden('ownerName').default('isOpen'))
    .filters((f) => f.allowed('ownerName', 'isOpen', 'marginBucket').hidden('isOpen'))
    .metric((m) =>
      m
        .aggregate('salary', 'sum', 'avg')
        .hideAggregate('salary', 'avg')
        .defaultAggregate('salary', 'sum')
    )
    .chartType((t) => t.allowed('line', 'area').hidden('line').default('area'))
    .timeBucket((tb) => tb.allowed('quarter', 'year').hidden('year').default('quarter'))
    .build()

  const chart = useChart({
    data: [] as ExampleRecord[],
    schema: generalizedSchema,
  })

  chart.setXAxis('createdAt')
  chart.setXAxis('marginBucket')
  chart.setGroupBy('isOpen')
  chart.toggleFilter('ownerName', 'Alice')
  chart.toggleFilter('marginBucket', 'High')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setChartType('area')
  chart.setTimeBucket('quarter')

  chart.setXAxis('ownerName')
  // @ts-expect-error groupBy restrictions should keep undeclared ids out of the setter type
  chart.setGroupBy('createdAt')
  // @ts-expect-error filter restrictions should keep undeclared ids out of the filter setter type
  chart.toggleFilter('createdAt', '2026-01-01')
  // @ts-expect-error metric restrictions should keep undeclared aggregates out of the setter type
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'min'})
  // @ts-expect-error chart type restrictions should keep undeclared chart types out of the setter type
  chart.setChartType('bar')
  // @ts-expect-error time bucket restrictions should keep undeclared buckets out of the setter type
  chart.setTimeBucket('month')
}

function verifyInferenceOnlyTypingStaysBroadWithoutExplicitSchema() {
  const chart = useChart({
    data: [] as ExampleRecord[],
  })

  chart.setXAxis('createdAt')
  chart.setXAxis('ownerName')
  chart.setXAxis('salary')
  chart.setGroupBy('createdAt')
  chart.toggleFilter('createdAt', '2026-01-01')
  chart.setReferenceDateId('salary')

  const restrictedChart = useChart({
    data: [] as ExampleRecord[],
    schema: defineChartSchema<ExampleRecord>()
      .groupBy((g) => g.allowed('ownerName'))
      .metric((m) => m.count())
      .build(),
  })

  restrictedChart.setGroupBy('ownerName')
  restrictedChart.setMetric({kind: 'count'})

  // @ts-expect-error groupBy restrictions stay authoritative once present
  restrictedChart.setGroupBy('isOpen')
  // @ts-expect-error metric restrictions stay authoritative once present
  restrictedChart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
}

void verifyBuilderTyping
void verifyUseChartColumnIds
void verifyToolRestrictionsTyping
void verifyGeneralizedSchemaTyping
void verifyInferenceOnlyTypingStaysBroadWithoutExplicitSchema
