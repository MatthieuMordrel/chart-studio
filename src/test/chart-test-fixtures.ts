import {columns, defineColumns} from '../core/columns.js'

/**
 * Test record used by chart-studio hook and UI tests.
 */
export type JobRecord = {
  dateAdded: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
}

/**
 * Stable single-source fixture with both date and categorical columns.
 */
export const jobColumns = defineColumns<JobRecord>([
  columns.date('dateAdded', {label: 'Date Added'}),
  columns.category('ownerName', {label: 'Owner'}),
  columns.boolean('isOpen', {label: 'Status', trueLabel: 'Open', falseLabel: 'Closed'}),
  columns.number('salary', {label: 'Salary'}),
])

/**
 * Records used by hook and UI tests.
 */
export const jobData: JobRecord[] = [
  {dateAdded: '2026-01-10', ownerName: 'Alice', isOpen: true, salary: 100},
  {dateAdded: '2026-01-18', ownerName: 'Bob', isOpen: false, salary: 50},
  {dateAdded: '2026-03-02', ownerName: 'Alice', isOpen: true, salary: 200},
]

/**
 * Secondary fixture used to verify multi-source switching.
 */
export type CandidateRecord = {
  stage: string | null
  city: string | null
  isActive: boolean | null
  expectedSalary: number | null
}

/**
 * Candidate columns intentionally omit dates to exercise categorical fallback.
 */
export const candidateColumns = defineColumns<CandidateRecord>([
  columns.category('stage', {label: 'Stage'}),
  columns.category('city', {label: 'City'}),
  columns.boolean('isActive', {label: 'Status', trueLabel: 'Active', falseLabel: 'Inactive'}),
  columns.number('expectedSalary', {label: 'Expected Salary'}),
])

/**
 * Candidate records for multi-source tests.
 */
export const candidateData: CandidateRecord[] = [
  {stage: 'Screen', city: 'Ghent', isActive: true, expectedSalary: 50000},
  {stage: 'Interview', city: 'Brussels', isActive: false, expectedSalary: 60000},
]
