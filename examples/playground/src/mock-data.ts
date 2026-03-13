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
 * Home cooking dataset – simple, relatable records.
 * 500 data points over ~18 months to stress-test chart rendering.
 * 
 * ```ts
 * {
 *   cookedAt: string (ISO date)
 *   dish: string
 *   cuisine: 'Italian' | 'Mexican' | 'Asian' | 'American'
 *   prepMinutes: number // duration in minutes
 *   cookMinutes: number // duration in minutes
 *   difficulty: 'Easy' | 'Medium' | 'Hard'
 *   rating: number // 3–5
 * }
 * ```
 */
export const recipeLogData: RecipeLogRecord[] = generateRecipeLogData(500)

/**
 * Quarterly financials: revenue, net income, EBITDA, gross profit by segment.
 * 72 data points (24 quarters × 3 segments) over 6 years to stress-test aggregations.
 * 
 * ```ts
 * {
 *   periodEnd: string (ISO date)
 *   segment: 'Product' | 'Services' | 'Licensing'
 *   revenue: number
 *   netIncome: number
 *   ebitda: number
 *   grossProfit: number
 * }
 * ```
 */
export const quarterlyFinancialData: QuarterlyFinancialRecord[] = generateQuarterlyFinancialData()

/**
 * Event calendar: conferences and workshops with attendance and revenue.
 * 250 data points over ~2 years to stress-test categorical bucketing.
 * 
 * ```ts
 * {
 *   eventDate: string (ISO date)
 *   city: string
 *   format: 'Workshop' | 'Summit' | 'Roundtable'
 *   audience: string
 *   isSoldOut: boolean
 *   attendees: number
 *   ticketRevenue: number
 * }
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
    schema: {
      columns: {
        cookedAt: { type: 'date', label: 'Date Cooked' },
        prepMinutes: {
          label: 'Prep Time',
          format: { kind: 'duration', unit: 'minutes' }
        },
        cookMinutes: {
          label: 'Cook Time',
          format: { kind: 'duration', unit: 'minutes' }
        }
      }
    } as const
  },
  {
    id: 'quarterly-financials',
    label: 'Quarterly financials',
    description: 'Revenue, net income, EBITDA, and gross profit by segment and period.',
    data: quarterlyFinancialData,
    schema: {
      columns: {
        periodEnd: { type: 'date', label: 'Period End' },
        ebitda: { label: 'EBITDA' }
      }
    } as const
  },
  {
    id: 'event-calendar',
    label: 'Event calendar',
    description: 'Conferences and workshops: format, audience, attendance, ticket revenue.',
    data: eventProgramData,
    schema: {
      columns: {
        eventDate: { type: 'date', label: 'Event Date' },
        isSoldOut: {
          label: 'Inventory',
          trueLabel: 'Sold Out',
          falseLabel: 'Available'
        },
        ticketRevenue: { format: 'currency' }
      }
    } as const
  }
] as const
