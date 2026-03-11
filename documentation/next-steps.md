# Next Steps

This file captures the recommended follow-up work after the inference-first redesign work landed.

## Recommended Order

1. Do a final cleanup pass to simplify the implementation and public surface.
2. Keep documentation aligned with the inference-first API.
3. Add any missing regression coverage found during cleanup.

## Completed

- single-source inference stress tests
- primary playground examples using raw `data` and optional `columnHints`
- multi-source inference-first `sources` API
- old `columns` and `defineColumns` helper API removal
- stale helper tests and compatibility docs centered on manual column builders

## 1. Final Cleanup Pass

After the migration is complete, do one last pass for obvious wins.

Look for:

- simplifications in `src/core/infer-columns.ts`
- duplicate formatting logic across UI components
- unnecessary exported types
- naming improvements around hints, resolved columns, and typed context
- places where the API can be reduced without losing clarity

## 2. Documentation Alignment

Keep the remaining docs honest about the public API:

- prefer `useChart({ data, columnHints? })` in single-source examples
- prefer `useChart({ sources: [...] })` with raw data in multi-source examples
- describe `useTypedChartContext()` as the typed single-source custom UI escape hatch
- keep the zero-argument `useChartContext()` story broad and runtime-safe

## 3. Regression Gaps

If cleanup changes behavior, add focused regression tests for:

- source switching edge cases around sorting and date range state
- empty or sparse datasets with heavy `columnHints`
- consumer-facing docs/examples that are likely to drift again

## Success Criteria

The redesign is in a good place when:

- the primary examples use `useChart({ data, columnHints? })`
- inference behavior is covered by realistic tests
- multi-source follows the same mental model
- the old manual schema-first API is gone
- the remaining public API feels smaller and easier to explain
