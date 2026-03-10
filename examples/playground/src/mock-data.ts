import {columns, type ChartColumn} from '@matthieumordrel/chart-studio'

export type SupportTicketRecord = {
  openedAt: string
  firstResponseAt: string
  resolvedAt: string
  team: 'Platform' | 'Billing' | 'Security'
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  intakeChannel: 'Email' | 'Chat' | 'Phone'
  slaBreached: boolean
  resolutionHours: number
  csatScore: number
}

export type ShipmentRecord = {
  bookedAt: string
  departedAt: string
  deliveredAt: string
  route: 'Berlin to Paris' | 'Osaka to Seoul' | 'Austin to Toronto'
  carrier: 'Northstar' | 'BlueRail' | 'Atlas Air'
  transportMode: 'Air' | 'Ground' | 'Rail'
  isTemperatureControlled: boolean
  palletCount: number
  freightCost: number
}

export type EventProgramRecord = {
  announcedAt: string
  eventStartsAt: string
  checkedInAt: string
  city: 'Lisbon' | 'Montreal' | 'Singapore'
  format: 'Workshop' | 'Summit' | 'Roundtable'
  audience: 'Developers' | 'Operators' | 'Executives'
  isSoldOut: boolean
  attendees: number
  ticketRevenue: number
}

/**
 * Named playground source with its own schema and data shape.
 */
export type PlaygroundSource = {
  id: string
  label: string
  description: string
  data: readonly unknown[]
  columns: readonly ChartColumn<never>[]
}

/**
 * Build a stable ISO date relative to "today" for demo charts.
 */
function isoDateDaysAgo(daysAgo: number, hour = 12): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

/**
 * Create a support ticket record with multiple lifecycle dates.
 */
function createSupportTicket({
  openedDaysAgo,
  firstResponseDaysAgo,
  resolvedDaysAgo,
  team,
  priority,
  intakeChannel,
  slaBreached,
  resolutionHours,
  csatScore,
}: {
  openedDaysAgo: number
  firstResponseDaysAgo: number
  resolvedDaysAgo: number
  team: SupportTicketRecord['team']
  priority: SupportTicketRecord['priority']
  intakeChannel: SupportTicketRecord['intakeChannel']
  slaBreached: boolean
  resolutionHours: number
  csatScore: number
}): SupportTicketRecord {
  return {
    openedAt: isoDateDaysAgo(openedDaysAgo, 9),
    firstResponseAt: isoDateDaysAgo(firstResponseDaysAgo, 10),
    resolvedAt: isoDateDaysAgo(resolvedDaysAgo, 16),
    team,
    priority,
    intakeChannel,
    slaBreached,
    resolutionHours,
    csatScore,
  }
}

/**
 * Create a shipment record with booking, departure, and delivery dates.
 */
function createShipment({
  bookedDaysAgo,
  departedDaysAgo,
  deliveredDaysAgo,
  route,
  carrier,
  transportMode,
  isTemperatureControlled,
  palletCount,
  freightCost,
}: {
  bookedDaysAgo: number
  departedDaysAgo: number
  deliveredDaysAgo: number
  route: ShipmentRecord['route']
  carrier: ShipmentRecord['carrier']
  transportMode: ShipmentRecord['transportMode']
  isTemperatureControlled: boolean
  palletCount: number
  freightCost: number
}): ShipmentRecord {
  return {
    bookedAt: isoDateDaysAgo(bookedDaysAgo, 8),
    departedAt: isoDateDaysAgo(departedDaysAgo, 13),
    deliveredAt: isoDateDaysAgo(deliveredDaysAgo, 18),
    route,
    carrier,
    transportMode,
    isTemperatureControlled,
    palletCount,
    freightCost,
  }
}

/**
 * Create an event program record with planning and attendance dates.
 */
function createEventProgram({
  announcedDaysAgo,
  eventStartsDaysAgo,
  checkedInDaysAgo,
  city,
  format,
  audience,
  isSoldOut,
  attendees,
  ticketRevenue,
}: {
  announcedDaysAgo: number
  eventStartsDaysAgo: number
  checkedInDaysAgo: number
  city: EventProgramRecord['city']
  format: EventProgramRecord['format']
  audience: EventProgramRecord['audience']
  isSoldOut: boolean
  attendees: number
  ticketRevenue: number
}): EventProgramRecord {
  return {
    announcedAt: isoDateDaysAgo(announcedDaysAgo, 11),
    eventStartsAt: isoDateDaysAgo(eventStartsDaysAgo, 9),
    checkedInAt: isoDateDaysAgo(checkedInDaysAgo, 10),
    city,
    format,
    audience,
    isSoldOut,
    attendees,
    ticketRevenue,
  }
}

