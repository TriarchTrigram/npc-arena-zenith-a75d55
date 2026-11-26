---
name: workspaces
description: Use when data is shared between several people — workspaces, teams, organizations, shared accounts, "invite my teammates", "everyone in the group can see it", members and roles, switching between workspaces — and when each of those groups has a look of its own: "each creator / client / studio / church has their own brand", "their own logo and colours", "multi-brand", "white-label" (the look; the address is `subdomains`), a brand kit app users fill in themselves. Do NOT use for apps where each user owns their own private data; those scope by created_by and need none of this. Covers the data model, query scoping, switching, roles, UI shape, a brand per workspace, and retrofitting workspaces onto an app that already has data.
allowed-tools: createEntity updateEntity regenerateSchema previewUser createRecord
metadata:
  agents: [chat, builder]
---

# Workspaces — rules for a workspace-scoped app

## First, decide whether this app needs workspaces at all

Every app scopes user data by `created_by` **or** `workspace_id`. Pick one:

- **One person owns their rows, nobody else sees them** — a habit tracker, a personal
  CRM, a journal. Scope by `created_by` and **stop here**. Adding workspaces costs three
  tables, a switcher, an invite flow, and a role system nobody asked for.
- **Several people work on the same rows** — a team CRM, a shared inbox, anything with
  "invite", "our", "the group", "collaborate". Workspaces. Continue.

Ambiguous briefs default to `created_by`. Retrofitting workspaces later is a well-worn
path (last section); tearing them out is not.

An app-wide admin outside any workspace (the app builder's own admin side, staff,
"view as an app user"): see `app-roles`.

**Owning a workspace proves nothing about being the app builder.** Every account that
signs up is made owner of a personal workspace (below), so "is an owner of their
workspace" admits any stranger who registers. The workspace `role` gates that
workspace's own pages and nothing else. A page for the whole app (the app builder's or
their staff's, one that runs paid AI calls or sends email on the app's account) calls
`requireRole` in every loader and action, as `app-roles` sets out.

## Non-negotiable

Break one of these and the app either leaks one tenant's data into another or shows
nothing at all. Everything after this section is a recommendation.

1. **Filter by workspace on writes as well as reads.**
   `where(and(eq(t.id, id), eq(t.workspaceId, workspaceId)))`. Matching on `id` alone
   lets a member of one workspace edit another's row by guessing an id.
2. **Validate the active-workspace cookie against membership on every request.** Treat it
   as a hint, never as authorization; fall back to the user's first membership.
3. **Enforce role server-side, per mutation.** Hiding a form from non-owners is not
   enforcement — the POST still works. `invite` is the one that gets forgotten, and a role
   change is the one that gets written open: the action refuses the caller's own membership
   row and the owner's, and sets at most the caller's own role (a member makes nobody an
   owner). The `app-roles` skill, section 1b, has the full set. Creating an invite is a
   grant too: the `invite` action checks the caller is an owner before it writes, and checks
   the submitted role against the roles an owner may hand out instead of storing the form's
   value. Changing another member's email, or removing them, is owner-only as well.
4. **On an existing app: add the column, backfill, then scope the queries — in that
   order.** Scoping first hides every existing row behind an empty list.

## Data model

- Three entities: `workspaces` (name, created_by), `workspace_members` (workspace_id,
  user_id, email, name, role), `workspace_invites` (workspace_id, email, role, status,
  token, expires_at). Create with `createEntity`; `/home/user/app/app/generated/db-schema.ts`
  is regenerated every build and never hand-edited.
- Add `workspace_id` to tables holding **shared user data** — including ones the brief
  doesn't name, since a table without it is shared by every workspace. Skip lookup
  tables, config, tiers, and anything account-shaped. `regenerateSchema`
  lists what exists so you can check coverage.
- Keep `workspace_id` optional. Existing rows carry `NULL` until the backfill runs, and
  a required column blocks that path.
- Denormalize `email` and `name` onto `workspace_members` (and `workspace_name` /
  `invited_by_name` onto invites) — the auth user table isn't joinable from app queries.
