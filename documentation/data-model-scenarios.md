# Data Model Scenarios

This document works through one concrete domain — hiring — under every realistic
data shape a user might arrive with. For each shape it shows: what the raw data
looks like, what API calls are needed, what charts and filters become possible,
and what trade-offs exist.

The goal is to be extremely sharp about what each API primitive
(dataset, relationship, association, attribute, materialized view) unlocks, and
to confirm there is no hidden duplication between them.

---

## The domain

A hiring pipeline with:

- **jobs** — open positions with a salary, status, creation date
- **owners** — the people responsible for jobs and candidates
- **candidates** — people applying to jobs
- **skills** — required skills for jobs (a job needs many skills, a skill applies
  to many jobs)

This domain is small enough to parse quickly but has real complexity:

- 1:N relationships (owner → jobs, owner → candidates)
- N:N relationships (jobs ↔ skills)
- cross-dataset filtering (filter everything by owner)

---

## Scenario A: Fully denormalized flat table

The user already has one pre-joined table. Every row contains everything.

### Raw data shape

```ts
type FlatRow = {
  jobId: string
  jobTitle: string
  jobSalary: number
  jobCreatedAt: string
  jobStatus: 'open' | 'closed'
  ownerName: string
  ownerRegion: 'EU' | 'US'
  skillName: string
}
```

Example rows:

| jobId | jobTitle    | jobSalary | ownerName | skillName  |
| ----- | ----------- | --------- | --------- | ---------- |
| job-1 | Engineer    | 100       | Alice     | SQL        |
| job-2 | Designer    | 140       | Bob       | SQL        |
| job-2 | Designer    | 140       | Bob       | TypeScript |

Note: job-2 appears twice because it has two skills. The row grain is
`job × skill`.

### API

```ts
const hiringFlat = defineDataset<FlatRow>()
  .key(['jobId', 'skillName'])
  .columns((c) => [
    c.field('jobId'),
    c.category('jobTitle'),
    c.number('jobSalary'),
    c.date('jobCreatedAt'),
    c.category('jobStatus'),
    c.category('ownerName'),
    c.category('ownerRegion'),
    c.category('skillName'),
  ])

const jobsBySkill = hiringFlat
  .chart('jobsBySkill')
  .xAxis((x) => x.allowed('skillName').default('skillName'))
  .metric((m) => m.count())
```

No model, no relationships, no associations. One dataset, one chart.

### What's possible

- Any chart, any axis, any filter — everything is in one row.
- Filtering by owner, skill, status — all are just column filters.

### Trade-offs

- Row multiplication is baked in. job-2 with 2 skills = 2 rows. A `count()`
  chart will count job-2 twice unless the user understands the grain.
- The key must be composite (`['jobId', 'skillName']`) to reflect the true
  grain. If the user gets this wrong, validation fails.
- Adding candidates would mean even more row explosion, or a separate flat
  table.
- No cross-dataset coordination (no shared "Owner" filter across jobs and
  candidates).

### When this is the right choice

The user already has a pre-joined analytic export. They understand the grain.
They don't need cross-dataset dashboards.

---

## Scenario B: Star schema (fact + dimensions)

The user reorganizes their data so that the N:N bridge becomes a fact table,
and jobs, owners, skills become dimension tables.

This is the classic analytics pattern. It eliminates N:N entirely.

### Raw data shape

```ts
// Fact table: one row per job-skill pair
type JobSkillFact = {
  jobId: string
  skillId: string
  salary: number
  createdAt: string
  status: 'open' | 'closed'
  ownerId: string
}

// Dimension tables
type OwnerDim = { id: string; name: string; region: 'EU' | 'US' }
type SkillDim = { id: string; name: string }
```

Example fact rows:

| jobId | skillId  | salary | ownerId  |
| ----- | -------- | ------ | -------- |
| job-1 | skill-1  | 100    | owner-1  |
| job-2 | skill-1  | 140    | owner-2  |
| job-2 | skill-2  | 140    | owner-2  |

The fact table has foreign keys to dimensions. Every connection is 1:N from
dimension to fact.

### API

