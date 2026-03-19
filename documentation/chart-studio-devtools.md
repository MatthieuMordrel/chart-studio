# Chart Studio devtools (planned)

High-level description of what we want to build, what developers should see, and how we recommend wiring it so setup stays trivial.

## Goals

- Make the **data model visible** while implementing charts on real apps (internal tools, marketing sites, etc.).
- Support **debugging** joins, filters, materialization, and chart binding without digging through logs or ad-hoc `console.log` of the model.
- Keep **production bundles clean**: no devtools in shipped code, same spirit as TanStack Query / Router devtools.
- Prefer **runtime introspection** (the `DefinedDataModel` and the data the dashboard already uses)—not parsing TypeScript or following `tsconfig` in a separate process for v1.

## What we want to see

1. **Model graph (or equivalent)**  
   Datasets as nodes; **relationships** and **associations** as edges, with clear labels: which **key** / **column** links to which side. Distinguish **user-declared** vs **inferred** relationships where the runtime exposes that metadata.

2. **Bridge / many-to-many clarity**  
   For associations: show **edge** configuration (explicit bridge rows vs derived), and sample **edge data** when the host passes row payloads.

3. **Data exploration**  
   Per-dataset views: **raw JSON**, **tabular** (e.g. TanStack Table), and optionally **embedded Chart Studio charts** for the same definitions used in the app—so “model + data + chart” stay aligned.

4. **Chart implementation context**  
   Surface enough of the **active chart / materialized view** (ids, grain, steps) so a developer can see *why* a slice of data looks a certain way—not only the raw rows.

## Recommendation

### Default: dev-only package + snapshot API

- Publish something like **`@chart-studio/devtools`** (exact name TBD) that renders a **floating panel** or a **dedicated window** (optional), gated entirely behind **development** imports.
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

## Success criteria

- **Minutes to adopt:** install package, one dev-only line (or one component + optional `getSnapshot`).
- **No production leakage:** tree-shaking / dev-only imports are documented and easy to verify.
- **Ground truth:** everything shown is derived from the live **defined model** and **runtime data**, not from static analysis of source files.
