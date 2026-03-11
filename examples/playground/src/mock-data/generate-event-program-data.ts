import type { EventProgramRecord } from '../mock-data'
import { isoDateDaysAgo, seededRandom } from './utils'

const CITIES = ['Lisbon', 'Montreal', 'Singapore', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'London'] as const
const FORMATS = ['Workshop', 'Summit', 'Roundtable'] as const
const AUDIENCES = ['Developers', 'Executives', 'Operators', 'Designers', 'Marketers'] as const

/**
 * Generate event records – many events over several years.
 */
export function generateEventProgramData(count: number): EventProgramRecord[] {
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
      ticketRevenue
    })
  }
  return out.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
}
