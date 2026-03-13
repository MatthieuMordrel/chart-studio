# Formatting Strategy

This file captures the recommended formatting direction for `chart-studio`.

The goal is simple:

- users should usually not need to provide `format`
- defaults should be good, predictable, and easy to explain
- explicit overrides should stay flexible and type-safe
- the formatting layer should stay small

## Core Rule

The main rule should be:

- column type decides the default formatting family
- explicit `format` decides the more specific presentation
- `formatter` is the final escape hatch

This keeps the API honest and avoids magic based on field names.

## Default Path

The ideal common case should look like this:

```tsx
const chart = useChart({data})
```

Result:

- no formatting config is required
- values are still displayed in a readable way

## Type-Based Defaults

### `number`

Default behavior:

- use a readable generic numeric display
- support values from very large negatives to very large positives
- compact large values when helpful with `K`, `M`, `B`, `T`
- choose reasonable decimal precision based on visible range
- if a visible numeric range mostly lives between `-1` and `1`, percent-style display may be the best default

Currency should not be guessed.

If a user wants currency, they should opt in explicitly.

Target API:

```tsx
const chart = useChart({data})
```

Result:

- `3412442` may display as `3.4M`
- `0.2778` may display as `27.8%`
- `$` does not appear unless the user explicitly asks for currency formatting

### `date`

Default behavior:

- use the date family by default
- when the chart is showing bucketed dates, the display should follow the active `timeBucket`

Target API:

```tsx
const chart = useChart({data})
```

Result:

- `day` -> `Mar 11, 26`
- `month` -> `Mar 26`
- `quarter` -> `Q1 26`
- `year` -> `2026`

### `category`

Default behavior:

- display the category string as-is unless explicitly overridden

Target API:

```tsx
const chart = useChart({data})
```

Result:

- `Enterprise`

### `boolean`

Default behavior:

- display `trueLabel` / `falseLabel` when provided
- otherwise use sensible fallback labels

Target API:

```tsx
const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.boolean('isOpen', {
      trueLabel: 'Open',
      falseLabel: 'Closed',
    }),
  ])
  .build()
```

Result:

- `Open`
- `Closed`

## Explicit Override Path

When the default is not what the user wants, the first override layer should stay declarative and typed.

Recommended direction:

```ts
type ColumnFormat =
  | 'number'
  | 'compact-number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | {
      kind: 'number'
      locale?: string
      options?: Intl.NumberFormatOptions
    }
  | {
      kind: 'date'
      locale?: string
      options?: Intl.DateTimeFormatOptions
    }
```

Target API:

```tsx
const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.number('revenue', {
      format: 'currency',
    }),
    c.date('closedAt', {
      format: {
        kind: 'date',
        options: {
          month: 'short',
          year: 'numeric',
        },
      },
    }),
  ])
  .build()
```

Result:

- `1200000` displays as `$1,200,000`
- `2026-03-11T00:00:00.000Z` displays as `Mar 26`

## Escape Hatch

Some cases are too custom for declarative formatting.

That is what `formatter` should remain for.

Target API:

```tsx
const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.number('revenuePerSeat', {
      formatter: (value) => `${value} per seat`,
    }),
  ])
  .build()
```

Result:

- `1200 per seat`

## Surface Rule

The formatting policy should apply across the chart UI, but not identically everywhere.

Recommended rule:

- axis: shortest acceptable version
- tooltip: clearest version
- data labels: compact readable version
- debug/internal state: raw version

Target API:

```tsx
const chart = useChart({data})
```

Result:

- axis shows `3.4M`
- tooltip shows `3,412,442`
- data label shows `3.4M`
- debug output shows `3412442`

This is not inconsistency.
It is surface-appropriate display of the same underlying value.

## What This Should Impact

This strategy should affect the main user-facing value surfaces:

- axis tick labels
- tooltip values
- tooltip labels when relevant
- chart data labels
- pie / donut labels
- filter labels when they represent typed values

It should not rewrite internal data structures.

## Non-Goals

This strategy should not turn into a large formatting framework.

Non-goals:

- inventing a custom formatting DSL early
- mirroring every chart-library formatting prop
- guessing business meaning like currency from field names
- changing underlying values instead of display
- formatting debug or internal machine data the same way as chart UI

## Recommendation

If I were choosing the direction now, I would do this:

1. Improve defaults first.
2. Keep defaults driven by column type.
3. Let date defaults respond to `timeBucket`.
4. Let number defaults be smart inside the number family.
5. Require explicit opt-in for currency.
6. Keep `format` as the main explicit override.
7. Keep `formatter` as the escape hatch.

## Short Version

- most users should not write `format`
- type should decide the default family
- `timeBucket` should refine default date display
- numeric defaults should already be readable across large ranges
- currency should require explicit opt-in
- `format` should handle specific presentation
- `formatter` should handle edge cases
