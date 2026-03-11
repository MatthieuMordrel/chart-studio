# How The Core Works

This file explains the headless part of `chart-studio`.

## What "core" means

The core is everything that works without the UI package.

Its main pieces are:

- column inference plus optional hints
- the `useChart()` hook
- the transformation pipeline
- shared chart types

The core does not render controls or charts. It only manages state and produces chart-ready data.

## The basic flow

The normal flow is:

1. You pass raw data into `useChart({data, columnHints?})`.
2. The hook infers columns from that data and optional hints.
3. The hook stores user state such as chart type, x-axis, group by, filters, and date range.
4. The hook derives transformed data from the raw rows.
5. You either render your own UI or pass the chart instance to the optional UI package.

## Inferred columns are the contract

The resolved columns tell the library what each field means.

- `date` columns can be used for time-series x-axes and date range logic
- `category` columns can be used for x-axis, group by, and filters
- `boolean` columns can be used for group by and filters
- `number` columns can be aggregated as metrics

This is the core idea: the library infers a schema from raw data, then lets `columnHints` override labels or types when needed.

## What `useChart()` does

`useChart()` is the main engine.

It owns:

- active source
- chart type
- x-axis
- group by
- metric
- time bucket
- filters
- sorting
- date range state

It also computes:

- valid chart types for the current state
- available metrics
- available filters
- available date columns
- transformed data
- series metadata

So `useChart()` is both:

- a state container
- a derived-data builder

## How the pipeline works

The pipeline turns raw rows into data a chart renderer can use.

High level steps:

1. Start from raw rows.
2. Apply filters.
3. Resolve the x-axis.
4. Bucket dates if needed.
5. Group rows if `groupBy` is active.
6. Aggregate the metric.
7. Sort the final points.
8. Return `transformedData` and `series`.

The important point is that the pipeline is pure. It does not manage React state. It only transforms input into output.

## Single-source vs multi-source

Single-source:

- one dataset
- one column schema
- strongest typing

Multi-source:

- several datasets
- active source can change
- each source infers its own schema
- runtime state still has to be sanitized on source changes

## What the core returns

`useChart()` returns one `chart` object.

That object contains:

- current selections
- setter functions
- available options for the current state
- raw data
- active columns
- transformed data
- series definitions

That `chart` object is the bridge between the headless logic and whatever UI you want to build.

## Why this design is useful

Because the core stays reusable.

You can:

- build your own controls
- use another charting library
- use the built-in UI package
- test behavior without rendering the full UI

In short: the core decides what the chart means, but not how it looks.
