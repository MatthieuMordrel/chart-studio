import {useEffect, useRef, useState} from 'react'

export type Mode = 'light' | 'dark'

const STORAGE_PREFIX = 'chart-studio-playground'
const MODE_KEY = `${STORAGE_PREFIX}-mode`
const RADIUS_KEY = `${STORAGE_PREFIX}-radius`
const THEME_KEY = `${STORAGE_PREFIX}-theme`

// ---------------------------------------------------------------------------
// CSS variable names we manage
// ---------------------------------------------------------------------------

/** Chrome variables set per theme + mode. */
const CHROME_VARS = [
  'background', 'foreground', 'card', 'card-foreground',
  'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'muted', 'muted-foreground', 'border', 'input', 'ring',
] as const

/** Chart color variables set per theme. */
const CHART_VARS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const

// ---------------------------------------------------------------------------
// Theme data — sourced from shadcn v4 (OKLCH)
// ---------------------------------------------------------------------------

type ThemeVars = {
  light: Record<string, string>
  dark: Record<string, string>
}

type ThemePreset = {
  name: string
  label: string
  /** Primary swatch color shown in the picker. */
  swatch: string
  /** null means "use chart-studio defaults" (remove all overrides). */
  vars: ThemeVars | null
}

/** Shared neutral base chrome that colored themes inherit from. */
const NEUTRAL_BASE: ThemeVars = {
  light: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.145 0 0)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.145 0 0)',
    primary: 'oklch(0.205 0 0)',
    'primary-foreground': 'oklch(0.985 0 0)',
    muted: 'oklch(0.97 0 0)',
    'muted-foreground': 'oklch(0.556 0 0)',
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',
    'chart-1': 'oklch(0.809 0.105 251.813)',
    'chart-2': 'oklch(0.623 0.214 259.815)',
    'chart-3': 'oklch(0.546 0.245 262.881)',
    'chart-4': 'oklch(0.488 0.243 264.376)',
    'chart-5': 'oklch(0.424 0.199 265.638)',
  },
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    card: 'oklch(0.205 0 0)',
    'card-foreground': 'oklch(0.985 0 0)',
    popover: 'oklch(0.205 0 0)',
    'popover-foreground': 'oklch(0.985 0 0)',
    primary: 'oklch(0.922 0 0)',
    'primary-foreground': 'oklch(0.205 0 0)',
    muted: 'oklch(0.269 0 0)',
    'muted-foreground': 'oklch(0.708 0 0)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',
    'chart-1': 'oklch(0.809 0.105 251.813)',
    'chart-2': 'oklch(0.623 0.214 259.815)',
    'chart-3': 'oklch(0.546 0.245 262.881)',
    'chart-4': 'oklch(0.488 0.243 264.376)',
    'chart-5': 'oklch(0.424 0.199 265.638)',
  },
}

/** Merge a partial colored theme with the neutral base. */
function withBase(overrides: {light: Record<string, string>; dark: Record<string, string>}): ThemeVars {
  return {
    light: {...NEUTRAL_BASE.light, ...overrides.light},
    dark: {...NEUTRAL_BASE.dark, ...overrides.dark},
  }
}

