import {columns} from '@matthieumordrel/chart-studio'

export type JobStage = 'Applied' | 'Interview' | 'Offer' | 'Hired'
export type JobRegion = 'North America' | 'Europe' | 'APAC'

/**
 * Playground record used to visually exercise the chart UI.
 */
export type JobRecord = {
  dateAdded: string
  ownerName: string
  stage: JobStage
  region: JobRegion
  isOpen: boolean
  salary: number
}

/**
 * Named playground source with a short description for the demo inspector UI.
 */
export type PlaygroundSource = {
  id: string
  label: string
  description: string
  data: JobRecord[]
  columns: typeof jobColumns
}

/**
 * Build a stable ISO date relative to "today" for demo charts.
 */
function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

/**
 * Small factory that keeps the demo dataset easy to scan.
 */
function createJob(
  daysAgo: number,
  ownerName: string,
  stage: JobStage,
  region: JobRegion,
  isOpen: boolean,
  salary: number,
): JobRecord {
  return {
    dateAdded: isoDateDaysAgo(daysAgo),
    ownerName,
    stage,
    region,
    isOpen,
    salary,
  }
}

/**
 * Shared columns for all playground charts.
 * These intentionally cover every major capability: date, category, boolean, and metric.
 */
export const jobColumns = [
  columns.date<JobRecord>('dateAdded', {label: 'Date Added'}),
  columns.category<JobRecord>('ownerName', {label: 'Owner'}),
  columns.category<JobRecord>('stage', {label: 'Stage'}),
  columns.category<JobRecord>('region', {label: 'Region'}),
  columns.boolean<JobRecord>('isOpen', {trueLabel: 'Open', falseLabel: 'Closed'}),
  columns.number<JobRecord>('salary', {label: 'Salary'}),
]

/**
 * Mixed dataset for testing the full default toolbar experience.
 */
export const jobsPlaygroundData: JobRecord[] = [
  createJob(190, 'Avery', 'Applied', 'North America', true, 82000),
  createJob(176, 'Blair', 'Interview', 'Europe', true, 91000),
  createJob(160, 'Casey', 'Offer', 'APAC', true, 105000),
  createJob(148, 'Avery', 'Hired', 'North America', false, 98000),
  createJob(133, 'Blair', 'Interview', 'Europe', true, 87000),
  createJob(119, 'Casey', 'Applied', 'APAC', true, 76000),
  createJob(102, 'Avery', 'Offer', 'North America', true, 112000),
  createJob(88, 'Blair', 'Hired', 'Europe', false, 99000),
  createJob(71, 'Casey', 'Interview', 'APAC', true, 94000),
  createJob(54, 'Avery', 'Applied', 'North America', true, 81000),
  createJob(37, 'Blair', 'Offer', 'Europe', true, 108000),
  createJob(21, 'Casey', 'Hired', 'APAC', false, 101000),
]

/**
 * Slightly different distribution for testing alternate visual states in a second chart.
 */
export const hiringPushData: JobRecord[] = [
  createJob(150, 'Drew', 'Applied', 'North America', true, 74000),
  createJob(136, 'Drew', 'Interview', 'North America', true, 86000),
  createJob(128, 'Elliot', 'Applied', 'Europe', true, 79000),
  createJob(112, 'Elliot', 'Offer', 'Europe', true, 110000),
  createJob(96, 'Frankie', 'Interview', 'APAC', true, 92000),
  createJob(82, 'Frankie', 'Hired', 'APAC', false, 97000),
  createJob(67, 'Drew', 'Offer', 'North America', true, 114000),
  createJob(58, 'Elliot', 'Interview', 'Europe', true, 95000),
  createJob(43, 'Frankie', 'Applied', 'APAC', true, 73000),
  createJob(29, 'Drew', 'Hired', 'North America', false, 103000),
  createJob(18, 'Elliot', 'Offer', 'Europe', true, 109000),
  createJob(8, 'Frankie', 'Interview', 'APAC', true, 89000),
]

/**
 * Higher-value search pipeline with more late-stage records.
 */
export const executiveSearchData: JobRecord[] = [
  createJob(165, 'Harper', 'Interview', 'North America', true, 132000),
  createJob(149, 'Indigo', 'Offer', 'Europe', true, 148000),
  createJob(138, 'Gale', 'Interview', 'APAC', true, 136000),
  createJob(124, 'Harper', 'Offer', 'North America', true, 154000),
  createJob(109, 'Indigo', 'Hired', 'Europe', false, 151000),
  createJob(95, 'Gale', 'Interview', 'APAC', true, 139000),
  createJob(76, 'Harper', 'Offer', 'North America', true, 158000),
  createJob(61, 'Indigo', 'Applied', 'Europe', true, 128000),
  createJob(46, 'Gale', 'Offer', 'APAC', true, 145000),
  createJob(30, 'Harper', 'Hired', 'North America', false, 162000),
  createJob(17, 'Indigo', 'Interview', 'Europe', true, 141000),
  createJob(6, 'Gale', 'Offer', 'APAC', true, 149000),
]

/**
 * Recovery scenario with heavier top-of-funnel volume and regional spread.
 */
export const recoverySprintData: JobRecord[] = [
  createJob(172, 'Jules', 'Applied', 'North America', true, 69000),
  createJob(156, 'Kai', 'Applied', 'Europe', true, 72000),
  createJob(140, 'Lane', 'Interview', 'APAC', true, 81000),
  createJob(126, 'Jules', 'Applied', 'North America', true, 70000),
  createJob(111, 'Kai', 'Interview', 'Europe', true, 85000),
  createJob(93, 'Lane', 'Offer', 'APAC', true, 96000),
  createJob(78, 'Jules', 'Interview', 'North America', true, 83000),
  createJob(64, 'Kai', 'Applied', 'Europe', true, 74000),
  createJob(49, 'Lane', 'Applied', 'APAC', true, 71000),
  createJob(33, 'Jules', 'Offer', 'North America', true, 98000),
  createJob(20, 'Kai', 'Hired', 'Europe', false, 102000),
  createJob(9, 'Lane', 'Interview', 'APAC', true, 86000),
]

/**
 * Source catalog used by the playground source picker and chart demo.
 */
export const playgroundSources: PlaygroundSource[] = [
  {
    id: 'hiring-push',
    label: 'Quarterly hiring push',
    description: 'Balanced pipeline growth with healthy regional coverage across the quarter.',
    data: hiringPushData,
    columns: jobColumns,
  },
  {
    id: 'executive-search',
    label: 'Executive search',
    description: 'Higher salary ranges with more late-stage movement and closes.',
    data: executiveSearchData,
    columns: jobColumns,
  },
  {
    id: 'recovery-sprint',
    label: 'Recovery sprint',
    description: 'Top-of-funnel heavy pipeline focused on refilling regional hiring gaps.',
    data: recoverySprintData,
    columns: jobColumns,
  },
]
