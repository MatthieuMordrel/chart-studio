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
  font-family: "Avenir Next", "Segoe UI", "Inter", system-ui, sans-serif;
  color: #172032;
}

.csdt-shell__scrim,
.csdt-data-viewer__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(205, 222, 250, 0.42), transparent 32%),
    radial-gradient(circle at right, rgba(246, 225, 198, 0.34), transparent 28%),
    rgba(16, 22, 36, 0.24);
  backdrop-filter: blur(10px);
}

.csdt-shell__workspace {
  position: absolute;
  inset: 2.5vh 1.8vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(215, 224, 236, 0.92);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(252, 253, 255, 0.95), rgba(244, 247, 251, 0.96)),
    rgba(255, 255, 255, 0.86);
  box-shadow:
    0 48px 120px rgba(15, 23, 42, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.csdt-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  min-height: 0;
  flex: 1;
}

.csdt-canvas {
  position: relative;
  min-height: 0;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(210, 221, 235, 0.9);
  background:
    radial-gradient(circle at top, rgba(222, 231, 244, 0.62), transparent 34%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(239, 244, 248, 0.98));
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
  gap: 10px;
}

.csdt-header__cluster {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.csdt-header__title h1,
.csdt-sidepanel h3,
.csdt-data-viewer h2,
.csdt-empty-state h2 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.csdt-kicker {
  margin: 0 0 4px;
  color: #6c7b91;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.csdt-muted {
  color: #718198;
}

.csdt-header__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
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
  border: 1px solid rgba(196, 208, 224, 0.9);
  background: rgba(255, 255, 255, 0.92);
  color: #1d293d;
  border-radius: 12px;
  padding: 10px 14px;
  font: inherit;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
  box-shadow: 0 8px 24px rgba(21, 31, 52, 0.06);
}

.csdt-header button:hover,
.csdt-segmented button:hover,
.csdt-sidepanel button:hover,
.csdt-issues-drawer button:hover,
.csdt-node__footer button:hover,
.csdt-data-viewer button:hover,
.csdt-icon-button:hover {
  transform: translateY(-1px);
  border-color: rgba(114, 139, 186, 0.56);
}

.csdt-header button:disabled,
.csdt-segmented button:disabled,
.csdt-data-viewer button:disabled {
  opacity: 0.56;
  transform: none;
}

.csdt-search {
  position: relative;
  min-width: 320px;
}

.csdt-search input {
  width: 100%;
  min-width: 0;
  padding-right: 18px;
}

.csdt-search__results {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(204, 215, 229, 0.96);
  background: rgba(252, 253, 255, 0.98);
  box-shadow: 0 28px 80px rgba(18, 28, 45, 0.18);
  overflow: auto;
  z-index: 20;
}

.csdt-search__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 11px 12px;
}

.csdt-search__item strong {
  font-size: 0.95rem;
}

.csdt-search__item small {
  color: #77869c;
}

.csdt-launcher {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147482999;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 14px 18px;
  border: 1px solid rgba(221, 230, 242, 0.9);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 252, 0.98));
  box-shadow: 0 24px 60px rgba(17, 25, 40, 0.18);
  color: #152036;
  font: inherit;
}

.csdt-launcher span {
  font-weight: 700;
}

.csdt-launcher small {
  color: #6d7f99;
}

.csdt-segmented {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 14px;
  background: rgba(236, 241, 247, 0.9);
}

.csdt-segmented button {
  box-shadow: none;
  border-color: transparent;
  background: transparent;
  padding: 8px 12px;
}

.csdt-segmented button.is-active {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(199, 211, 228, 0.92);
  box-shadow: 0 8px 20px rgba(19, 29, 43, 0.08);
}

.csdt-empty-state {
  margin: auto;
  max-width: 520px;
  padding: 28px 30px;
  border-radius: 24px;
  border: 1px solid rgba(214, 223, 236, 0.94);
  background: rgba(255, 255, 255, 0.9);
  text-align: center;
}

.csdt-sidepanel,
.csdt-issues-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(214, 224, 236, 0.92);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 253, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
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
  gap: 6px;
}

.csdt-sidepanel__actions {
  display: flex;
  gap: 8px;
}

.csdt-sidepanel__field-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.csdt-sidepanel__field,
.csdt-preview-row,
.csdt-issue-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 11px 12px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.9);
}

.csdt-sidepanel__field.is-focused {
  outline: 2px solid rgba(89, 125, 199, 0.28);
}

.csdt-issue-row {
  align-items: flex-start;
}

.csdt-issue-row.is-warning {
  border-left: 3px solid #d97706;
}

.csdt-issue-row.is-error {
  border-left: 3px solid #dc2626;
}

.csdt-issue-row small {
  display: block;
  margin-top: 3px;
  color: #728199;
}

.csdt-node {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: ${DEVTOOLS_NODE_WIDTH}px;
  padding: 16px;
  border-radius: 24px;
  border: 1px solid rgba(211, 221, 234, 0.96);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 252, 0.98));
  box-shadow:
    0 20px 48px rgba(18, 28, 45, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.csdt-node.is-materialized {
  background:
    radial-gradient(circle at top right, rgba(244, 215, 170, 0.36), transparent 36%),
    linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(250, 246, 238, 0.98));
}

.csdt-node.is-selected {
  border-color: rgba(87, 120, 191, 0.82);
  box-shadow:
    0 26px 56px rgba(36, 55, 99, 0.16),
    0 0 0 3px rgba(113, 146, 216, 0.18);
}