/**
 * Support desk schema with lifecycle dates and operational metrics.
 */
export const supportTicketColumns = [
  columns.date<SupportTicketRecord>('openedAt', {label: 'Opened At'}),
  columns.date<SupportTicketRecord>('firstResponseAt', {label: 'First Response'}),
  columns.date<SupportTicketRecord>('resolvedAt', {label: 'Resolved At'}),
  columns.category<SupportTicketRecord>('team', {label: 'Team'}),
  columns.category<SupportTicketRecord>('priority', {label: 'Priority'}),
  columns.category<SupportTicketRecord>('intakeChannel', {label: 'Channel'}),
  columns.boolean<SupportTicketRecord>('slaBreached', {
    label: 'SLA',
    trueLabel: 'Breached',
    falseLabel: 'Within SLA',
  }),
  columns.number<SupportTicketRecord>('resolutionHours', {label: 'Resolution Hours'}),
  columns.number<SupportTicketRecord>('csatScore', {label: 'CSAT Score'}),
]

/**
 * Freight operations schema with route, carrier, and shipment metrics.
 */
export const shipmentColumns = [
  columns.date<ShipmentRecord>('bookedAt', {label: 'Booked At'}),
  columns.date<ShipmentRecord>('departedAt', {label: 'Departed At'}),
  columns.date<ShipmentRecord>('deliveredAt', {label: 'Delivered At'}),
  columns.category<ShipmentRecord>('route', {label: 'Route'}),
  columns.category<ShipmentRecord>('carrier', {label: 'Carrier'}),
  columns.category<ShipmentRecord>('transportMode', {label: 'Mode'}),
  columns.boolean<ShipmentRecord>('isTemperatureControlled', {
    label: 'Temperature',
    trueLabel: 'Controlled',
    falseLabel: 'Ambient',
  }),
  columns.number<ShipmentRecord>('palletCount', {label: 'Pallets'}),
  columns.number<ShipmentRecord>('freightCost', {label: 'Freight Cost'}),
]

/**
 * Events program schema with planning dates and attendance metrics.
 */
