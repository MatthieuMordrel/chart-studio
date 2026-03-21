# PRD: Long-term Devtools Model Graph Layout

## Summary

The devtools model graph needs a long-term layout architecture that keeps connected graphs visually concentrated, routes relationships from the correct side of each node, and materially reduces unnecessary crossings, overlaps, and backtracking. The proper solution is to make visible field-level ports first-class in the layout model, let the layout engine compute both node placement and edge routing from those ports, and render those routed sections directly instead of re-routing edges later in React Flow.

This deliberately incorporates the port-aware ELK idea from `documentation/devtools-future-improvements.md`, but keeps scope limited to layout and routing correctness. It does not expand into unrelated graph features or UI redesign.

## Problem statement

The current graph pipeline is split across several responsibilities that do not share the same geometry model:

- ELK places node boxes using node-level edges.
- Field visibility logic decides which rows are visible inside each node.
- A local field-order heuristic tries to reduce some crossings after layout.
- React Flow then computes the final edge path from field handles using generic smooth-step routing.

This split creates structural limitations:

- node placement is not optimized around the actual field attachment points used by visible relationships
- edges can leave or enter from visually awkward sides and take avoidable detours
- dense graphs still accumulate unnecessary crossings and overlapping paths
- correctness depends on fragile coupling between layout, field visibility, and renderer behavior

The result is a graph that is often usable but not reliably compact, not reliably routed from the right attachment points, and harder to extend safely.

## Product goals

- Use canvas space efficiently so connected graph areas feel compact and intentional instead of sparse.
- Route relationships, associations, and materialization links from the correct side of each node and from the correct visible field row.
- Minimize crossings, overlaps, and backtracking as much as reasonably possible within a left-to-right layered graph.
- Preserve reliable existing behavior for relationship visibility, collapsed/expanded column display, materialized-view field reveal, selection, highlighting, and node dragging.
- Establish a layout architecture with clear ownership boundaries so future graph changes do not require cross-cutting heuristics.
- Keep the implementation simple enough to maintain, test, and extend without introducing a second fragile routing system.

## Non-goals

- redesigning the visual styling of the canvas
- adding manual edge editing or arbitrary bend-point editing
- introducing a general-purpose custom graph optimizer beyond what is needed for this graph
- solving every possible crossing in arbitrary graph topologies
- changing product rules for which columns should be visible on collapsed nodes
- broadening scope into search, issues, data viewer, or non-layout devtools features

## User-facing quality expectations

- Auto-layout should keep connected components tight. Large empty bands or isolated-feeling spacing should only appear when required by graph structure, not by default spacing heuristics.
- In the normal left-to-right flow, edges should exit a source node from the right side and enter a target node from the left side. Reverse or same-layer cases may need exceptions, but those routes should still be the shortest reasonable orthogonal path.
- Routed edges should use as few bends as practical and should not visibly backtrack across columns unless the graph topology or a pinned manual position makes that unavoidable.
- Edge paths should avoid running through node bodies and should avoid stacking on top of each other when separate routes are reasonably available.
- Collapsed nodes must continue to show the fields needed to understand visible relationships and key semantics. Layout work must not cause edge endpoints to become hidden or mismatched.
- Expand/collapse and materialized-view reveal behavior must remain predictable. Display-only state changes should not cause unrelated routing or visibility regressions.
- Selecting, hovering, and highlighting a relationship must still visually point to the correct rows and the correct routed edge.

## Proposed long-term solution

### 1. Introduce a single authoritative graph scene model

Add a dedicated intermediate model, for example `CanvasGraphSpec`, that is the only source of truth for layout and rendering inputs. It should contain:

- visible nodes with deterministic ids, sizes, and pinned/manual position metadata
- visible field rows in display order
- explicit ports derived from those rows
- visible edges that reference source and target port ids, not just node ids
- layout metadata such as edge kind, preferred flow direction, and grouping hints

This scene model should be produced after visibility decisions are made, not during rendering.

### 2. Make ports first-class and stable

Every visible edge endpoint must attach to a concrete visible port. Port ids must be stable and derived from the existing field ids so that expand/collapse, selection, and hover behavior remain deterministic.

Key rules:

- field visibility and field order remain a dedicated concern outside the layout engine
- layout consumes the chosen visible rows and ports; it does not decide which product-visible columns exist
- any graph-specific row reordering must be deterministic, narrow in scope, and optional for correctness

This allows column display behavior to stay reliable while making layout aware of the geometry it actually needs to optimize.

### 3. Use port-aware ELK for both placement and routing

The layout compiler should export the scene model to ELK with:

- field-level ports
- stable port order
- side constraints that encode the expected left/right attachment behavior
- current node dimensions based on the same visible rows that the node renderer uses
- edge definitions that reference ports, not node centers

ELK should then be the authoritative source for:

- node positions
- port positions
- routed edge sections and bend points

The renderer should draw ELK's routed sections directly. React Flow should no longer invent the final path for auto-laid-out edges.

### 4. Keep rendering and routing separate from product visibility logic

The React Flow layer should become a thin interaction/rendering shell:

- nodes render from the scene model and layout result
- edges render from routed sections produced by the layout result
- selection, hover, markers, labels, and hit targets remain renderer concerns
- relationship visibility, collapsed-column rules, and materialized-view reveal stay outside the renderer

