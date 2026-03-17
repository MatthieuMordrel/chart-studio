import {
  createDashboard,
  useDashboard,
  useDashboardChart,
  useDashboardDataset,
  useDashboardSharedFilter,
} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas} from '@matthieumordrel/chart-studio/ui'
import type {ReactNode} from 'react'

// ---------------------------------------------------------------------------
// Data types — simple school domain anyone can understand
// ---------------------------------------------------------------------------

type TeacherRow = {
  id: string
  name: string
  subject: 'Math' | 'Science' | 'English' | 'Art'
}

type StudentRow = {
  id: string
  teacherId: string
  name: string
  enrolledAt: string
  grade: 'A' | 'B' | 'C' | 'D'
  score: number
}

type ParentMeetingRow = {
  id: string
  teacherId: string
  scheduledAt: string
  status: 'Completed' | 'Scheduled' | 'Cancelled'
  durationMinutes: number
}

// ---------------------------------------------------------------------------
// Data — small, explicit, instantly readable
// ---------------------------------------------------------------------------

const teachers: TeacherRow[] = [
  {id: 'teacher-1', name: 'Maria Lopez', subject: 'Math'},
  {id: 'teacher-2', name: 'James Park', subject: 'Science'},
  {id: 'teacher-3', name: 'Sarah Kim', subject: 'English'},
  {id: 'teacher-4', name: 'David Chen', subject: 'Art'},
]

const students: StudentRow[] = [
  // Maria Lopez (Math) — high scores, mostly A's and B's
  {id: 'student-1',  teacherId: 'teacher-1', name: 'Emma',     enrolledAt: '2026-01-05', grade: 'A', score: 95},
  {id: 'student-2',  teacherId: 'teacher-1', name: 'Liam',     enrolledAt: '2026-01-12', grade: 'B', score: 82},
  {id: 'student-3',  teacherId: 'teacher-1', name: 'Olivia',   enrolledAt: '2026-02-01', grade: 'A', score: 91},
  {id: 'student-4',  teacherId: 'teacher-1', name: 'Lucas',    enrolledAt: '2026-02-14', grade: 'A', score: 93},
  {id: 'student-5',  teacherId: 'teacher-1', name: 'Amelia',   enrolledAt: '2026-03-02', grade: 'B', score: 87},
  // James Park (Science) — mixed results
  {id: 'student-6',  teacherId: 'teacher-2', name: 'Noah',     enrolledAt: '2026-01-08', grade: 'C', score: 73},
  {id: 'student-7',  teacherId: 'teacher-2', name: 'Ava',      enrolledAt: '2026-01-20', grade: 'B', score: 85},
  {id: 'student-8',  teacherId: 'teacher-2', name: 'Elijah',   enrolledAt: '2026-02-05', grade: 'A', score: 92},
  {id: 'student-9',  teacherId: 'teacher-2', name: 'Harper',   enrolledAt: '2026-02-18', grade: 'C', score: 70},
  {id: 'student-10', teacherId: 'teacher-2', name: 'Oliver',   enrolledAt: '2026-03-10', grade: 'B', score: 81},
  {id: 'student-11', teacherId: 'teacher-2', name: 'Luna',     enrolledAt: '2026-03-15', grade: 'D', score: 58},
  // Sarah Kim (English) — consistently strong
  {id: 'student-12', teacherId: 'teacher-3', name: 'Sophia',   enrolledAt: '2026-01-10', grade: 'A', score: 97},
  {id: 'student-13', teacherId: 'teacher-3', name: 'Mason',    enrolledAt: '2026-01-22', grade: 'B', score: 80},
  {id: 'student-14', teacherId: 'teacher-3', name: 'Charlotte',enrolledAt: '2026-02-10', grade: 'A', score: 94},
  {id: 'student-15', teacherId: 'teacher-3', name: 'Henry',    enrolledAt: '2026-03-01', grade: 'A', score: 90},
  // David Chen (Art) — lower scores, more spread
  {id: 'student-16', teacherId: 'teacher-4', name: 'Isabella',  enrolledAt: '2026-01-15', grade: 'D', score: 62},
  {id: 'student-17', teacherId: 'teacher-4', name: 'Ethan',     enrolledAt: '2026-01-25', grade: 'C', score: 71},
  {id: 'student-18', teacherId: 'teacher-4', name: 'Mia',       enrolledAt: '2026-02-08', grade: 'B', score: 84},
  {id: 'student-19', teacherId: 'teacher-4', name: 'Alexander', enrolledAt: '2026-02-20', grade: 'C', score: 68},
  {id: 'student-20', teacherId: 'teacher-4', name: 'Scarlett',  enrolledAt: '2026-03-05', grade: 'D', score: 55},
  {id: 'student-21', teacherId: 'teacher-4', name: 'Sebastian', enrolledAt: '2026-03-12', grade: 'B', score: 79},
  {id: 'student-22', teacherId: 'teacher-4', name: 'Aria',      enrolledAt: '2026-03-18', grade: 'C', score: 72},
]

