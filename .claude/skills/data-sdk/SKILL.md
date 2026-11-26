---
name: data-sdk
description: >
  Read and write app data from a screen's loader/action with the data SDK (`~stencil/data`): list, get, create, createMany, update, delete against an entity table, with the table's access rule applied for you. Use in any app built with the generic data SDK — whenever a screen needs rows from the database, a form saves a row, a wizard, importer or seed saves many rows at once, a screen does bulk work over many rows or files ("Add all", "Import", "Copy all photos"), or you write an access rule for `createEntity` / `createEntities`. Not for aggregations or multi-table reports.
metadata:
  agents: [builder]
---
# Data SDK (`~stencil/data`)

One call per read or write, server side only (loaders and actions). The SDK resolves the session, applies the table's access rule, fills the scope column, hides hidden columns, strips every `visible_to` column the caller does not qualify for on that row, and for a visitor with no account also strips `hidden_from_public` columns and `created_by`. You never import `~/generated/db-schema`, `createDb` or drizzle in a screen that uses it, and you never write SQL.

```ts
import { data } from "~stencil/data";

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = await data(request, context.cloudflare.env);          // resolves the session: user or anon
  const tasks = await db.from("tasks").list({ where: { status: "open" }, orderBy: [["createdAt", "desc"]], limit: 50, expand: { project: "projectId" } });
  return { tasks };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = await data(request, context.cloudflare.env, { requireUser: true });   // throws redirect to /login like requireAuth
  const form = await request.formData();
  await db.from("tasks").create({ title: String(form.get("title")), projectId: String(form.get("projectId")) });
  return { ok: true };
}
```

## Surface

