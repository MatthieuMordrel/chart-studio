# Schema Builder Migration Plan

This document describes how to migrate `defineChartSchema` from the current object-literal authoring API to one fluent builder API that maximizes:

1. type safety
2. IntelliSense / Ctrl+Space quality
3. hover documentation quality
4. ergonomics, as long as it does not weaken the first three

The next agent should treat this as the implementation spec for the migration.

## Decision

Replace the current public authoring shape:

```ts
defineChartSchema<Row>()({
  columns: {
    createdAt: {type: 'date'},
    salary: {type: 'number'},
  },
  xAxis: {allowed: ['createdAt']},
})
```

with one fluent builder entry path:

```ts
const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('ownerName', {label: 'Owner'}),
    c.boolean('isOpen'),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => row.salary != null && row.salary > 100_000 ? 'High' : 'Base',
    }),
  ])
  .xAxis((x) => x.allowed('createdAt').default('createdAt'))
  .groupBy((g) => g.allowed('ownerName', 'isOpen', 'salaryBand'))
  .filters((f) => f.allowed('ownerName', 'isOpen', 'salaryBand'))
  .metric((m) =>
    m
      .count()
      .aggregate('salary', 'sum', 'avg')
      .defaultAggregate('salary', 'sum')
  )
  .chartType((t) => t.allowed('bar', 'line').default('line'))
  .timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))
  .connectNulls(false)
  .build()
```

This becomes the only public schema authoring path.

## Why The Current API Falls Short

The current builder in `src/core/define-chart-schema.ts` validates the schema by intersecting the authoring object with naked generics such as:

```ts
TColumns & ExactShape<SchemaColumnsValidationShape<T, NoInfer<TColumns>>, NoInfer<TColumns>>
```

That is strong for `tsc` validation but weak for editor contextual typing.

The practical result:

- top-level schema keys are not reliably suggested
- `columns` keys are not reliably suggested
- nested values do not reliably get property completions
- hover text on inline properties is poor or absent

This is not mainly a correctness bug. It is a `tsserver` authoring-surface problem.

## Best-Practice Conclusion

For a single public entry path, a fluent builder is the right design.

This is the closest fit to the patterns used by TypeScript-heavy libraries with strong authoring DX:

- TypeScript itself rewards concrete contextual typing and function-argument inference more than giant generic object literals.
- TanStack Table uses helper-driven column definitions instead of asking users to write one huge deeply generic object.
- Elysia gets strong types from chained methods and small explicit schema helpers instead of one giant generic config object.

The lesson to copy is not their exact API.

The lesson to copy is:

- put the inference boundary on methods and method arguments
- avoid making the main authoring surface a single generic object literal
- make the editor suggest valid next moves from concrete methods

## Target Public API

### Final shape

`defineChartSchema<Row>()` should return a fluent builder object.

That builder should expose:

- `.columns(...)`
- `.xAxis(...)`
- `.groupBy(...)`
- `.filters(...)`
- `.metric(...)`
- `.chartType(...)`
- `.timeBucket(...)`
- `.connectNulls(...)`
- `.build()`

### Columns API

`columns` should accept a callback that receives a typed helper and returns a const-inferred list of entries.

Recommended shape:

```ts
.columns((c) => [
  c.field('ownerName', {label: 'Owner'}),
  c.date('createdAt', {label: 'Created'}),
  c.number('salary', {format: 'currency'}),
  c.boolean('isOpen'),
  c.exclude('internalId'),
  c.derived.number('salaryValue', {
    label: 'Salary Value',
    format: 'currency',
    accessor: (row) => row.salary ?? 0,
  }),
])
```

The column helper should expose:

- `field`
- `date`
- `category`
- `number`
- `boolean`
- `exclude`
- `derived.date`
- `derived.category`
- `derived.boolean`
- `derived.number`

### Control section APIs

Recommended shape:

```ts
.xAxis((x) => x.allowed('createdAt').hidden('ownerName').default('createdAt'))
.groupBy((g) => g.allowed('ownerName', 'isOpen', 'salaryBand').default('ownerName'))
.filters((f) => f.allowed('ownerName', 'isOpen', 'salaryBand').hidden('isOpen'))
.chartType((t) => t.allowed('bar', 'line').hidden('bar').default('line'))
.timeBucket((tb) => tb.allowed('month', 'quarter').default('month'))
```

The selectable control builder should expose:

- `allowed(...options)`
- `hidden(...options)`
- `default(option)` where a default is supported

`filters` should not expose `default`, because the underlying config does not support it.

### Metric API

Do not keep the raw object-array metric authoring surface.

Move metrics to explicit methods:

```ts
.metric((m) =>
  m
    .count()
    .aggregate('salary', 'sum', 'avg')
    .aggregate('salaryValue', 'sum')
    .hideAggregate('salary', 'avg')
    .defaultAggregate('salary', 'sum')
)
```

The metric builder should expose:

- `count()`
- `aggregate(columnId, ...aggregates)`
- `hideCount()`
- `hideAggregate(columnId, ...aggregates)`
- `defaultCount()`
- `defaultAggregate(columnId, aggregate)`

This is more verbose than the current metric object shape, but it gives much better completions and removes the need to remember nested object syntax.

## Required Type-Level Behavior

### Raw field completion

For raw field methods, the first argument should autocomplete row keys immediately.

Examples:

- `c.field(...)` should accept `InferableFieldKey<Row>`
- `c.date(...)` should accept only raw keys that can legally become `'date'`
- `c.number(...)` should accept only raw numeric keys
- `c.boolean(...)` should accept only raw boolean keys
- `c.category(...)` should accept only raw string keys
- `c.exclude(...)` should accept only raw inferable keys

Define dedicated helper key types instead of repeating conditional logic inline:

- `StringFieldKey<T>`
- `NumberFieldKey<T>`
- `BooleanFieldKey<T>`
- `DateLikeFieldKey<T>`

Use existing inference logic as the source of truth where possible.

### Raw field option typing

Each raw-field method should expose only the valid options for that field.

Examples:

- `c.number('salary', ...)` should offer `format`, `formatter`, `label`, and `type?: 'number' | 'date'` only if the API keeps `type` configurable there
- `c.boolean('isOpen', ...)` should offer `trueLabel` and `falseLabel`
- `c.date('createdAt', ...)` should offer date-friendly formatting

Recommended rule:

- specialized helpers should not require users to repeat the obvious type
- the helper should set the type itself

So prefer:

```ts
c.number('salary', {format: 'currency'})
```

over:

```ts
c.number('salary', {type: 'number', format: 'currency'})
```

### Derived column option typing

Derived methods must strongly type the accessor return based on the chosen method:

- `derived.date(...).accessor` returns `string | number | Date | null | undefined`
- `derived.category(...).accessor` returns `string | null | undefined`
- `derived.boolean(...).accessor` returns `boolean | null | undefined`
- `derived.number(...).accessor` returns `number | null | undefined`

The `row` parameter must always be the actual `Row`.

### Later sections must see earlier columns

After `.columns(...)` has run, later sections must narrow against the resolved column ids and types produced there.

Examples:

- `.xAxis(...)` should see raw date/category/boolean ids plus derived date/category/boolean ids
- `.groupBy(...)` should see raw and derived category/boolean ids only
- `.filters(...)` should see raw and derived category/boolean ids only
- `.metric(...)` should see raw and derived numeric ids only

This is one of the main reasons to move to the fluent builder.

### Order-sensitive typing is acceptable

Do not spend excessive complexity making every method fully order-independent.

It is acceptable that:

- sections only know about columns that have already been declared earlier in the chain
- docs recommend putting `.columns(...)` before `.xAxis(...)`, `.groupBy(...)`, `.filters(...)`, and `.metric(...)`

That is a normal builder tradeoff and matches the way libraries like Elysia and TanStack Table accumulate type state.

## Internal Type-State Design

The implementation should preserve the final runtime `ChartSchema` shape, but the authoring surface should stop exposing generic exact-object intersections.

Recommended generic state on the builder:

```ts
ChartSchemaBuilder<
  TRow,
  TColumns,
  TXAxis,
  TGroupBy,
  TFilters,
  TMetric,
  TChartType,
  TTimeBucket
>
```

This is conceptually similar to the current `SchemaFromSections<...>` flow, but the generics are accumulated by methods instead of inferred from one big object literal.

### Recommended conversion flow

1. Column helper methods produce typed intermediate entry objects.
2. `.columns(...)` converts the returned entry tuple into one `columns` map type.
3. Later section builders produce literal config types directly.
4. `.build()` returns:

```ts
DefinedChartSchema<
  TRow,
  SchemaFromSections<TRow, TColumns, TXAxis, TGroupBy, TFilters, TMetric, TChartType, TTimeBucket>
>
```