const parentMeetings: ParentMeetingRow[] = [
  // Maria Lopez — many completed meetings (engaged parents)
  {id: 'meeting-1',  teacherId: 'teacher-1', scheduledAt: '2026-01-15', status: 'Completed', durationMinutes: 30},
  {id: 'meeting-2',  teacherId: 'teacher-1', scheduledAt: '2026-02-10', status: 'Completed', durationMinutes: 45},
  {id: 'meeting-3',  teacherId: 'teacher-1', scheduledAt: '2026-02-28', status: 'Completed', durationMinutes: 25},
  {id: 'meeting-4',  teacherId: 'teacher-1', scheduledAt: '2026-03-15', status: 'Scheduled', durationMinutes: 30},
  // James Park — some cancellations
  {id: 'meeting-5',  teacherId: 'teacher-2', scheduledAt: '2026-01-20', status: 'Completed', durationMinutes: 25},
  {id: 'meeting-6',  teacherId: 'teacher-2', scheduledAt: '2026-02-05', status: 'Cancelled', durationMinutes: 0},
  {id: 'meeting-7',  teacherId: 'teacher-2', scheduledAt: '2026-02-18', status: 'Completed', durationMinutes: 35},
  {id: 'meeting-8',  teacherId: 'teacher-2', scheduledAt: '2026-03-08', status: 'Cancelled', durationMinutes: 0},
  {id: 'meeting-9',  teacherId: 'teacher-2', scheduledAt: '2026-03-20', status: 'Scheduled', durationMinutes: 30},
  // Sarah Kim — steady engagement
  {id: 'meeting-10', teacherId: 'teacher-3', scheduledAt: '2026-01-18', status: 'Completed', durationMinutes: 40},
  {id: 'meeting-11', teacherId: 'teacher-3', scheduledAt: '2026-02-22', status: 'Completed', durationMinutes: 30},
  {id: 'meeting-12', teacherId: 'teacher-3', scheduledAt: '2026-03-05', status: 'Completed', durationMinutes: 40},
  // David Chen — fewer meetings despite more students
  {id: 'meeting-13', teacherId: 'teacher-4', scheduledAt: '2026-02-12', status: 'Completed', durationMinutes: 20},
  {id: 'meeting-14', teacherId: 'teacher-4', scheduledAt: '2026-03-10', status: 'Scheduled', durationMinutes: 30},
]

// ---------------------------------------------------------------------------
// Dashboard definition — typed datasets + inferred relationships
//
// We type columns for formatting, labels, and derived columns.
// Relationships (students.teacherId → teachers.id, parentMeetings.teacherId → teachers.id)
// are inferred automatically from the naming convention.
// ---------------------------------------------------------------------------

