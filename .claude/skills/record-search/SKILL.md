---
name: record-search
description: Searching an app's own records — a search box over contacts, posts, lessons, products or any other entity — by word (`searchRecords`) and by meaning (`nearestRecords`, embeddings). Load before building any search, find, filter-by-text or "related items" feature over data the app stores. Not for the open web (that is the `web-search` skill).
metadata:
  agents: [chat, builder]
---

# Searching the app's own records (`~stencil/records`)

Two server-side calls, both over the **whole table**, both returning ranked rows. Never search by filtering the rows a page already loaded — that caps results at one page and gives no ranking — and never use `createSearch` (`~stencil/search`) for the app's own data: that searches the public internet.

```ts
import { eq } from "drizzle-orm";
import { createDb } from "~stencil/db";
import { searchRecords, nearestRecords } from "~stencil/records";
import { lessons } from "~/generated/db-schema";
import { requireAuth } from "~stencil/auth/server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchRecords(db, lessons, q, {
    where: eq(lessons.createdBy, user.id),   // the same scope the list loader uses
    in: [lessons.title, lessons.body],       // optional: defaults to every text column
    limit: 20,
  });
  return { results };                        // each row carries `score`
}
```

## Word search — `searchRecords(db, table, query, opts?)`

- Every word of the query must appear, case-insensitively, in at least one searched column; rows are ranked (a column that *starts with* the word outranks one that merely contains it) and come back with `score`.
- `in` picks the columns; without it, every text column except ids, timestamps and `created_by` is searched. `where` is the scope filter — always pass the one the table's list loader uses. `limit` defaults to 50; `offset` pages.
- An empty or whitespace query returns `[]`, so the search box can submit freely.
- It is substring matching with ranking, not a text index: a prefix of a word matches ("moth" finds "Mothman"), a misspelling does not.
- The result adds `score` to each row (and `nearestRecords` adds `similarity`), so an entity must not have a column with that name — call a quiz result `points` or `total`, not `score`. Both calls throw if the table has one.

## Meaning search — `nearestRecords(db, table, vector, opts)`

Finds the rows whose stored embedding is closest to a query embedding (cosine similarity), best first, each with `similarity`. The compare runs in the worker over every in-scope row that has an embedding — fine for up to a few thousand rows.

Three parts, all in the app:

1. **A json column for the embedding** — `createEntity` with a field like `embedding` of type `json`, hidden from forms. Keep it beside the row, never in a separate table.
2. **Fill it on every write.** In the create *and* update actions, embed the text the search should match and save it with the row. An embedding written once at import and never refreshed goes stale as rows are edited.
3. **Query with the same model.**

```ts
import { embed } from "ai";
import { createAI } from "~stencil/ai";

const ai = createAI(context.cloudflare.env);
const embedding = async (text: string) =>
  (await embed({ model: ai.textEmbeddingModel("openai:text-embedding-3-small"), value: text })).embedding;

// on create / update
await db.insert(lessons).values({ ...fields, embedding: await embedding(`${title}\n${body}`) });

// in the search loader
const near = await nearestRecords(db, lessons, await embedding(q), {
  column: lessons.embedding,
  where: eq(lessons.createdBy, user.id),
  limit: 10,
});
```

Use meaning search when a paraphrase should still find the record ("spooky forest creature" → Mothman). Use word search for names, codes and exact phrases. For one box that does both, run `searchRecords` first and fall back to `nearestRecords` when it returns nothing.

## Apps built with the data SDK (`~stencil/data`)

The SDK has no search call. Put the search in its own loader with `createDb` and the two calls above, scoped by the same condition the entity's access rule expresses — the rule is not applied for you here.
