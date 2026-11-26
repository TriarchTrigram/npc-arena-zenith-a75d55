---
name: app-roles
description: >
  App-level roles and admin screens — admin, admin panel, admin dashboard, "only I can see",
  staff, moderator, roles, permissions, "make me the admin", "admin vs user view", "view as",
  "preview as client", "see it as a member", "log in as", impersonate, "support a user with an
  issue". Use when a brief needs anyone in the app to have more access than an ordinary app
  user, wants to switch between the admin view and the app-user view, or wants to see the app
  as one specific app user does. Not for a shared workspace's member roles: `workspaces` owns
  those. Load BEFORE writing any admin route, role check, or view-as mode.
metadata:
  agents: [chat, builder]
---

# App roles, the admin ⇄ app-user toggle, and "view as this app user"

Three asks arrive in many wordings and get the same shape every time:

1. **An admin side of the app**: screens only the app builder (or their staff) can reach.
2. **A toggle between the admin view and the plain app-user view**, for testing.
3. **"View as a specific app user"**: see the app the way one app user sees it, to support them.

The platform owns the role: the app builder sets a **Role** on an app user in their Stencil
Users page (Admin, or any name they type, such as staff or client), and `~stencil/auth/roles`
reads it. The platform has no impersonation.
The App preview signs in as the **Preview User** (its id is in your prompt); the role helpers
treat that account as admin in the App preview only. The Published app never holds a session
for it, so nothing keyed on it can open there.

## 1. The role model

- **Import the role helpers, never write them.** `~stencil/auth/roles` exports
  `requireRole(request, env, role)`, `getRole(env, userId)`, `hasRole(env, userId, role)` and
  `setRole(env, userId, role | null)`, backed by the platform's `app_role` table in the app's
  own database. Do not create an `app_roles` entity, a `role` column, an `is_admin` flag or an
  admin allow-list: the Users page cannot see those, so the app builder's Role field would
  do nothing. The same goes for a list of beta testers or test accounts: those are app users the
  app builder adds from the Users page, never a list in code (see `app-users`). A feature that
  only chosen app users get for now is not a role either: see `feature-rollouts`.
- **Admin is never derived from something a person can assert.** Never grant admin from an
  email literal, an email domain suffix, a list in a deployment secret or environment variable,
  or to whoever signs up first. Each of those is a race to register, not an authorization check,
  and the first three cost a build to change one person. The app builder grants admin from their
  Stencil Users page; the build summary tells them so (section 4).
- **A second kind of person is a second role name, not a second system.** Staff, support,
  client, affiliate, contractor, creator, moderator: each is one `requireRole(request, env,
  "staff")` check (or `hasRole`) on a lowercase name the app builder sets per person from the
  Users page, with the Role field or when adding a person. Never add a role column, an
  access-level field, an account-type table or a role-aware signup to the app for this, and
  never decide the kind at signup: the account is created plain and the app builder sets the
  role. Name the role you gated on in the build summary so they know what to type.
- **A rule the app invents is one helper, called everywhere.** A permission flag ("can see
  finance"), a deactivated flag, a read-only view mode, an assigned-reviewer rule: write it once
  in `app/lib/roles.server.ts` next to `requireAdmin` (section 2) and call it from every loader
  and action that reads or changes what it protects, the way `requireRole` is called. A rule
  checked on the screen and skipped by the save behind it holds for nobody.
- **Every admin route's loader AND action calls `requireRole`,** and so does every resource
  route that reaches the same records or files: the upload action and the file-serving loader
  behind an admin-only screen, an import or sync screen that attaches to or deletes those rows,
  an export. Hiding a nav item is not enforcement; the POST still works, and a sibling route
  gated on `requireAuth` alone is open to every app user.
- **A screen two kinds of app user open shapes its loader data per viewer.** The pair is any
  two roles, not only an admin and a plain app user: a partner's support staff and a business
  owner, a team's member and its owner, two roles the app invented (the membership row's
  `role`, a helper from the bullet above). When only one of them may see a field on a shared
  page — a studio's notes on a project its client also views, a cost price, an owner's billing,
  another person's email — the loader decides on the server which fields leave it: declare the column on the entity's access rule (`"visible_to":
  { "internal_notes": ["me.role = 'admin'"] }`) so the data SDK strips it for everyone else,
  or read it in a second query that runs only when `hasRole(env, user.id, "admin")` is true.
  Everything a loader returns is serialised into the page the browser receives, so a
  component that gets the field and does not draw it (`isAdmin && <Notes />`) has already
  leaked it to the client. The view-mode cookie in section 2 is read by the loader, so client
  view takes the client's branch and never carries admin fields either.
  - **The access rule strips a column only on a data SDK read.** A hand-written query
    (Drizzle, raw SQL) returns every column it selects to whoever the loader let in, so there
    the loader names its columns per viewer: one `select({...})` for the role that sees less,
    the wider one on the branch behind the role check.
  - **Shape every loader that reaches the record, not only the one you are editing.** A role
    given a new page, or access to more records, gets the stripped shape on the list, the
    detail page and any export alike; put the per-viewer shaping in one helper they all call,
    so a second page cannot return what the first strips.
  - **A section taken off a screen leaves its loader too.** "Remove X from this page" or
    "hide X from role Y" deletes the read behind it in the same change, and any query
    parameter that selects such a record is checked against what this viewer may open.