const schoolDashboard = createDashboard({
  data: {
    teachers,
    students,
    parentMeetings,
  },
  datasets: {
    students: {
      columns: {
        score: {type: 'number', label: 'Test Score', format: 'number'},
        enrolledAt: {type: 'date', label: 'Enrolled'},
        grade: {label: 'Grade'},
      },
    },
    parentMeetings: {
      columns: {
        scheduledAt: {type: 'date', label: 'Meeting Date'},
        durationMinutes: {type: 'number', label: 'Duration (min)'},
        status: {label: 'Meeting Status'},
      },
    },
    teachers: {
      columns: {
        name: {label: 'Teacher'},
        subject: {label: 'Subject'},
      },
    },
  },
  charts: {
    avgScoreByTeacher: {
      data: 'students',
      xAxis: 'teacher.name',
      metric: {column: 'score', fn: 'avg'},
      chartType: 'bar',
    },
    studentsByMonth: {
      data: 'students',
      xAxis: 'enrolledAt',
      groupBy: 'grade',
      metric: 'count',
      timeBucket: 'month',
      chartType: 'grouped-bar',
    },
    meetingsByStatus: {
      data: 'parentMeetings',
      xAxis: 'status',
      metric: 'count',
      chartType: 'donut',
    },
    meetingsByTeacher: {
      data: 'parentMeetings',
      xAxis: 'teacher.name',
      metric: {column: 'durationMinutes', fn: 'sum'},
      chartType: 'bar',
    },
  },
  sharedFilters: ['teacher'],
})

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function DashboardPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
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

export function TypedInferredDashboardChart() {
  const dashboard = useDashboard({
    definition: schoolDashboard,
    data: {
      teachers,
      students,
      parentMeetings,
    },
  })
  const avgScoreByTeacher = useDashboardChart(dashboard, 'avgScoreByTeacher')
  const studentsByMonth = useDashboardChart(dashboard, 'studentsByMonth')
  const meetingsByStatus = useDashboardChart(dashboard, 'meetingsByStatus')
  const meetingsByTeacher = useDashboardChart(dashboard, 'meetingsByTeacher')
  const filteredStudents = useDashboardDataset(dashboard, 'students')
  const filteredMeetings = useDashboardDataset(dashboard, 'parentMeetings')
  const teacherFilter = useDashboardSharedFilter(dashboard, 'teacher')

  return (
    <div className='space-y-4'>
      {teacherFilter.kind === 'select' && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs font-medium text-muted-foreground'>Teacher</span>
          <button
            type='button'
            onClick={() => teacherFilter.clear()}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              teacherFilter.values.size === 0
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:border-primary/40'
            }`}>
            All
          </button>

          {teacherFilter.options.map((option) => {
            const isActive = teacherFilter.values.has(option.value)

            return (
              <button
                key={option.value}
                type='button'
                onClick={() => teacherFilter.toggleValue(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}>
                {option.label} <span className='opacity-70'>({option.count})</span>
              </button>
            )
          })}

          <span className='ml-auto text-xs text-muted-foreground'>
            {filteredStudents.length} students · {filteredMeetings.length} meetings
          </span>
        </div>
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        <DashboardPanel
          title='Avg Score by Teacher'
          subtitle='Names from teachers, scores from students'>
          <Chart chart={avgScoreByTeacher}>
            <ChartCanvas height={260} />
          </Chart>
        </DashboardPanel>

        <DashboardPanel
          title='Enrollments by Month'
          subtitle='New enrollments grouped by grade'>
          <Chart chart={studentsByMonth}>
            <ChartCanvas height={260} />
          </Chart>
        </DashboardPanel>

        <DashboardPanel
          title='Meeting Status'
          subtitle='Completed, scheduled, and cancelled'>
          <Chart chart={meetingsByStatus}>
            <ChartCanvas height={260} showDataLabels />
          </Chart>
        </DashboardPanel>

        <DashboardPanel
          title='Meeting Time by Teacher'
          subtitle='Total minutes from parent meetings'>
          <Chart chart={meetingsByTeacher}>
            <ChartCanvas height={260} />
          </Chart>
        </DashboardPanel>
      </div>
    </div>
  )
}