.csdt-node.is-focused {
  transform: translateY(-2px);
}

.csdt-node.is-dimmed {
  opacity: 0.42;
}

.csdt-node__hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.csdt-node__hero h3 {
  margin: 0;
  font-size: 1.12rem;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.csdt-node__hero p,
.csdt-data-viewer__header p,
.csdt-data-viewer__header h2 {
  margin: 0;
}

.csdt-node__meta,
.csdt-node__stats,
.csdt-node__attributes,
.csdt-data-viewer__controls,
.csdt-data-viewer__pagination,
.csdt-data-viewer__context,
.csdt-pagination__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.csdt-node__type,
.csdt-node__issue-count,
.csdt-context-pill,
.csdt-filter-pill,
.csdt-attribute-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.csdt-node__type,
.csdt-context-pill {
  background: rgba(229, 236, 248, 0.96);
  color: #36507d;
}

.csdt-node__issue-count {
  background: rgba(255, 241, 222, 0.96);
  color: #b45309;
}

.csdt-filter-pill,
.csdt-attribute-chip {
  background: rgba(238, 242, 247, 0.96);
  color: #58677b;
}

.csdt-node__stats > div {
  flex: 1 1 0;
  min-width: 84px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(243, 247, 251, 0.94);
}

.csdt-node__stats strong {
  display: block;
  font-size: 0.94rem;
}

.csdt-node__stats span {
  color: #708097;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.csdt-node__fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.csdt-field {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid rgba(222, 230, 240, 0.98);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  text-align: left;
  font: inherit;
  color: inherit;
}

.csdt-field.is-field-focused {
  border-color: rgba(93, 129, 203, 0.62);
  box-shadow: 0 0 0 3px rgba(113, 146, 216, 0.12);
}

.csdt-field__main {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.csdt-field__main small {
  color: #738197;
}

.csdt-field__badges {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.csdt-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(238, 243, 248, 0.98);
  color: #516073;
  font-size: 0.72rem;
  font-weight: 700;
}

.csdt-node__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.csdt-node__footer button {
  flex: 1 1 100px;
}

.csdt-handle {
  width: 10px !important;
  height: 10px !important;
  border-radius: 999px;
  background: #5879ba !important;
  opacity: 0.88;
}

.csdt-edge {
  stroke: #7d8da4;
  stroke-width: 2.1;
}

.csdt-edge.is-relationship {
  stroke: #5f7cb0;
}

.csdt-edge.is-association {
  stroke: #cf7e2c;
}

.csdt-edge.is-materialization {
  stroke: #7c8c63;
  stroke-dasharray: 8 6;
}

.csdt-edge.is-inferred {
  stroke-dasharray: 8 8;
}

.csdt-edge.is-dimmed {
  opacity: 0.22;
}

.csdt-edge-label {
  position: absolute;
  padding: 6px 10px;
  border: 1px solid rgba(211, 221, 236, 0.96);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #42516a;
  font: inherit;
  font-size: 0.75rem;
  box-shadow: 0 8px 18px rgba(20, 30, 47, 0.12);
}

.csdt-edge-label.is-selected {
  color: #1d2a40;
  border-color: rgba(92, 128, 199, 0.5);
}

.csdt-marker-stroke {
  fill: none;
  stroke: #64748b;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.csdt-marker-fill {
  fill: #77875d;
  opacity: 0.92;
}

.csdt-data-viewer {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
}

.csdt-data-viewer__panel {
  position: absolute;
  inset: 8vh 5vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 28px;
  border: 1px solid rgba(214, 224, 236, 0.92);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 253, 0.98));
  box-shadow: 0 44px 120px rgba(15, 23, 42, 0.24);
  overflow: hidden;
}

.csdt-data-viewer__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.csdt-data-viewer__inspect,
.csdt-data-viewer__explore {
  min-height: 0;
  flex: 1;
}

.csdt-json-viewer,
.csdt-grid {
  flex: 1;
  min-height: 0;
  border-radius: 20px;
  border: 1px solid rgba(215, 223, 235, 0.95);
  background: rgba(251, 252, 254, 0.98);
}

.csdt-json-viewer {
  margin: 0;
  padding: 18px;
  overflow: auto;
  font-family: "SFMono-Regular", ui-monospace, monospace;
  font-size: 0.85rem;
}

.csdt-grid {
  position: relative;
  overflow: auto;
}

.csdt-grid__table {
  position: relative;
  min-width: 100%;
}

.csdt-grid__row {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  min-height: 44px;
  border-bottom: 1px solid rgba(231, 236, 243, 0.95);
}

.csdt-grid__row--header {
  position: sticky;
  top: 0;
  z-index: 2;
  transform: none !important;
  background: rgba(245, 248, 251, 0.98);
}

.csdt-grid__cell {
  padding: 11px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csdt-grid__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.csdt-grid__header small {
  color: #728198;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.csdt-markers {
  position: absolute;
}

@media (max-width: 1080px) {
  .csdt-shell__workspace {
    inset: 1.6vh 1.4vw;
    padding: 14px;
  }

  .csdt-workspace {
    grid-template-columns: 1fr;
  }

  .csdt-sidepanel,
  .csdt-issues-drawer {
    max-height: 280px;
  }

  .csdt-data-viewer__panel {
    inset: 3vh 2vw;
  }
}
`
