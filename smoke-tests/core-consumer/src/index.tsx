import {defineDataset, useChart} from '@matthieumordrel/chart-studio'

type JobRow = {
  createdAt: string
  ownerName: string
  salary: number
}

const schema = defineDataset<JobRow>()
  .columns((c) => [
    c.date('createdAt'),
    c.category('ownerName'),
    c.number('salary'),
  ])
  .chart()
  .metric((m) => m.count().aggregate('salary', 'sum'))

export function ExampleChart({data}: {data: JobRow[]}) {
  const chart = useChart({data, schema})
  return chart.recordCount
}
