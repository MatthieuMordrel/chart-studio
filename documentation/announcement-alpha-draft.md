# chart-studio alpha announcement draft

`chart-studio` is now available as an early public alpha.

It currently ships as two packages:

- `@matthieumordrel/chart-studio` for the headless core
- `@matthieumordrel/chart-studio-ui` for the optional React UI layer

This is still active work in development. The API, package boundaries, and behavior may change as the design tightens.

Important expectation-setting:

- this is an early alpha
- it is not recommended for production use yet
- npm releases default to the `latest` dist-tag; optional `alpha` channel for prereleases

Full acknowledgements (TanStack Table, Elysia, Recharts) are in the repository README.

Install:

```bash
bun add @matthieumordrel/chart-studio @matthieumordrel/chart-studio-ui react react-dom recharts lucide-react tailwindcss
```

Short version for a post:

`chart-studio` is publicly available as an early alpha: a headless charting core for React with an optional UI package on top. It is still in active development and not recommended for production use yet. Default npm installs use `latest`; use `@alpha` when publishing or consuming the prerelease dist-tag.