- **A member's `email` reaches owners only.** It is on the row for the owners' Members page
  and for sending. Everything a loader returns is in the page the browser receives, drawn or
  not, so a page every member opens (an assignee picker, a task list, a calendar, a
  dashboard) selects `user_id`, `name` and photo, never `email`. Keep two reads: the one
  shared pages call has no `email` column, and the one that has it runs only after the owner
  check. One `listMembers` that selects `email` sends it from every page that calls it.
- **Whatever lets someone in reaches owners only, and a secret reaches nobody.** A pending
  invite's `token` is the seat it grants, an owner seat included, so a member who can read it
  from the page data can join again as owner from a second account. The loader reads pending
  invites only after the owner check, and selects `id`, `email`, `role` and `status`, never
  the whole row; the token goes only into the email. A public share code, when the workspace
  has one, is selected for owners alone, and a share password is never a column at all (load
  `access-codes`).
- **Workspace membership is not the app's own idea of a "member".** A band app has
  players, a clinic has staff — those stay in their own domain table with their own
  roles. `workspace_members` governs who can see the workspace; the domain table governs
  who does what in the product. Conflating them produces two half-correct tables.

## Access and lifecycle

- Resolve context in one place — `getWorkspaceContext(request, env)` in
  `app/lib/workspace.ts`, returning `{ user, db, workspaceId, role, memberships }`. When
  loaders call `requireAuth` + `createDb` directly, scoping is what gets skipped.
- Resolve it **once per fetch** with `memoPerRequest` from `~stencil/request-context`,
  keyed on a module-level `Symbol`. It is one shared promise for everything one worker
  fetch runs: every loader on a navigation, the action on a post, and on a document post
  the action and the loaders that follow it. A client-side post's revalidation loaders
  are a separate fetch and resolve again. Never key a cache on the Request object
  (`new WeakMap<Request, …>`): React Router hands the handlers inside one fetch rebuilt
  Requests, so it misses. Do not skip the memo on POST either; call
  `forgetPerRequest(WORKSPACE)` in the action only when it changed the membership or the
  active workspace, so a document post's loaders (same fetch) resolve fresh. An action
  that updates the signed-in app user's own row and returns data also calls
  `forgetSession()` from `~stencil/auth/server`, since the two keys are dropped
  separately; the `instant-actions` skill has the exception for an update that rotated
  the session. An action that changes who is signed in ends in a redirect (`signOut`
  throws one).

  ```ts
  import { memoPerRequest } from "~stencil/request-context";

  const WORKSPACE = Symbol("workspace");

  export function getWorkspaceContext(request: Request, env: Env) {
    return memoPerRequest(WORKSPACE, () => resolveWorkspaceContext(request, env));
  }
  ```
- Scope every read, not just list pages: counts, aggregates, search, exports.
- Give a user a workspace on first load rather than gating them behind a "create your
  first workspace" screen — mint a personal one and make them owner. That owner role
  is of their own workspace only; it is never a gate for an app-wide page.
- Accept an invite only when the invitee presses a button: show a pending invite matched by
  email as a "Join <workspace>" `<form method="post">`, and do the join in its `action`.
  That needs no emailed link and no email delivery, but match only a **verified** address:
  require `user.emailVerified === true` before granting the seat. `requireAuth` proves there is a
  session, not that the account owns its email — password sign-up doesn't verify unless
  the app's **Require email verification** login setting is on (see `login-settings`), so
  without the check whoever registers the invited address first takes the invitee's seat. On match,
  store `user.id` on the membership and authorize by it from then on; the verified-email
  gate is for the one-time linkage, never a blanket requirement on ordinary `user.id`
  scoping. Sending the invite email is optional polish. An invite link's page renders the
  same button; its loader never joins anyone.
- Minting the personal workspace is the one write in a read path, so two loaders on one
  page can race and mint two workspaces. Mark it `// stencil-loader-write: first-load <why>`
  on the line above; the build refuses any other write a loader reaches, in a route or in a
  `~/lib` helper it calls: accepting an invite, granting a role, sending.
- **Surfaces with no session can't call it.** `getWorkspaceContext` redirects to
  `/login`, so cron handlers, webhooks, and public routes (a QR capture link, a shared
  form) must receive their workspace explicitly — from a token or by looking up the row
  they're acting on — and still filter by it.
