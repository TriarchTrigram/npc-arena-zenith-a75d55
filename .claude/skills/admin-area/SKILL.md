---
name: admin-area
description: >
  The app builder's back office — "admin area", "admin panel", "back office", "a dashboard
  where I manage my clients and projects", "a place to edit everything", "CMS", "control
  panel", "I can't find my admin", "how do I edit a record", "open the detail page". One
  fixed shape every time: an Admin nav entry, a list per managed table, a detail page per
  record with every field editable, and relations shown as links in both directions. Load
  BEFORE planning or writing any admin screen, together with `app-roles` (which owns the
  gate and who may enter). Not for Stencil's own records browser in More.
metadata:
  agents: [chat, builder]
---

# The admin area: one shape, every app

An app builder who asks for an admin area, back office or "where I manage things" gets the
same thing every time, so they always know where it is and what it can do:

1. **One nav entry, "Admin"**, at `/app/admin`, shown only to an admin.
2. **A list per managed table** at `/app/admin/<table>` — every row, newest first, each row a
   link to its detail page, a "New" sheet.
3. **A detail page per record** at `/app/admin/<table>/:id` — every editable field in a form,
   Save, Delete.
4. **Relations as links, both ways** — a column that points at another record shows that
   record's name as a link to its detail page; a detail page lists every record in other
   tables that points back at it, each a link.

Anything less — a list with no way to open a row, a detail page with a bare id where a
related record should be, an admin route no nav entry reaches — is the admin area the app
builder could not find. `app-roles` owns who may enter (`requireRole`, the Users page); this
skill owns what is behind the door.

**Waitlist and email sign-ups are not a managed table.** They live on the platform waitlist,
which app code can add to but cannot read, and the app builder sees them in More → Users.
Never create a sign-ups table to give them an admin list; say where they are.

## Routes and files

Flat route files under `app/routes/`, registered as children of `app` in `app/routes.ts`:

| file | route | what it is |
|---|---|---|
| `app.admin._index.tsx` | `admin` | one panel per managed table: name, row count, link to its list |
| `app.admin.clients.tsx` | `admin/clients` | the list for `clients` |
| `app.admin.clients.$id.tsx` | `admin/clients/:id` | the detail page for one client |

One list file and one detail file per managed table — "managed" means every table the brief
asks to manage, and when it just says "an admin area", every table the app has except
platform ones. The admin index is the only screen that lists tables; never fold several
tables into one list screen with a switcher, and never make the list the detail page (a
sheet that edits a row from the list is fine for creating, not the place a row is opened).

## The gate, on every file

```ts
import { requireRole } from "~stencil/auth/roles";
import { system } from "~stencil/data";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireRole(request, context.cloudflare.env, "admin");
  const db = system(context.cloudflare.env);
  // ...
}
```

## An admin limited to one group

A brief that gives some admins only their own slice — a partner's admins who manage that
partner's business owners, a regional manager, a franchise — is the same shape with one more
line: a named helper in `app/lib/roles.server.ts` that resolves the caller's group on the
server (`requireGroupAdmin(request, env)` returns `{ user, partnerId }` from the platform
role plus a membership row the admin cannot edit) and throws 403 when the caller is neither
a full admin nor a member of any group. A helper that returns true when the caller holds no
role at all passes every signed-in app user, which is the opposite of a gate. Every read on
the page then carries the group — the owner list **and** the pending-invites list beside it,
the import, the export — and every action that resends, cancels, edits or deletes looks its
row up by id **and** group, never by id alone. A full admin passes with no group and sees
everything; nobody else sees a row outside their group from any route on the page. Before
reporting the page done, read each read and write on it against the helper: one list
scoped and its neighbour not is what the security scan flags as a partner seeing another
partner's prospects.

`loader` AND `action` of every admin file start with `requireRole`; nothing reads or writes
above it. The back office sees every app user's rows, which a signed-in app user's own
access rules would hide, so it reads and writes through `system(env)` **after** the gate
(an app on drizzle instead of the data SDK uses `createDb` with
`// stencil-scope: admin screen, gated by requireRole above` on the query). Never widen a
table's access rule to `anyone` to make an admin screen work.

## The list screen

Load `data-table` and `empty-states` with it.

- `loader`: `db.from("projects").list({ orderBy: [["createdAt", "desc"]], expand: { client: "clientId" } })` — one `expand` per relation column, so the table can show the related record's name. **No `limit`:** an admin list holds every row of the table. `data-table` pages the rows it is given and its "Showing … of" count is the rows loaded, so a `limit` silently drops the oldest records from the admin area and shows a count the index (which counts every row) contradicts.
- Columns: the display columns of the table (name, status, dates, each relation) — never `id`, `createdBy`, `updatedAt`.
- The first column is the row's **display name** as a `<Link to={`/app/admin/projects/${row.id}`}>`. The display name is the first of `name`, `title`, `label`, `email` the table has; a table with none shows its first text column.
- A relation column renders `<Link to={`/app/admin/clients/${row.clientId}`}>{row.client?.name}</Link>`, or `—` when it is null.
- `action` with `intent=create` opens from a "New" button in a `<Sheet>` (the usual list-screen form); a relation field in that form is a `<Select>` over the target table's rows (`db.from("clients").list({ select: ["id", "name"] })` in the loader), never a text box for an id.
- Empty: `<EmptyState>` with a "New" action.

