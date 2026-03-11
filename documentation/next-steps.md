# Next Steps

This file captures the recommended follow-up work after the single-source inference-first API redesign.

## Recommended Order

1. Add failing inference stress tests before more refactors.
2. Update the playground examples to teach the new API.
3. Redesign the multi-source API to follow the same inference-first pattern.
4. Remove the old `columns` helper API and delete dead compatibility code.
5. Do a final cleanup pass to simplify the implementation and public surface.

## 1. Add Failing Inference Stress Tests

This is the highest-value next step because the new inference layer is where subtle regressions are most likely to hide.

Focus on:

- mixed nullable fields
- date-like strings vs ordinary strings
- timestamp numbers vs ordinary numeric metrics
- sparse booleans and null-heavy fields
- IDs, slugs, and free-text fields that should not become useful chart dimensions by accident
- `columnHints` overrides winning over inference
- excluded fields via `false`
- empty datasets and partially empty datasets

Add a few golden-path tests too:

- `useChart({ data })`
- `useChart({ data, columnHints: { createdAt: { type: 'date' } } })`
- custom label, custom format, and exclusion in the same configuration
- typed custom UI usage through `useTypedChartContext()`

## 2. Update Playground Examples

Once inference behavior is better covered, make the playground reflect the intended public API so examples reinforce the new mental model.

Update:

- `examples/playground/src/MinimalChart.tsx`
- `examples/playground/src/KitchenSinkChart.tsx`
- `examples/playground/src/mock-data.ts`

Goal:

- use raw `data` directly in single-source examples
- add `columnHints` only where they clearly improve labels or inference
- keep examples realistic and minimal

## 3. Redesign Multi-Source

After single-source inference is solid, bring multi-source to the same API philosophy.

Target shape:

```ts
useChart({
  sources: [
    {
      id: 'sales',
      label: 'Sales',
      data: salesData,
      columnHints: {
        createdAt: { type: 'date' },
        revenue: { format: 'currency' }
      }
    },
    {
      id: 'users',
      label: 'Users',
      data: usersData
    }
  ]
})
```

Goals:

- each source is inference-first
- each source can override with typed `columnHints`
- source switching still resets stale state correctly
- typing stays as strong as realistically possible without pretending schemas are identical

## 4. Remove Old `columns` API

Only do this once:

- single-source inference is well-tested
- playground examples no longer teach the old approach
- multi-source has been migrated

Then remove:

- public exports for `columns` and `defineColumns`
- old tests centered on manual column builders
- dead helper code and compatibility branches
- outdated docs and examples

## 5. Final Cleanup Pass

After the migration is complete, do one last pass for obvious wins.

Look for:

- simplifications in `src/core/infer-columns.ts`
- duplicate formatting logic across UI components
- unnecessary exported types
- naming improvements around hints, resolved columns, and typed context
- places where the API can be reduced without losing clarity

## Success Criteria

The redesign is in a good place when:

- the primary examples use `useChart({ data, columnHints? })`
- inference behavior is covered by realistic tests
- multi-source follows the same mental model
- the old manual schema-first API is gone
- the remaining public API feels smaller and easier to explain