Keep using the existing output-side schema types if they still fit.

Do not keep the current generic exact-object types as the public authoring boundary.

## Runtime Design

The runtime shape consumed by `useChart` should stay the same.

This migration should change authoring, not pipeline behavior.

`build()` should return a plain schema object equivalent to the current one:

```ts
{
  columns: { ... },
  xAxis: { ... },
  groupBy: { ... },
  filters: { ... },
  metric: { ... },
  chartType: { ... },
  timeBucket: { ... },
  connectNulls: false,
  __chartSchemaBrand: 'chart-schema-definition',
}
```

That means:

- `useChart`
- `inferColumnsFromData`
- pipeline code
- formatting code

should not need semantic changes, only compatibility with the new authoring entry.

## Duplicates And Repeated Sections

The current object-literal API naturally prevents duplicate top-level keys in `columns`.

The new builder introduces a new risk: users may define the same column twice.

Handle that explicitly.

### Column duplicates

Preferred behavior:

- reject duplicate column ids at compile time when possible
- throw a runtime error if duplicates still slip through

Recommended compile-time rule:

- once a raw or derived id has been added, it should be removed from the allowed input keys of later column methods

### Repeated section calls

Keep this simple:

- repeated `.xAxis(...)` calls replace the previous xAxis config
- repeated `.groupBy(...)` calls replace the previous groupBy config
- repeated `.filters(...)` calls replace the previous filters config
- repeated `.metric(...)` calls replace the previous metric config
- repeated `.chartType(...)` calls replace the previous chartType config
- repeated `.timeBucket(...)` calls replace the previous timeBucket config
- repeated `.connectNulls(...)` calls replace the previous value

Document this behavior clearly.

Do not silently merge repeated section calls.

## Public API Rules

### Keep one public entry path

Do not keep both the old object-literal API and the new fluent builder as equal first-class public APIs.

That would:

- double the docs burden
- double the test surface
- keep the weak IntelliSense path alive forever
- make the public story less clear

If a temporary migration overload is needed for one PR, mark it deprecated and remove it before release.

### Keep the final schema output type

The final built schema should still be a `DefinedChartSchema<...>` compatible object.

The migration changes how users author the schema, not what `useChart` receives.

### Prefer method docs over nested property docs

One of the goals is better hover quality.

Put rich JSDoc on:

- `field`
- `date`
- `category`
- `number`
- `boolean`
- `exclude`
- `derived.*`
- `allowed`
- `hidden`
- `default`
- `count`
- `aggregate`
- `defaultAggregate`

This is more effective than hoping deeply nested object-property hover stays strong.

## Suggested File Layout

Do not put all builder-specific logic back into `src/core/types.ts`.

Recommended split:

- `src/core/define-chart-schema.ts`
  - public `defineChartSchema` entry
- `src/core/schema-builder.ts`
  - builder implementation
- `src/core/schema-builder.types.ts`
  - builder-only helper types

Keep `src/core/types.ts` focused on stable public schema/runtime types.

Builder internals can import from `types.ts`, but do not continue growing `types.ts` into one giant file if the migration can avoid it.

## Recommended Implementation Sequence

### 1. Add builder-only helper types

Create the field-key filters and intermediate entry types needed by the builder:

- raw field key helpers by value category
- intermediate column entry types
- tuple-to-columns-map helpers
- metric builder helper types
- selectable control builder helper types

### 2. Implement the column helper

Implement the typed helper passed to `.columns(...)`.

Important constraints:

- use methods, not raw object literals
- use const generics so users do not need `as const`
- keep duplicate-id prevention in mind from the start

### 3. Implement selectable control builders

Implement `xAxis`, `groupBy`, `filters`, `chartType`, and `timeBucket` builders with variadic methods.

Prefer variadic arguments over arrays because:

- they autocomplete better
- they avoid `as const`
- they read better in chains

### 4. Implement the metric builder

This is the most important section after columns because the current object shape is the least discoverable.

Make sure:

- aggregate column ids only accept numeric ids
- aggregate names autocomplete
- default metric helpers are role-safe

### 5. Implement the top-level builder

Use an immutable or effectively immutable builder.

Recommended rule:

- each method returns a new builder instance with narrowed generic state

Avoid relying on mutating one object and lying to TypeScript with `as unknown as ...` on `this`.

### 6. Preserve runtime output shape

`build()` must produce the same runtime schema shape the rest of the library already understands.

