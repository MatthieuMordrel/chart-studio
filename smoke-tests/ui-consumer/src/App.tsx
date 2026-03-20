import {defineDataModel, defineDataset, useChart} from '@matthieumordrel/chart-studio'
import {ChartStudioDevtools} from '@matthieumordrel/chart-studio-devtools/react'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio-ui'

const jobs = [
  {id: 'job-1', createdAt: '2026-01-10', ownerName: 'Alice', salary: 100},
  {id: 'job-2', createdAt: '2026-01-18', ownerName: 'Bob', salary: 50},
  {id: 'job-3', createdAt: '2026-03-02', ownerName: 'Alice', salary: 200},
]

const jobsDataset = defineDataset<typeof jobs[number]>()
  .key('id')
  .columns((column) => [
    column.field('id', {label: 'Job ID'}),
    column.date('createdAt', {label: 'Created At'}),
    column.category('ownerName', {label: 'Owner'}),
    column.number('salary', {label: 'Salary', format: 'currency'}),
  ])

const jobsModel = defineDataModel()
  .dataset('jobs', jobsDataset)
  .build()

export function App() {
  const chart = useChart({data: jobs})

  return (
    <main className="p-6">
      <Chart chart={chart}>
        <ChartToolbar />
        <ChartCanvas height={240} />
      </Chart>

      <ChartStudioDevtools
        getSnapshot={() => ({
          model: jobsModel,
          data: {jobs},
        })}
      />
    </main>
  )
}
