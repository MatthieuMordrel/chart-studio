import {useState} from 'react'

type Props = {
  /** Raw source code string, typically imported via Vite's `?raw` suffix. */
  source: string
}

/**
 * Collapsible panel that displays raw source code for a scenario.
 * Stays automatically in sync because the source is loaded via `?raw` import.
 */
export function CodePanel({source}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-card"
      >
        <span className="font-mono text-xs font-medium text-muted-foreground tracking-wide">
          Source code
        </span>
        <span className="text-xs text-muted-foreground">{isOpen ? '↑ Hide' : '↓ Show'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground">
            <code>{source}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