- `data(request, env, opts?)` → `DataClient`. `opts.requireUser` defaults to `true`: no session → redirect to `/login`. Pass `{ requireUser: false }` only on a public page.
- `db.me` → the signed-in app user's id, or `null` for an anonymous caller.
- `db.from("<table slug>")` → `{ list(opts?), get(id, opts?), create(data), createMany(rows), update(id, data), delete(id) }`. Table names are the slugs `createEntity` made (`ticket_tiers`), columns are camelCase (`priceCents`). Rows come back camelCase, like drizzle rows — and typed like them (see "Typed rows" below).
- `list` opts: `where` (equality by default: `{ status: "open" }`; or `{ column: { op, value } }` with ops `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `like`, `isNull`, `isNotNull`), `orderBy: [[column, "asc" | "desc"]]`, `limit`, `offset`, `select: [columns]`, `expand: { key: fkColumn }` (one level; the target table comes from the column's relation, or pass `{ column, table }`; the key must not be a column of the table).
- `in` takes a list of any length — every app user's id, every row of an import — as one call: the engine sends the list to the database as a single value, so it never hits the 100-bound-value statement cap. Never slice an id list into lookups of 90, and never loop `get` over ids. `expand` does the same for its target lookups.
- `create(data)` returns the new row. Never send `id`, `createdAt`, `updatedAt` — the engine sets them.
- `createMany(rows)` returns the new rows in input order. It writes the whole list or none of it, split under the database's limit of 100 bound values per statement for you. Use it for every save of more than a handful of rows — a wizard's starter set, a CSV import, a recurring series, seeding — instead of a loop of `create` or a hand-written multi-row insert, which the database refuses once rows × columns passes 100.
- This covers code already in the app. When a build touches a route that slices an id list into lookups of 90–100, loops `get` over ids, or chunks a Drizzle insert by `Math.floor(90 / columnCount)` only to stay under the statement cap, replace it with one `in` filter or one `createMany` over the whole list as part of that build. Leave a slice that exists for the request budget (the "Bulk work beyond one request" shape below) alone.
- Raw SQL has two more fixed limits: an expression may nest at most 100 levels (a `||` / AND / OR chain is one level per operator — join many columns with `concat_ws` or `group_concat`, write a long OR as `IN (…)`), and some built-ins such as `POWER()` and `sqlite_version()` are refused with `not authorized to use function`. Both fail at parse time, on every request, so the statement must change: compute the value in code instead.
- `update(id, data)` returns the updated row; `delete(id)` returns `{ id }`. Both throw `notFound` when the row does not exist or is not visible to the caller.
- `claim(id, data, { where })` is `update` with a condition: the write lands only if the row still matches `where` (the same sugar as `list`) at the moment the database runs it, and it returns the updated row or `null` when it did not. It is the one correct guard for anything that must happen once — see "Claim before a side effect" below.
- Errors are `DataAccessError` with `code` `forbidden | notFound | unknownTable | unknownColumn | invalid`; `isDataAccessError(e)` tells them apart. Let a loader throw — the error boundary renders it. In an action, catch only `isDataAccessError(e)` and return its `message` to the form; rethrow anything else. Never collapse every failure into one "could not save" string — it hides the real cause.
- `system(env)` gives a client with no access rule, for webhooks and crons only. Never in a screen.

## Typed rows — no casts

Every row is typed from the schema at compile time (the same `/home/user/app/app/generated/db-schema.ts` drizzle uses, which you still never import). `db.from("tasks")` only compiles for a table the app has — a typo in the slug is a typecheck error, not a runtime one. Each field has its column's type: a required text column is `string`, an optional one `string | null`, a number column `number | null`, a checkbox `boolean`, a json column `unknown`, and an `expand` key is the target table's row `| null`.

So write `task.title`, never `String(task.title)`; `task.priceCents ?? 0`, never `Number(task.priceCents)`; and never declare a `type Task = { ... }` or cast a row `as Task` — the type is already there. `create()` and `update()` take a subset of the row's own columns: a misspelled column or a wrong value type (`{ done: "yes" }` for a boolean) fails typecheck. Casting form input is different and still needed: `form.get("title")` is `FormDataEntryValue | null`, so `String(form.get("title"))` is right; `String(task.title)` is not.

```ts
const task = await db.from("tasks").get(params.taskId, { expand: { project: "projectId" } });
task.title.trim();                 // string
task.dueDate ?? "no due date";     // string | null
task.project?.name;                // string | undefined — project is the row or null
```

## Five examples

```ts
// 1. List with filter and order
const open = await db.from("tasks").list({ where: { status: "open", projectId: params.id }, orderBy: [["dueDate", "asc"]] });

// 2. Get one row, expanding its parent
const task = await db.from("tasks").get(params.taskId, { expand: { project: "projectId" } });   // task.project is the row or null

// 3. Create from a form (the SDK fills createdBy when the rule says `created_by = me`)
await db.from("projects").create({ name: String(form.get("name")), status: "active" });

// 3b. Save a list at once (an import, a wizard's starter rows) — any length, all or nothing
const saved = await db.from("tasks").createMany(parsedRows.map((r) => ({ title: r.title, projectId })));

// 4. Update — toggle a flag
await db.from("tasks").update(String(form.get("id")), { done: form.get("done") === "1" });

// 4b. Claim — finalise a checkout exactly once; null means another request already did
const checkout = await db.from("checkouts").claim(checkoutId, { status: "used" }, { where: { status: "pending" } });
if (!checkout) return { ok: false, error: "This order was already placed." };

// 5. Delete — a row that references stored files deletes them right after the row goes (`deleteStoredFiles`, see the storage skill)
await db.from("tasks").delete(String(form.get("id")));

// A public read page: anonymous callers allowed, the table's `public` read rule decides what they see
const db = await data(request, context.cloudflare.env, { requireUser: false });
const posts = await db.from("announcements").list({ orderBy: [["publishedAt", "desc"]], limit: 20, select: ["id", "title", "body", "publishedAt"] });
```

## Parse the form before you write

`form.get()` is text the browser chose to send. A `min`/`max` on the input, a `<select>`, a clamp on blur or a disabled button only shapes what an honest person can type; a crafted request carries anything, and a value the action writes unparsed lands in the row and in every average, maximum, report and export built on it. So an action parses the body with `zod` (a template dependency) against the domain the app designed, and writes only the parsed result:

```ts
import { z } from "zod";

const Response = z.object({
  name: z.string().trim().min(1).max(120),
  score: z.coerce.number().int().min(1).max(5),          // the range the survey shows is the range the server accepts
  team: z.enum(["sales", "engineering", "marketing", "hr"]),
});

export async function action({ request, context }: Route.ActionArgs) {
  const db = await data(request, context.cloudflare.env);
  const parsed = Response.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.from("responses").create(parsed.data);
  return { ok: true };
}
```

A parse proves the value is well-formed, not that the browser was entitled to choose it: a value the server already holds or can derive (who the app user is, their plan or price, a counter the app keeps) is never read from the form at all — the template guide's "A fact the server can look up is never taken from the request" has that rule.

And the check that the caller may do this — registered for the session, owns the record, is within their allowance — runs before the write, never after it: a write that lands first stays landed when the check then fails.

## One trip per page, not one per row

The loader shape is in the app guide's "Independent reads run together": `data()` first, then every read whose input is already known in one `Promise.all`, then children in one query per table. With the SDK, `expand` already batches a parent (one extra query for the whole list), and children are one `list` filtered with `in` on the parent ids, grouped in code:

```ts
const tasks = projects.length
  ? await db.from("tasks").list({ where: { projectId: { op: "in", value: projects.map((p) => p.id) } } })
  : [];
```

## What a loader returns is what the reader receives

Everything a loader returns is serialised into the page for whoever opened it; the component hides nothing. So a public page, a share-link page or a page a lower role can open never returns a whole row: it passes `select` with the columns that page shows, and a page two audiences share picks per audience in the loader (`db.me`, `hasRole`), not in JSX. Columns the server grades against (a correct option, an answer key), a passcode or password the screen asks for, invite and share tokens, signing secrets, outside-service tokens, other people's contact details and private notes go in `hidden` (nobody but server code) or `hidden_from_public` (no visitor without an account) on the entity, so a forgotten `select` still cannot ship them — and the action that needs one reads it with `system(env)` after its own check. A column one audience needs and another must not get — the studio's notes and budget on a project the client also opens — goes in `visible_to`, and the same `get` then returns the studio the full row and the client the row without it; no per-audience `select` to remember.

A share link or gallery code is a credential, so resolve it as the server and read as the audience: `system(env)` looks the token up with `select: ["id"]`, then the anonymous client (`requireUser: false`) does `get(id)`, so the page receives exactly what a visitor is declared to receive and never the whole record. The app builder's own visibility choices stored as data — a portal section switched off, a "show budget on the share page" checkbox — are declared once on the entity as `visible_to` with a plain column test (`"budget": ["created_by = me", "share_budget = true"]`), so the row's own stored choice decides what a visitor receives on every read, and a loader that forgets `select` still cannot ship it. A choice that is not a column of the same row (a shared view's column list) becomes that read's `select`; the entity rule is the floor underneath, never the other way round.

## Claim before a side effect

A request that spends a balance, finalises a checkout, redeems a coupon, books a slot, approves or pays out something that was waiting, or counts one use of a per-app-user allowance (free prompts, trial uses, a daily cap) must not read the row, test it in code, act, and write the new state afterwards. Two requests that arrive together — a double-click, a retried redirect, a success page loaded twice, two buyers on one slot, two prompts sent at once — both read the old row, both pass the test and both act: one payment becomes two orders, one balance pays for two purchases, a one-use code redeems many times, one approval inserts two payouts, three free prompts become unlimited. The app builder's own testing never produces two requests at once, so the bug is silent until it costs money. The guard is one conditional write whose result gates the side effect:

```ts
// A held checkout becomes an order, once. The claim is the first write; the order exists only if it won.
const checkout = await db.from("checkouts").claim(id, { status: "used" }, { where: { status: "pending" } });
if (!checkout) return redirect("/orders?already=1");
await db.from("orders").create({ checkoutId: id, totalCents: checkout.totalCents });   // copied from the checkout, never re-priced

// A balance: put the value you read into the condition, so a write that raced you fails instead of overwriting yours.
const wallet = await db.from("wallets").get(walletId);
const coins = wallet.coins ?? 0;
if (coins < price) return { ok: false, error: "Not enough coins." };
const spent = await db.from("wallets").claim(walletId, { coins: coins - price }, { where: { coins: wallet.coins } });
if (!spent) return { ok: false, error: "Your balance changed — try again." };
await db.from("purchases").create({ walletId, itemId });

// A coupon with a use limit: check and count under the same condition.
const coupon = await db.from("coupons").get(couponId);
if (coupon.uses >= coupon.maxUses) return { ok: false, error: "This code has been fully redeemed." };
const counted = await db.from("coupons").claim(couponId, { uses: coupon.uses + 1 }, { where: { uses: coupon.uses } });
if (!counted) return { ok: false, error: "This code was just used — try again." };

// A slot held while the buyer pays: confirm it only if it is still held by this buyer. A hold can lapse while the card page is open.
const booked = await db.from("slots").claim(slotId, { status: "booked" }, { where: { status: "held", heldBy: db.me } });
if (!booked) return { ok: false, error: "That time was taken while you were paying." };

// A status change that creates a dependent record: approve, pay out, mark shipped. The transition is the claim; the record exists only if it won.
const approved = await db.from("jobs").claim(jobId, { status: "approved", approvedBy: db.me }, { where: { status: "awaiting_review" } });
if (!approved) return { ok: false, error: "This job was already reviewed." };
await db.from("payouts").create({ jobId, amountCents: approved.amountCents, status: "ready" });

// A per-app-user allowance (N free uses, then upgrade): count the use before the paid call, under the count you read.
const usage = await db.from("ai_usage").get(usageId);
if (usage.freeUsed >= FREE_USES) return { ok: false, error: "You have used your free suggestions — upgrade for more." };
const used = await db.from("ai_usage").claim(usageId, { freeUsed: usage.freeUsed + 1 }, { where: { freeUsed: usage.freeUsed } });
if (!used) return { ok: false, error: "Still working on your last request — try again in a moment." };
const { text } = await generateText({ model, prompt });   // the AI call runs only once the use is counted
```

Rules that come with it:

- The claim is the first write; the side effect comes after it and only on a returned row. A claim followed by a failed side effect is one thing the app user can retry or the seller can resend; the other order is a duplicate the seller pays for.
- `null` is a normal outcome, not an error: say what happened and stop. Never fall back to `update` after a `null`, and never retry a claim in a loop.
- A page load is a request too. A success or confirmation page that finalises something when it loads claims exactly the same way; a `GET` can arrive twice as easily as a `POST`.
- Copy money from what was charged — the stored checkout's total, or `getBilling` from the `payments` skill — never recompute it at confirmation.
- A hold is not a booking, and a limit checked when a checkout opens is not a use counted. Re-check in the claim at the moment that matters.
- This covers code already in the app. When a build touches a route that spends, approves, pays out or counts a use and finds the read-check-act-write shape there, replace it with a claim as part of that build, even if the request was about something else on the screen.
- Where a loader uses `createDb` instead, the same rule is `UPDATE … WHERE … RETURNING`, or an insert under a deterministic id with `onConflictDoNothing().returning()` — the `recurring-actions` skill shows both.

## Bulk work beyond one request

`createMany` solves the statement cap; it does not make one request able to do unbounded work. A request has ~30 s of CPU, a ~100 MB body and a cap on outbound calls (every database statement, storage read/write and `fetch` counts), and one that runs long is cut off with no response while what it wrote stays written. So anything over a few dozen rows or files is driven from the client in slices, each slice one short request that is safe to repeat.

**Server — a resource route that does one slice** (`app/routes/api.import.tsx`, register `route("api/import", ...)`):

```ts
import type { Route } from "./+types/api.import";
import { data } from "~stencil/data";

// Rows per slice — sized for the request budget (CPU, outbound calls), not the statement
// cap: the `in` filter and `createMany` below take any length. Drop to ~20 when each
// item also copies a file or calls an outside service.
const SLICE = 80;

export async function action({ request, context }: Route.ActionArgs) {
  const db = await data(request, context.cloudflare.env);
  const { rows, cursor, total } = (await request.json()) as {
    rows: { externalId: string; name: string; email: string }[];   // this slice only
    cursor: number;                                                // rows done before it
    total: number;
  };
  if (rows.length > SLICE) return Response.json({ error: `Send at most ${SLICE} rows per request` }, { status: 400 });

  // Repeat-safe: a slice the browser re-sends after a dropped connection skips what already landed.
  const existing = await db.from("contacts").list({ where: { externalId: { op: "in", value: rows.map((r) => r.externalId) } }, select: ["externalId"] });
  const seen = new Set(existing.map((r) => r.externalId));
  const fresh = rows.filter((r) => !seen.has(r.externalId));
  await db.from("contacts").createMany(fresh);       // all of this slice or none of it; a refused write throws → 500, never a false "ok"

  const processed = cursor + rows.length;
  return Response.json({ done: processed >= total, nextCursor: processed, processed, total });
}
```

**Client — the loop with progress and a Stop button:**

```ts
async function importAll(
  rows: ParsedRow[],
  onProgress: (processed: number, total: number) => void,
  signal: AbortSignal,                              // from an AbortController the Stop button aborts
): Promise<{ processed: number; total: number }> {
  const total = rows.length;
  let cursor = 0;
  while (cursor < total) {
    if (signal.aborted) break;
    const slice = rows.slice(cursor, cursor + 80);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: slice, cursor, total }),
      signal,
    });
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      throw new Error(`Stopped after ${cursor} of ${total}: ${error ?? "the server refused this batch"}`);
    }
    const out = (await res.json()) as { done: boolean; nextCursor: number; processed: number; total: number };
    cursor = out.nextCursor;
    onProgress(out.processed, out.total);
    if (out.done) break;
  }
  return { processed: cursor, total };
}
```

Render `processed / total` on a `<Progress>` and as text ("160 of 450 imported"); on a thrown error show its message and keep the count — what landed stayed landed, and pressing Import again resumes because each slice is repeat-safe. The same shape serves every bulk screen: for "Copy all photos" the slice is a list of source keys and the server copies at most ~20 per request; for "Send to everyone" it is a list of recipient ids with a per-recipient sent marker as the repeat guard (see the `recurring-actions` skill's claim rule).

Rules that come with it:

- Never post the whole file or the whole list in one request, and never `for … await fetch()` over the items inside one action — both are the plain loop that dies on a real list.
- Never a hard-coded "batch of 20 rows" into a Drizzle insert — `createMany` sizes statements from the column count; a fixed row count is the statement cap again on a wider table.
- A slice that fails fails loudly: the action lets the error propagate (or returns a 4xx with a message), the client stops and shows it. Catching and returning `{ ok: true }` over a refused write is what makes app users blame their file.
- Hundreds of file copies or outside calls that must all happen with nobody waiting is not a screen's job; say so to the app builder instead of making the loop longer.

## Access rules (the `access` input of `createEntity`)

When the brief says people share data (a team, a workspace, a class), the membership table must carry the app user's id (`user_id`) — a name and an email are not an identity the rule can check. The signed-in app user is always `me`.

An object with `read`, `create`, `update`, `delete` — each a list of conditions, any one satisfied is enough; a missing key or empty list means nobody — and three optional column policies: `hidden`, columns app users never see or write (only `system(env)` reads them); `hidden_from_public`, columns stripped from every read by a visitor with no account; and `visible_to`, an object mapping a column to the conditions (same grammar as a rule line, no hops) a caller must meet on a row to receive it — everyone else gets the row without that column, cannot filter, sort or expand on it, and cannot write it. A visitor with no account is judged only by a line made of plain column tests (`share_visible = true`, `status != 'draft'`); a line naming `me` or `me.role` never holds for a visitor, `hidden_from_public` still wins, and whether the visitor can read the row at all is the `read` rule's `public` line, never `visible_to`. `created_by` is always hidden from a visitor. `"private"` is the one shorthand: all four actions `["created_by = me"]`.

A column that holds a key an app user pasted for an outside service (an API key, token, client secret or password for another site) is always `hidden`, and its value is always sealed: the action calls `seal(env, value)` from `~stencil/secrets` and writes the result through `system(env)` (a hidden column rejects app-user writes), and only the server code that calls the service reads it back with `unseal`. A loader never selects it; the screen shows "connected" or a last-four the action stored beside it.

```ts
import { data, system } from "~stencil/data";
import { seal, unseal } from "~stencil/secrets";