## The detail page

Load `form-layout` with it.

```ts
import { redirect } from "react-router";
import { requireRole } from "~stencil/auth/roles";
import { isDataAccessError, system } from "~stencil/data";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireRole(request, context.cloudflare.env, "admin");
  const db = system(context.cloudflare.env);
  let project;
  try {
    project = await db.from("projects").get(params.id, { expand: { client: "clientId" } });
  } catch (e) {
    if (isDataAccessError(e) && e.code === "notFound") return { project: null, clients: [], tasks: [] };
    throw e;
  }
  const clients = await db.from("clients").list({ select: ["id", "name"], orderBy: [["name", "asc"]] });   // for the relation <Select>
  const tasks = await db.from("tasks").list({ where: { projectId: params.id }, orderBy: [["createdAt", "desc"]] }); // what points back
  return { project, clients, tasks };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  await requireRole(request, context.cloudflare.env, "admin");
  const db = system(context.cloudflare.env);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.from("projects").delete(params.id);
    return redirect("/app/admin/projects");
  }
  await db.from("projects").update(params.id, {
    name: String(form.get("name")),
    status: String(form.get("status")),
    clientId: String(form.get("clientId")) || null,
    notes: String(form.get("notes")),
  });
  return { ok: true };
}
```

- `PageHeader`: eyebrow = the table's name as a link back to the list, title = the display name.
- **Every editable field** is in one `<form method="post">` — one `<Label>` + `<Input>` / `<Textarea>` / `<Select>` / checkbox per column, the enum columns as a `<Select>` whose options are the stored values, the dates as `<Input type="date">`, the json columns as a `<Textarea>` holding the JSON. Left out: `id`, `createdAt`, `updatedAt`, `createdBy`, and the table's hidden columns. A Save button with the usual pending → saved → error feedback (`form-layout`).
- **Relation out:** a relation column is a `<Select>` over the target table's rows (the loader's `clients` list) **and**, beside it, the current value as a link — `<Link to={`/app/admin/clients/${project.clientId}`}>{project.client?.name}</Link>` — so the app builder can follow it without saving first.
- **Relation in:** one `SectionHeading` per table with a column pointing at this one ("Tasks" on a project, "Projects" on a client), its rows as `Panel` rows, each row's display name a link to that row's detail page, a count in the heading, and an `<EmptyState>` when there are none. Never a count without the rows.
- **Delete** is a `<Dialog>` confirmation that posts `intent=delete`, and the action redirects to the list.
- **A missing row** — a stale link to a record deleted since the list loaded — is a normal path here, not an error: the loader catches `notFound` exactly as above and returns `project: null`, and the component renders "This record no longer exists" with a link back to the list. A bare `get()` throws, and the app builder sees the platform error page instead. This is the one loader that catches a `DataAccessError` (`data-sdk` says let a loader throw); every other code still throws.

Which columns point where comes from the contract row (the `→ clients` and `← tasks.projectId` notes) or from `mcp__stencil__describeSchema`, whose fields carry `x-ref` with the target table; never guess a relation from a column's name alone.

## The nav entry and the index

The layout shell shows one "Admin" entry at `/app/admin` when the signed-in app user is an
admin (`hasRole`, or the Preview User and the verify user in the App preview), and nothing for a plain app
user; `shell-writer` does this from the `admin` rows. The index page is one `Panel` per
managed table: its name, its row count (`list({ select: ["id"] }).length` — the SDK has no
count), and a link to its list. The index exists so there
is one address to give the app builder, whatever tables the app has.

## What to tell the app builder

The build summary says, in plain words, where the admin area is and what is in it:

- **Where:** "Admin" in the app's navigation, at `/app/admin`, with a list for each of
  the named tables and a page for every record where it can be edited.
- **Who:** the App preview opens it as admin already; on the Published app, they sign in
  with their own account, open **More → Users**, pick that account and
  set its **Role** to Admin (see `app-roles`, section 4). Nobody else can open it.

Never report an admin area that has lists but no detail pages, or detail pages that show a
related record as a bare id, as done: either is the half-built admin area this skill
exists to prevent.

## In chat

Asked "where is my admin panel", "how do I get to the admin", "how do I edit a client":
if the app has the routes above, the answer is the Admin entry in the app's navigation at
`/app/admin`, the App preview's page picker (above the preview: the box showing the
current path, labelled **Pages** on a wide window, or a compass icon on a phone or a
window too tight for the box) to jump there, and the Users page rule for the
Published app (`app-roles`). If the app has no such routes, or has lists but no detail
pages, or an admin page with no nav entry reaching it, that is a build: hand it to the
Builder Agent as "add the admin area for <tables> in the admin-area shape", naming what is
missing. Never answer "it should be there" without checking the app's routes.
