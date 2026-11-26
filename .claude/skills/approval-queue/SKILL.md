---
name: approval-queue
description: >
  Approve what app users submit or earn before it goes live — "I want to approve every
  listing / profile / event / post / recipe before it shows", "hold new submissions for
  review", "pending until I approve", "moderation queue", "flag for admin review", "a rule
  that rejects posts with a reason", "the badge is awarded only after I check it", "seller
  verification before the store shows", "notify them when I approve". One fixed shape every
  time: a status column on the entity, an access rule that hides pending rows, one review
  queue in the admin area with Approve and Reject, a count waiting in the nav, and a notice
  to the app user. Load BEFORE adding a status column, a review page or a content filter, with
  `admin-area`, `app-roles`, `data-sdk` and `in-app-notifications`. Not for the Chat Agent's
  own build approval, and not for a buyer's payment hold (`payments`).
metadata:
  agents: [chat, builder]
---

# Approval queue: pending, review, approve or reject, notify

Whatever is gated — a listing, a profile, a hosted event, a post, a recipe, an RSVP, a seller's
store, an earned rank, a course checkpoint — the app gets the same five pieces. Never invent a
per-entity variant: the second gated table in an app reuses every piece of the first.

**The invariant:** a pending or rejected row is never served to a public or app-user read path
other than its author's own, is always served to the reviewer, and changes state exactly once.

## 1. The status column

The gated entity carries three columns, no separate review table:

| column | type | meaning |
|---|---|---|
| `status` | select, options `pending`, `approved`, `rejected` | the gate |
| `review_note` | text, nullable | the reason given on reject, shown to the author |
| `reviewed_at` | datetime, nullable | when the decision was made |

The submit action writes `status: "pending"` itself and never reads it from the form. The
author's edit action never writes `status` either; by default an edit sends the row back to
`pending`, since an approved row changed afterwards is unreviewed content. Say so in the build
summary, and keep approved rows editable only when the brief asks for it.

Something **earned** (a rank, a badge, a certificate, a level) is a row the computation creates
as `pending` instead of granting; the celebration screen and the award itself key off
`approved`, never off the computation. A **storefront or profile held until verified** is the
same column on the seller or profile row, with the public page filtering on it.

## 2. The access rule

```json
{ "read": ["status = 'approved'", "created_by = me", "me.role = 'admin'"],
  "create": ["created_by = me"],
  "update": ["created_by = me", "me.role = 'admin'"],
  "delete": ["created_by = me", "me.role = 'admin'"],
  "visible_to": { "review_note": ["created_by = me", "me.role = 'admin'"] } }
```

For a signed-in app user the rule does the hiding: every ordinary `list`/`get` returns approved
rows, the caller's own rows in any state, and everything for an admin. No loader for app users
needs a status filter to be safe. **A visitor with no account is different:** a `public` read
line grants every row and a plain column line never restricts a visitor, so a public page
(`data(request, env, { requireUser: false })`) passes `where: { status: "approved" }` on every
read of a gated table, and the rule adds `"public"` to `read` plus `"hidden_from_public":
["review_note"]`. A build that adds a public read of a gated table later adds that `where`.

## 3. The review queue, in the admin area

One route for the whole app, `app/routes/app.admin.review.tsx` at `admin/review`, registered as
a child of `app` and gated like every admin file (`admin-area`): `requireRole(request, env,
"admin")` first in loader and action, then `system(env)`. Never a queue page per table and
never a queue outside `/app/admin`.

- **Loader:** per gated table, `list({ where: { status: "pending" }, orderBy: [["createdAt", "asc"]], expand: ... })` — oldest first, no `limit`. Also return each table's approved and rejected rows from the last 30 days under a "Recent decisions" heading, so a decision can be checked.
- **Screen:** one `SectionHeading` per gated table with its count, each pending row a `Panel` showing the submission itself (the display name, its text, its image or file, who sent it and when — enough to decide without opening another page), a link to the row's admin detail page, an **Approve** button and a **Reject** button that reveals a reason `<Textarea>` before posting. `<EmptyState>` "Nothing waiting for review" when all sections are empty.
- **Action:** `intent=approve|reject`, `table`, `id`, `note`. The transition is a claim, so two clicks or two admins decide once:

```ts
const row = await db.from(table).claim(id, {
  status: intent === "approve" ? "approved" : "rejected",
  reviewNote: intent === "reject" ? String(form.get("note") || "") || null : null,
  reviewedAt: new Date().toISOString(),
}, { where: { status: "pending" } });
if (!row) return { ok: false, error: "This item was already reviewed." };
await createNotifications(env).send({
  toUserId: row.createdBy,
  title: intent === "approve" ? "Your listing was approved" : "Your listing was not approved",
  body: intent === "approve" ? "It is now visible to everyone." : (row.reviewNote ?? "Open it to see what to change."),
  link: `/app/listings/${row.id}`,
});
```

`table` comes from a fixed list of the app's gated slugs, never from the request as-is. The
notice is one `send()` from the `in-app-notifications` store (wire the bell if the app has none);
add email through `~stencil/email` only when the brief asks.

## 4. The count waiting, in the nav

The admin nav entry is "Review" at `/app/admin/review`, shown only when `admin` is true in the
layout loader (`shell-writer` rule), with a badge of the pending count summed over the gated
tables: `system(env).from(t).list({ where: { status: "pending" }, select: ["id"] })` per table,
`.length` each, computed only for an admin. The admin index page lists the queue first.

## 5. What the author sees

On the author's own list and detail screens, a status badge: "Awaiting review", "Approved",
"Not approved" with `reviewNote` under it and an Edit action that resubmits. A rejected or
pending row never shows in anyone else's list, feed, map, gallery or search, and is never counted
in public totals (an "approved artists" stat counts `status = 'approved'`).

## Automatic rejection (a rule, not a person)

When the brief wants a rule that blocks at submit time (banned words, a restricted category, an
AI moderation check via `ai-sdk`), the submit action runs the rule and writes `status:
"rejected"` with the reason in `reviewNote`, then returns the reason to the form so the author
sees it at once. Anything the rule only *suspects* is written `pending` and lands in the same
queue; never a second queue for flagged items. App users reporting content is a `reports` table
whose admin list links into the same review route.

## What to tell the app builder

Where the queue is (Admin → Review, `/app/admin/review`), which tables it gates, that new
submissions are hidden until approved, and that on the Published app they open it with their own
account after setting its Role to Admin on Project settings → Grow → Users (`app-roles`, section
4). Never report a queue with Approve but no Reject, a queue with no notice to the author, or a
gated table whose public page still lists pending rows, as done.

## In chat

"I want to approve all X before they show", "hold new Y until I check them", "can I review
posts first": if the app has `app.admin.review.tsx` covering that table, answer with the Admin →
Review path. Otherwise it is a build: hand it to the Builder Agent as "add approval to <table> in
the approval-queue shape", naming the table and whether rejection needs a reason.
