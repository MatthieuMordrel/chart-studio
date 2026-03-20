# Chart Studio Devtools PRD

Status: proposed final target

## Summary

Chart Studio Devtools should ship as a dev-only, canvas-first modeling workspace for the live runtime model already constructed by Chart Studio inside an app.

The product should feel closer to a premium semantic-modeling surface than to a generic debug drawer:

- beautiful default layout
- obvious keys and join paths
- direct visibility into relationships, associations, inferred links, attributes, and materialized views
- first-class dataset inspection from the graph itself
- strong support for the data model first, with chart exploration available as a secondary mode

The devtools should open from a floating launcher into a near-fullscreen overlay, stay live with the running app, and let a developer move seamlessly between:

- understanding the model
- inspecting dataset or materialized-view rows
- comparing raw versus effective dataset slices
- debugging inferred links, many-to-many associations, and generated views

## Product Goal

Build the final intended devtools experience directly, not a temporary low-fidelity shell.

The default experience should be the experience teams use 99% of the time:

- clean automatic layout
- beautiful light visual design
- clear field-level relationships
- immediate understanding of the live model after code changes or HMR

## Problem

Chart Studio now has enough model semantics that understanding a running app by reading source alone is too expensive:

- relationships may be explicit or inferred
- associations may be explicit edge rows or derived from embedded values
- attributes add shared filter semantics on top of structural links
- materialized views create new flat grains that charts can execute against

Today, developers must reconstruct these semantics manually from source and runtime behavior.

The devtools should make the live semantic model visually obvious and pleasant to inspect.

## Runtime Truths This PRD Must Respect

This PRD is intentionally aligned to the current Chart Studio runtime, not to a hypothetical BI engine.

### Dataset

A dataset is one chartable flat row array with declared keys and columns.

### Relationship

A relationship is a direct `1:N` key-to-foreign-key link.

Relationships may be:

- explicit
- inferred at runtime when Chart Studio can safely infer them

### Association

An association is a direct semantic `N:N` link between two datasets.

An association is not itself a chartable dataset or a materialized table.

Associations may be backed by:

- explicit edge rows
- derived edge values from existing dataset rows

Chart Studio does not invent many-to-many mappings when no real mapping exists in the source data.

### Materialized View

A materialized view is the actual derived flat table-like output created from `materialize(...)`.

This is the thing that creates a new chartable row shape and declared grain.

### Attribute

An attribute is a shared filter semantic, not a structural join.

## Goals

- Make the live runtime data model understandable at a glance.
- Show datasets and materialized views as first-class nodes.
- Make primary keys, foreign-key paths, and association paths obvious.
- Distinguish explicit versus inferred relationships without clutter.
- Make association semantics inspectable without pretending they are physical tables.
- Let developers inspect raw and effective rows quickly from the graph.
- Reuse existing Chart Studio schema and formatting metadata wherever possible.
- Keep setup close to one line in development.
- Keep devtools out of production bundles.

## Non-Goals

- Parsing TypeScript source files or analyzing the project on disk.
- Inventing many-to-many bridges when the source data does not contain one.
- Shipping a separate sidecar application as the primary integration path.
- Persisting custom graph layouts across sessions in v1.
- Forcing raw dataset inspection through the existing chart aggregation pipeline.
- Making chart debugging equal in scope to model/data debugging for the first release.

## Primary Users

- Library authors working on Chart Studio itself
- App developers integrating Chart Studio into a product
- Reviewers validating AI-generated or rapidly changing model code
- Engineers debugging why a chart or dashboard behaves differently after a model change

## Jobs To Be Done

- "Show me what model exists right now, without reading source."
- "Show me which links are inferred versus declared."
- "Show me how two datasets connect, including `N:N` semantics."
- "Show me the real generated materialized tables my charts are using."
- "Let me inspect rows and JSON quickly from the model graph."
- "Let me understand what 'effective' means under the currently selected chart or dashboard context."

## UX Principles

- Canvas first, drawer second.
- Beauty matters; this should feel like a premium analytics tool, not a utility panel.
- The graph is the source of truth for model understanding.
- Dense information should stay available, but mostly on hover, selection, and expansion.
- Raw inspection and analytical exploration are different modes and should not be conflated.
- The canonical automatic layout is the default product experience.

## Experience Overview

### Entry

- Devtools open from a small floating launcher.
- Clicking the launcher opens a near-fullscreen overlay workspace.
- The running app remains visible underneath the overlay.

### Visual Direction

- Premium analytics light theme
- bright but not sterile
- warm neutral surfaces
- crisp cards
- subtle depth and glass where useful
- restrained motion
- high legibility over novelty

