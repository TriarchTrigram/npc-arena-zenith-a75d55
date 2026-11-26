---
name: booking-imports
description: Bringing bookings taken in Cal.com, Calendly or Acuity Scheduling into the app as records — "show my Cal.com appointments in Today", "sync my Calendly bookings", "pull my Acuity appointments in", "which booking tools can connect", "my clients book through Calendly", an agenda, reminders, client history or a forecast that needs real bookings from an outside scheduling tool. Load before answering that no booking tool can connect, and before shipping such a screen empty or on estimates. Covers each tool's signature, events, stable booking id, how a reschedule and a cancellation arrive, and what the app builder does in the tool.
metadata:
  agents: [chat, builder]
---

# Bookings from Cal.com, Calendly or Acuity

None of the three is a connection in the catalog, and none needs one. Each tool calls an
address in the app whenever a booking is made, moved or cancelled, and the app keeps one
record per booking. The address is a webhook: **load the `webhooks` skill first** — the
verifier, the secret rules and the four things to tell the app builder all apply unchanged.
This skill adds only what is particular to each tool.

Never answer "no booking-tool connector exists" and ship an agenda empty or a forecast on
estimates. Build the import, and say what the app builder has to do in their booking tool.

## The record

One table (reuse the app's existing bookings or appointments table when it has one, with
its own status values), plus two columns: `source` (`cal`, `calendly`, `acuity`) and
`externalId`, the tool's id for the booking. Every delivery is "find by `source` +
`externalId`, then update, else create" with `system(env)` from the `data-sdk` skill —
never a blind insert, since every tool redelivers. A cancellation updates the status; it
never deletes the row.

Bookings belong to the business, so the rows are unowned and visible to admins. When each
app user brings their own booking account, give each one their own address (a per-user
token in the path, looked up to find the owner) and their own secret.

Only bookings made after the address is registered arrive. Say so; offer a one-off import of
upcoming bookings where the tool has a list call (Calendly `GET /scheduled_events`, Acuity
`GET /appointments`).

## Cal.com

- **Signature:** `{ header: "x-cal-signature-256" }` — hex HMAC-SHA256 of the raw body.
- **App builder:** Cal.com → Settings → Developer → Webhooks → New. **Subscriber URL** is
  the route's full address; **Event triggers** are Booking created, Booking rescheduled and
  Booking cancelled; **Secret** is a value they generate in Stencil's secure box
  (`CAL_WEBHOOK_SECRET`), copy before saving, and paste here. With the Secret field empty
  every delivery fails as `signature_mismatch`. Leave the custom payload template off.
- **Payload:** `{ triggerEvent, payload }`. `payload.uid` is the booking id; also
  `title`, `startTime`, `endTime` (ISO, UTC), `attendees[0].name` / `.email`, `status`.
- `BOOKING_CREATED` → create under `payload.uid`.
- `BOOKING_RESCHEDULED` → the booking gets a **new** `uid`; the old one is
  `payload.rescheduleUid`. Find the row by `rescheduleUid`, set the new times and store the
  new `uid` as its `externalId`. Create it if no such row exists.
- `BOOKING_CANCELLED` → mark the row for `payload.uid` cancelled.

## Calendly

- **Signature:** `{ header: "calendly-webhook-signature", pairs: {}, timestamp: { toleranceSeconds: 180 } }`.
- **There is no screen in Calendly for this**; a webhook is registered through its API. Build
  an admin-only "Connect Calendly" action in the app that reads `CALENDLY_TOKEN` and
  `CALENDLY_WEBHOOK_SECRET` with `secret(env, …)`, calls `GET https://api.calendly.com/users/me`
  (`Authorization: Bearer <token>`) for `resource.uri` and `resource.current_organization`,
  then `POST https://api.calendly.com/webhook_subscriptions` with `{ url, events:
  ["invitee.created", "invitee.canceled"], organization, user, scope: "user", signing_key }`.
  `url` is `new URL(request.url).origin` plus the route path, so it must be pressed on the
  Published app. A 409 means the subscription already exists: report it as connected.
- **App builder:** in Calendly, Profile menu → Developer → Personal access tokens → Create,
  with the scopes `users:read`, `webhooks:write` and `scheduled_events:read`; save it as
  `CALENDLY_TOKEN`. Generate `CALENDLY_WEBHOOK_SECRET` in the secure box (it never leaves
  Stencil — the action sends it). Publish, then press Connect Calendly once.
- **Payload:** `{ event, payload }`. `payload.uri` is the booking id (one invitee); also
  `payload.name`, `payload.email`, `payload.scheduled_event.name` / `.start_time` / `.end_time`.
- A reschedule is **two deliveries**, in either order: `invitee.canceled` with
  `payload.rescheduled: true`, and `invitee.created` with `payload.old_invitee` set.
- `invitee.created` → when `old_invitee` is set, find that row, set the new times and store
  `payload.uri` as its `externalId`; otherwise create under `payload.uri`.
- `invitee.canceled` → when `payload.rescheduled` is true do nothing; otherwise mark cancelled.
- Calendly retries any non-2xx for 24 hours and then switches the subscription off, so a
  handler that keeps failing ends the import until Connect Calendly is pressed again.

## Acuity Scheduling

- **Signature:** `{ header: "x-acuity-signature", encoding: "base64" }`, keyed with the
  account's **API key** (`ACUITY_API_KEY`) — Acuity has no separate webhook secret.
- The body is **form-encoded, not JSON**, and carries only `action` and `id`. Call
  `verifyWebhook(request, signature)` yourself, read `new URLSearchParams(result.rawBody)`,
  then fetch the booking: `GET https://acuityscheduling.com/api/v1/appointments/<id>` with
  HTTP Basic auth, `ACUITY_USER_ID` as the user and `ACUITY_API_KEY` as the password.
- **App builder:** Acuity → Integrations → Webhooks: paste the route's full address.
  Integrations → API shows the User ID and API key; save both in More → Settings → Secrets.
- `id` is the booking id and **stays the same** through a reschedule.
- `scheduled`, `rescheduled`, `changed` → fetch, then find-or-create by `id` with
  `firstName`, `lastName`, `email`, `type`, `datetime` (ISO with offset) and `duration`
  (minutes, sent as a string).
- `canceled` → mark the row cancelled; no fetch needed. Ignore `order.completed`.
- Acuity retries only a 500 or a failed connection, so throw when the fetch or the write fails.
- Acuity limits API access by plan. If the fetch answers 401 or 403 with the right
  credentials, tell the app builder their Acuity plan does not include the API, and offer
  the stopgap below.

## Another booking tool, or no API on their plan

Read the tool's webhook docs and map them onto the `webhooks` skill the same way. When the
tool has no webhook the app builder can use, offer the stopgap and name it as one: forward
the tool's notification emails to the app's inbound address (the `email` skill) and parse
them. It depends on the tool's email wording, so say it can break when that wording changes.

## Chat Agent

"Can I connect Cal.com / Calendly / Acuity?" is a yes: it is a build, so hand it to the
Builder Agent with the tool named and the screen the bookings feed. Open the secure box
with `generate: true` for `CAL_WEBHOOK_SECRET` or `CALENDLY_WEBHOOK_SECRET`; the Acuity
values and the Calendly token come from the tool, so the app builder saves those on the
Secrets page. After the build, relay the tool's "App builder" steps above in their words.
