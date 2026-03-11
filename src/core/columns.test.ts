import {describe, expect, it} from 'vitest'
import {columns} from './columns.js'

describe('columns', () => {
  it('humanizes camelCase, snake_case, and kebab-case labels by default', () => {
    type ExampleRecord = {
      createdAt: string
      gross_profit: number
      'ticket-revenue': number
    }

    const createdAt = columns.date<ExampleRecord>('createdAt')
    const grossProfit = columns.number<ExampleRecord>('gross_profit')
    const ticketRevenue = columns.number<ExampleRecord>('ticket-revenue')

    expect(createdAt.label).toBe('Created At')
    expect(grossProfit.label).toBe('Gross Profit')
    expect(ticketRevenue.label).toBe('Ticket Revenue')
  })
})