```ts
const jobSkillFacts = defineDataset<JobSkillFact>()
  .key(['jobId', 'skillId'])
  .columns((c) => [
    c.field('jobId'),
    c.field('skillId'),
    c.field('ownerId'),
    c.number('salary'),
    c.date('createdAt'),
    c.category('status'),
  ])

const ownerDim = defineDataset<OwnerDim>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
  ])

const skillDim = defineDataset<SkillDim>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Skill'}),
  ])

const model = defineDataModel()
  .dataset('jobSkillFacts', jobSkillFacts)
  .dataset('owners', ownerDim)
  .dataset('skills', skillDim)
  // Both are plain 1:N relationships. No association needed.
  .relationship('factOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobSkillFacts', column: 'ownerId'},
  })
  .relationship('factSkill', {
    from: {dataset: 'skills', key: 'id'},
    to: {dataset: 'jobSkillFacts', column: 'skillId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobSkillFacts', column: 'ownerId', via: 'factOwner'},
    ],
  })
```

### What's possible

- Chart `avg(salary) by skill` — materialize skill name onto the fact table via
  `factSkill` relationship, chart directly. No N:N traversal needed.
- Chart `count by owner` — same, via `factOwner` relationship.
- Shared "Owner" filter across the dashboard via attribute.
- All connections are simple FK lookups.

### What's NOT needed

- `association(...)` — there is no N:N. The bridge IS the fact table.
- `throughAssociation(...)` — materialization only uses `join(...)` for
  dimension lookups.
- Materialized views are optional — only needed if you want owner/skill names
  on the fact rows. Without materialization, you chart the fact table directly
  and filter via attributes.

### Trade-offs

- Requires the user to pre-flatten their bridge into a fact table with
  denormalized measures (salary, status, createdAt duplicated per skill).
- The grain is explicit in the key: `['jobId', 'skillId']`.
- Adding candidates requires a separate fact table (candidate-skill or
  candidate-stage facts), not a join to this one.

### When this is the right choice

The user can prepare their data upfront. They understand star schemas. This is
the simplest model for analytics — and the most predictable.

---

## Scenario C: Normalized tables with separate bridge rows

The user has clean normalized tables as they come from a transactional database.
They have a separate `jobSkills` bridge table.

### Raw data shape

```ts
type Job = { id: string; ownerId: string; salary: number; createdAt: string }
type Owner = { id: string; name: string; region: 'EU' | 'US' }
type Skill = { id: string; name: string }
type JobSkill = { jobId: string; skillId: string }  // bridge rows
```

Each table has its own grain. The bridge table captures the N:N mapping.

### API

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.field('ownerId'),
    c.number('salary'),
    c.date('createdAt'),
  ])

const owners = defineDataset<Owner>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Owner'}),
    c.category('region'),
  ])

const skills = defineDataset<Skill>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name', {label: 'Skill'}),
  ])

const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillRows,
    columns: {from: 'jobId', to: 'skillId'},
  })
  .attribute('owner', {
    kind: 'select',
    source: {dataset: 'owners', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', column: 'ownerId', via: 'jobOwner'},
    ],
  })
  .attribute('skill', {
    kind: 'select',
    source: {dataset: 'skills', key: 'id', label: 'name'},
    targets: [
      {dataset: 'jobs', through: 'jobSkills', mode: 'exists'},
    ],
  })
```

### What's possible with association alone (no materialization)

Filtering:

- "Show me jobs that require SQL" → attribute `skill` filter selects SQL →
  association lookup finds `[job-1, job-2]` → jobs dataset filtered to those
  IDs. No new rows created.
- "Show me jobs owned by Alice" → attribute `owner` filter → relationship
  lookup. Same pattern.

Charts on single datasets:

- `jobs by month` — works, charts the jobs dataset directly.
- `jobs by month, filtered by skill=SQL` — works, filtering happens before
  the chart sees the data.
- `job count by owner` — works via materialized view with owner join, or
  directly if ownerId is sufficient.

### What requires materialization

Charts that need columns from both sides of the N:N:

- `avg(salary) by skill name` — the x-axis is `skillName` (from skills) and
  the y-axis is `salary` (from jobs). No single dataset has both.

```ts
const jobsBySkill = model.materialize('jobsBySkill', (m) =>
  m
    .from('jobs')
    .join('owner', {relationship: 'jobOwner'})
    .throughAssociation('skill', {association: 'jobSkills'})
    .grain('job-skill'),
)

