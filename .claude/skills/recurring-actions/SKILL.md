---
name: recurring-actions
description: Scheduled server-side work — "every morning", "daily/weekly/hourly/nightly", "each evening", cron, recurring reminders, digest or summary emails, periodic refresh/cleanup/expiry, polling an inbox or feed on a schedule. Use when the brief asks for anything that must run repeatedly without the user opening the app. Covers the app/schedules.ts manifest, the trusted scheduled route, the cadence contract, and idempotency.
metadata:
  agents: [chat, builder]
---

# Recurring actions

Run server-side work **on a schedule** — "every morning refresh the events list", "email each user a weekly summary", "every hour expire stale rows" — with no cron plumbing. The platform evaluates every app's schedule and fires the ones that are due; you declare *when* and write *what happens*.

Only build one when the brief asks for scheduled/repeating work. Never fake scheduling with client-side timers, `setInterval`, or a "run now" button — those don't run when the app is closed.

## Start from the scaffolds

Start from the `recurring/schedules.ts` and `recurring/api.internal.scheduled.tsx` scaffolds, two idempotent examples of this feature. The app's manifest is `app/schedules.ts`, and its trusted route is `app/routes/api.internal.scheduled.tsx`, registered in `app/routes.ts` at `api/internal/scheduled`.

A recurring action is always **two edits that agree on a `name`**.

## 1. Declare it — `app/schedules.ts`

This manifest lists every recurring action. On each production deploy the platform reconciles it into its registry: new entries register, changed entries update in place keyed by `name`, removed entries stop firing.

**Schedules run only on the Published app.** A build deploys the App preview, which never registers schedules. `app/schedules.ts` is reconciled only when the app builder publishes. Until then the job does not run and More → Automations shows nothing. Whenever you add or change a schedule, say so in your report in plain words: "This runs on its own once you publish. Until then it does nothing, and it won't appear in Automations." Never describe a scheduled action as already running, or a problem as "now handled automatically", while it exists only in the App preview.

```ts
export const schedules: ScheduleManifestEntry[] = [
  {
    name: "refresh-events",                 // stable identity — must match a handler
    cron: "0 7 * * *",                      // 5-field cron; 07:00
    description: "Fetch new events every morning and add them to the database",
    timezone: "America/New_York",           // optional — makes "morning" the user's morning
    // path?: "/api/internal/scheduled"     // optional — defaults to the trusted route below
  },
];
```

- **`name`** — required, stable identity. Ties the schedule to its handler and to the registry row; renaming it is "remove old, add new". Short kebab-case verb-noun (`refresh-events`, `send-weekly-summary`).
- **`cron`** — required, standard 5-field expression (`min hour day-of-month month day-of-week`).
- **`description`** — required, a human-readable one-liner of intent in the *user's* words ("Send each user a weekly summary"), never the implementation or a restatement of the cron. It's the label the owner's Automations panel surfaces.
- **`timezone`** — optional IANA zone. Set it whenever the user says "morning/evening/overnight/end of day" so it fires in *their* time, not UTC.
- **`path`** — optional; only set it if you route scheduled traffic to a custom route.

## 2. Do the work — `app/routes/api.internal.scheduled.tsx`

The trusted route the platform hits. Its platform side is one **platform-managed** wrapper — `export const action = scheduledAction(SCHEDULE_HANDLERS)` from `~stencil/internal`, which verifies the injected bearer secret, acks immediately, and runs the matched handler in the background — **leave that export exactly as shipped.** All you add is a handler in `SCHEDULE_HANDLERS`, keyed by the same `name` as the manifest entry:

```ts
const SCHEDULE_HANDLERS = {
  "refresh-events": async ({ env }) => {
    const db = createDb(env);
    // ...fetch and UPSERT (not insert) — see idempotency below.
  },
} satisfies Record<string, (args: ScheduleHandlerArgs) => Promise<void>>;
```

Inside a handler you have the app's normal server-side toolkit: `createDb` (`~stencil/db`), `createAI` (`~stencil/ai`), `createEmail` (`~stencil/email`), `createNotifications` (`~stencil/notifications` — the durable in-app record; see the `in-app-notifications` skill), `createStorage` (`~stencil/storage`), `createSearch` (`~stencil/search`), `createFetch` (`~stencil/fetch`), and plain `fetch()`.

