---
name: custom-auth
description: Any change to how the app itself handles sign-in in app code — magic link, email OTP, passwordless, custom login/signup flows, "restyle the login page", "make the sign-in page match my brand", "login goes to the upgrade page", "the login page disappeared", where a Sign in link should go, auth hooks, "email me a code", "change my email", "change my password", "edit my name/photo", account settings, profile page, "where do my users manage their account", a public profile other people can open ("member profiles", "seller page", "see who posted this"), two-factor ("2FA", "authenticator app", "TOTP", "backup codes"). Load BEFORE touching auth code. NOT for which sign-in methods the app offers, whether signup is open, or the hosted sign-in page's wording, logo and colours (settings — see `login-settings`), and NOT for beta testers or adding named people (see `app-users`). Email+password, Stencil OAuth, magic link and email OTP already ship on the platform's auth and its `~stencil/auth/browser.client`; you almost never need new auth code, and must NEVER call betterAuth() or createAuthClient() yourself — a parallel instance silently severs signup tracking and email sync.
metadata:
  agents: [chat, builder]
---

# Custom auth

The platform layer (`app/.stencil/auth/`) owns authentication. Its `createAuth`
already ships, enabled and wired to the app's email sender:

- **Email + password** (`emailAndPassword`)
- **Stencil OAuth** (the "continue with Stencil" flow)
- **Magic link** (`magicLink` — passwordless sign-in links)
- **Email OTP** (`emailOTP` — one-time sign-in codes)

A request for "magic link login", "sign in with a code", "add Google sign-in" or "turn
off passwords" is a **settings change, not app code**: the `login-settings` skill sets it
from chat (the app builder can also do it in More → Users → Sign-in options). The
hosted sign-in page reads that setting live and renders exactly those methods, with no
rebuild. Do not build a login form for it.

## One sign-in page per app

Stencil hosts the app's sign-in and sign-up pages at `/login` and `/signup`. The
dispatcher serves them before the app runs, they render the login methods from the
app's settings, and every platform redirect for a signed-out visitor (`requireAuth`,
`data()` with `requireUser`, a gated route) lands on `/login`. So every "Sign in" or
"Create account" control the app renders links there:

```tsx
<Link to="/login">Sign in</Link>
<Link to="/signup">Create account</Link>
```

Never point a Sign in control anywhere else, and never register `/login`, `/signup`,
`/forgot-password` or `/reset-password` in the app — the template's catch-all hands
those paths back to the dispatcher. "The login page isn't pretty", "make it match my
brand", "change what it says", "put my logo on it", "add a background image" or "make
it dark" is not a reason to build a page either. The hosted page inherits the app's
`theme.css`, and its own look is a **setting**, read live with no rebuild (from chat, the
`login-settings` skill sets it):

- **Wording**: the sign-in and sign-up heading and subtitle — `configureAuth` with
  `loginPage.heading`, `subtitle`, `signupHeading`, `signupSubtitle` (an empty string
  resets to the stock wording). Use this for "say *Welcome to Studio X*", a tagline, or a
  line that explains the app.
- **Logo on the card**: `loginPage.showLogo: true` shows a logo above the heading: the
  card logo the app builder uploaded in More → Users → Sign-in options → Sign-in page
  (a wide wordmark fits; it renders 48px tall at its own shape), or the app's icon when
  none is uploaded.
- **Colour scheme**: `loginPage.colorScheme` — `light` (default), `dark`, or `auto` to
  follow the visitor's device. `dark` and `auto` only take effect when the theme has a
  `.dark` palette; an app without one keeps the light page, so add the palette first
  (`editTheme`) if the builder wants a dark sign-in.
- **Background image and card logo file**: uploaded by the app builder in More →
  Users → Sign-in options → Sign-in page. Tell them where; do not build a page to get a
  photo behind the card.

