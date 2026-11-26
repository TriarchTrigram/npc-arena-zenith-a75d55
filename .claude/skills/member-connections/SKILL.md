---
name: member-connections
description: Letting each of the app's app users connect their OWN third-party account — "let my users connect their Google Calendar", "sync each customer's Slack", "read the signed-in user's Notion", "pull their calendar/inbox/CRM". Use whenever the brief means *the person using the app* connects a service, rather than the app owner connecting one centrally. Covers the app/connections.ts manifest, the ~stencil/connections SDK, requireConnection, <ConnectButton>, switching providers on, registering a service the catalog does not have, the builder's own OAuth credentials and each provider's review tier, diagnosing a connection that stopped working, an app user's Drive folder or file list from a connected service that comes back empty, and repairing an app that already runs its own Google sign-in to reach app users' Drive or other Google data (not Sign in with Google). Also load it for a question about an app's connections with nothing to build — which OAuth client ID is saved and where, whether app users can connect a service, what a connection runs on, why one is off — and answer from the status it reads, never from memory.
allowed-tools: enableMemberConnections addCustomProvider memberConnectionStatus confirmConnectionPublishing
metadata:
  agents: [chat, builder]
---

# App user connections

Each app user of this app connects **their own** third-party account, and the app
then acts on their behalf. App user A's calendar is never visible to app user B, and
neither is visible to the app's owner.

## First, is this actually the feature they want

Two different things get described with the same words.

| They mean | Feature | Where it lives |
|---|---|---|
| Every app user connects their own account | **App user connections** | More, Connectors |
| One business account everyone shares | App secrets | More, Settings, Secrets |

"Connect Stripe so we can take payments" is the second, and so is a company
inbox or a single API key. If you are unsure, ask whose account it is: theirs, or
each of their users'. If the brief means "the business connects its Stripe", this
skill does not apply.

**The app builder bringing in their own content is the first row.** "Import my
Notion pages", "read my Outlook inbox": they sign in to their app and connect
their own account there, like any app user. It runs on the same connection and
the same credentials, so read `memberConnectionStatus` and never send them to
create an integration, a client ID or a redirect address for it.

**There is one third answer, and it is the four built-in mailing list services — nothing
else.** Flodesk, Kit, ActiveCampaign and MailerLite are workspace-level connections the app
builder makes once, after which new signups sync to where they pick. They are handled by
the `mailing-list` skill (in chat, the `connectMailingList` tool does the whole flow
inline) — load that skill rather than forcing one of them into either row above.
For everything else the two rows are the whole list. Stencil used to have an
account-level `Settings → Connectors` tab where an app builder connected their
own account for the chat agent to use, and it was retired in September 2026
because in production it was never once used for that. Never tell an app builder
to connect a service "in Settings", never build against a connection held by
their Stencil account rather than by the app, and if a brief only makes sense
with an account-level connector, say that it is not a thing rather than inventing
a route to it.

