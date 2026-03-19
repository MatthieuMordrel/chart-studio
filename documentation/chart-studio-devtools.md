# Chart Studio devtools (planned)

High-level plan: what we want to build, how it should feel, what appears in the UI, and how we recommend wiring it so setup stays trivial.

## What we want to do

We want a **pretty, approachable interface** that explains how Chart Studio is being used in an app—not another log viewer or code-shaped dump. The focus is the **data model**: **relationships** between datasets, **bridge / many-to-many** structures that the API creates or carries, **which links were inferred** versus declared, and **keys and foreign-key columns** called out clearly so joins are obvious at a glance.

The point is to make understanding the model and the library’s behavior feel **effortless**, including when **AI-generated code** is changing the project. Authors and reviewers should get **immediate visual feedback** about what the model *is* after each change—datasets, edges, inference, bridges—**without opening and reading source** to reconstruct mental joins. The devtools should update **in step with the running app** (reload, HMR, data refresh) so the UI is the source of “what did we just build?”

**Engineering constraints** (how we ship it, not the product story): dev-only by default—no devtools in production bundles (TanStack-style); v1 reads the **built model at runtime**, not the TypeScript project on disk.

## What we want to see

1. **Model graph (or equivalent)**  
   Datasets as nodes; **relationships** and **associations** as edges, with clear labels: which **key** / **column** links to which side. Distinguish **user-declared** vs **inferred** relationships where the runtime exposes that metadata.

2. **Bridge / many-to-many clarity**  
   For associations: show **edge** configuration (explicit bridge rows vs derived), and sample **edge data** when the host passes row payloads.

3. **Data exploration**  
   Per-dataset views: **raw JSON**, **tabular** (e.g. TanStack Table), and optionally **embedded Chart Studio charts** for the same definitions used in the app—so “model + data + chart” stay aligned.

4. **Chart implementation context**  
   Surface enough of the **active chart / materialized view** (ids, grain, steps) so a developer can see *why* a slice of data looks a certain way—not only the raw rows.

_Note for v1:_ the “graph” can be a **structured list or tree** first; a full canvas layout is not required on day one (see UX section).

## How to show it (UX shell)

### Experience bar (applies to every version)

- **Look and feel:** intentional typography, spacing, and color—**attractive** devtools that teams are happy to leave open, not a utilitarian afterthought.
- **Understandability:** plain-language labels, sensible grouping, and **progressive disclosure** so beginners see the whole picture and experts can drill in.
- **Live model:** wire the UI to the **current** model and data (via context or `getSnapshot` on a **short interval** / **subscription** when the host supports it) so edits in code or data **show up immediately** without manual refresh.

### v1: keep the scope small, not the quality

The first version should limit **surface area** (fewer panels and modes), not **care** in design. Concretely:

- **One shell:** a **fixed-position panel** (e.g. bottom or side) **or** a minimal **floating bar + expandable panel**—no requirement for drag-and-drop, `localStorage` layout persistence, or a second window.
- **Open / close:** a single **toggle** (FAB or header button). Avoid a blocking centered modal as the *only* option; a slide-up / docked panel is enough.
- **Navigation inside:** simple **tabs** (*Model*, *Data*, *Chart*—or fewer if some merge into one screen). **No resizable split panes in v1** unless they come almost for free from a library.
- **Model view:** prefer a **clear list / tree** of datasets, relationships, and associations with readable labels (from → to, key / column). Defer a **full graph canvas** if it is not quick to ship.
- **Data view:** **JSON first** is acceptable for v1; a basic **scrollable** table or object explorer for one dataset at a time is enough. **Virtualization and heavy TanStack Table** polish can follow once the shell proves useful.
- **Room to grow:** use `max-height` + **internal scroll** so a big model does not break the layout; an optional **“Larger”** control that increases height to ~80–90% of the viewport covers most “almost full screen” needs in v1 without fullscreen APIs or pop-out.

That keeps v1 **focused and shippable** while still meeting the experience bar above; richer layout modes come later.

### Later (v2+): richer layout

When the core is useful, add the ergonomics that matter for huge models and dual-monitor workflows:

- **Draggable / resizable** panel, **near full-screen** and optional **browser fullscreen**.
- **Pop-out window** with **`BroadcastChannel` / `postMessage`** so the app stays in one window and devtools in another.
- **Split panes** inside the shell (e.g. model outline | detail), **virtualized** tables, and optional **force-directed or ELK** graph layouts.
- **Persist** size / position / pop-out in `localStorage`; **disconnected** state when the pop-out closes.

## Recommendation

### Default: dev-only package + snapshot API

- Publish something like **`@chart-studio/devtools`** (exact name TBD) with the **v1 UX** above (simple docked / expandable panel + tabs), gated entirely behind **development** imports.
- The host app provides a **snapshot function** (or stable refs) so devtools always read the **same** model and data the charts use—no second source of truth.
- **Do not** rely on parsing project TypeScript for v1; the model is already constructed at runtime when the app runs.

### Setup: as close to one line as possible

Target: a single component (or single `install` call) in **dev-only** bootstrap code, with optional props only when needed.

**Ideal entry shape:**

```tsx
// e.g. main.tsx or dev-only DevProviders.tsx — import only in development
import { ChartStudioDevtools } from '@chart-studio/devtools/react'

// One line in your tree (snapshot wiring can be minimal defaults if you use a Chart Studio provider)
;<ChartStudioDevtools />
```

If the app already wraps Chart Studio in a **dashboard / data provider**, devtools should read from that context so the line stays literally one component with **no props**. If there is no global provider, the developer passes one callback:

**Target API when explicit wiring is required:**

```tsx
import { ChartStudioDevtools } from '@chart-studio/devtools/react'

;<ChartStudioDevtools
  getSnapshot={() => ({
    model: definedModel.build(),
    data: modelData,
    // optional, when debugging a specific chart or view:
    chartId: 'revenueByRegion',
    // optional: last validation error, filter state, etc.
  })}
/>
```

**Production safety** (responsibility of the host app, documented in package README):

- Import devtools only from a file that is loaded with `import.meta.env.DEV` / `process.env.NODE_ENV === 'development'`, or use a **dynamic `import()`** so the devtools package is not in the production bundle.

### Later (optional): sidecar / second port

For teams that do not want *any* devtools import in application source, a **Vite plugin + small local server** (Vitest UI–style) can forward **serialized snapshots** over WebSocket/`postMessage`. That is more moving parts; treat it as phase 2 after the in-process devtools are proven.

## Implementation approach (high level)

Devtools should read the **same built data model** (and row payloads) the app passes into Chart Studio—**no TypeScript analysis**. At a high level: **datasets** give you the “nodes,” **relationships** and **associations** give you the “edges” and bridge semantics; optional runtime metadata distinguishes **inferred** links. The UI maps that structure to lists or a graph. Be mindful that some fields are **functions** or **large arrays**, so remote or serialized views may need **summaries** rather than full dumps.

## Success criteria

- **Minutes to adopt:** install package, one dev-only line (or one component + optional `getSnapshot`).
- **No production leakage:** tree-shaking / dev-only imports are documented and easy to verify.
- **Ground truth:** everything shown is derived from the live **defined model** and **runtime data**, not from static analysis of source files.
- **Pleasant and live:** the interface stays **readable and appealing**, and updates **as the model or data changes** in development.
