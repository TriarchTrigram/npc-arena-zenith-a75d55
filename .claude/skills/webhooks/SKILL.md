---
name: webhooks
description: Receiving deliveries an outside service pushes to the app — "when someone submits my Framer form", "when Mux finishes a recording", "when Stripe charges", "when my mailing list unsubscribes someone", "when PayPal pays out", "a webhook from X", "an endpoint for Y to post to", "verify the signature". Use whenever the app needs an address another service POSTs to. Covers the one platform verifier (webhookAction from ~stencil/webhooks), the signature description per sender, naming and typing the secret, and what to tell the app builder.
metadata:
  agents: [chat, builder]
---

# Receiving webhooks

An outside service proves a delivery is genuine by signing it: a keyed hash over the raw
body, in a header, with a secret both sides hold. Most services issue that secret and show
it to the app builder once; some (Zapier, a Worker or script the app builder runs) issue
nothing, so the app builder makes one in Stencil and gives it to the sender. Either way the
app recomputes the hash with the same secret and rejects anything that does not match. The
platform ships that check — **never write it by hand**, and never skip it.

```ts
import { webhookAction } from "~stencil/webhooks";
```

`webhookAction` reads the body as the exact bytes transmitted (before any parsing),
recomputes the hash, compares in constant time, enforces the replay window when the sender
signs a timestamp, and returns 401 when the secret is unset. Each rejection is logged with
its reason and returned in the 401 body, so the sender's delivery log shows why.

## Three things that are always wrong

- **A bearer check.** `verifyPlatformBearer`, `internalAction` and `scheduledAction` verify
  the platform's own `SCHEDULE_TRIGGER_SECRET`. An outside service was never given that
  token and does not send one — it signs. Those helpers are for routes the platform calls.
- **Accepting when no secret is configured.** A route that checks the signature only if a
  secret exists is open to the internet until someone remembers to set it. The verifier
  rejects everything until the secret is saved and deployed; keep it that way.
- **A secret in the address or the code.** Never read the secret from a query string
  (`?secret=`) and never paste it into source. It is read from `env` and nowhere else.

## The route

Register a resource route and describe the sender's signature. Everything in the
description comes from the sender's webhook docs: which header carries the signature, how
the digest is encoded, whether there is a prefix, and what exactly was signed.

```ts
// app/routes/api.webhooks.framer.tsx  — register at "api/webhooks/framer" in app/routes.ts
import { webhookAction } from "~stencil/webhooks";
import { secret } from "~stencil/secrets";
import { joinWaitlist } from "~stencil/waitlist";

type FramerSubmission = { Email: string; Name?: string };

export const action = webhookAction<FramerSubmission>(
  (env) => ({
    secret: secret(env, "FRAMER_WEBHOOK_SECRET"),
    header: "framer-signature",
    prefix: "sha256=",
    // Framer signs the raw body followed by the submission id header.
    signedPayload: ({ body, request }) =>
      body + (request.headers.get("framer-webhook-submission-id") ?? ""),
  }),
  async (submission, { env }) => {
    // The platform waitlist is deduped by address, so a redelivery is a no-op.
    const ok = await joinWaitlist(env, {
      email: submission.Email,
      name: submission.Name ?? null,
      source: "framer-form",
    });
    if (!ok) throw new Error("waitlist join failed");
  },
);
```

The handler receives the parsed JSON payload plus `{ env, request, rawBody }`. A thrown
error returns 500 so the sender retries — which means the same delivery can arrive twice,
so **key the write on the sender's delivery or event id** and make it a no-op the second
time (the platform waitlist above is already deduped by address; a write into the app's own
table keys on `request.headers.get("framer-webhook-submission-id")` with `onConflictDoNothing`). Return normally only once the work is durable: a 200 before the write
lands is a delivery the sender will never resend.

**Never log the payload or `rawBody`**, whole or in part: a delivery carries the sender's
customers' names, addresses and emails, and the app's logs are not where they belong. Log
the event type and the delivery or event id (`console.log("order update", event.type, event.id)`),
which is all a later look needs to find the delivery in the sender's own log.

For a sender that does not post JSON, or when the route must answer with something other
than `{ ok: true }`, call `verifyWebhook(request, signature)` yourself: it returns
`{ ok: true, rawBody, timestamp }` or `{ ok: false, reason, response }` — return the
`response` as-is on failure.

## Signature descriptions

