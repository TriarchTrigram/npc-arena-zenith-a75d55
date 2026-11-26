---
name: events
description: Stencil Events — "when X happens send it to Zapier/Make", "react to a payment/signup/cancellation", "notify my CRM", "lock a feature when a payment fails", "webhook", "connect this to my other tools". Use when the brief asks the app to react to something the platform knows about (payments, signups) or to send what happens in the app to an outside tool. Chat Agent — "open Events settings", "where do I add my Zapier address", "set up a webhook": point the app builder to More → Settings → Events and show the button to it; no build for platform events. Builder Agent — app/events.ts, on(), defineEvents() + emit(), delivery guarantees and dedupe.
allowed-tools: showEventsSettings setEventDestination deleteEventDestination
metadata:
  agents: [chat, builder]
---

# Events

An **event** is one thing that happened, as a small JSON envelope: `{ id, type, app_id, created_at, data }`. Two kinds flow through one pipe:

- **Platform events** — Stencil publishes these about the app (a payment failed, an app user signed up). The app can react to them with `on()`.
- **App events** — the app publishes these itself with `emit()` ("booking.created"), and the app builder routes them to outside tools.

The app builder manages where events go in **More → Settings → Events**: they press **Add destination**, pick **Zapier**, **Make** or **Another address**, paste the address their tool gave them, tick the events it should receive, and get a signing secret. The page shows every event by a plain label ("Payment failed", "New sign-up"); when you talk to the app builder, use the label, not the type name. **Never write a destination URL, secret or `fetch()` to an outside tool into code** — if the brief says "send it to Zapier", the code's job is to `emit()` the event; the app builder points it at Zapier in Events. Say so in your report, in their words: "Open More → Settings → Events, add your Zapier address and tick `booking.created`."

Only build on Events when the brief asks for it. A plain in-app effect (write a row, send an email on a form submit) does not need an event.

## For the Chat Agent

Everything on the Events page is the app builder's to do, with no build. Send them there in one line — **More → Settings → Events** — and call `showEventsSettings`, which puts an "Open Events settings" button in the chat. There they press **Add destination**, pick **Zapier**, **Make** or **Another address**, paste the address, tick the events, and press **Send a test event** to see example data arrive at the tool. Never hand off a build for a platform event (sign-ups, trials, payments, failed payments, cancellations, purchases): the page already lists them. Hand off only when they want an event of the app's own ("send an event when a client books") — the Builder Agent adds `emit()`, and after the build the event appears on the page for them to tick.

## The one file — `app/events.ts`

Ships with an empty catalog and no handlers. **EDIT it, never recreate it**: the platform layer imports it, so deleting it is a build error.

```ts
import { defineEvents, on } from "~stencil/events";

export const events = defineEvents({});
// on("subscription.payment_failed", async (event, env) => { ... });
```

## Platform events — react with `on()`

| Type | Page label | When | `data` | Reaches `on()` |
|---|---|---|---|---|
| `app_user.signed_up` | New sign-up | An app user created an account | `app_user_id`, `email`, `name`, `method` | yes |
| `subscription.trial_started` | Trial started | An app user started a trial | `app_user` {id, email, name}, `tier`, `tier_name`, `interval`, `trial_ends_at` | yes |
| `subscription.trial_ended` | Trial ended | A trial ended. `outcome` is `converted` (now active, a payment went through), `payment_failed` (the first charge did not go through and the subscription still exists) or `cancelled` (the subscription is over). `payment_failed` is not final: Stripe keeps retrying, and Payment failed and Subscription ended follow as usual | `app_user`, `tier`, `tier_name`, `interval`, `outcome` (`converted`, `payment_failed` or `cancelled`), `trial_ended_at` | yes |
| `subscription.activated` | Subscription started | A subscription became active for the first time | `app_user`, `tier`, `tier_name`, `interval`, `amount_cents`, `previous_status` | yes |
| `subscription.changed` | Plan changed | An app user moved to another plan | `app_user`, `from_tier`, `to_tier`, `interval` | yes |
| `subscription.payment_succeeded` | Payment succeeded | A renewal or first payment went through | `app_user`, `tier`, `amount_cents`, `invoice_id`, `period_end` | yes |
| `subscription.payment_failed` | Payment failed | A payment attempt failed; Stripe will retry | `app_user`, `tier`, `amount_cents`, `attempt`, `next_retry_at` | yes |
| `subscription.cancel_scheduled` | Cancellation requested | An app user asked to cancel; access continues until the period ends | `app_user`, `tier`, `access_ends_at` | yes |
| `subscription.canceled` | Subscription ended | A subscription ended and access stopped | `app_user`, `tier`, `reason` (`app_user` or `dunning`) | yes |
| `purchase.completed` | One-time purchase | An app user or guest paid for a one-time product (`buy()`); a guest's `app_user.id` is null and `email` is what they paid with | `app_user`, `product_id`, `product_name`, `amount_cents`, `currency`, `order_id` | yes |
| `email.delivered` | Email delivered | An email the app sent reached the recipient's inbox | `recipient`, `message_id`, `subject` | yes |

