import {
  DashboardProvider,
  defineDashboard,
  defineDataModel,
  defineDataset,
  useDashboard,
  useDashboardChart,
  useDashboardDataset,
  useDashboardSharedFilter,
} from '@matthieumordrel/chart-studio'
import {ChartStudioDevtools} from '@matthieumordrel/chart-studio-devtools/react'
import {Chart, ChartCanvas} from '@matthieumordrel/chart-studio-ui'
import type {ReactNode} from 'react'

// ---------------------------------------------------------------------------
// Data types — elementary school: homeroom teachers, students, tests, meetings
// ---------------------------------------------------------------------------

type TeacherRow = {
  id: string
  name: string
}

type StudentRow = {
  id: string
  teacherId: string
  name: string
  enrolledAt: string
}

type TestRow = {
  id: string
  teacherId: string
  studentId: string
  subject: 'Math' | 'Science' | 'English' | 'Art'
  score: number
  takenAt: string
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
  {id: 'teacher-1', name: 'Maria Lopez'},
  {id: 'teacher-2', name: 'James Park'},
  {id: 'teacher-3', name: 'Sarah Kim'},
]

const students: StudentRow[] = [
  // Maria Lopez's class
  {id: 'student-1',  teacherId: 'teacher-1', name: 'Emma',      enrolledAt: '2026-01-05'},
  {id: 'student-2',  teacherId: 'teacher-1', name: 'Liam',      enrolledAt: '2026-01-12'},
  {id: 'student-3',  teacherId: 'teacher-1', name: 'Olivia',    enrolledAt: '2026-02-01'},
  {id: 'student-4',  teacherId: 'teacher-1', name: 'Lucas',     enrolledAt: '2026-02-14'},
  // James Park's class
  {id: 'student-5',  teacherId: 'teacher-2', name: 'Noah',      enrolledAt: '2026-01-08'},
  {id: 'student-6',  teacherId: 'teacher-2', name: 'Ava',       enrolledAt: '2026-01-20'},
  {id: 'student-7',  teacherId: 'teacher-2', name: 'Elijah',    enrolledAt: '2026-02-05'},
  {id: 'student-8',  teacherId: 'teacher-2', name: 'Harper',    enrolledAt: '2026-02-18'},
  {id: 'student-9',  teacherId: 'teacher-2', name: 'Oliver',    enrolledAt: '2026-03-10'},
  // Sarah Kim's class
  {id: 'student-10', teacherId: 'teacher-3', name: 'Sophia',    enrolledAt: '2026-01-10'},
  {id: 'student-11', teacherId: 'teacher-3', name: 'Mason',     enrolledAt: '2026-01-22'},
  {id: 'student-12', teacherId: 'teacher-3', name: 'Charlotte', enrolledAt: '2026-02-10'},
]

