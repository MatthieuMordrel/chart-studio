import {useEffect, useState} from 'react'

export type Theme = 'light' | 'dark'

/**
 * Read the persisted playground theme from localStorage.
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.localStorage.getItem('chart-studio-playground-theme') === 'dark' ? 'dark' : 'light'
}

/**
 * Apply the current theme using the same data attribute supported by the shipped package theme.
 */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem('chart-studio-playground-theme', theme)
}

/**
 * Small theme toggle for testing the shipped light and dark theme defaults.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Dark
      </button>
    </div>
  )
}
