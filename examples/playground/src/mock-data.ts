import {columns, type DataSource} from '@matthieumordrel/chart-studio'

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

/**
 * Build a stable ISO date relative to "today" for demo charts.
 */
function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

/** Recipe log columns: when you cooked, what, how long, how hard, how good. */
export const recipeLogColumns = [
  columns.date<RecipeLogRecord>('cookedAt', {label: 'Date Cooked'}),
  columns.category<RecipeLogRecord>('dish', {label: 'Dish'}),
  columns.category<RecipeLogRecord>('cuisine', {label: 'Cuisine'}),
  columns.number<RecipeLogRecord>('prepMinutes', {label: 'Prep (min)'}),
  columns.number<RecipeLogRecord>('cookMinutes', {label: 'Cook (min)'}),
  columns.category<RecipeLogRecord>('difficulty', {label: 'Difficulty'}),
  columns.number<RecipeLogRecord>('rating', {label: 'Rating'}),
]

/** Financial columns: revenue, net income, EBITDA, gross profit by period and segment. */
export const quarterlyFinancialColumns = [
  columns.date<QuarterlyFinancialRecord>('periodEnd', {label: 'Period End'}),
  columns.category<QuarterlyFinancialRecord>('segment', {label: 'Segment'}),
  columns.number<QuarterlyFinancialRecord>('revenue', {label: 'Revenue'}),
  columns.number<QuarterlyFinancialRecord>('netIncome', {label: 'Net Income'}),
  columns.number<QuarterlyFinancialRecord>('ebitda', {label: 'EBITDA'}),
  columns.number<QuarterlyFinancialRecord>('grossProfit', {label: 'Gross Profit'}),
]

/** Event columns: date, location, format, audience, sell-through, revenue. */
export const eventProgramColumns = [
  columns.date<EventProgramRecord>('eventDate', {label: 'Event Date'}),
  columns.category<EventProgramRecord>('city', {label: 'City'}),
  columns.category<EventProgramRecord>('format', {label: 'Format'}),
  columns.category<EventProgramRecord>('audience', {label: 'Audience'}),
  columns.boolean<EventProgramRecord>('isSoldOut', {
    label: 'Inventory',
    trueLabel: 'Sold Out',
    falseLabel: 'Available',
  }),
  columns.number<EventProgramRecord>('attendees', {label: 'Attendees'}),
  columns.number<EventProgramRecord>('ticketRevenue', {label: 'Ticket Revenue'}),
]

/**
 * Home cooking dataset – simple, relatable records.
 * Clearly named so anyone can understand: when you cooked what, how long it took, and how it rated.
 */
export const recipeLogData: RecipeLogRecord[] = [
  {cookedAt: isoDateDaysAgo(42), dish: 'Spaghetti Carbonara', cuisine: 'Italian', prepMinutes: 15, cookMinutes: 20, difficulty: 'Medium', rating: 5},
  {cookedAt: isoDateDaysAgo(38), dish: 'Tacos al Pastor', cuisine: 'Mexican', prepMinutes: 30, cookMinutes: 25, difficulty: 'Medium', rating: 4},
  {cookedAt: isoDateDaysAgo(35), dish: 'Fried Rice', cuisine: 'Asian', prepMinutes: 10, cookMinutes: 15, difficulty: 'Easy', rating: 4},
  {cookedAt: isoDateDaysAgo(28), dish: 'Grilled Cheese', cuisine: 'American', prepMinutes: 2, cookMinutes: 5, difficulty: 'Easy', rating: 3},
  {cookedAt: isoDateDaysAgo(21), dish: 'Risotto', cuisine: 'Italian', prepMinutes: 15, cookMinutes: 35, difficulty: 'Hard', rating: 5},
  {cookedAt: isoDateDaysAgo(18), dish: 'Burrito Bowl', cuisine: 'Mexican', prepMinutes: 20, cookMinutes: 10, difficulty: 'Easy', rating: 4},
  {cookedAt: isoDateDaysAgo(14), dish: 'Pad Thai', cuisine: 'Asian', prepMinutes: 25, cookMinutes: 15, difficulty: 'Medium', rating: 5},
  {cookedAt: isoDateDaysAgo(10), dish: 'Mac and Cheese', cuisine: 'American', prepMinutes: 5, cookMinutes: 15, difficulty: 'Easy', rating: 4},
  {cookedAt: isoDateDaysAgo(7), dish: 'Lasagna', cuisine: 'Italian', prepMinutes: 45, cookMinutes: 60, difficulty: 'Hard', rating: 5},
  {cookedAt: isoDateDaysAgo(4), dish: 'Quesadilla', cuisine: 'Mexican', prepMinutes: 5, cookMinutes: 8, difficulty: 'Easy', rating: 4},
  {cookedAt: isoDateDaysAgo(2), dish: 'Stir Fry', cuisine: 'Asian', prepMinutes: 20, cookMinutes: 10, difficulty: 'Medium', rating: 4},
]

/**
 * Quarterly financials: revenue, net income, EBITDA, gross profit by segment.
 * Standard P&L metrics everyone recognizes.
 */