### Live Behavior

- Devtools are live by default.
- Model, data, issues, and active context update automatically with HMR and runtime changes.
- A pause toggle freezes the current snapshot for inspection.

## Main Workspace

### Header

The workspace header should contain:

- active chart or dashboard context selector
- global search
- pause or resume updates
- reset layout
- issues summary
- close action

### Navigation

- Search must match dataset ids, materialized view ids, relationship ids, association ids, attribute ids, and column ids.
- Selecting a search result pans and zooms to the target.
- Search focus should temporarily emphasize the node and its immediate connections.

## Graph Model

### Core Rule

The default graph is semantic-first and truthful to the runtime model.

### Nodes

The graph includes:

- dataset nodes
- materialized-view nodes

Materialized views are mixed into the main graph, not isolated in a separate lane.

They should behave like normal table-like nodes from the graph point of view, while still being visually marked as generated by Chart Studio.

### Edges

The graph includes:

- relationship edges
- association edges
- materialization lineage edges

Edges should connect at the field level, not only node-to-node.

### Cardinality

- Use crow's-foot-style endpoint notation.
- Use subtle badges or endpoint markers for quick scanning.
- Keep the always-visible labels minimal.

### Relationship Semantics

- Explicit and inferred relationships are both shown by default.
- Inferred links must be visually distinct but subtle.
- The main graph should communicate the distinction with color, stroke, and iconography rather than long edge labels.
- Hover must state clearly whether a relationship is explicit or inferred.

### Association Semantics

- Associations stay as direct `N:N` edges in the default graph.
- The main graph should not pretend that an association is automatically a real bridge table.
- Selecting or hovering an association should reveal enough detail to understand whether it is backed by explicit edge rows or derived edge values.
- Selecting an association edge should expand a temporary association node or edge-inspector surface that exposes:
  - association id
  - from and to datasets
  - backing mode: explicit or derived
  - explicit edge columns or derived source dataset
  - generated edge-pair preview
  - raw edge JSON when available

### Materialization Semantics

- Materialized views are first-class nodes.
- They use the same node affordances as datasets.
- They must be visually marked as generated or materialized.
- Their connections may use relationship-like geometry and field anchors, but hover and styling must make clear that these links describe materialized lineage, not newly declared semantic-model relationships.

### Attributes

- Attributes appear as subtle badges on relevant dataset nodes.
- Hover or selection reveals source, label column, targets, and path semantics.
- Attributes should not dominate the graph.

### Issues

- Affected nodes and edges show inline issue badges.
- The workspace also provides an issues drawer with jump-to-focus.
- Issue severity should distinguish warnings from blocking errors.

## Node Design

### Default State

Nodes are schema-first by default.

They do not render inline sample rows.

Each node should show:

- dataset or materialized-view name
- type badge
- row count
- estimated payload size
- collapsed schema summary

### Column Ordering

Columns inside a node follow this rule:

1. primary key columns first
2. foreign-key and association-relevant fields next
3. remaining columns in declared `.columns(...)` order

### Column Visibility

- Show roughly 7 to 8 rows by default.
- Collapse the remainder behind an obvious expand control.
- Expanded mode should make it easy to see every column quickly.

### Column Metadata

Each visible column row should support:

- primary-key badge
- foreign-key or association-linked badge where meaningful
- derived-column badge
- formatting or display metadata on hover or click

Formatting detail should expose the information already carried by the dataset schema:

- format preset or formatter presence
- date or number formatting hints
- derived versus direct value

### Relationship Anchors

Edges must anchor to the actual column row when possible, for example:

- `owners.id -> jobs.ownerId`
- materialized field lineage anchored to the projected field or source field

## Data Inspection

### Entry Point

Nodes do not embed row previews.

Instead, they expose a data-inspection action that opens a large viewer from the node.

### Large Viewer Shell

- near-fullscreen modal overlay
- canvas remains visible underneath
- easy back-and-forth between graph and inspector

### Viewer presentation

The large viewer uses **one** segmented control for how data is shown:

- **`Table`** — paginated virtualized grid of rows (truthful inspection: raw/effective columns as modeled).
- **`Explore`** — Chart Studio chart UI (table chart by default, plus bar/line/etc. when applicable): filters, metrics, grouping, time bucket, etc.
- **`JSON`** — JSON for the **current page** of rows (same pagination as Table).

A separate **`Raw` / `Effective`** toggle applies to the row set for all three (default `Raw`; `Effective` requires an active dashboard context).

Graph node actions still offer quick entry as **Table** and **Explore** (same modes as in the viewer).

## Why Table and Explore differ