**A key each app user pastes is not a connection.** When every app user has their
own key for a service — a texting provider's API key, a Ghost or WordPress
application password, a Shopify store token, a login for another site — and the
service is not in the catalog or cannot be registered (it has no OAuth sign-in, or
each app user's account lives at its own address), neither row above can hold it.
Keep it in the app's own table, but never as typed: `seal(env, value)` from
`~stencil/secrets` before the save, the column under the entity's `hidden`
access rule, `unseal` only in the server code that calls the service. The data-sdk
skill has the pattern. A service that *is* in the catalog, or can be registered,
goes through this skill — never a pasted token for it.

## You are not wrong that you cannot hand-roll this

If you have refused a brief like this before, your reasoning was correct: the
platform owns authentication, there is no per-app Google client, and a bespoke
OAuth flow written inside a new app is non-functional. **All of that is still
true.** Never write a provider sign-in by hand, never add an `/auth/google`
route, never ask for a client secret in app code.

That rule is for new code. An app that already runs its own Google sign-in to
reach app users' Drive or other Google data (not Sign in with Google) is
repaired in place: do not remove the sign-in, do not call the app broken, and
offer the move to Stencil's connection once rather than doing it unasked, since
every app user would have to reconnect. Repair means the Google code it already
has. Never widen that sign-in to new scopes or services, and never copy it for
another provider; anything new goes through Stencil's connection. See "When the
app already runs its own Google sign-in" below.

What has changed is that there is now a sanctioned route. Use it.

## Start from the scaffolds

`app/connections.ts` already exists in every app, shipped empty — edit it, do not
create it. The layer imports it directly, so a deleted manifest is a build error,
not a quietly disabled feature.

Start from the `connections/gated-route.tsx` scaffold for `app/routes/agenda.tsx`: adapt the
providers, the reasons, and the page.

## The manifest and the route pack are ONE change

```ts
// app/connections.ts
import type { ConnectionManifest } from "~stencil/connections";

export default [
  { provider: "google-calendar", reason: "Show your agenda alongside your bookings" },
] satisfies ConnectionManifest;
```

```ts
// app/routes.ts — a RELATIVE import, like the auth pack. React Router's config
// loader runs before tsconfig aliases, so ~stencil does not resolve here.
import { stencilConnectionRoutes } from "./.stencil/react-router/connections/routes";

export default [
  index("routes/home.tsx"),
  ...stencilConnectionRoutes,
] satisfies RouteConfig;
```

**Never add one without the other.** `requireConnection` sends app users to
`/app/connections`, which the route pack provides. A manifest with no registered
pack means every gated page redirects an app user to a 404, and nothing in the build
will tell you.

`reason` is shown to the app user, in the app's voice. Say what the app does with
the data, not what the integration is called.

## Switch it on, or the code you just wrote does nothing

**A provider must be switched on for this app before any app user can connect it.**
Writing the manifest does not do that, and `<ConnectButton>` renders nothing
until it is. An app that looks unbuilt is usually an app that is not switched on.

So, immediately after editing `app/connections.ts`, call:

```
enableMemberConnections({ providers: ["google-calendar"] })
```

Pass **every** provider your manifest names, not only the ones you expect to
work. A provider that cannot be switched on comes back with the reason and a
sentence written for the builder, and that sentence is what you tell them.

**Call it before you build the screens that use the connection, and read the
answer.** A provider that comes back `needs_own_client` or
`no_usable_credential` cannot be switched on until the builder has saved their
own credentials in settings, and nothing you build on it can run or be tested
until then. Do not build its panel, importer or sync in this build: keep the
manifest entry, build the rest of the app, relay the message, and say that the
connection screens come once the credentials are saved. A screen built on a
connection that cannot be switched on is a paid build that ends with "needs
your credentials to test", which is the outcome this check exists to prevent.

Do not ask the builder whether to switch it on. They asked for the feature in
the brief; that was the decision. The tool never switches anything off and never
touches credentials, so calling it again on a rebuild is safe.

## Gating a page

```ts
const { user } = await requireAuth(request, env);
await requireConnection(request, env, user.id, "google-calendar");
```

Redirects to `/app/connections?needed=google-calendar` when the app user has not
connected. Shaped like `requireAuth` on purpose.

For an `optional: true` provider, read the status instead and degrade:

```ts
const status = await getConnectionStatus(env, user.id, "slack");
if (status === "connected") { /* the extra feature */ }
```

## Using the connection

```ts
const member = createConnections(env).as(user.id);

// A catalog provider's own tool. Input is validated against the tool's schema.
const events = await member.call("google-calendar", "listGoogleCalendarEvents", {
  time_min: new Date().toISOString(),
  max_results: 100,
});
```

Google Calendar works **only** through its five tools — `listGoogleCalendars`,
`listGoogleCalendarEvents`, `createGoogleCalendarEvent`,
`updateGoogleCalendarEvent`, `deleteGoogleCalendarEvent`. It has no raw path, so
`member.request("google-calendar", …)` is refused every time; do not write it as
a first attempt or as a fallback. What the tools do not expose (hidden calendars,
field masks) is not reachable from an app.

For availability, read each event's `busy` boolean — it reflects Google's
Free/Busy marker, so a Free event or an informational all-day entry (`allDay`
plus `eventType` like `birthday`) does not block, while a Busy block does. And
`createGoogleCalendarEvent` takes `add_google_meet: true` to attach a Google
Meet link, returned as `meetLink`.

A booking that lands on Google must stay in step with the app's own record, and
the connector does not do that for you:

- **Save the event id.** `createGoogleCalendarEvent` returns `eventId`; store it
  on the booking row. Without it there is nothing to update or delete later.
- **Reschedule is an update, not delete-and-recreate.** Call
  `updateGoogleCalendarEvent` with the saved `event_id` and the new `start_time`
  and `end_time`; only the fields passed change.
- **Cancel is a delete.** Call `deleteGoogleCalendarEvent` with the saved
  `event_id` from every path that cancels or removes the booking.
- **Page through a busy calendar.** `listGoogleCalendarEvents` returns at most
  250 events per call, even inside `time_min`/`time_max`. When the result carries
  `nextPageToken`, pass it back as `page_token` until it is absent — otherwise the
  calendar silently stops at the 250th event of the range.

### Reading an app user's Google Drive folder

An app that imports from "a folder the app user chooses" is one chooser plus one
listing, and both have a shape. The same rules hold whether the app uses the
`google-drive` connector or already runs its own Google sign-in.

- **The app user picks the folder from a list.** Build the chooser from the
  search, folders only: `searchGoogleDriveFiles` with
  `mime_type: "application/vnd.google-apps.folder"`, plus `query` for whatever
  they type. Never resolve a folder by walking names down from the top of My
  Drive, and never ask them to type a path. What the list reaches — shared
  drives, folders shared with them — is whatever the connector's `capability`
  line from `memberConnectionStatus` says it reaches. An app with its own
  sign-in asks Google itself: `corpora=allDrives`, `includeItemsFromAllDrives=true`
  and `supportsAllDrives=true` on both the folder search and the folder
  listing. Without all three on the listing, a shared-drive folder the app
  user picked lists as empty: `files.list` leaves out every shared-drive item
  unless `includeItemsFromAllDrives` is set. No `sharedWithMe` filter:
  `allDrives` already includes folders shared with them, and that filter would
  narrow the list to only those.
- **Save the folder's `id`.** Never its name or a path: names repeat, folders
  move, and a path is re-resolved on every sync.
- **No default folder, and nothing created unasked.** Until the app user has
  chosen, the feature is not set up for them: the chooser is the empty state
  and a sync skips them. Never create a folder the app user did not ask for; a
  missing folder is an error for them to see, not something to replace quietly.
- **List by `folder_id` and page to the end.** The search returns 25 files a
  call; pass `nextPageToken` back as `page_token` until it is absent. Do not
  narrow the listing with `mime_type`; pick the files you want by `mimeType`
  from the result, so a folder of mixed formats comes back whole.
- **A failed call is an error, never an empty list.** Most Google refusals do
  not throw: when Google answers 401, 403 or 404, `member.call` resolves with
  `{ success: false, error }`, so check `success` before reading `files` and
  show `error` to the app user. Only `needs_reauth` and the other
  `ConnectionError` codes throw; `needs_reauth` shows a reconnect prompt,
  anything else shows the message. A try/catch around `output.files ?? []`
  turns an expired connection into "no files", and the app reports success
  while the app user sees nothing.

**A provider offers `call` or `request`, and you do not get to choose which.**

```ts
// Passthrough. `path` is a path, not a URL, and stays on the provider's host.
const rows = await member.request("google-sheets", {
  method: "GET",
  path: "/v4/spreadsheets/1abc.../values/Sheet1!A1:D50",
});
```

Prefer `call` where the provider has tools: input is validated against the
tool's own schema and the URL is the handler's business, not yours. But most
connectors have no tools at all — the Google Workspace ones, Analytics,
BigQuery, Search Console — and for those `request` is the only way in.

You cannot tell which from the slug, so **do not guess twice.** Try `call` and
read the error: `<provider> has no tools` means switch to `request`, and a wrong
tool name comes back naming every tool the provider does have. Both errors are
`invalid_input` and both tell you what to do next.

`provider_not_configured` from `request` means that provider has no raw path.
Its message is one fixed line an app user may see, so it does not name the
tools. If the provider is tools-only (Google Calendar, Gmail and Drive answer
this way; `memberConnectionStatus` says which), switch to `call` with one of
its tool names, and never try `request` first "in case it works" — every such
attempt is a refused call before the real one. If the provider has no tools
either, it offers neither path; say so to the app builder rather than working
around it.

### An app user's Instagram profile, posts and stats

Instagram is a platform connection: declare `instagram` in the manifest, switch
it on, and place `<ConnectButton provider="instagram">`. Never write a Meta or
Instagram sign-in by hand, and never ask the builder for a Meta app id or secret
to do it. It is read-only and passthrough:

```ts
const posts = await member.request("instagram", {
  method: "GET",
  path: "/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25",
});
```

- **Only professional accounts can connect.** Instagram refuses a personal
  account on its own screen. Beside the connect button, tell app users it needs
  a business or creator account and that switching is free in Instagram's
  settings; a person who bounces back unconnected otherwise has no idea why.
- **Copy images into app storage.** `media_url` and `thumbnail_url` are links
  that expire. Save the file when you sync and render the stored copy; link out
  with `permalink`.
- **A feed of several app users' posts** is one opt-in connection per app user,
  synced by a recurring action that calls `createConnections(env).as(userId)`
  for each connected app user and stores the posts. A `needs_reauth` for one
  app user skips that app user; it does not fail the sync.
- **No publishing, no hashtags, nobody else's posts.** If the builder asks for
  those, say this connection cannot do it rather than building a workaround.

### Ask before you write, not after it fails

**`memberConnectionStatus` tells you what each switched-on provider can do** — its
`capability` field names which of the two call styles it takes, the calls worth
making, and what it will never do. Read it before you write the code that uses a
connection, not only at the end:

```
google-docs: Read, create and edit a document you already have the id for. Cannot
find the app user's existing documents.
Use member.request("google-docs", { method, path }) — member.call has no tools to reach.
Can: POST /v1/documents  (create) · GET /v1/documents/{id} · POST /v1/documents/{id}:batchUpdate
Cannot: List the app user's documents. The Docs API has exactly three methods and
none of them enumerates...
```

**Read the `Cannot` line before you design the page.** Several connectors cannot
enumerate an app user's own resources at all — Docs, Sheets, Slides, Forms and
Analytics each need an id the app has to obtain some other way. A "your recent
documents" list is not buildable on those, however the brief is worded, and the
honest move is to build what the connector does support and tell the app builder
plainly. Designing the list first and discovering this from a 404 wastes the
build.

The same text comes back from `enableMemberConnections` and from the error if you
call the wrong way, so there is never a reason to guess.

Tool names, where a provider has tools, are its own and not a shape you can
guess: it is `listGoogleCalendarEvents`, not `listEvents`. A wrong name comes back
naming every tool that provider does have:

```
`listEvents` is not a tool of google-calendar. Available: createGoogleCalendarEvent,
deleteGoogleCalendarEvent, listGoogleCalendarEvents, listGoogleCalendars,
updateGoogleCalendarEvent.
```

Take the name from that list. **Never loop over candidate names or provider-slug
variants.** A provider with no tools answers every guess identically, so a search
like that always ends in the same place: no data, no error the app user can act on,
and a page that looks broken. If one call fails, read what it told you.

A custom provider you added yourself is always `request`, never `call` — it has
no tools by construction:

```ts
const res = await member.request("acme-crm", { method: "GET", path: "/v2/contacts" });
```

Server-side only — a loader, an action, or a scheduled handler.
`createConnections` throws if called anywhere else, because it needs the app's
own bearer key and that key must never reach a browser.

Errors are typed. Branch on `error.code`, do not match on message text:
`not_connected`, `needs_reauth`, `provider_not_configured`, `provider_error`,
`invalid_input`, `rate_limited`.

## Always place an inline entry point

`requireConnection` guarantees no app user hits a dead end. It does **not** help an
app user who never opens a gated page and therefore never learns the feature
exists.

Every connection-backed feature gets at least one `<ConnectButton>` where the
need is felt: in the empty state, beside the thing it enables. A link buried in
settings does not count.

```tsx
<ConnectionsProvider connections={loaderData.connections}>
  {/* ... */}
  <ConnectButton provider="slack" />
</ConnectionsProvider>
```

State comes from the loader, never a `useEffect` fetch. `<ConnectButton>` renders
**nothing** when the provider is unavailable, so an app whose owner has not
finished setup shows no dead button rather than one that errors on click.

Build `connections` the way the scaffold's loader does: one `ConnectionView` per
provider the page shows, with `status` from `member.statuses(providers)` and the
account's display data from `member.list()`. Never hand `member.list()` straight
to the provider: it holds only the accounts the app user has linked, so a provider
they have not linked yet is missing from it, reads as `unavailable`, and gets no
button.

"Is this linked?" has one vocabulary everywhere: `status()`, `statuses()` and the
rows of `list()` all say `connected` or `needs_reauth` for a linked account. If a
page you touch compares a connection's status to anything else (`"active"`, for
example) or feeds raw `list()` rows into `<ConnectionsProvider>`, fix it in the
same turn: that page treats every linked account as unlinked.

