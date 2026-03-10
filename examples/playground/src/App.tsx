import {PlaygroundChart} from './PlaygroundChart'
import {ThemeToggle} from './ThemeToggle'

/**
 * Root application for visually testing chart-studio in isolation.
 */
function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ThemeToggle />
          </div>
        </header>

        <PlaygroundChart />
      </div>
    </main>
  )
}

export default App
