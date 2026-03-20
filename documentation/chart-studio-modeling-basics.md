# Chart Studio: modeling basics

A short guide to **how to think about data** in this architecture—what each piece is for, when to use it, and why materialized views exist.

For deeper scenarios, see [`semantic-model-concepts/README.md`](./semantic-model-concepts/README.md) and [`data-model-scenarios.md`](./data-model-scenarios.md).

---

## The one idea to remember: **grain**

**Grain** = *what does one row mean?*

- One row = one **order** → order-level metrics make sense (revenue per order).
- One row = one **order line** → line-level metrics make sense (units per SKU).

If you mix them up, charts look “fine” but numbers are **wrong** (double-counting, inflated sums).  
Chart Studio makes **grain explicit** so that mistake is hard to make by accident.

---

## The pieces (what / when / why)

| Piece | What it is | When to use it | Why it exists |
|--------|------------|----------------|---------------|
| **Dataset** | A flat table: keys + columns + optional derived fields. | Every chartable table you own (facts, dimensions). | Charts attach to **one** row shape at a time. |
| **Relationship** | **1:N** link: one parent key → many child rows via a foreign key. | “Manager has many plans,” “plan belongs to one manager.” | Declares a real FK path for joins and filters—no guessing. |
| **Association** | **N:N** link between two datasets (often a **bridge** table). | “Plans need many capabilities; each capability applies to many plans.” | Many-to-many is not a normal FK column; it needs its own semantics. |
| **Materialized view** | A **named, flat result** built from `model.materialize(...)`: base dataset + optional joins + optional expansion. | You need a **different grain** (e.g. one row per plan×capability) or a **wide table** for charts without repeating joins everywhere. | **Grain and joins become visible and reusable**—not hidden inside the chart runtime. |
| **Attribute** | A **shared filter** concept (e.g. “capability” filter) wired to real columns. | Dashboards should filter across charts in a consistent way. | Keeps filters aligned with the model instead of ad-hoc props. |
| **Dashboard** | Which charts exist + which shared filters apply. | Composing a screen. | Separates “model truth” from “this screen.” |

---

## How they work together (mental picture)

1. **Datasets** hold your normalized data (good for integrity and reuse).
2. **Relationships** and **associations** describe **how** datasets connect (1:N and N:N).
3. **Materialized views** are **optional outputs**: “give me a table at **this** grain, with **these** columns already joined.”
4. **Charts** are authored against **either** a dataset **or** a materialized view—**one** grain per chart.

```text
[ Datasets ]  --relationships-->  1:N paths
       \
        --associations-->  N:N (bridge / edges)

[ materialize(...) ]  -->  flat table at a chosen grain  -->  charts
```

Nothing here replaces a good SQL database. It **structures** how analytics and dashboards see the data so **row meaning** is always clear.

---

## Materialized views: why they matter

### Without a materialized view (only datasets + relationships)

You *can* still model the world correctly. Relationships and associations describe the links.

But each chart is tied to **one** dataset. To answer “capability demand by region” you need columns from **plans**, **managers**, and **capabilities** on the **same** row. That either means:

- denormalizing columns onto one dataset by hand, or
- a **hidden** join engine that guesses grain and cardinality.

Hidden joins are where **wrong totals** and **duplicate rows** come from.

### With a materialized view

You **declare** a result table:

- **Grain**: e.g. `"project-plan-capability"` → one row per (plan, capability).
- **Steps**: start from `projectPlans`, join manager, expand through the association to capabilities.

Charts on that view use **simple, honest queries**: “count rows, group by capability name.” Everyone knows **one row = one plan–capability pair**.

So materialized views are not “because SQL can’t join.” They are because **analytics need a clear, named row type**—and the library wants that written down **once**, not reinvented per chart.

### When you **don’t** need a materialized view

- **Single-dataset** questions only (e.g. “plans per month” on `projectPlans`) → use the dataset directly.
- **1:N** enrichment is **not** changing grain (e.g. attach manager name to each plan, still one row per plan) → a small **lookup-style** MV is optional; some teams keep a thin view, others keep charts on the base dataset and accept fewer cross-dataset columns until needed.
- **Exploring** a relationship path in devtools or a one-off chart is not the same as **productizing** a metric—MVs matter most when a **grain** is reused across charts or filters.

**Rule of thumb:** add a materialized view when you would otherwise **repeat the same join + grain** in multiple places, or when **cardinality** is easy to get wrong (especially N:N).

---

## One example (playground-style)

- **Datasets:** `projectPlans`, `managers`, `capabilities`
- **Relationship:** `projectManager` (manager → managerId on plans)
- **Association:** `projectCapabilities` (bridge: plan id ↔ capability id)
- **View A — `projectPlansWithManager`:** still **one row per plan**, manager fields added → good for **project-level** KPIs.
- **View B — `projectCapabilityView`:** **one row per (plan, capability)** → good for **capability** and **cross** metrics (counts by capability, etc.).

Using only view B for **project-level** totals would be wrong (plans with many capabilities repeat). Using only view A for **capability-by-region** would be wrong (you don’t have one row per capability link).  
**Two grains → two purposes**—that’s intentional.

---

## Why this is a good design

- **Explicit grain** beats “smart” joins that hide cardinality.
- **Normalized storage** + **declared analytic views** scales better than one giant denormalized table.
- **Materialized views** are the **contract** between your model and your charts: “this is what we mean by one row here.”

If you remember only one thing: **name the grain, then attach charts.** Materialized views are how you **name** grains that span multiple datasets.