A Sign in link that lands on the upgrade page, the home page or a 404 is a routing
fault — a link to some other path, or an app-owned splat route that predates the
catch-all (see the layer manifest) — never a missing page. The hosted `/login` always
exists, and the layer turns every in-app link to it into a full navigation. Fix the
link or the route table; never build a login page as the repair.

So for a brand request: fix the theme (`editTheme`) and the logo, set `loginPage`,
then check `/login`. The same wording, logo, background and colour scheme also apply to
the forgot-password and reset-password screens.

An app-authored sign-in page is the exception, built only when the app builder
explicitly asks for a sign-in page with a different layout. When you build one:

- Put it at a path of its own (for example `/sign-in`), never a reserved path.
- Call `getAuthConfig` first and render exactly the methods it returns, through
  `~stencil/auth/browser.client`. Every call is already on that one client:
  - password: `signIn.email({ email, password, callbackURL })`
  - magic link: `signIn.magicLink({ email, callbackURL })` sends the link; the link
    itself signs the app user in and lands on `callbackURL`
  - one-time code: `emailOtp.sendVerificationOtp({ email, type: "sign-in" })` sends
    the code, then `signIn.emailOtp({ email, otp })` signs in
  - Google: `signInWithGoogle({ callbackURL })`

  `callbackURL` is a plain path on this app, such as `/dashboard` or `/pricing?plan=pro`.
  The sign-in library refuses one whose path holds `#`, `~`, `:`, `,`, `!`, `*`, `(`, `)`,
  `;`, `$`, a space or a `%`-escape ("Invalid callbackURL"), so never pass a section link
  (`/pricing#plan`): pass `/pricing` and let that page scroll to the section itself.

  Offering a method the settings do not, or hiding one they do, is a defect in your
  change. So is a hand-written `fetch` to `/api/auth/*` or a second `createAuthClient()`
  (see the hard rule below).
- Point every Sign in control in the app at that one page, so the app has one entry
  point it links to.
- Say in the build summary that platform redirects for signed-out visitors still open
  the hosted `/login`, and that a later change to the login methods needs a rebuild of
  this page, since only the hosted page reads the settings live.

An app that already has a page like this (built before this rule, or on request) drifts
from the Login settings the moment the app builder changes them: a newly switched-on
method never appears, and the wording, logo, colour scheme and background set there never
reach it. Whenever a request touches that page or the app builder asks why a setting is
not showing on it, offer to retire it: remove its route, delete the page, and point every
Sign in control at `/login` and `/signup`. Only rebuild the page to match the settings if
they decline, and repeat the rebuild caveat. An app that runs its own accounts and
sessions beside the platform's is a bigger move; say so in the summary rather than
retiring the page by yourself.

## The one hard rule

**Never call `betterAuth()` yourself, and never bypass or reimplement the layer's
`createAuth`.** The layer's auth carries `databaseHooks` that report every signup
and session to the platform. A parallel Better Auth instance looks identical to
the app user but silently severs the app from:

- the platform's app-user analytics (the builder's App users tiles stop updating), and
- the builder's Flodesk email-marketing sync.

Nothing errors. The data is simply gone, permanently. Deploys warn when a bundle
has auth but lost this wiring — treat that warning as a defect in your change.

The same rule covers the browser: **never call `createAuthClient()` yourself.**
`~stencil/auth/browser.client` is the app's only auth client and already carries every
method above plus change-email, change-password, update-user, revoke-other-sessions and
the two-factor redirect. A second client against the
same `/api/auth/*` backend skips the two-factor and Google popup handling and has locked
app builders out of their own apps; a method you think is missing is platform work (see
the end of this skill).

## Extension points that ARE yours

- **Hooks on auth events** (welcome flows, provisioning a profile row, sending a
  notification): create `app/auth-hooks.server.ts` default-exporting Better Auth
  `databaseHooks` (or `(env) => databaseHooks`). The layer merges them over its
  own — both run, platform first. Never edit `app/.stencil/auth/` for this.
  A `user.create.before` hook that decides who may sign up must refuse with
  `refuseSignup("…")` from `~stencil/auth/hooks` — never a bare `return false` or a
  thrown error — and must start with `if (isPlatformGrant(ctx)) return;`: the app
  builder's own **Add person** creates the account through the same hook, and a
  rule that does not step aside for it blocks the builder from adding anyone.
