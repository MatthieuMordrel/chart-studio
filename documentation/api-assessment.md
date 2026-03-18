# API Assessment

This note records a strict assessment of the package API as it exists in the
repository today.

It focuses on four areas:

- API quality
- ergonomics
- type safety
- composability

It separates three things on purpose:

- **evidence**: what is visible in the code and docs
- **judgment**: the assessment drawn from that evidence
- **recommendation**: advice I am confident enough to stand behind

If I do not have enough confidence in a recommendation, I say so and refrain.

## Scope And Verification

This assessment is based on the public package surface and the consumer-facing
authoring paths:

- root exports in `src/index.ts`
- public core exports and options
- README guidance
- compile-time typecheck fixtures
- the UI context boundary
- runtime validation behavior in the dataset/model/chart hooks

What I verified:

- `bun run typecheck` passes
- the type-level API contract is enforced through dedicated `.typecheck.ts`
  fixtures

What I did **not** verify confidently:

- a clean runtime `vitest` pass in this environment

I attempted `bun run test`, but I could not get a stable result in this WSL
environment before the Vitest/esbuild startup process stalled under timeout.
Because of that, the recommendations below are grounded in static inspection,
documented contracts, and passing typechecks, not in a clean local runtime test
run.

## Summary Scores

| Area | Score | Short view |
| --- | ---: | --- |
| API quality | 7/10 | Strong core contract, but too much public surface |
| Ergonomics | 6/10 | Simple path is good, advanced path gets heavy quickly |
| Type safety | 8.5/10 | Core hook and builder typing are excellent |
| Composability | 8/10 | Real composability, but not lightweight composability |

## 1. API Quality

### Evidence

- The package has a clear primary adoption ladder:
  `useChart({ data })`, `useChart({ data, schema })`,
  `defineDataset<Row>().chart(...)`, then model/dashboard APIs.
- The root entrypoint exports a very large surface:
  21 values and 120 types from `src/index.ts`.
- The README is 785 lines long, and a meaningful portion of it is spent
  explaining where each API boundary begins and ends.
- The package is explicit that source switching is not the same thing as
  dashboard composition, which is a good sign of deliberate API boundaries.

Relevant sources:

- `src/index.ts`
- `src/core/use-chart-options.ts`
- `README.md`

### Judgment

The package has a real API design, not an accidental collection of helpers.
That is the good part.

The problem is breadth. The core idea is reasonably crisp, but the public
surface is large enough that discoverability becomes part of the API problem.
The advanced capabilities appear legitimate, but they compete with the simple
path for attention.

So the API quality is above average, but it is not tight.

### Recommendation

**Recommendation 1: keep the layered architecture.**  
Confidence: high.

I do **not** recommend collapsing the current layers into one flatter API.
The distinction between:

- single-chart authoring
- source switching
- model-aware lookup charts
- materialized views
- dashboard composition

is real and defensible in the current code and docs. The issue is not obvious
architectural duplication. The issue is how much of that surface is presented
at once.

**Recommendation 2: reduce cognitive load through curation before changing the API itself.**  
Confidence: high.

The sound first move is documentation and entrypoint guidance, not breaking API
changes. Specifically:

- define a small canonical "start here" surface
- mark advanced types and builders as advanced in docs
- add a short decision table that routes users to one path quickly

This is a stronger recommendation than removing exports, because I do not have
enough evidence about downstream consumers to recommend pruning the public type
surface yet.

**Recommendation 3: refrain from pruning specific exports without usage evidence.**  
Confidence: high.

I am not confident enough to recommend removing named exports or types from the
root package today. The surface is too large, but "large" alone is not enough
to justify a breaking contraction.

## 2. Ergonomics

### Evidence

- The smallest chart path is good:
  `useChart({ data })` plus optional UI components.
- The package documents a stable single-chart contract clearly.
- The advanced path introduces several concepts quickly:
  dataset, model, inference, materialization, dashboard, shared filters.
- Even the headless example needs DOM string casts to satisfy setter types.
- Runtime setters for invalid inputs mostly fail silently by returning early
  rather than throwing or warning.

Relevant sources:

- `README.md`
- `examples/playground/src/charts/HeadlessChart.tsx`
- `src/core/use-chart.ts`

### Judgment

The package is ergonomic for the first step and noticeably less ergonomic after
that.

That is not because the API is sloppy. It is because the package is trying to
cover both a small single-chart use case and a model-aware dashboard use case
with one brand and one package surface. The advanced API is disciplined, but it
is not light.

The silent no-op setter behavior is the clearest ergonomic weakness in the core
hook contract. It avoids crashes, but it makes invalid external state harder to
detect.

### Recommendation

**Recommendation 1: keep the zero-config and single-schema path as the primary public story.**  
Confidence: high.

This is already the best part of the package. It should stay visibly primary in
docs and examples.

**Recommendation 2: document invalid setter behavior explicitly, and consider an opt-in dev warning mode.**  
Confidence: high for documentation, medium for the warning mode.

I am confident that silent no-ops are easy to miss in real apps, especially
when chart state is driven by URL params, form values, or stored preferences.
At minimum, the behavior should be documented clearly.

