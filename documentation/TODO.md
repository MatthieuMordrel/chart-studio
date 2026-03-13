# chart-studio TODO

This file tracks the remaining follow-up work for `chart-studio`.

## API & Typing


| Priority | Area                         | Status | Current issue                                                                                                                                                                             | Recommendation                                                                                                                  | Notes                                                                                      |
| -------- | ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P2       | UI context typing edge cases | Open   | Single-source custom UI can recover strong typing with `useTypedChartContext()`, but the zero-argument hook stays broad and multi-source typed context is still not supported.            | Keep the current typed single-source path unless a cleaner zero-argument API becomes possible; revisit multi-source separately. | TypeScript cannot infer a provider's generic type across an arbitrary React subtree today. |
| P2       | Remaining typed helpers      | Open   | Single-source charts now preserve literal column IDs through the main headless API, but some lower-level helpers still stay broad, especially `SortConfig.key` and transformed data keys. | Decide how far to push typed series/output helpers without making the API heavy.                                                | This is now a refinement item rather than a release blocker.                               |


## Core


| Priority | Area             | Status | Current issue                                                                                                                                                          | Recommendation                                                                                                                             | Notes                                                                                      |
| -------- | ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| P1       | Label control    | Open   | Charts lack a unified way to control label placement and visibility (on chart, on top, below, etc.), which varies by chart type and is hard to customize consistently. | Add a per-chart-type label API for visibility, position (top/bottom/inside), and styling; ensure each chart category is easy to customize. | Labels should be configurable at the series/axis/data-point level depending on chart type. |
| P1       | Label formatting | Open   | Data labels cannot be formatted by type (currency, percentage, compact notation, etc.) in a consistent, per-series or per-axis way.                                    | Add formatter presets (currency, percent, compact) and support custom formatter functions; integrate with label control API.               | Consider Intl.NumberFormat as a baseline; allow overrides for locale and options.          |
| P1       | Y axis placement | Open   | Using `"avg"` as a column ID causes the Y axis to incorrectly move to the left.                                                                                        | Investigate axis positioning logic for short or reserved column IDs; ensure orientation is stable regardless of column name.               | Likely a layout or Recharts `orientation`/`yAxisId` bug triggered by certain column names. |


## UI & Contract


| Priority | Area                    | Status | Current issue                                                                                                                                                  | Recommendation                                                                                        | Notes                                                                              |
| -------- | ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P1       | UI contract consistency | Open   | The `ui` layer is mostly semantic-token based, but there are still one-off hardcoded visual details like custom RGBA shadows and some Recharts selector rules. | Audit remaining hardcoded visual values and decide which should stay internal vs become tokenized.    | Not every shadow must become configurable, but the contract should be intentional. |
| P1       | UX polish               | Open   | Some controls still feel rough or inconsistent even after the contract and theme work.                                                                         | Audit spacing, density, hover states, panel alignment, and control composition across the `ui` layer. | This is best done after the floating/positioning bugs are fully solved.            |


## Playground


| Priority | Area               | Status | Current issue                                                                        | Recommendation                                                                               | Notes                                                                            |
| -------- | ------------------ | ------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1       | Playground realism | Open   | The playground is useful, but it should continue to reflect the real consumer setup. | Keep it aligned with the package theme import flow and use it as the main visual QA surface. | It now imports the shared `ui/theme.css`, but still needs ongoing UX validation. |