Absolute links a handler writes (email buttons, calendar files, reminders) come from `new URL(request.url).origin` — the platform triggers the schedule on the app's public host, its custom domain when one is live. Never build them from the slug or a hard-coded host.

**A handler that sends or acts for a person acts as the person who set the work up** — the
app user on the row it is processing (its `createdBy` / author), never the workspace owner,
the first admin or any fixed account. That person's name, signature, connected mailbox or
calendar, recipient rules and permission checks are the ones the handler uses, exactly as
the screen that does the same thing by hand uses them; read the row's author and pass that
id wherever the screen passes `user.id`. A teammate's scheduled email that leaves from the
owner's mailbox under the owner's name is the owner impersonated, whatever the task said. When
the author is gone or no longer allowed to do it, the row fails visibly (a status the screen
shows, a log line) instead of running as someone else.

A handler that creates or mutates records an existing screen renders follows CLAUDE.md's "Server entry points that write records the app already shows" rules in full: the existing status vocabulary, the same server function the UI path uses, and one handler-created record seen on the existing screen before the feature is done.

## Cadence contract — state and respect it

- **~5-minute floor.** The platform evaluates schedules on a 5-minute tick, so `* * * * *` still only fires about every 5 minutes. Sub-5-minute cadence isn't possible, and staggering does not get around it: schedules set a minute apart (`0,5,10,…`, `1,6,11,…`, `2,7,12,…`) all match the same tick and all run together, every 5 minutes. When the app builder asks for anything faster, say so plainly and build one schedule at the 5-minute floor — never a set of offset schedules.
- **Timezone-aware** (see `timezone` above) — a genuine step past UTC-only cron.
- **Best-effort delivery.** A run can be missed. A 5xx from the app is retried once; a timeout or network error is not, because the app may already be running the job. A run can still arrive twice, so never rely on delivery being exactly once.
- **The platform only triggers you.** The route acks 202 immediately and the handler runs in the background — the platform never learns the result. A handler failure is logged as `[schedule:<name>] failed` and appears in the app's error log.
- **Handlers MUST be idempotent and MUST guard against overlap.** Prefer upsert/reconcile over blind insert. A slow job can still be running when the next run arrives — check and stamp a `last_run_at` row before doing work. For inbox/feed polling, mark items processed (`markRead`) so the next run skips them.
- **AI and web search run on new work, not on the clock.** A handler that calls `createAI` or `createSearch` first finds what is new since the last run (rows created or changed after `last_run_at`, app users active in the last N days, inputs that differ from the ones already searched) and calls AI or search only for those; when nothing is new it stamps `last_run_at` and returns. Never re-search the same terms every run, never generate the same text for an inactive app user, and never put a model or search call inside a loop over every row in a table. Say in the report what the guard is ("runs the search only for app users who logged in this month").
- **Claim before any side effect you can't undo** — an email, an invoice, a charge, a push, an assigned task. The claim is one conditional write, and you act only if it returned a row: either `UPDATE … SET notified_at = now() WHERE id = ? AND notified_at IS NULL RETURNING id`, or insert a claim row whose id names the thing (`<schedule>:<recordId>:<period>`) with `onConflictDoNothing().returning()`. Never read a "sent" flag, act, and write the flag afterwards: a run cut off between the two sends again on the next tick, and a random id per send means nothing can catch the copy. A claim followed by a failed send is a missing email the owner can resend; the other order is a duplicate the recipient receives. On the data SDK path the claim is `db.from("<table>").claim(id, { notifiedAt: now }, { where: { notifiedAt: { op: "isNull" } } })`, acting only on a returned row. The same rule applies outside schedules wherever two requests can finish the same record — a browser poll racing a job, a double-tapped button, a checkout finalised on a success page (the `data-sdk` skill's "Claim before a side effect").
- **CPU budget.** A background handler gets the default ~30 s of CPU time; time spent waiting on the network doesn't count against it.

## Cadence is composer-set

In v1 the schedule is fixed at build time; the user changes it by asking you to rebuild ("make it hourly instead"), which edits `app/schedules.ts` and redeploys. There is **no in-app runtime settings screen** to view, pause, or edit schedules — do not build one. Never expose the manifest, the registry, or `SCHEDULE_TRIGGER_SECRET` in the app UI.
