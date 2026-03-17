# Relationship Input Scenarios

This document focuses on one specific problem:

- how users may provide many-to-many edge data
- what the API should do in each case

This is separate from simple key-to-foreign-key relationships.

For normal lookup-style relationships such as `owners.id -> jobs.ownerId`, the
main API should still use:

- `defineDataset(...).key(...)`
- `defineDataModel(...).relationship(...)`

This document is only about the cases where a many-to-many connection exists.

## Why This Matters

When users want to filter one dataset by another across a many-to-many domain,
the model needs the edge pairs somehow.

Example:

- `jobs`
- `skills`
- which jobs have which skills

Without those job-skill edge pairs, the relationship does not actually exist in
a usable way.

So the real design question is not:

- do we need a bridge concept?

It is:

- what shape does the user already have?
- how much should they have to model explicitly?

## Scenario 1. Already Flat Or Denormalized

The user already has one flat table that contains everything needed for the
chart.

Example shape:

- each row already has both job and skill fields
- or the chart is already built from a pre-joined analytic table

Recommended API:

- use one dataset only
- do not require `defineDataModel(...)`
- do not require `association(...)`

Example:

```ts
const jobsWithSkills = defineDataset<JobWithSkill>()
  .key(['jobId', 'skillId'])
  .columns((c) => [
    c.field('jobId'),
    c.category('jobTitle'),
    c.field('skillId'),
    c.date('createdAt'),
    c.category('skillName'),
    c.number('salary'),
  ])

const jobsBySkill = jobsWithSkills.chart('jobsBySkill')
  .xAxis((x) => x.allowed('skillName'))
  .metric((m) => m.count())
```

When this is the right choice:

- the user already has a flat analytic dataset
- row grain is already understood and accepted
- there is no need to preserve normalized semantics in the runtime

Tradeoff:

- simple to use
- but row multiplication is already baked into the source data
- the flat row grain should be explicit, for example `key(['jobId', 'skillId'])`

## Scenario 2. Explicit Edge Rows Already Exist

The user has normalized tables plus explicit edge rows.

Example shape:

- `jobs`
- `skills`
- `jobSkills` rows with `{jobId, skillId}`

Recommended API:

- use `association(...)`
- do not force the edge rows to be modeled as a full chartable dataset unless the user wants that

Example:

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('title'),
    c.date('createdAt'),
    c.number('salary'),
  ])

const skills = defineDataset<Skill>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
  ])

const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('skills', skills)
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    data: jobSkillsData,
    columns: {
      from: 'jobId',
      to: 'skillId',
    },
  })
```

Why this is a good fit:

- the user already has the true many-to-many mapping
- the API stays explicit
- the edge rows do not have to pretend to be a normal chart dataset

## Scenario 3. Edge Values Are Embedded In A Dataset

The user does not have a separate bridge table, but the many-to-many mapping is
still present in the source data.

Example shape:

- each job row has `skillIds: string[]`

The association source field does not need to be exposed as a chart column just
because it exists in the raw row shape.

Recommended API:

- still use `association(...)`
- allow the association to be derived from an existing dataset field

Example:

```ts
const jobs = defineDataset<Job>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('title'),
    c.date('createdAt'),
    c.number('salary'),
  ])

const skills = defineDataset<Skill>()
  .key('id')
  .columns((c) => [
    c.field('id'),
    c.category('name'),
  ])

const model = defineDataModel()
  .dataset('jobs', jobs)
  .dataset('skills', skills)
  .association('jobSkills', {
    from: {dataset: 'jobs', key: 'id'},
    to: {dataset: 'skills', key: 'id'},
    deriveFrom: {
      dataset: 'jobs',
      values: (job) => job.skillIds ?? [],
    },
  })
```

Why this is a good fit:

- the mapping really exists in the source data
- the user does not have to manually manufacture bridge rows first
- the runtime can build the edge pairs once and cache them

Important rule:

- this is derived association data, not guessed association data

The source data already contains the relationship.

## Scenario 4. No Edge Mapping Exists

The user has two datasets that should logically be related, but no actual edge
mapping is available.

Example shape:

- `jobs`
- `skills`
- but nothing says which job has which skill

Recommended API:

- do not infer
- require the user to provide either:
  - explicit association data
  - embedded edge values
  - or a pre-materialized flat dataset

This case should fail fast because there is nothing real to build from.

The runtime cannot safely invent many-to-many edges from:

- matching names
- matching ids that only appear similar
- overlapping value sets

Why this matters:

- otherwise the model becomes magical and unreliable
- false positives would be extremely hard to debug

## Recommendation

The main API should support all four situations like this:

1. Flat already: use one dataset directly.
2. Explicit edge rows: use `association(... data ...)`.
3. Embedded edge values: use `association(... deriveFrom ...)`.
4. No edge mapping: fail and require user-provided structure.

This means we should not force every many-to-many case into:

- a chartable bridge dataset

But we also should not pretend that many-to-many can be inferred when the source
data does not actually contain the mapping.

## Design Consequence For The Main API

The main dashboard API should therefore distinguish:

- chartable datasets
- key-to-foreign-key relationships
- many-to-many associations
- explicit materialized views

That gives us a clearer model than treating every bridge as either:

- a normal dataset
- or hidden implicit magic