The Chart Studio `table` **chart** is a chart-table: it shows transformed pipeline output, not the same thing as the dedicated inspection grid.

Therefore:

- **`Table`** uses a dedicated data-grid implementation for row-accurate inspection.
- **`Explore`** reuses the existing chart implementation for analytical views.

## Active Context Model

`Effective` always depends on an explicit active context selected in the workspace header.

The selected context may represent:

- a chart
- a dashboard

The active context should drive:

- effective row inspection
- highlighted materialized views
- chart-exploration defaults where helpful

## Layout Behavior

### Default Layout

- Layout quality is a first-class product requirement.
- The default auto-layout should be the intended primary experience.
- The graph should be readable without manual cleanup in the common case.

### Manual Adjustment

- Users can drag nodes during the session.
- A clear `Reset layout` action returns to the canonical layout.
- Manual adjustments are temporary.
- Fresh open or reload returns to the default layout.

## Hover And Selection Model

Hover is the primary place for dense detail.

The main graph should stay clean while hover or selection reveals:

- explicit versus inferred relationship status
- join fields
- association backing mode
- materialized lineage details
- attribute targets
- derived-column information
- formatting metadata
- issue explanations

## Technical Approach

### Integration Model

Ship a dev-only React package, for example:

`@chart-studio/devtools`

Primary integration:

- in-process
- development only
- rendered inside the app

The default goal is a one-line dev-only mount when provider context is available.

Fallback integration is an explicit snapshot function.

### Recommended Host API

```tsx
import {ChartStudioDevtools} from '@chart-studio/devtools/react'

<ChartStudioDevtools />
```

Fallback:

```tsx
import {ChartStudioDevtools} from '@chart-studio/devtools/react'

<ChartStudioDevtools
  getSnapshot={() => ({
    model,
    data,
    materializedViews,
    contexts,
    issues,
  })}
/>
```

### Snapshot Shape

Recommended conceptual snapshot contract:

```ts
type ChartStudioDevtoolsSnapshot = {
  model: DefinedDataModel<any, any, any, any>
  data: Record<string, readonly Record<string, unknown>[]>
  materializedViews?: Record<string, MaterializedViewDefinition<any, any, any, any>>
  contexts?: readonly DevtoolsContextSnapshot[]
  issues?: readonly DevtoolsIssue[]
}

type DevtoolsContextSnapshot = {
  id: string
  label: string
  kind: 'chart' | 'dashboard'
  effectiveDatasets?: Record<string, readonly Record<string, unknown>[]>
  effectiveMaterializedViews?: Record<string, readonly Record<string, unknown>[]>
}

type DevtoolsIssue = {
  id: string
  severity: 'warning' | 'error'
  scope: 'dataset' | 'relationship' | 'association' | 'materialized-view' | 'context'
  targetId: string
  message: string
}
```

### Data Flow

1. Read the live snapshot from provider or `getSnapshot()`.
2. Normalize runtime model objects into a graph-oriented view model.
3. Build node and edge metadata for datasets, materialized views, relationships, associations, attributes, and issues.
4. Compute the canonical layout.
5. Render the graph.
6. Open the data viewer from a node (`Table` or `Explore` shortcuts) or edge selection.

### Live Sync

Preferred approach:

- subscribe to provider-owned state when Chart Studio exposes a stable store
- use `useSyncExternalStore` where possible

Fallback:

- short dev-only polling of `getSnapshot()` when no subscription is available

### Graph Normalization Layer

Introduce a normalization layer inside devtools that converts runtime objects into a stable UI model:

- `DatasetNodeVm`
- `MaterializedViewNodeVm`
- `RelationshipEdgeVm`
- `AssociationEdgeVm`
- `MaterializationEdgeVm`
- `AttributeBadgeVm`
- `IssueVm`

This layer should also:

- preserve `.columns(...)` order
- mark primary and foreign keys
- distinguish explicit versus inferred relationships
- summarize function-backed fields such as derived association accessors
- compute counts and estimated sizes lazily

### Why Associations Need A Special UI Treatment

Associations are direct `N:N` links in the semantic model.

They should remain direct edges in the main graph.

However, developers still need to inspect their backing mapping. The temporary association expansion is therefore a UI affordance, not a claim that Chart Studio created a real bridge dataset.

### Why Materialized Views Need Their Own Nodes

Materialized views are real derived table-like outputs:

- they have a row shape
- they have a declared grain
- they can be charted directly

Therefore they must appear as full nodes in the main graph.

## Technology Recommendation

### Core UI Stack

