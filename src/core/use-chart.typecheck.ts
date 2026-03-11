import {defineChartSchema} from './define-chart-schema.js'
import {useChart} from './use-chart.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleSchema = defineChartSchema<ExampleRecord>()({
  columns: {
    createdAt: {type: 'date', label: 'Created'},
    ownerName: {type: 'category', label: 'Owner'},
    isOpen: {type: 'boolean'},
    salary: {type: 'number', format: 'currency'},
    internalId: false,
    marginBucket: {
      kind: 'derived',
      type: 'category',
      label: 'Margin Bucket',
      accessor: (row: ExampleRecord) => (row.salary != null && row.salary > 100000 ? 'High' : 'Base'),
    },
  },
})

const restrictedSchema = defineChartSchema<ExampleRecord>()({
  columns: exampleSchema.columns,
  groupBy: {
    allowed: ['ownerName', 'isOpen', 'marginBucket'],
  },
  metric: {
    allowed: [
      {kind: 'count'},
      {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
    ],
  },
})

/**
 * Compile-time helper used to assert inferred types.
 */
function expectType<T>(_value: T): void {}

/**
 * This function never runs.
 * It only exists so TypeScript checks the inferred public API.
 */
function verifyUseChartColumnIds() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    schema: exampleSchema,
  })

  expectType<'createdAt' | 'ownerName' | 'isOpen' | 'marginBucket' | null>(chart.xAxisId)
  expectType<'ownerName' | 'isOpen' | 'marginBucket' | null>(chart.groupById)
  expectType<'createdAt' | null>(chart.referenceDateId)

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

  // @ts-expect-error invalid column IDs should fail
  chart.setXAxis('missingField')

  // @ts-expect-error invalid metric column IDs should fail
  chart.setMetric({kind: 'aggregate', columnId: 'missingField', aggregate: 'sum'})

  // @ts-expect-error invalid filter column IDs should fail
  chart.toggleFilter('missingField', 'Alice')

  // @ts-expect-error number columns should not be groupable when explicit schema says they are numeric
  chart.setGroupBy('salary')

  // @ts-expect-error explicit numeric schema entries should keep number columns out of the X-axis API
  chart.setXAxis('salary')

  // @ts-expect-error date columns should not be filterable when explicit schema says they are dates
  chart.toggleFilter('createdAt', '2026-01-01')

  // @ts-expect-error non-date columns should not be usable as reference dates when explicit schema says otherwise
  chart.setReferenceDateId('ownerName')

  // @ts-expect-error explicitly excluded fields should be removed from the chart API
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

  // @ts-expect-error schema.groupBy.allowed should narrow the setter to the declared subset
  chart.setGroupBy('createdAt')

}

function verifySchemaTypechecks() {
  useChart({
    data: [] as ExampleRecord[],
    schema: defineChartSchema<ExampleRecord>()({
      columns: exampleSchema.columns,
      groupBy: {
        allowed: ['ownerName'],
      },
    }),
  })

  defineChartSchema<ExampleRecord>()({
    columns: exampleSchema.columns,
    chartType: {
      allowed: ['bar', 'line'],
      hidden: ['line'],
      default: 'line',
    },
  })

  const conflictingSchema = {
    columns: exampleSchema.columns,
    xAxis: {
      hidden: ['createdAt'],
      default: 'createdAt',
    },
  } as const

  defineChartSchema<ExampleRecord>()(conflictingSchema)
}

function verifyGeneralizedSchemaTyping() {
  const generalizedSchema = defineChartSchema<ExampleRecord>()({
    columns: exampleSchema.columns,
    xAxis: {
      allowed: ['createdAt', 'ownerName', 'marginBucket'],
      hidden: ['ownerName'],
      default: 'createdAt',
    },
    groupBy: {
      allowed: ['ownerName', 'isOpen', 'marginBucket'],
      hidden: ['ownerName'],
      default: 'isOpen',
    },
    filters: {
      allowed: ['ownerName', 'isOpen', 'marginBucket'],
      hidden: ['isOpen'],
    },
    metric: {
      allowed: [
        {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
      ],
      hidden: [{kind: 'aggregate', columnId: 'salary', aggregate: 'avg'}],
      default: {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
    },
    chartType: {
      allowed: ['line', 'area'],
      hidden: ['line'],
      default: 'area',
    },
    timeBucket: {
      allowed: ['quarter', 'year'],
      hidden: ['year'],
      default: 'quarter',
    },
  })

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
  // @ts-expect-error groupBy restrictions should keep undeclared IDs out of the setter type
  chart.setGroupBy('createdAt')
  // @ts-expect-error filter restrictions should keep undeclared IDs out of the filter setter type
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

  // Without explicit schema.columns.type values, compile-time typing stays broad
  // enough to reflect the runtime inference story rather than pretending the
  // final runtime column roles are already known.
  chart.setXAxis('createdAt')
  chart.setXAxis('ownerName')
  chart.setXAxis('salary')
  chart.setGroupBy('createdAt')
  chart.toggleFilter('createdAt', '2026-01-01')
  chart.setReferenceDateId('salary')

  // Schema remains the authoritative narrowing layer when present.
  const restrictedChart = useChart({
    data: [] as ExampleRecord[],
    schema: defineChartSchema<ExampleRecord>()({
      groupBy: {
        allowed: ['ownerName'],
      },
      metric: {
        allowed: [{kind: 'count'}],
      },
    }),
  })

  restrictedChart.setGroupBy('ownerName')
  restrictedChart.setMetric({kind: 'count'})

  // @ts-expect-error groupBy restrictions stay authoritative once present
  restrictedChart.setGroupBy('isOpen')
  // @ts-expect-error metric restrictions stay authoritative once present
  restrictedChart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
}

void verifyUseChartColumnIds
void verifyToolRestrictionsTyping
void verifySchemaTypechecks
void verifyGeneralizedSchemaTyping
void verifyInferenceOnlyTypingStaysBroadWithoutExplicitSchema
