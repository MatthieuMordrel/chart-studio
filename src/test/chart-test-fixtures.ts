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
 * Candidate records for multi-source tests.
 */
export const candidateData: CandidateRecord[] = [
  {stage: 'Screen', city: 'Ghent', isActive: true, expectedSalary: 50000},
  {stage: 'Interview', city: 'Brussels', isActive: false, expectedSalary: 60000},
]