- React 19
- TypeScript
- Bun workspace package
- `@xyflow/react` for the graph canvas
- `elkjs` for automatic layered layout
- `@tanstack/react-table` for viewer `Table` mode
- `@tanstack/react-virtual` for row virtualization in `Table` mode

### Why `@xyflow/react`

This product needs rich custom nodes, field-level anchors, temporary association expansion, drag interaction, pan and zoom, and graph overlays. `@xyflow/react` is the best fit for that combination in a React-first codebase.

### Why `elkjs`

The default layout quality is critical. `elkjs` provides stronger automatic graph layout for table-style model surfaces than ad hoc force layouts.

### Why TanStack Table only for the Table viewer mode

TanStack Table is a good fit for:

- raw and effective row inspection
- pagination
- virtualization support
- column visibility and sorting

It should not replace the existing chart stack for analytical exploration.

### Reuse Of Existing Chart Studio UI

Viewer **`Explore`** reuses the existing Chart Studio UI package:

- `Chart`
- `ChartToolbar`
- `ChartCanvas`

This gives immediate reuse of:

- filters
- grouping
- time buckets
- metric controls
- table-chart rendering

The **`Table`** mode should not depend on this chart pipeline because raw inspection is not the same as chart transformation.

## Reuse Of Existing Schema Metadata

The devtools should reuse user-authored dataset metadata wherever possible:

- column labels
- column types
- declared order
- derived-column definitions
- formatting presets and formatter hints

This avoids duplicating semantics and ensures the devtools reflect the same model contract the app uses.

## Visual Language

### Datasets

- solid table-like cards
- primary-key and foreign-key emphasis
- subtle row separators

### Materialized Views

- same structural language as datasets
- clearly marked as generated or materialized
- distinct accent treatment

### Relationships

- crisp relational edge treatment
- explicit or inferred distinction by style and iconography

### Associations

- direct `N:N` treatment
- clear endpoint cardinality
- distinct accent family from `1:N`

### Issues

- warnings should be visible but not alarming
- errors should be impossible to miss

## Performance Notes

This tool is not primarily optimized for massive remote datasets.

The expected model is:

- the app already holds the relevant arrays in memory
- devtools read them by reference
- pagination and virtualization are mainly about rendering cost, not memory reduction

That is acceptable for the intended usage.

## Risks

- Field-level edge anchoring can become visually busy on dense schemas.
- Derived association accessors are runtime functions and cannot always be serialized into friendly source text.
- Materialized lineage can be misunderstood as a semantic relationship if styling is too subtle.
- Default layout quality must be good enough to justify making it the canonical session entry point.

## Acceptance Criteria

- Devtools mount in development with a dev-only in-process package.
- The main workspace opens from a floating launcher into a near-fullscreen overlay.
- The graph shows datasets and materialized views as first-class nodes.
- Relationships use field-level anchors and crow's-foot cardinality.
- Associations appear as direct `N:N` edges and can expand into a temporary inspector surface.
- Inferred relationships are visible by default and subtly distinct from explicit ones.
- Materialized views are visible by default and clearly marked as generated.
- Nodes show row count, estimated size, and schema with key-first ordering.
- Nodes default to schema view only and do not render inline row previews.
- Large data viewer opens from the node and supports:
  - `Table` / `Explore` / `JSON` (single presentation control)
  - `Raw` / `Effective`
- Global search can focus datasets, materialized views, relationships, associations, and columns.
- Issues appear inline and in a jumpable issues drawer.
- Live updates are enabled by default and can be paused.
- Reset layout restores the canonical layout.
- Manual node dragging does not persist across sessions.
- Production-bundle leakage is documented and avoidable by dev-only mounting.

## Recommended Build Order

1. Create the devtools package and snapshot store.
2. Implement model normalization and issue normalization.
3. Implement dataset and materialized-view nodes with field rows and badges.
4. Implement relationship and association edges with field anchors and crow's-foot endpoints.
5. Integrate `elkjs` default layout and reset behavior.
6. Implement the large viewer: `Table` (TanStack Table + virtual rows), `JSON` (paged), and `Explore` (chart stack).
7. Wire graph shortcuts: node **Table** / **Explore** → matching viewer mode.
8. Add active-context selection and effective-row handling.
9. Add search, issue drawer, pause, and final visual polish.

## Final Recommendation

Build Chart Studio Devtools as a dev-only, in-process, canvas-first semantic-model workspace backed by the live runtime model.

Use:

- `@xyflow/react` for the graph
- `elkjs` for the default layout
- TanStack Table for raw and effective inspection
- the existing Chart Studio chart stack for analytical exploration

Keep the product centered on model and data understanding first. Chart debugging should support that goal, not compete with it.
