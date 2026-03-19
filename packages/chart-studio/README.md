# @matthieumordrel/chart-studio

> Early alpha. Active work in progress. Not recommended for production use yet.

Headless, composable charting for React.

Use this package when you want chart state, filtering, grouping, metrics, time bucketing, transformed data, and the model/dashboard APIs without the optional UI layer.

Install:

```bash
bun add @matthieumordrel/chart-studio@alpha react
```

Current prereleases are published under the `alpha` dist-tag on npm.

Import from:

```tsx
import {defineDataset, useChart} from '@matthieumordrel/chart-studio'
```

If you also want the optional ready-made React UI, install `@matthieumordrel/chart-studio-ui` alongside this package.

Special thanks to the teams behind TanStack Table and Recharts.

Full documentation: <https://github.com/MatthieuMordrel/chart-studio#readme>