const THEME_PRESETS: readonly ThemePreset[] = [
  {
    name: 'default',
    label: 'Default',
    swatch: 'hsl(245 72% 57%)',
    vars: null,
  },
  {
    name: 'blue',
    label: 'Blue',
    swatch: 'oklch(0.488 0.243 264.376)',
    vars: withBase({
      light: {
        primary: 'oklch(0.488 0.243 264.376)',
        'primary-foreground': 'oklch(0.97 0.014 254.604)',
        'chart-1': 'oklch(0.809 0.105 251.813)',
        'chart-2': 'oklch(0.623 0.214 259.815)',
        'chart-3': 'oklch(0.546 0.245 262.881)',
        'chart-4': 'oklch(0.488 0.243 264.376)',
        'chart-5': 'oklch(0.424 0.199 265.638)',
      },
      dark: {
        primary: 'oklch(0.424 0.199 265.638)',
        'primary-foreground': 'oklch(0.97 0.014 254.604)',
        'chart-1': 'oklch(0.809 0.105 251.813)',
        'chart-2': 'oklch(0.623 0.214 259.815)',
        'chart-3': 'oklch(0.546 0.245 262.881)',
        'chart-4': 'oklch(0.488 0.243 264.376)',
        'chart-5': 'oklch(0.424 0.199 265.638)',
      },
    }),
  },
  {
    name: 'green',
    label: 'Green',
    swatch: 'oklch(0.532 0.157 131.589)',
    vars: withBase({
      light: {
        primary: 'oklch(0.532 0.157 131.589)',
        'primary-foreground': 'oklch(0.986 0.031 120.757)',
        'chart-1': 'oklch(0.871 0.15 154.449)',
        'chart-2': 'oklch(0.723 0.219 149.579)',
        'chart-3': 'oklch(0.627 0.194 149.214)',
        'chart-4': 'oklch(0.527 0.154 150.069)',
        'chart-5': 'oklch(0.448 0.119 151.328)',
      },
      dark: {
        primary: 'oklch(0.453 0.124 130.933)',
        'primary-foreground': 'oklch(0.986 0.031 120.757)',
        'chart-1': 'oklch(0.871 0.15 154.449)',
        'chart-2': 'oklch(0.723 0.219 149.579)',
        'chart-3': 'oklch(0.627 0.194 149.214)',
        'chart-4': 'oklch(0.527 0.154 150.069)',
        'chart-5': 'oklch(0.448 0.119 151.328)',
      },
    }),
  },
  {
    name: 'orange',
    label: 'Orange',
    swatch: 'oklch(0.553 0.195 38.402)',
    vars: withBase({
      light: {
        primary: 'oklch(0.553 0.195 38.402)',
        'primary-foreground': 'oklch(0.98 0.016 73.684)',
        'chart-1': 'oklch(0.837 0.128 66.29)',
        'chart-2': 'oklch(0.705 0.213 47.604)',
        'chart-3': 'oklch(0.646 0.222 41.116)',
        'chart-4': 'oklch(0.553 0.195 38.402)',
        'chart-5': 'oklch(0.47 0.157 37.304)',
      },
      dark: {
        primary: 'oklch(0.47 0.157 37.304)',
        'primary-foreground': 'oklch(0.98 0.016 73.684)',
        'chart-1': 'oklch(0.837 0.128 66.29)',
        'chart-2': 'oklch(0.705 0.213 47.604)',
        'chart-3': 'oklch(0.646 0.222 41.116)',
        'chart-4': 'oklch(0.553 0.195 38.402)',
        'chart-5': 'oklch(0.47 0.157 37.304)',
      },
    }),
  },
  {
    name: 'rose',
    label: 'Rose',
    swatch: 'oklch(0.514 0.222 16.935)',
    vars: withBase({
      light: {
        primary: 'oklch(0.514 0.222 16.935)',
        'primary-foreground': 'oklch(0.969 0.015 12.422)',
        'chart-1': 'oklch(0.81 0.117 11.638)',
        'chart-2': 'oklch(0.645 0.246 16.439)',
        'chart-3': 'oklch(0.586 0.253 17.585)',
        'chart-4': 'oklch(0.514 0.222 16.935)',
        'chart-5': 'oklch(0.455 0.188 13.697)',
      },
      dark: {
        primary: 'oklch(0.455 0.188 13.697)',
        'primary-foreground': 'oklch(0.969 0.015 12.422)',
        'chart-1': 'oklch(0.81 0.117 11.638)',
        'chart-2': 'oklch(0.645 0.246 16.439)',
        'chart-3': 'oklch(0.586 0.253 17.585)',
        'chart-4': 'oklch(0.514 0.222 16.935)',
        'chart-5': 'oklch(0.455 0.188 13.697)',
      },
    }),
  },
  {
    name: 'violet',
    label: 'Violet',
    swatch: 'oklch(0.491 0.27 292.581)',
    vars: withBase({
      light: {
        primary: 'oklch(0.491 0.27 292.581)',
        'primary-foreground': 'oklch(0.969 0.016 293.756)',
        'chart-1': 'oklch(0.811 0.111 293.571)',
        'chart-2': 'oklch(0.606 0.25 292.717)',
        'chart-3': 'oklch(0.541 0.281 293.009)',
        'chart-4': 'oklch(0.491 0.27 292.581)',
        'chart-5': 'oklch(0.432 0.232 292.759)',
      },
      dark: {
        primary: 'oklch(0.432 0.232 292.759)',
        'primary-foreground': 'oklch(0.969 0.016 293.756)',
        'chart-1': 'oklch(0.811 0.111 293.571)',
        'chart-2': 'oklch(0.606 0.25 292.717)',
        'chart-3': 'oklch(0.541 0.281 293.009)',
        'chart-4': 'oklch(0.491 0.27 292.581)',
        'chart-5': 'oklch(0.432 0.232 292.759)',
      },
    }),
  },
  {
    name: 'yellow',
    label: 'Yellow',
    swatch: 'oklch(0.852 0.199 91.936)',
    vars: withBase({
      light: {
        primary: 'oklch(0.852 0.199 91.936)',
        'primary-foreground': 'oklch(0.421 0.095 57.708)',
        'chart-1': 'oklch(0.905 0.182 98.111)',
        'chart-2': 'oklch(0.795 0.184 86.047)',
        'chart-3': 'oklch(0.681 0.162 75.834)',
        'chart-4': 'oklch(0.554 0.135 66.442)',
        'chart-5': 'oklch(0.476 0.114 61.907)',
      },
      dark: {
        primary: 'oklch(0.795 0.184 86.047)',
        'primary-foreground': 'oklch(0.421 0.095 57.708)',
        'chart-1': 'oklch(0.905 0.182 98.111)',
        'chart-2': 'oklch(0.795 0.184 86.047)',
        'chart-3': 'oklch(0.681 0.162 75.834)',
        'chart-4': 'oklch(0.554 0.135 66.442)',
        'chart-5': 'oklch(0.476 0.114 61.907)',
      },
    }),
  },
] as const

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function getStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  return (window.localStorage.getItem(key) as T | null) ?? fallback
}

function getStoredNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key)
  return v ? Number(v) : fallback
}

// ---------------------------------------------------------------------------
// Apply helpers
// ---------------------------------------------------------------------------

const ALL_VARS = [...CHROME_VARS, ...CHART_VARS] as const

function applyMode(mode: Mode) {
  document.documentElement.dataset.theme = mode
  window.localStorage.setItem(MODE_KEY, mode)
}

function applyRadius(rem: number) {
  document.documentElement.style.setProperty('--radius', `${rem}rem`)
  window.localStorage.setItem(RADIUS_KEY, String(rem))
}

function applyThemePreset(themeName: string, mode: Mode) {
  const root = document.documentElement.style
  const preset = THEME_PRESETS.find((t) => t.name === themeName)

  if (!preset?.vars) {
    // Default theme — remove all overrides so theme.css defaults kick in
    for (const v of ALL_VARS) root.removeProperty(`--${v}`)
    window.localStorage.setItem(THEME_KEY, themeName)
    return
  }

  const modeVars = mode === 'dark' ? preset.vars.dark : preset.vars.light
  for (const v of ALL_VARS) {
    if (modeVars[v]) {
      root.setProperty(`--${v}`, modeVars[v])
    } else {
      root.removeProperty(`--${v}`)
    }
  }
  window.localStorage.setItem(THEME_KEY, themeName)
}

// ---------------------------------------------------------------------------
// Radius presets
// ---------------------------------------------------------------------------

const RADIUS_PRESETS = [
  {label: 'None', value: 0, title: '--radius: 0rem'},
  {label: 'Sm', value: 0.25, title: '--radius: 0.25rem'},
  {label: 'Md', value: 0.5, title: '--radius: 0.5rem'},
  {label: 'Lg', value: 0.75, title: '--radius: 0.75rem'},
  {label: 'Full', value: 1, title: '--radius: 1rem'},
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Build a tooltip showing all CSS vars a theme preset sets. */
function buildThemeTooltip(preset: ThemePreset, mode: Mode): string {
  if (!preset.vars) return `${preset.label}\nUses built-in theme from @matthieumordrel/chart-studio/ui/theme.css`
  const vars = mode === 'dark' ? preset.vars.dark : preset.vars.light
  const lines = [preset.label]
  for (const key of [...CHROME_VARS, ...CHART_VARS]) {
    if (vars[key]) lines.push(`--${key}: ${vars[key]}`)
  }
  return lines.join('\n')
}

/**
 * Theme configurator — mode toggle, radius slider, and full shadcn v4 theme presets.
 * Demonstrates how consumers can override chart-studio's CSS variables.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => getStored(MODE_KEY, 'light'))
  const [radius, setRadius] = useState(() => getStoredNumber(RADIUS_KEY, 0.5))
  const [themeName, setThemeName] = useState(() => getStored(THEME_KEY, 'default'))
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => applyMode(mode), [mode])
  useEffect(() => applyRadius(radius), [radius])
  // Re-apply theme vars when mode or theme changes (since vars differ per mode)
  useEffect(() => applyThemePreset(themeName, mode), [themeName, mode])

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

  const activePreset = THEME_PRESETS.find((t) => t.name === themeName) ?? THEME_PRESETS[0]

  return (
    <div ref={panelRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted/50 ${
          open ? 'bg-muted/50' : ''
        }`}
      >
        <span
          className="inline-block h-3 w-3 rounded-full border border-border/50"
          style={{background: activePreset.swatch}}
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

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border/50 bg-popover p-4 text-popover-foreground shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.05)]">
          {/* Mode */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Mode
            </div>
            <div className="inline-flex w-full items-center rounded-lg border border-border bg-card p-0.5">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  title={`color-scheme: ${m}`}
                  className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    mode === m
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'light' ? 'Light' : 'Dark'}
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
                  title={preset.title}
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

          {/* Theme presets */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Color theme
            </div>
            <div className="grid grid-cols-4 gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={buildThemeTooltip(preset, mode)}
                  onClick={() => setThemeName(preset.name)}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                    themeName === preset.name
                      ? 'bg-muted ring-1 ring-primary/40'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-border/50"
                    style={{background: preset.swatch}}
                  />
                  <span className="text-[10px] text-muted-foreground">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