## Data scoping still applies

An app user's connected data is theirs. Any row derived from it carries
`created_by = user.id`, exactly as the template's data-scoping rule requires.

Worth stating because "the calendar" reads like shared data and is not. Two
app users of the same app must never see each other's events.

## The service is not in the catalog

**Flodesk, Kit, ActiveCampaign and MailerLite are not this case.** They are built in. Load
the `mailing-list` skill; in chat use `connectMailingList`. Never `addCustomProvider` for
one of them, unless the brief is each app user connecting their own account on it.

**A booking tool is not this case either.** Bookings from Cal.com, Calendly or Acuity
Scheduling reach the app without a connection: load the `booking-imports` skill and
build that, never `addCustomProvider` and never "no booking tool can connect".

**Read `memberConnectionStatus` before you decide a service is missing.** The
catalog is whatever that read lists, never what you remember: Notion, Slack,
GitHub, GitLab, Linear, Jira, Confluence, ClickUp and the Microsoft services are
all in it and run on Stencil's own credentials. A service the read lists is not
this case: switch it on with `enableMemberConnections` and ask for no client ID,
secret, API address or redirect address. Only a service absent from the read
goes on below.

**Offer setup — never stop at "Stencil does not support that".** Blocking the
whole build on a missing connector is the failure this capability exists to
remove. A brief that mentions one service the platform does not know is not an
unbuildable brief. Register it, and continue with the rest of the app either way.