That is what keeps the migration scoped to authoring and typing.

### 7. Migrate internal usage

Update:

- tests
- typecheck fixtures
- README examples
- playground examples
- docs snippets

Do not leave old object-literal examples in public docs.

## Testing Checklist

### Type-level coverage

Update and expand:

- `src/core/use-chart.typecheck.ts`
- `src/core/use-chart-multi-source.typecheck.ts`
- `src/ui/chart-context.typecheck.tsx`

Add assertions for:

- raw key suggestions by method argument types
- derived accessors typed to `Row`
- xAxis/groupBy/filter/metric methods narrowed by earlier columns
- duplicate column ids rejected
- excluded ids removed from later section APIs
- derived numeric ids allowed in metrics but not groupBy
- derived date ids allowed in reference-date flows

### Runtime coverage

Keep or add runtime tests to prove the built schema is equivalent to the current schema object shape.

Specifically verify:

- raw overrides become `schema.columns[key]`
- exclusions become `false`
- derived entries become `kind: 'derived'` objects in `schema.columns`
- config builders serialize to the current config shape
- metric builder expands shorthand correctly

### Editor-DX regression guard

We cannot reliably test Ctrl+Space in `vitest`, but we can guard the design indirectly:

- no authoring surface should expose a top-level naked generic object-literal intersection
- primary authoring should happen through method calls with concrete argument positions

If the next agent finds themself reintroducing a giant `T & ExactShape<...>` parameter as the user-facing authoring surface, they are rebuilding the same problem.

## Migration Examples

### Before

```ts
const schema = defineChartSchema<Row>()({
  columns: {
    createdAt: {type: 'date', label: 'Created'},
    ownerName: {type: 'category', label: 'Owner'},
    salary: {type: 'number', format: 'currency'},
    internalId: false,
    salaryBand: {
      kind: 'derived',
      type: 'category',
      label: 'Salary Band',
      accessor: (row) => row.salary != null && row.salary > 100_000 ? 'High' : 'Base',
    },
  },
  xAxis: {allowed: ['createdAt']},
  groupBy: {allowed: ['ownerName', 'salaryBand']},
  metric: {
    allowed: [
      {kind: 'count'},
      {kind: 'aggregate', columnId: 'salary', aggregate: ['sum', 'avg']},
    ],
    default: {kind: 'aggregate', columnId: 'salary', aggregate: 'sum'},
  },
})
```

### After

```ts
const schema = defineChartSchema<Row>()
  .columns((c) => [
    c.date('createdAt', {label: 'Created'}),
    c.category('ownerName', {label: 'Owner'}),
    c.number('salary', {format: 'currency'}),
    c.exclude('internalId'),
    c.derived.category('salaryBand', {
      label: 'Salary Band',
      accessor: (row) => row.salary != null && row.salary > 100_000 ? 'High' : 'Base',
    }),
  ])
  .xAxis((x) => x.allowed('createdAt'))
  .groupBy((g) => g.allowed('ownerName', 'salaryBand'))
  .metric((m) =>
    m
      .count()
      .aggregate('salary', 'sum', 'avg')
      .defaultAggregate('salary', 'sum')
  )
  .build()
```

## Non-Goals

Do not attempt to preserve every visual aspect of the old API.

Do not attempt to keep the old object-literal entry as a permanent alias.

Do not optimize for schema JSON-serializability at authoring time. The API is a TypeScript builder API, not a plain JSON config format.

Do not overcomplicate the builder to support perfectly order-independent typing if that makes the implementation fragile.

## Success Criteria

The migration is successful when all of the following are true:

- `defineChartSchema<Row>()` has one fluent public authoring path
- raw field ids autocomplete from method arguments
- derived helpers strongly type `accessor`
- later sections narrow from earlier column definitions
- metric authoring is method-driven, not nested object driven
- hover docs are strong on methods
- public docs no longer rely on `satisfies` for normal schema authoring
- the built runtime schema shape remains compatible with `useChart`
- `bun run typecheck` and tests are green

## References

- TypeScript contextual typing:
  https://www.typescriptlang.org/docs/handbook/type-inference.html#contextual-typing
- TypeScript `satisfies`:
  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html
- TanStack Table column helpers:
  https://tanstack.com/table/latest/docs/guide/column-defs
- Elysia TypeScript pattern:
  https://elysiajs.com/patterns/typescript
- Elysia validation pattern:
  https://elysiajs.com/essential/validation