// Save an app user's pasted key: sealed, into a hidden column, scoped to the caller by hand
// (a system write fills no scope column)
const env = context.cloudflare.env;
const db = await data(request, env);
const key = String(form.get("apiKey"));
await system(env).from("quo_connections").create({ createdBy: db.me, apiKeySealed: await seal(env, key), keyLastFour: key.slice(-4) });

// Use it later, server side only — never in a loader that returns the row (apiKeySealed is a required text column)
const row = await system(env).from("quo_connections").get(id);
const apiKey = await unseal(env, row.apiKeySealed);
```

```
condition := "anyone" | "public" | "nobody" | clause ( " and " clause )*
clause    := column op value | column " in " table "." column " where " simple ( " and " simple )*
           | "me.role" ( "=" | "!=" ) 'role' | "me.role in" "[" 'role' ("," 'role')* "]"
op        := "=" | "!=" | "<" | "<=" | ">" | ">=" | "in"
value     := "me" | number | "true" | "false" | "null" | 'quoted string' | "[" value ("," value)* "]"
```

`anyone` = any signed-in app user. `public` = unauthenticated callers too (read only). `nobody` = server code only. `me` = the signed-in app user's id; `me.role` = the role the app builder gave them on the Users page (`admin`, or any name they typed; `user` when none), the one other way to name the caller. Never add a role column of your own for this (see the `app-roles` skill). An admin screen that must read every app user's rows needs no `system(env)`: a read line `me.role = 'admin'` lets the admin read every row through the ordinary client, and `visible_to` can give a column to the admin alone — the same role lookup the `app-roles` helpers use. Columns may be snake_case or camelCase and must exist on the table (`id`, `created_at`, `updated_at` count). One hop only, no nesting.

Four worked rules:

```json
// Private tasks, also visible to whoever they are assigned to
{ "read": ["created_by = me", "assigned_to = me"], "create": ["created_by = me"], "update": ["created_by = me", "assigned_to = me"], "delete": ["created_by = me"] }

