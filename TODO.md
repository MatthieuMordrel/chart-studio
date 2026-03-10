# chart-studio TODO

This file captures the current UI/theming decisions and the main follow-up work needed to make `chart-studio` both easy to adopt and flexible to customize.

## Recommended product direction

| Topic | Recommendation | Why |
| --- | --- | --- |
| `core` | Keep `core` fully headless and styling-free. | This is the maximum-flexibility layer and already gives users full control over rendering and design. |
| `ui` | Keep `ui` as the drop-in layer, but make it explicitly **Tailwind + shadcn-token compatible**. | This gives most users an instant, polished default without forcing them to build UI from scratch. |
| shadcn dependency | Do **not** require users to install or own shadcn component source files. | Requiring copied app-local component code would make the npm package harder to adopt and harder to maintain. |
| non-shadcn users | Support them by documenting the semantic token contract instead of requiring shadcn itself. | Users do not need shadcn specifically if they provide the same semantic variables. |
| long-term theming | Consider shipping an optional preset stylesheet later, but not yet. | That would improve drop-in behavior, but is more work and should come after the token contract is stabilized. |

## Main backlog

| Priority | Area | Current issue | Recommendation | Notes |
| --- | --- | --- | --- | --- |
| P0 | UI contract | `ui` is not truly self-themed today. It assumes Tailwind plus shadcn-style semantic tokens. | Officially document `ui` as **Tailwind + semantic-token based**. | This is the most important clarity fix for adoption. |
| P0 | README setup | The README should document the exact semantic variables `ui` currently expects. | Add a setup section listing the required tokens: `background`, `foreground`, `muted`, `muted-foreground`, `border`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, and `ring`. | These are the tokens currently used across `src/ui`. |
| P0 | Styling consistency | `chart-debug` is still visually hardcoded with orange debug styling and does not follow the same semantic token contract as the rest of `ui`. | Refactor `ChartDebug` to use the same semantic token approach as the rest of the package. | Today it uses hardcoded orange classes and should either become theme-aware or be explicitly treated as a dev-only panel. |
| P0 | Popover positioning | Some popovers can appear visually disconnected from their trigger. | Audit all positioned controls and standardize them on one floating/panel primitive. | `chart-select` and `chart-toolbar-overflow` both do custom `getBoundingClientRect()` + fixed positioning logic. |
| P0 | Chart rendering bug | Line charts do not appear correctly in some playground states. | Investigate `ChartCanvas` line rendering and add a dedicated test/demo case for `line`. | The issue may be data-related, styling-related, or a chart config bug; it needs a concrete repro and fix. |
| P1 | UI contract consistency | The `ui` layer is mostly semantic-token based, but there are still one-off hardcoded visual details like custom RGBA shadows and some Recharts selector rules. | Keep the semantic tokens, but audit remaining hardcoded visual values and decide which should stay internal vs become tokenized. | Not every shadow must become configurable, but the contract should be intentional. |
| P1 | Required token audit | The current token contract is implicit, not explicit. | Create a small internal theme contract doc or exported CSS example showing the minimum required token set. | This can later become an optional shipped preset. |
| P1 | Playground realism | The playground currently provides its own theme shim to make the package look correct. | Keep the playground, but clearly label it as a **consumer environment simulator**. | This is useful because it reflects what users actually need to provide. |
| P1 | UX polish | Some controls visually feel close to production quality, others still feel rough or inconsistent. | Audit spacing, density, hover states, and panel alignment across all controls using the playground. | This is best done after the styling contract is settled. |
| P2 | Non-shadcn path | Non-shadcn users need a clear way to adopt `ui` without guessing how to theme it. | Document that shadcn is not required, only the semantic variables are. Include a minimal CSS example in the docs. | This avoids forcing one ecosystem while still keeping the default contract simple. |
| P2 | Optional preset CSS | There is no official “default theme CSS” shipped with the package yet. | Revisit later whether to ship something like `@matthieumordrel/chart-studio/theme.css`. | This would make `ui` more plug-and-play, but should wait until the token contract is stable. |

## Exact styling contract to document

| Token | Currently needed by `ui` | Notes |
| --- | --- | --- |
| `background` | Yes | Used by buttons, surfaces, and inputs. |
| `foreground` | Yes | Used for primary text. |
| `muted` | Yes | Used for subtle backgrounds and hover states. |
| `muted-foreground` | Yes | Used for secondary text and icons. |
| `border` | Yes | Used for outlines and separators. |
| `popover` | Yes | Used by menus and floating panels. |
| `popover-foreground` | Indirectly / should be supported | Good to document alongside `popover` for a complete semantic contract. |
| `primary` | Yes | Used for selected/active states. |
| `primary-foreground` | Yes | Used on filled primary badges. |
| `ring` | Yes | Used for focus-visible states. |

## Files worth auditing first

| File | Why it matters | Recommendation |
| --- | --- | --- |
| `src/ui/chart-debug.tsx` | Hardcoded orange debug styling breaks the semantic theme story. | Refactor to theme tokens or classify as intentionally dev-only. |
| `src/ui/chart-select.tsx` | Custom fixed-position logic and panel rendering. | Validate anchor positioning and consider centralizing floating behavior. |
| `src/ui/chart-toolbar-overflow.tsx` | Same custom floating logic, plus complex drill-down UI. | Standardize positioning behavior and test against toolbar/layout shifts. |
| `src/ui/chart-canvas.tsx` | Responsible for line/bar/area/pie rendering and some Recharts skinning. | Investigate line chart issue and review Recharts styling assumptions. |
| `README.md` | Needs to set correct adoption expectations. | Add exact token requirements and a minimal theme snippet. |

## Recommended implementation order

| Step | Recommendation | Why this order |
| --- | --- | --- |
| 1 | Document the current `ui` contract in `README.md`. | Users need clear setup requirements immediately. |
| 2 | Make styling consistent in `src/ui`, starting with `chart-debug`. | This tightens the design system before expanding features. |
| 3 | Fix the known UX bugs: popover anchor issues and missing line chart rendering. | Functional correctness matters more than deeper theming work. |
| 4 | Audit the whole `ui` directory for remaining hardcoded visual values. | This makes the token contract explicit and reliable. |
| 5 | Decide later whether to ship an optional preset CSS theme. | That should come after the API and theme contract are stable. |