const tests: TestRow[] = [
  // Maria Lopez's students — strong in Math, weaker in Art
  {id: 'test-1',  teacherId: 'teacher-1', studentId: 'student-1', subject: 'Math',    score: 95, takenAt: '2026-01-20'},
  {id: 'test-2',  teacherId: 'teacher-1', studentId: 'student-1', subject: 'Science', score: 88, takenAt: '2026-02-10'},
  {id: 'test-3',  teacherId: 'teacher-1', studentId: 'student-1', subject: 'English', score: 82, takenAt: '2026-03-05'},
  {id: 'test-4',  teacherId: 'teacher-1', studentId: 'student-2', subject: 'Math',    score: 78, takenAt: '2026-01-20'},
  {id: 'test-5',  teacherId: 'teacher-1', studentId: 'student-2', subject: 'Art',     score: 65, takenAt: '2026-02-10'},
  {id: 'test-6',  teacherId: 'teacher-1', studentId: 'student-3', subject: 'Math',    score: 91, takenAt: '2026-02-15'},
  {id: 'test-7',  teacherId: 'teacher-1', studentId: 'student-3', subject: 'Science', score: 84, takenAt: '2026-03-10'},
  {id: 'test-8',  teacherId: 'teacher-1', studentId: 'student-4', subject: 'English', score: 70, takenAt: '2026-03-01'},
  {id: 'test-9',  teacherId: 'teacher-1', studentId: 'student-4', subject: 'Math',    score: 88, takenAt: '2026-03-15'},
  // James Park's students — mixed across subjects
  {id: 'test-10', teacherId: 'teacher-2', studentId: 'student-5', subject: 'Math',    score: 72, takenAt: '2026-01-22'},
  {id: 'test-11', teacherId: 'teacher-2', studentId: 'student-5', subject: 'Science', score: 90, takenAt: '2026-02-12'},
  {id: 'test-12', teacherId: 'teacher-2', studentId: 'student-6', subject: 'English', score: 85, takenAt: '2026-01-28'},
  {id: 'test-13', teacherId: 'teacher-2', studentId: 'student-6', subject: 'Art',     score: 92, takenAt: '2026-02-20'},
  {id: 'test-14', teacherId: 'teacher-2', studentId: 'student-7', subject: 'Math',    score: 68, takenAt: '2026-02-15'},
  {id: 'test-15', teacherId: 'teacher-2', studentId: 'student-7', subject: 'Science', score: 74, takenAt: '2026-03-08'},
  {id: 'test-16', teacherId: 'teacher-2', studentId: 'student-8', subject: 'English', score: 60, takenAt: '2026-03-01'},
  {id: 'test-17', teacherId: 'teacher-2', studentId: 'student-9', subject: 'Art',     score: 78, takenAt: '2026-03-12'},
  // Sarah Kim's students — consistently strong
  {id: 'test-18', teacherId: 'teacher-3', studentId: 'student-10', subject: 'Math',    score: 97, takenAt: '2026-01-25'},
  {id: 'test-19', teacherId: 'teacher-3', studentId: 'student-10', subject: 'English', score: 94, takenAt: '2026-02-15'},
  {id: 'test-20', teacherId: 'teacher-3', studentId: 'student-10', subject: 'Science', score: 91, takenAt: '2026-03-10'},
  {id: 'test-21', teacherId: 'teacher-3', studentId: 'student-11', subject: 'Art',     score: 86, takenAt: '2026-02-01'},
  {id: 'test-22', teacherId: 'teacher-3', studentId: 'student-11', subject: 'Math',    score: 80, takenAt: '2026-02-20'},
  {id: 'test-23', teacherId: 'teacher-3', studentId: 'student-12', subject: 'English', score: 93, takenAt: '2026-02-25'},
  {id: 'test-24', teacherId: 'teacher-3', studentId: 'student-12', subject: 'Science', score: 87, takenAt: '2026-03-15'},
]

const parentMeetings: ParentMeetingRow[] = [
  // Maria Lopez — engaged parents
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
]

// ---------------------------------------------------------------------------
// Model-first dashboard definition
//
// Safe inference now lives on the model. The dashboard stays a thin
// composition layer over model-owned charts and inferred shared filters.
// ---------------------------------------------------------------------------

const schoolModel = defineDataModel()
  .dataset('teachers', defineDataset<TeacherRow>()
    .key('id')
    .columns((c) => [
      c.category('name', {label: 'Teacher'}),
    ]))
  .dataset('students', defineDataset<StudentRow>()
    .key('id')
    .columns((c) => [
      c.category('name', {label: 'Student'}),
      c.date('enrolledAt', {label: 'Enrolled'}),
    ]))
  .dataset('tests', defineDataset<TestRow>()
    .key('id')
    .columns((c) => [
      c.category('subject', {label: 'Subject'}),
      c.number('score', {label: 'Score', format: 'number'}),
      c.date('takenAt', {label: 'Test Date'}),
    ]))
  .dataset('parentMeetings', defineDataset<ParentMeetingRow>()
    .key('id')
    .columns((c) => [
      c.date('scheduledAt', {label: 'Meeting Date'}),
      c.category('status', {label: 'Status'}),
      c.number('durationMinutes', {label: 'Duration (min)'}),
    ]))
  .infer({
    relationships: true,
    attributes: true,
  })

