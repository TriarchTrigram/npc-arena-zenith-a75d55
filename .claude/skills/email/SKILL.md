---
name: email
description: Use when the app sends or receives email, or when the app builder asks what their app can do with email — what address it sends from, custom email domains, welcome/confirmation/notification emails, digests, an inbox page, reply-by-email, or reacting to incoming mail. Covers answering from the live email identity, sending via createEmail(env).send(), enabling receiving, the inbound webhook scaffold, the mail table, attachments, and threaded replies.
allowed-tools: getEmailStatus createEntity enableInboundEmail
metadata:
  agents: [chat, builder]
---

# Email (send + receive)

Every Stencil app can **send** and **receive** email as a product feature — no email service to sign up for, no API keys, nothing for the app builder to configure. You both answer questions about it and build it in the same turn.

Use `createEmail` from `~stencil/email` — **server-side only** (loaders, actions, the webhook route, scheduled handlers), never from the browser. Everything is proxied through the platform; the sender address is built for you, and the display name is the app's **sender name** unless the app passes `fromName`. The app builder sets the sender name in **More → Settings → General** (it is the app's title until they change it), so never build a sender-name setting into the app.

## Check the live email identity first

**Before answering anything about what the app sends from, receives at, or whether custom email is set up, call `getEmailStatus`.** It reports the app's *current* identity — whether custom email is active, the exact address the app sends from and receives at right now, and any in-progress provisioning. Quote the address it returns. Never recite a generic "you're on the platform address, connect a domain to change it" paragraph without checking: many apps already have a custom domain live, and telling that app builder they can't use it yet is wrong.

Describe email in plain product terms — "sends a welcome email when someone signs up", "an inbox page showing incoming support emails with attachments", "auto-replies to new inquiries and saves each one as a lead". No provider names, no code-level APIs in what you say to the app builder. Never promise anything from the can't-do list below.

**Boundary — app email vs. the app builder's own mailbox.** This skill is about email the **app** sends and receives as a product feature. It is not about the app builder's own connected Gmail. Cold outreach, reply monitoring, follow-ups, and personal briefings run through their Gmail account and its own tools — a different thing entirely. If an ask is ambiguous ("I want to send emails to my customers"), clarify which they mean: them emailing people from their own account, or their app emailing its app users automatically.

## The address

