---
name: access-codes
description: Use whenever a page or record should open for someone without an account after they type a short code or password — a gallery or event code, a classroom PIN, a password on a shared page, a members-only area behind one shared password, an invite or booking code, a six-digit code emailed to a client before they open their portal or sign a contract, a passcode an app user sets on their own thing — and whenever the app limits wrong guesses at a PIN or code it checks itself, signed in or not: a vault or parental PIN, a lock screen, a code emailed or texted to confirm an address, "lock after 5 wrong tries", a scan finding about a guess limit. Covers setAccessCode / syncAccessCode / mintAccessCode / verifyAccessCode / limitGuess / forgiveGuess / getAccessPass / revokeAccessPasses / clearAccessCode from ~stencil/access-codes. Reach for this instead of storing a code on a record and comparing it, minting one with Math.random(), or writing an "unlocked" cookie yourself. NOT for signing an app user in (that is a login setting, see `custom-auth` and `login-settings`) and NOT for a link that opens one record with no code typed (that is a long token minted with crypto.getRandomValues, stored by hash, with an expiry).
metadata:
  agents: [chat, builder]
---

# Access codes

An app often wants a thing open to whoever knows a code, with no account: wedding photos
behind a code, a page behind a shared password, a client portal that opens after the
client proves their inbox. Do not build that gate yourself: a hand-built one stores the
code as typed, mints it with `Math.random()`, allows unlimited guesses, or trusts an
"unlocked" cookie anyone can write, and the security scan reports each of those.

`~stencil/access-codes` stores a code one-way under the app's own secret, mints
unguessable ones, limits guesses per record and per caller, and issues an expiring,
revocable pass that dies when the code changes. Its tables are platform-owned: never
read or write them, and never put their names in SQL. Everything here is server-side
only: loaders, actions, resource routes.

**Not for** signing an app user in (a login setting; see `custom-auth`) or a link that
opens one record with no code typed (a long random token stored by hash, with an expiry).

## Two shapes

- **Record plus code.** The URL names the thing (`/events/evt_42`), the visitor types its
  code. Pass `subject` to every call. Two records may share a chosen code.
- **Code names the record.** The visitor types only the code (`/enter` → "ABCD-2345").
  The code must be **minted**, which makes it unique within its purpose; verify without
  `subject` and read the record off `pass.subject`. A chosen code never stands alone.

## Set a chosen code

```ts
const { user } = await requireAuth(request, env);
const event = await getEventOwnedBy(env, eventId, user.id);
await setAccessCode(env, { subject: event.id, purpose: "event-gallery", code: String(form.get("code")) });
```

Check the signed-in app user may change the record first. Setting a code replaces the old
one and withdraws every pass earned under it, so "change the password" is also "kick
everyone out"; say so in the UI. The app cannot read the code back: for "remind me", offer
**set a new one** instead.

## A code the app builder gives in the prompt

"A /party page behind the code 4821": the code is a secret, so it lives in Secrets
(`secret(env, "PARTY_CODE")` from `~stencil/secrets`), never in the source, the strings
file or a record. One small server helper keeps the stored code equal to the secret:

```ts
// app/lib/party-gate.server.ts
export async function syncPartyCode(env: Env): Promise<"ok" | "no code yet"> {
  const code = secret(env, "PARTY_CODE");
  if (!code) return "no code yet";
  await syncAccessCode(env, { subject: "party", purpose: "party-page", code });
  return "ok";
}
```

Call it in **both** places, before anything else looks at the code or the pass:

```ts
// loader
if ((await syncPartyCode(env)) === "no code yet") return { noCode: true }; // set in More → Settings → Secrets
const pass = await getAccessPass(request, env, { purpose: "party-page", subject: "party" });
// action
if ((await syncPartyCode(env)) === "no code yet") return { error: "This page has no code yet." };
const result = await verifyAccessCode(env, request, { purpose: "party-page", subject: "party", code: typed });
```

Tell the app builder to save the code from the prompt as `PARTY_CODE` in **More → Settings →
Secrets**; until then the page says it has no code yet and stays locked. Changing the secret
changes the code and ends every old pass, so the loader must sync too: a visitor who unlocked
under the old code is sent back to the code box on their next visit, even if they never type
again. `syncAccessCode` never counts a guess. Never pass the real code to `verifyAccessCode`
to check it is stored: that counts as a right guess and writes a pass nobody uses.

## Mint a code

```ts
const { code } = await mintAccessCode(env, { subject: booking.id, purpose: "booking-invite" });
// `code` is the only readable copy. Show it once, or email it now.
```

Codes are 8 characters by default (no 0/O/1/I), never fewer than 6. Four digits is a
sweep, not a secret; show a hyphen in the middle if the builder wants it to look short.
To prove an inbox (a client signing a contract), mint a code for the record and send it
**only to the address already stored on the record**, never one typed into the request.

