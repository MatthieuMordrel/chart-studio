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

const DISHES = [
  {dish: 'Spaghetti Carbonara' as const, cuisine: 'Italian' as const, prep: 15, cook: 20, difficulty: 'Medium' as const},
  {dish: 'Tacos al Pastor', cuisine: 'Mexican', prep: 30, cook: 25, difficulty: 'Medium'},
  {dish: 'Fried Rice', cuisine: 'Asian', prep: 10, cook: 15, difficulty: 'Easy'},
  {dish: 'Grilled Cheese', cuisine: 'American', prep: 2, cook: 5, difficulty: 'Easy'},
  {dish: 'Risotto', cuisine: 'Italian', prep: 15, cook: 35, difficulty: 'Hard'},
  {dish: 'Burrito Bowl', cuisine: 'Mexican', prep: 20, cook: 10, difficulty: 'Easy'},
  {dish: 'Pad Thai', cuisine: 'Asian', prep: 25, cook: 15, difficulty: 'Medium'},
  {dish: 'Mac and Cheese', cuisine: 'American', prep: 5, cook: 15, difficulty: 'Easy'},
  {dish: 'Lasagna', cuisine: 'Italian', prep: 45, cook: 60, difficulty: 'Hard'},
  {dish: 'Quesadilla', cuisine: 'Mexican', prep: 5, cook: 8, difficulty: 'Easy'},
  {dish: 'Stir Fry', cuisine: 'Asian', prep: 20, cook: 10, difficulty: 'Medium'},
  {dish: 'Pizza Margherita', cuisine: 'Italian', prep: 20, cook: 15, difficulty: 'Medium'},
  {dish: 'Enchiladas', cuisine: 'Mexican', prep: 25, cook: 25, difficulty: 'Medium'},
  {dish: 'Ramen', cuisine: 'Asian', prep: 40, cook: 20, difficulty: 'Hard'},
  {dish: 'Burgers', cuisine: 'American', prep: 10, cook: 12, difficulty: 'Easy'},
  {dish: 'Pasta Puttanesca', cuisine: 'Italian', prep: 10, cook: 15, difficulty: 'Easy'},
  {dish: 'Guacamole', cuisine: 'Mexican', prep: 10, cook: 0, difficulty: 'Easy'},
  {dish: 'Dumplings', cuisine: 'Asian', prep: 35, cook: 12, difficulty: 'Medium'},
  {dish: 'Pancakes', cuisine: 'American', prep: 5, cook: 10, difficulty: 'Easy'},
] as const

const CITIES = ['Lisbon', 'Montreal', 'Singapore', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'London'] as const
const FORMATS = ['Workshop', 'Summit', 'Roundtable'] as const
const AUDIENCES = ['Developers', 'Executives', 'Operators', 'Designers', 'Marketers'] as const
const SEGMENTS = ['Product', 'Services', 'Licensing'] as const

/** Seeded pseudo-random for reproducible stress-test data. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/** Generate home cooking records – many points over ~18 months. */
function generateRecipeLogData(count: number): RecipeLogRecord[] {
  const out: RecipeLogRecord[] = []
  for (let i = 0; i < count; i++) {
    const d = DISHES[Math.floor(seededRandom(i * 7) * DISHES.length)]
    const daysAgo = Math.floor(seededRandom(i * 11) * 550)
    const rating = Math.floor(seededRandom(i * 13) * 3) + 3 // 3–5
    out.push({
      cookedAt: isoDateDaysAgo(daysAgo),
      dish: d.dish,
      cuisine: d.cuisine,
      prepMinutes: d.prep + Math.floor(seededRandom(i * 17) * 10),
      cookMinutes: d.cook + Math.floor(seededRandom(i * 19) * 15),
      difficulty: d.difficulty,
      rating,
    })
  }
  return out.sort((a, b) => new Date(a.cookedAt).getTime() - new Date(b.cookedAt).getTime())
}

/** Generate quarterly financial records – many quarters × segments. */
function generateQuarterlyFinancialData(): QuarterlyFinancialRecord[] {
  const out: QuarterlyFinancialRecord[] = []
  const baseRevenue = {Product: 4e6, Services: 1.8e6, Licensing: 9e5}
  const baseGrowth = 1.02
  for (let q = 0; q < 24; q++) {
    const daysAgo = 90 * q + 15
    const growth = Math.pow(baseGrowth, q)
    for (const segment of SEGMENTS) {
      const rev = Math.round(baseRevenue[segment as keyof typeof baseRevenue] * growth * (0.9 + seededRandom(q * 31 + segment.length) * 0.2))
      out.push({
        periodEnd: isoDateDaysAgo(daysAgo),
        segment,
        revenue: rev,
        netIncome: Math.round(rev * (0.12 + seededRandom(q * 37) * 0.08)),
        ebitda: Math.round(rev * (0.2 + seededRandom(q * 41) * 0.1)),
        grossProfit: Math.round(rev * (0.48 + seededRandom(q * 43) * 0.1)),
      })
    }
  }
  return out.sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
}

/** Generate event records – many events over several years. */
function generateEventProgramData(count: number): EventProgramRecord[] {
  const out: EventProgramRecord[] = []
  for (let i = 0; i < count; i++) {
    const city = CITIES[Math.floor(seededRandom(i * 53) * CITIES.length)]
    const format = FORMATS[Math.floor(seededRandom(i * 59) * FORMATS.length)]
    const audience = AUDIENCES[Math.floor(seededRandom(i * 61) * AUDIENCES.length)]
    const daysAgo = Math.floor(seededRandom(i * 67) * 730)
    const isSoldOut = seededRandom(i * 71) > 0.5
    const attendees = Math.floor(80 + seededRandom(i * 73) * 280)
    const ticketRevenue = Math.round(attendees * (90 + seededRandom(i * 79) * 150))
    out.push({
      eventDate: isoDateDaysAgo(daysAgo),
      city,
      format,
      audience,
      isSoldOut,
      attendees,
      ticketRevenue,
    })
  }
  return out.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
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
