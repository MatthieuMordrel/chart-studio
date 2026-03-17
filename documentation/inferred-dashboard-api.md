# Inferred Dashboard API

## Design goal

Pass data, define charts, done. The system infers relationships, attributes,
and materialization from naming conventions and data shape. When it can't infer
safely, it fails at the type level with a clear message.

---

## The dream

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    owners: ownerRows,
    candidates: candidateRows,
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    candidatesByStage: {
      data: 'candidates',
      xAxis: 'stage',
      metric: 'count',
    },
  },
})
```

That's it. Two charts, three datasets, zero model configuration.

Filtering by owner across both charts works automatically because the system
sees `jobs.ownerId` → `owners.id` and `candidates.ownerId` → `owners.id`.

---

## What about cross-dataset charts?

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    owners: ownerRows,
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    salaryByOwner: {
      data: 'jobs',
      xAxis: 'owner.name',       // traverse jobs.ownerId → owners, use name
      metric: { column: 'salary', fn: 'avg' },
    },
  },
})
```

The system resolves `owner.name`:

1. `jobs` has column `ownerId`
2. Convention: `ownerId` → dataset `owners`, key `id`
3. `owners` has column `name`
4. Resolved: materialize `owners.name` onto jobs via the inferred relationship

No manual relationship declaration. No manual materialization.

---

## Inference rules

### Column types (from data)

| Value shape | Inferred type |
| --- | --- |
| Strings matching ISO date patterns (or date-like key name) | `date` |
| Numbers with date-like key name in timestamp range | `date` |
| All other strings | `category` |
| All other numbers | `number` |
| All values are booleans | `boolean` |
| Date objects | `date` |

These can be overridden per column when needed (see escape hatches below).

### Relationships (from naming conventions)

Rule: a column named `{datasetId}Id` or `{singularOfDatasetId}Id` where
`{datasetId}` matches a registered dataset name → inferred FK relationship.

| Column | Dataset exists? | Inferred relationship |
| --- | --- | --- |
| `jobs.ownerId` | `owners` ✓ | `jobs.ownerId → owners.id` |
| `candidates.ownerId` | `owners` ✓ | `candidates.ownerId → owners.id` |
| `jobs.departmentId` | `departments` ✗ | No inference (column ignored) |

Why this is safe:

- The convention `{thing}Id` → `{things}.id` is near-universal in application
  databases.
- The system validates referential integrity at runtime. If `jobs.ownerId`
  contains a value not in `owners.id`, it hard-fails — same as today.
- If the column matches the convention but the FK doesn't validate, the system
  tells you exactly what's wrong.

### Shared filter attributes (from relationships)

Rule: if a dimension dataset connects to multiple fact datasets via inferred
relationships, it becomes an available shared filter automatically.

| Dimension | Connects to | Auto-available filter |
| --- | --- | --- |
| `owners` | `jobs`, `candidates` | "Owner" filter (label from first string category column, or key) |

The user doesn't declare attributes. They exist implicitly. The dashboard UI
can surface them. The user can choose which ones to enable.

### N:N from bridge tables

Rule: a dataset where every column is either part of the composite key or is a
FK to another dataset → inferred bridge table.

```ts
data: {
  jobs: jobRows,
  skills: skillRows,
  jobSkills: [                         // auto-detected as bridge
    { jobId: 'job-1', skillId: 'skill-1' },
    { jobId: 'job-2', skillId: 'skill-1' },
  ],
}
```

The system sees:

- `jobSkills.jobId` → `jobs.id` (FK convention)
- `jobSkills.skillId` → `skills.id` (FK convention)
- No other meaningful columns → this is a bridge, not a fact table

Result: `jobs ↔ skills` connection via `jobSkills` bridge. Filtering and
materialization work through it.

### N:N from embedded arrays

Rule: a column containing arrays of values that match another dataset's key
values → inferred derived association.

```ts
// jobs rows have skillIds: string[]
{ id: 'job-1', ownerId: 'owner-1', salary: 100, skillIds: ['skill-1'] }
```

The system sees:

- `jobs.skillIds` is an array of strings
- Values match `skills.id` key values
- Convention: `skillIds` → dataset `skills`, key `id`

Result: same as explicit `deriveFrom` association, but inferred.

---

## When inference fails — type errors

### Case 1: ambiguous FK column

