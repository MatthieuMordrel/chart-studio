import { columns, type DataSource } from '@matthieumordrel/chart-studio'

import { generateEventProgramData } from './mock-data/generate-event-program-data'
import { generateQuarterlyFinancialData } from './mock-data/generate-quarterly-financial-data'
import { generateRecipeLogData } from './mock-data/generate-recipe-log-data'

/** Record for home cooking log – familiar topic everyone understands. */
export type RecipeLogRecord = {
  cookedAt: string
  dish: string
  cuisine: 'Italian' | 'Mexican' | 'Asian' | 'American'
  prepMinutes: number
  cookMinutes: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  rating: number
}

/** Record for quarterly financial performance. */
export type QuarterlyFinancialRecord = {
  periodEnd: string
  segment: 'Product' | 'Services' | 'Licensing'
  revenue: number
  netIncome: number
  ebitda: number
  grossProfit: number
}

/** Record for conference and event programs. */
export type EventProgramRecord = {
  eventDate: string
  city: string
  format: 'Workshop' | 'Summit' | 'Roundtable'
  audience: string
  isSoldOut: boolean
  attendees: number
  ticketRevenue: number
}

/**
 * Named playground source with its own schema and data shape.
 */
export type PlaygroundSource = {
  description: string
} & DataSource<any>

/** Recipe log columns: when you cooked, what, how long, how hard, how good. */
export const recipeLogColumns = [
  columns.date<RecipeLogRecord>('cookedAt', { label: 'Date Cooked' }),
  columns.category<RecipeLogRecord>('dish', { label: 'Dish' }),
  columns.category<RecipeLogRecord>('cuisine', { label: 'Cuisine' }),
  columns.number<RecipeLogRecord>('prepMinutes', { label: 'Prep (min)' }),
  columns.number<RecipeLogRecord>('cookMinutes', { label: 'Cook (min)' }),
  columns.category<RecipeLogRecord>('difficulty', { label: 'Difficulty' }),
  columns.number<RecipeLogRecord>('rating', { label: 'Rating' })
]

/** Financial columns: revenue, net income, EBITDA, gross profit by period and segment. */
export const quarterlyFinancialColumns = [
  columns.date<QuarterlyFinancialRecord>('periodEnd', { label: 'Period End' }),
  columns.category<QuarterlyFinancialRecord>('segment', { label: 'Segment' }),
  columns.number<QuarterlyFinancialRecord>('revenue', { label: 'Revenue' }),
  columns.number<QuarterlyFinancialRecord>('netIncome', { label: 'Net Income' }),
  columns.number<QuarterlyFinancialRecord>('ebitda', { label: 'EBITDA' }),
  columns.number<QuarterlyFinancialRecord>('grossProfit', { label: 'Gross Profit' })
]

/** Event columns: date, location, format, audience, sell-through, revenue. */
export const eventProgramColumns = [
  columns.date<EventProgramRecord>('eventDate', { label: 'Event Date' }),
  columns.category<EventProgramRecord>('city', { label: 'City' }),
  columns.category<EventProgramRecord>('format', { label: 'Format' }),
  columns.category<EventProgramRecord>('audience', { label: 'Audience' }),
  columns.boolean<EventProgramRecord>('isSoldOut', {
    label: 'Inventory',
    trueLabel: 'Sold Out',
    falseLabel: 'Available'
  }),
  columns.number<EventProgramRecord>('attendees', { label: 'Attendees' }),
  columns.number<EventProgramRecord>('ticketRevenue', { label: 'Ticket Revenue' })
]

/**
 * Home cooking dataset – simple, relatable records.
 * 500 data points over ~18 months to stress-test chart rendering.
 */
export const recipeLogData: RecipeLogRecord[] = generateRecipeLogData(500)

/**
 * Quarterly financials: revenue, net income, EBITDA, gross profit by segment.
 * 72 data points (24 quarters × 3 segments) over 6 years to stress-test aggregations.
 */
export const quarterlyFinancialData: QuarterlyFinancialRecord[] = generateQuarterlyFinancialData()

/**
 * Event calendar: conferences and workshops with attendance and revenue.
 * 250 data points over ~2 years to stress-test categorical bucketing.
 */
export const eventProgramData: EventProgramRecord[] = generateEventProgramData(250)

/**
 * Source catalog used by the playground source switcher.
 * Each source intentionally uses a different schema so source changes stress-test state resets.
 */
export const playgroundSources = [
  {
    id: 'recipe-log',
    label: 'Home cooking',
    description: 'Simple recipe log: when you cooked what, prep/cook time, difficulty, and rating.',
    data: recipeLogData,
    columns: recipeLogColumns
  },
  {
    id: 'quarterly-financials',
    label: 'Quarterly financials',
    description: 'Revenue, net income, EBITDA, and gross profit by segment and period.',
    data: quarterlyFinancialData,
    columns: quarterlyFinancialColumns
  },
  {
    id: 'event-calendar',
    label: 'Event calendar',
    description: 'Conferences and workshops: format, audience, attendance, ticket revenue.',
    data: eventProgramData,
    columns: eventProgramColumns
  }
] satisfies readonly [PlaygroundSource, ...PlaygroundSource[]]
