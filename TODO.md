# chart-studio TODO

This file tracks the remaining follow-up work for `chart-studio`.

## Main backlog

| Priority | Area | Status | Current issue | Recommendation | Notes |
| --- | --- | --- | --- | --- | --- |
| P1 | UI contract consistency | Open | The `ui` layer is mostly semantic-token based, but there are still one-off hardcoded visual details like custom RGBA shadows and some Recharts selector rules. | Audit remaining hardcoded visual values and decide which should stay internal vs become tokenized. | Not every shadow must become configurable, but the contract should be intentional. |
| P1 | Playground realism | Open | The playground is useful, but it should continue to reflect the real consumer setup. | Keep it aligned with the package theme import flow and use it as the main visual QA surface. | It now imports the shared `ui/theme.css`, but still needs ongoing UX validation. |
| P1 | UX polish | Open | Some controls still feel rough or inconsistent even after the contract and theme work. | Audit spacing, density, hover states, panel alignment, and control composition across the `ui` layer. | This is best done after the floating/positioning bugs are fully solved. |
