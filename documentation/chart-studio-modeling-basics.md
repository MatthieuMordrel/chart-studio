# Chart Studio: modeling basics

A short guide to **how to think about data** in this architecture—what each piece is for, when to use it, and why materialized views exist.

For deeper scenarios, see [`semantic-model-concepts/README.md`](./semantic-model-concepts/README.md) and [`data-model-scenarios.md`](./data-model-scenarios.md).

---

## The one idea to remember: **grain**

**Grain** = *what does one row mean?*

- One row = one **order** → you can sum revenue **per order**.
- One row = one **line on an order** (same order appears on several rows) → you can sum **per line** (for example how many units of each product).

If you mix them up, charts look fine but numbers are **wrong** (double-counting, totals that are too high).  
Chart Studio makes **grain explicit** so that mistake is hard to make by accident.

---

## The pieces (what / when / why)

| Piece | What it is | When to use it | Why it exists |
|--------|------------|----------------|---------------|
| **Dataset** | A flat table: keys, columns, and optional calculated fields. | Any table you want to chart from. | A chart reads **one** row shape at a time. |
| **Relationship** | **One-to-many** link: one parent row → many child rows (via a column on the child that points to the parent). | “One manager, many plans,” “each plan belongs to one manager.” | Declares a real link so joins and filters are clear—not guessed. |
| **Association** | **Many-to-many** link between two tables (often a small **bridge** table in the middle). | “Each plan needs many skills; each skill appears on many plans.” | Many-to-many cannot be modeled as a single pointer column; it needs its own structure. |
| **Materialized view** | A **named, flat result** built from `model.materialize(...)`: start from one table, optionally pull in other tables, optionally **repeat rows** when a plan matches many skills. | You need a **different row meaning** (for example one row per plan-and-skill pair) or one wide table used by several charts. | **What each row means** and **how tables were combined** is written down once—not hidden inside each chart. |
| **Attribute** | A **shared filter** (for example “filter by capability”) wired to real columns. | A dashboard should filter every chart the same way. | Filters stay aligned with the model instead of one-off settings. |
| **Dashboard** | Which charts exist + which shared filters apply. | Building a screen. | Separates “how the world is modeled” from “this one page.” |

---

## How they work together (mental picture)

1. **Datasets** hold your tables—usually split into sensible pieces rather than one giant copy-paste of everything.
2. **Relationships** and **associations** describe **how** those tables connect (one-to-many and many-to-many).
3. **Materialized views** are **optional** ready-made tables: “give me rows at **this** meaning, with **these** columns already filled in.”
4. **Charts** point at **either** a dataset **or** a materialized view—always **one** row meaning per chart.

```text
[ Tables (datasets) ]  --relationships-->  one-to-many paths
       \
        --associations-->  many-to-many (bridge / links between rows)

[ materialize(...) ]  -->  one flat table with a chosen row meaning  -->  charts
```

This does not replace a database. It **organizes** how dashboards see the data so **what one row means** is always clear.

---

## Materialized views: why they matter

### Without a materialized view (only datasets + relationships)

You can still describe the world correctly. Relationships and associations explain the links.

But each chart is tied to **one** dataset. To answer “how much demand per skill by region?” you may need columns from **plans**, **managers**, and **skills** on the **same** row. That either means:

- copying columns into one table by hand, or
- a **hidden** join layer that decides row meaning for you.

Hidden joins are where **wrong totals** and **duplicate rows** show up.

### With a materialized view

You **define** a result table:

- **Row meaning**: for example “one row = one plan **and** one skill on that plan.”
- **Steps**: start from plans, add manager info, then **expand** so each plan appears once per linked skill.

Charts on that view can use simple questions: “count rows, group by skill name.” Everyone agrees: **one row = one plan–skill pair**.

So materialized views are not “because the database cannot join.” They exist because **analytics need a clear, named row type**—and the library wants that definition written **once**, not reinvented for every chart.

### When you **don’t** need a materialized view

- **Questions that use a single table** (for example “how many plans opened per month?”) → use that dataset directly.
- **Adding related columns without changing row meaning** (for example attach manager name to each plan, still one row per plan) → a small materialized view is **optional**; some teams add it when several charts need the same wide row, others wait until that pain appears.
- **Trying things in devtools** is not the same as **shipping** a metric—materialized views matter most when the **same row meaning** is reused across charts or filters.

**Rule of thumb:** add a materialized view when you would otherwise **repeat the same combination of tables and row meaning** in several places, or when **many-to-many links** make it easy to count the wrong thing.

---

## One example (playground-style)

- **Tables:** project plans, managers, skills (as “capabilities” in code)
- **Relationship:** each plan points to one manager.
- **Many-to-many:** a bridge lists which skills each plan needs.
- **View A — plans with manager:** still **one row per plan**, manager fields added → good for **plan-level** summaries (totals per plan).
- **View B — plan × skill:** **one row per plan and skill** → good for **skill** questions (how often each skill appears, by region, etc.).

Using only view B for **plan-level** totals would be wrong (one plan appears on several rows if it has several skills). Using only view A for **skill-by-region** would be wrong (you do not have one row per plan–skill link).  
**Two row meanings → two purposes**—that is intentional.

---

## Why this is a good design

- **Saying what one row means** beats “smart” joins that hide how rows multiply.
- **Clean base tables** plus **named result tables for analytics** usually scales better than one enormous table with everything duplicated.
- **Materialized views** are the **agreement** between your model and your charts: “this is what we mean by one row here.”

If you remember only one thing: **name the row meaning, then attach charts.** Materialized views are how you **name** row meanings that span several tables.
