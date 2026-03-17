import type {
  HiringJobSkillRecord,
  HiringOwnerRecord,
  HiringRequisitionRecord,
  HiringSkillRecord,
} from '../mock-data'
import {seededRandom} from './utils'

const REGIONS = {
  AMER: ['New York', 'Toronto', 'Austin', 'Remote US'],
  EMEA: ['London', 'Berlin', 'Amsterdam', 'Remote EU'],
  APAC: ['Singapore', 'Sydney', 'Tokyo', 'Remote APAC'],
} as const

const OWNERS: readonly HiringOwnerRecord[] = [
  {id: 'owner-1', name: 'Avery Stone', region: 'AMER', portfolio: 'Platform'},
  {id: 'owner-2', name: 'Morgan Lee', region: 'AMER', portfolio: 'Revenue'},
  {id: 'owner-3', name: 'Jordan Cruz', region: 'AMER', portfolio: 'Data'},
  {id: 'owner-4', name: 'Samir Patel', region: 'AMER', portfolio: 'Security'},
  {id: 'owner-5', name: 'Riley Chen', region: 'EMEA', portfolio: 'Platform'},
  {id: 'owner-6', name: 'Noah Silva', region: 'EMEA', portfolio: 'Product'},
  {id: 'owner-7', name: 'Isla Novak', region: 'EMEA', portfolio: 'Revenue'},
  {id: 'owner-8', name: 'Marta Costa', region: 'EMEA', portfolio: 'Operations'},
  {id: 'owner-9', name: 'Kai Tanaka', region: 'APAC', portfolio: 'Platform'},
  {id: 'owner-10', name: 'Sora Kim', region: 'APAC', portfolio: 'Growth'},
  {id: 'owner-11', name: 'Ethan Wong', region: 'APAC', portfolio: 'Data'},
  {id: 'owner-12', name: 'Priya Raman', region: 'APAC', portfolio: 'Design'},
] as const

const SKILLS: readonly HiringSkillRecord[] = [
  {id: 'skill-1', name: 'TypeScript', domain: 'Frontend'},
  {id: 'skill-2', name: 'React', domain: 'Frontend'},
  {id: 'skill-3', name: 'Design Systems', domain: 'Frontend'},
  {id: 'skill-4', name: 'Node.js', domain: 'Backend'},
  {id: 'skill-5', name: 'Go', domain: 'Backend'},
  {id: 'skill-6', name: 'GraphQL', domain: 'Backend'},
  {id: 'skill-7', name: 'Kubernetes', domain: 'Infrastructure'},
  {id: 'skill-8', name: 'Terraform', domain: 'Infrastructure'},
  {id: 'skill-9', name: 'AWS', domain: 'Infrastructure'},
  {id: 'skill-10', name: 'Python', domain: 'Data'},
  {id: 'skill-11', name: 'SQL', domain: 'Data'},
  {id: 'skill-12', name: 'dbt', domain: 'Data'},
  {id: 'skill-13', name: 'Experimentation', domain: 'Growth'},
  {id: 'skill-14', name: 'Lifecycle Marketing', domain: 'Growth'},
  {id: 'skill-15', name: 'Pipeline Ops', domain: 'Revenue'},
  {id: 'skill-16', name: 'Enterprise Sales', domain: 'Revenue'},
  {id: 'skill-17', name: 'Technical Writing', domain: 'Product'},
  {id: 'skill-18', name: 'User Research', domain: 'Design'},
  {id: 'skill-19', name: 'Figma', domain: 'Design'},
  {id: 'skill-20', name: 'IAM', domain: 'Security'},
  {id: 'skill-21', name: 'Threat Modeling', domain: 'Security'},
  {id: 'skill-22', name: 'Vendor Management', domain: 'Operations'},
  {id: 'skill-23', name: 'Workforce Planning', domain: 'Operations'},
  {id: 'skill-24', name: 'Customer Success', domain: 'Revenue'},
] as const

const ROLE_FAMILIES = [
  {
    family: 'Engineering',
    teams: ['Platform', 'Core Product', 'Developer Experience'],
    salaryBase: 132000,
    applicantBase: 76,
    skillIds: ['skill-1', 'skill-2', 'skill-4', 'skill-5', 'skill-7', 'skill-8', 'skill-9'],
  },
  {
    family: 'Data',
    teams: ['Data Platform', 'Analytics Engineering', 'ML Platform'],
    salaryBase: 141000,
    applicantBase: 58,
    skillIds: ['skill-10', 'skill-11', 'skill-12', 'skill-5', 'skill-7'],
  },
  {
    family: 'Security',
    teams: ['Security Engineering', 'Infrastructure Security', 'Trust'],
    salaryBase: 147000,
    applicantBase: 44,
    skillIds: ['skill-7', 'skill-8', 'skill-9', 'skill-20', 'skill-21'],
  },
  {
    family: 'Design',
    teams: ['Product Design', 'Design Systems', 'Research'],
    salaryBase: 124000,
    applicantBase: 39,
    skillIds: ['skill-2', 'skill-3', 'skill-18', 'skill-19'],
  },
  {
    family: 'Revenue',
    teams: ['Mid-Market Sales', 'Enterprise Sales', 'Customer Success'],
    salaryBase: 118000,
    applicantBase: 61,
    skillIds: ['skill-13', 'skill-14', 'skill-15', 'skill-16', 'skill-24'],
  },
  {
    family: 'Operations',
    teams: ['Business Operations', 'People Operations', 'Strategic Programs'],
    salaryBase: 112000,
    applicantBase: 34,
    skillIds: ['skill-11', 'skill-22', 'skill-23', 'skill-17'],
  },
] as const