const avgScoreBySubject = schoolModel.chart('avgScoreBySubject', (chart) =>
  chart
    .xAxis((x) => x.allowed('tests.subject').default('tests.subject'))
    .metric((m) =>
      m
        .aggregate('tests.score', 'avg')
        .defaultAggregate('tests.score', 'avg'))
    .chartType((t) => t.allowed('bar').default('bar')),
)

const testsByMonth = schoolModel.chart('testsByMonth', (chart) =>
  chart
    .xAxis((x) => x.allowed('tests.takenAt').default('tests.takenAt'))
    .groupBy((g) => g.allowed('tests.subject').default('tests.subject'))
    .metric((m) => m.count().defaultCount())
    .timeBucket((t) => t.allowed('month').default('month'))
    .chartType((t) => t.allowed('grouped-bar').default('grouped-bar')),
)

const meetingsByStatus = schoolModel.chart('meetingsByStatus', (chart) =>
  chart
    .xAxis((x) => x.allowed('parentMeetings.status').default('parentMeetings.status'))
    .metric((m) => m.count().defaultCount())
    .chartType((t) => t.allowed('donut').default('donut')),
)

const meetingsByTeacher = schoolModel.chart('meetingsByTeacher', (chart) =>
  chart
    .xAxis((x) => x.allowed('parentMeetings.teacher.name').default('parentMeetings.teacher.name'))
    .metric((m) =>
      m
        .aggregate('parentMeetings.durationMinutes', 'sum')
        .defaultAggregate('parentMeetings.durationMinutes', 'sum'))
    .chartType((t) => t.allowed('bar').default('bar')),
)

const schoolDashboard = defineDashboard(schoolModel)
  .chart('avgScoreBySubject', avgScoreBySubject)
  .chart('testsByMonth', testsByMonth)
  .chart('meetingsByStatus', meetingsByStatus)
  .chart('meetingsByTeacher', meetingsByTeacher)
  .sharedFilter('teacher')

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
      tests,
      parentMeetings,
    },
  })
  const avgScoreBySubject = useDashboardChart(dashboard, 'avgScoreBySubject')
  const testsByMonth = useDashboardChart(dashboard, 'testsByMonth')
  const meetingsByStatus = useDashboardChart(dashboard, 'meetingsByStatus')
  const meetingsByTeacher = useDashboardChart(dashboard, 'meetingsByTeacher')
  const filteredTests = useDashboardDataset(dashboard, 'tests')
  const filteredMeetings = useDashboardDataset(dashboard, 'parentMeetings')
  const teacherFilter = useDashboardSharedFilter(dashboard, 'teacher')

  return (
    <DashboardProvider dashboard={dashboard}>
      <div className='space-y-4'>
        {teacherFilter.kind === 'select' && (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-xs font-medium text-muted-foreground'>Teacher</span>
            <button
              type='button'
              onClick={() => teacherFilter.clear()}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
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
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/40'
                  }`}>
                  {option.label}
                </button>
              )
            })}

            <span className='ml-auto text-xs text-muted-foreground'>
              {filteredTests.length} tests · {filteredMeetings.length} meetings
            </span>
          </div>
        )}

        <div className='grid gap-4 lg:grid-cols-2'>
          <DashboardPanel
            title='Avg Score by Subject'
            subtitle='Subject from teachers, scores from students'>
            <Chart chart={avgScoreBySubject}>
              <ChartCanvas height={260} />
            </Chart>
          </DashboardPanel>

          <DashboardPanel
            title='Tests by Month'
            subtitle='Test count grouped by subject'>
            <Chart chart={testsByMonth}>
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
      <ChartStudioDevtools />
    </DashboardProvider>
  )
}
