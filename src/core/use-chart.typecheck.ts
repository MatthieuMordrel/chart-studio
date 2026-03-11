import type {ChartConfigFromHints, ValidatedChartConfigFromHints} from './types.js'
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
 * Compile-time helper used to validate config literals without affecting
 * `useChart()` inference.
 */
function expectValidConfig<
  const TConfig extends ChartConfigFromHints<ExampleRecord, typeof exampleHints>,
>(
  _config: ValidatedChartConfigFromHints<ExampleRecord, typeof exampleHints, TConfig>,
): void {}

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
    config: {
      groupBy: {
        allowed: ['ownerName', 'isOpen'],
      },
      metric: {
        allowed: [
          {kind: 'count'},
          {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
        ],
      },
    },
  })

  chart.setGroupBy('ownerName')
  chart.setGroupBy('isOpen')
  chart.setMetric({kind: 'count'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'avg'})

  // @ts-expect-error config.groupBy.allowed should narrow the setter to the declared subset
  chart.setGroupBy('createdAt')

  // @ts-expect-error config.metric.allowed should narrow the setter to the declared metric subset
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'min'})

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: {
      groupBy: {
        // @ts-expect-error explicit numeric hints should keep numeric IDs out of groupBy config
        allowed: ['salary'],
      },
    },
  })

  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: {
      metric: {
        allowed: [
          // @ts-expect-error non-metric IDs should fail inside declarative metric config
          {kind: 'aggregate', columnId: 'ownerName', aggregate: 'sum'},
        ],
      },
    },
  })
}

function verifyConfigTypechecks() {
  useChart({
    data: [] as ExampleRecord[],
    columnHints: exampleHints,
    config: {
      groupBy: {
        allowed: ['ownerName'],
      },
    },
  })

  // @ts-expect-error explicit defaults should not also be hidden
  expectValidConfig({
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

  // @ts-expect-error extracted config literals should also reject hidden defaults
  expectValidConfig(conflictingConfig)
}

function verifyGeneralizedConfigTyping() {
  const generalizedConfig = {
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
  } as const

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

  // @ts-expect-error xAxis config should keep undeclared IDs out of the setter type
  chart.setXAxis('isOpen')

  // @ts-expect-error groupBy config should keep undeclared IDs out of the setter type
  chart.setGroupBy('createdAt')

  // @ts-expect-error filter config should keep undeclared IDs out of the filter setter type
  chart.toggleFilter('createdAt', '2026-01-01')

  // @ts-expect-error metric config should narrow the setter type
  chart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'min'})

  // @ts-expect-error chartType config should narrow the setter type
  chart.setChartType('bar')

  // @ts-expect-error timeBucket config should narrow the setter type
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
    config: {
      groupBy: {
        allowed: ['ownerName'],
      },
      metric: {
        allowed: [{kind: 'count'}],
      },
    },
  })

  restrictedChart.setGroupBy('ownerName')
  restrictedChart.setMetric({kind: 'count'})

  // @ts-expect-error explicit config should still narrow groupBy even without explicit hints
  restrictedChart.setGroupBy('isOpen')

  // @ts-expect-error explicit config should still narrow metrics even without explicit hints
  restrictedChart.setMetric({kind: 'aggregate', columnId: 'salary', aggregate: 'sum'})
}

void verifyUseChartColumnIds
void verifyToolRestrictionsTyping
void verifyConfigTypechecks
void verifyGeneralizedConfigTyping
void verifyInferenceOnlyTypingStaysBroadWithoutExplicitHints
