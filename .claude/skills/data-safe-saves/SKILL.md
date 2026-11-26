---
name: data-safe-saves
description: Save/update semantics that prevent silent data loss. Apply whenever building or modifying ANY save, update, edit, or bulk-import flow — form submits, editor sheets/modals, settings pages, CRUD actions, admin panels, CSV/file importers, wizards and seeds that save a list — that writes database rows, and whenever one record references another. Covers partial updates, explicit-removal flags, upserting child collections by id, linking by stable id instead of name/title, and saving many rows at once without the database refusing the write.
allowed-tools: queryRecords
metadata:
  agents: [builder]
---

# Data-Safe Save Semantics

A save handler that overwrites whole rows with form state **silently destroys
data**. The form never carries every column — anything it doesn't render (a
video URL uploaded last week, a field added by a later feature) gets nulled the
moment the user saves an unrelated edit. The user experiences this as "my data
randomly disappeared." These rules are mandatory for every write path.

## Rule 1 — Only write what the form manages

A save action must update ONLY the columns its form actually edits. Never build
a `values` object that maps every column from `form.get(...)` and write it
wholesale.

```ts
// BAD — empty form fields erase stored values on every save
await db.update(products).set({
  title: String(form.get("title") ?? ""),
  videoUrl: (String(form.get("videoUrl") ?? "") || null),  // wipes the video
  coverUrl: (String(form.get("coverUrl") ?? "") || null),  // wipes the cover
}).where(eq(products.id, id));

// GOOD — build the patch from fields the form explicitly submitted
const patch: Partial<typeof products.$inferInsert> = { updatedAt: now };
if (form.has("title")) patch.title = String(form.get("title") ?? "").trim();
if (form.has("videoUrl") && String(form.get("videoUrl"))) patch.videoUrl = String(form.get("videoUrl"));
await db.update(products).set(patch).where(eq(products.id, id));
```

## Rule 2 — Clearing a value must be explicit, never implicit

An empty form field is NOT a request to delete the stored value — it usually
means "the form state didn't have it" (failed upload, stale editor, untouched
field). Give the UI an explicit removal control that submits a flag, and only
null the column when that flag is present:

```ts
if (form.get("videoRemoved") === "1") patch.videoUrl = null;
else if (String(form.get("videoUrl") ?? "")) patch.videoUrl = String(form.get("videoUrl"));
// otherwise: leave the stored value alone
```

## Rule 3 — Upsert child collections by id; never delete-and-reinsert

Rewriting a child table ("lessons", "items", "sections") by deleting all rows
and reinserting from the form destroys every column the form didn't serialize —
and breaks foreign keys and stable ids.

```ts
// BAD — wipes lessons.videoUrl (and any future column) on EVERY save
await db.delete(lessons).where(eq(lessons.productId, id));
await db.insert(lessons).values(parsed.map(...));

// GOOD — the form submits each row's existing id; upsert by id
// 1. delete only rows whose ids are no longer in the submitted set
// 2. update title/order in place for existing ids (untouched columns survive)
// 3. insert only genuinely new rows
```

## Rule 4 — Link records by stable id, never by name or title

Resolving relationships by matching `title`/`name`/`slug` means a rename
silently severs the link ("my video isn't in the library anymore"). Store the
foreign id. If a legacy fallback on names is unavoidable, make it
trim/case-insensitive and comment that renames can break it.

## Rule 5 — A failed upload must not become a delete

If a file upload fails, keep the previous stored reference in the form state
and surface the failure prominently. Otherwise the user saves, Rule-1-violating
code writes the empty value, and the old file reference is gone.

## Rule 6 — Save a list in one call, and let a rejected write fail the request

The database refuses any statement that binds more than 100 values, so a
whole-file insert saves nothing once `rows × columns` passes 100. Never write
the chunking yourself: save a list with `db.from("<table>").createMany(rows)`
from `~stencil/data`, which splits it under the cap and writes all of it or
none. If the app does not use `~stencil/data`, follow the CLAUDE.md rule
"Never bind more than 90 values in one statement" for the Drizzle chunking.

Either way, a rejected write must fail the action. An importer that reports
"imported 200 rows" over a write the database refused is indistinguishable from
a bad file, and every per-row lookup it made beforehand is paid for again on the
retry. Never swallow the error, and never blame the app user's file for it.

## Checklist before finishing any save/edit feature

- [ ] Does the action write any column the form does not render? → stop, patch only.
- [ ] Can an empty/failed form state null a stored value? → require an explicit removal flag.
- [ ] Does any child table get delete-then-reinsert on save? → upsert by id.
- [ ] Is any record linked by title/name? → link by id.
- [ ] Does any action save a list of rows? → `createMany` (or the CLAUDE.md Drizzle chunking), and a rejected write fails the action.
- [ ] Simulate: open editor → change ONE field → save → verify every other field survived in the DB.