A **test event** from the page is one of these types with example `data` and a top-level `"test": true` on the envelope — not a separate type. `on()` never receives one.

`app_user` is an object `{ id, email, name }`. Read `event.data` with a type guard; the table above is the contract.

Register a handler in `app/events.ts`. Several handlers may share one type; they run in order, each awaited, inside the request the platform sends:

```ts
on("subscription.payment_failed", async (event, env) => {
  const { app_user_id } = event.data as { app_user_id: string };
  // ...
});
```

Inside a handler you have the normal server toolkit: `createDb` (`~stencil/db`), `createEmail` (`~stencil/email`), `createNotifications` (`~stencil/notifications`), `addToFlodesk` (`~stencil/flodesk`), `createStorage`, `createAI`. There is no request or signed-in app user — scope every write by the ids in `event.data`.

**Handlers only run on the Published app.** The platform delivers to the app's public host; a build updates the App preview and nothing arrives there. Say so in your report whenever you add one: "This starts working once you publish."

## App events — declare with `defineEvents()`, publish with `emit()`

### The name rule — a name that breaks it is never delivered

Every event name MUST be lowercase, MUST have exactly one dot, and reads object then past-tense verb. Underscores go only inside a word, never in place of the dot. The platform's check is `/^[a-z0-9_]+\.[a-z0-9_]+$/`, and `defineEvents()` and `emit()` fail the type check on any name that breaks it.

| Wrong | Right |
|---|---|
| `campaign_approved` | `campaign.approved` |
| `BookingCreated` | `booking.created` |
| `optin` | `optin.submitted` |
| `form-submission.received` | `form_submission.received` |

The cost of a bad name is silent and total: the platform refuses it, `emit()` drops it without an error, nothing fails at runtime, and the app builder loses every send of that event. A name from the platform table above is refused the same way.

Every custom event the app publishes is declared in the catalog so the Events page can list it for the app builder to tick:

```ts
export const events = defineEvents({
  "booking.created": {
    description: "An app user booked an appointment",
    example: { booking_id: "bk_123", app_user_id: "usr_456", starts_at: "2026-10-12T09:00:00Z" },
  },
});
```

Then publish from the action or server function that did the thing, after the write:

```ts
import { emit } from "~stencil/events";

await emit(env, "booking.created", { booking_id: booking.id, app_user_id: user.id, starts_at: booking.startsAt });
```

- The name follows the rule above (`booking.created`, `invoice.sent`): a build with a bad name fails the type check, and a bad name that reaches production is never delivered.
- `data` is a flat JSON object of ids and the few fields a Zap needs — under 64 KB. Put the record id in, not the whole record.
- One `emit()` per catalog entry. If you add a call site, add the entry.
- **One name, everywhere.** The report, the chat reply and the `emit()` call all use the exact type string written in `defineEvents()` — copy it from `app/events.ts`, never paraphrase it ("search.performed" in the file means the report says `search.performed`, not "library search"). The app builder ticks that string in Events, so a second name sends them looking for an event that does not exist.

## Delivery guarantees — say them out loud

- **`emit()` is best-effort and never throws.** It is skipped in local dev and in the App preview without a backend binding, and a failed publish is logged and dropped, so a hiccup never fails the action that produced it. Don't `await emit()` for a result; there is none.
- **Signup events are fire-and-forget** on the platform side too: a missed `app_user.signed_up` is possible.
- **Payment events are durable.** The platform retries delivery with backoff (8 attempts over roughly 20 hours), to the app and to every destination.
- **At least once, so dedupe.** A retry can redeliver an event the app already handled. The receiver skips an `event.id` it has fully processed, but a handler that was cut off mid-way runs again — key any side effect you can't undo (an email, a row that triggers something) on `event.id`: either insert a row whose id is `<purpose>:<event.id>` with `onConflictDoNothing().returning()` and act only if it returned, or make the write an upsert.
- **A thrown handler means a retry.** Throw when the work really failed (the platform will try again); never throw for a condition that will never change (an app user that no longer exists) — log and return instead.

## Worked example 1 — lock a feature when a payment fails

Brief: "if someone's card fails, lock the export feature until they pay". Write an alert row keyed on the event id; the export loader reads it.