Use `addCustomProvider` — a chat step, not a build one, since the OAuth client is
created in the app builder's own name. If you are mid-build, write the rest and tell them
this one registration happens in the conversation. It needs the service's authorize URL,
token URL, API base, and scopes, which are in that service's developer documentation, plus an
OAuth client the builder creates in that service's developer console.

A service that requires PKCE, or a fixed API-key header on every call, is registered
with `pkce: true` and/or `apiHeaders`. Etsy needs both: `pkce: true` and
`apiHeaders: { "x-api-key": "{client_id}:{client_secret}" }`. The placeholders are filled
from the stored client at call time, so the secret still never passes through chat.
Calling the tool again for a slug this app already has updates its URLs, scopes, auth
method, PKCE and headers in place; the builder's client id and secret are left alone.

**It will refuse until the builder has approved the API host out loud.** That is
deliberate and you cannot self-certify it: if you read those URLs off a web page,
you are the party that read the page, and every app user's token gets locked to
whatever host it named. Show them the exact host and ask:

> I read these settings from Acme's developer docs. Requests from your app will
> go to `api.acme.com` and nowhere else. Can you confirm that is the right
> address?

Then call the tool with `hostConfirmedByBuilder: true`.

The tool has **no field for a client secret** and refuses a payload that looks
like it contains one. It returns the next steps, including the link to the secure
form. Follow them. Until the builder has saved their client id and secret there, the
service reads as needing credentials and cannot be switched on; once they have, call
`enableMemberConnections` with the new slug, or they can use the toggle on the same
screen.