- **Login/signup UI**: the hosted pages, unless the app builder explicitly asked for
  a page of their own (see "One sign-in page per app"). On an app-authored page, a
  "Continue with Google" button must call `signInWithGoogle({ callbackURL })` from
  `~stencil/auth/browser.client`, never `signIn.oauth2` directly: the App preview runs
  the app in a frame and Google refuses to load in one, so the helper opens Google in a
  popup and resolves with `{ error }` (`null` on success, an error code such as
  `signup_disabled` for the page to show). An app-authored sign-up or waitlist form
  answers the same way whether or not the address already has an account: never show
  "an account already exists" or "no account for this email" — show "check your inbox"
  either way and let the email carry the outcome (a sign-in link for an existing
  account), as the hosted pages do.
- **Gating signups**: the app's `allowSignup` setting already controls whether the
  passwordless methods accept unknown addresses — don't rebuild it.
- **Requiring a verified email**: "make people verify their email", "block unverified
  accounts", "confirm the address before they can log in" is the app's **Require email
  verification** login setting (the `login-settings` skill from chat, or More →
  Users → Sign-in options), not app code. With it on, the platform sends the
  verification email at password sign-up, refuses sign-in until the link is opened, and
  the hosted login page shows a resend button. Magic link, one-time code and Google
  already prove the address. Never build a verification table, a verify screen or a
  per-route `emailVerified` gate to get this; flip the setting and stop. If the app has
  its own login form, `signIn.email` returns `EMAIL_NOT_VERIFIED` (403) while the account
  is unverified — show "check your inbox" and offer `sendVerificationEmail`.
- **Roles and admin screens** (admin, staff, "only I can see", "view as"): see `app-roles`.
- **Changing an app user's email**: the layer already supports it — build the form, see below.
- **Two-factor authentication**: the layer ships the enrolment and challenge pages — link to
  them, see below.
- **A first password for an account that has none** (a pay-first buyer, a magic-link or
  one-time-code account): link to the layer's `/auth/set-password?next=/app`. Never set a
  first password from the browser — `~stencil/auth/browser.client` has no `setPassword`, the
  call answers 404 and every password "fails" — and never hand-build a set-password page.

## The account page every app already has: `/auth/account`

"Where do my users change their password / email / name / photo?", "add a profile page",
"account settings", "my users need to manage their account": the platform-owned page at
**`/auth/account`** already does it, registered by the auth route pack and themed like the
rest of the app. A signed-in app user edits their name and photo (stored in the app's own
storage, served from `/auth/account/photo/*`), changes their sign-in email (approval and
confirmation mail included), changes their password — or, if they sign in without one, is sent
to `/auth/set-password` to choose a first one — signs out every other device, reaches
two-factor setup, signs out, and closes their account (billing-aware, as below). Nothing to build: **link to it from
the app's account menu**, next to Sign out:

```tsx
<Link to="/auth/account">Account</Link>
```

Only when the app builder explicitly asks for account settings in their own layout (extra
profile fields, their own design) do you build a screen — on the same exported calls
(`updateUser`, `changePassword`, `changeEmail`, `revokeOtherSessions` from
`~stencil/auth/browser.client`), with the stock page still reachable. A password control that
does not call `changePassword`, or an email control that does not call `changeEmail`, is a
fake and must never ship. Read `user.name` and `user.image` from `useAuth()` for the avatar.
`user.image` holds the Google photo for an app user who signed up with Google, or the photo
they set on the account page; show initials when it is null, and never say there is no
profile photo.

## A public profile other people can open: `/profile/:userId` (opt-in)

