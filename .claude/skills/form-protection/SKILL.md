---
name: form-protection
description: Use whenever a signed-out visitor can post or trigger something — a contact, inquiry, quote, booking, application, RSVP, vote or feedback form, a public "try it" AI feature, a public route that sends an email or saves a row — and whenever the app builder asks for spam protection, a bot check, a captcha, a honeypot, a rate limit, "stop the spam", "limit how often someone can submit", or a scan finding says a public route has no limit. Covers guardForm / limitVisitor from ~stencil/form-guard and <FormGuard> from ~stencil/ui/form-guard/fields. Reach for this instead of writing a hidden field, a maths question, a timestamp check, a counter table or an in-memory counter yourself. NOT for an email sign-up or waitlist box (that is <WaitlistForm> / joinWaitlist, already limited, see `landing-page`) and NOT for wrong guesses at a PIN or code (that is limitGuess, see `access-codes`).
metadata:
  agents: [chat, builder]
---

# Protecting a public form from spam

Any form or route a visitor reaches without signing in gets posted to by bots, and by
people who script it. Stencil supplies the protection; never write your own. A hidden
field alone stops almost nothing, a sum the browser checks can be forged, a counter in a
variable is forgotten by every other copy of the app, and a counter the action reads and
then writes lets every request sent at once through.

`~stencil/form-guard` (server-side only) has two calls:

- **`guardForm(env, request, fields, { name, kind?, max?, windowSeconds? })`** for a form. It
  runs the bot check that `<FormGuard>` put in the form, then counts the visitor.
- **`limitVisitor(env, request, { name, kind?, max?, windowSeconds? })`** for anything that is
  not a form a person fills in: a public AI route, a "check availability" call, a vote.
  It only counts the visitor.

Both also cap how much one visitor may send, with nothing to add: a post over 1 MB is
refused, and so is a visitor past 4 MB in one window (see **Size caps**).

Both return `{ ok: true }` or `{ ok: false, reason }`, never throw for a refusal, and are
skipped on the local dev server. The count lives in a platform table in the app's own
database, written in one statement, so it holds across every copy of the app.

## A public form

Three pieces, all required.

**1. The route pack.** `app/routes.ts` spreads `stencilFormGuardRoutes` above the
catch-all. Add the two lines when they are missing:

```ts
import { stencilFormGuardRoutes } from "./.stencil/react-router/form-guard/routes";
// ...
  ...stencilFormGuardRoutes,
```

**2. `<FormGuard>` inside the form**, with the form's name:

```tsx
import { FormGuard } from "~stencil/ui/form-guard/fields";

<Form method="post">
  <FormGuard form="contact" />
  {/* the form's own fields */}
</Form>
```

It renders nothing a person sees. A form posted with `fetch` or `useFetcher` must send
the form's own `FormData` (or copy its `form_note` and `form_guard_token` fields into the
JSON body), or the check has nothing to read.

**3. `guardForm` first in the action**, before parsing, storing, emailing or calling AI:

```ts
import { guardForm } from "~stencil/form-guard";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const form = await request.formData();
  const guard = await guardForm(env, request, form, { name: "contact" });
  if (!guard.ok) {
    // A certain bot gets the same answer a person gets, and nothing is stored or sent.
    if (guard.reason === "bot") return { ok: true };
    // The app builder closed this form in the app's settings: say so, do not ask for a retry.
    if (guard.reason === "closed") return { error: "contact.error.closed" };
    // Every other refusal is shown: a real person can be behind it.
    return { error: "contact.error.tryAgain" };
  }
  // parse with zod, then store / send
}
```

- **The `name` is the same** in `<FormGuard form>` and in `guardForm`. Lowercase letters,
  digits, `-` and `_`. One name per form.
- **`reason: "bot"`** (the hidden field was filled): answer exactly as for a success and
  do nothing. Never tell a bot it was caught. This is the only refusal answered that way.
