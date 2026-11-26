---
name: feature-rollouts
description: >
  Turning a feature on for chosen app users first, then for everyone, with no build or publish
  to change who has it — "feature flag", "feature switch", "staged rollout", "gradual rollout",
  "early access", "only for my testers", "just for me for now", "admin-only for now", "not live
  for users yet", "keep it on for a few accounts", "only for these communities / teams",
  "publish this fix but hold that feature back", "launch mode", "coming soon for everyone
  else", "kill switch". Load BEFORE answering whether Stencil allows this, before saying a
  publish cannot be split, and in a build before writing any early-access list, launch toggle
  or per-account gate. NOT for who may sign up (`app-users`, `login-settings`), a permanent
  kind of person such as staff (`app-roles`) or what an app plan unlocks (`payments`).
metadata:
  agents: [chat, builder]
---

# Feature rollouts: Off, Testers, Everyone

A publish is the whole current version. The way to ship a finished change while an unfinished
one waits is to put the unfinished one behind a rollout switch and publish both. Stencil has
no switch setting of its own yet, so the app holds it, in this one shape every time. The
platform's rules allow it: it is a stored setting checked on the server and changed only by
an admin, not a preview shortcut and not a way around a payment.

## The shape

- **A stage per feature, stored as rows.** A `feature_stages` entity (`key` text, `stage`
  text: `off`, `testers` or `everyone`) and a `feature_testers` entity (`subject_id` text).
  Every access rule on both is `nobody`, so only server code reads or writes them. The keys
  are a list in code; who the testers are is never in code, a secret or an env var.
- **Missing means off.** No row, a stage the helper does not know, or a signed-out visitor on
  a `testers` feature all read as off. Never catch a failed read into "on".
- **Admins always count as testers,** so "just me for now" needs no tester rows, and the App
  preview (where the Preview User reads as admin) shows a `testers` feature as it is. Never
  add the Preview User to `feature_testers` and never branch on `isDraft` here.
- **A tester is an app user or a group the app already has** (a workspace, team or
  community). `testerSubjects` is the one place that maps an app user to the ids that can be
  ticked: their own id, plus the id of each group they belong to.
- **One helper, called everywhere.** In `app/lib/features.server.ts`:

```ts
import { requireAuth } from "~stencil/auth/server";
import { hasRole } from "~stencil/auth/roles";
import { system } from "~stencil/data";

export const FEATURES = ["home_block"] as const;
export type FeatureKey = (typeof FEATURES)[number];

async function testerSubjects(env: Env, userId: string): Promise<string[]> {
  return [userId]; // plus the ids of this app user's groups, read on the server
}

export async function hasFeature(env: Env, key: FeatureKey, userId: string | null) {
  const [row] = await system(env).from("feature_stages").list({ where: { key }, limit: 1 });
  if (row?.stage === "everyone") return true;
  if (row?.stage !== "testers" || !userId) return false;
  if (await hasRole(env, userId, "admin")) return true;
  const subjects = await testerSubjects(env, userId);
  const hits = await system(env)
    .from("feature_testers")
    .list({ where: { subjectId: { op: "in", value: subjects } }, limit: 1 });
  return hits.length > 0;
}

export async function requireFeature(request: Request, env: Env, key: FeatureKey) {
  const { user } = await requireAuth(request, env);
  if (!(await hasFeature(env, key, user.id))) throw new Response("Not found", { status: 404 });
  return user;
}
```

- **Every path that reaches the feature asks the helper:** its loaders and actions, resource
  and API routes, uploads and exports, and a recurring action before it acts for an app user.
  A page shared with people who lack the feature calls `hasFeature` in its loader, skips the
  feature's reads when it is false and returns the boolean; the component only draws by it.
  A nav item hidden while the save behind it still works holds for nobody.
- **One admin page changes stages:** `/app/admin/features` in the admin area, one row per key
  with an Off / Testers / Everyone control, and the tester list (pick app users, tick groups).
  Its loader and its action both call `requireRole(request, env, "admin")` (or the app's
  `requireAdmin`), and the action accepts only keys in `FEATURES` and the three stages.
- **A new feature starts at Testers.** The build that adds a key also writes its
  `feature_stages` row with `testers`, so the app builder sees it and app users do not.
- **A stage never stands in for a payment or an owner check.** A feature sold on an app plan
  keeps `requireSubscription` and checks the stage as well; a tester who should get a paid
  feature free gets **Give free access** on the Users page. Owner filters and access rules on
  the feature's data stay exactly as they would be without the switch.

## What to tell the app builder

- Stages are changed on the app's own Features page, by an account whose Role is Admin on
  the Users page. No build and no publish. Adding a new switch is a build.
- The App preview and the Published app share one database: a stage changed while trying it
  in the App preview changes the Published app in the same moment.
- A switch only matters on the Published app once the feature's code has been published.
  Publishing with the stage at Testers is the safe way to do that.
- When everyone has had the feature for a while, a later build can remove the switch.

## In chat

"Can I publish this but hold that back?", "can only my testers see it?", "is a feature flag
allowed?": yes, in this shape, and say that it lives in the app, not in Stencil's settings.
If the app has no Features page yet, hand off a build that adds it and puts the named feature
behind a key. If it has one, changing a stage or a tester is the app builder's click there,
never a build. An app that already keeps an early-access list in code moves to this shape in
one build: give each listed account a `feature_testers` row, then delete the list.