- **An invite link is a page with a Join button, never a loader that joins.** The link's
  loader looks the invite up by token and renders `<form method="post">`. The `action`
  refuses unless the invite is still pending, `expires_at` is ahead (seven days is a
  sensible life), and the signed-in account's verified email equals the invite's `email`.
  Then it inserts the membership with `user.id` and the invite's own `role`, and marks the
  invite accepted in the same action, so the link works once and only for the person it was
  sent to. A link that works for whoever opens it is a spare key to the workspace.
- **A seat belongs to the account that accepted it.** From then on every check reads
  `workspace_members.user_id`; never look a member up by email on each request, or whoever
  can edit that email can hand the seat to another account. Moving a seat to a new address
  is removing the member and sending a new invite, with the checks both of those carry.

## Switching

- Everything on the page depends on the active workspace, so switching has to re-fetch
  **all** loader data. A native `<form method="post">` → `redirect` gets that for free;
  a client-side submit re-runs some loaders and leaves stale rows on screen. Use the form
  unless you have a specific reason and have checked the whole page revalidates.
- Set the cookie in the action and redirect back to the referer's path, passed through
  `safeReturnTo` from `~stencil/auth/server` (it confines the target to the app and falls
  back to the app root) — never a hand-rolled same-origin test.
- Switching to a workspace the user doesn't belong to should be a silent no-op, not an
  error.

## Routing

- **Every rendered app shell needs workspace context in scope** — from its own loader or
  from a parent route's. When one route misses it, the switcher is empty on that page
  only, which reads as "switching is broken" and sends you debugging the wrong file.
- Prefer rendering the shell once in a layout route; then there is a single loader to get
  right. If instead each route renders the shell, each of those loaders must return the
  workspace list and active id, and every one of them needs checking.

## UI

Shape, not measurements. The numbers below are what worked on one app in one theme —
match the app's own scale instead of copying them.

- The switcher is a compact single line: monogram, truncated name, chevron. It sits above
  the nav and should read as subordinate to it. Ensemble used a `h-6 w-6` monogram at
  `text-[10px]` with `py-1.5`; a denser or airier theme wants different numbers, the same
  proportions.
- Keep the role out of the trigger. A second line turns it into a tall block; role
  belongs on the settings page.
- The dropdown lists every workspace the user belongs to, active one marked. A switcher
  that doesn't show the list isn't a switcher — this is the most common way this feature
  ships broken.
- "New workspace" belongs in a dialog opened from the switcher, not as a section on the
  settings page.
- Inputs in dialogs and inline settings rows want the compact variant; the default
  `Input` is sized for full-page forms and reads as oversized in a row. On Ensemble that
  meant `h-9 text-sm`.
- Prefer an actionable dropdown over a badge for role, with destructive actions
  line-separated at the bottom of that same dropdown rather than a bare trash icon.
- A workspace settings page usually needs only three things: rename (owners), the members
  list, and one combined invite-and-pending card (owners only, in the loader as well as on
  the screen). Leave out a workspace list (the
  switcher is that), a create section (the dialog is that), and "Leave workspace" unless
  it was asked for.

## A brand per workspace

Only when the brief asks for it: a creator platform, a studio tool, a client portal, a
church app — anywhere the app user is themselves a brand and their own people (students,
couples, clients, members) see the app through it. The app builder's Brand kit
(`theme.css`) stays the app's one look; a workspace brand is a small override on top of
it, never a second theme.

**Two lines to tell the app builder in every reply about this, before any of it is built:**

- **Every workspace starts from the app's Brand kit.** A studio, a client, an organization
  inherits the app builder's colours, fonts and logo the day it is created, and only what
  its owner fills in afterwards is its own. Say "it starts from your Brand kit and they
  change what they want" — not "a workspace with its own brand kit", which sounds like a
  second brand built from nothing.
- **The pages Stencil hosts keep the app's own Brand kit.** Sign-in and checkout are served
  by the platform, not by the app, so they stay on the app builder's look for everyone.
  Never promise a per-workspace sign-in page, in a white-label answer or any other.

Three decisions already made:

**Store it on the `workspaces` row.** Add optional columns — `logo_key`, `primary`,
`primary_foreground`, `font_display`, `font_sans` — rather than a brand entity
with its own tables, asset rows and inheritance flags. `NULL` means "inherit the app's
Brand kit", which is what every workspace starts with, so there is no defaults-plus-
overrides model to write. The logo is one upload through `createStorage` (load `storage`);
store the key, serve it through the app's file route. Colours are stored as the app builder
would type them (`#2f5d50`); a font is a family name from a short list the app already
imports in `theme.css`, never free text — a font nobody imported renders as the browser's
serif and nothing reports an error. Uploaded per-workspace font files are out of scope;
offer the list. Corner radius stays the app builder's: the radius steps in `theme.css` are
independent values, not multiples of `--radius`, so a per-workspace radius would round
the `rounded-md` corners and leave the `rounded-lg` ones alone.

**Resolve it in one place, and apply it as inline CSS variables.** Beside
`getWorkspaceContext` in `app/lib/workspace.ts`:

```ts
export function brandStyle(ws: Workspace): React.CSSProperties {
  const s: Record<string, string> = {};
  if (ws.primary) {
    s["--primary"] = ws.primary;
    s["--primary-hover"] = "color-mix(in srgb, var(--primary) 90%, var(--foreground))";
    s["--primary-muted"] = "color-mix(in srgb, var(--primary) 15%, var(--background))";
    s["--primary-soft"] = "color-mix(in srgb, var(--primary) 8%, var(--background))";
    s["--primary-tint"] = "color-mix(in srgb, var(--primary) 6%, var(--background))";
  }
  if (ws.primaryForeground) s["--primary-foreground"] = ws.primaryForeground;
  if (ws.fontDisplay) s["--font-display"] = ws.fontDisplay;
  if (ws.fontSans) s["--font-sans"] = ws.fontSans;
  return s as React.CSSProperties;
}
```

Put `style={brandStyle(workspace)}` on the one element that wraps the branded surface —
the app shell in the layout route for the workspace's own screens; the page wrapper of a
public storefront, booking page, proposal or portal that found its workspace from the row
or the tenant (see `subdomains`). That is the whole runtime: `app.css` maps the colour and
font utilities to these variables, so buttons, links, focus rings and tints recolour and
shadcn components need nothing. The four depth tokens are redeclared on purpose: a custom
property is computed where it is declared, so the `color-mix` values `theme.css` sets on
`:root` are inherited already mixed with the app builder's colour, and overriding `--primary`
alone would leave `hover:bg-primary-hover` and `bg-primary-tint` on the old brand. Keep the
expressions identical to `theme.css` (`.dark` tints at 8% rather than 6%; that two-point
difference is not worth a second branch). It is server-rendered, so there is no flash of
the app's colours first. Do not write a workspace's colours into `theme.css` or call
`editTheme` for it — that rebrands the whole app for everyone — and do not add a theme
store, a context provider or a `<style>` block.

**Carry the same object everywhere the brand shows.** Email the app sends for a
workspace passes `fromName: workspace.name` and puts the logo in the header (load
`email`); PDFs and exports read the same row. Pages the platform hosts — sign-in,
checkout — keep the app builder's Brand kit (say so, as above); never rebuild sign-in
inside the app to carry the brand.

Who may edit the brand is a role check in the save action (owner by default, as in
section 3 of *Non-negotiable*). When branding is a benefit of a higher app plan, the save
action checks the plan server-side (load `pricing`); a lock icon on the form is not a gate.

## Retrofitting an app that already has data

- The backfill claims rows by creator: set `workspace_id` where
  `created_by = <user> AND workspace_id IS NULL`, inside the first-membership branch of
  `getWorkspaceContext`. Scoping by `created_by` is what keeps it correct when several
  users already have data.
- Rows whose `created_by` matches nobody who signs in stay `NULL` and invisible. That's
  the intended outcome — don't sweep them into the first workspace.
- **Seed rows the same way**: set `created_by` to the preview user and leave
  `workspace_id` NULL, so the backfill claims them on that user's first load. Inventing a
  `workspace_id` for seeds makes them exist in the database and never appear in the
  preview — which looks like a broken app rather than a scoping mistake.
