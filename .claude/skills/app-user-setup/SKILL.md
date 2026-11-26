---
name: app-user-setup
description: >
  First-login setup for app users — "new users set up their account first", onboarding
  wizard, setup steps, welcome checklist, "finish your profile before using the app",
  "resume setup where they left off", "mark existing users as already set up", "has this
  user finished onboarding", keep unfinished accounts out of the main screens, and testing
  the setup flow in the App preview. Load BEFORE building any onboarding, setup or first-run
  flow for app users. Not for the app builder's own Stencil onboarding, not for seller
  payout onboarding (`selling`), and not for a workspace's invite flow (`workspaces`).
metadata:
  agents: [chat, builder]
---

# First-login setup for app users

An app builder says "new app users set up their account first" and means one shape every
time: a few named steps, a progress indicator, resume where you left off, a saved "set up"
state per app user, and a rule that keeps an unfinished account on the setup screens until
it is done. The platform owns the state and the gate; the app owns the step screens.

**Platform (`~stencil/auth/setup`, never rebuilt):**

- The per-app-user state, in the platform's `app_setup` table: `getSetupState`,
  `markSetupStep`, `completeSetup`, `resetSetup`.
- The gate: `requireSetup(request, env, setup)` — `requireAuth` plus a redirect to the
  app user's next step screen while setup is unfinished.
- `<SetupProgress>` from `~stencil/ui/auth/setup-progress` — the step indicator.
- `/auth/setup/reset` — the App preview's account starts over, so the flow can be checked.

**App (yours):** `app/setup.ts` naming the steps, the step screens and what each one
saves, and the layout that calls the gate.

Never add a completion column, an `onboarded` flag, a step counter or a "first login"
record to the app's own tables, never check a flag per route, and never write to
`app_setup` with SQL — it is a platform-owned table like `app_role`.

## 1. Declare the steps

`app/setup.ts` is data: the app builder renames or reorders steps here, and a step's
`id` is what the saved state refers to, so keep the id when the label changes.

```ts
import type { SetupFlow } from "~stencil/auth/setup";

export const setup: SetupFlow = {
  path: "/app/setup",
  since: "2026-10-23T14:05:00Z",
  steps: [
    { id: "profile", label: "Your profile" },
    { id: "business", label: "Your business" },
    { id: "first-client", label: "First client" },
  ],
};
```

`path` is the URL the step screens answer on, so it is the layout's own path with
`/setup` under it (`/app/setup` for the `/app` layout). A path the routes in section 3
do not resolve to sends every new app user to "Page not found".

`since` is the moment setup went into the app: run `date -u +%Y-%m-%dT%H:%M:%SZ` when
you add it and paste the result. An account created before that moment counts as set up
without a row, so every app user who exists at that moment, including one who signed up
earlier the same day, never sees the steps; an account created after it starts at the
first step. A bare day (`2026-10-23`) is refused by the helper: it would mean midnight,
and every account created earlier that day would be sent through setup. That is the whole
backfill: never mark existing accounts with SQL, a loop, or a one-off route.

## 2. Gate once, in the layout

Every signed-in screen renders under one layout route. Its loader calls `requireSetup`
instead of `requireAuth`; the helper redirects a signed-out visitor to `/login` and an
unfinished account to their next step screen under `setup.path`, and lets `setup.path`
and everything under it through, so the step screens themselves are never bounced.

```ts
import { requireSetup } from "~stencil/auth/setup";
import { setup } from "~/setup";
import type { ShouldRevalidateFunctionArgs } from "react-router";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireSetup(request, context.cloudflare.env, setup);
  return { user };
}

export function shouldRevalidate({ formMethod }: ShouldRevalidateFunctionArgs) {
  return formMethod !== undefined;
}
```