```ts
import { requireRole } from "~stencil/auth/roles";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireRole(request, context.cloudflare.env, "admin");
  // ...
}
```

`requireRole` redirects a signed-out visitor to `/login` and throws a 403 for a signed-in app
user without the role. Show the admin nav only when `hasRole` is true in the layout loader, so a
plain app user never sees the link.
- **The Preview User is admin through the helpers, never through a row.** `requireRole`,
  `getRole` and `hasRole` all treat it, and the verify user the end-of-build check signs in
  as, as admin in the App preview only, so a landing redirect or nav item built on `hasRole`
  opens the admin side in the preview as it is: never special-case the preview with a cookie,
  a query param or an email check. Never insert the Preview User into `app_role`: both deploys
  share one database, so the Published app would honour that row too. To look at a screen
  gated on another role, pass that role to the check (`dev-tools screenshot <route> --as-role
  "creator"`, or the `role` argument of the screenshot and verify tools): the test account
  then holds it for that run, in the App preview only.
- **When the app builder has their own rule for who is an admin** (everyone who pays for a given
  app plan, say), express it by calling `setRole(env, user.id, "admin")` from server code where
  the rule is proven true, so the platform role stays the one answer to "is this person an
  admin". A rule keyed on an email or a domain is not such a rule: see the bullet above.
- **Admin screens that must read every app user's rows** use `system(env)` **after**
  `requireRole` in the same loader. Never widen an entity's access rule to `anyone` to make an
  admin page work: that opens the rows to every signed-in app user, not just the admin.
- **An admin who may see only one group** (a partner's admins, a regional manager) is a named
  role plus one helper that resolves the group on the server and refuses a caller with no
  role; every read and write on that admin's pages, the lists beside each other included,
  filters by the group it returns. The `admin-area` skill has the shape. Never a check that
  passes when no role is found: that admits every signed-in app user.
- **When the app already uses `workspaces`,** a workspace member's role is the membership row's
  `role`; the platform admin is still the one who may reach app-wide admin screens. Do not add
  a third role system.

## 1b. When one app user changes what another may do

A brief that needs more than admin-or-not (Manage Team, Manage Inbox and Manage Billing on a
team; managers above employees; moderators) is first a named role per person (section 1): one
`requireRole` or `hasRole` per gate, the name set from the Users page. Only when the app itself
must let one app user change another's access (an owner ticks permissions for teammates, a
manager promotes an employee) does the app hold a grant action, and that action checks all of
these on the server, per request, against rows read in the same action, never against the form:

- **Nobody changes their own access.** The action refuses when the target is the caller
  (`targetUserId === user.id`), whatever the caller holds. Being allowed to edit the roster never
  means being allowed to raise, lower or reshape one's own level.
- **A person hands out at most what they hold.** Every permission in the request, or the level
  being set, is compared with the caller's own: a Manage Team holder without Manage Billing
  cannot give Manage Billing to anyone, and a manager cannot make anyone an admin.
