import { generateEventProgramData } from './mock-data/generate-event-program-data'
import { generateHiringNetworkData } from './mock-data/generate-hiring-network-data'
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

/** Record for a realistic hiring requisition planning dataset. */
export type HiringRequisitionRecord = {
  id: string
  ownerId: string
  roleFamily: 'Engineering' | 'Data' | 'Security' | 'Design' | 'Revenue' | 'Operations'
  team: string
  region: 'AMER' | 'EMEA' | 'APAC'
  office: string
  level: 'IC4' | 'IC5' | 'Staff' | 'Manager' | 'Director'
  hiringMotion: 'Backfill' | 'Growth' | 'Expansion'
  employmentType: 'Full Time' | 'Contract'
  status: 'Open' | 'Filled' | 'Paused' | 'Cancelled'
  openedAt: string
  targetStartAt: string
  closedAt: string | null
  salaryMidpoint: number
  headcount: number
  applicants: number
  onsiteCount: number
  offersExtended: number
  offersAccepted: number
}

export type HiringOwnerRecord = {
  id: string
  name: string
  region: 'AMER' | 'EMEA' | 'APAC'
  portfolio: 'Platform' | 'Revenue' | 'Data' | 'Security' | 'Product' | 'Operations' | 'Growth' | 'Design'
}

export type HiringSkillRecord = {
  id: string
  name: string
  domain:
    | 'Frontend'
    | 'Backend'
    | 'Infrastructure'
    | 'Data'
    | 'Growth'
    | 'Revenue'
    | 'Product'
    | 'Design'
    | 'Security'
    | 'Operations'
}

export type HiringJobSkillRecord = {
  jobId: string
  skillId: string
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
 * Hiring planning network: normalized requisitions, owners, skills, and
 * explicit job-skill association edges.
 */
export const hiringNetworkData = generateHiringNetworkData()

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
