import {DEVTOOLS_NODE_WIDTH} from './layout.js'

export const DEVTOOLS_STYLES = `
.csdt-shell,
.csdt-shell * {
  box-sizing: border-box;
}

.csdt-shell {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--cs-foreground, #172032);
}

.csdt-shell__scrim,
.csdt-data-viewer__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in oklch, var(--cs-foreground, #101624) 18%, transparent);
  backdrop-filter: blur(6px);
}

.csdt-shell__workspace {
  position: absolute;
  inset: 2vh 1.5vw;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--cs-border, rgba(215, 224, 236, 0.92));
  border-radius: calc(var(--cs-radius, 0.25rem) + 8px);
  background: var(--cs-background, rgba(252, 253, 255, 0.98));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.csdt-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.csdt-canvas {
  position: relative;
  min-height: 0;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  overflow: hidden;
  border: 1px solid var(--cs-border, rgba(210, 221, 235, 0.9));
  background: var(--cs-muted, rgba(248, 250, 252, 0.98));
}

.csdt-canvas .react-flow {
  width: 100%;
  height: 100%;
}

.csdt-canvas .react-flow__node {
  width: ${DEVTOOLS_NODE_WIDTH}px;
}

.csdt-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.csdt-header__cluster {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.csdt-header__title h1 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--cs-foreground, #172032);
}

.csdt-sidepanel h3,
.csdt-data-viewer h2,
.csdt-empty-state h2 {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--cs-foreground, #172032);
}

.csdt-kicker {
  margin: 0 0 2px;
  color: var(--cs-muted-foreground, #6c7b91);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.csdt-muted {
  color: var(--cs-muted-foreground, #718198);
  font-size: 0.75rem;
}

.csdt-header__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  align-items: center;
}

.csdt-header select,
.csdt-header input,
.csdt-header button,
.csdt-segmented button,
.csdt-sidepanel button,
.csdt-issues-drawer button,
.csdt-node__footer button,
.csdt-data-viewer button,
.csdt-icon-button {
  border: 1px solid var(--cs-border, rgba(196, 208, 224, 0.9));
  background: var(--cs-background, rgba(255, 255, 255, 0.92));
  color: var(--cs-foreground, #1d293d);
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  padding: 6px 10px;
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.csdt-header select {
  cursor: pointer;
}

.csdt-header button:hover,
.csdt-segmented button:hover,
.csdt-sidepanel button:hover,
.csdt-issues-drawer button:hover,
.csdt-node__footer button:hover,
.csdt-data-viewer button:hover,
.csdt-icon-button:hover {
  border-color: var(--cs-primary, rgba(114, 139, 186, 0.56));
  background: color-mix(in oklch, var(--cs-muted, #f1f5f9) 40%, var(--cs-background, #fff));
}

.csdt-header button:disabled,
.csdt-segmented button:disabled,
.csdt-data-viewer button:disabled {
  opacity: 0.45;
  cursor: default;
}

.csdt-search {
  position: relative;
  min-width: 240px;
}

.csdt-search input {
  width: 100%;
  min-width: 0;
  padding-right: 14px;
  background: color-mix(in oklch, var(--cs-muted, #f1f5f9) 40%, var(--cs-background, #fff));
}

.csdt-search input:focus {
  outline: none;
  border-color: color-mix(in oklch, var(--cs-primary, #5879ba) 40%, transparent);
  background: var(--cs-background, #fff);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--cs-ring, #5879ba) 12%, transparent);
}

.csdt-search__results {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  padding: 4px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  border: 1px solid var(--cs-border, rgba(204, 215, 229, 0.96));
  background: var(--cs-popover, rgba(252, 253, 255, 0.98));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: auto;
  z-index: 20;
}

.csdt-search__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 2px);
}

.csdt-search__item:hover {
  background: var(--cs-muted, #f1f5f9);
}

.csdt-search__item strong {
  font-size: 0.75rem;
  font-weight: 500;
}

.csdt-search__item small {
  color: var(--cs-muted-foreground, #77869c);
  font-size: 0.6875rem;
}

.csdt-launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147482999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 10px;
  border: 1px solid var(--cs-border, rgba(221, 230, 242, 0.9));
  border-radius: calc(var(--cs-radius, 0.25rem) + 6px);
  background: var(--cs-popover, rgba(255, 255, 255, 0.96));
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 0 0 0 color-mix(in oklch, var(--cs-primary, #5879ba) 0%, transparent);
  color: var(--cs-foreground, #152036);
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.csdt-launcher:hover {
  border-color: color-mix(in oklch, var(--cs-primary, #5879ba) 50%, var(--cs-border, #dde6f2));
  background: color-mix(in oklch, var(--cs-primary, #5879ba) 3%, var(--cs-popover, #fff));
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 0 0 3px color-mix(in oklch, var(--cs-primary, #5879ba) 8%, transparent);
}

.csdt-launcher__logo {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--cs-primary, #5879ba);
}

.csdt-launcher__text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.csdt-launcher__text > span:first-child {
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: -0.01em;
}

.csdt-launcher__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--cs-primary, #5879ba) 12%, var(--cs-muted, #eef2f7));
  color: var(--cs-primary, #36507d);
  font-size: 0.5625rem;
  font-weight: 700;
  line-height: 1;
}

.csdt-segmented {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  background: var(--cs-muted, rgba(236, 241, 247, 0.9));
}

.csdt-segmented button {
  box-shadow: none;
  border-color: transparent;
  background: transparent;
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.csdt-segmented button.is-active {
  background: var(--cs-background, rgba(255, 255, 255, 0.98));
  border-color: var(--cs-border, rgba(199, 211, 228, 0.92));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.csdt-empty-state {
  margin: auto;
  max-width: 400px;
  padding: 24px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  border: 1px solid var(--cs-border, rgba(214, 223, 236, 0.94));
  background: var(--cs-card, rgba(255, 255, 255, 0.9));
  text-align: center;
}

.csdt-empty-state p {
  margin: 6px 0 0;
  color: var(--cs-muted-foreground, #718198);
  font-size: 0.75rem;
}

.csdt-sidepanel,
.csdt-issues-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  border: 1px solid var(--cs-border, rgba(214, 224, 236, 0.92));
  background: var(--cs-card, rgba(255, 255, 255, 0.94));
  overflow: auto;
}

.csdt-sidepanel.is-empty {
  justify-content: center;
}

.csdt-sidepanel__header,
.csdt-sidepanel__section,
.csdt-issues-drawer__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.csdt-sidepanel__section h4 {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--cs-muted-foreground, #6c7b91);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.csdt-sidepanel__actions {
  display: flex;
  gap: 6px;
}

.csdt-sidepanel__field-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.csdt-sidepanel__field,
.csdt-preview-row,
.csdt-issue-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 2px);
  background: var(--cs-muted, rgba(241, 245, 249, 0.9));
  font-size: 0.75rem;
}

.csdt-sidepanel__field.is-focused {
  outline: 2px solid color-mix(in oklch, var(--cs-ring, #5879ba) 20%, transparent);
}

.csdt-sidepanel__field strong {
  font-size: 0.75rem;
  font-weight: 500;
}

.csdt-sidepanel__field small {
  font-size: 0.6875rem;
  color: var(--cs-muted-foreground, #738197);
}

.csdt-issue-row {
  align-items: flex-start;
}

.csdt-issue-row.is-warning {
  border-left: 2px solid #d97706;
}

.csdt-issue-row.is-error {
  border-left: 2px solid #dc2626;
}

.csdt-issue-row strong {
  font-size: 0.75rem;
  font-weight: 500;
}

.csdt-issue-row small {
  display: block;
  margin-top: 2px;
  color: var(--cs-muted-foreground, #728199);
  font-size: 0.6875rem;
}

.csdt-node {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: ${DEVTOOLS_NODE_WIDTH}px;
  padding: 12px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  border: 1px solid var(--cs-border, rgba(211, 221, 234, 0.96));
  background: var(--cs-card, rgba(255, 255, 255, 0.98));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.csdt-node.is-materialized {
  background: color-mix(in oklch, var(--cs-card, #fff) 92%, oklch(0.75 0.1 70));
}

.csdt-node.is-selected {
  border-color: var(--cs-primary, rgba(87, 120, 191, 0.82));
  box-shadow:
    0 0 0 2px color-mix(in oklch, var(--cs-ring, #5879ba) 16%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

.csdt-node.is-focused {
  border-color: color-mix(in oklch, var(--cs-primary, #5879ba) 40%, var(--cs-border, #d3ddea));
}

.csdt-node.is-dimmed {
  opacity: 0.35;
}

.csdt-node__hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.csdt-node__hero h3 {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--cs-foreground, #172032);
}

.csdt-node__hero p {
  margin: 0;
  color: var(--cs-muted-foreground, #718198);
  font-size: 0.6875rem;
}

.csdt-data-viewer__header p,
.csdt-data-viewer__header h2 {
  margin: 0;
}

.csdt-node__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-bottom: 2px;
}

.csdt-node__type,
.csdt-node__issue-count,
.csdt-context-pill,
.csdt-filter-pill,
.csdt-attribute-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 2px);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.csdt-node__type,
.csdt-context-pill {
  background: color-mix(in oklch, var(--cs-primary, #36507d) 8%, var(--cs-muted, #e5ecf8));
  color: var(--cs-primary, #36507d);
}

.csdt-node__issue-count {
  background: rgba(255, 241, 222, 0.96);
  color: #b45309;
}

.csdt-filter-pill,
.csdt-attribute-chip {
  background: var(--cs-muted, rgba(238, 242, 247, 0.96));
  color: var(--cs-muted-foreground, #58677b);
}

.csdt-node__attributes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.csdt-node__fields {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.csdt-field {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--cs-border, rgba(222, 230, 240, 0.98));
  border-radius: calc(var(--cs-radius, 0.25rem) + 2px);
  background: var(--cs-background, rgba(255, 255, 255, 0.96));
  text-align: left;
  font: inherit;
  font-size: 0.75rem;
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}

.csdt-field:hover {
  background: var(--cs-muted, #f1f5f9);
}

.csdt-field.is-field-focused {
  border-color: color-mix(in oklch, var(--cs-primary, #5d81cb) 40%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--cs-ring, #5d81cb) 10%, transparent);
}

.csdt-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--cs-muted-foreground, #738197);
}

.csdt-type-icon svg {
  width: 100%;
  height: 100%;
}

.csdt-field__main {
  display: flex;
  align-items: center;
  gap: 5px;
}

.csdt-field__main span {
  font-weight: 500;
  font-size: 0.75rem;
}

.csdt-sidepanel__field-label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.csdt-sidepanel__field-label strong {
  font-size: 0.75rem;
  font-weight: 500;
}

.csdt-field__badges {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 3px;
}

.csdt-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 1px 5px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 2px);
  background: var(--cs-muted, rgba(238, 243, 248, 0.98));
  color: var(--cs-muted-foreground, #516073);
  font-size: 0.5625rem;
  font-weight: 600;
}

.csdt-node__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.csdt-node__footer button {
  flex: 1 1 80px;
  padding: 4px 8px;
  font-size: 0.6875rem;
}

.csdt-handle {
  width: 8px !important;
  height: 8px !important;
  border-radius: 999px;
  background: var(--cs-primary, #5879ba) !important;
  opacity: 0.7;
}

.csdt-edge {
  stroke: var(--cs-muted-foreground, #7d8da4);
  stroke-width: 1.5;
}

.csdt-edge.is-relationship {
  stroke: var(--cs-primary, #5f7cb0);
}

.csdt-edge.is-association {
  stroke: #cf7e2c;
}

.csdt-edge.is-materialization {
  stroke: #7c8c63;
  stroke-dasharray: 6 4;
}

.csdt-edge.is-inferred {
  stroke-dasharray: 6 6;
}

.csdt-edge.is-dimmed {
  opacity: 0.18;
}

.csdt-edge-label {
  position: absolute;
  padding: 3px 7px;
  border: 1px solid var(--cs-border, rgba(211, 221, 236, 0.96));
  border-radius: 999px;
  background: var(--cs-popover, rgba(255, 255, 255, 0.94));
  color: var(--cs-muted-foreground, #42516a);
  font: inherit;
  font-size: 0.625rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.csdt-edge-label:hover {
  border-color: var(--cs-primary, #5c80c7);
  color: var(--cs-foreground, #1d2a40);
}

.csdt-edge-label.is-selected {
  color: var(--cs-foreground, #1d2a40);
  border-color: color-mix(in oklch, var(--cs-primary, #5c80c7) 50%, transparent);
  background: color-mix(in oklch, var(--cs-primary, #5c80c7) 6%, var(--cs-popover, #fff));
}

.csdt-marker-stroke {
  fill: none;
  stroke: var(--cs-muted-foreground, #64748b);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.csdt-marker-fill {
  fill: #7c8c63;
  opacity: 0.85;
}

.csdt-data-viewer {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
}

.csdt-data-viewer__panel {
  position: absolute;
  inset: 6vh 4vw;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: calc(var(--cs-radius, 0.25rem) + 8px);
  border: 1px solid var(--cs-border, rgba(214, 224, 236, 0.92));
  background: var(--cs-background, rgba(255, 255, 255, 0.97));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.csdt-data-viewer__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.csdt-data-viewer__inspect,
.csdt-data-viewer__explore {
  min-height: 0;
  flex: 1;
}

.csdt-data-viewer__inspect {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.csdt-json-viewer__shell,
.csdt-grid {
  flex: 1;
  min-height: 0;
  border-radius: calc(var(--cs-radius, 0.25rem) + 4px);
  border: 1px solid var(--cs-border, rgba(215, 223, 235, 0.95));
  background: var(--cs-card, rgba(251, 252, 254, 0.98));
}

.csdt-json-viewer__shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.csdt-json-viewer {
  margin: 0;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  font-family: "SFMono-Regular", ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--cs-foreground, #172032);
}

.csdt-grid {
  position: relative;
  overflow: auto;
}

.csdt-grid__inner {
  position: relative;
  min-width: 100%;
  width: max-content;
}

.csdt-grid__body {
  position: relative;
  width: 100%;
}

.csdt-grid__row {
  position: absolute;
  left: 0;
  display: flex;
  box-sizing: border-box;
  min-width: 100%;
  width: max-content;
  min-height: 36px;
  border-bottom: 1px solid var(--cs-border, rgba(231, 236, 243, 0.95));
}

.csdt-grid__row--header {
  position: sticky;
  top: 0;
  z-index: 2;
  transform: none !important;
  font-weight: 500;
}

.csdt-grid__cell {
  padding: 8px 10px;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
}

.csdt-grid__cell--header {
  white-space: normal;
  word-break: break-word;
  background: var(--cs-muted, rgba(245, 248, 251, 0.98));
  box-shadow: inset 0 -1px 0 var(--cs-border, rgba(231, 236, 243, 0.95));
}

.csdt-grid__header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.csdt-grid__header span {
  font-size: 0.75rem;
  font-weight: 500;
}

.csdt-markers {
  position: absolute;
}

.csdt-data-viewer__controls,
.csdt-data-viewer__pagination,
.csdt-data-viewer__context,
.csdt-pagination__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.csdt-data-viewer__pagination span {
  font-size: 0.75rem;
  color: var(--cs-muted-foreground, #718198);
}

@media (max-width: 1080px) {
  .csdt-shell__workspace {
    inset: 1vh 1vw;
    padding: 10px;
  }

  .csdt-workspace {
    grid-template-columns: 1fr;
  }

  .csdt-sidepanel,
  .csdt-issues-drawer {
    max-height: 260px;
  }

  .csdt-data-viewer__panel {
    inset: 2vh 1.5vw;
  }
}
`
