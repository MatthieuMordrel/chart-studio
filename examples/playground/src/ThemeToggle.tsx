import {useEffect, useRef, useState} from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'chart-studio-playground-theme'
const RADIUS_KEY = 'chart-studio-playground-radius'
const ACCENT_KEY = 'chart-studio-playground-accent'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

function getStoredRadius(): number {
  if (typeof window === 'undefined') return 0.5
  const stored = window.localStorage.getItem(RADIUS_KEY)
  return stored ? Number(stored) : 0.5
}

function getStoredAccent(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACCENT_KEY) ?? ''
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

function applyRadius(rem: number) {
  document.documentElement.style.setProperty('--radius', `${rem}rem`)
  window.localStorage.setItem(RADIUS_KEY, String(rem))
}

function applyAccent(color: string) {
  if (color) {
    document.documentElement.style.setProperty('--primary', color)
    document.documentElement.style.setProperty('--ring', color)
  } else {
    document.documentElement.style.removeProperty('--primary')
    document.documentElement.style.removeProperty('--ring')
  }
  window.localStorage.setItem(ACCENT_KEY, color)
}

const RADIUS_PRESETS = [
  {label: 'None', value: 0},
  {label: 'Sm', value: 0.25},
  {label: 'Md', value: 0.5},
  {label: 'Lg', value: 0.75},
  {label: 'Full', value: 1},
] as const

const ACCENT_PRESETS = [
  {label: 'Default', value: '', swatch: 'hsl(245 72% 57%)'},
  {label: 'Blue', value: '220 90% 56%', swatch: 'hsl(220 90% 56%)'},
  {label: 'Green', value: '142 72% 40%', swatch: 'hsl(142 72% 40%)'},
  {label: 'Rose', value: '346 77% 50%', swatch: 'hsl(346 77% 50%)'},
  {label: 'Orange', value: '24 95% 53%', swatch: 'hsl(24 95% 53%)'},
  {label: 'Zinc', value: '240 5% 34%', swatch: 'hsl(240 5% 34%)'},
] as const

/**
 * Theme configurator — light/dark toggle, border-radius slider, and accent color picker.
 * Demonstrates how consumers can override chart-studio's CSS variables.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [radius, setRadius] = useState(getStoredRadius)
  const [accent, setAccent] = useState(getStoredAccent)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => applyRadius(radius), [radius])
  useEffect(() => applyAccent(accent), [accent])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted/50 ${
          open ? 'bg-muted/50' : ''
        }`}
      >
        <span
          className="inline-block h-3 w-3 rounded-full border border-border/50"
          style={{background: accent ? `hsl(${accent})` : 'hsl(245 72% 57%)'}}
        />
        Theme
        <svg
          className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border/50 bg-popover p-4 text-popover-foreground shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.05)]">
          {/* Mode */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Mode
            </div>
            <div className="inline-flex w-full items-center rounded-lg border border-border bg-card p-0.5">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    theme === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Radius
            </div>
            <div className="inline-flex w-full items-center gap-1 rounded-lg border border-border bg-card p-0.5">
              {RADIUS_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setRadius(preset.value)}
                  className={`flex-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors ${
                    radius === preset.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Accent
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.label}
                  onClick={() => setAccent(preset.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    accent === preset.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{background: preset.swatch}}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