```ts
// Two datasets could match
data: {
  jobs: [{ id: '1', managerId: 'u-1', reviewerId: 'u-1' }],
  managers: [{ id: 'u-1', name: 'Alice' }],
  reviewers: [{ id: 'u-1', name: 'Bob' }],
  users: [{ id: 'u-1', name: 'Alice' }],
}
```

`managerId` matches `managers` → fine.
`reviewerId` matches `reviewers` → fine.

No ambiguity here — each FK column matches exactly one dataset.

But if the column was just `userId` and both `users` and `userAccounts` exist?
The system matches on exact `{datasetId}Id` convention. `userId` → `users`.
No ambiguity.

### Case 2: FK column doesn't match any dataset

```ts
charts: {
  salaryByDepartment: {
    data: 'jobs',
    xAxis: 'department.name',    // jobs.departmentId exists but no departments dataset
  },
}
```

Type error:

```
Type error: Cannot resolve 'department.name' on dataset 'jobs'.
Column 'departmentId' exists but no dataset 'departments' was provided.
Either add a 'departments' dataset to data, or use a direct column reference.
```

### Case 3: cross-dataset column doesn't exist

```ts
charts: {
  jobsByOwner: {
    data: 'jobs',
    xAxis: 'owner.email',       // owners dataset has no 'email' column
  },
}
```

Type error:

```
Type error: Column 'email' does not exist on dataset 'owners'.
Available columns: 'id', 'name', 'region'.
```

### Case 4: referential integrity failure at runtime

```ts
// jobs.ownerId contains 'owner-99' but owners has no row with id 'owner-99'
```

Runtime error:

```
Relationship 'jobs.ownerId → owners.id' has orphan foreign key 'owner-99'.
Either fix the data or exclude this relationship with: exclude: ['jobs.ownerId']
```

### Case 5: column name matches convention but data doesn't validate

```ts
// jobs has 'statusId' column, and there's a 'statuses' dataset,
// but statusId values don't match any statuses.id values
```

Runtime error:

```
Inferred relationship 'jobs.statusId → statuses.id' failed validation:
0 of 50 statusId values match a statuses.id key.
If 'statusId' is not a foreign key, exclude it: exclude: ['jobs.statusId']
```

---

## Escape hatches

### Override column type

```ts
createDashboard({
  data: {
    jobs: jobRows,
  },
  columns: {
    jobs: {
      salary: { type: 'number', format: 'currency' },
      createdAt: { type: 'date', label: 'Created' },
      internalId: false,                     // exclude from charts
    },
  },
})
```

### Exclude a false-positive FK

```ts
createDashboard({
  data: {
    jobs: jobRows,
    statuses: statusRows,
  },
  exclude: ['jobs.statusId'],               // not a real FK, don't infer
})
```

### Declare a relationship that can't be inferred

```ts
createDashboard({
  data: {
    jobs: jobRows,
    people: peopleRows,                     // not 'owners', so ownerId won't match
  },
  relationships: {
    jobOwner: {
      from: { dataset: 'people', key: 'id' },
      to: { dataset: 'jobs', column: 'ownerId' },
    },
  },
})
```

### Declare a bridge that wasn't auto-detected

```ts
createDashboard({
  data: {
    jobs: jobRows,
    skills: skillRows,
    assignments: assignmentRows,            // has extra columns, not auto-detected as bridge
  },
  bridges: {
    jobSkills: {
      dataset: 'assignments',
      from: { column: 'jobId', dataset: 'jobs' },
      to: { column: 'skillId', dataset: 'skills' },
    },
  },
})
```

---

## Full example: hiring dashboard

### Happy path (everything inferred)

```ts
const dashboard = createDashboard({
  data: {
    jobs: [
      { id: 'job-1', ownerId: 'owner-1', status: 'open', createdAt: '2026-01-10', salary: 100 },
      { id: 'job-2', ownerId: 'owner-2', status: 'closed', createdAt: '2026-02-10', salary: 140 },
    ],
    owners: [
      { id: 'owner-1', name: 'Alice', region: 'EU' },
      { id: 'owner-2', name: 'Bob', region: 'US' },
    ],
    candidates: [
      { id: 'cand-1', ownerId: 'owner-1', stage: 'applied', appliedAt: '2026-01-15' },
      { id: 'cand-2', ownerId: 'owner-2', stage: 'onsite', appliedAt: '2026-03-20' },
    ],
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    candidatesByStage: {
      data: 'candidates',
      xAxis: 'stage',
      metric: 'count',
    },
    salaryByOwner: {
      data: 'jobs',
      xAxis: 'owner.name',
      metric: { column: 'salary', fn: 'avg' },
    },
  },
})
```

