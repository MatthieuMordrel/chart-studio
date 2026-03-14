import { defineChartSchema, useChart } from '@matthieumordrel/chart-studio'
import { Chart, ChartCanvas, ChartToolbar } from '@matthieumordrel/chart-studio/ui'
import { eventProgramData, type EventProgramRecord } from '../mock-data'

// ─── Chart 1: Revenue Trend Over Time ───────────────────────────────────────
// Line chart showing ticket revenue by quarter, grouped by format.
// Tells the story: "How is our event revenue evolving?"

const revenueTrendSchema = defineChartSchema<EventProgramRecord>()
  .columns((c) => [
    c.date('eventDate', { label: 'Event Date' }),
    c.category('format'),
    c.number('ticketRevenue', { label: 'Ticket Revenue', format: 'currency' }),
    c.number('attendees', { label: 'Attendees' }),
    c.exclude('city'),
    c.exclude('audience'),
    c.exclude('isSoldOut'),
  ])
  .xAxis((x) => x.allowed('eventDate').default('eventDate'))
  .chartType((t) => t.allowed('line', 'area').default('area'))
  .timeBucket((tb) => tb.allowed('quarter', 'month').default('quarter'))
  .groupBy((g) => g.allowed('format').default('format'))
  .metric((m) => m.aggregate('ticketRevenue', 'sum').defaultAggregate('ticketRevenue', 'sum'))

function RevenueTrendChart() {
  const chart = useChart({ data: eventProgramData, schema: revenueTrendSchema })

  return (
    <DashboardPanel title='Revenue Trend' subtitle='Quarterly ticket revenue by event format'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['dateRange', 'timeBucket']} hidden={['source', 'xAxis', 'groupBy', 'filters', 'metric']} />
        <div className='mt-3'>
          <ChartCanvas height={240} />
        </div>
      </Chart>
    </DashboardPanel>
  )
}

// ─── Chart 2: Attendance by City ─────────────────────────────────────────────
// Bar chart showing total attendees per city.
// Tells the story: "Which cities attract the most attendees?"

const attendanceByCitySchema = defineChartSchema<EventProgramRecord>()
  .columns((c) => [
    c.date('eventDate', { label: 'Event Date' }),
    c.category('city', { label: 'City' }),
    c.number('attendees', { label: 'Attendees' }),
    c.exclude('format'),
    c.exclude('audience'),
    c.exclude('isSoldOut'),
    c.exclude('ticketRevenue'),
  ])
  .xAxis((x) => x.allowed('city').default('city'))
  .chartType((t) => t.allowed('bar').default('bar'))
  .metric((m) => m.aggregate('attendees', 'sum').defaultAggregate('attendees', 'sum'))

function AttendanceByCityChart() {
  const chart = useChart({ data: eventProgramData, schema: attendanceByCitySchema })

  return (
    <DashboardPanel title='Attendance by City' subtitle='Total attendees across all events'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['dateRange']} hidden={['source', 'xAxis', 'groupBy', 'filters', 'metric', 'chartType', 'timeBucket']} />
        <div className='mt-3'>
          <ChartCanvas height={240} showDataLabels />
        </div>
      </Chart>
    </DashboardPanel>
  )
}

// ─── Chart 3: Event Format Mix ───────────────────────────────────────────────
// Donut chart showing count of events per format.
// Tells the story: "What's our event format distribution?"

const formatMixSchema = defineChartSchema<EventProgramRecord>()
  .columns((c) => [
    c.date('eventDate', { label: 'Event Date' }),
    c.category('format', { label: 'Format' }),
    c.number('attendees', { label: 'Attendees' }),
    c.exclude('city'),
    c.exclude('audience'),
    c.exclude('isSoldOut'),
    c.exclude('ticketRevenue'),
  ])
  .xAxis((x) => x.allowed('format').default('format'))
  .chartType((t) => t.allowed('donut', 'pie').default('donut'))
  .metric((m) => m.aggregate('attendees', 'sum').defaultAggregate('attendees', 'sum'))

function FormatMixChart() {
  const chart = useChart({ data: eventProgramData, schema: formatMixSchema })

  return (
    <DashboardPanel title='Format Mix' subtitle='Total attendees by event format'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['dateRange', 'chartType']} hidden={['source', 'xAxis', 'groupBy', 'filters', 'timeBucket', 'metric']} />
        <div className='mt-3'>
          <ChartCanvas height={240} showDataLabels />
        </div>
      </Chart>
    </DashboardPanel>
  )
}

// ─── Chart 4: Revenue per Audience Segment ───────────────────────────────────
// Grouped bar chart showing avg ticket revenue by audience, grouped by sold-out status.
// Tells the story: "Which audiences generate the most revenue, and how does sell-out affect it?"

const audienceRevenueSchema = defineChartSchema<EventProgramRecord>()
  .columns((c) => [
    c.date('eventDate', { label: 'Event Date' }),
    c.category('audience', { label: 'Audience' }),
    c.boolean('isSoldOut', { label: 'Inventory', trueLabel: 'Sold Out', falseLabel: 'Available' }),
    c.number('ticketRevenue', { label: 'Avg Revenue', format: 'currency' }),
    c.exclude('city'),
    c.exclude('format'),
    c.exclude('attendees'),
  ])
  .xAxis((x) => x.allowed('audience').default('audience'))
  .chartType((t) => t.allowed('grouped-bar', 'bar').default('grouped-bar'))
  .groupBy((g) => g.allowed('isSoldOut').default('isSoldOut'))
  .metric((m) => m.aggregate('ticketRevenue', 'avg').defaultAggregate('ticketRevenue', 'avg'))

function AudienceRevenueChart() {
  const chart = useChart({ data: eventProgramData, schema: audienceRevenueSchema })

  return (
    <DashboardPanel title='Revenue by Audience' subtitle='Avg ticket revenue by audience & sell-out status'>
      <Chart chart={chart}>
        <ChartToolbar pinned={['dateRange']} hidden={['source', 'xAxis', 'groupBy', 'filters', 'metric', 'chartType', 'timeBucket']} />
        <div className='mt-3'>
          <ChartCanvas height={240} showDataLabels />
        </div>
      </Chart>
    </DashboardPanel>
  )
}

// ─── Dashboard Panel wrapper ─────────────────────────────────────────────────

function DashboardPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className='overflow-hidden rounded-xl border border-border bg-background'>
      <div className='border-b border-border px-4 py-3'>
        <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
        <p className='text-xs text-muted-foreground'>{subtitle}</p>
      </div>
      <div className='p-4'>{children}</div>
    </div>
  )
}

// ─── Dashboard Layout ────────────────────────────────────────────────────────

export function DashboardChart() {
  return (
    <div className='space-y-4'>
      <div className='rounded-lg border border-primary/20 bg-primary/5 px-4 py-3'>
        <h2 className='text-sm font-semibold text-foreground'>Global Events Program — Performance Dashboard</h2>
        <p className='mt-0.5 text-xs text-muted-foreground'>
          Four focused charts from a single dataset. Each chart uses <code className='rounded bg-muted px-1 font-mono text-[11px]'>defineChartSchema</code> to
          lock axes, chart types, and metrics — showing only the controls that matter for each view.
        </p>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <RevenueTrendChart />
        <AttendanceByCityChart />
        <FormatMixChart />
        <AudienceRevenueChart />
      </div>
    </div>
  )
}