## When the builder wants their own credentials

**Every Google service is bring-your-own in production today**: Calendar, Tasks,
Drive, Gmail, Docs, Sheets, Search Console, Analytics and the rest. Stencil's own
Google client is not verified for them yet, so `memberConnectionStatus` reports them
as needing the builder's own client. Say so in plain words before you promise the
feature, never "no setup needed", and link the one guide: https://docs.hellostencil.com/run-your-business/connect-your-tools#set-up-your-own-google-credentials-step-by-step
It covers the Google Cloud project, the organisation picker, Workspace-managed
accounts, the redirect URI, publishing the consent screen and asking Google for
verification. Read the live state rather than this paragraph: the Stencil team can
move a provider onto Stencil's client without a deploy.

Nothing needs setting up when Stencil already supplies a working client, so do
not walk them through a developer console, a redirect URI, or a client secret
when none of that is needed. Mention the option **once**, plainly, and move on:

> App users will see Stencil's name on the permission screen, the same as they
> already do when they sign in to your app. If you would rather they saw yours,
> you can use your own credentials in settings. Either way this works now.

Do not turn that into a decision they must resolve before you can continue.

If they do want their own, say the review tier **before** they start, because it
decides whether this is ten minutes or several weeks:

| Service | What to tell them |
|---|---|
| Notion, most SaaS | Whatever `memberConnectionStatus` says for that service — where Stencil's own credentials run it, theirs is optional. About ten minutes if they still want theirs, no review needed |
| Dropbox | Required — Stencil supplies no Dropbox app. About ten minutes; a new Dropbox app starts in Development status, which allows a small number of accounts, and Dropbox reviews it before Production |
| Slack | Slack must review it before it installs into other workspaces |
| Google Calendar, Tasks, Sheets, Docs, Search Console, Analytics and the other Google services | Required today. About fifteen minutes in Google Cloud; until Google verifies the app, app users see a "not verified" warning and the client is capped at about 100 connected accounts |
| Gmail, Google Drive | Required today, and Google also requires a paid security assessment from the builder, renewed yearly |

