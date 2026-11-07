# Ingest Pipeline: Rewrite or Patch?

**Status: draft for review** — owner: platform team · target decision: Nov 14

The nightly ingest job has failed on 6 of the last 30 runs. This note lays out what is
actually breaking, the two options on the table, and what each one costs. It is not a
recommendation yet; the point of circulating it is to find out which failure mode people
care about most.

---

## What is breaking

Three distinct failures are being reported as one "ingest is down" alert, which is part of
why this has dragged on:

1. **Schema drift.** Upstream adds a column, our loader rejects the whole batch. Four of the
   six failures. Recoverable by hand in about 20 minutes.
2. **Memory ceiling.** A single oversized partition pushes the worker past its limit and the
   pod is killed. Two failures. Not recoverable without a config change.
3. **Silent truncation.** Not in the six — we only found it reading the row counts. This one
   worries me more than the other two, because nothing alerts on it.

> The third case is the argument against patching. A loader that fails loudly is annoying.
> A loader that quietly drops 4% of rows is a correctness problem, and we have no idea how
> long it has been happening.

### How often, and how bad

| Failure | Runs affected | Rows lost | Time to recover |
| --- | --- | --- | --- |
| Schema drift | 4 | 0 | 20 min |
| Memory ceiling | 2 | 0 | 90 min |
| Silent truncation | unknown | ~4% | not detected |

The "unknown" in the last row is the number we should be most uncomfortable with.

## Option A — patch the current loader

Add a tolerant schema mode, raise the memory limit, and add a row-count assertion at the end
of each run. Roughly two weeks of work, most of it in the assertion, because the current
loader has no single place where a run is known to be complete.

- Keeps the deployment story unchanged
- No migration, no backfill, no coordination with downstream consumers
- Does *not* fix the architecture that made silent truncation possible
- The row-count assertion is the only piece that addresses case 3, and it detects the problem
  rather than preventing it

## Option B — rewrite on the streaming runtime

Six to eight weeks. Replaces the batch loader with incremental commits, so a partial run is
visible as a partial run instead of a complete one. Schema changes become additive by default.

```python
# the property that matters: a run is either committed or it isn't
with pipeline.transaction() as tx:
    for partition in source.partitions():
        tx.append(partition)        # bounded memory, one partition at a time
    tx.commit(expect_rows=source.row_count())
```

The `expect_rows` check is the same assertion as in Option A, except the runtime enforces it
instead of a script we remember to run. That difference is most of the argument for B.

### What a rewrite also drags in

Backfilling 14 months of history, a dual-write period of two to three weeks, and a migration
for the four downstream consumers that read our output tables directly. The dual-write period
is where I expect the real cost to show up, and it is the part I have estimated least well.

## Open questions

1. Is a 4% silent loss tolerable for one more quarter? If yes, A is clearly correct.
2. Who owns the downstream migration? It is not obviously our team's work.
3. Does the streaming runtime handle the `<legacy>` format at all? Nobody has tested it, and
   AT&T's feed is still on it.

## What I need from reviewers

Push back on the estimates, especially B's dual-write window. And if you have seen the
truncation case in your own dashboards, say so — right now it is one person's observation and
a row count, which is thin evidence for a six-week project.