## Verify a typed code

```ts
const result = await verifyAccessCode(env, request, { purpose: "event-gallery", subject: params.eventId, code });
if (!result.ok) {
  return result.reason === "too_many"
    ? { error: `Too many tries. Wait ${Math.ceil(result.retryAfterSeconds / 60)} minutes.` }
    : { error: "That code is not right." };
}
throw redirect(`/events/${params.eventId}`, { headers: { "Set-Cookie": result.setCookie } });
```

`result.setCookie` is what remembers the visitor; put it on the response and nothing
else. A wrong code and a missing record both come back `"wrong"`: show one message.
Wrong guesses are capped at 10 per record and 30 per caller in 15 minutes; a right guess
does not count and does not forgive the wrong ones before it. For the code-names-the-record
shape, omit `subject` and redirect to `result.pass.subject`.

## A wrong-guess limit on a check the app does itself

A PIN a signed-in app user unlocks their own vault with, a code emailed to confirm a second
address: the app compares these itself, and being signed in does not make a guess safe.
Never write the lockout: a counter column read, checked, then written lets every guess
sent at once through, and one that lives in the app's rows resets with a new code, a
re-added row or a closed account. `limitGuess` counts the guess in one statement, in a
platform table, before the compare:

```ts
const { user } = await requireAuth(request, env);
const key = `vault-pin:${section.id}`;
const limit = await limitGuess(env, { key, max: 5, windowSeconds: 15 * 60 });
if (!limit.ok) return { error: `Too many tries. Wait ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
if (!(await pinMatches(section, typed))) return { error: "That PIN is not right." };
await forgiveGuess(env, key); // a right entry does not use up the budget
```

- **`limitGuess` runs first, on every attempt**, before the secret is read or compared,
  and a refusal returns at once. Nothing else counts or resets guesses: no attempts
  column, no "recent failures" query, no reset when a new code is sent.
- **The key names the thing being guessed**: the vault section, or the address a code was
  sent to (`"email-link:" + address.toLowerCase()`), never the pending row or the
  guesser's account, which a guesser can make again. One `key` uses one `max` and window.
- **Size the budget to the secret**: 5 per 15 minutes for a PIN an app user re-enters; 10
  a day (`windowSeconds: 86400`) on the address for a six-digit emailed code.
- **An app that already has a hand-built lockout** is moved onto this when a build touches
  that check or fixes a scan finding about it; drop its counter columns.

A code or password that only opens a page or record still goes through `setAccessCode` /
`verifyAccessCode` above, which limit guesses themselves.

## Gate the page

```ts
const pass = await getAccessPass(request, env, { purpose: "event-gallery", subject: params.eventId });
if (!pass) throw redirect(`/events/${params.eventId}/enter`);
const photos = await db.query.photos.findMany({ where: eq(photos.eventId, pass.subject) });
```

Every loader and action that shows or changes the gated thing checks the pass with the
same `purpose` and `subject`, and queries by `pass.subject`, never by a URL id alone.
`null` means unknown, expired, revoked or changed: redirect to the code screen. Load the
gated content in the loader, not from the strings file or page code, which ship to all.
A "continue as viewer" path gets read-only data in the loader; the action that changes or
signs anything checks the pass itself.

## Revoke and clear

```ts
await revokeAccessPasses(env, { id: pass.id });                                // one visitor
await revokeAccessPasses(env, { subject: event.id, purpose: "event-gallery" }); // everyone, code stays
await clearAccessCode(env, { subject: event.id, purpose: "event-gallery" });    // no code, no passes
```

Put "Change code" and "Remove code" next to the code. A "Leave" button is a POST that
responds with `clearAccessPassCookie(purpose)` in `Set-Cookie`.

## Rules

- **Never store a code anywhere but through this module.** No `password` field on an
  entity, no code in the strings file, in page code, or in a cookie.
- **`Math.random()` never mints a code, a token or an id.** `mintAccessCode` for codes;
  `crypto.getRandomValues` or `crypto.randomUUID()` for anything else.
- **One purpose per kind of thing**, named after it: `"event-gallery"`, `"members-area"`.
  A pass for one is refused by another.
- **`subject` is one row id or one fixed page name**, never a workspace or a list.
- **A gate is a loader or action check**, never a component that hides a tab.
- **Refuse the same way for every failure**: wrong code, no such record, expired pass.
- **Any limit on wrong guesses is `limitGuess`**, signed in or not, never a counter the
  app reads and then writes.
- **Never call `verifyAccessCode` with the real code** (it writes a pass nobody uses).
  `syncAccessCode` stores a code the app already knows.
