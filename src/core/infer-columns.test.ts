import {describe, expect, it, vi} from 'vitest'
import {inferColumnsFromData} from './infer-columns.js'

describe('inferColumnsFromData', () => {
  it('infers primitive fields, formatter presets, and excludes unsupported values', () => {
    const data = [
      {
        createdAt: '2026-01-10',
        gross_profit: 125000,
        'ticket-revenue': 125000,
        updatedTime: '2026-01-10T14:30:00Z',
        revenue: 125000,
        conversionRate: 0.183,
        isReturning: true,
        channel: 'Organic',
        metadata: {region: 'EU'},
        emptyField: null,
      },
      {
        createdAt: '2026-02-14',
        gross_profit: 98000,
        'ticket-revenue': 98000,
        updatedTime: '2026-02-14T09:15:00Z',
        revenue: 98000,
        conversionRate: 0.127,
        isReturning: null,
        channel: 'Paid',
        metadata: {region: 'US'},
        emptyField: null,
      },
    ] as const

    const columns = inferColumnsFromData(data)
    const byId = new Map<string, (typeof columns)[number]>(columns.map((column) => [column.id, column]))

    expect(byId.get('createdAt')?.type).toBe('date')
    expect(byId.get('gross_profit')?.label).toBe('Gross Profit')
    expect(byId.get('ticket-revenue')?.label).toBe('Ticket Revenue')
    expect(byId.get('createdAt')?.format).toBe('datetime')
    expect(byId.get('updatedTime')?.type).toBe('date')
    expect(byId.get('updatedTime')?.format).toBe('datetime')
    expect(byId.get('revenue')?.type).toBe('number')
    expect(byId.get('revenue')?.format).toBe('currency')
    expect(byId.get('conversionRate')?.type).toBe('number')
    expect(byId.get('conversionRate')?.format).toBe('percent')
    expect(byId.get('isReturning')?.type).toBe('boolean')
    expect(byId.get('channel')?.type).toBe('category')
    expect(byId.has('metadata')).toBe(false)
    expect(byId.has('emptyField')).toBe(false)
  })

  it('allows schema columns to override ambiguous inference and exclude fields', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = [
      {
        milestone: '03/01/2026',
        launchedAt: '2026-03-01T10:30:00Z',
        internalId: 'rel-123',
        notes: 'Launch week',
      },
      {
        milestone: '04/01/2026',
        launchedAt: '2026-04-01T08:00:00Z',
        internalId: 'rel-456',
        notes: 'Follow-up',
      },
    ] as const

    const columns = inferColumnsFromData(data, {
      columns: {
        milestone: {type: 'date', label: 'Milestone Day'},
        internalId: false,
      },
    } as const)

    const byId = new Map<string, (typeof columns)[number]>(columns.map((column) => [column.id, column]))

    expect(byId.get('milestone')?.type).toBe('date')
    expect(byId.get('milestone')?.label).toBe('Milestone Day')
    expect(byId.get('launchedAt')?.type).toBe('date')
    expect(byId.get('launchedAt')?.format).toBe('datetime')
    expect(byId.has('internalId')).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      '[chart-studio] schema.columns.milestone overrides inferred type "category" with "date".',
    )
    warnSpy.mockRestore()
  })

  it('treats numeric timestamps as date columns when the key is date-like', () => {
    const data = [
      {orderedAt: 1767225600, revenue: 200, region: 'EMEA'},
      {orderedAt: 1769904000, revenue: 350, region: 'NA'},
    ] as const

    const columns = inferColumnsFromData(data)
    const byId = new Map<string, (typeof columns)[number]>(columns.map((column) => [column.id, column]))

    expect(byId.get('orderedAt')?.type).toBe('date')
    expect(byId.get('orderedAt')?.format).toBe('datetime')
    expect(byId.get('revenue')?.type).toBe('number')
    expect(byId.get('region')?.type).toBe('category')
  })

  it('keeps derived columns additive-only at runtime even when untyped input reuses a raw field id', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = [
      {createdAt: '2026-01-10', revenue: 200},
      {createdAt: '2026-02-14', revenue: 350},
    ] as const

    const columns = inferColumnsFromData(data, {
      columns: {
        revenue: {
          kind: 'derived',
          type: 'number',
          label: 'Derived Revenue',
          accessor: () => 999,
        },
      },
    } as unknown as Parameters<typeof inferColumnsFromData<typeof data[number]>>[1])

    const revenueColumns = columns.filter(column => column.id === 'revenue')

    expect(revenueColumns).toHaveLength(1)
    expect(revenueColumns[0]?.label).toBe('Revenue')
    expect(warnSpy).toHaveBeenCalledWith(
      '[chart-studio] schema.columns.revenue cannot be derived because derived columns must use a new id instead of replacing a raw field.',
    )
    warnSpy.mockRestore()
  })
})