Then, in this order:

1. **Say how many app users will be disconnected**, before they open the console.
   Ten minutes of setup is the wrong moment to learn that 128 people will have to
   reconnect. The number is on the Manage panel.
2. **Give them the redirect URI to register first**:
   `https://app.hellostencil.com/api/member-connections/callback`. Registering it
   late produces `redirect_uri_mismatch`, which tells a non-developer nothing.
3. **Publishing status is a step, not a footnote.** A new Google consent screen
   defaults to Testing: it refuses every app user who is not a listed test user,
   and Google expires even the listed users' connections after 7 days, so they
   reconnect weekly. Ask them to confirm it reads "In production", and say that
   reason in words. In chat, once they say it does, `confirmConnectionPublishing`
   records that as their statement with the date; never call it on your own guess.
4. **The secret goes in the secure form in settings, never in chat.** Anything
   pasted into a message is stored with the conversation.
5. **Say that this affects one app.** Their other apps are untouched. That is
   only reassuring if they know it.

## When the builder says their credentials are already set up

Do not argue from memory, and never contradict a screenshot. Call
`memberConnectionStatus` and read that provider's saved client. It appears only
when one of theirs is saved, and names the client ID the connection actually
resolves to and where it was saved: this app, or the builder's account, which
backs every app in their workspace. Say the client ID and where it lives in your
own words so they can compare it with what is on their screen; the field names
and the raw state words never reach a reply:

> I can see your own Google Calendar client saved on this app — it ends in
> `…apps.googleusercontent.com`, added on 12 September. The connection is using it.

No saved client means nothing of theirs is saved for that provider on this app or
on their account, which the service's own status sentence already says. Say that
plainly and name the settings screen — never that a field is empty or null:

> No Google Calendar client of yours is saved on this app or on your account, so
> the connection is off. Add one under More → Connectors → Set up → Use my own
> credentials.

The screen belongs in every such reply, however briefly the question was asked:
where one would be saved is the other half of "where is it saved", so a reply
that stops at "nothing is saved" answers half of it.

If the ID they see differs from the one returned, say so: that is the mismatch to fix,
not a disagreement about whether credentials exist.

### Every answer comes from its own read