A directory, marketplace, community or client portal needs the other half: a page where
*other people* see an app user's name and photo. The platform ships it switched **off**.
Turn it on only when the app builder asks for profiles other people can see, because from
then on anyone with the link, signed in or not, sees that app user's name and photo. Say
so when you turn it on. It never shows an email.

Switch it on by spreading the pack into `app/routes.ts`, above the catch-all:

```ts
import { stencilPublicProfileRoutes } from "./.stencil/react-router/profile/routes";
// ...
  ...stencilPublicProfileRoutes,
```

Then link each name or avatar to `/profile/${person.id}`. The page reads the same name and
photo `/auth/account` edits, and shows the owner an edit link back to it.

To add a bio, links or listings, or to change the look or who may open it, write the app's
own route instead of spreading the pack, on the same two pieces, and never hand-build the
lookup or a second photo route:

```tsx
import { getPublicProfile } from "~stencil/auth/public-profile";
import { PublicProfileCard } from "~stencil/ui/auth/public-profile";

export async function loader({ params, context }: Route.LoaderArgs) {
  const profile = await getPublicProfile(context.cloudflare.env, params.userId);
  if (!profile) throw new Response("Not Found", { status: 404 });
  return { profile /* plus the app's own rows for this person */ };
}
// <PublicProfileCard profile={profile}>…bio, links, listings…</PublicProfileCard>
```

`getPublicProfile` returns `{ id, name, image }` only. Extra profile fields live in the
app's own table keyed by the app user's id, with an access rule that fits who may read
them. For signed-in app users only, call `requireAuth` first in that loader.

## App-authored account settings: close my account

The stock page carries "Close my account" already. An app that builds its own account
settings ships the same control, behind a confirmation, without being asked. The app
builder may remove it; that is a normal app change. The platform owns the mechanism, the
app owns the screen:

- **Sign out** — `<SignOutButton>` in UI; `signOut(request, env, redirectTo?)` from
  `~stencil/auth/server` when server code must end the session (it throws the redirect, so
  call it last in the action). Never hand-roll the sign-out replay.
- **Close my account** — `closeAccount(request, env, redirectTo?)` from
  `~stencil/auth/server`. The platform deletes the account and every session, then signs the
  browser out. It returns `{ error, code }` when the account was left intact — show `error`.
  Never delete from the `user` table yourself: the layer owns that table.

**Closing never touches billing.** A subscription that will charge again blocks the close
with `code: "active_subscription"` and the message "You have an active subscription. Cancel
it first in Manage billing." Render that message with a Manage billing button whose action
calls `manageSubscription` (payments skill), so the app user cancels in the billing portal
and comes back to close. Once the subscription is cancelled, even one that runs to the end
of the paid period, the close goes through. Never cancel a subscription as part of closing
an account, and never write to the `subscription` table.

```tsx
import { requireAuth, closeAccount } from "~stencil/auth/server";
import { manageSubscription } from "~stencil/payments/server";

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "billing") {
    await manageSubscription(request, context, new URL("/app/settings", request.url).toString());
  }
  // Redirects on success; returns { error, code } when the account was left intact.
  return closeAccount(request, context.cloudflare.env, "/");
}

// In the component: a "Close my account" button that reveals a confirm form posting
// intent=close; on actionData?.error show the message, and when
// actionData?.code === "active_subscription" also a form posting intent=billing.
```

A grace period, a deletion request, a reactivation path, or what happens to the records the
app user created are the app's own design, built on top of `closeAccount`, not a reason to
skip it.

## Letting an app user change their email

"Let me update my email", "my login email changed": `/auth/account` already has the form, so
the answer is usually a link. On an app-authored account-settings page it is a **UI
change**: the layer's auth already exposes Better Auth's `changeEmail`, and the approval
and confirmation emails are already themed and wired. Build a form that calls it from the
client:

```ts
import { changeEmail } from "~stencil/auth/browser.client";

const { error } = await changeEmail({ newEmail, callbackURL: "/settings" });
```

