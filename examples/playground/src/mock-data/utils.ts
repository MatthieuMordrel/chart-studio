/**
 * Build a stable ISO date relative to "today" for demo charts.
 */
export function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

/** Seeded pseudo-random for reproducible stress-test data. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}
