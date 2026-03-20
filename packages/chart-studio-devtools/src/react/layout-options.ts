/**
 * User-tunable ELK layered options for the devtools graph (see eclipse.dev/elk/reference).
 */

/** `elk.layered.crossingMinimization.strategy` */
export type DevtoolsElkCrossingStrategy =
  | 'LAYER_SWEEP'
  | 'MEDIAN_LAYER_SWEEP'
  | 'INTERACTIVE'
  | 'NONE'

/** `elk.layered.nodePlacement.strategy` */
export type DevtoolsElkNodePlacementStrategy =
  | 'NETWORK_SIMPLEX'
  | 'LINEAR_SEGMENTS'
  | 'SIMPLE'
  | 'BRANDES_KOEPF'
  | 'INTERACTIVE'

/** Values for crossing-minimization `<select>` (ELK enum names). */
export const DEVTOOLS_ELK_CROSSING_OPTIONS: readonly DevtoolsElkCrossingStrategy[] = [
  'LAYER_SWEEP',
  'MEDIAN_LAYER_SWEEP',
  'INTERACTIVE',
  'NONE',
]

/** Values for node-placement `<select>` (ELK enum names). */
export const DEVTOOLS_ELK_NODE_PLACEMENT_OPTIONS: readonly DevtoolsElkNodePlacementStrategy[] = [
  'NETWORK_SIMPLEX',
  'LINEAR_SEGMENTS',
  'SIMPLE',
  'BRANDES_KOEPF',
  'INTERACTIVE',
]

/**
 * Structured layout settings mirrored into ELK string options by
 * {@link devtoolsElkLayoutToElkOptions}.
 */
export type DevtoolsElkLayoutConfig = {
  /** `elk.layered.spacing.nodeNodeBetweenLayers` (horizontal gap between layers). */
  spacingBetweenLayers: number
  /** `elk.spacing.nodeNode` (vertical gap within a layer). */
  spacingNodeNode: number
  /** Uniform `elk.padding` on all sides (px). */
  padding: number
  crossingMinimizationStrategy: DevtoolsElkCrossingStrategy
  nodePlacementStrategy: DevtoolsElkNodePlacementStrategy
}

export const DEFAULT_DEVTOOLS_ELK_LAYOUT: DevtoolsElkLayoutConfig = {
  spacingBetweenLayers: 188,
  spacingNodeNode: 112,
  padding: 38,
  crossingMinimizationStrategy: 'MEDIAN_LAYER_SWEEP',
  nodePlacementStrategy: 'NETWORK_SIMPLEX',
}

function deriveEdgeNodeSpacing(config: DevtoolsElkLayoutConfig): number {
  return Math.max(28, Math.round(config.spacingNodeNode * 0.3))
}

function deriveEdgeNodeBetweenLayersSpacing(config: DevtoolsElkLayoutConfig): number {
  return Math.max(26, Math.round(config.spacingBetweenLayers * 0.17))
}

function deriveEdgeEdgeBetweenLayersSpacing(config: DevtoolsElkLayoutConfig): number {
  return Math.max(18, Math.round(config.spacingBetweenLayers * 0.12))
}

/**
 * Slightly opens spacing when many edges share the graph so lines stay readable.
 *
 * @param config - User / persisted ELK settings
 * @param edgeCount - Number of edges in the current layout
 * @param nodeCount - Number of nodes in the current layout
 */
export function adjustDevtoolsLayoutForEdgeDensity(
  config: DevtoolsElkLayoutConfig,
  edgeCount: number,
  nodeCount: number,
): DevtoolsElkLayoutConfig {
  const normalized = normalizeDevtoolsElkLayoutConfig(config)
  const avgEdgesPerNode = edgeCount / Math.max(1, nodeCount)
  const crowded =
    edgeCount >= 22
    || avgEdgesPerNode >= 2.35
    || (nodeCount >= 4 && edgeCount >= nodeCount * 2)

  if (!crowded) {
    return normalized
  }

  return normalizeDevtoolsElkLayoutConfig({
    ...normalized,
    spacingBetweenLayers: Math.round(Math.max(normalized.spacingBetweenLayers * 1.14, 228)),
    spacingNodeNode: Math.round(Math.max(normalized.spacingNodeNode * 1.12, 132)),
    padding: Math.round(Math.max(normalized.padding * 1.08, 44)),
  })
}

export const DEVTOOLS_ELK_LAYOUT_PRESETS = {
  compact: {
    label: 'Compact',
    config: {
      spacingBetweenLayers: 148,
      spacingNodeNode: 92,
      padding: 30,
      crossingMinimizationStrategy: 'LAYER_SWEEP',
      nodePlacementStrategy: 'NETWORK_SIMPLEX',
    } satisfies DevtoolsElkLayoutConfig,
  },
  balanced: {
    label: 'Balanced',
    config: {...DEFAULT_DEVTOOLS_ELK_LAYOUT},
  },
  spacious: {
    label: 'Spacious',
    config: {
      spacingBetweenLayers: 340,
      spacingNodeNode: 220,
      padding: 80,
      crossingMinimizationStrategy: 'MEDIAN_LAYER_SWEEP',
      nodePlacementStrategy: 'NETWORK_SIMPLEX',
    } satisfies DevtoolsElkLayoutConfig,
  },
} as const