export const quarterlyFinancialData: QuarterlyFinancialRecord[] = [
  {periodEnd: isoDateDaysAgo(273), segment: 'Product', revenue: 4200000, netIncome: 580000, ebitda: 920000, grossProfit: 2100000},
  {periodEnd: isoDateDaysAgo(273), segment: 'Services', revenue: 1800000, netIncome: 320000, ebitda: 410000, grossProfit: 1080000},
  {periodEnd: isoDateDaysAgo(273), segment: 'Licensing', revenue: 900000, netIncome: 280000, ebitda: 310000, grossProfit: 810000},
  {periodEnd: isoDateDaysAgo(182), segment: 'Product', revenue: 5100000, netIncome: 720000, ebitda: 1100000, grossProfit: 2550000},
  {periodEnd: isoDateDaysAgo(182), segment: 'Services', revenue: 2200000, netIncome: 410000, ebitda: 530000, grossProfit: 1320000},
  {periodEnd: isoDateDaysAgo(182), segment: 'Licensing', revenue: 1100000, netIncome: 350000, ebitda: 390000, grossProfit: 990000},
  {periodEnd: isoDateDaysAgo(91), segment: 'Product', revenue: 4800000, netIncome: 640000, ebitda: 980000, grossProfit: 2400000},
  {periodEnd: isoDateDaysAgo(91), segment: 'Services', revenue: 2000000, netIncome: 360000, ebitda: 460000, grossProfit: 1200000},
  {periodEnd: isoDateDaysAgo(91), segment: 'Licensing', revenue: 950000, netIncome: 290000, ebitda: 330000, grossProfit: 855000},
  {periodEnd: isoDateDaysAgo(0), segment: 'Product', revenue: 5500000, netIncome: 780000, ebitda: 1180000, grossProfit: 2750000},
  {periodEnd: isoDateDaysAgo(0), segment: 'Services', revenue: 2500000, netIncome: 470000, ebitda: 600000, grossProfit: 1500000},
  {periodEnd: isoDateDaysAgo(0), segment: 'Licensing', revenue: 1200000, netIncome: 380000, ebitda: 420000, grossProfit: 1080000},
]

/**
 * Event calendar: conferences and workshops with attendance and revenue.
 */
export const eventProgramData: EventProgramRecord[] = [
  {eventDate: isoDateDaysAgo(71), city: 'Lisbon', format: 'Workshop', audience: 'Developers', isSoldOut: false, attendees: 140, ticketRevenue: 18200},
  {eventDate: isoDateDaysAgo(66), city: 'Montreal', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 320, ticketRevenue: 68400},
  {eventDate: isoDateDaysAgo(61), city: 'Singapore', format: 'Roundtable', audience: 'Operators', isSoldOut: false, attendees: 88, ticketRevenue: 12100},
  {eventDate: isoDateDaysAgo(55), city: 'Lisbon', format: 'Summit', audience: 'Developers', isSoldOut: true, attendees: 280, ticketRevenue: 55200},
  {eventDate: isoDateDaysAgo(49), city: 'Montreal', format: 'Workshop', audience: 'Operators', isSoldOut: false, attendees: 116, ticketRevenue: 14900},
  {eventDate: isoDateDaysAgo(44), city: 'Singapore', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 305, ticketRevenue: 70800},
  {eventDate: isoDateDaysAgo(38), city: 'Lisbon', format: 'Roundtable', audience: 'Operators', isSoldOut: false, attendees: 74, ticketRevenue: 9800},
  {eventDate: isoDateDaysAgo(30), city: 'Montreal', format: 'Workshop', audience: 'Developers', isSoldOut: false, attendees: 132, ticketRevenue: 17600},
  {eventDate: isoDateDaysAgo(25), city: 'Singapore', format: 'Summit', audience: 'Operators', isSoldOut: true, attendees: 294, ticketRevenue: 66300},
  {eventDate: isoDateDaysAgo(18), city: 'Lisbon', format: 'Workshop', audience: 'Executives', isSoldOut: false, attendees: 98, ticketRevenue: 15800},
  {eventDate: isoDateDaysAgo(11), city: 'Montreal', format: 'Roundtable', audience: 'Developers', isSoldOut: false, attendees: 82, ticketRevenue: 11400},
  {eventDate: isoDateDaysAgo(8), city: 'Singapore', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 338, ticketRevenue: 74100},
]

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
    columns: recipeLogColumns,
  },
  {
    id: 'quarterly-financials',
    label: 'Quarterly financials',
    description: 'Revenue, net income, EBITDA, and gross profit by segment and period.',
    data: quarterlyFinancialData,
    columns: quarterlyFinancialColumns,
  },
  {
    id: 'event-calendar',
    label: 'Event calendar',
    description: 'Conferences and workshops: format, audience, attendance, ticket revenue.',
    data: eventProgramData,
    columns: eventProgramColumns,
  },
] satisfies readonly [PlaygroundSource, ...PlaygroundSource[]]