// Public announcements: anyone can read, only server code writes (an admin screen uses system(env))
{ "read": ["public"], "create": ["nobody"], "update": ["nobody"], "delete": ["nobody"], "hidden_from_public": ["author_email"] }

// Team-scoped tasks where members are APP USERS: give the membership table a `user_id` column that holds the
// app user's id, then hop through it. Team admins (a `role` column on the membership row) may edit any task.
{ "read": ["team_id in team_members.team_id where user_id = me"], "create": ["team_id in team_members.team_id where user_id = me"], "update": ["created_by = me", "team_id in team_members.team_id where user_id = me and role = 'admin'"], "delete": ["team_id in team_members.team_id where user_id = me and role = 'admin'"] }

// Comments on a project: readable and writable by the project's owner (one hop), author-only edits, moderation notes hidden
{ "read": ["created_by = me", "project_id in projects.id where owner_id = me"], "create": ["created_by = me and project_id in projects.id where owner_id = me"], "update": ["created_by = me"], "delete": ["created_by = me"], "hidden": ["moderation_notes"] }

// A public quiz: anyone reads the questions, the server alone reads the key (the grading action uses system(env))
{ "read": ["public"], "create": ["nobody"], "update": ["nobody"], "delete": ["nobody"], "hidden": ["correct_option", "explanation"] }

