import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio-ui'

const jobs = [
  {createdAt: '2026-01-10', ownerName: 'Alice', salary: 100},
  {createdAt: '2026-01-18', ownerName: 'Bob', salary: 50},
  {createdAt: '2026-03-02', ownerName: 'Alice', salary: 200},
]

export function App() {
  const chart = useChart({data: jobs})

  return (
    <main className="p-6">
      <Chart chart={chart}>
        <ChartToolbar />
        <ChartCanvas height={240} />
      </Chart>
    </main>
  )
}