export const eventProgramColumns = [
  columns.date<EventProgramRecord>('announcedAt', {label: 'Announced At'}),
  columns.date<EventProgramRecord>('eventStartsAt', {label: 'Event Starts'}),
  columns.date<EventProgramRecord>('checkedInAt', {label: 'Check-in Date'}),
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
 * Support desk dataset with a mix of urgent escalations and normal tickets.
 */
export const supportTicketData: SupportTicketRecord[] = [
  createSupportTicket({openedDaysAgo: 176, firstResponseDaysAgo: 175, resolvedDaysAgo: 171, team: 'Platform', priority: 'High', intakeChannel: 'Email', slaBreached: false, resolutionHours: 18, csatScore: 4.7}),
  createSupportTicket({openedDaysAgo: 169, firstResponseDaysAgo: 168, resolvedDaysAgo: 164, team: 'Platform', priority: 'Medium', intakeChannel: 'Phone', slaBreached: false, resolutionHours: 15, csatScore: 4.2}),
  createSupportTicket({openedDaysAgo: 161, firstResponseDaysAgo: 160, resolvedDaysAgo: 156, team: 'Billing', priority: 'Medium', intakeChannel: 'Chat', slaBreached: false, resolutionHours: 9, csatScore: 4.4}),
  createSupportTicket({openedDaysAgo: 149, firstResponseDaysAgo: 148, resolvedDaysAgo: 142, team: 'Security', priority: 'Urgent', intakeChannel: 'Phone', slaBreached: true, resolutionHours: 31, csatScore: 3.8}),
  createSupportTicket({openedDaysAgo: 136, firstResponseDaysAgo: 135, resolvedDaysAgo: 132, team: 'Platform', priority: 'Low', intakeChannel: 'Chat', slaBreached: false, resolutionHours: 5, csatScore: 4.9}),
  createSupportTicket({openedDaysAgo: 122, firstResponseDaysAgo: 121, resolvedDaysAgo: 118, team: 'Billing', priority: 'High', intakeChannel: 'Email', slaBreached: false, resolutionHours: 14, csatScore: 4.5}),
  createSupportTicket({openedDaysAgo: 109, firstResponseDaysAgo: 108, resolvedDaysAgo: 101, team: 'Security', priority: 'Urgent', intakeChannel: 'Phone', slaBreached: true, resolutionHours: 42, csatScore: 3.6}),
  createSupportTicket({openedDaysAgo: 101, firstResponseDaysAgo: 100, resolvedDaysAgo: 95, team: 'Billing', priority: 'Low', intakeChannel: 'Email', slaBreached: false, resolutionHours: 7, csatScore: 4.8}),
  createSupportTicket({openedDaysAgo: 92, firstResponseDaysAgo: 91, resolvedDaysAgo: 88, team: 'Platform', priority: 'Medium', intakeChannel: 'Email', slaBreached: false, resolutionHours: 11, csatScore: 4.8}),
  createSupportTicket({openedDaysAgo: 77, firstResponseDaysAgo: 76, resolvedDaysAgo: 72, team: 'Billing', priority: 'Low', intakeChannel: 'Chat', slaBreached: false, resolutionHours: 6, csatScore: 4.6}),
  createSupportTicket({openedDaysAgo: 63, firstResponseDaysAgo: 62, resolvedDaysAgo: 58, team: 'Security', priority: 'High', intakeChannel: 'Phone', slaBreached: true, resolutionHours: 27, csatScore: 4.0}),
  createSupportTicket({openedDaysAgo: 45, firstResponseDaysAgo: 44, resolvedDaysAgo: 40, team: 'Platform', priority: 'Medium', intakeChannel: 'Email', slaBreached: false, resolutionHours: 12, csatScore: 4.7}),
  createSupportTicket({openedDaysAgo: 36, firstResponseDaysAgo: 35, resolvedDaysAgo: 30, team: 'Platform', priority: 'Urgent', intakeChannel: 'Chat', slaBreached: true, resolutionHours: 29, csatScore: 3.9}),
  createSupportTicket({openedDaysAgo: 28, firstResponseDaysAgo: 27, resolvedDaysAgo: 23, team: 'Billing', priority: 'High', intakeChannel: 'Phone', slaBreached: true, resolutionHours: 24, csatScore: 4.1}),
  createSupportTicket({openedDaysAgo: 14, firstResponseDaysAgo: 13, resolvedDaysAgo: 10, team: 'Security', priority: 'Medium', intakeChannel: 'Chat', slaBreached: false, resolutionHours: 8, csatScore: 4.3}),
  createSupportTicket({openedDaysAgo: 6, firstResponseDaysAgo: 5, resolvedDaysAgo: 2, team: 'Billing', priority: 'Low', intakeChannel: 'Email', slaBreached: false, resolutionHours: 4, csatScore: 4.9}),
]

/**
 * Freight dataset covering multiple carriers and transport modes.
 */
export const shipmentData: ShipmentRecord[] = [
  createShipment({bookedDaysAgo: 412, departedDaysAgo: 408, deliveredDaysAgo: 401, route: 'Berlin to Paris', carrier: 'BlueRail', transportMode: 'Rail', isTemperatureControlled: false, palletCount: 14, freightCost: 12400}),
  createShipment({bookedDaysAgo: 358, departedDaysAgo: 355, deliveredDaysAgo: 349, route: 'Osaka to Seoul', carrier: 'Atlas Air', transportMode: 'Air', isTemperatureControlled: true, palletCount: 8, freightCost: 21300}),
  createShipment({bookedDaysAgo: 307, departedDaysAgo: 304, deliveredDaysAgo: 298, route: 'Austin to Toronto', carrier: 'Northstar', transportMode: 'Ground', isTemperatureControlled: false, palletCount: 18, freightCost: 9800}),
  createShipment({bookedDaysAgo: 241, departedDaysAgo: 238, deliveredDaysAgo: 232, route: 'Berlin to Paris', carrier: 'BlueRail', transportMode: 'Rail', isTemperatureControlled: true, palletCount: 11, freightCost: 14100}),
  createShipment({bookedDaysAgo: 187, departedDaysAgo: 184, deliveredDaysAgo: 179, route: 'Osaka to Seoul', carrier: 'Atlas Air', transportMode: 'Air', isTemperatureControlled: true, palletCount: 6, freightCost: 22800}),
  createShipment({bookedDaysAgo: 126, departedDaysAgo: 123, deliveredDaysAgo: 118, route: 'Austin to Toronto', carrier: 'Northstar', transportMode: 'Ground', isTemperatureControlled: false, palletCount: 21, freightCost: 11200}),
  createShipment({bookedDaysAgo: 73, departedDaysAgo: 70, deliveredDaysAgo: 64, route: 'Berlin to Paris', carrier: 'BlueRail', transportMode: 'Rail', isTemperatureControlled: false, palletCount: 13, freightCost: 13600}),
  createShipment({bookedDaysAgo: 17, departedDaysAgo: 14, deliveredDaysAgo: 9, route: 'Osaka to Seoul', carrier: 'Atlas Air', transportMode: 'Air', isTemperatureControlled: true, palletCount: 9, freightCost: 21900}),
]

/**
 * Events dataset with different formats, audiences, and commercial outcomes.
 */
export const eventProgramData: EventProgramRecord[] = [
  createEventProgram({announcedDaysAgo: 71, eventStartsDaysAgo: 58, checkedInDaysAgo: 58, city: 'Lisbon', format: 'Workshop', audience: 'Developers', isSoldOut: false, attendees: 140, ticketRevenue: 18200}),
  createEventProgram({announcedDaysAgo: 66, eventStartsDaysAgo: 54, checkedInDaysAgo: 54, city: 'Montreal', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 320, ticketRevenue: 68400}),
  createEventProgram({announcedDaysAgo: 61, eventStartsDaysAgo: 49, checkedInDaysAgo: 49, city: 'Singapore', format: 'Roundtable', audience: 'Operators', isSoldOut: false, attendees: 88, ticketRevenue: 12100}),
  createEventProgram({announcedDaysAgo: 55, eventStartsDaysAgo: 43, checkedInDaysAgo: 43, city: 'Lisbon', format: 'Summit', audience: 'Developers', isSoldOut: true, attendees: 280, ticketRevenue: 55200}),
  createEventProgram({announcedDaysAgo: 49, eventStartsDaysAgo: 37, checkedInDaysAgo: 37, city: 'Montreal', format: 'Workshop', audience: 'Operators', isSoldOut: false, attendees: 116, ticketRevenue: 14900}),
  createEventProgram({announcedDaysAgo: 44, eventStartsDaysAgo: 32, checkedInDaysAgo: 32, city: 'Singapore', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 305, ticketRevenue: 70800}),
  createEventProgram({announcedDaysAgo: 38, eventStartsDaysAgo: 27, checkedInDaysAgo: 27, city: 'Lisbon', format: 'Roundtable', audience: 'Operators', isSoldOut: false, attendees: 74, ticketRevenue: 9800}),
  createEventProgram({announcedDaysAgo: 30, eventStartsDaysAgo: 21, checkedInDaysAgo: 21, city: 'Montreal', format: 'Workshop', audience: 'Developers', isSoldOut: false, attendees: 132, ticketRevenue: 17600}),
  createEventProgram({announcedDaysAgo: 25, eventStartsDaysAgo: 15, checkedInDaysAgo: 15, city: 'Singapore', format: 'Summit', audience: 'Operators', isSoldOut: true, attendees: 294, ticketRevenue: 66300}),
  createEventProgram({announcedDaysAgo: 18, eventStartsDaysAgo: 10, checkedInDaysAgo: 10, city: 'Lisbon', format: 'Workshop', audience: 'Executives', isSoldOut: false, attendees: 98, ticketRevenue: 15800}),
  createEventProgram({announcedDaysAgo: 11, eventStartsDaysAgo: 4, checkedInDaysAgo: 4, city: 'Montreal', format: 'Roundtable', audience: 'Developers', isSoldOut: false, attendees: 82, ticketRevenue: 11400}),
  createEventProgram({announcedDaysAgo: 8, eventStartsDaysAgo: 1, checkedInDaysAgo: 1, city: 'Singapore', format: 'Summit', audience: 'Executives', isSoldOut: true, attendees: 338, ticketRevenue: 74100}),
  createEventProgram({announcedDaysAgo: 6, eventStartsDaysAgo: 0, checkedInDaysAgo: 0, city: 'Lisbon', format: 'Workshop', audience: 'Operators', isSoldOut: false, attendees: 104, ticketRevenue: 13600}),
  createEventProgram({announcedDaysAgo: 3, eventStartsDaysAgo: 0, checkedInDaysAgo: 0, city: 'Singapore', format: 'Roundtable', audience: 'Developers', isSoldOut: false, attendees: 67, ticketRevenue: 9100}),
]

/**
 * Source catalog used by the playground source switcher.
 * Each source intentionally uses a different schema so source changes stress-test state resets.
 */
export const playgroundSources = [
  {
    id: 'support-desk',
    label: 'Support desk',
    description: 'Ticket operations with response timing, SLA performance, and satisfaction scores.',
    data: supportTicketData,
    columns: supportTicketColumns,
  },
  {
    id: 'shipment-ops',
    label: 'Shipment ops',
    description: 'Freight movement across carriers, routes, and transport modes.',
    data: shipmentData,
    columns: shipmentColumns,
  },
  {
    id: 'events-program',
    label: 'Events program',
    description: 'Commercial event performance with planning, attendance, and sell-through signals.',
    data: eventProgramData,
    columns: eventProgramColumns,
  },
] satisfies PlaygroundSource[]
