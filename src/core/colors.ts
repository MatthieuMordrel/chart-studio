/**
 * Color assignment for chart series.
 *
 * Uses shadcn chart CSS variables (`--chart-1` through `--chart-5`) by default.
 * Falls back to a built-in OKLCH palette when CSS variables are not available.
 */

/** Fallback palette using OKLCH for perceptually uniform colors. */
const FALLBACK_COLORS = [
  'oklch(0.65 0.15 250)', // blue
  'oklch(0.65 0.15 350)', // rose
  'oklch(0.65 0.15 200)', // cyan
  'oklch(0.65 0.15 70)', // amber
  'oklch(0.65 0.15 150)', // teal
  'oklch(0.65 0.15 30)', // orange
  'oklch(0.65 0.15 300)', // purple
  'oklch(0.65 0.15 120)', // green
  'oklch(0.65 0.12 170)', // mint
  'oklch(0.65 0.12 220)', // slate blue
] as const

/** Shadcn chart CSS variables (5 colors) with safe fallbacks. */
const SHADCN_CHART_COLORS = [
  `var(--chart-1, var(--cs-chart-1, hsl(245 72% 57%)))`,
  `var(--chart-2, var(--cs-chart-2, hsl(271 72% 55%)))`,
  `var(--chart-3, var(--cs-chart-3, hsl(330 68% 54%)))`,
  `var(--chart-4, var(--cs-chart-4, hsl(170 65% 38%)))`,
  `var(--chart-5, var(--cs-chart-5, hsl(30 90% 54%)))`,
] as const

/**
 * Get a color for the Nth series.
 * Cycles through the palette when index exceeds palette length.
 *
 * @param index - Zero-based series index
 * @param useShadcn - Whether to use shadcn CSS variables (default: true)
 * @returns CSS color value
 */
export function getSeriesColor(index: number, useShadcn = true): string {
  const palette = useShadcn ? SHADCN_CHART_COLORS : FALLBACK_COLORS
  return palette[index % palette.length]!
}

/**
 * Generate a color map for a list of group labels.
 * Assigns colors deterministically based on array order.
 *
 * @param groups - Array of group labels
 * @param useShadcn - Whether to use shadcn CSS variables (default: true)
 * @returns Map from group label to CSS color
 */
export function buildColorMap(groups: string[], useShadcn = true): Map<string, string> {
  const map = new Map<string, string>()
  for (let i = 0; i < groups.length; i++) {
    map.set(groups[i]!, getSeriesColor(i, useShadcn))
  }
  return map
}