```ts
// app/events.ts
import { defineEvents, on } from "~stencil/events";
import { createDb } from "~stencil/db";
import { eq } from "drizzle-orm";
import { paymentAlerts } from "~/generated/db-schema";

export const events = defineEvents({});

on("subscription.payment_failed", async (event, env) => {
  const { app_user_id } = event.data as { app_user_id: string };
  const db = createDb(env);
  const now = new Date().toISOString();
  await db
    .insert(paymentAlerts)
    .values({ id: `payment_failed:${event.id}`, appUserId: app_user_id, status: "open", createdAt: now, updatedAt: now })
    .onConflictDoNothing();
});

on("subscription.payment_succeeded", async (event, env) => {
  const { app_user_id } = event.data as { app_user_id: string };
  const db = createDb(env);
  await db
    .update(paymentAlerts)
    .set({ status: "resolved", updatedAt: new Date().toISOString() })
    .where(eq(paymentAlerts.appUserId, app_user_id));
});
```

`payment_alerts` is an ordinary entity (`createEntity` with `app_user_id`, `status`); the export route's loader checks for an `open` row and shows the locked state. Don't gate on the `subscription` table instead — the platform keeps the app user entitled while Stripe retries, so the alert row is what carries the app builder's "lock it" rule.

## Worked example 2 — email when a subscription ends

Brief: "when someone cancels, send them a goodbye email".

```ts
import { createEmail } from "~stencil/email";

on("subscription.canceled", async (event, env) => {
  const { email } = event.data as { email: string };
  await createEmail(env).send({
    to: email,
    subject: "Sorry to see you go",
    html: "<p>Your plan has ended. You can come back any time — your account and data are still here.</p>",
  });
});
```

An email is a side effect you can't undo. If the handler does anything else after `send()` that could throw, claim first: insert `goodbye:<event.id>` into a small `sent_emails` entity with `onConflictDoNothing().returning()` and send only when the insert returned a row (see `recurring-actions` for the same rule).

## Worked example 3 — add paying app users to the Flodesk list

Brief: "when someone subscribes, add them to my Flodesk". The app builder has connected Flodesk and saved segments on the Users page (the `mailing-list` skill); the handler only hands the email over.

```ts
import { addToFlodesk } from "~stencil/flodesk";

on("subscription.activated", async (event, env) => {
  const { app_user } = event.data as { app_user: { email: string; name: string | null } };
  await addToFlodesk(env, { email: app_user.email, name: app_user.name });
});
```

`addToFlodesk` is idempotent on email and never throws, so it needs no claim row. The same call fits `order.paid` (`event.data.buyer`) for one-time buyers. No key, no `fetch()` to Flodesk.

## Sending to Zapier, Make, a CRM

A mailing list is not this. Flodesk, Kit, ActiveCampaign and MailerLite have built-in connections, so "add my signups to ActiveCampaign" or "add my signups to MailerLite" belongs to the `mailing-list` skill and never to a destination here — including when that service is not open for the workspace yet, where the answer is another built-in service and never Zapier or Make.

There is nothing to code beyond `emit()` (or nothing at all, for a platform event). The app builder:

1. Opens **More → Settings → Events**.
2. Presses **Add destination** and picks **Zapier** (Webhooks by Zapier → Catch Hook), **Make** (Webhooks → Custom webhook) or **Another address** (any https address, such as a CRM's inbound webhook URL), then pastes the address.
3. Ticks the events to send (or **Everything**) and saves.
4. Presses **Send a test event**, picks one of the destination's events, and the tool receives example `data` with every field a real event has, plus `"test": true`. That sample is what Zapier and Make show when mapping fields.

Every delivery is signed (`Stencil-Signature`, `Stencil-Timestamp` headers) with a secret shown once when the destination is created. Each destination has an **Activity** list — **Delivered**, **Retrying** or **Not delivered** — with **Send again** for one that did not arrive. Private, local and Stencil addresses are refused as destinations.

Never put a destination URL in `app/events.ts`, in a secret, or in a `fetch()` — the destination list is the app builder's to change without a rebuild.

## Managing destinations from chat

`setEventDestination` switches an existing destination on or off, renames it, changes its address or which events it receives, at once and with no build; give only the fields to change. `deleteEventDestination` removes one for good and cannot be undone: call it as soon as the id is known, with no question of your own first, and the held result tells you how to ask for the yes; prefer switching it off when the app builder only wants deliveries paused. Both take the destination's id, which `showEventsSettings` returns along with each destination's name, address, on/off state and events: call it first and read the id out of its result — never ask the app builder to paste one. Adding a destination, rotating its secret and sending a test event stay on the Events page (`showEventsSettings`).