What happens next is the platform's, not yours:

- **Verified account** (signed in by magic link, code, or Stencil): an approval email goes
  to the **current** address. Approving it sends a confirmation link to the new address;
  clicking that switches the email and signs the browser in with it. Tell the app user to
  check their *current* inbox first — the new one gets nothing until they approve.
- **Unverified account** (email + password, never verified): the confirmation link goes
  straight to the new address, since the old one was never proven to be theirs.
- A new address that another account already uses returns success with no email, so
  address existence is not leaked. Show "check your inbox" either way.
- The call needs a recent sign-in. If it fails with a session error, send the app user
  back through login and retry — don't build a workaround.

**Anything keyed on email re-keys when the email changes.** Admin allow-lists, "the app
builder's address is the admin", client portals matched by email, invites, seller and
buyer lookups by `buyerEmail`: after a change, an app user that was matched by their old
address is a stranger to that rule. Before adding this form to an app, grep the app for
email-based checks and either move them to `user.id` (store the id at first match, as
`app-roles` and `workspaces` already do) or tell the app builder in the build summary
exactly which rules still match by email and will stop matching after a change. Never
silently ship a change-email form into an app whose admin gate is an email allow-list.

## Beta testers and test accounts are never app code

"Add these people as beta testers", "let my testers in", "create accounts for my test group", "only
these emails can sign in": every one of these is a **Users-page action, not a build**. The app
builder adds each person from **More → Users → Add person**, which creates a
real account in the app's own auth table and emails a sign-in link (on a pay-first app it also puts
them on a plan without paying, with an optional end date). The same page takes a tester out again
later with **Delete user** or **End free access**, with no build. Closing signups to everyone but
the testers is the invite-only login setting (`login-settings`), also no build.

So never seed tester accounts with `dbExecute`, never write an allowlist of emails or a
hard-coded list of testers, and never add a "beta" flag, table or gate to hold them. People who
live in code clash with the hosted login (the platform refuses unknown addresses on a closed app,
so a hand-built invite link dead-ends on "Signup Disabled") and cost a build to remove. When a
brief asks for it, build the rest of the brief, leave the testers out, and say in the build
summary that the app builder adds them from the Users page. When the Chat Agent is asked, it loads
`app-users`, which sends the app builder there with the Open Users settings button instead of
handing off a build. The same page sets each app user's **Role**, so making someone an admin,
staff or affiliate on an app that already gates on that role is a Users-page action too (see
`app-roles`), never a build that writes a role into the app's data.

## One-click sign-in from the app builder's other system

"When someone buys on my Shopify store, send them straight into the app, signed in",
"log the buyer in from the thank-you page", "sign people in from my other system": this is
a **signed sign-in link**, and the platform already ships it. Never build a login token,
an order-token endpoint or an onboarding page for it, and never call `grantAccess`.

1. The app builder saves a secret named `SIGNED_SIGN_IN_SECRET` in More →
   Settings → Secrets. Without it every signed link is refused. Tell them in the build summary.
2. App code mints a link with the layer helper:

   ```ts
   import { signedSignInLink } from "~stencil/auth/signed-sign-in";

   const url = await signedSignInLink(env, {
     email: buyer.email,
     next: "/app/welcome", // a path on this app; defaults to /app
     origin: new URL(request.url).origin,
   });
   ```

   An outside system mints the same link itself:
   `https://<app host>/sign-in/signed?email=…&exp=<unix seconds>&next=<path>&sig=<hex>`
   with `sig = HMAC-SHA256(secret, email + "\n" + exp + "\n" + next)`, `exp` at most
   15 minutes ahead.
3. The link opens the platform's own page with one Continue button. Tapping it creates
   the account if needed (also on an invite-only app, since the app builder vouched by
   signing), signs the person in with no welcome email, and sends them to `next`. Each
   link is single use; a removed address is refused with a page that says so.

