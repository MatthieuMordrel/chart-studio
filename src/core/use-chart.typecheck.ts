import {defineChartConfig} from './define-chart-config.js'
import {useChart} from './use-chart.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
  internalId: string
}

const exampleHints = {
  createdAt: {type: 'date', label: 'Created'},
  ownerName: {type: 'category', label: 'Owner'},
  isOpen: {type: 'boolean'},
  salary: {type: 'number', format: 'currency'},
  internalId: false,
} as const

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
    columnHints: exampleHints,
  })

  expectType<'createdAt' | 'ownerName' | 'isOpen' | null>(chart.xAxisId)
  expectType<'ownerName' | 'isOpen' | null>(chart.groupById)
  expectType<'createdAt' | null>(chart.referenceDateId)

  chart.setXAxis('ownerName')
  chart.setGroupBy('isOpen')
  chart.setGroupBy(null)
  chart.toggleFilter('ownerName', 'Alice')
  chart.clearFilter('ownerName')
  chart.setReferenceDateId('createdAt')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})

  // @ts-expect-error invalid column IDs should fail
  chart.setXAxis('missingField')

  // @ts-expect-error invalid metric column IDs should fail
  chart.setMetric({kind: 'aggregate', columnId: 'missingField', aggregate: 'sum'})

  // @ts-expect-error invalid filter column IDs should fail
  chart.toggleFilter('missingField', 'Alice')

  // @ts-expect-error number columns should not be groupable when explicit hints say they are numeric
  chart.setGroupBy('salary')

  // @ts-expect-error explicit numeric hints should keep number columns out of the X-axis API
  chart.setXAxis('salary')

  // @ts-expect-error date columns should not be filterable when explicit hints say they are dates
  chart.toggleFilter('createdAt', '2026-01-01')

  // @ts-expect-error non-date columns should not be usable as reference dates when explicit hints say otherwise
  chart.setReferenceDateId('ownerName')

  // @ts-expect-error explicitly excluded fields should be removed from the chart API
  chart.setXAxis('internalId')
}

function verifyToolRestrictionsTyping() {
  const chart = useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      groupBy: {
        allowed: ['ownerName', 'isOpen'],
      },
      metric: {
        allowed: [
          {kind: 'count'},
          {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
        ],
      },
    }),
  })

  chart.setGroupBy('ownerName')
  chart.setGroupBy('isOpen')
  chart.setMetric({kind: 'count'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})

  // @ts-expect-error config.groupBy.allowed should narrow the setter to the declared subset
  chart.setGroupBy('createdAt')

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      groupBy: {
        // @ts-expect-error explicit numeric hints should keep numeric IDs out of groupBy config
        allowed: ['salary'],
      },
    }),
  })

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      metric: {
        allowed: [
          // @ts-expect-error non-metric IDs should fail inside declarative metric config
          {kind: 'aggregate', columnId: 'ownerName', aggregate: 'sum'},
        ],
      },
    }),
  })
}

function verifyConfigTypechecks() {
  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      groupBy: {
        allowed: ['ownerName'],
      },
    }),
  })

  defineChartConfig<ExampleRecord, typeof exampleHints>({
    chartType: {
      allowed: ['bar', 'line'],
      hidden: ['line'],
      default: 'line',
    },
  })

  const conflictingConfig = {
    xAxis: {
      hidden: ['createdAt'],
      default: 'createdAt',
    },
  } as const

  defineChartConfig<ExampleRecord, typeof exampleHints>(conflictingConfig)

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      groupBy: {
        allowed: ['ownerName'],
      },
      // @ts-expect-error invalid top-level config keys should fail inline
      grouping: {
        allowed: ['isOpen'],
      },
    }),
  })

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      groupBy: {
        allowed: ['ownerName'],
        // @ts-expect-error invalid nested config keys should fail inline
        fallback: 'ownerName',
      },
    }),
  })

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>({
      metric: {
        allowed: [
          {
            kind: 'aggregate',
            columnId: 'salary',
            aggregate: 'sum',
            // @ts-expect-error invalid nested metric keys should fail inline
            label: 'Revenue',
          },
        ],
      },
    }),
  })

  const invalidTopLevelConfig = {
    groupBy: {
      allowed: ['ownerName'],
    },
    grouping: {
      allowed: ['isOpen'],
    },
  } as const

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>(invalidTopLevelConfig),
  })

  const invalidNestedConfig = {
    groupBy: {
      allowed: ['ownerName'],
      fallback: 'ownerName',
    },
  } as const

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: defineChartConfig<ExampleRecord, typeof exampleHints>(invalidNestedConfig),
  })
}

function verifyGeneralizedConfigTyping() {
  const generalizedConfig = defineChartConfig<ExampleRecord, typeof exampleHints>({
    xAxis: {
      allowed: ['createdAt', 'ownerName'],
      hidden: ['ownerName'],
      default: 'createdAt',
    },
    groupBy: {
      allowed: ['ownerName', 'isOpen'],
      hidden: ['ownerName'],
      default: 'isOpen',
    },
    filters: {
      allowed: ['ownerName', 'isOpen'],
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
    columnHints: exampleHints,
    config: generalizedConfig,
  })

  chart.setXAxis('createdAt')
  chart.setXAxis('ownerName')
  chart.setGroupBy('isOpen')
  chart.toggleFilter('ownerName', 'Alice')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setChartType('area')
  chart.setTimeBucket('quarter')

  chart.setXAxis('isOpen')
  // @ts-expect-error groupBy config should keep undeclared IDs out of the setter type
  chart.setGroupBy('createdAt')
  // @ts-expect-error filter config should keep undeclared IDs out of the filter setter type
  chart.toggleFilter('createdAt', '2026-01-01')
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'min'})
  chart.setChartType('bar')
  chart.setTimeBucket('month')
}

function verifyInferenceOnlyTypingStaysBroadWithoutExplicitHints() {
  const chart = useChart({
    data: [] as ExampleRecord[],
  })

  // Without explicit columnHints.type values, compile-time typing stays broad
  // enough to reflect the runtime inference story rather than pretending the
  // final runtime column roles are already known.
  chart.setXAxis('createdAt')
  chart.setXAxis('ownerName')
  chart.setXAxis('salary')
  chart.setGroupBy('createdAt')
  chart.toggleFilter('createdAt', '2026-01-01')
  chart.setReferenceDateId('salary')

  // Config remains the authoritative narrowing layer when present.
  const restrictedChart = useChart({
    data: [] as ExampleRecord[],
    config: defineChartConfig<ExampleRecord>({
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

  restrictedChart.setGroupBy('isOpen')
  restrictedChart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
}

void verifyUseChartColumnIds
void verifyToolRestrictionsTyping
void verifyConfigTypechecks
void verifyGeneralizedConfigTyping
void verifyInferenceOnlyTypingStaysBroadWithoutExplicitHints
