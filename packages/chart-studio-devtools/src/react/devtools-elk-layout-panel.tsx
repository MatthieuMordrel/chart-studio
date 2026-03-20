import {
  DEFAULT_DEVTOOLS_ELK_LAYOUT,
  DEVTOOLS_ELK_CROSSING_OPTIONS,
  DEVTOOLS_ELK_LAYOUT_PRESETS,
  DEVTOOLS_ELK_NODE_PLACEMENT_OPTIONS,
  type DevtoolsElkCrossingStrategy,
  type DevtoolsElkLayoutConfig,
  type DevtoolsElkNodePlacementStrategy,
} from './layout-options.js'

type ElkLayoutPanelProps = {
  value: DevtoolsElkLayoutConfig
  onChange(next: DevtoolsElkLayoutConfig): void
}

const CROSSING_LABELS: Record<DevtoolsElkCrossingStrategy, string> = {
  LAYER_SWEEP: 'Layer sweep',
  MEDIAN_LAYER_SWEEP: 'Median layer sweep',
  INTERACTIVE: 'Interactive',
  NONE: 'None',
}

const PLACEMENT_LABELS: Record<DevtoolsElkNodePlacementStrategy, string> = {
  NETWORK_SIMPLEX: 'Network simplex',
  LINEAR_SEGMENTS: 'Linear segments',
  SIMPLE: 'Simple',
  BRANDES_KOEPF: 'Brandes–Köpf',
  INTERACTIVE: 'Interactive',
}

/**
 * Expandable ELK layered layout controls (spacing, crossing, placement) for the graph canvas.
 *
 * @param value - Current layout configuration
 * @param onChange - Called when the user edits a field or applies a preset
 */
export function ElkLayoutPanel({value, onChange}: ElkLayoutPanelProps) {
  /**
   * Merges a partial update into the current layout config.
   *
   * @param partial - Fields to replace
   */
  function patch(partial: Partial<DevtoolsElkLayoutConfig>) {
    onChange({...value, ...partial})
  }

  return (
    <details className='csdt-layout-panel'>
      <summary className='csdt-layout-panel__summary'>
        Graph layout (ELK)
      </summary>

      <div className='csdt-layout-panel__body'>
        <p className='csdt-layout-panel__hint'>
          Tunable layered layout. Option names match{' '}
          <a
            href='https://eclipse.dev/elk/reference/options.html'
            target='_blank'
            rel='noreferrer'>
            ELK reference
          </a>
          .
        </p>

        <div className='csdt-layout-panel__presets' role='group' aria-label='Layout presets'>
          {(Object.keys(DEVTOOLS_ELK_LAYOUT_PRESETS) as Array<keyof typeof DEVTOOLS_ELK_LAYOUT_PRESETS>).map((key) => {
            const entry = DEVTOOLS_ELK_LAYOUT_PRESETS[key]

            return (
              <button
                key={key}
                type='button'
                onClick={() => onChange({...entry.config})}>
                {entry.label}
              </button>
            )
          })}
          <button
            type='button'
            onClick={() => onChange({...DEFAULT_DEVTOOLS_ELK_LAYOUT})}>
            Reset defaults
          </button>
        </div>

        <div className='csdt-layout-panel__grid'>
          <label className='csdt-layout-panel__field'>
            <span>Between layers</span>
            <input
              type='number'
              min={40}
              max={900}
              step={10}
              value={value.spacingBetweenLayers}
              onChange={(event) => {
                const n = Number(event.target.value)

                if (Number.isFinite(n)) {
                  patch({spacingBetweenLayers: n})
                }
              }}
            />
            <small className='csdt-muted'>elk.layered.spacing.nodeNodeBetweenLayers</small>
          </label>

          <label className='csdt-layout-panel__field'>
            <span>Same layer</span>
            <input
              type='number'
              min={24}
              max={600}
              step={8}
              value={value.spacingNodeNode}
              onChange={(event) => {
                const n = Number(event.target.value)

                if (Number.isFinite(n)) {
                  patch({spacingNodeNode: n})
                }
              }}
            />
            <small className='csdt-muted'>elk.spacing.nodeNode</small>
          </label>

          <label className='csdt-layout-panel__field'>
            <span>Padding</span>
            <input
              type='number'
              min={0}
              max={200}
              step={4}
              value={value.padding}
              onChange={(event) => {
                const n = Number(event.target.value)

                if (Number.isFinite(n)) {
                  patch({padding: n})
                }
              }}
            />
            <small className='csdt-muted'>elk.padding (uniform)</small>
          </label>

          <label className='csdt-layout-panel__field'>
            <span>Crossing minimization</span>
            <select
              value={value.crossingMinimizationStrategy}
              onChange={(event) =>
                patch({crossingMinimizationStrategy: event.target.value as DevtoolsElkCrossingStrategy})}>
              {DEVTOOLS_ELK_CROSSING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CROSSING_LABELS[option]}
                </option>
              ))}
            </select>
            <small className='csdt-muted'>elk.layered.crossingMinimization.strategy</small>
          </label>

          <label className='csdt-layout-panel__field csdt-layout-panel__field--wide'>
            <span>Node placement</span>
            <select
              value={value.nodePlacementStrategy}
              onChange={(event) =>
                patch({nodePlacementStrategy: event.target.value as DevtoolsElkNodePlacementStrategy})}>
              {DEVTOOLS_ELK_NODE_PLACEMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PLACEMENT_LABELS[option]}
                </option>
              ))}
            </select>
            <small className='csdt-muted'>elk.layered.nodePlacement.strategy</small>
          </label>
        </div>
      </div>
    </details>
  )
}
