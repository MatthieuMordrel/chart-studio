# @matthieumordrel/chart-studio-ui

> Early alpha. Active work in progress. Not recommended for production use yet.

Optional React UI primitives for `@matthieumordrel/chart-studio`.

This package contains the ready-made controls, context provider, and Recharts canvas. It depends on the headless core package and requires Tailwind CSS v4 for the shipped theme contract.

Your app still needs a normal Tailwind CSS v4 integration such as `@tailwindcss/vite`, the PostCSS plugin, or the Tailwind CLI.

Install:

```bash
bun add @matthieumordrel/chart-studio @matthieumordrel/chart-studio-ui react react-dom recharts lucide-react tailwindcss
```

Use `@alpha` on both names if you install from the `alpha` dist-tag only.

Import from:

```tsx
import {useChart} from '@matthieumordrel/chart-studio'
import {Chart, ChartCanvas, ChartToolbar} from '@matthieumordrel/chart-studio-ui'
```

Theme import:

```css
@import 'tailwindcss';
@import '@matthieumordrel/chart-studio-ui/theme.css';
```

Full documentation: <https://github.com/MatthieuMordrel/chart-studio#readme>