A builder can save, replace or remove credentials between your turns — often
because you just told them where the screen is. So call `memberConnectionStatus`
again each time credentials come up, and answer from the result with the newest
`readAt`. An earlier turn's result is a record of what was true then, not of what
is true now.

When the new read disagrees with what you said earlier, the change is the news.
What the connection runs on now comes from the same read, never from an
assumption that Stencil's credentials take over. Each service in the result
carries its own name and one sentence already written for the builder: say that
sentence in your own words, call the service by that name, and leave the code
identifier beside it in the result.

> Your own client has been removed — nothing of yours is saved for Google
> Calendar now. Stencil has no credentials of its own for Google Calendar, so the
> connection is off until you add a client again in Connectors.

Say what changed and leave your earlier answer standing. It was right when you
gave it, and a client ID you read from this tool is never something you made up.

## Everything is editable in settings

Nothing here is chat-only. Switching whose credentials are used, replacing them,
running the connection check, copying from another app, and removing the
integration are all in **More, Connectors**.

Say so when you set something up, so they know where it lives.

## When a connection breaks

The connection check on the Manage panel separates what Stencil verified just
now, what real app users actually did, and what the builder told us. A tick means
verified; a bullet means somebody said so.

The one to read first is **"members are being refused"**. Two or more different
app users refused in a week almost always means the consent screen is in Testing,
not that the credentials are wrong. On the builder's own Google client, them
connecting successfully does not prove their app users can — a consent screen left
in Testing mode works for the owner and refuses everyone else.

## When the app already runs its own Google sign-in

Some apps reached Google before this route existed and carry their own OAuth
flow, token storage and Drive calls to read app users' Google data. That is
not Sign in with Google as a login method, which stays with the platform's
auth. The hand-roll rule above is for new code; this app is repaired, not
rebuilt.

- Keep the sign-in. Removing it signs every app user out of the feature, and
  moving to Stencil's connection makes all of them reconnect, so offer that
  once and do it only when the app builder asks. Make the offer with its cost:
  in production, `google-drive` needs the app builder's own Google client and
  Google's paid security assessment, renewed yearly (see the review-tier table
  above).
- Apply the Drive folder rules above to the code that is there: folder picked
  from a list, kept by `id`, no default, nothing created unasked, paged to the
  end, errors shown.
- Say the Testing-status warning once, and only here. Stencil reads nothing
  about this app's consent screen, so nothing on the Manage panel will. A Google
  consent screen left in Testing expires every connection after 7 days, so "it
  stopped importing" comes back weekly for every app user; the fix is publishing
  it in Google Cloud Console (OAuth consent screen, Publish app), which the
  app builder does, not you.

## Before you report done

Say what `enableMemberConnections` actually returned. It gives you a per-provider
answer, and the three answers need three different endings.

**Switched on** — the feature is finished. Name the page you put the button on
and ask them to try it:

> Outlook calendar is on, using Stencil's credentials, so there is nothing for you
> to set up. Open /agenda and connect your own account to see it working.

**Blocked** — repeat the `message` you were given. It already names the exact
screen, and it is written for someone who does not know what OAuth is. Do not
paraphrase it into jargon, and do not soften it into "you may need to configure
something". When the blocked provider was part of this brief, file the part you
left for later with `addBacklogItem` and `blockedOn` naming the setup step, so
Auto-run does not start it before the builder has saved their client.

**Nothing switched on** — say so plainly rather than reporting the build as
complete. A build whose connections are all blocked is a build the builder cannot
use yet, however good the code is.

You still cannot verify the **connection** itself: connections belong to app users,
and there is no app user until a person signs in and clicks Connect. But you can
and must verify the **switch**, which is app configuration, and the tool has
already read it back for you. Report what it found, never that you turned
something on and assumed.

**Whose account connects in the App preview.** The App preview is signed in as
the app's built-in Preview User, so when the builder presses Connect there, the
account they approve is linked to that Preview User and to nobody else. It is
not shared with their app users and does not carry over to the published app,
where each app user connects their own. A provider that already has a browser
session (Dropbox does this) skips its sign-in step and goes straight to the
approval screen; that is the provider remembering the builder, not the app
connecting without asking. Say this when the builder tries it in the preview
and asks whose account it is.
