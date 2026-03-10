# chart-studio TODO

This file tracks the remaining follow-up work for `chart-studio`.

## Main backlog

| Priority | Area | Status | Current issue | Recommendation | Notes |
| --- | --- | --- | --- | --- | --- |
| P0 | UI contract | Fixed | `ui` needed a clearer styling contract for adopters. | Keep the current README explanation and `ui/theme.css` flow. | The package now documents that `ui` is Tailwind-based, ships a default theme, and can be overridden via semantic tokens. |
| P0 | README setup | Fixed | The README did not clearly explain the required theme variables or how fallbacks work. | Keep the README examples for importing `@matthieumordrel/chart-studio/ui/theme.css` and overriding tokens selectively. | The docs now explain that users can either import the built-in theme or define the full token contract themselves. |
| P0 | Styling consistency | Fixed | `chart-debug` used a hardcoded orange debug style unrelated to the rest of the `ui` package. | Keep `ChartDebug` on the same semantic token system as the rest of `ui`. | `chart-debug` now follows the package theme instead of using its own hardcoded palette. |
| P0 | Popover positioning | Open | Some popovers still appear visually disconnected from their trigger. | Continue debugging anchored floating behavior, especially around toolbar overflow and nested controls. | A shared floating primitive was introduced, but the issue is still reported as unresolved. |
| P0 | Chart rendering bug | Fixed | Line charts were not appearing correctly in some playground states. | Keep the color fallback path that no longer depends on `--chart-1` through `--chart-5` being defined. | This is considered solved after adding safe chart color fallbacks. |
| P1 | UI contract consistency | Open | The `ui` layer is mostly semantic-token based, but there are still one-off hardcoded visual details like custom RGBA shadows and some Recharts selector rules. | Audit remaining hardcoded visual values and decide which should stay internal vs become tokenized. | Not every shadow must become configurable, but the contract should be intentional. |
| P1 | Playground realism | Open | The playground is useful, but it should continue to reflect the real consumer setup. | Keep it aligned with the package theme import flow and use it as the main visual QA surface. | It now imports the shared `ui/theme.css`, but still needs ongoing UX validation. |
| P1 | UX polish | Open | Some controls still feel rough or inconsistent even after the contract and theme work. | Audit spacing, density, hover states, panel alignment, and control composition across the `ui` layer. | This is best done after the floating/positioning bugs are fully solved. |
| P2 | Optional preset CSS direction | Changed | The package previously had no default theme file. | Reassess later whether the current `ui/theme.css` approach is enough or whether a more fully precompiled styling strategy is needed. | This item changed scope because a packaged theme file now exists. |