## App user accounts belong to the app, not to Stencil

An app user's account — email, password, sessions, second factor — lives in the app's own
database and is served by the app's own pages. Stencil hosts nothing for it: there is no
Stencil account page an app user could be sent to, and a link to Stencil's own site or to the
app builder's Stencil dashboard is wrong. When an app builder asks where their app users
change a password, email, name or photo, or turn on two-factor authentication, the answer is a
page in *their* app: the stock `/auth/account` page above (and the two-factor pages below),
plus whatever account settings the app adds — never "Stencil manages that".

## Two-factor authentication for app users

Opt-in, per app user, authenticator-app codes (TOTP) with one-time backup codes. The layer
already ships everything; an app only needs a link.

**Enrolment page — `/auth/two-factor/setup`.** Platform-owned, registered by the auth route
pack. A signed-in app user scans a QR code, confirms one code, and gets ten backup codes to
download or copy. Add the link to the app's account settings; do not build a two-factor QR
screen (the enrolment page ships one; a QR code for any other link is the `qr-code` skill),
a secret table, or a verify form:

```tsx
import { useAuth } from "~stencil/ui/auth/context";

const { user } = useAuth();
<a href="/auth/two-factor/setup">
  {user.twoFactorEnabled ? "Two-factor authentication is on" : "Set up two-factor authentication"}
</a>
```

`user.twoFactorEnabled` is on the session user everywhere `requireAuth` hands it out.

**Challenge — `/auth/two-factor`.** Also platform-owned. Once enrolled, *every* app-local
sign-in asks for the code before a session exists: password, magic link **and** one-time
email code. Two-factor is a property of the account, not of one login method, so an app must
not offer a "code-free" method as a way around it. The hosted login page already sends people
to the challenge. An app with its own login form gets the same for free as long as it signs in
through `~stencil/auth/browser.client` (`signIn.email`, `signIn.magicLink`, `signIn.emailOtp`):
the client redirects to the challenge page when the server asks for it. A hand-rolled `fetch`
to `/api/auth/sign-in/*` must check for `twoFactorRedirect: true` in the response and navigate
to `/auth/two-factor?returnTo=…` itself.

**The one exception: "Continue with Google" (delegated Stencil sign-in).** That session is
not challenged — the identity provider already applied its own account security. Do not
try to wire a challenge onto it.

**Lost device.** The app builder resets an app user's second factor from More →
their app users list (open the person, "Two-factor authentication" → Reset). The app user
then signs in with the first factor alone and can enrol again. There is no in-app "turn off"
for the app user in this version; do not build one on top of the plugin's disable endpoint,
which needs a password an app user may not have.

**Out of scope, and not app code:** SMS codes, passkeys, and an app-builder rule that makes
two-factor mandatory for everyone. Say so in the build summary and stop.

## If a method is genuinely missing

A capability the four built-ins can't express (SMS OTP, a third-party social
login), or a call `~stencil/auth/browser.client` does not export, is **platform work,
not app code**: say so in your build summary and stop, rather than instantiating a
second auth system or a second browser client that works today and orphans the
app's data forever.

## A code or password for someone without an account

A gate that is not a sign-in — a client proving the inbox on their contract before they
sign, a gallery behind a code, a page behind a shared password, a classroom PIN — is not
auth work and must not become a second auth system or a hand-built one. Email OTP and
magic link always end in an app-user account, so they do not fit a visitor who should not
get one. Use `~stencil/access-codes` (the `access-codes` skill): it stores the code
one-way, mints unguessable ones, counts and slows guesses, and issues a revocable pass.
Mint any code with `crypto.getRandomValues`, never `Math.random()`, and email a code only
to the address already stored on the record — never to one the visitor typed.

A PIN or code a signed-in app user types — a vault PIN, a code confirming a second
address — is not sign-in either. Never hand-write its wrong-guess lockout: count each
guess with `limitGuess` from the same module before comparing (the `access-codes` skill).