const LEVELS = [
  {level: 'IC4', multiplier: 0.88, closeFactor: 0.9},
  {level: 'IC5', multiplier: 1, closeFactor: 1},
  {level: 'Staff', multiplier: 1.18, closeFactor: 1.1},
  {level: 'Manager', multiplier: 1.24, closeFactor: 1.12},
  {level: 'Director', multiplier: 1.45, closeFactor: 1.3},
] as const

const HIRING_MOTIONS = ['Backfill', 'Growth', 'Expansion'] as const
const EMPLOYMENT_TYPES = ['Full Time', 'Contract'] as const

function isoDateRelative(daysFromToday: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  date.setHours(12, 0, 0, 0)
  return date.toISOString()
}

function sampleFromArray<T>(items: readonly T[], seed: number): T {
  return items[Math.floor(seededRandom(seed) * items.length)]!
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function generateHiringNetworkData(count = 260): {
  requisitions: HiringRequisitionRecord[]
  owners: HiringOwnerRecord[]
  skills: HiringSkillRecord[]
  jobSkills: HiringJobSkillRecord[]
} {
  const requisitions: HiringRequisitionRecord[] = []
  const jobSkills: HiringJobSkillRecord[] = []

  for (let index = 0; index < count; index++) {
    const family = sampleFromArray(ROLE_FAMILIES, index * 13 + 1)
    const level = sampleFromArray(LEVELS, index * 17 + 3)
    const region = sampleFromArray(Object.keys(REGIONS) as Array<keyof typeof REGIONS>, index * 19 + 5)
    const office = sampleFromArray(REGIONS[region], index * 23 + 7)
    const ownerPool = OWNERS.filter(owner => owner.region === region)
    const owner = sampleFromArray(ownerPool, index * 29 + 11)
    const team = sampleFromArray(family.teams, index * 31 + 13)
    const hiringMotion = sampleFromArray(HIRING_MOTIONS, index * 37 + 17)
    const employmentType = seededRandom(index * 41 + 19) > 0.82 ? EMPLOYMENT_TYPES[1] : EMPLOYMENT_TYPES[0]
    const openedDaysAgo = Math.floor(seededRandom(index * 43 + 23) * 720)
    const openDateOffset = -openedDaysAgo
    const headcount = seededRandom(index * 47 + 29) > 0.86 ? 2 : 1
    const salaryRegionalMultiplier = region === 'AMER' ? 1.08 : region === 'EMEA' ? 1 : 0.94
    const salaryMotionMultiplier = hiringMotion === 'Expansion' ? 1.06 : hiringMotion === 'Growth' ? 1.03 : 0.98
    const salaryNoise = 0.92 + seededRandom(index * 53 + 31) * 0.22
    const salaryMidpoint = Math.round(
      family.salaryBase * level.multiplier * salaryRegionalMultiplier * salaryMotionMultiplier * salaryNoise,
    )

    const applicantBase = family.applicantBase * (employmentType === 'Contract' ? 0.72 : 1)
    const applicants = Math.round(
      applicantBase * (0.75 + seededRandom(index * 59 + 37) * 0.9) * headcount,
    )
    const onsiteCount = Math.max(0, Math.round(applicants * (0.09 + seededRandom(index * 61 + 41) * 0.1)))
    const offersExtended = clamp(
      Math.round(onsiteCount * (0.18 + seededRandom(index * 67 + 43) * 0.22)),
      0,
      headcount + 2,
    )

    const closureTargetDays = Math.round(
      (34 + seededRandom(index * 71 + 47) * 92) * level.closeFactor * (headcount > 1 ? 1.08 : 1),
    )
    const closureRoll = seededRandom(index * 73 + 53)

    let status: HiringRequisitionRecord['status']
    if (openedDaysAgo < 45) {
      status = closureRoll > 0.87 ? 'Paused' : 'Open'
    } else if (openedDaysAgo < closureTargetDays + 15) {
      status = closureRoll > 0.88 ? 'Paused' : closureRoll > 0.76 ? 'Open' : 'Filled'
    } else {
      status = closureRoll > 0.9 ? 'Cancelled' : closureRoll > 0.18 ? 'Filled' : 'Paused'
    }

    const closedAt = status === 'Filled' || status === 'Cancelled'
      ? isoDateRelative(openDateOffset + closureTargetDays)
      : null

    const offersAccepted = status === 'Filled'
      ? clamp(
          Math.max(headcount, Math.round(offersExtended * (0.62 + seededRandom(index * 79 + 59) * 0.28))),
          1,
          headcount,
        )
      : 0

    requisitions.push({
      id: `req-${index + 1}`,
      ownerId: owner.id,
      roleFamily: family.family,
      team,
      region,
      office,
      level: level.level,
      hiringMotion,
      employmentType,
      status,
      openedAt: isoDateRelative(openDateOffset),
      targetStartAt: isoDateRelative(openDateOffset + 65 + Math.round(seededRandom(index * 83 + 61) * 55)),
      closedAt,
      salaryMidpoint,
      headcount,
      applicants,
      onsiteCount,
      offersExtended,
      offersAccepted,
    })

    const edgeCount = 3 + Math.floor(seededRandom(index * 89 + 67) * 3)
    const chosenSkillIds = new Set<string>()
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
      const skillId = sampleFromArray(family.skillIds, index * 97 + edgeIndex * 7 + 71)
      chosenSkillIds.add(skillId)
    }

    chosenSkillIds.forEach((skillId) => {
      jobSkills.push({
        jobId: `req-${index + 1}`,
        skillId,
      })
    })
  }

  requisitions.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())

  return {
    requisitions,
    owners: [...OWNERS],
    skills: [...SKILLS],
    jobSkills,
  }
}
