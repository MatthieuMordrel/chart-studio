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