This removes the current coupling where renderer-side pathing implicitly compensates for layout gaps.

### 5. Preserve manual drag behavior without reintroducing routing heuristics

Manual node movement must remain supported. The system should treat dragged positions as pinned overrides and reroute affected edges against those fixed positions on drag stop.

The preferred approach is:

- keep automatic layout and interactive rerouting in the same pipeline
- rerun routing with pinned node positions instead of handing the problem back to generic smooth-step rendering
- avoid moving unrelated nodes when only one node is manually repositioned

If ELK cannot reroute reliably against pinned positions without unexpected graph shifts, a small contained reroute step for pinned updates is acceptable, but only as a compatibility path for drag updates, not as the main routing system.

### 6. Retire heuristics that are no longer structurally necessary

Once ports and routed sections are authoritative, existing compensating heuristics should be reviewed and either narrowed or removed:

- smooth-step offset bundling should not remain the main overlap strategy
- field reordering should not be required for correctness
- spacing inflation should be used only for readability tuning, not to hide routing weaknesses

The long-term codebase should have one primary layout/routing path, not a layered stack of partial fixes.

## Recommended implementation order

1. Introduce the scene-model layer and fixture-based metrics without changing user-visible behavior yet.
2. Add the port-aware ELK compiler, routed edge result type, and renderer support behind a temporary feature flag.
3. Add pinned-node rerouting for drag-stop updates, switch the new path to default, and remove legacy smooth-step routing plus any redundant compensating heuristics.

## Engineering principles and architectural constraints

- Clear ownership: visibility, scene construction, layout, routing output, and rendering must live in separate modules with explicit inputs and outputs.
- Stable identities: node ids, edge ids, field ids, and port ids must remain stable across rerenders and state toggles.
- Shared geometry contract: node height, visible rows, and port order must come from the same source used by both layout and rendering.
- No renderer-invented auto-routing: once the layout result exists, the renderer must not replace it with a second pathing algorithm for standard graph rendering.
- Backwards-safe interaction model: selection, hover, highlight, badges, labels, and issue linking must continue to work without knowing ELK internals.
- Asynchronous and cancellable layout: stale layout runs must not overwrite newer graph state.
- Constrained complexity: prefer a small number of explicit modules over deeply stateful cross-file heuristics.
- Limited scope: keep the primary layout direction left-to-right unless a separate product requirement justifies broader direction support.

## Acceptance criteria

- A new scene-model layer exists and all layout/routing code consumes it instead of reading renderer state directly.
- Every visible graph edge attaches to explicit field-level ports with stable ids.
- Auto-layout renders routed edge sections from layout output for relationships, associations, and materialization edges; node-center or generic smooth-step routing is no longer the default path.
- In the canonical fixture suite, all standard left-to-right edges attach from the correct node side and have zero unnecessary reverse-direction backtracking.
- In the canonical fixture suite, node-node overlap is zero and edge paths do not pass through unrelated node bodies.
- In the canonical fixture suite, total edge crossings are never worse than the current shipped layout, and designated dense fixtures improve graph bounding-box area by at least 10 percent without increasing crossings.
- Existing visibility behavior is preserved:
  - collapsed nodes still surface the fields required for visible relationships, attributes, and key/join semantics
  - expand/collapse still reveals the same columns as today unless a separate product change explicitly changes that rule
  - materialized-view reveal behavior still works and does not break edge visibility
- Existing interaction behavior is preserved:
  - selecting or hovering an edge highlights the correct rows
  - dragging a node preserves the dragged position and reroutes affected edges correctly on drag stop
  - hiding or showing graph elements does not corrupt unrelated node or edge state
- The legacy smooth-step edge routing path can be removed after rollout validation, leaving one maintained routing path.

## Risks and migration/refactor considerations

- Port-aware ELK integration is a real refactor, not a small swap. The biggest risk is spreading ELK-specific concerns into rendering and visibility code. The scene-model boundary is the mitigation.
- Stable port ordering is critical. If port ids or ordering shift unexpectedly during expand/collapse or materialized-view reveal, relationship highlighting and visibility will regress.
- Manual dragging is the main interaction risk. The implementation must avoid full-graph jumps when rerouting around a pinned node.
- Existing layout tuning state may need a storage-version bump if the meaning of persisted layout options changes.
- During migration, dual-path support is acceptable behind a feature flag, but the legacy route generation should be temporary and removable.
- `graph-field-layout.ts` should be reevaluated during the refactor. It may become a much smaller deterministic ordering helper or disappear entirely if port-aware routing makes it redundant.

## Validation strategy

- Add a fixture-based graph layout test suite that covers simple chains, fan-in/fan-out, dense FK graphs, many-to-many associations, materialized views, collapsed nodes, expanded nodes, and filtered visibility states.
- For each fixture, record objective metrics such as graph bounds, crossing count, node overlap count, and backtracking count so regressions are detectable in CI.
- Add unit tests for scene-model construction, stable port ids, collapsed-field visibility invariants, and route compilation from layout output.
- Add interaction tests for selection/highlight correctness, expand/collapse, materialized-view reveal, and drag-stop rerouting.
- Run visual regression review on a small set of representative screenshots before removing the legacy path.
- Roll out behind a temporary feature flag, validate against real devtools graphs, then remove the old routing path and the compatibility flag once metrics and visual review are stable.