- Child loaders and actions under `/app` keep calling `requireAuth` themselves (the
  template's rule). Setup is a flow, not an access rule: a child's data is the account's
  own rows either way, and the next navigation lands on setup.
- Public pages, `/logout`, `/upgrade` and the platform's auth pages are outside the
  layout, so they need no exemption; never put the gate on them.
- Never gate per page. One hand-written check per route is how a missed route leaks a
  half-set-up account into the app.

## 3. Register the routes, then build the step screens

**Register both routes in `app/routes.ts` in the same turn you add the flow.** The gate
sends every new app user to `${setup.path}/<step id>`; with no route there, the app user's
first screen after signing up is "Page not found" and nothing in the build reports it.
Register them as children of the layout, with the step in the URL (`form-layout`: reload
and Back land on the same step):

```ts
route("app", "routes/app.tsx", [
  index("routes/app._index.tsx"),
  route("setup", "routes/app.setup.tsx"),
  route("setup/:step", "routes/app.setup.$step.tsx"),
  // ...the app's own screens
]),
```

`app.setup.$step.tsx` is the one the flow cannot work without — it renders the steps the
gate aims at. `app.setup.tsx` answers `setup.path` itself, for an app user who opens it
or returns to it: its loader reads the state and sends them to the step to show next, or
to `/app` when they are done.

```ts
import { redirect } from "react-router";
import { requireAuth } from "~stencil/auth/server";
import { getSetupState } from "~stencil/auth/setup";
import { setup } from "~/setup";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const state = await getSetupState(env, user, setup);
  throw redirect(state.nextStep ? `${setup.path}/${state.nextStep.id}` : "/app");
}
```

`app.setup.$step.tsx` renders one step: `<SetupProgress steps={setup.steps}
current={params.step} />` at the top, the step's form below. Its action saves what the
step collected into the app's own tables (scoped to `user.id` like any other row), records
the step, and moves on:

```ts
import { redirect } from "react-router";
import { requireAuth } from "~stencil/auth/server";
import { markSetupStep, completeSetup } from "~stencil/auth/setup";
import { setup } from "~/setup";

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const at = setup.steps.findIndex((step) => step.id === params.step);
  if (at === -1) throw new Response("Not Found", { status: 404 });
  // ...validate and save this step's fields to the app's tables...
  await markSetupStep(env, user.id, setup.steps[at].id);
  const next = setup.steps[at + 1];
  if (next) throw redirect(`${setup.path}/${next.id}`);
  await completeSetup(env, user.id);
  throw redirect("/app");
}
```

- **Completion is an action followed by a redirect**, never a loader write or client
  state. The redirect after a POST re-runs the layout loader, so the gate reads the
  finished state and the person lands in the app; a flow that completes from a loader or
  navigates client-side is the one that bounces finished app users back into setup.
- A step with nothing to save (a welcome screen, a "what to expect" page) still posts a
  form with a Continue button, so it is recorded like the others.
- Resume is free: the gate and the entry route both aim at `nextStep`, the step after the
  last one recorded. Draft fields within a step follow `form-layout`.
- Keep each step to a few fields and put the app builder's words on it; the stock
  indicator is the only platform-drawn part.
- Before you report the build done, photograph the first step (`dev-tools screenshot
  ${setup.path}/<first step id>`) and check the step indicator is on it. A "Page not
  found" there means the routes are missing from `app/routes.ts`, whatever the typecheck
  said.

## 4. The "pick your role" step

A step never asks the app user which role they are. Roles are set by the app builder from
their Stencil Users page and read with `requireRole` (`app-roles`); a self-chosen role is
a self-granted permission. When the brief wants "are you a coach or a client?" at setup:

- Save the answer as a plain field on the app's own profile table, and let it choose
  screens, copy and defaults — never access. `requireRole` still decides who may do what.
- Never call `setRole` from a setup step, and never write to `app_role`.
- Say in the build summary that the app builder assigns the role from the Users page, and
  name the role you gated on.

## 5. An optional checklist instead of a gate

When the brief says the setup is optional — a welcome checklist people finish in their
own time, a dismissable card — keep the state, drop the gate: the layout calls
`requireAuth` and `getSetupState`, shows a "Finish setting up" card with
`<SetupProgress>` while `complete` is false, `markSetupStep` marks each item as its real
data appears, and Dismiss posts to an action that calls `completeSetup`. The app builder
can later turn it into a gate by switching the layout to `requireSetup`, with no other
change.

## 6. Checking the flow in the App preview

The preview account was created with the app, before `since`, so it counts as set up.
Never edit its state with SQL or a flag flip. Open `/auth/setup/reset` in the App preview and press **Start
over**: the account is back at the first step and the gate sends it to setup. The route
answers only the platform's own accounts, on the App preview only, so no app user can be
reset from it. Tell the app builder in the build summary that they can walk the flow again
the same way.

## 7. An app that already carries a hand-built flow

Keep the data its steps collected; replace the mechanism. Remove the app's own completion
column or flag, the per-route checks and any gate it built, point the layout at
`requireSetup`, and declare the existing steps in `app/setup.ts` with `since` set to the
moment of this build (the same `date -u` command as section 1). Every account that exists
at that moment then counts as set up, including one that signed up earlier today and one
that was part-way through the old flow — say so in the build summary.

## 8. Build summary

Say that new app users go through setup before the app, list the steps by label, name
where the app builder renames or reorders them (`app/setup.ts`), say that existing app
users are not sent through it, and point to `/auth/setup/reset` in the App preview for a
re-run.