An opt-in warning or strict development mode is a sound improvement target.
I am **not** confident enough to recommend changing these setters to throw by
default, because that would be a behavior change with migration risk.

**Recommendation 3: add one example dedicated to URL/query-string or form-driven state.**  
Confidence: medium.

The existing headless example shows the friction: consumer code needs casts at
the DOM boundary. A focused example would help consumers bridge from untyped UI
values to typed chart setters correctly. I am reasonably confident this would
improve ergonomics without changing the API.

## 3. Type Safety

### Evidence

- The package uses dedicated compile-time fixtures to prove the public contract:
  invalid columns, invalid metrics, excluded fields, invalid defaults, and
  dashboard-owned filters all fail at compile time.
- Dataset and model validation also exist at runtime for key uniqueness,
  missing keys, and orphan relationships.
- The strongest type safety exists at the builder and hook boundary.
- The UI context broadens back to `AnyChartInstance`, with several `any`-based
  setters.
- `useTypedChartContext` exists as a typed escape hatch, but only for
  single-source charts.

Relevant sources:

- `src/core/use-chart.typecheck.ts`
- `src/core/dashboard.typecheck.ts`
- `src/core/define-dataset.ts`
- `src/core/define-data-model.ts`
- `src/ui/chart-context.tsx`

### Judgment

Type safety is a real strength of this package.

The public hook and builder contracts are unusually serious for a charting API.
They do not just type obvious happy paths; they encode ownership rules,
restriction narrowing, and invalid configuration states.

The main weakness is that the UI boundary partially gives that precision back.
So the package is best described as "type-safe at the headless API boundary,
less type-safe through the generic UI context layer."

### Recommendation

**Recommendation 1: preserve the current builder and hook type discipline.**  
Confidence: high.

This is one of the package's strongest differentiators. It should be treated as
part of the product, not as internal cleverness.

**Recommendation 2: if type-safety work continues, focus on the UI boundary next.**  
Confidence: high.

The biggest remaining gap is not in `defineDataset` or `useChart` itself. It is
in the handoff into the shared UI context, where types broaden to generic
runtime shapes. That is the most credible next place to improve.

**Recommendation 3: do not chase a fully generic multi-source typed UI context unless there is a concrete consumer need.**  
Confidence: medium.

I am not confident enough to recommend a full redesign here. The current
limitation is understandable: React context plus source-switching makes precise
typing awkward. A narrower goal, such as improving typed single-source UI
composition further, is more defensible than promising full typed multi-source
context propagation.

## 4. Composability

### Evidence

- The package separates source switching from dashboard composition.
- The model/chart/materialization/dashboard layers each have distinct semantic
  roles in the README and in the type system.
- Dashboard typing removes shared-filter-owned local controls from the chart
  contract, which is a good sign that composition rules are not superficial.
- Multi-source typing works, but consumers recover full precision by narrowing
  on `activeSourceId`.

Relevant sources:

- `README.md`
- `src/core/types.ts`
- `src/core/use-chart-multi-source.typecheck.ts`
- `src/core/dashboard.typecheck.ts`

### Judgment

The package is genuinely composable.

It does not fake composability by pushing everything through one giant generic
object. It has separate primitives for separate data and ownership problems.

The trade-off is that this is not effortless composability. It is a system with
several layers, and the user has to understand which layer they are in.

### Recommendation

**Recommendation 1: keep the current conceptual separation between single charts, source switching, model charts, materialized views, and dashboards.**  
Confidence: high.

I do not see evidence that these concepts should be merged. They solve
different composition problems, and the type tests support that distinction.

**Recommendation 2: improve path selection, not primitive count.**  
Confidence: high.

The sound improvement is better routing guidance:

- "if you need one flat chart, use this"
- "if you need source switching, use this"
- "if you need related datasets and shared filters, use this"
- "if the grain changes, materialize"

That is a documentation and onboarding recommendation, not a rewrite.

**Recommendation 3: refrain from recommending that `model.chart(...)` and `materialize(...)` be merged.**  
Confidence: high.

The current docs make a meaningful distinction:

- `model.chart(...)` for lookup-preserving charts
- `materialize(...)` when the chart grain changes

That split appears sound from the available evidence. I do not have enough
confidence to recommend collapsing it.

## Recommended Next Moves

These are the changes I am confident would improve the package without guessing
at unverified consumer needs:

1. Add a short "API decision guide" document or README section that routes users
   to the correct layer in under a minute.
2. Document the invalid-setter no-op behavior explicitly, and consider an
   opt-in development warning mode.
3. Treat the hook/builder type contract as a feature and keep the compile-time
   fixtures in place.
4. If type improvements continue, target the UI boundary before adding more
   advanced type machinery in the core.

## Recommendations I Am Deliberately Not Making

I do **not** currently have enough confidence to recommend any of the following:

- removing specific exported types or values from the root package
- flattening the model/dashboard/materialization APIs into one layer
- changing invalid setters to throw by default
- redesigning multi-source typed UI context around more complex React generic
  machinery

Those may become good ideas later, but the evidence I inspected is not strong
enough to justify them yet.