What the system infers:

1. **Datasets**: `jobs` (key: `id`), `owners` (key: `id`), `candidates` (key: `id`)
2. **Column types**: `createdAt`/`appliedAt` → date, `salary` → number, `status`/`stage`/`region` → category, etc.
3. **Relationships**: `jobs.ownerId → owners.id`, `candidates.ownerId → owners.id`
4. **Shared filters**: `owners` is a dimension connecting to both `jobs` and `candidates` → "Owner" filter available
5. **Materialization for `salaryByOwner`**: `owner.name` → join `owners.name` onto `jobs` via `ownerId`

The user wrote 30 lines. The system figured out the rest.

### With N:N (bridge table)

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    owners: ownerRows,
    skills: skillRows,
    jobSkills: [
      { jobId: 'job-1', skillId: 'skill-1' },
      { jobId: 'job-2', skillId: 'skill-1' },
      { jobId: 'job-2', skillId: 'skill-2' },
    ],
  },
  charts: {
    jobsByMonth: {
      data: 'jobs',
      xAxis: 'createdAt',
      metric: 'count',
    },
    salaryBySkill: {
      data: 'jobs',
      xAxis: 'skill.name',                  // resolved via jobSkills bridge
      metric: { column: 'salary', fn: 'avg' },
    },
  },
})
```

The system detects `jobSkills` as a bridge (all columns are FKs), infers the
N:N connection, and materializes `skill.name` onto jobs when the chart needs it.

### With override (non-standard naming)

```ts
const dashboard = createDashboard({
  data: {
    jobs: jobRows,
    people: peopleRows,       // not 'owners'
  },
  relationships: {
    jobOwner: {
      from: { dataset: 'people', key: 'id' },
      to: { dataset: 'jobs', column: 'ownerId' },
    },
  },
  charts: {
    salaryByPerson: {
      data: 'jobs',
      xAxis: 'jobOwner.name',              // use declared relationship name
      metric: { column: 'salary', fn: 'avg' },
    },
  },
})
```

---

## Key inference detection rules

### How to detect the key of a dataset

Rule: a column named `id`, or the first column whose values are all unique and
non-null.

If no column qualifies → runtime error:

```
Dataset 'jobs' has no detectable key column.
Add an 'id' column or specify: keys: { jobs: 'myKeyColumn' }
```

### How to detect a bridge table vs a fact table

A bridge table:

- Has exactly 2 FK columns (matching `{dataset}Id` convention)
- Has no other columns, or only has columns that are also FKs
- Is not referenced as `data` by any chart

A fact table:

- Has FK columns AND measure/dimension columns
- Or is referenced by a chart

If ambiguous, treat it as a fact table (safer default — doesn't hide data).

### How to detect dimension vs fact

A dimension:

- Has a single-column key
- Is referenced by FK from other datasets
- Has mostly category/label columns, few or no numeric measures

A fact:

- Has numeric measure columns
- Has FK columns pointing at dimensions
- May have composite keys

This detection is used for auto-surfacing shared filters (dimensions that
connect to multiple facts).

---

## Migration from current API

The current explicit API becomes the escape hatch layer. The inference layer
sits on top:

```
createDashboard({ data, charts })          ← new inference layer
        ↓ (infers)
defineDataModel().dataset().relationship()  ← existing explicit layer
        ↓ (builds)
useDashboard({ definition, data })          ← existing runtime
```

Nothing is thrown away. The explicit API still works for users who want full
control. The inference layer is sugar that produces the same internal structures.

---

## Open questions

1. **Should `xAxis: 'owner.name'` use dot notation or something else?** Dot
   notation is natural but could collide with column names containing dots.
   Alternatives: `'owner:name'`, `['owner', 'name']`, `{ from: 'owner', column: 'name' }`.

2. **Should shared filters be auto-surfaced or still declared?** Auto-detection
   of dimensions is possible, but the user might not want every dimension as a
   filter. Options: auto-detect and surface all (user hides unwanted ones), or
   require `filters: ['owner', 'status']` in the dashboard config.

3. **Key detection confidence**: `id` column is obvious. But what about
   composite keys? The system could detect `jobSkills` needs `['jobId', 'skillId']`
   from uniqueness analysis. Is that safe enough?

4. **Column type override granularity**: should overrides be per-dataset or
   global? A column named `status` might be a category in `jobs` but a number
   in another dataset.