// A studio's projects, also opened by the client they are for: the client reads the row but never the studio's notes, budget or invite link;
// the owner and anyone with the studio or admin role get them. One rule, no per-audience select in any loader.
{ "read": ["created_by = me", "client_id = me", "me.role in ['admin', 'studio']"], "create": ["created_by = me"], "update": ["created_by = me", "me.role = 'admin'"], "delete": ["created_by = me"], "visible_to": { "internal_notes": ["created_by = me", "me.role in ['admin', 'studio']"], "budget": ["created_by = me", "me.role in ['admin', 'studio']"], "invite_token": ["created_by = me"] } }
```

## What the SDK does for you

- Scope fill: `create()` sets `createdBy` to the caller whenever the table has a `created_by` column, and also fills any column a `create` rule line compares to `me` (`workspace_id = me`, say). Never pass `createdBy` yourself. No `requireAuth` + `eq(t.createdBy, user.id)` boilerplate.
- Rule verification: every `list`/`get` carries the table's read rule; `create`/`update`/`delete` are checked against the rule before they run. A request that does not satisfy the rule is rejected, never silently filtered.
- Hidden columns are stripped from results, refused in `select`, `where`, `orderBy` and `expand`, and rejected on write. For a visitor with no account the same applies to `hidden_from_public` columns; `created_by` is stripped from that visitor's results too, though a public page may still filter by it. A `visible_to` column is decided per row and per caller — present when the caller meets one of its conditions on that row, absent otherwise, on `list`, `get` and every `expand`ed row — and a caller who meets them only on some rows may `select` it but not filter, sort or expand on it. The role behind `me.role` is read once per `data()` call, only when a rule uses it. Booleans come back as `true`/`false`, json columns parsed.
- A table with no access rule is `nobody`: every call from a screen fails. Give every entity a rule at `createEntity`.

## When NOT to use it

- Searching records by word or meaning: `searchRecords` / `nearestRecords` from `~stencil/records` in their own `createDb` loader, scoped by the same condition the access rule expresses (load the `record-search` skill). The SDK's `like` filter is a plain substring test with no ranking, and its pattern is capped at about 50 bytes, so a long prefix fails at runtime.
- Aggregations (`count`, `sum`, `group by`), multi-table reports, joins deeper than one `expand`, or anything the `list` options cannot say: write a normal loader with `createDb` from `~stencil/db` and drizzle against `~/generated/db-schema`, scoped by `requireAuth` the way the Database section of the app's CLAUDE.md shows. Keep that loader in its own route file; do not mix the two in one screen.
- Trusted server work (webhooks, crons, seeding): `system(env)`, not a user client.
