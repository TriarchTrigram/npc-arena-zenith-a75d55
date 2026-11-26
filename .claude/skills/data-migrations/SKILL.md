---
name: data-migrations
description: >
  The procedure for a one-off change to rows the app already has, run with dbExecute during a
  build: renaming a status or tier across every record, backfilling a new column, re-keying
  records, moving values between columns, deleting a set of rows. Load it before you write the
  first statement whenever a request changes more than one existing row. Covers writing a
  column-scoped UPDATE, the dry run and the app builder's confirmation, the restore point, the
  post-write check, and what to say when it fails. Not for a save handler in app code — that is
  `data-safe-saves` — and not for seeding an empty table.
allowed-tools: dbExecute describeSchema
metadata:
  agents: [builder]
---

# One-off data migrations

A bulk change runs against the app's live database — the Published app's data, not a copy.
A statement that rewrites rows whole blanks every column it did not supply, the agent reports
success, and the loss surfaces weeks later when an app user asks where their profile went.
These rules are mandatory for every statement that changes existing rows.

## Rule 1 — Write only the columns the request names

An `UPDATE` sets exactly the columns the app builder asked to change, and nothing else.
"Rename the Pro tier to Beta" touches `tier`, and `updated_at` if the table keeps one.

```sql
-- GOOD — column-scoped; every other column of these rows is left as it was
UPDATE speaker_profile SET tier = 'beta', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tier = 'pro';
```

Never rebuild a row from a partial picture of it. These shapes are refused by `dbExecute`
and there is no confirmation that lets them run:

- `REPLACE INTO` / `INSERT OR REPLACE INTO` a table that has rows — a colliding id is
  rewritten whole, and every column the statement did not carry is gone.
- `DELETE FROM t …` followed by `INSERT INTO t …` in the same call — the same rewrite in two
  steps.

To add rows where some ids may exist, use `INSERT … ON CONFLICT(id) DO UPDATE SET <the
columns you mean to change>`. To change rows, use `UPDATE`.

Read the real column names with `describeSchema` first; never guess them.

## Rule 2 — Dry run, then the app builder's say-so

`dbExecute` counts the rows each `UPDATE` or `DELETE` scopes before anything runs. A change
that touches many live rows — no `WHERE`, every row of a table, or more than 50 rows in one
table across the call — comes back as `{ confirmationRequired, held }` and has not run.
Each `held` entry carries the table, `affectedRows` of `totalRows`, and for an `UPDATE` the
`columns` it writes.

Before you ask, check the plan against the request: if `columns` lists anything the app
builder did not ask to change, fix the statement — do not ask them to confirm it. Then tell
them in plain words what will happen ("This changes `tier` on 30 of 34 speaker profiles"),
ask, and end the turn. Only when they have confirmed that exact change in their own words,
run the same statements again with `confirmed: true`. Never split a held change into smaller
calls to get under the limit, and never set `confirmed` on your own judgement.

## Rule 3 — The restore point

Before a call that changes or deletes existing rows runs, `dbExecute` records the database's
Time Travel bookmark and returns it as `restorePoint`. It is also written to the build's
event log, where the Stencil team can read it. A bad migration is reversible by a person
within 30 days — only if they know to look.

So say it in the reply that ends the turn: one line that a restore point was saved before
the change, with the table and the time. Do not paste the bookmark itself; the app builder
cannot use it, and the build log has it.

A bulk change whose restore point could not be captured does not run. Do not work around
that by splitting the change; say that the restore point was unavailable and try once more
in the next turn.

## Rule 4 — The post-write check

After the statements run, `dbExecute` compares the columns each `UPDATE` did not name on the
rows it scoped against their state before. If any of them changed, the result comes back
with `changed` — table, column, and the before/after counts — and the step is a failure
however the statements themselves reported.

When that happens: stop. Run nothing more against that table, do not retry, and do not
describe the turn as done. Tell the app builder plainly which table and columns were
affected and that a restore point from just before the change exists for the Stencil team
to restore. Then end the turn.

## Checklist before any statement over existing rows

- [ ] Does every `UPDATE` set only the columns the request names (plus `updated_at`)?
- [ ] Is there a `REPLACE`, `INSERT OR REPLACE`, or a `DELETE` then `INSERT` on the same table? → rewrite as `UPDATE` or `ON CONFLICT DO UPDATE`.
- [ ] Did the dry run come back `held`? → check `columns` against the request, ask the app builder, end the turn.
- [ ] Did the reply mention the restore point?
- [ ] Did the result carry `changed`? → stop and report; never continue.