const CROSSING_STRATEGIES: ReadonlySet<string> = new Set([
  'LAYER_SWEEP',
  'MEDIAN_LAYER_SWEEP',
  'INTERACTIVE',
  'NONE',
])

const NODE_PLACEMENT_STRATEGIES: ReadonlySet<string> = new Set([
  'NETWORK_SIMPLEX',
  'LINEAR_SEGMENTS',
  'SIMPLE',
  'BRANDES_KOEPF',
  'INTERACTIVE',
])

/**
 * @param value - Parsed JSON from storage or elsewhere
 * @returns Whether `value` is a usable {@link DevtoolsElkLayoutConfig}
 */
export function isValidDevtoolsElkLayoutConfig(value: unknown): value is DevtoolsElkLayoutConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const v = value as Record<string, unknown>

  if (typeof v['spacingBetweenLayers'] !== 'number' || !Number.isFinite(v['spacingBetweenLayers'])) {
    return false
  }

  if (typeof v['spacingNodeNode'] !== 'number' || !Number.isFinite(v['spacingNodeNode'])) {
    return false
  }

  if (typeof v['padding'] !== 'number' || !Number.isFinite(v['padding'])) {
    return false
  }

  if (typeof v['crossingMinimizationStrategy'] !== 'string' || !CROSSING_STRATEGIES.has(v['crossingMinimizationStrategy'])) {
    return false
  }

  if (typeof v['nodePlacementStrategy'] !== 'string' || !NODE_PLACEMENT_STRATEGIES.has(v['nodePlacementStrategy'])) {
    return false
  }

  return true
}

/**
 * Clamps numeric fields to ELK-friendly ranges so the worker does not reject the graph.
 *
 * @param config - Raw config from the UI
 * @returns A safe copy for layout
 */
export function normalizeDevtoolsElkLayoutConfig(
  config: DevtoolsElkLayoutConfig,
): DevtoolsElkLayoutConfig {
  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(n)))

  return {
    ...config,
    spacingBetweenLayers: clamp(config.spacingBetweenLayers, 40, 900),
    spacingNodeNode: clamp(config.spacingNodeNode, 24, 600),
    padding: clamp(config.padding, 0, 200),
  }
}

/**
 * Builds the `layoutOptions` map passed to elkjs for the devtools graph root.
 *
 * @param config - Normalized layout settings
 */
export function devtoolsElkLayoutToElkOptions(
  config: DevtoolsElkLayoutConfig,
): Record<string, string> {
  const p = config.padding
  const edgeNodeSpacing = deriveEdgeNodeSpacing(config)
  const edgeNodeBetweenLayersSpacing = deriveEdgeNodeBetweenLayersSpacing(config)
  const edgeEdgeBetweenLayersSpacing = deriveEdgeEdgeBetweenLayersSpacing(config)

  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(config.spacingBetweenLayers),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(edgeNodeBetweenLayersSpacing),
    'elk.layered.spacing.edgeEdgeBetweenLayers': String(edgeEdgeBetweenLayersSpacing),
    'elk.spacing.nodeNode': String(config.spacingNodeNode),
    'elk.spacing.edgeNode': String(edgeNodeSpacing),
    'elk.padding': `[top=${p},left=${p},bottom=${p},right=${p}]`,
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.considerModelOrder.groupModelOrder.cmGroupOrderStrategy': 'ENFORCED',
    'elk.layered.crossingMinimization.strategy': config.crossingMinimizationStrategy,
    'elk.layered.nodePlacement.strategy': config.nodePlacementStrategy,
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
  }
}

/** localStorage key for persisting graph layout between sessions. */
export const DEVTOOLS_ELK_LAYOUT_STORAGE_KEY = 'chart-studio-devtools:elk-layout-v1'

/**
 * Reads persisted ELK layout from `localStorage`, or returns defaults if missing/invalid.
 */
export function loadStoredDevtoolsElkLayout(): DevtoolsElkLayoutConfig {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_DEVTOOLS_ELK_LAYOUT
  }

  try {
    const raw = localStorage.getItem(DEVTOOLS_ELK_LAYOUT_STORAGE_KEY)

    if (!raw) {
      return DEFAULT_DEVTOOLS_ELK_LAYOUT
    }

    const parsed: unknown = JSON.parse(raw)

    if (isValidDevtoolsElkLayoutConfig(parsed)) {
      return normalizeDevtoolsElkLayoutConfig(parsed)
    }
  } catch {
    // ignore
  }

  return DEFAULT_DEVTOOLS_ELK_LAYOUT
}

/**
 * Saves layout settings for the next devtools session.
 *
 * @param config - Current layout configuration
 */
export function persistDevtoolsElkLayout(config: DevtoolsElkLayoutConfig): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(
      DEVTOOLS_ELK_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeDevtoolsElkLayoutConfig(config)),
    )
  } catch {
    // ignore quota / private mode
  }
}