| Sender | Description |
|---|---|
| GitHub | `{ header: "x-hub-signature-256", prefix: "sha256=" }` |
| Stripe (the app builder's own account, not Stencil payments) | `{ header: "stripe-signature", pairs: {}, timestamp: {} }` — signs `${t}.${body}`, header `t=…,v1=…` |
| Mux | `{ header: "mux-signature", pairs: {}, timestamp: {} }` — same shape as Stripe |
| Stencil Events (this or another Stencil app's events, as a destination) | `{ ...STENCIL_EVENT_SIGNATURE }` from `~stencil/webhooks` |
| Framer forms | as in the route above: `prefix: "sha256="`, signed payload is body + submission id |
| Cal.com, Calendly, Acuity Scheduling | in the `booking-imports` skill, with each tool's events and booking ids |

Anything else: read the sender's docs and map them onto the fields. `algorithm` (default
`SHA-256`; `SHA-1` and `SHA-512` exist), `encoding` (`hex` by default, or `base64`),
`prefix`, `pairs` for a `k=v,k=v` header, `timestamp` for a replay window (default 300
seconds; set `toleranceSeconds` to follow the sender's own guidance), and `signedPayload`
when the signed string is not the body alone or `${timestamp}.${body}`. **If the sender
signs a timestamp, configure `timestamp`** — a check without the replay window accepts a
captured delivery forever.

## A sender that does not sign with a keyed hash

Some services prove a delivery another way: PayPal, for instance, posts a certificate-signed
event the app confirms by calling PayPal's verify-webhook-signature API with the app's
**webhook id** and client credentials. `webhookAction` cannot express that, so the route is
written by hand — and it keeps the verifier's exact shape:

- Read every value the check needs (`PAYPAL_WEBHOOK_ID`, the client id and secret) with
  `secret(env, …)`. **If any is unset, return 401 with `{ error: "unauthorized", reason:
  "missing_secret" }` before touching the body**, and `console.error` it so the app builder
  sees a setup problem, not a quiet accept.
- Verify on the raw body (`await request.text()`), and act only after the verification call
  answers success. Any other answer, or a failed call, is a 401 — not a retry of the handler.
- Never substitute a default for a missing value: no `?? "…"`, no `|| "…"`, no "skip the
  check while the id is empty".
- Tell the app builder the same four points as below: the route rejects everything until the
  secrets are saved and deployed.

Stencil's own payments and inbound email never come through here: Stripe events for
Stencil payments arrive via `app/events.ts` (the `events` skill), and inbound mail via the
bearer-gated `api/internal/email-inbound` route (the `email` skill).

## The secret

Name it `<SENDER>_WEBHOOK_SECRET` (`FRAMER_WEBHOOK_SECRET`, `MUX_WEBHOOK_SECRET`), or by
what the sender calls it when it is not a signing secret (`PAYPAL_WEBHOOK_ID`). App secrets
are not on the `Env` type, so `env.FRAMER_WEBHOOK_SECRET` is a type error. Read it with
`secret(env, "FRAMER_WEBHOOK_SECRET")` from `~stencil/secrets`; it is `undefined` until the
app builder sets it. Never cast `env` or redeclare `Env` to get at it.

Never ask for the value in the conversation and never stub it. Write the route against the
exact name and say in your report who makes the value:

- **The sender issues it** (GitHub, Stripe, Mux, Framer and most services): the app builder
  copies it from the sender's webhook settings and saves it in More → Settings → Secrets.
- **The sender issues nothing** (Zapier, the app builder's own Worker or script): the app
  builder makes it in Stencil — the Chat Agent opens the secure box with `generate`, they
  copy the value before saving, then paste it into the sender. The value travels from
  Stencil to the sender, never the other way.

A saved value can never be shown again, in Stencil or in the chat. If the app builder needs
it on the other side and no longer has it, the only recovery is a fresh value saved over the
old one (**Replace value** on the box or the Secrets page) and pasted into the sender again.

## What to tell the app builder

1. **The full address** of the route on their Published app and App preview — the sender's
   settings page needs a complete `https://` URL, not a path. Nothing in the product shows
   it to them, so state it.
2. **The secret's name**, and which way it travels. When the sender issues it, it is shown
   once as the webhook is created and they save it in **More → Settings → Secrets**. When
   the sender issues nothing, they generate it in the secure box, copy it before saving, and
   paste it into the sender. Either way they **redeploy** — a secret changes nothing until
   the app is published again — and the saved value cannot be seen again afterwards.
3. **Until the secret is saved and deployed the address rejects everything** with
   `missing_secret`. That is correct, not broken.
4. **If genuine deliveries are rejected after that**, the sender's delivery log shows the
   reason the app returned. `signature_mismatch` with the body intact almost always means
   the pasted value is not the sender's secret byte for byte — a stray newline, quote or
   space. The app's error log records the body and secret byte counts on each mismatch
   (never the values), so an unexpected secret length is visible there.

## Chat Agent

A webhook is a build: hand it to the Builder Agent with the sender named and what should
happen on each delivery. Do not ask the app builder for the secret in chat. When the sender
issues the value, they save it on the Secrets page; when it does not, call `requestSecret`
with `generate: true` so they mint it, copy it to the sender, and save. After the build,
relay the four points above in the app builder's words. Once their save message arrives,
never tell them to copy the saved value anywhere — it cannot be shown again. If they still
need it on the sender's side, offer a fresh one: Replace value, generate, copy, save, paste.