- **`reason: "unverified"`** (the token is missing, expired, for another form, or was
  posted within two seconds of the page getting it): a real person can land here, on a
  slow connection or a form left open for days, so never answer it as a success.
  `<FormGuard>` retries and renews its token by itself, so sending again works.
- **`reason: "too_many"`** carries `retryAfterSeconds`; **`reason: "unavailable"`** means
  the count could not be kept.
- For those three, store and send nothing, keep what the person typed, and show a plain
  "That did not go through. Please try again in a moment." from `strings.json`.
- **`reason: "too_large"`** carries `maxBytes`, the cap the post or one of its files went
  over. Sending again cannot help, so say what is too big: "That is too large to send.
  Please shorten it or attach a smaller file."
- **`reason: "closed"`** means the app builder switched this form or route off on the
  Public limits page. Store and send nothing, and show a plain "This form is closed right
  now." from `strings.json`, never a "try again".
- With one of the three pieces missing, or two different names, every post is refused as
  `unverified`. Check all three before finishing.
- A JSON body works too: pass the parsed object as `fields`.

## Choosing the cap

The default is 5 uses per visitor per 10 minutes. A route that does something costly says
what it does with `kind`, and the platform sets the stricter cap. Never write those
numbers yourself:

| The route | Pass | The platform's cap |
|---|---|---|
| Contact, inquiry, quote, application | nothing | 5 per 10 minutes |
| Sends an email or a text to an address or number the visitor typed, or adds one to a mailing list | `kind: "mail"` | 3 an hour |
| Runs AI or another service billed per use for a visitor | `kind: "paid"` | 10 an hour |
| Books a slot, claims a seat or a limited spot, reserves a name or a link | `kind: "spot"` | 3 an hour |

`guardForm(env, request, form, { name: "rsvp", kind: "spot" })`

- A route that does two of these takes the kind with the smaller cap: a booking that
  also emails a confirmation is `kind: "spot"`.
- Every public route that sends, spends or claims passes its `kind`. Whenever a build
  touches one that passes none, or that carries hand-picked numbers equal to the kind's
  cap, move it onto `kind`.
- Set `max` and `windowSeconds` only for what no kind covers (a vote, reaction or poll
  is `max: 30, windowSeconds: 600`) or when the app builder asks for a different number;
  they win over the kind's cap. Write them as named constants at the top of the route
  file, so a later "let people submit more often" request is a one-line change.

The numbers in code are the starting point, not the last word. Each limit is listed on
the app's **Public limits** page (More → Settings → Public limits) once it has been used
for the first time, in the App preview or the Published app. There the app builder
changes its number and period, resets it to the numbers in code, or closes the form or
route. What they set there wins over the code and survives every build, so never edit
the constants to undo it. The values sit in the platform table
`stencil_form_guard_limit`, which is read-only to you.

## Size caps

Every `guardForm` and `limitVisitor` call caps size as well as count, before anything is
stored, sent or run. Never write a size check of your own beside them.

| Option | Caps | Default |
|---|---|---|
| `maxBodyBytes` | one post's whole body | 1 MB |
| `maxFileBytes` | each file in a posted form | `maxBodyBytes` |
| `maxWindowBytes` | all a visitor sends in one window | 4 × `maxBodyBytes` |

- The defaults fit a form of text fields. Still give each text field its own length cap
  in zod: 1 MB is the ceiling for the whole post, not a sensible message length.
- **A form that takes files sets the caps on purpose**, to what the form is for, as named
  constants beside `max`: a résumé is
  `maxBodyBytes: 6 * 1024 * 1024, maxFileBytes: 5 * 1024 * 1024`. Leave them out and
  any attachment over 1 MB is refused as `too_large`.
- `guardForm` measures the fields it is given, so a form's cap holds whatever size the
  request claimed. `limitVisitor` reads the size the request declared, and measures a
  body that declares none from a copy, so call it before reading the body.