The **domain** is set by the platform — the hostname `getEmailStatus` reports when custom email is live (the app's connected custom domain, or a `mail.` sub-address of it when that domain already carries other email), otherwise the default `mail.hellostencil.com` subdomain (`<mailbox>.<slug>@mail.hellostencil.com`). The **local-part** (before the @) is the app builder's free choice on whichever domain is active — `noreply@`, `admin@`, `hello@`, `support@`, anything. It is not a fixed platform menu, so on a live custom domain `admin@` that hostname is fine: honour it, don't push back.

Inbound is catch-all on the active domain: any local-part reaches the same app, each message labeled with its mailbox name. The mailbox segment is therefore the one thing the app knows about **who a message is for**, and the skill uses it two ways:

- **App-wide mailboxes** (`support@`, `billing@`, `hello@` — and `address.default`, the `noreply` one) belong to the app builder. They are admin-only inboxes, never shown to app users.
- **One address per app user**, when more than one app user receives mail: the mailbox segment is a private per-account token (`k7m2p9x4q1zt.<slug>@mail.hellostencil.com`), and the webhook reads the owner straight from it. See *Who owns an incoming message* below.

## Custom domains

Connecting a domain and setting up email on it are **two separate steps**. `getEmailStatus` reports both — `customEmail` for the email step, `connectedDomains` for the serving step — so read both before you describe anything as missing:

- **Custom email already active** (`customEmail.active`) — the app already sends from and receives on that domain, with any local-part on it. Confirm the current address and honour the request; don't describe connecting a domain as a future step.
- **Domain connected but no custom email** (`connectedDomains` non-empty, `customEmail.active` false) — the common case, and the easy one to get wrong. The domain is **already connected**; do not tell the app builder to connect it. The only missing step is email on it, which they turn on with **Set up email** next to that domain on the app's **Domains page**. Email on their domain is a pending setup step, not a platform limitation — but don't promise the exact address they asked for. Setup checks the domain first: when it already has mailboxes or other email on it (Google Workspace, a newsletter tool), the app's email goes on a sub-address (`tomer@mail.theirdomain.com`) so that email is untouched; only a domain with no other email sends from `tomer@theirdomain.com`. An app builder who says they already have a mailbox on the domain gets the sub-address: say so before they set it up.
- **They want replies in a mailbox they already have** (`hello@theirdomain.com` in Google Workspace) — the app can't send as that mailbox, but it can send people's replies there: set `reply_to` to it on the app's sends. Offer this whenever the app sends from a sub-address or the shared address.
- **No domain connected at all** (`connectedDomains` empty) — only here is connecting a domain the next step. Point them at the app's **Domains page** to connect or buy one, then set up email on it.

Neither step can be done from here — both are app-builder actions on the Domains page.

## What apps can't do

- **No external mail clients.** No IMAP/SMTP access — the inbox lives inside the app itself. Outlook or the Gmail app cannot connect to it.
- **No sending from a domain the app doesn't own.** The guardrail is the **domain**, not the local-part: the app can only send and receive on a domain it has actually connected (or the default `mail.hellostencil.com` subdomain) — never a free-form third-party domain, never the app builder's personal Gmail. The local-part on an owned domain is unrestricted.
- **Not a mailbox service.** This is a product feature for the app's own email, not a general webmail replacement.

## Sending

```ts
import { createEmail } from "~stencil/email";

const email = createEmail(context.cloudflare.env);
await email.send({
  to: "user@example.com",
  subject: "Welcome!",
  html: "<p>Thanks for signing up.</p>",
});

// Custom sender address
await email.send({
  senderName: "notifications",
  to: ["a@example.com", "b@example.com"],
  subject: "New activity",
  text: "You have new activity.",
});

// Sent for one of the app's own app users (a studio, a seller, a coach)
await email.send({
  senderName: "orders",
  fromName: studio.name,
  to: parent.email,
  subject: "Your gallery is ready",
  html: `<p>${escapeHtml(studio.name)} has shared a gallery with you.</p>`,
});
```

- `senderName` is the local-part (e.g. `"notifications"`, `"support"`, `"admin"`); lowercase letters, digits, and hyphens only; defaults to `"noreply"`. The platform builds the full from-address around it — never construct one yourself.
- `fromName` is the display name — the bold name in the inbox. **Pass it whenever the app sends on behalf of one of its app users** (a photographer's studio emailing parents, a seller emailing a buyer, a coach emailing a client): the recipient knows the studio, not the app, and mail from an unfamiliar name gets marked as spam. The platform shows it as `<fromName> via <app title>` (`Bloom Photography via RENZA`), strips quotes, angle brackets and line breaks, and caps it at 60 characters; leave it out and the inbox shows the app's sender name alone. `senderName` still names the mailbox.
- Full params: `to`, `cc`, `bcc`, `reply_to` (each a string or array), `subject`, `html` and/or `text`, `senderName`, `fromName`, `headers` (string record), `tags` (`{name, value}[]`), `marketing` (see "Marketing email and unsubscribe" below).
- Returns `{ id }`; throws on failure with the backend's error text. That text is for `console.error`, never for the screen or a stored row: catch it and return `failed("sending the receipt", err)` from `~stencil/errors`. The `id` only means the platform accepted the email — a bounce arrives minutes later.
- `email.outcomes({ since? })` lists what became of the app's sends, newest first (500 at most): `{ id, to, subject, status: "delivered" | "bounced" | "complained" | "failed", reason, at }`. When the app must know whether a notification landed (an alert someone pays for, a confirmation), match `id` against it in a later scheduled action rather than trusting `send()` alone.

### Marketing email and unsubscribe

Pass `marketing: true` on every email a person could reasonably want to stop: a newsletter, a digest, a promotion, a drip or reminder series, a "come back" nudge. Leave it off mail the person needs because of something they did: a receipt, a booking confirmation, a sign-in code, a password reset, a reply.

```ts
const { id } = await email.send({
  marketing: true,
  to: subscriber.email,
  subject: "This week at the studio",
  html: `<p>${escapeHtml(intro)}</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>`,
});
if (id === null) {
  // This person unsubscribed (or their address bounced). Nothing was sent, and that is not an error.
}
```

With the flag, Stencil does the whole opt-out, so **never build one**: no unsubscribe route or page, no token column, no `unsubscribed` flag the send filters on.

- Stencil signs an unsubscribe link only that recipient can use, writes it wherever the body says `{{unsubscribe_url}}` (under the body when the placeholder is missing), and adds the header that puts an Unsubscribe button in Gmail and Yahoo. Never build that link or header yourself.
- The link opens Stencil's page, which unsubscribes only when its button is pressed. Stencil keeps the opt-out for this app and address.
- Every later `marketing: true` send to that address is skipped and returns `{ id: null }`. Mail without the flag still goes out. App code cannot undo an opt-out, so a sign-up form that takes the same address again does not restart the mail; do not write code that tries.
- One `to` address per send, no `cc` or `bcc`: the link belongs to one person. A list is a loop of single sends.
- The opt-out covers all of the app's marketing email. When the app builder wants per-kind choices ("product news yes, weekly digest no"), keep those switches in the app's own table behind sign-in and filter on them before sending; `marketing: true` stays on those sends so the unsubscribe-all still holds.

The app can send at any server-side moment: a welcome email on signup, an order confirmation, a status update, a scheduled weekly digest. Combined with scheduled actions it can also act on mail automatically — auto-replies, digests of what arrived, routing messages into the app's data — without anyone opening a page.

### Text other people typed never goes into an email raw

An email the app sends is signed by the app, so whatever is inside it is trusted by whoever reads it. Any value that came from someone other than the app builder — a visitor's name or message on a public form, an app user's display name, a product title, a subject typed into a field, a stored record a stranger could have created — is **content, never markup**:

- **In `html`, wrap every such value in `escapeHtml`** from `~stencil/email`. No exceptions for "it's just a name": a name can carry a link, a fake button or a hidden image.
- **`subject` never carries a visitor's raw text.** The platform replaces line breaks with spaces, removes anything that looks like a link and cuts the subject at 150 characters — but bots fill public forms with scam text, and the subject is the first thing a reader trusts. Put at most a cut-short piece of one field in it (a name, to about 40 characters), labelled (`New enquiry from …`), and never a whole field the visitor controls. The full name and the message go in the body, through `escapeHtml`.
- **`to` is never the visitor's choice on a public route.** A public form notifies the app builder or admins at an address the app owns; it does not email "a friend" or "the address you typed". A recipient containing a line break or no `@` is refused with a 400 — let that surface, don't retry.
- **Text an app builder authored** (a template they edit in the app's own admin) may go in as HTML. Only their text — not a placeholder filled from someone else's record, which still gets `escapeHtml`.

```ts
import { createEmail, escapeHtml } from "~stencil/email";

const email = createEmail(context.cloudflare.env);
await email.send({
  to: OWNER_EMAIL, // an address the app owns, not one from the form
  subject: `New enquiry from ${name.trim().slice(0, 40)}`, // a cut-short name, never the whole field
  html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(fromAddress)}) wrote:</p>
         <p>${escapeHtml(message)}</p>`,
});
```

## Acceptable use — what to build, what to decline

App email exists to serve an app's own people. The line is *who the mail goes to and why*, not the words the app builder uses. Judge that; don't scan for keywords. Almost everything real app builders ask for is fine — build it without friction.

**Build it, no questions asked.** Transactional mail to the app's own app users (welcome, confirmation, receipt, password reset), notifications triggered by something happening in the app, a digest or newsletter app users opted into, sent with `marketing: true` so it carries Stencil's unsubscribe link, alerts to the app's own team or admins, an invite an app user sends one person at a time, replies to people who wrote in. Volume alone is never a reason to decline — a big real app-user base sending a lot of mail is a success, not abuse. If they're bumping the daily send limit (the same per-app cap on the shared domain and on a custom domain; a trip shows up as a card on the app's Needs you page under Monitoring), check that nothing public is driving the volume, then point them at connecting a custom domain for a reputation of their own — don't refuse the feature.

**Decline, in one plain sentence, then move on.** These are about mailing people who never joined the app, or hiding that you're doing it: blasting a contact list the app builder uploaded, imported, pasted, or scraped rather than one the app earned through signups; cold outreach or lead-gen to people who never opted in; sending "on behalf of" some third party, or making the mail look like it comes from a brand it doesn't; anything shaped like phishing. Also decline requests to *dodge the rules* — rotating sender names, splitting a blast to slip under a limit, stripping the unsubscribe link, mailing a bought or harvested list — and mail for the classic abuse categories (adult, gambling, crypto/token pumps, unsolicited pharmacy or loans, "you won a prize"). One sentence on why, no lecture, and offer the honest path instead: a signup or subscribe form so people join, or — for a genuine external marketing list — a custom domain plus a real marketing tool, which this feature isn't. Name Flodesk first: it is one of Stencil's four built-in mailing list services, with Kit, ActiveCampaign and MailerLite (the app builder says "connect Flodesk" in chat, and new signups sync to the segments they pick — see the `mailing-list` skill); Mailchimp or similar is the alternative.

**When it's genuinely unclear, ask one question.** The usual ambiguity is whether "email my customers/my list" means the app's own app users or an outside list they'll upload. Ask that once, plainly, and build whatever the answer supports. Don't assume the worst and don't assume the best — just ask.

**Don't be blockish.** Never refuse over a word — "customers", "newsletter", "marketing", "campaign", "bulk" all describe legitimate features. Testing with the app builder's own or a teammate's address is normal. An app on a verified custom domain (`getEmailStatus` → `customEmail.active`) has already cleared a real ownership bar; give it the benefit of the doubt. And never *build a workaround* for something you'd otherwise decline — if it's not okay to send, it's not okay to send from a rotating address either. Point to the custom-domain-plus-external-tool path and leave it there.

### How that lands in the code you write

Take the recipients from a row the app owns — an app user in the users table, a subscriber row that recorded an explicit opt-in (with a consent timestamp), or an address the app collected because that person acted (signed up, placed an order, wrote in). Never wire `email.send` to addresses from an uploaded file, a pasted-in textarea, a scraped page, or an external contacts API.

- **No blast loops.** Don't build a "send to everyone" that iterates an arbitrary table. A digest or newsletter filters on an explicit opt-in column, stored with the time the person opted in, and every message is sent with `marketing: true`: Stencil adds the unsubscribe link and keeps the opt-out, so never hand-build an unsubscribe link or page. Importing a CSV as CRM data the app displays is fine — just don't feed those imported rows into `email.send`.
- **One send, one recipient** (or the small set the app user picked). `to` is not a mailing list; don't use `bcc` to fan a single call out to many addresses.
- **The form's reply never says whether the address was already there.** A subscribe, waitlist or sign-up action a signed-out visitor can reach shows one message for every address and puts the real outcome — welcome, already subscribed, confirm — in the email it sends. A "you're already on the list" notice tells any visitor who has joined.
- **Don't impersonate.** `senderName` names the mailbox the mail comes from (`noreply`, `support`, `billing`) — never a brand or person the app doesn't represent, and don't build a subject or body dressed up as another company. `fromName` is for an app user the app really sends for, and it always arrives as `<fromName> via the app's sender name` (its title until the app builder sets one in More → Settings → General), so it cannot pose as an outside brand either.
- **Surface limits, don't route around them.** If a send throws a rate-limit or cap error, let it surface — never add retry, queue, or spread-over-time logic whose purpose is to slip under the cap.

## Receiving — how it works

Receiving is **push-based**. When it's on, the platform POSTs every email the app receives — any mailbox prefix on the app's shared address (`<mailbox>.<slug>@mail.hellostencil.com`), or any address on a custom email domain — to one trusted route inside the app: `/api/internal/email-inbound`. That route stores the message in the app's **own D1 table**, so mail is ordinary app data: query it, join it with app users or orders, scope it to the app user whose address it arrived at. There is no remote inbox API and nothing to poll.

Two things gate it, and you control both:

1. **The platform switch.** Call the `enableInboundEmail` tool in any turn that builds something which **receives** email (an inbox, reply-by-email, acting on incoming mail). Without the switch the platform **discards** the app's incoming mail, so a freshly built inbox would just sit empty. Never tell the app builder to go find a settings toggle — flip it with the tool. Skip the call for builds that only send.
2. **The webhook route + table**, which you build (below). Mail that arrives before the route exists is parked by the platform and delivered automatically after the next successful publish — nothing is lost.

**Only build receiving when the brief asks for it** ("show incoming support emails", "let users reply by email", "an inbox page"). Don't wire it in otherwise, and don't enable it by default.

## Who owns an incoming message

The webhook runs with no session. The **only** thing that says who a message is for is the address it arrived at — `email.mailbox`. Decide which of two shapes the app is before you write a line:

- **Single recipient** — only the app builder (or their admins) reads mail. One app-wide inbox behind `requireRole(…, "admin")`, no owner column, `address.default` shown on that admin page. Keep it this simple; don't add per-account routing nobody asked for.
- **Several app users receive mail** — photographers each hearing from their clients, coaches from their students, sellers from their buyers. Every one of them gets **their own address** (build step 2), the webhook maps `email.mailbox` → that token → the app user id, and stores it as `owner_id` on the row. The inbox page filters on `owner_id = me`.

Rules that hold in both shapes:

- **Never guess an owner.** No "most recent thread's owner", no "earliest registered app user", no "which account has this sender's email in its contacts". Each of those hands one person's mail — sender name, address, full text — to someone else, who can then reply from their own account. A mailbox that matches no token is stored with `owner_id = null` and is visible only on the admin inbox (or dropped with a `console.warn` if the app has no admin inbox). It is never attributed to anyone.
- **`address.default` is not an app user's address.** It is the app-wide `noreply` mailbox. Show app users their own address and nothing else; a shared address on an app-user screen is exactly what forces the webhook to guess.
- **Thread matching is scoped.** When a reply or a follow-up looks up an existing thread or conversation, the `where` includes the owner — `and(eq(t.ownerId, ownerId), eq(t.threadId, email.threadId))`, or the owner plus the sender address — never the sender address or thread id alone across accounts.
- **Demo and test modes never touch routing.** A demo switch may stop sends or show sample rows; it may not change who owns a message or where one lands.

## Say it to the app builder

This is the Chat Agent's job, in the same reply that hands the build to the Builder Agent, every time receiving is built or changed — without being asked. Plain product words only (see "Describe email in plain product terms"): no "webhook", no "owner column", no "token".

1. **Name the shape you picked.**
   - Single recipient: "Only you and your admins read the mail that comes in — it lands in one inbox for the whole app."
   - Several app users: "Each of your photographers gets their own private incoming address. Mail is sorted by the address it arrived at, so one photographer can never see another's."
2. **Say the app never guesses who an email is for.** "If an email arrives at an address that doesn't match anyone, it goes to your admin inbox — it is never put on someone's screen."
3. **Unclear who reads the mail? Ask first.** When the request doesn't make it obvious whether only the app builder reads incoming mail or several app users do, ask once with `askUserQuestion`, offering the two shapes in the words above, then build on the answer.

**Name the shape in the brief.** The brief handed to the Builder Agent says "single recipient" or "several app users receive mail" in so many words, so the Builder Agent builds the shape the app builder was told and never re-derives it.

## Receiving — build steps

### 1. Create the mail table

Create an entity with the fixed slug `messages` via `createEntity` (the standard entity flow — check `/home/user/app/app/generated/db-schema.ts` first and only create it if the slug is absent).

Fields (the platform `id` primary key, `created_at`, and `updated_at` are added automatically — don't declare them):

| field | type | notes |
|---|---|---|
| `mailbox` | text | local-part routing segment (e.g. `"support"`, or an app user's token) |
| `owner_id` | text | the app user whose address this arrived at; null for app-wide mailboxes. Several-recipients shape only |
| `from_address` | email | sender address |
| `from_name` | text | sender display name |
| `subject` | text | |
| `text` | text | plain-text body |
| `html` | text | HTML body |
| `thread_id` | text | stable thread key — echo it in replies |
| `received_at` | datetime | ISO-8601, from the payload |
| `read_at` | datetime | app-owned read state (set it from your own action) |

Add whatever the feature needs on top (status, handled flag). The row's `id` is supplied at insert time with the platform email id (`ie_…`), which is what makes redelivery idempotent.

### 2. Give each app user their own address (several-recipients shape only)

Skip this step in the single-recipient shape. Otherwise create an entity with the fixed slug `inboxes` via `createEntity`, one row per app user: `user_id` (text) and `token` (text). The platform `user` table is not yours to extend, so the token lives here. Create the row lazily the first time the app user opens their inbox, from one helper in `app/lib/inbox.server.ts`:

```ts
import { eq } from "drizzle-orm";
import type { createDb } from "~stencil/db";
import { inboxes } from "~/generated/db-schema";

type Db = ReturnType<typeof createDb>;

// Lowercase letters and digits only: email local-parts are matched case-insensitively,
// and a dot would be read as the mailbox/slug separator.
function newToken(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function getOrCreateInbox(db: Db, userId: string) {
  const [existing] = await db.select().from(inboxes).where(eq(inboxes.userId, userId));
  if (existing) return existing;
  const now = new Date().toISOString();
  const row = { id: crypto.randomUUID(), userId, token: newToken(), createdAt: now, updatedAt: now };
  await db.insert(inboxes).values(row);
  return row;
}

/** The app user's own inbound address, built from the platform's pattern — never by hand. */
export function inboxAddress(pattern: string, token: string): string {
  return pattern.replace("<mailbox>", token);
}
```

The token is the app user's private address, so treat it like one: show it only to its owner, and never list all tokens on a screen.

### 3. Create the webhook route — copy this file exactly

Create `app/routes/api.internal.email-inbound.tsx` with the content below and register it in `app/routes.ts`:

```ts
route("api/internal/email-inbound", "routes/api.internal.email-inbound.tsx"),
```

**DO NOT change the auth block.** The `env.SCHEDULE_TRIGGER_SECRET` bearer check is the only thing stopping the public internet from writing to the app's inbox. Adapt only the insert columns (if you added fields) and the "your app's logic" seam. In the single-recipient shape, drop the `inboxes` import, the owner lookup, and the `ownerId` column — nothing else.

```tsx
import type { Route } from "./+types/api.internal.email-inbound";
import { createDb } from "~stencil/db";
import { failed } from "~stencil/errors";
import { eq } from "drizzle-orm";
import { messages, inboxes } from "~/generated/db-schema";

/** The push payload the platform sends. Attachment BYTES never ride it — fetch
 *  them server-side with `createEmail(env).getAttachment(id, index)` and re-serve
 *  from your own route (`path` is an internal, bearer-gated backend path). */
type InboundEmailPayload = {
  /** Platform email id (`ie_…`). Use it as the row's primary key. */
  id: string;
  /** The full address the mail arrived at. */
  recipient: string;
  /** The local-part routing segment (e.g. "support"). */
  mailbox: string;
  from: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
  /** Stable thread key — echo it in replies (see the reply note below). */
  threadId?: string;
  attachments: Array<{ filename: string; contentType?: string; size?: number; path: string }>;
  /** ISO-8601 timestamp. */
  receivedAt: string;
};

/** Constant-time string compare so the bearer check can't be timed byte-by-byte. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;

  // Fail closed: with no configured secret there is nothing to authenticate
  // against, so no caller can be trusted. (In production the platform always
  // injects it; this only trips in local dev without the binding.)
  const expected = env.SCHEDULE_TRIGGER_SECRET;
  if (!expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token || !timingSafeEqual(token, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = (await request.json()) as InboundEmailPayload;
  const db = createDb(env);

  try {
    // The address it arrived at is the only evidence of who this mail is for. No
    // matching token means an app-wide mailbox (or a stale one): the row stays
    // unowned and admin-only. Never fall back to a guess.
    const [inbox] = await db
      .select({ userId: inboxes.userId })
      .from(inboxes)
      .where(eq(inboxes.token, email.mailbox.toLowerCase()));
    const ownerId = inbox?.userId ?? null;

    // Idempotent on the platform id — a redelivery of the same email no-ops here
    // instead of inserting a duplicate.
    await db
      .insert(messages)
      .values({
        id: email.id,
        mailbox: email.mailbox,
        ownerId,
        fromAddress: email.from,
        fromName: email.fromName ?? null,
        subject: email.subject ?? null,
        text: email.text ?? null,
        html: email.html ?? null,
        threadId: email.threadId ?? null,
        receivedAt: email.receivedAt,
      })
      .onConflictDoNothing({ target: messages.id });

    // --- your app's logic here -------------------------------------------------
    // Notify the owner, kick off a workflow, etc. Any thread lookup here filters
    // on ownerId as well — never on the sender address alone.
    // ---------------------------------------------------------------------------
  } catch (err) {
    // A non-2xx tells the platform to retry (and eventually park with evidence),
    // so surface real failures — but never throw past here.
    return Response.json(failed(`inbound email ${email.id}`, err, "handler failed"), { status: 500 });
  }

  return Response.json({ ok: true });
}
```

Delivery is **at-least-once and retried** — the same email can arrive twice, which is why the insert is keyed on the platform `id` with `onConflictDoNothing`. Keep the handler fast: store the row, do light follow-up work, return 200. A non-2xx makes the platform retry and eventually park the mail; parked mail is redelivered after the app's next successful publish.

### 4. Read mail like any other app data

An app user's inbox is a loader querying your own table, scoped to them, and showing **their** address:

```tsx
// app/routes/app.inbox.tsx  (register in routes.ts)
import type { Route } from "./+types/app.inbox";
import { createDb } from "~stencil/db";
import { messages } from "~/generated/db-schema";
import { createEmail } from "~stencil/email";
import { requireAuth } from "~stencil/auth/server";
import { getOrCreateInbox, inboxAddress } from "~/lib/inbox.server";
import { desc, eq } from "drizzle-orm";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const db = createDb(env);
  const [items, inbox, address] = await Promise.all([
    db.select().from(messages).where(eq(messages.ownerId, user.id)).orderBy(desc(messages.receivedAt)).limit(50),
    getOrCreateInbox(db, user.id),
    createEmail(env).address(),
  ]);
  return { items, address: inboxAddress(address.pattern, inbox.token) };
}
```

The admin inbox is the same loader behind `requireRole(…, "admin")`, filtering `isNull(messages.ownerId)` and showing `address.default` — that is the only screen `address.default` appears on. In the single-recipient shape the admin inbox is the whole feature: no `where` on owner, no `inboxes`.

- **Never build the address by hand** — the platform owns the domain, so always read `address()` and substitute the token into its `pattern`; in chat quote `getEmailStatus` rather than constructing or promising an address.
- Read/unread is your column: set `read_at` from your own action when a message is opened. `owner_id` is set by the webhook from the mailbox and by nothing else — not by the page that reads it, not by a later "claim" action, not inferred.

## Replies that thread correctly

`send()` has no reply parameter. A bare `Re: …` reply starts a NEW thread in the recipient's mail client. To land the reply in the sender's existing thread, echo the stored `thread_id` in the RFC-2822 headers — do this in every reply-to-inbound flow, auto-replies included. Load the message being replied to with the owner in the `where` (`and(eq(messages.ownerId, user.id), eq(messages.id, id))`), so one app user can never reply to another's mail:

```ts
await email.send({
  to: msg.fromAddress,
  subject: `Re: ${msg.subject ?? "your message"}`,
  text: "Thanks — we'll get back to you shortly.",
  ...(msg.threadId && {
    headers: { "In-Reply-To": msg.threadId, References: msg.threadId },
  }),
});
```

## Attachments are never public links

Attachment bytes stay in platform storage — the webhook payload carries only metadata, and each attachment's `path` is an internal, bearer-gated backend path, **not** a URL. You cannot put it in an `<a href>` or `<img src>`. To show an attachment to an app user, fetch the bytes **server-side** with `getAttachment(id, index)` (`id` = the platform email id, `index` = the attachment's position in the payload's `attachments` array) in a resource route of your own and re-serve them through `untrustedFileResponse`:

```tsx
// app/routes/app.attachment.$id.$index.tsx  (register in routes.ts)
import type { Route } from "./+types/app.attachment.$id.$index";
import { createEmail } from "~stencil/email";
import { untrustedFileResponse } from "~stencil/storage";
import { requireAuth } from "~stencil/auth/server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request, context.cloudflare.env);
  const email = createEmail(context.cloudflare.env);
  const res = await email.getAttachment(params.id, Number(params.index));
  // Shows images and PDFs inline, downloads everything else; pass `downloadAs` to always save.
  return untrustedFileResponse(res.body, res.headers.get("Content-Type"));
}
```

**An attachment is a file a stranger chose.** Anyone can email the app, and an attached web page or SVG opened from the app's own address would run the sender's script as whoever opened it — the app builder reading the inbox, most likely. `untrustedFileResponse` keeps only known-safe types inline and forces the rest to download with type guessing off; never rebuild the response headers yourself, and never copy the upstream `Content-Type` into a `new Response(...)` of your own.

Store the payload's `attachments` metadata in your table (a `json` field) if the UI needs filenames/sizes, and link to *your* route, never to `path`.

## When an email arrives wrong

When the app builder says an email arrived broken — missing bullets, a dead link, a button rendered as text — the ground truth is what was actually sent, not the template and not the code. Read the app's own sent-email records with `dbExecute` (the table name is in `app/generated/db-schema.ts`) and compare the sent HTML with the stored template. The difference is the bug.

- **Emails take several paths.** Sent by hand, from a template, through a workflow, after an approval or edit step, and scheduled. Find which path the broken one took and follow that path. A fix on one path says nothing about the others; check each one the app has before you describe what is covered.
- **Review and approval steps rewrite markup.** A step that loads a body into an editor and saves it back can flatten lists, drop links, or turn buttons into text, and it often stores a per-recipient copy that later sends use first. Check for such stored copies and repair any the bug already changed — the code fix alone leaves them broken.
- **Confirmed means a sent record, sent after the fix, has the expected markup.** Read it back from the table. If no send can happen during the turn, tell the app builder exactly which email to send themselves and what to look for in it, and say what you changed rather than that it is fixed.
