import type { QuarterlyFinancialRecord } from '../mock-data'
import { seededRandom } from './utils'

const SEGMENTS = ['Product', 'Services', 'Licensing'] as const

/**
 * Build a stable ISO timestamp for the last completed quarter end.
 *
 * Using UTC noon avoids local timezone and DST offsets shifting the ISO date
 * onto the previous or next day.
 */
function isoDateQuarterEnd(quartersAgo: number): string {
  const today = new Date()
  const currentQuarterIndex = Math.floor(today.getUTCMonth() / 3)
  const lastCompletedQuarterIndex = currentQuarterIndex - 1 - quartersAgo
  const year = today.getUTCFullYear() + Math.floor(lastCompletedQuarterIndex / 4)
  const normalizedQuarterIndex = ((lastCompletedQuarterIndex % 4) + 4) % 4
  const quarterEndMonth = normalizedQuarterIndex * 3 + 2

  return new Date(Date.UTC(year, quarterEndMonth + 1, 0, 12, 0, 0, 0)).toISOString()
}

/**
 * Generate quarterly financial records – many quarters × segments.
 */
export function generateQuarterlyFinancialData(): QuarterlyFinancialRecord[] {
  const out: QuarterlyFinancialRecord[] = []
  const baseRevenue = { Product: 4e6, Services: 1.8e6, Licensing: 9e5 }
  const baseGrowth = 1.02
  for (let q = 0; q < 24; q++) {
    const growth = Math.pow(baseGrowth, q)
    for (const segment of SEGMENTS) {
      const rev = Math.round(baseRevenue[segment as keyof typeof baseRevenue] * growth * (0.9 + seededRandom(q * 31 + segment.length) * 0.2))
      out.push({
        periodEnd: isoDateQuarterEnd(q),
        segment,
        revenue: rev,
        netIncome: Math.round(rev * (0.12 + seededRandom(q * 37) * 0.08)),
        ebitda: Math.round(rev * (0.2 + seededRandom(q * 41) * 0.1)),
        grossProfit: Math.round(rev * (0.48 + seededRandom(q * 43) * 0.1))
      })
    }
  }
  return out.sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
}