- A public route that receives files through `handleUpload` (the `storage` skill) calls
  `limitVisitor` first, on every request, and always passes `maxBytes` to `handleUpload`
  (left out, `handleUpload` stores at most 10 MB a file):
  `limitVisitor(env, request, { name: "upload", max: 40, windowSeconds: 3600, maxBodyBytes: 11 * 1024 * 1024, maxWindowBytes: 60 * 1024 * 1024 })`.
  Each part of a file is one request of up to 10 MB, so `max` counts requests, not
  files, and `maxWindowBytes` is what one visitor can upload in the window.
- The visitor's total is counted per `name`, like the count of posts.
- The size caps are set in code only: the Public limits page does not list them.

## A public route that is not a form

```ts
import { limitVisitor } from "~stencil/form-guard";

const limit = await limitVisitor(env, request, { name: "plan-preview", kind: "paid" });
if (!limit.ok) {
  if (limit.reason === "closed") return Response.json({ error: "This is closed right now." }, { status: 403 });
  return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
}
```

Call it first, before the AI call, the lookup or the write. This holds for any route a
signed-out visitor reaches that stores, sends or runs something, whatever its method: a
link that records a click or saves a row when opened is limited the same way.

## What the guard does not do

- **It does not validate.** Still parse every field with zod: an email is an email, text
  has a length cap, and a record id in the request is looked up before a row is written
  under it. A vote for a key the app does not know is refused, not inserted.
- **It does not replace sign-in.** Something only app users may do goes behind
  `requireAuth`.
- **It does not cap the whole form.** The count is per visitor. A route that emails an
  address the visitor typed also follows the `email` skill's rules.

## An app that already has a hand-built guard

When a build touches a public form that has its own honeypot, maths question, timestamp
check, counter table or in-memory counter — or fixes a scan finding about one — move it
onto `guardForm` or `limitVisitor` and delete the hand-built parts, including a counter
table created only for them. Keep anything the app builder sees and uses, such as a Spam
tab over stored submissions.

## How many posts were turned away

The guard counts every post it refuses on the Published app, per day (UTC), per form or
route name and per reason, in the platform table `stencil_form_guard_refusal` (`day`,
`name`, `reason`, `refusals`). It keeps 90 days and holds numbers only: no visitor, no
address, nothing that was posted. When the app builder asks whether the spam protection
is working, how much spam was blocked, or whether real people are being turned away,
read it with one `SELECT` (`queryDatabase` in chat, `dbExecute` in a build):

```sql
SELECT name, reason, SUM(refusals) AS refusals
FROM stencil_form_guard_refusal
WHERE day >= date('now', '-7 days')
GROUP BY name, reason
ORDER BY refusals DESC
```

- **`bot`** is spam stopped by the hidden bot check. It is the protection working.
- **`too_many`** is a visitor over the cap. A handful is normal; many on a busy form,
  such as a booking page, means the cap is too tight for real people: offer to loosen it.
- **`unverified`** is a post with no valid check. Mostly scripts; a steady stream on one
  form can also mean one of the three pieces is missing, so check them.
- **`too_large`** is a post or a file over the size cap. A few on a form that takes
  files means the cap is too small for what real people attach: offer to raise it.
- **`unavailable`** means the count could not be kept, and real people were asked to try
  again. Any of these is worth a look at the app's errors.
- **`closed`** is a post to a form or route the app builder closed on the Public limits page.

Answer in the app builder's words (the contact form, not `contact`), with the period.
"No such table" or no rows means nothing was refused since counting began, which is the
first publish after the build that brought this in; posts in the App preview are not
counted. The table is read-only: never write to it or reset it.

## What to tell the app builder

Say that the form now has Stencil's built-in spam protection: an invisible bot check and
a limit on how often and how much one visitor can submit, with the numbers you chose. Do not promise
that no spam will ever arrive. They can change how often, or close the form, under More →
Settings → Public limits, where it shows after the form is first used; they can also ask
in chat. To change how much one post may carry they ask in chat. They can ask in chat how
many posts were turned away.