// Produces rows like:
// { id: 'job-1', salary: 100, ownerName: 'Alice', skillId: 'skill-1', skillName: 'SQL' }
// { id: 'job-2', salary: 140, ownerName: 'Bob',   skillId: 'skill-1', skillName: 'SQL' }
// { id: 'job-2', salary: 140, ownerName: 'Bob',   skillId: 'skill-2', skillName: 'TypeScript' }
```

Now `avg(salary) by skillName` works because both columns are on the same row.

### Trade-offs

- Association is needed because the bridge rows exist separately from both
  datasets.
- Materialization is only needed for cross-boundary charting, not for filtering.
- The user doesn't have to restructure their data — they pass it as-is.

---

## Scenario D: Normalized tables with embedded arrays

Same as Scenario C, but instead of a separate bridge table, the N:N mapping is
embedded as an array field in the jobs table.

### Raw data shape

```ts
type Job = {
  id: string
  ownerId: string
  salary: number
  createdAt: string
  skillIds: string[]  // embedded N:N mapping
}
type Owner = { id: string; name: string; region: 'EU' | 'US' }
type Skill = { id: string; name: string }
```

No separate bridge table. The edge data lives inside jobs.

### API

```ts
const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('owners', owners)
  .dataset('skills', skills)
  .relationship('jobOwner', {
    from: {dataset: 'owners', key: 'id'},
    to: {dataset: 'jobs', column: 'ownerId'},
  })
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    deriveFrom: {
      dataset: 'jobs',
      values: (job) => job.skillIds ?? [],
    },
  })
```

### What changes vs Scenario C

Nothing in terms of capabilities. The `deriveFrom` variant builds the same
lookup maps as explicit edge rows. The runtime behavior is identical:

- Filtering via association → same
- Materialization when needed → same
- Attributes referencing the association → same

The only difference is input ergonomics: the user doesn't need to manufacture
bridge rows. The API extracts them from the array field.

---

## What each primitive unlocks — summary

| Primitive | What it does | When you need it |
| --- | --- | --- |
| **dataset** | Declares one flat table with typed columns and keys | Always |
| **relationship** | Connects two datasets via FK (1:N) | When a dataset has a foreign key pointing at another dataset's declared key |
| **association** | Builds bidirectional lookup maps for N:N edges | When two datasets are connected N:N and the user has NOT pre-flattened into a star schema fact table |
| **attribute** | Names a filter concept that spans multiple datasets via declared relationships or associations | When a shared filter should affect multiple datasets |
| **materialized view** | Produces new flat rows by joining/expanding across relationships and associations | When a chart needs columns from both sides of a relationship or association on the same row |

### Is there duplication?

No. Each primitive answers a different question:

- **relationship** = "how are these connected?" (structural plumbing)
- **association** = "how are these connected N:N?" (structural plumbing for a
  different cardinality)
- **attribute** = "what does this filter mean across my model?" (semantic layer)
- **materialized view** = "give me a new flat table from this" (data production)

Attributes reference relationships and associations but don't duplicate them —
they add cross-dataset coordination that neither can express alone.

Materialized views consume relationships and associations to produce rows, but
associations alone only produce lookup maps for filtering — not chartable rows.

### Could association be eliminated?

Yes — if you require star schema (Scenario B). The user would model the bridge
as a fact table with FKs to both dimensions. All connections become 1:N
relationships. No associations, no `throughAssociation`, simpler API.

The trade-off: the user must pre-flatten their bridge data and duplicate
measures (salary, status, etc.) onto each bridge row. This is more work upfront
but produces a simpler, more predictable model.

### Could materialized views be eliminated?

Partially — if the chart engine could aggregate across association lookups at
render time (iterate skills, grab related jobs, compute avg salary). This would
avoid producing flat rows entirely.

But this pushes complexity into the chart engine and makes the row grain
implicit rather than explicit. The current design keeps it simple: a chart
always reads one flat array. If you need cross-boundary columns, you
materialize first, explicitly.

---

## Recommendation: guide users toward star schema, accept normalized as fallback

The simplest mental model for users:

1. **Can you pre-flatten?** → Scenario A or B. Use datasets + relationships
   only. No associations, no materialized views.

2. **Data comes normalized with a bridge table?** → Scenario C. Use
   association for filtering. Materialize only if a chart needs cross-boundary
   columns.

3. **Data comes normalized with embedded arrays?** → Scenario D. Use derived
   association. Same capabilities as C.

The API should make Scenario B (star schema) the easiest path and Scenarios
C/D available as escape hatches for users who can't reshape their data.