- **The owner's row belongs to the owner.** Nobody below the app builder's own account (the
  platform admin, or a workspace's owner) edits or removes it, so a teammate cannot take over
  the account.
- **A person's sign-in email and their place on the roster are part of their access.** Changing
  another person's email, removing them or archiving them is checked like a grant: the action
  reads the target's row and refuses unless the caller's level is above the target's, so a
  manager cannot re-point, evict or archive an admin. Once a person has accepted, their row
  holds their account id and every request authorizes by it; a roster matched by email on each
  request gives the seat, level included, to whoever a lower role types into the email field.
- **Access is never read from a field app users edit themselves.** A profile or settings entity
  that app users update on their own row carries no role, permission list, `is_admin`, plan or
  "approved" flag that a loader, action or access rule reads: with open signups a stranger
  writes the field and walks in. Such a value lives where only server code or an admin writes it
  (the platform's `app_role`, a membership row the grant action writes, a column no form
  accepts), and the profile form's action ignores it even when the request carries it.
- **The gate names the tool, never the address prefix.** An owner-only tool that sits under a
  path other staff may open (a resend-welcome tool under the inbox area) checks the permission
  that tool needs in its own loader and action; "is the path under X" is not a check.
- **Opening a page never does the work.** A tool that sends mail, changes a row or grants
  anything runs in an `action` behind `<form method="post">`; its loader only renders the form.
  A loader that acts fires on any navigation, including a link another site plants.

## 2. The admin ⇄ app-user view toggle

For an admin, a header control **"View as app user" / "Back to admin"** that sets a view-mode
flag (a cookie is enough) for that browser. In app-user mode the admin nav and admin routes are
hidden. Identity never changes: this is a view mode, not impersonation, so it is safe to build
every time and it is what a tester wants nine times out of ten.

The only app-owned helper is the thin wrapper that reads the cookie before the platform check,
in `app/lib/roles.server.ts`; admin routes call it instead of `requireRole` directly:

```ts
import { requireRole } from "~stencil/auth/roles";
import { createCookie } from "react-router";

const viewMode = createCookie("view_mode", { httpOnly: true, sameSite: "lax" });

export async function requireAdmin(request: Request, env: Env) {
  if ((await viewMode.parse(request.headers.get("Cookie"))) === "user") {
    throw new Response("Forbidden", { status: 403 });
  }
  return requireRole(request, env, "admin");
}
```

Set the cookie in an action with a native `<form method="post">` and redirect back through
`safeReturnTo` from `~stencil/auth/server`, so every loader on the page re-runs.

## 3. "View as this app user": the safe shape

When the brief asks to see the app as one specific app user ("preview as client", "view as
member", "log in as them", "support a user with an issue"):

- **A read-only preview.** The admin picks the app user (name and email from the app's profile
  entity). Loaders take the picked id from a signed cookie or a query param, call
  `requireRole(request, env, "admin")`, then read that app user's rows with `system(env)`
  filtered to that id (`where: { createdBy: pickedId }`). Every write path is disabled in this
  mode: actions check the flag and refuse, and forms render disabled.
- **A refused write says so on the screen.** Every action reachable in this mode, including
  one a later build adds, checks the flag before any write and returns a result its form
  shows: `{ ok: false, error: "Not saved: you are viewing as Maya Chen, read-only. To change
  their records, use your admin screens." }`, drawn beside the control with `role="alert"`.
  Never a redirect or a bare refusal that leaves the old value to reappear with no message,
  and never a disabled form with no reason: a disabled form carries the same sentence.
  View-as has no edit mode; an admin changes an app user's records from the admin screens.
- **A persistent banner on every screen:** "Viewing as Maya Chen, read-only", with an exit
  control that clears the cookie.
- **Record it:** a row in an `admin_view_log` entity (`admin_user_id`, `viewed_user_id`,
  `viewed_at`) written when the mode starts, so support use is auditable.
- **Never:** mint or copy a session as the other app user, touch `app/.stencil/auth`, call the
  platform's bypass or grant routes, or show the other app user's password or session. A brief
  that insists on true impersonation ("actually logged in as them") gets the read-only preview
  plus one sentence in the build summary saying the platform does not do session takeover.

## 4. What to tell the app builder

In the build summary, in plain words:

- **How to reach the admin side.** The App preview opens as admin (the platform recognises the
  Preview User there, and only there). On the Published app, they sign in with their own
  account, then open the app's Users page in Stencil, pick that account and set **Role** to
  Admin. Nothing is seeded for them.
- **That a page checking one email stays closed in the App preview,** when the app keeps such
  a check (an owner-only page): the Preview User's email never matches, so they open that page
  on the Published app, signed in with that email.
- **Which role each other kind of person needs,** when the build gated on one: "set their Role
  to `staff` on the Users page, or pick it when you add them".
- **How the toggle works,** when one was built: "View as app user" in the header, "Back to
  admin" to return; it changes what you see, not who you are.
- **That view-as is read-only and logged,** when one was built: nothing saves there, and they
  change an app user's records from the app's admin screens.

When the Chat Agent is asked "how do I see the admin side?", the answer is the same: the App
preview is the Preview User, which the platform treats as admin; on the Published app, their own
account with Role set to Admin from the Users page. Asked to make someone staff, a client or an
affiliate, or to change what an app user is: if the app already gates on that role name, it is
a Users page action (pick the person, set Role), not a build; if it does not yet, the build is
the `requireRole` check on that name, and the app builder sets the role afterwards. An older
app that gates admin on an email, a domain, a secret, the Preview User's row or the first
sign-in needs a build: "gate admin on
requireRole from ~stencil/auth/roles and remove the hand-rolled admin check". Before removing
that check, give everyone it grants today the role with `setRole(env, id, "admin")`, so the
app builder's current admins keep their access; if that list cannot be worked out from the code,
ask the app builder for it. Name them in the build summary.
