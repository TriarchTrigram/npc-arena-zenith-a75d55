# App Template

Full-stack web app using React Router 7, Tailwind CSS, and Cloudflare Workers. 

The build sandbox has Bun and Node only — there is no Python. Edit files with your file-editing
tool. When a throwaway script is unavoidable, write it to a `.ts` file and run it with `bun`; never
inline it as `bun -e '…'` — the first apostrophe in its text ends the shell quote, and the command
fails or runs mangled. A `python3` call prints `command not found`, the edit it carried never
happens, and anything chained after it still runs.

## About this app

Not written yet. On this app's first build, replace this paragraph with the app's
purpose, its main flows, and the mechanism it chose for each big job — how it
renders, exports, sends, syncs — one plain-English line each. Ten to twenty lines,
no code: the app builder reads this section too. Write it with your file-editing tool,
in its own step before the build, never through a shell command. Fixed after a build has
deployed, it is saved and goes out with the next build — never build for it alone. Keep it
current — a turn that introduces, replaces or removes a mechanism updates this section in the
same turn. It is a summary of the app as it is now, not a log of what each turn changed:
rewrite it when it grows. Anything past about 16,000 characters is moved to `APP-HISTORY.md` before
the next turn; read that file only when a task needs what an earlier turn did.
Everything below this section is Stencil's platform documentation.

## Platform-managed — don't touch

- `app/.stencil/` — **all** platform-provided code (auth, service SDKs, payments, the strings runtime, worker + server entries). Import from it as `~stencil/*`, never edit anything inside it. Edits there are blocked. If the typecheck fails on a file inside `app/.stencil/` and your own changes did not cause it, do not work around it: stop, tell the app builder plainly that a Stencil platform problem is blocking the build and Stencil has to fix it, and do not report the build as done. A build refused as "Platform files changed" or "Platform layer unavailable" is different: it clears on the next turn, so relay what that refusal says and never tell the app builder to wait for Stencil.
- `app/generated/` — written for you by the entity tools; never edit directly
- `app/entry.server.tsx`, `workers/app.ts` — convention-pinned re-exports of the real entries in `app/.stencil/react-router/worker/`; leave them as-is (never remove `strings` from the worker's load context)
- `app/strings/strings.json` — the platform strings **content** is the one platform-managed file you *do* edit (add/adjust copy here); the strings **runtime** is split by layer and none of it is yours to touch: `<Text>` in `app/.stencil/ui/strings.tsx`, `withStrings` in `app/.stencil/react-router/strings.ts`, `loadStringsFromStorage` in `app/.stencil/strings.ts`
- `app/root.tsx` loader — `withStrings<Route.LoaderArgs>()` passes every section of `strings.json` except `private` to all routes; never remove it
- `<StencilRoot>` in `root.tsx` — wraps `<Outlet />` and supplies platform strings to every `<Text>` plus the preview navigation bridge. Never remove it or render `<Outlet />` outside it: every `<Text>` on the site goes blank.
- `react-router.config.ts`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc` — config files. Keep `routeDiscovery: { mode: "initial" }` in `react-router.config.ts`: without it every page an app user has open hard-reloads, mid-typing, the moment a publish lands. **One exception:** if `vite.config.ts` imports `vite-plugin-checker`, delete that import and its `checker(...)` entry. The package is no longer installed, Vite cannot load the config at all (`ERR_MODULE_NOT_FOUND`), and this is the only place it can be healed — older apps still restore a config that has it.
- The `rel=icon` link in `root.tsx` — never remove it or change its href. `/assets/logo.png` is the app icon the platform renders from the app builder's own upload (More → Settings → General → Icon); it doubles as the favicon and the home-screen icon. **Never copy a file to `/assets/logo.png`** — not with the `assets_put` tool, not with `generateImage` — a build that does so silently replaces the builder's icon. The app's logo is a different file, `/assets/brand/logo.png`, and a build does set it (see "The app's logo" under Assets); draw it with `<BrandLogo>`, not from `/assets/logo.png`. To change the icon, tell the builder to upload the image under More → Settings → General → Icon. A build therefore **never** changes the favicon or the app icon: never report either as changed, matched or updated, even after placing a logo in the header or sidebar — say the icon is set under More → Settings → General → Icon.
- The `/theme.css` stylesheet link in `root.tsx`'s `links` function — never remove or replace it; without it the app loads with no design tokens at all
- The `ErrorBoundary` in `root.tsx` — a pinned one-liner rendering `PlatformErrorBoundary` from `~stencil/react-router/error-boundary`; leave it as-is. It already themes itself from the app's tokens, so don't reimplement it to restyle it.

## Project Structure

```
app/
  root.tsx              — Root layout (html, head, body, Meta, Links, Scripts)
  app.css               — Tailwind imports + @theme inline mappings
  theme.css             — Design tokens: :root and .dark CSS variable blocks — edit this for colors, radius, fonts, etc.
  routes.ts             — Route table (add new routes here)
  routes/
    home.tsx            — Home page route ("/") — a STUB; replace it entirely
    app.tsx             — Authenticated route ("/app") — a STUB; replace it entirely
  components/ui/        — shadcn/ui components (pre-installed)
  components/design.tsx — this app's design language (PageContainer, PageHeader, SectionHeading, Panel, StatusBadge, EmptyState, MetricStrip), when present; every screen imports these and never re-implements them
  lib/
    utils.ts            — cn() utility (app-owned)
  strings/
    strings.json        — editable platform strings content (add copy here)
  mcp.ts                — MCP tools this app exposes. Ships empty; EDIT, don't create.
  connections.ts        — third-party accounts app users connect. Ships empty; EDIT.
  auth-hooks.server.ts  — react to signup/login events. Ships empty; EDIT.
  events.ts             — events this app publishes + on() handlers for platform
                          events (payments, signups). Ships empty; EDIT.
                          The layer imports these four directly, so deleting one is
                          a build error rather than a quietly disabled feature.
  .stencil/             — ALL platform code (import as ~stencil/*, never edit)
                          Four parts. They never import across the ui/rest line, and
                          only react-router/ knows React Router exists:
                            ui/           — React components; no framework imports
                            types/        — types only; .ts, erased, never fetched
                            react-router/ — thin RR glue: route modules, route packs,
                                            worker entries, the root wrapper
                            everything else — server SDKs, framework-agnostic .ts
                          ui/ imports only ui/ and types/; nothing outside ui/ and
                          react-router/ imports ui/. Enforced in CI.
    auth/               — Auth server SDK (requireAuth, getSession, signOut, closeAccount, createAuth, schema);
                          roles (requireRole) and first-login setup (requireSetup, see the `app-user-setup` skill)
                          display-name.ts — displayName(person) — the name to show for any person, never their email
    db.ts               — createDb(env) — Drizzle ORM wrapper for D1
    storage.ts          — createStorage(env, limits?) — R2 storage wrapper, with a 2 GiB ceiling on every chunked upload; completeUpload (a measured, sealed finish for chunked uploads); captionKeyFor(videoKey);
                          storeImageFromUrl(storage, url, key) — copy a picture from an outside address an app user supplied into storage
    upload/             — the platform uploader, for every upload field: handleUpload(request, storage, options)
                          behind the app's upload route (server); uploadFile / uploadFiles with progress, retries
                          and a plain-sentence refusal (client) — see the `storage` skill
    media.ts            — createMedia(env) — convert, trim, join, mix stored media; captions for a
                          video, hours long included (see the `media-processing` skill)
    files.ts            — file export + download helpers (see the `file-export` skill)
    ai.ts               — createAI(env) — AI provider registry (OpenAI + Anthropic) and
                          transcribe() — speech to text (see the `ai-sdk` skill)
    email.ts            — createEmail(env) — send + receive email (see the `email` skill)
    flodesk.ts          — addToFlodesk(env, { email, name, segmentIds? }) — add a collected email to
                          the app's Flodesk segments (see the `mailing-list` skill)
    waitlist.ts         — joinWaitlist(env, { email, name?, source?, request? }) — add an email to the app's one
                          waitlist, the list on the Users page (see the `landing-page` skill; an app that already
                          keeps sign-ups in an entity of its own keeps them, rule 5 there)
    ui/waitlist/form.tsx — <WaitlistForm source="footer" /> — the ready-made email sign-up box (landing page,
                          footer, pop-up) that feeds that same list; needs stencilWaitlistRoutes in routes.ts
    ui/brand-logo.tsx   — <BrandLogo alt="App name" /> — the app's logo, wherever a screen shows it (see "The app's logo")
    push.ts             — createPush(env) — send Web Push notifications
    notifications.ts    — createNotifications(env) — the in-app notification store (see the `in-app-notifications` skill)
    data/order.ts       — moveRow, nextPosition — a saved drag-to-reorder position per row (see the `drag-to-reorder` skill)
    search.ts           — createSearch(env) — web search / discovery (Exa)
    records.ts          — searchRecords / nearestRecords — search the app's own rows, by word
                          and by meaning (see the `record-search` skill)
    events.ts           — on(), defineEvents(), emit(env, type, data) (see the `events` skill)
    tenant.ts           — the app user a request belongs to, when the app builder
                          gives app users their own subdomains (see the `subdomains` skill)
    access-codes.ts     — a page or record behind a short code or password, with no account:
                          setAccessCode / mintAccessCode / verifyAccessCode / getAccessPass
                          (see the `access-codes` skill)
    fetch.ts            — createFetch(env) — fetch a known URL as markdown (Firecrawl); page(url, { storeImage })
                          copies its preview image into storage for a card other people see
    safe-fetch.ts       — safeFetch(url, options?) — GET an address an app user or a fetched page supplied, as bytes;
                          publicUrlProblem(url) — vet such an address before passing it on
    geocode.ts          — createGeocoder(env) — address → coordinates (see the `maps` skill)
    image.ts            — createImage(env) — generate (Workers AI) + transform/resize (Cloudflare Images) at runtime
    audio.ts            — createAudio(env) — text to speech, music and sound effects at runtime (see the `runtime-audio` skill)
    payments/           — selling + subscription SDKs
    strings.ts          — loadStringsFromStorage
    time.ts             — the viewer's timezone: formatDateTimeInZone, formatDateInZone,
                          formatTimeInZone, todayInZone, hourInZone (see the
                          `hydration-safe-rendering` skill); the zone itself comes from
                          useViewerTimeZone() (react-router/root) or context.viewerTimeZone
    http.ts             — redirect() (no framework behind it)
    errors.ts           — failed(what, error, message?) — log a failure for the app builder, return a plain
                          message for the screen (see "Logs and error replies")
    ui/                 — <Text>, the error screen, useHydrated/ClientOnly,
                          the update notice app users see when a publish lands,
                          <VideoPlayer> (ui/video/player) — a <video> with its caption track,
                          <VideoEmbed> (ui/video/embed) — a pasted YouTube, Vimeo, Loom, Descript or
                          Google Drive link as a player in the page,
                          <UnsplashPhoto> and <UnsplashCredits> (ui/photo/unsplash) — a hotlinked,
                          credited stock photo (see the `stock-photos` skill),
                          <StoredPhoto> (ui/photo/stored) — a picture the app serves itself
                          (`/assets/…`, `/api/files/…`) at the size its slot needs, loaded lazily,
                          AuthProvider/useAuth, the connections UI,
                          the maps (<PlacesMap>, <PinPicker>)
                          the sortable list (<SortableList>, <SortableGroups> in ui/sortable/list)
    types/              — AuthUser, ConnectionStatus/View, StringKey, AppContext, …
    react-router/       — route modules, route packs, withStrings, <StencilRoot>,
                          the ErrorBoundary adapter, worker + server entries
prerender.ts            — Paths to pre-render at build time
workers/
  app.ts                — pinned re-export of ~stencil/react-router/worker/app
public/                 — Static assets (favicon, etc.)
```

## Routes

Add routes in `app/routes.ts`:

`routes.ts` is the one file that imports the auth route pack with a **relative**
path (`./.stencil/react-router/auth/routes`), not the `~stencil` alias — React Router's config loader
evaluates it before the tsconfig path aliases are applied. Everywhere else, import
platform code as `~stencil/*`.

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { stencilAuthRoutes } from "./.stencil/react-router/auth/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  // The signed-in shell is a layout route: its screens are its children.
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("orders", "routes/app.orders.tsx"),
    route("orders/:id", "routes/app.orders.$id.tsx"),
  ]),
  ...stencilAuthRoutes,
] satisfies RouteConfig;
```

Screens that share a frame (nav, sidebar, header) are children of one layout route, never
its siblings: `routes/app.tsx` draws the frame once and renders the current screen through
`<Outlet />`, so the frame stays mounted while the screens change. A new signed-in screen is
a new child entry. Only a screen that draws its own full-screen frame (an editor, a player)
is registered at the top level.

**Page route** — exports a default component, plus optionally `meta`, `loader`, `action`:

```tsx
import type { Route } from "./+types/my-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Page Title" }, { name: "description", content: "..." }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = createDb(context.cloudflare.env);
  const records = await db.select().from(contacts).limit(50);
  return { records };
}

export default function MyPage({ loaderData }: Route.ComponentProps) {
  return (
    <ul>
      {loaderData.records.map((r) => (
        <li key={r.id}>{r.name}</li>
      ))}
    </ul>
  );
}
```

**Resource route** — no default component; use for API endpoints:

```ts
import type { Route } from "./+types/api.export";

export async function action({ request, context }: Route.ActionArgs) {
  const payload = await request.json();
  return Response.json({ ok: true });
}
```

A resource route that receives deliveries from an outside service is a webhook, and it must verify the sender's signature with `webhookAction` from `~stencil/webhooks` (see "Receiving webhooks" below) — never a bare `request.json()` like the example above.

**A `loader` only reads.** Anything that changes state — a row written, an email sent, a role or permission granted, a file deleted, money moved — lives in an `action` reached by `<form method="post">`, never in a loader. A loader runs on every navigation, including a link another site plants in a signed-in app user's browser, so a loader that acts is a tool anyone can fire with an address. The one tolerated write in a read path is provisioning the caller's own first-load state (the `workspaces` skill's personal workspace); a loader never touches anyone else's rows. The build refuses a loader that reaches a write, in the route or in an app module it imports; the tolerated kind is marked with `// stencil-loader-write: first-load <why>` on the line above it (`counter <why>` for a view counter, `email-tracking <why>` for a row recording that an email was opened or a link in it clicked). No other reason is accepted, and no marker excuses a role or access grant, a send, a charge or AI. An email link that unsubscribes, confirms a subscription or records an answer is not tracking: its page shows a button.

**"Skip this step" means one tap, never zero.** When the app builder asks to drop a confirmation page, go "straight to checkout", or have a page "start right away", the step becomes a single press, not a page that acts as it opens: do the work in the action of the form the app user just submitted (the sign-up or details form's action starts the checkout or creates the record, then redirects), or keep one Continue button. A form that submits itself from an effect on mount is the same flaw and is never the shortcut.

A resource route that writes records an existing screen renders follows the "Server entry points that write records the app already shows" rules below.

**Redirecting to a caller-supplied destination:**

Any route that forwards a visitor to an address carried in the request — a `returnTo` param, a link-click tracker, a post-action "continue" bounce — MUST pass it through `safeReturnTo` from `~stencil/auth/server` first, whether or not the screen involves sign-in. It returns the value only if it resolves to a path on the app's own origin, and falls back to `/app` otherwise. Never hand-roll this check: a leading-slash test is not enough (`//evil.example` passes it and leaves the site).

```tsx
import { redirect } from "react-router";
import { safeReturnTo } from "~stencil/auth/server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return redirect(safeReturnTo(url.searchParams.get("returnTo")));
}
```

**A fact the server can look up is never taken from the request:**

Request input may select a record (an id, a `reference`) or express intent (which slot, which lesson, "yes, delete it"); it never supplies a fact the server already holds or can derive. Before an action stores or compares a value, ask where the server would get it on its own, and get it there. A schema parse (`z.number()`, `z.string().email()`) proves the value is well-formed, not that the browser was entitled to choose it. The checkout helpers already work this way (`sellerCheckout` re-reads `amountCents` and `sellerUserId` from the stored item); every action follows the same rule:

- A booking's date and time are checked against the slots the page offered — the same availability and calendar-busy computation the loader ran — not only against existing bookings. A slot the page never offered is refused.
- A "type the email to confirm" step compares what was typed with the account's stored email, loaded by id, never with a second field from the same form; the delete then runs on the stored account, not on the typed address.
- A media length, a price, an app user's email, name or plan, the chat a usage cap counts, today's date: read from the stored row, the session (`requireAuth`), `context.viewerTimeZone` or the server clock, even when the browser also sent it.
- A choice the screen hides (a server-timed game, an option the role may not pick) is enforced in the action by the same rule the loader used to hide it. An option list on a page is not a check.

## Data Loading

Fetch data in `loader` — it runs server-side before render.

```tsx
// BAD — don't fetch on the client
export default function Page() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then(setData);
  }, []);
}

// GOOD — fetch in the loader, data arrives with the HTML
export async function loader({ context }: Route.LoaderArgs) {
  const db = createDb(context.cloudflare.env);
  const records = await db.select().from(contacts).limit(50);
  return { records };
}
```

### Independent reads run together

Each `await` on the database is a round trip, so a loader that awaits its reads one after another makes the page wait for the sum of them. Start every read that does not need another's result at the same time, and fetch a list's related rows in one query rather than one per row. Scouts flags a page that still makes many trips in a row, and the app builder then pays a build to rework it — write the fast shape first.

```ts
// The session first (its id scopes every read), then one trip for everything independent, then one batched trip for the children
export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const [projectRows, taskRows, [profile]] = await Promise.all([
    db.select().from(projects).where(eq(projects.ownerId, user.id)).limit(50),
    db.select().from(tasks).where(eq(tasks.ownerId, user.id)).limit(50),
    db.select().from(profiles).where(eq(profiles.userId, user.id)),
  ]);
  const memberRows = projectRows.length
    ? await db.select().from(projectMembers).where(inList(projectMembers.projectId, projectRows.map((p) => p.id)))
    : [];
  const membersByProject: Record<string, typeof memberRows> = {};
  for (const m of memberRows) (membersByProject[m.projectId] ??= []).push(m);
  return { projects: projectRows, tasks: taskRows, profile, membersByProject };
}
```

- **A loader has as many stages as its data has dependencies, never more.** The session comes first because its id scopes the reads; after it, every read whose input is already known goes into one `Promise.all`. A second stage exists only for a read that needs a row from the first (a record's children, a lookup keyed by a value the first stage returned).
- **A check that only gates the page is a read like any other.** A plan, role or membership lookup whose result no other query needs runs inside the same `Promise.all`, and the loader still throws or redirects on it before returning anything. A check whose result changes what is read (an admin sees every row, a client their own) stays before the reads.
- **Related rows come in one query per table, never one per row.** Collect the ids from the list, read the children with `inList` from `~stencil/db` (Drizzle) or an `in` filter (the data SDK), and group them in code. Both take an id list of any length; never Drizzle's `inArray`, which fails once the list passes 100 ids whatever the `limit` above it. A loop that awaits a query per item is the slow shape whatever the loop looks like.
- **A layout loader pays its stages on every page change under it.** Keep it to the session and the one or two reads the shell needs; the page's own data belongs in the page's loader.

> **Load the `instant-actions` skill before writing any screen where an app user posts, replies, comments, sends a message, saves a note, or toggles something** — the text shows at once under a browser-made id, a failed send says so and keeps the text, shell links prefetch, search is debounced, and notifications run after the response.

### What a loader returns is what the reader receives

Everything a loader returns is serialised into the page and sent to whoever opened it — signed in or not, whatever the component later shows. A field the screen hides, blurs, or shows only to the owner has already reached the browser; `{role === "admin" && <Notes />}` hides nothing. The data you return must be decided on the server from who is asking, before it leaves:

- **Pick columns, never return a whole row** from a public page, a share-link page, or a page a lower role (client, member, viewer) can open. Select the fields that page shows and nothing else.
- **A page two audiences share picks per audience**: one shape for the owner or admin, a narrower one for everyone else, chosen in the loader from `requireRole` / `hasRole` / `db.me`, not in JSX.
- **Some columns never leave the server at all**: a correct answer or score key the action grades against, a password or passcode the screen asks for, an invite or share token, a signing secret, an outside-service access token, another person's email or phone, private notes. If the server needs it, the server reads it in the action; the loader does not carry it.
- **A share token or gallery code is an audience, not a password**: the page it opens gets the least data, never the parent record (the whole project behind one child's gallery, the whole site behind one shared view).
- **A list a signed-out visitor sees blurred, truncated or behind a "sign in to see" overlay** is a leak when the rows are in loader data. Return a count or placeholder rows to that visitor, not the rows.
- **A page reached by a token or an emailed link** (an order's download page, a shared record) returns the handful of fields it draws, and nothing at all once the link is expired or revoked; a token on a public page is a key every visitor keeps, including after the thing it opens is taken down.

```ts
// BAD — the whole row ships; `internalNotes`, `accessCode` and `correctOption` are in the page source
export async function loader({ params, context }: Route.LoaderArgs) {
  const [project] = await db.select().from(projects).where(eq(projects.slug, params.slug));
  return { project };
}

// GOOD — the public page gets the public columns, decided here
export async function loader({ params, context }: Route.LoaderArgs) {
  const [project] = await db
    .select({ id: projects.id, title: projects.title, description: projects.description, coverUrl: projects.coverUrl })
    .from(projects)
    .where(eq(projects.slug, params.slug));
  return { project };
}
```

### Controls that change what data is shown

A loader runs only on navigation. A control — a filter, tab, picker, or sort —
whose value sits in `useState` beside data read once from `loaderData` re-renders
the same stale payload after every change: the control does nothing until the app
user leaves the page and comes back.

> **Load the `control-driven-data` skill before writing any screen where a
> control decides what loaded data is shown.**

### Server-only code (`.server` modules)

Keep server-only helpers — anything that touches the database, secrets, `context.cloudflare.env`, or a platform SDK — in a `*.server.ts` module (e.g. `app/lib/trends.server.ts`). React Router strips `.server` imports **only** from a route's `loader`, `action`, `middleware`, and `headers`. If any client-reachable code references the module — the default component, a `~/components/*` it renders, or any non-loader export — it gets bundled for the browser and the **build fails** with "Server-only module referenced by client".

A helper that needs the environment takes the global `Env` as its parameter type — never a hand-declared look-alike or a cast, both of which fail the type check. App secrets are not on `Env`: read one with `secret(env, "NAME")` from `~stencil/secrets`, which is `undefined` until the app builder sets it in **Settings → Build → Secrets**. An outside tool's webhook address (Slack, Make, Zapier, Discord, a CRM hook) is a credential like any key: never a literal in source, and preferably not in code at all — `emit()` the event and let the app builder add the address under Events. The build refuses a known key prefix or hook address written into the source.

Reference the helper only inside `loader`/`action` and pass its result to the component through `loaderData`:

```tsx
// BAD — the component references the server helper, so it's bundled for the
// client and the build fails.
import { getTrend } from "~/lib/trends.server";

export default function Trend() {
  const trend = getTrend(id); // runs in the browser bundle → build fails
  return <TrendChart trend={trend} />;
}

// GOOD — the helper is referenced only in the loader; the component reads loaderData.
import type { Route } from "./+types/app.trends.$id";
import { getTrend } from "~/lib/trends.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  return { trend: await getTrend(context.cloudflare.env, params.id) };
}

export default function Trend({ loaderData }: Route.ComponentProps) {
  return <TrendChart trend={loaderData.trend} />;
}
```

Resource routes (`api.internal.*` and other routes with no default component) leak the same way: a `.server` import referenced at module scope or from any export other than `loader`/`action` is still bundled for the client. Keep every `.server` reference inside `loader`/`action` — never at the top level or in a re-export.

### Route module names must never end in `.client`

The mirror convention: the bundler treats any module whose basename (or a parent directory) ends in `.client` as **browser-only** and substitutes an empty module for it in the server build. For a helper that's fine — for a **route module** it is fatal, and silent: the build passes, but the server has no handler for that route, so every click on it throws `No result found for routeId routes/<name>` — in every browser, in incognito, after every rebuild.

This trap is easy to walk into by naming a screen "client": a "Client Strategy" tab under `/app` naturally becomes `routes/app.client.tsx`. Never write a route module whose file name ends in `.client` — pick another name (`app.clients.tsx`, `app.client-strategy.tsx`). The URL is not affected: it comes from the `route()` path argument in `app/routes.ts`, not from the file name.

**Diagnosing it:** if a single tab or screen fails with `No result found for routeId routes/….client` while every other route works, the cause is the route module's file name — nothing else. It is not a browser cache, an error boundary, or a serving/deploy fault, and rebuilding or rewriting the screen under the same name cannot fix it. Rename the module file so it no longer ends in `.client`, update its entry in `app/routes.ts`, and keep the URL path unchanged.

## Dates & time — avoid hydration mismatches

This app is server-rendered in **UTC** and hydrated in the browser. The server
HTML and the first client render must be **identical**, or React throws a
hydration error (#418). **Every stored timestamp an app user sees is formatted
through `~stencil/time` in `useViewerTimeZone()`** — never `toLocale*`, which
prints UTC on the server. Common causes: reading the current date/time during
render (a UTC "today" is also the wrong calendar day for most viewers), reading
`localStorage`/`window` during render, random ids, and invalid tag nesting.

> **Load the `hydration-safe-rendering` skill before writing any render whose
> output depends on the browser or the clock** — current-time or "today" UI,
> `localStorage`/`window` reads, or a block shown only on the client. It has the
> `~stencil/time` viewer-timezone pattern, the `useHydrated`/`ClientOnly` API,
> and the mismatch patterns to avoid.

## Injected HTML (`dangerouslySetInnerHTML`)

React 19 rewrites the whole inner HTML whenever it gets a new `{ __html }`
object, and an inline `{{ __html: … }}` is new on every render. So every
re-render replaces the elements inside it. That loses their scroll position and
focus, and detaches any node or listener you grabbed with `querySelector`.
Prefer JSX for anything interactive. When you must inject HTML, memoise the
object or the element that renders it:
`const html = useMemo(() => ({ __html: build(data) }), [data])`. Any effect
that queries nodes inside it must run on the same dependencies.

## Assets

The list of available asset files is provided in your system prompt. Reference them as:

```tsx
<img
  src="/assets/hero.jpg"
  alt="Team collaborating around a dashboard"
  width={1536}
  height={864}
  className="w-full h-auto"
/>
```

**Every `<img>` needs `alt`, `width`, and `height`** — heroes, features, logos, avatars, inline photos alike:

- **`alt`** — default from the image brief's subject (a hero generated as "hero banner showing a dashboard" → `alt="Dashboard overview"`); use `alt=""` for purely decorative imagery, but never omit it.
- **`width`/`height`** — match the shape you asked for, so the browser reserves the right box: `16:9` → `1536×864`, `4:3` → `1024×768`, `1:1` → `1024×1024`, `9:16` → `864×1536`, `3:4` → `768×1024`. Paired with `className="w-full h-auto"` so the image stays responsive and the page doesn't shift as it loads.
- **Uploaded photos have their own shape** — landscape, portrait or square, decided by the camera, not by the layout. Use the photo's real pixel size for `width`/`height` and show it at its own aspect ratio (`w-full h-auto`, or `object-contain` inside a bounded box). Never force uploaded photos into one fixed-ratio tile with `object-cover` unless the app builder asked for uniform tiles; it clips the sides of group photos and prints. The `storage` skill has the gallery pattern.
- **`<StoredPhoto>` for every `/assets/` and `/api/files/` picture** — `import { StoredPhoto } from "~stencil/ui/photo/stored"` and use it in place of `<img>`, with the same props: `<StoredPhoto src="/assets/team.jpg" alt="…" width={1536} height={864} className="w-full h-auto" />`. It asks the platform for a copy sized for the slot and the screen (a `srcset` of `?width=` renditions, served as WebP) and loads the picture only when it scrolls into view. Pass `priority` to a hero, a header logo or anything else visible on load, and `ratio="1/1"` for a cropped square such as an avatar, with `gravity="face"` when it shows a person so the crop keeps the face, never hand-tuned `object-position`; a `priority` picture narrower than the screen also takes its width as `sizes` (`sizes="160px"`). This is the one way to size a stored picture: the stored file stays untouched, so never shrink, convert or compress an image file yourself, never store a second, smaller copy, and never write a resizing route. Whenever you touch a screen that still draws a stored picture with a plain `<img>`, move it onto `<StoredPhoto>`. A hand-written `?width=` (about twice the displayed width) is only for the places that take an address and not an element: a CSS `background-image`, an `og:image`, a video `poster`.

### User-uploaded files

Every file the user attached for this turn is listed in the task prompt with the path to open it at — a copy on local disk under `/tmp/storage/` (e.g. `/tmp/storage/uploads/1234-logo.png`). That list is complete: when the prompt lists no files, there are none, and there is nowhere else to look for them.

An asset is a file the app serves at `/assets/<name>`. It is stored by Stencil, not in the app's code, and the App preview and the Published app serve the same copy. Three tools reach the assets: `assets_put(origin, target)` copies the local file `origin` to `/assets/<target>` and replaces any file already there, in both versions at once; `assets_get(origin, target)` copies `/assets/<origin>` to the local path `target`; `assets_list(prefix?)` lists names and sizes.

To use an uploaded file in the app, copy it to `/assets/<name>` from the path the prompt gives — `assets_put` with `origin: "/tmp/storage/uploads/1234-hero.jpg", target: "hero.jpg"` — then reference it in code as `/assets/hero.jpg`. `assets_put` is the ONLY way a file reaches `/assets/*`: a file written into the app's own `public/assets/` passes every local check but 404s in production. Never copy anything to `/assets/logo.png` — that file is the platform-rendered app icon (see "Platform-managed — don't touch" above). Nothing is ever deleted from `/assets/*`: a file you no longer need is simply no longer referenced.

### The app's logo

The app's logo is `/assets/brand/logo.png`: the logo the app builder uploads on the Brand kit page (More → Settings → Brand kit → Logo), or the app icon until one is uploaded, so the path always shows a picture. Every place that shows the app's logo — header, sidebar, footer, loading screen, the sign-in and sign-up screens you write — draws it with `<BrandLogo>` from `~stencil/ui/brand-logo` (`<BrandLogo alt="<app name>" />`; `alt=""` when the name is written beside it), never a raw `<img>` and never a copy under another name, so a new logo shows everywhere at once without a build. It is `h-8 w-auto` unless you pass a `className`: size it by height, with `object-contain` in a bounded box when the slot is fixed. A library header or footer takes it as its `brand.logo`. A library app frame takes the path instead, as its `brand.mark` (`mark: BRAND_LOGO_SRC`, exported from the same module): that slot is a small square that crops to fill, so pass it for a logo that is square or close to it, and leave `mark` out for a wide wordmark, where the name the frame writes stands in. When the app builder attaches a logo (PNG, JPEG, WebP or SVG), make it the app's logo with `assets_put` to `target: "brand/logo.png"` — the path keeps that one name whatever the file's format, an SVG included — and draw `<BrandLogo>`, not the upload's own path. That sets the same logo the Brand kit page shows, so never tell the app builder a build cannot set their logo, and never send them to Settings → General → Icon for it: that is the app icon. In an app that still carries its own logo copies or raw logo `<img>` tags, replace them with `<BrandLogo>` whenever you touch a logo, but first make sure the shared path holds that logo. `assets_list` with `prefix: "brand/"` shows whether a logo is set. With no `brand/logo.png` there, the path shows the app icon, so first copy the file the header draws to `brand/logo.png` (`assets_get` it to a local path when it lives under `/assets/`, then `assets_put`), and only then swap each tag. With one there, it is the logo the app builder chose: swap each tag and copy nothing. A copy that shows a different picture (a white version on a dark footer, a square mark beside the wordmark) keeps its own file.

Uploaded font files are already in place: set-up copies each one to `/assets/fonts/<name>`, and the task prompt names each file's path. Never copy a font there yourself unless the task prompt says set-up could not copy that file; then make the one `assets_put` call the prompt gives for it, and only that one.

Add one `@font-face` per file to `theme.css`. All files of one typeface share ONE `font-family`; each rule gets the file's real `font-weight` and `font-style`. Read them from the filename suffix: Thin 100, ExtraLight 200, Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800, Black 900; `Italic` or `Oblique` sets `font-style`. When the task prompt lists the `@font-face` CSS for an upload, copy it as written.

```css
@font-face {
  font-family: 'MyFont';
  src: url('/assets/fonts/MyFont-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'MyFont';
  src: url('/assets/fonts/MyFont-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

Use `font-weight: 100 900` only for a variable font (a name such as `MyFont[wght].ttf` or `MyFont-VariableFont_wght.ttf`). On a static file it claims every weight, so bold text never renders bold. Never make one family per file, and never name a file (`'MyFont Bold'`) in `--font-display` or `--font-sans`; set each token to the family that fills that role.

## Database (Drizzle + D1)

The current database tables are in `/home/user/app/app/generated/db-schema.ts`. Drizzle exports each column under a camelCase name (e.g. `created_at` → `createdAt`, `created_by` → `createdBy`) — always use those camelCase names in your code.

**Never guess a column name in SQL — read it.** The Drizzle name is not reliably the real one: tables can legitimately mix camelCase and snake_case, so converting by convention is a guess, and so is inferring a name from what the field is for. Before you name a column in a `dbExecute` statement, call `describeSchema` with the table to get its real column names. If a statement is rejected for an unknown column, the result's `tables` lists the real columns of every table the statement names, and `rejected` names the bad column and its real spelling when the guess only differed by casing — use those, never a second guess.

**The camelCase export is never the SQL name.** In `db-schema.ts` and `app/.stencil/auth/schema.ts` the physical column is the quoted string inside the column call: `emailVerified: integer("email_verified")` means SQL sees `email_verified`, and `emailVerified` is rejected. The platform tables are snake_case throughout — `user` has `email_verified`, `created_at`, `updated_at`; `session` has `user_id`, `expires_at`; `account` has `user_id`, `provider_id`, `account_id`; `subscription` has `user_id`, `tier_id`, `current_period_end`. An entity table stores each field under the exact name it was declared with, plus `id`, `created_at`, `updated_at`.

**RULE: Platform-owned tables are read-only.** `subscription`, `user`, `session`, `account`, `verification`, and every `oauth_*` table mirror Stripe and the auth layer, and the platform rewrites them from its own sources. Read them freely, but never INSERT/UPDATE/DELETE them via `dbExecute` or any SQL — a hand-written row (e.g. a comped `subscription` marked active) lies to every gate that reads it and gets overwritten. If a subscription or auth gate blocks what the builder wants, say so plainly — the answer is a Stencil-side path, never a forged row and never disabling the gate.

**RULE: Never declare `id`, `created_at`, or `updated_at` in an entity schema.** Every entity table gets those three columns automatically — Stencil creates and maintains them. A data-scoping column (`created_by`, `workspace_id`) is NOT automatic: declare it yourself whenever the table needs one — the `"private"` access preset requires a `created_by` text field.

**RULE: Always read `/home/user/app/app/generated/db-schema.ts` before touching the database schema.** If the entity already exists there, use `updateEntity` — never `createEntity` or `createEntities` for something that already exists. Only create an entity whose slug is absent from that file.

Manage tables with `createEntity`, `createEntities` and `updateEntity`. `createEntity`
takes a full schema for one table; `createEntities` takes a list of those same objects
and creates them all in one call — use it whenever several new tables are needed at once
(a first build's whole data model), and `createEntity` when adding one more table on an
iteration. Its result lists each created table's slug and `exportName`, and which failed
and why — a failed entity never undoes the ones already created. `updateEntity` takes a
list of field actions (add / update / rename / remove), so untouched columns are always
preserved. All
three refresh `/home/user/app/app/generated/db-schema.ts` for you. Their input schemas are
deferred — fetch them with ToolSearch
(`select:mcp__stencil__createEntity,mcp__stencil__createEntities,mcp__stencil__updateEntity`)
rather than guessing at field names.

Constraint changes go through `updateEntity` too — never by hand-editing `db-schema.ts`, which is regenerated from the live DB and won't change the real rule. To make a required field optional (relax its `notNull`), `update` it with `"required":false`:

```json
{ "slug": "tasks", "actions": [{ "type": "update", "field": { "name": "deadline", "type": "datetime", "required": false } }] }
```

Note: `checkbox` values are `true`/`false` (not `1`/`0`).

**RULE: Lists of any length go through the SDK; never count placeholders by hand.** D1 refuses any statement with more than 100 bound parameters (`too many SQL variables`), and `~stencil/data` handles that cap for you: an `in` filter (`{ id: { op: "in", value: ids } }`), an `expand`, `createMany(rows)` and `createNotifications(env).send({ toUserIds })` all take a list of any length — a thousand ids, a thousand rows — and never chunk, slice or count. So a lookup of every app user's name, a seed or import that saves a list, and a notification to everyone are each one call with the whole list; never a loop of `get`, never a hand-sliced `inArray`, never a chunked insert. The cap still bites a statement you write against Drizzle (`inArray` binds one value per id; a multi-row insert binds rows × columns, so twelve rows of a nine-column table already fails): a Drizzle lookup by a list uses `inList(column, ids)` from `~stencil/db` in place of `inArray`, whatever the list's length; for a write prefer the SDK call, and if it must go through Drizzle, insert in chunks of `Math.floor(90 / columnCount)` rows — sized from the column count, never a fixed row count — and let a rejected statement fail the request: never report success, and never blame the app user's file, over a write the database refused.

### Data Scoping

Tables that hold user-specific or tenant-specific data must be scoped to prevent users from accessing each other's records. Think about the right scope for the app, e.g.:

- **Per-user** (most common) — add a `created_by` field storing `user.id`. Use this when each user owns their own records (personal tasks, notes, contacts).
- **Per-workspace / per-team** — add a `workspace_id` field when records are shared within a group but isolated from other groups.
- **One person, business or team runs the whole app** (a shop's orders, a studio's bookings, a team's board, a personal assistant) — no scope column: the rows are the business's, shared by its staff, and the gate is `requireRole` in every loader and action that reads or writes them (see "Admin or owner gates"). A `created_by` scope here hands every stranger who signs up a back office of their own, and a public page that lists the "active" rows then shows theirs beside the business's and files its orders under them.

Always store IDs — never names or display strings. Always set the scope field on insert and filter by it on every query.

To scope data to the preview user, use the ID given in your instructions, or call `previewUser`. The live preview is signed in as this user, so any rows you insert on the user's behalf must set the scoping field (`created_by` or `workspace_id`) to it, or they will exist in the database but never appear in the preview. Rows the app builder dictated (their own schedule, profile, settings) are scoped the same way but written with `sample: false`, so they keep a plain id; once the app builder has signed up on their app, `reownRows` hands them to that account, one call per table. Never re-own rows with a hand-written UPDATE.

Rows the platform invented as sample data carry an id that starts with `seed_`. Keep that marker honest: never give a `seed_` id to a row a real person entered, and never write an invented row without it. To clear the sample data from a table in one step, `DELETE FROM "<table>" WHERE id LIKE 'seed\_%' ESCAPE '\'`. Never seed analytics, visit, or other measurement tables: a figure there has no owner to scope it to and no way for the app builder to tell it from a real one. Never seed a promotion, discount, coupon, referral reward, invoice, payout, balance or revenue figure, or policy and terms text, and never a priced row in a table of what the app builder sells to everyone (rooms, tickets, a course, plans): a seeded offer reads as a real one to whoever sees it, and a screen that reads such a table without an owner filter shows it to every app user and end user. A table whose every row belongs to one app user (a shop's products, a studio's services) is that app user's catalogue: sample rows there belong to the preview user and carry realistic prices. An amount nobody gave renders as `$—`, never `$0` or a bracketed placeholder.

**Demo, sample, preview and test modes never touch scoping.** No env var, constant, query param or setting may skip the sign-in check, drop or widen an owner filter, or relax a table's access rule, and none ships switched on. The preview already shows seeded data, so no demo mode is needed for that. Starter or sample content for a new account is created as theirs: every copied row gets the acting app user's id in its scope column, and every related id points at a row that account owns (copy those related rows too) or at a genuinely shared row — never a hard-coded owner, never another account's record.

**Anything written for previewing or checking is unreachable on the Published app.** Publish copies the preview build as it is, so a test order intent, a "mark as paid" button, a beta or early-access unlock, a `?debug=` or `?test=` switch, a hard-coded "remove before launch" account, a developer test page, a copy of a page made to photograph it, or a required-field check switched off "for now" all ship to real visitors unless the code itself keeps them out. Two rules. A path that exists only for the preview is gated by **both** `isDraft(env)` (from `~stencil/context`) and `requireRole(request, env, "admin")` — both deploys share one database, so `isDraft` alone still lets anyone who finds the path read or write real app users' rows — or it is deleted before the build; a file written only to check your own work is deleted in the same turn, never left with a note saying it will be. And never write a path that creates an order, marks something paid, grants access, or returns another app user's rows with a "test" flag standing in for the payment or owner check. There is no test mode for payments, and none is needed to walk the paywall: on the App preview, the preview user's own purchase of an app plan is discounted to $0 by the platform (Stripe's page still takes a card, no code is shown, and it never counts as a sale) — say so when asked, instead of writing a bypass; free access for a chosen app user is **Give free access** on the app builder's Users page; and a page as a visitor sees it is `dev-tools screenshot --signed-out` (the `screenshot` tool with `signedOut: true` where that tool is offered). None of this forbids a staged rollout: a feature the app builder turns on for chosen app users first is a stage stored in the database, checked on the server by one helper, off when missing and changed only by an admin, and it never replaces a payment or owner check (the `feature-rollouts` skill; load it before writing one).

### Code Usage

Import tables from `~/generated/db-schema` using their **exact exported name** — the `exportName` that `createEntity` / `createEntities` return for each table (and `regenerateSchema` lists for all of them). Copy it from that result; only for a table created on an earlier turn, open the file (`/home/user/app/app/generated/db-schema.ts`) and copy it from there. Never guess. Importing a name the file doesn't export (e.g. `event` when it exports `events`) fails the build with `MISSING_EXPORT`. Import only the tables you actually use. Use `createDb` from `~stencil/db` in loaders and actions only.

If the file looks out of date, call `regenerateSchema` to rebuild it from the entities that exist. If a table you expected still isn't exported afterwards, its entity was never created — create it with `createEntity`.

```ts
import { createDb } from "~stencil/db";
import { contacts } from "~/generated/db-schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "~stencil/auth/server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);

  const records = await db
    .select()
    .from(contacts)
    .where(eq(contacts.createdBy, user.id))
    .orderBy(desc(contacts.createdAt))
    .limit(50);

  return { records };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const now = new Date().toISOString();

  const [created] = await db
    .insert(contacts)
    .values({
      id: crypto.randomUUID(),
      name: "Jane",
      email: "jane@example.com",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(contacts)
    .set({ phone: "+1234567890", updatedAt: now })
    .where(eq(contacts.id, created.id));
  await db.delete(contacts).where(eq(contacts.id, created.id));

  return Response.json({ success: true });
}
```

**An action parses what the form sends before it writes.** A browser-side check (`min`, `max`, a `<select>`, a clamp on blur) protects nothing: anyone can edit the request. Every value the form legitimately supplies is parsed on the server with `zod` (already a dependency) against the domain the app designed — `z.coerce.number().int().min(1).max(5)`, `z.enum([...])`, a length cap on text — and a parse failure returns the error to the form and writes nothing. A number is bounded at both ends (a distance that is only checked as above zero lets one 50,000 km run top a leaderboard), a date is a real calendar date inside the window the screen offers, and a slot or seat the screen showed as free is looked up again before it is taken. A JSON body is parsed the same way as a form. A parse proves the value is well-formed, not that the browser may choose it — a value the server already holds is never read from the form at all (see "A fact the server can look up is never taken from the request"). A record id in the request (a profile, a booking, a listing) is loaded and checked against what the caller may act on before anything is written under it — a child login writes only to its own profile. Check the caller may do the thing before the write, never after — a write that lands first stays landed.

## Bulk work — every request has a budget

A request to the app runs inside Cloudflare's per-request budget, and an "Add all", "Import", "Copy all photos" or "Send to everyone" screen is the first thing that hits it — in the Published app, in front of an app user, after the rows written so far are already saved. The limits:

- **100 bound values per database statement.** The SDK's `in` filter, `expand`, `createMany` and notification sends stay under it whatever the list size, and so does `inList` from `~stencil/db` in a Drizzle query; a Drizzle `inArray` or multi-row insert fails past 100 values (see the rule above).
- **100 nesting levels per SQL expression, and some built-in functions refused.** A chain of `||`, AND, OR or `+` is one level per operator, so a raw statement that joins ~25 quoted columns and nests the chain in a CASE or subquery (a save fingerprint, a search over many columns) fails at parse time, on every request, with `Expression tree is too large (maximum depth 100)`. Join columns with `concat_ws(sep, a, b, …)` or `group_concat`, write a long OR as `col IN (…)`, and hash a fingerprint in code, not in SQL. Some SQLite built-ins are refused outright with `not authorized to use function` — `POWER()` and `sqlite_version()` are known cases — so do that maths in code.
- **~50 bytes per `LIKE` or `GLOB` pattern.** A longer pattern fails at parse time, on every request, with `LIKE or GLOB pattern too complex` — a prefix that embeds an id (`'media/<uuid>/%'`) is over it every time, in raw SQL, Drizzle `like()` and the data SDK's `like` filter alike. Match a prefix with `substr(col, 1, length(prefix)) = prefix` and a substring with `instr(col, text) > 0`; neither has a cap.
- **~30 s of CPU per request.** Time waiting on the network is free; parsing a big file, resizing images or pumping bytes between storage objects is not. Past it the Worker is killed mid-request and the browser's fetch never resolves.
- **~100 MB request body.** A whole spreadsheet or a whole folder of photos posted in one request dies here — chunk the upload (the `storage` skill shows how).
- **Every outbound call counts.** Each `fetch`, each database statement and each storage read or write is a subrequest with a per-request cap, and a storage copy is two. A request that loops them over hundreds of items also runs long enough that browsers and proxies give up, so the screen shows "Importing…" forever while the server kept writing.

**RULE: One request does bounded work.** Anything over a few dozen rows or files is driven from the client in slices, and each slice is one short request. Load the `data-sdk` skill for the full recipe (`## Bulk work beyond one request`); the shape is:

1. The server action takes a slice (`rows` or a `cursor` into a stored list), does at most a few hundred rows via `createMany` or at most ~20 storage copies / outbound calls, and returns `{ done, nextCursor, processed, total }`.
2. The client loops: send a slice, update a progress bar from `processed / total`, stop on `done`, and stop on the first failed slice with the server's error shown — never report success over a slice that failed.
3. Every slice is safe to repeat: rows carry a stable key the server skips or upserts on, so a retry after a dropped connection resumes instead of duplicating.
4. A Stop button that ends the loop; what landed stays landed and the screen says how many.

How a blown budget looks in the app's errors (`appErrors`): `too many SQL variables` is the statement cap, and it only ever comes from a hand-written Drizzle statement — swap an `inArray` for `inList` from `~stencil/db`, and move an insert onto `createMany`, rather than slicing it; `Worker exceeded its CPU time limit` is the CPU budget; `Too many subrequests` is the outbound-call cap. The last two mean "slice the work", never "retry the same request". `Expression tree is too large`, `not authorized to use function` and `LIKE or GLOB pattern too complex` are the three parse-time limits above: the same SQL fails on every request, so rewrite the statement.

## Logs and error replies — what may leave the server

Server logs are read by people the app user never agreed to show their data to, and an error reply is read by whoever is on screen, so each carries only what a failure needs:

- **Never log what an app user typed, or a whole request, delivery or record** — no `console.log(body)`, no `console.log("saved", record)`, no `console.log("order update", event.data)` in a webhook receiver, no email address, message or document in a log line. This holds for an ordinary handler's routine logging, not only for a line added while debugging. Log the id, the event type, the count or the step name instead.
- **Never log or show any part of a credential, or a detail of one** — not a key, a token, a password, a signature, nor its first or last characters, its length, or whether it is a live or a test key. A key that looks wrong is logged as "missing" or "rejected", nothing more, and the screen says only that the connection is not set up.
- **Never return a provider's message, an exception's text or a stack to the browser** — not in an action's data (`{ error: error.message }`, an `__actionError` field), not in `Response.json`, not stored on a row a page later shows. The error goes to `console.error` whole; the screen gets a plain sentence.
- **Troubleshooting text you add while chasing a bug goes to `console.error` only**, where the app builder's error list shows it — never to a screen an app user sees, a cookie or a stored row, however temporary you mean it to be.

`failed` from `~stencil/errors` does both: `return failed("smart fill", error, "Couldn't fill this in right now — please try again.")` logs the error and returns `{ ok: false, error: <that sentence> }`. The build prints a **Logging** section when a line you added or changed breaks these rules; it is for you to act on before you reply.

## File Storage (R2)

> **Load the `storage` skill before touching a file upload, image, video, audio, or any other binary data** — adding one, extending an existing one, or fixing one that's not working. Read it before you open the storage code, not after.

Use `createStorage` from `~stencil/storage` (server-side only). Keys are scoped per-app automatically. Never store file bytes in D1 — store in R2, keep the key (string) in D1. Deleting a record deletes the files it owns — every delete action calls `deleteStoredFiles` after the row is removed, never before. Every file an app user picks goes through the platform uploader — `handleUpload` from `~stencil/upload/server` behind the app's upload route, `uploadFile` / `uploadFiles` from `~stencil/upload/client` in the screen — never a hand-written chunked upload or a whole file posted to an action. A size the browser declared is never a limit check: `handleUpload` measures the stored bytes at the finish and enforces the limit the server passes (the file cap, the owner's allowance, or the smaller of the two). See the `storage` skill for full API and patterns.

**A picture or video from an outside address an app user supplied is never shown to others from that address.** The rule is about where the file comes from, not the field it arrived in: a typed or pasted "Photo URL", the preview image of a link an app user imported (a recipe page, a saved article), the cover art in a podcast or RSS feed they added, an address that arrived through a webhook or an API route — anything not uploaded into the app. Rendered in an `<img src>`, a `background-image`, a `<video src>` or `poster`, or an `og:image`, it is a tracking beacon and a content-swap channel: every viewer's browser calls the poster's server, which learns their IP address and device and can swap the file later. Prefer an upload field. Otherwise the action copies the picture in once — `storeImageFromUrl` from `~stencil/storage` for an address, `page(url, { storeImage })` from `~stencil/fetch` for a link preview — and the screen renders `/api/files/<key>` from the app's own `api/files/*` route, which the app needs even when it has no upload field. Video has no copy path: a YouTube, Vimeo, Loom, Descript or Google Drive link plays through `<VideoEmbed>`; a direct video file address becomes an upload. Only a picture the app builder alone can set may stay an outside address (the `storage` skill has the patterns).

## File downloads & exports

> **Load the `file-export` skill before wiring any download or export** — a "Download" button, CSV export (server-side or built in the browser), saving a canvas, serving a stored file as a download, or a row sent to a Google Sheet. Use `~stencil/files`; never hand-roll it. Every spreadsheet cell passes through `toCsv` or `sheetText`.

## AI

Only add AI features if explicitly asked. Use `createAI` from `~stencil/ai` (server-side only). No API keys needed. See the `ai-sdk` skill for the full API. The gateway behind it serves chat, structured output, image input, embeddings, speech to text and image generation, and nothing else. Text to speech (read aloud, a spoken reply), music and sound effects are not on `createAI`: they are `createAudio(env)` from `~stencil/audio` (load the `runtime-audio` skill). The `ai-sdk` skill's table is the whole answer — never read the helper, the SDK or the gateway to find out what works, and tell the app builder plainly when something is not available.

Speech to text — a recording, a voice note, the words in an uploaded video — is `createAI(env).transcribe` (server-side, keyless, timestamps included) for a clip under 10 MB. **Captions for an uploaded video, hours long included,** are one media job: `createMedia(env).transform({ operation: "captions", input: videoKey })` writes a WebVTT file at `captionKeyFor(videoKey)` beside the video, and `<VideoPlayer>` from `~stencil/ui/video/player` shows it with a captions switch. Never split a long video by hand, and never ship a speech model to the browser; the browser's own recognizer is only for live dictation as someone speaks. Load the `ai-sdk` skill, the `media-processing` skill for captions, and the `voice-input` skill for the microphone side.

A pasted video link — a YouTube, Vimeo, Loom, Descript or Google Drive address an app user saved — plays in the page through `<VideoEmbed url={link}>` from `~stencil/ui/video/embed`: a still with a play button that loads the provider's own player only when pressed, and a plain link for any address it does not know. `parseVideoLink(url)` says whether a link is one of them. The app's `<Markdown>` already does this for a paragraph that is only such a link, except a Google Drive link, whose address never says whether the file is a video (`parseVideoLink` marks it `maybeFile`), so a Drive player appears only where you render `<VideoEmbed>` yourself. Never match video addresses by hand, write an `<iframe>` for a video host, or open a video link in a new tab when the app builder asked for it to play in place. A direct video file address an app user pasted (an `.mp4` or `.mov` link, a file on their own server) is never a `<video src>` other people load — the File Storage rule above applies, and since nothing copies video in, the field becomes an upload.

## Rendering videos with Remotion

Only add video if the app needs it. The app authors Remotion compositions in `app/remotion/` and renders them with `createRemotion` from `~stencil/remotion` (server-side only). Output is an R2 key in the app's own storage — never bytes. Keep `app/remotion/` self-contained — a composition imports from inside it and from packages, never `~/…`. Load the `remotion` skill before writing any of it: it covers the composition constraint, the props/assets model, polling, and verifying a frame with `dev-tools remotion still` (the `remotion_still` tool where that tool is offered).

## Combining and converting audio and video

Stored media that must be changed — a voice track over music, background music under a video, a trimmed or stitched clip, a voice note converted so it plays everywhere, captions for an uploaded video — goes through `createMedia` from `~stencil/media` (server-side only, asynchronous: a `jobId` to poll). Output is an R2 key in the app's own storage — never bytes. Never add ffmpeg.wasm or an npm media library; they cannot run on Workers. Load the `media-processing` skill before writing any of it.

## Searching the app's own records

A search box over the app's own data — contacts, posts, lessons, products — uses `searchRecords` (by word, ranked) or `nearestRecords` (by meaning, over stored embeddings) from `~stencil/records`, server-side over the whole table. Never filter the rows a page already loaded, and never point `createSearch` at the app's own data: that searches the public web.
**Load the `record-search` skill before building any search, find or "related items" feature over stored records.**

## Web search & fetch

The app can search and fetch the open web server-side, no API keys needed.
**Load the `web-search` skill before building anything that reads the web.**

## Maps

A map of records with a location, a pin picker on a form, and address lookup all ship with the platform: `<PlacesMap>` and `<PinPicker>` from `~stencil/ui/maps/*`, `createGeocoder` from `~stencil/geocode`. No key, no map library to add, nothing to draw by hand.
**Load the `maps` skill before building anything that shows a place on a map or sets one.**

## Drag to reorder

A list app users put in their own order, and keep it, ships with the platform: `<SortableList>` and `<SortableGroups>` from `~stencil/ui/sortable/list` (handle, mouse, finger and keyboard, items can move between sections) and the Data SDK's `moveRow` / `nextPosition`, which save a move as one row write against a `position` number field. No drag library, no drag events, no reorder route by hand.
**Load the `drag-to-reorder` skill before building anything an app user reorders, including "move up / move down" buttons.**

## Recurring actions

This app can run server-side work **on a schedule** — "every morning refresh the events list", "email each user a weekly summary", "every hour expire stale rows" — via an `app/schedules.ts` manifest plus a handler in the trusted `api/internal/scheduled` route. Never fake scheduling with client-side timers, `setInterval`, or a "run now" button; those don't run when the app is closed.

> **Load the `recurring-actions` skill before building one** — it has the manifest fields, the scaffolds to start from, the cadence contract (~5-minute floor, one retry, idempotency), and the rules on what not to build. Only when the brief asks for scheduled/repeating work ("every…", "daily", "weekly", "hourly", "nightly", "each morning"); skip it otherwise.

## Receiving webhooks

An outside service — a form builder, a payment provider, a video or calendar service, a mailing-list tool — proves a delivery is genuine by signing it with a secret the app builder saves in **Settings → Build → Secrets**. `webhookAction` from `~stencil/webhooks` does the whole check: raw bytes before parsing, constant-time comparison, the replay window, and a 401 when the secret is unset. Never hand-roll it, never copy the platform's `SCHEDULE_TRIGGER_SECRET` bearer check (an outside sender has no bearer token), and never accept a delivery because the secret "isn't configured yet".

> **Load the `webhooks` skill before building a route an outside service posts to** — it has the signature descriptions for common senders, the route to copy, how to type and name the secret, and what to tell the app builder. Only when the brief asks the app to receive something another service pushes; skip it otherwise.

## Keys and passwords typed into the app

A credential someone types into a form — an outside service's API key, access token, client secret, application password, or a login for another site — is a secret the app uses, never data the app stores as typed. A key the app builder holds once for the whole business is an app secret (**Settings → Build → Secrets**, read with `secret(env, "NAME")`). A key each app user holds for a service Stencil can connect goes through app user connections (load the `member-connections` skill). Only a per-app-user key for a service Stencil cannot connect — a texting provider, a blog platform, a store with its own address — lives in the app's own table, and then sealed: `seal(env, value)` from `~stencil/secrets` in the action before the save, the column under the entity's `hidden` access rule so no loader or list ever returns it, and `unseal(env, row.column)` only in the server code that calls the service, through `system(env)`. Show "connected" or the last four characters the app kept beside it, never the value; a lost key is re-pasted, not revealed. Never write your own encryption module for this, and never put a credential in a row a loader returns.

## Events

The platform tells the app when a payment fails, a subscription ends or an app user signs up, and the app can publish its own events (`emit`) that the app builder routes to Zapier, Make, a CRM or any outside tool from Project settings → Grow → Events. Destination URLs and secrets are never written into code.

> **Load the `events` skill before wiring events** — reacting to a payment, signup or cancellation inside the app (`on()` in `app/events.ts`), or sending what happens in the app to an outside tool (`defineEvents()` + `emit()`). Only when the brief asks for it; skip it otherwise.

## Wallet passes

Apple Wallet and Google Wallet passes are signed server-side using credentials the app builder gets from Apple/Google and stores in **Settings → Build → Secrets** — never from certificate files on disk, which a Worker has no filesystem to read.

> **Load the `wallet-passes` skill before building one** — it has the exact secret names, the enrolment steps to hand the app builder, how to type and read the secrets, and the Workers-safe way to sign each format. Only when the brief asks for wallet passes, tickets or membership cards; skip it otherwise.

## In-app notifications

The platform ships a notification store: a fixed-shape `notification` table in the app database, `createNotifications(env).send(...)` from `~stencil/notifications` to write rows, and a ready-made `<NotificationsBell />` header component with unread count and read state. Never hand-build a notifications table, bell, panel, or unread bookkeeping.

> **Load the `in-app-notifications` skill before building anything an app user reads inside the app** — a bell, inbox, notification center, unread badge, alerts feed, or "notify users when X happens". Push (`~stencil/push`) and email (`~stencil/email`) are separate fire-and-forget transports; the store is the durable record.

## Language switcher

An app that speaks more than one language gets `<LanguageSwitcher />` from `~stencil/ui/language-switcher` in its header, next to the account menu. It lists the app's languages, remembers the app user's pick for this browser and on their account, and renders nothing while the app speaks one language, so it is safe in every app. Never hand-build a language picker, a language column on app users, or a locale cookie. `useLocale()` from `~stencil/react-router/root` gives a screen the current language.

An app with no `app/strings/strings.<language>.json` file speaks one language, and it cannot gain a second one yet: there is no setting for it that the app builder can open, and you cannot add one. When the app builder asks for a second language, a translation beside the original, or a language switcher:

- Say plainly in your reply, the first time, that a second language is not available on Stencil yet. Never name a settings page for it, never tell them to add a language, and never end a turn waiting for one to appear.
- Build every other part of the request, and never build your own way round this one: the rule above holds however they ask.
- Offer what works today: the whole app in one other language instead, by rewriting the values in `strings.json`, or staying in the current language until Stencil supports a second.

## App agents

An app user can start a long-running AI worker from inside the app — minutes of work over several files, with progress on screen, one question at a time when it is unsure, and an output the app user accepts before anything lands in the app's storage. A definition is `app/agents/<name>/index.ts` (`defineAgent` from `~stencil/agents`, with an optional zod `output` whose validated `result` reaches `onDone`), its knowledge is `skills/<topic>/SKILL.md` beside it, `createAgents(env).run(name, { message, files, input, onBehalfOf })` starts it from a route that has checked ownership, `send(runId, message)` and `answer(runId, questionId, value)` steer it, and `<AgentRunView>` from `~stencil/ui/agents/run` shows the run and lets the app user send a note or a photo mid-run. `stencilAgentRoutes` stays registered in `app/routes.ts`.

> **Load the `app-agents` skill before building one** — the definition, tools, the trigger route, draft rows and accept — and build one only when the system prompt says app agents are switched on for this workspace; when it says they are not, every run would be refused, so build the simpler version the skill lists first. **Load `agent-knowledge`** whenever an agent needs a style, a rule set or a correction after a test run. Only when the brief asks for minutes-long, multi-file AI work an app user starts; a single prompt is `~stencil/ai`, and work on a timer is `recurring-actions`.

## App-user subdomains

An app builder can give every app user their own address under the app's domain — `sarah.theirdomain.com` — by switching subdomains on in Stencil. The platform resolves which app user a request arrived for and hands it to the app through `~stencil/tenant`; `tenantUrl` builds the addresses. Never read `Host` to work out whose request it is, and never concatenate an address by hand.

> **Load the `subdomains` skill before building anything where an app user gets an address of their own** — "their own URL", "a link of their own", "storefront per user", "portal per client", "white-label", `<name>.<domain>` per user. It has the wiring, the claim field, how to scope a loader to one app user, and what login does across the domain.

## A brand per workspace

When the app's own users are brands — each creator, studio, client or organization has a logo and colours their own people see — that brand is a few optional columns on the `workspaces` row, applied as inline CSS variables on the branded surface's wrapper. The app builder's Brand kit in `theme.css` stays the app's one theme; never write a workspace's colours into it, and never build a brand entity, asset tables or a theme store.

> **Load the `workspaces` skill before building a brand that belongs to an app user** — "each client has their own brand", "their own logo and colours", "multi-brand", "white-label", a brand kit app users fill in. Its *A brand per workspace* section has the columns, the one resolver, and where the brand does and does not reach. A white-label ask is usually both halves: the address is `subdomains`, the look is `workspaces`.

## Embedding a page on another website

A Published app's pages refuse to load inside a frame on any other website, the app builder's own site included, until the Stencil team allows that site on request. Nothing in app code can change it, and the browser shows an empty box with no error.

> **Load the `embedding` skill before writing any `<iframe>` or embed snippet or an "embed code" panel, and when a build finds the Published app refusing to load inside another site** — it says what to tell the app builder, what to offer instead, and when embed code is right.

## Support bubble

The floating support bubble on a Published app is drawn by the platform, not by the app, and is controlled only from the Support tab's Setup page (the Support tab sits beside Preview and Monitoring; it is not in Project settings). Never hide, move or restyle it, and never lay out app controls around it.

If the app builder asks about the bubble, or it covers something on a screen, do not change the app: tell them to adjust it on the Support tab's Setup page, under **Widget**, where they can pick its corner (**Position**), hide it on phones or everywhere (**Hide the bubble**), or replace it with the app's own button (**Support in-app button**). Those settings show only while Support is on. Switching Support off, or hiding the bubble everywhere, also disables the app's own help button below.

### The app's own help or feedback button

When the app builder wants their own "Get Help", "Feedback" or "Contact us" button to open the support panel, build the button in the app and call `window.stencil?.support?.open()` from its click handler (`close()` closes it). `open()` takes an optional `{ tab, category }`: `tab` is `"feedback"`, `"messages"` or `"help"` and opens the panel straight on that channel, skipping the channel menu, and for Feedback straight on the form itself; `category` (`"problem"`, `"idea"` or `"other"`) pre-selects the form's category. So a "Report a bug" button calls `open({ tab: "feedback", category: "problem" })`, a "Suggest an idea" button `open({ tab: "feedback", category: "idea" })` and a "Chat with us" button `open({ tab: "messages" })`; one app can have several such buttons. With no argument, or a tab the app builder has switched off, `open()` shows the channel menu as before, never an error. To badge that button with unread replies, subscribe with `window.stencil?.support?.onUnread(cb)`: it calls `cb(count)` now and on every change and returns an unsubscribe, so it fits a `useEffect`; `window.stencil?.support?.unread` is the current count. Style the button from the app's Brand kit and voice like any other control. It works only on the Published app and only while **Support in-app button** is on under Widget on the Support tab's Setup page, which also removes the platform's corner bubble, so tell the app builder to switch it on and leave **Hide the bubble** on Never; with it off, or in the App preview, the call is a harmless no-op. Never post feedback or messages to the platform yourself — the panel does that.

### The Feedback form on a page of the app

When the app builder wants a bug-report or feedback form on a page — a help centre, a "Report a problem" page, a settings screen — do not build one: render `<div data-stencil-feedback-form />` where the form should go, and the platform fills it with the same form the support panel's Feedback tab shows (category, message, send), drawn from the app's own tokens. Every submission lands on the app builder's Feedback page with the signed-in app user attached, exactly like one sent from the bubble. Put the page's own heading and intro around it like any other section. It fills in only on the Published app and only while the **Feedback** channel is on under Channels on the Support tab's Setup page, whether or not the corner bubble is shown; in the App preview, or with the channel off, the element stays empty, so never give it a fixed height or a border of its own. Never store feedback in the app's own database or email it instead. The one exception: when the brief says the app builder chose their own form after hearing about Stencil's Support, build the form they asked for, as they asked for it.

## Session recording notice and opt-out

Session recording of the Published app is added by the platform, outside the app's code, and switched on or off for the whole app on the Session replay page. The app cannot start, pause or resume it, but it can opt one browser out. For a "Don't record me" button, a recording notice or a consent banner, do both from the click handler: `localStorage.setItem("stencil-replay-optout", "1")`, which keeps every later page load in that browser unrecorded, and `window.stencil?.replay?.optOut()`, which also stops the recording running on this page. `replay` exists only while this visit is being recorded, so the stored key is what makes the choice hold. To undo it, remove the key; recording resumes on the next full page load.

Say the limits in the build's reply and never label the feature consent compliance: recording cannot wait for a yes (a new visitor's first page load can be recorded before app code runs), the choice is per browser and not on the app user's account, and it does not delete what was already recorded. None of it runs in the App preview.

## Server entry points that write records the app already shows

A new server entry point — an MCP tool, a webhook or API resource route, a scheduled handler, an inbound-email handler — that creates or mutates records an existing screen renders is a second door into that screen's data, not a fresh surface with its own rules:

1. **Same vocabulary.** Reuse the existing status enum and field names. Never introduce a status, kind or flag value the consuming UI does not render. If a new state is genuinely needed, add it to the type, the UI and every reader in the same change.
2. **Same pipeline.** Route the write through the same server function the UI path uses (or extract one shared function), so the record reaches the same terminal state by the same steps. Never leave a record in a state nothing on the server advances.
3. **Prove it renders.** Before claiming done, create one record through the new entry point and confirm it appears correctly on the existing screen and progresses (or can be progressed by the app user) to its terminal state. An entry point you cannot drive end-to-end from the sandbox does not excuse this: its handler is a plain server function you can exercise directly.
4. **Honest descriptions.** Tool descriptions, endpoint docs and notification copy may only name statuses and screens that actually exist.
5. **A real owner.** A webhook or inbound-email handler has no session, so a record's owner comes from the request — a per-account token in the address, URL or payload that you look up (a scheduled handler takes it from the row it is processing). Never a guess (the newest row's owner, the first or only app user, a hard-coded id); a request that names no owner is stored unassigned (visible to admins only) or rejected (inbound email still returns 200, or the platform retries it).

## Print

Printing and save-as-PDF have real pitfalls — a print container in the wrong place
prints a blank page. **Load the `print-to-pdf` skill before wiring any print
button or PDF export.**

## Authentication

Auth is fully set up — do not build login/signup UI. Stencil hosts those pages.

Better Auth logging that its `baseURL` is not set is **expected and harmless** — the platform leaves it unset on purpose so each app derives its origin per request. Ignore that warning; never chase it into `app/.stencil/`, and never report it to the app builder as a problem.

```tsx
<Link to="/login">Sign in</Link>
<Link to="/signup">Create account</Link>
```

**Sign out is a POST, never a link.** A `<Link to="/logout">` or `<a href="/logout">` puts `/logout` in browser history, and history traversal or link prefetch would end the session. Use `<SignOutButton>` (a POST form to `/logout`):

```tsx
import { SignOutButton } from "~stencil/ui/auth/sign-out-button";

<SignOutButton className="text-sm text-muted-foreground hover:underline" />
```

**Sign out from server code** (finishing a flow that must end the session): `await signOut(request, env, "/goodbye")` from `~stencil/auth/server` — it throws the redirect, so call it last in the action. Never hand-roll the sign-out replay.

**Every app with sign-in has an account page at `/auth/account`** — platform-owned, from the auth route pack: name and photo, sign-in email, password (an account without one is sent to `/auth/set-password`), other devices, two-factor, sign out, close account. Link to it from the account menu (`<Link to="/auth/account">Account</Link>`) instead of writing a profile or settings page; build one only when the app builder explicitly asks for their own, on the calls `~stencil/auth/browser.client` exports (`updateUser`, `changePassword`, `changeEmail`, `revokeOtherSessions`). See the `custom-auth` skill.

**An app-authored account settings page ships "Close my account"** too, behind a confirmation, without being asked: the action returns `closeAccount(request, env, "/")` from `~stencil/auth/server`, which deletes the account and every session and signs the browser out. It never touches billing — a subscription that will charge again returns `{ error, code: "active_subscription" }`; show the message with a Manage billing button (`manageSubscription`). The app builder may remove the control; that is a normal app change. See the `custom-auth` skill.

**Protected route** — call `requireAuth` in the loader, wrap in `AuthProvider`:

```tsx
import { requireAuth } from "~stencil/auth/server";
import { AuthProvider } from "~stencil/ui/auth/context";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  return { user };
}

export default function MyPage({ loaderData }: Route.ComponentProps) {
  return (
    <AuthProvider user={loaderData.user}>
      <PageContent />
    </AuthProvider>
  );
}
```

**Read user in sub-components:**

```tsx
import { useAuth } from "~stencil/ui/auth/context";
import { displayName } from "~stencil/auth/display-name";

function PageContent() {
  const { user } = useAuth();
  return <p>Hello {displayName(user)}</p>;
}
```

**Showing a person's name.** `user.name` can be empty: magic-link, one-time-code and platform-granted accounts carry no name. Never show an app user's email, or the part before the `@`, as their name to anyone else — not in author lines, avatars, people lists, stored display-name fields or public pages. The email is shown only to the person it belongs to, on their own account screens. Every name shown for a person goes through `displayName(person)` from `~stencil/auth/display-name`: it reads only `name` and returns "Guest" when that is empty (pass a second argument for another label; put a profile or company name first with `displayName({ name: studio.companyName || owner.name })`). Never write a name-or-email fallback of your own — `user.name || user.email`, `email.split("@")[0]`, or a stored display-name column filled from the email at sign-up or checkout — and never pass an email as the `name`. Whenever you touch a screen that shows other people (author lines, people lists, leaderboards, "just bought" notices, catalogs, team pages), check how every name on it is derived, including through any helper in `app/lib/` it reads from, and move each one onto `displayName` — even when the change you were asked for is about something else on that screen.

**A public form that takes an email answers every address the same way.** A waitlist, newsletter box, lead form, "check my status" page or app-authored sign-up that a signed-out visitor can reach must not let its reply depend on whether the address is already stored — in the auth `user` table, the app's own tables or `addToFlodesk`'s result. Show one message for every address ("Check your inbox") and put the real outcome (new, already on the list, confirm) in the email the route sends. A stored name, status or any other detail is shown only after a magic link or one-time code proves the visitor owns the address. Otherwise anyone can type a person's email and learn whether they use the app; the hosted `/login`, `/signup` and password-reset pages already answer this way.

**Route structure for authenticated content:**

- All protected routes MUST live under `/app` (e.g. `/app`, `/app/dashboard`, `/app/settings`).
- Every `loader` and `action` under `/app` MUST call `requireAuth` itself. A guard in the
  parent layout's loader does not protect child routes: the router can request a child route's
  data on its own, skipping the layout entirely, so an unguarded child loader is public.
- `requireAuth` proves only that someone signed in, and sign-up is open unless the app builder
  closed it, so any stranger can register and pass it. A screen meant for the app builder,
  their staff or one kind of person requires that role by name with `requireRole`, in every
  loader and action. Sending one other role away (`if (role === "student") redirect`) is not a
  gate, because an account with no role passes it; nor is owning a workspace the account
  created for itself. Invite-only sign-up is a setting the app builder can switch back, never
  the only gate.
- An unguessable URL is never a substitute for `requireAuth`. If a screen handles the app's data
  and you cannot put it behind sign-in yet, tell the app builder it is an open security gap —
  never present a hidden address as the protection.
- A rule the app itself enforces — an owner-only area, an emailed code, an RSVP or admission
  state, a published flag, an active flag, a permission flag, a privacy switch, a date window —
  is one named check in `app/lib/*.server.ts`, written once and called from every `loader`,
  `action` and resource route that reads or changes the records or files it protects: the page,
  its own form actions, sibling screens on the same table, the upload and file-serving routes
  behind it, the route a browser script posts to, the detail page of a child record (a lesson
  of an unpublished course is as hidden as the course), and a scheduled or webhook handler that
  reaches the same rows. A check in a loader protects only that loader, and a check the browser
  makes protects nothing: the server re-reads the setting on the route that receives the data.
  Before adding a route that touches a table or file prefix an existing route gates, call that
  route's check.
- **Before you finish a change that adds or narrows who may see or do something,** list every
  other place that reaches the same records or acts for the same person — a second list on the
  same page, the detail and child pages, the actions behind each, imports and exports, the
  scheduled handlers — and read each one: it calls the same named check, or it is open on
  purpose (a public list beside a private detail page) and your reply says so. A rule that
  holds on the page you built and not on the list beside it holds for nobody; the scans flag
  it later, and the app builder meets it as a security finding instead of a finished change.
- A gate protects only what the loader returns after the check. The page's code and
  `strings.json` are public files; copy only gated visitors may read lives in the database or
  the `private` strings section (see "Copy behind a gate").
- If the entire app requires login (no public pages), redirect `/` to `/app` in `home.tsx`.
- If the app has no signed-in area at all, delete `app/routes/app.tsx` and drop its `route("app", …)`
  entry from `routes.ts` (keep `stencilAuthRoutes`): the stub only type-checks while it is routed.
- `home.tsx` and `app.tsx` ship as placeholders. Read them, then overwrite them completely —
  never leave the default "Welcome, [name]" screen reachable. A dangling stub is a broken app,
  and it is the first thing the app builder sees.
- Write route files with `$` segments (`content.$id.tsx`) using your file-writing tool, never a
  bash heredoc — the shell expands `$id` and you get `content..tsx`, whose name no longer matches
  its type import, so the error surfaces far from the cause. Generated type imports are always
  `./+types/<filename>`, with no extra path segments.
- If the app has both public and authenticated sections, `/` is the public landing page and `/app` is the authenticated entry point.
- "The app on my home screen opens on the public page", "it signs me out every time I open it from
  my phone" or "add a stay signed in option" for the installed app is not a sign-in bug and never a
  redirect from `/`: the installed app opens on its Start page, which is `/` until set. Call
  `enablePwa` with `startPath` set to the signed-in entry point (usually `/app`), edit no route, and tell
  the app builder that app users who already installed it must remove it from the home screen and
  add it again, because a phone reads the start address once, at install.

**Optional auth on public pages:**

```tsx
import { getSession } from "~stencil/auth/server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await getSession(request, context.cloudflare.env);
  return { user: session?.user ?? null };
}
```

**Admin or owner gates.** The platform owns roles: the app builder sets a Role on each app user from their Stencil Users page (Admin, or any lowercase name such as `staff`), and `~stencil/auth/roles` reads it. Gate every admin-only loader and action with `requireRole(request, env, "admin")`, and any other kind of person (staff, client, affiliate) with `requireRole` on that name. To ask without refusing, `getRole(env, userId)` and `hasRole(env, userId, "admin")` take the env first and never the request. Never add your own role column or account type, and never derive a role from an email, a domain, a deployment secret, or signing up first. The App preview is signed in as the preview user, and the end-of-build screenshot as the verify user; `requireRole`, `getRole` and `hasRole` all treat both as admin there (or as the role the check named with `--as-role`) and never on the published app (they have no session there), so a landing redirect or nav built on them already opens the admin side in the preview. Never seed the preview user into role data: both deploys share one database. When the app lets one app user change another's access, the action refuses the caller's own row and the owner's, and grants at most what the caller holds; access is never read from a field app users edit on their own profile (the `app-roles` skill, section 1b). An admin area itself has one fixed shape — an Admin nav entry at `/app/admin`, a list per managed table, a detail page per record with every field editable, relations as links both ways — in the `admin-area` skill; load it before writing any admin screen.

> **Load the `approval-queue` skill before adding a status column, a review page or a content filter to what app users submit or earn** — "approve before it shows", "hold for review", "moderation queue", "flag for admin review", a rank awarded only after a check. It fixes the one shape: the status column and its access rule, the one review route at `/app/admin/review` with Approve and Reject, the count in the nav, and the notice to the author.

```ts
import { requireRole } from "~stencil/auth/roles";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireRole(request, context.cloudflare.env, "admin");
  // ...
}
```

**First-login setup for app users.** "New app users set up their account first", an onboarding wizard, a welcome checklist: the platform owns the state and the gate, the app owns the step screens. Declare the steps as data in `app/setup.ts` (a `SetupFlow` from `~stencil/auth/setup`: the setup path, the moment setup went in as `since` (an ISO date-time), the steps), call `requireSetup(request, env, setup)` in the loader of the layout every signed-in screen renders under, and from each step's action save the step's fields to the app's own tables, then `markSetupStep`; the final step's action calls `completeSetup` and redirects to `/app`. Accounts created before `since` count as set up, so existing app users are never sent through it and nothing is backfilled. Never add a completion column or flag to the app's tables, never check per route, never ask an app user to pick their own role in a step (roles come from the Users page), and never write to `app_setup`, a platform-owned table. The preview account is reset from `/auth/setup/reset` in the App preview, never by editing rows. Load the `app-user-setup` skill before building any of it.

**Sign out from client code** (event handlers; for UI, prefer `<SignOutButton>`):

```tsx
import { signOut } from "~stencil/auth/browser.client";
await signOut();
```

## Codes, passwords and tokens

A page or record behind a short code or password, with no account — a gallery code, a classroom PIN, a password on a shared page, a code emailed to a client before they open their portal — uses `~stencil/access-codes` (server-side only): `setAccessCode` stores a code the app builder or an app user chose, `mintAccessCode` makes a fresh unguessable one, `verifyAccessCode` checks a typed code with guesses counted and slowed, and `getAccessPass` reads the pass a correct guess earns. Never invent a gate: a code the app stores as typed is readable from the database, a code made with `Math.random()` is guessable, a check nobody counts is sweepable, and a cookie the app writes itself is forgeable. See the `access-codes` skill.

A PIN or code the app checks itself — a vault or parental PIN a signed-in app user types, a code emailed to confirm a second address — needs a wrong-guess limit, and being signed in does not make a guess safe. Never write that limit: a counter the app reads, checks and then writes lets every guess sent at once through, and a count kept in the app's own rows comes back with a new code, a re-added row or a closed account. Call `limitGuess(env, { key, max, windowSeconds })` from `~stencil/access-codes` before the compare, with a `key` that names the thing being guessed (the record, the address the code went to), never the guesser's row or account, and `forgiveGuess(env, key)` after a right entry. A build that touches a hand-built lockout, or fixes a scan finding about one, moves it onto `limitGuess`. Load the `access-codes` skill before writing any PIN, passcode or code-confirmation check.

Three rules hold for any code or token the app mints itself, wherever it goes: make it with `crypto.getRandomValues` or `crypto.randomUUID()`, never `Math.random()`; make it long enough that guessing is hopeless (12 characters or more for anything that stands alone in a link); and never send a code that proves an inbox to an address the visitor typed into the request — send it only to the address already stored on the record it unlocks. Signing an app user in by email code or magic link is a login setting, not app code (see the `custom-auth` skill).

## Public forms and spam

Anything a signed-out visitor can post or trigger — a contact, inquiry, quote, booking, application, vote or feedback form, a public AI feature, a public route that emails or saves a row — is posted to by bots and by scripts, so it ships protected, without being asked. Never write the protection: a hidden field alone stops almost nothing, a check the browser can answer for itself is forgeable, a counter in a variable is forgotten by every other copy of the app, and a counter read and then written lets every request sent at once through. Put `<FormGuard form="contact" />` from `~stencil/ui/form-guard/fields` inside the form (it needs `stencilFormGuardRoutes` in `app/routes.ts`) and call `guardForm(env, request, formData, { name: "contact" })` from `~stencil/form-guard` first in the action: it runs an invisible bot check, then caps how often one visitor may post (5 per 10 minutes; a route that sends an email or a text, runs paid AI or claims a seat, slot or name passes `kind: "mail"`, `"paid"` or `"spot"` and gets the platform's stricter cap; `max` and `windowSeconds` only when the app builder asks for another number) and how much (1 MB a post, 4 MB a window; a form that takes files sets `maxBodyBytes` and `maxFileBytes`). A public route that is not a form calls `limitVisitor(env, request, { name, kind })` first, whatever its method, and it holds the same size caps. On a refusal nothing is stored, sent or run. A build that touches a hand-built honeypot, maths question or submission counter, or fixes a scan finding about a public route with no limit, moves it onto these. An email sign-up box is already covered by `<WaitlistForm>` / `joinWaitlist`, and wrong guesses at a PIN or code by `limitGuess`. Load the `form-protection` skill before writing or changing any form or route a signed-out visitor can reach.

## Prerendering

`prerender.ts` lists paths to render to static HTML at build time:

```ts
const prerender: string[] = ["/", "/about", "/pricing"];
export default prerender;
```

Prerendering is gated and runs on **production publishes only**, and only for apps on the platform's rollout allowlist. On a draft build, or for an app not on the allowlist, listing a path here does nothing — the route just SSRs as usual.

Only list **pure content** pages. A prerendered route must **not** have a `loader` that reads app data or a platform binding (DB, STORAGE, AUTH, payments…): none of those exist during the build, and the route fails prerendering with a 500. Editable `<Text>` copy **is** fine — it is baked from the published strings at build time, so a prerendered page shows real copy, not blanks. The root loader in `app/root.tsx` runs for every prerendered path too, so if anything is prerendered it must not read `context.cloudflare.env` (or any binding) unguarded.

## Design

Design rules: @.claude/design-rules.md — read this file before any UI work. It is part of this guide and outranks the reference skills it names.

## Scaffolds

A scaffold is an example file in Stencil's library. `scaffolds_list(folder?)` lists the names, all of them or those under one folder such as `backgrounds/`; `scaffolds_read(name)` returns its text. Adapt what you take from a scaffold to the brief, the palette and the copy.

**Device frames** — wrap content in a realistic hardware shell for landing pages and mockups:
- `device-frames/iphone-16-pro.tsx` — iPhone 16 Pro with dynamic island
- `device-frames/macbook-pro-16-2024.tsx` — MacBook Pro 16" (2024) with notch
- `device-frames/vision-pro.tsx` — Apple Vision Pro spatial canvas
- `device-frames/foldable.tsx` — Galaxy Fold with open/closed panels

**Browser chrome** — show a webpage inside a realistic browser window:
- `browser/chrome.tsx` — Chrome with tabs and URL bar
- `browser/safari.tsx` — Safari with centered title bar
- `browser/arc.tsx` — Arc with sidebar tabs

**UI primitives** — start from these rather than rebuilding from scratch:
- `ui-primitives/cmdk-palette.tsx` — command palette with fuzzy filter
- `ui-primitives/kanban-board.tsx` — three-column Kanban demo; it moves cards in memory only. Any list or board whose order must be saved uses `<SortableList>` / `<SortableGroups>` from `~stencil/ui/sortable/list` (load the `drag-to-reorder` skill)
- `ui-primitives/drawer.tsx` — bottom-sheet drawer with backdrop
- `ui-primitives/toast.tsx` — toast stack (success / info / error)
- `ui-primitives/stepper.tsx` — multi-step progress indicator
- `ui-primitives/file-tree.tsx` — collapsible file tree
- `ui-primitives/skeleton-set.tsx` — five skeleton variants (text, avatar, card, list, image)
- `ui-primitives/empty-states.tsx` — five empty-state variants

**CSS backgrounds** — add the class to any wrapper element, then import the CSS file:
- `backgrounds/aurora-mesh.css` → `.aurora-mesh` — multi-layer radial gradient mesh
- `backgrounds/noise-grain.css` → `.noise-grain` — SVG grain overlay (use on a colored surface)
- `backgrounds/dot-grid.css` → `.dot-grid` — 1px dot pattern (light/dark/dense variants)
- `backgrounds/animated-gradient.css` → `.animated-gradient` — looping animated gradient
- `backgrounds/glassmorphism.css` → `.glass-surface` — frosted glass with backdrop-filter
- `backgrounds/bento-grid.css` → `.bento-grid` — CSS grid bento layout helpers
- `surfaces/neubrutalism.css` → `.neubrutalism-card`, `.neubrutalism-btn` — thick borders, chunky shadows

**Dev mockups** — for showing code or terminal output in a UI:
- `dev-mockups/vscode.tsx` — VS Code layout with file tree and editor surface

**Landing** — starting point for hero sections:
- `landing/hero.tsx` — centered hero with eyebrow, headline, subtext, dual CTAs

> **Load the `payments` skill before touching anything about money** — subscriptions, plans, pricing or upgrade pages, paywalls, Stripe, checkout, sellers, buyers, payouts, refunds. Read it before you open the payments code, not after. On an app's **first** payments or selling request, those skills have you offer a short walkthrough before building — make that offer before writing any code.

**Subscriptions** — the page app users subscribe on. Pick by how many plans the app has (count `~/generated/tiers`):
- `subscriptions/upgrade.tsx` — single plan: centered card with price, benefits, and a subscribe button.
- `subscriptions/pricing.tsx` — two or more plans: plan columns in order, a highlighted recommended plan, and a subscribe form per plan. A plan may be **monthly-only, yearly-only, or both** — in `~/generated/tiers` a plan's `priceCents` (monthly) and `yearlyPriceCents` are each `number | null`. Never divide a null `priceCents` (`plan.priceCents / 100` renders `$NaN`): price a yearly-only plan from `yearlyPriceCents` and pass `interval: 'year'` at checkout. The monthly/annual toggle and savings badge apply only to a plan that carries both prices; they show only when the builder has enabled annual billing. Gate routes with `requireSubscription(tiers.pro.id)` — an app user on that plan or any higher one qualifies.

**Selling** — let the app's users charge THEIR customers (one-time and recurring products from one catalog in the app's own database, via the `~stencil/payments/selling` SDK; load the `selling` skill first). A one-time buyer needs no app account — guest checkout is the default (subscribing needs a sign-in): the buy page collects the buyer's email, which is their whole identity (Stencil stores no token or link for them; how they get back to the purchase is the app's design — e.g. a link the app emails via `~stencil/email`):
- `selling/seller-setup.tsx` — seller onboarding gate + status card + "open dashboard" link + a link to the products page
- `selling/seller-products.tsx` — the seller's catalog page: create, edit and archive one-time and recurring products (`createProduct` / `updateProduct` / `archiveProduct`)
- `selling/buy.tsx` — public buy page (works logged out; a guest's email is required) → `buyProduct` action that re-reads the product's stored price and seller by `productId` (never from the form), with an already-purchased short-circuit. An app that already has its own item tables keeps its `sellerCheckout` flow — never move it onto the catalog unless the app builder asks
- `selling/purchase-success.tsx` — post-checkout landing; verifies with `hasPurchased({ reference, buyerEmail })` and shows "confirming" while the payment webhook lags
- `selling/subscribe.tsx` — public storefront for one seller's products: one-time products link to the buy page; subscribing needs a signed-in buyer (`subscribeToProduct`), with a "Manage billing" link for a current subscriber
- `selling/subscriber-area.tsx` — subscriber-only page gated in the loader, "confirming" right after checkout, status and next date, and the `manageSellerSubscription` button

> The `~stencil/payments/*` modules are platform-managed — don't edit them and never hand-roll payments calls. To reach any platform service (payments, backend, …) a deployed app must use its service binding (`env.PAYMENTS`, `env.BACKEND_SERVICE`), which the SDK does for you — never a plain `fetch()` to a `hellostencil.com` host. Same-zone route fetches don't reach the worker; a plain-fetch fallback only works on the dev server.

**Recurring actions** — scheduled server-side work (load the `recurring-actions` skill first):
- `recurring/schedules.ts` — the manifest; the app's is `app/schedules.ts`
- `recurring/api.internal.scheduled.tsx` — the trusted route with idempotent handlers; the app's is `app/routes/api.internal.scheduled.tsx`, registered at `api/internal/scheduled`. Keep the bearer-secret auth block as-is; only edit the handlers.

Use a scaffold when you'd otherwise build a device frame, browser chrome, or complex primitive from scratch. Always adapt the colors and copy to match the brief.

## Editable Text (`<Text>`)

**MANDATORY: use `<Text>` for every user-visible string.** Never hardcode copy as JSX text nodes — the platform identifies and edits strings through this component.

`strings.json` also holds the app's **current live copy**, and it is saved back to the live store on deploy. So to fix or reword text that is already on the site, edit that key's value in place (keep the key) — that is exactly how live copy is corrected. Never tell the app builder their text is unreachable or not in the repo. If a phrase genuinely is not in the file, it is app-user content in the database, not copy.

Define all copy in `app/strings/strings.json` first, then reference keys in JSX:

```json
{
  "hero": { "title": "Your Amazing App", "subtitle": "Do more, faster." },
  "cart": { "message": "You have {{count}} items" }
}
```

```tsx
import { Text } from "~stencil/ui/strings";

<Text id="hero.title" as="h1" className="text-4xl" />
<Text id="hero.subtitle" as="p" />

// Dynamic values: use {{var}} in strings.json, pass via vars
<Text id="cart.message" vars={{ count }} />
```

- Keys are dot-delimited and describe location + role: `"hero.title"`, `"nav.cta"`, `"features.card1.description"`
- `<Text>` takes no children — all copy lives in `strings/strings.json`
- Text that goes into an attribute — an input's `placeholder`, an `aria-label`, a `title` — is `useString("…")` from `~stencil/ui/strings`, a hook called at the top of the component, with its key in `strings.json` like any other copy. Never a literal attribute and never a hidden `<Text>` standing in for one
- TypeScript will error on any key not present in `strings/strings.json`
- When you rename or remove a key in `strings.json`, grep `app/` for the old key and fix every `<Text id>` that references it before running the typecheck — a wholesale rewrite is a rename across every route that used the old keys
- Only exception: `meta()` returns plain objects, not JSX — page title/description strings there are hardcoded
- An app that speaks more than one language also has `app/strings/strings.<language>.json` (`strings.es.json`) for each extra language: the same keys as `strings.json`, holding that language's text. A key it lacks shows the `strings.json` text, so the file may cover only part of the app. Edit it when the app builder asks for a translation or for wording in that language, and never add a key `strings.json` does not have. Never create one of these files: the platform writes one per language the app speaks, and a file for any other language is never shown.
- `platform.updateNotice.message` and `platform.updateNotice.action` are read by the platform itself: the small bar app users see when a publish lands while they have the app open, and the error screen when a page from the old version fails. Edit their values to change that copy; the keys may also be left out, and the default copy shows. Never reference them with `<Text>`. `platform.languageSwitcher.label` is the same kind of key: the platform reads it as the language control's accessible name, so a translated copy of `strings.json` carries it in that language.

### Copy behind a gate: `strings.json` and page code are public

**`strings.json` is public.** The root loader sends the whole file, minus its `private` section, inside every page's HTML — the home page, the page-not-found screen, a page the visitor cannot open. A sign-in, password or subscription check in a route's loader protects that page's body and nothing in `strings.json`. **Page code is public too**: a route component and everything under `app/components/` compile into browser files anyone can download, whatever the loader returns, so a quote wall or a personal note written as JSX literals or a `const` in a `.tsx` file is readable without the gate.

Copy that only people who pass a gate may read goes in one of two places:

- **The database**, when it is content (posts, lessons, a recap's quotes): rows read in the loader after the check, through `data()` or `createDb`.
- **The `private` section of `strings.json`**, when it is a few editable phrases: `{ "private": { "recap": { "note": "…" } } }`. The root loader never ships `private`; the gated loader returns it itself, after its check, and `<Text id="private.recap.note" />` resolves on that page only:

```tsx
import { requireAuth } from "~stencil/auth/server";
import { privateStrings } from "~stencil/react-router/strings";

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAuth(request, context.cloudflare.env);
  return { strings: privateStrings(context, "recap") };
}
```

Labels of the gate itself (the password prompt, "Unlock", the wrong-password message) are public copy and stay outside `private`. Never put gated copy in a `*.server.ts` constant and import it from a component — that fails the build — and never pass it to the component any way other than loader data returned after the check.

### Dynamic `<Text>` keys

`id` is typed `StringKey` (the union of keys in `strings.json`, from `~stencil/types/strings`), so a runtime-computed key is `string` and errors with `TS2322`. Two fixes — don't cast site-by-site and typecheck between edits:

```tsx
import { Text } from "~stencil/ui/strings";
import type { StringKey } from "~stencil/types/strings";

// 1. Keep it typed — TS checks against strings.json:
const stepKeys: StringKey[] = ["onboard.step1", "onboard.step2"];
{stepKeys.map((id) => <Text key={id} id={id} />)}

// 2. Cast when you're sure the key exists:
<Text id={`pricing.${tier}.name` as StringKey} />
```

A cast silences the check — if the key is missing, `<Text>` renders empty and logs a console error. Fix all dynamic keys in one pass, then typecheck once.

## Rules

- Create routes in `app/routes/` and register them in `app/routes.ts`. Every literal `to`/`href` to a path of this app must be a registered route — the build fails on a link to a page that is not registered
- Use Tailwind CSS utility classes for all styling
- Use `cn()` from `~/lib/utils` to merge class names
- Use `import { Link } from "react-router"` for navigation
- Make everything responsive and mobile-first; use semantic HTML
- Pre-installed shadcn/ui components in `~/components/ui/`:
  accordion, alert, avatar, badge, button, card, checkbox, dialog, dropdown-menu, input, label, popover, progress, scroll-area, select, separator, sheet, skeleton, slider, switch, table, tabs, textarea, toggle, tooltip, aspect-ratio, navigation-menu
- For a shadcn component not listed above: `bun x shadcn@latest add <comp1> <comp2> --yes` — batch all into one command
- Never `fetch()` in `useEffect` — use `loader`
- Never `fetch()` this app's own address from server code. Read its own files from storage (`createStorage(env).get("assets/<name>")`, the `storage` skill); a storage read is direct, a self-fetch is a round trip out through the edge and back. Another Stencil app's API is an ordinary HTTPS API: call it with a plain `fetch()` of its address
- Never pass a web address the app did not write itself (typed or pasted by an app user, read from a fetched page or feed, an uploaded file, a webhook or a query string) to a bare `fetch()`. Fetch it with `safeFetch(url)` from `~stencil/safe-fetch` (public http(s) only, every redirect re-checked, size and time capped, returns bytes), and check it with `publicUrlProblem(url)` before handing it to any other service. A picture goes through `storeImageFromUrl`, a page's text through `createFetch(env).page`. Never hand-write a host or private-address check, and never match a host by substring
- A loader's return value is the wire format: a public, share-link or lower-role page returns the columns it shows, never a whole row, and grading keys, passwords, tokens and other people's contact details never leave the server (see "What a loader returns is what the reader receives")
- Pages that share a frame (sidebar, header) use one layout route that renders it once, with the pages as children via `<Outlet />`. Give that layout's loader `shouldRevalidate` so it does not re-run on plain navigation, and show that a navigation is pending (`useNavigation`). The argument type comes from the routing library, not from `./+types/*`: `import type { ShouldRevalidateFunctionArgs } from "react-router"; export function shouldRevalidate({ formMethod }: ShouldRevalidateFunctionArgs) { return formMethod !== undefined; }`
- Never loop database writes, storage copies or outbound calls over more than a few dozen items inside one request — slice it from the client (see "Bulk work — every request has a budget")
- Never store, compare or aggregate a submitted value an action has not parsed on the server — see "An action parses what the form sends before it writes"
- Never redirect to an address carried in the request without `safeReturnTo` from `~stencil/auth/server` — on any screen, signed-in or not (see "Redirecting to a caller-supplied destination")
- Never store or compare a value the server already holds or can derive (a stored email or price, a media length, an offered slot, the day, a usage counter's key) from form data, a JSON body, a query string, a hidden input or a cookie — re-read it on the server (see "A fact the server can look up is never taken from the request")
- Never log what an app user typed, a whole request or record, or any part of a credential, and never return an exception's or a provider's text to the browser — `failed` from `~stencil/errors` (see "Logs and error replies — what may leave the server")
- A control that changes what data is shown needs a data path — load the `control-driven-data` skill
- A public form that takes a typed email replies the same for every address and puts the real outcome in the email it sends (see "A public form that takes an email" under Authentication)
- Never put a value the app builder did not write (a visitor's or app user's name, message or company, a stored record's field, an inbound email's sender or subject) into an email's `html` without `escapeHtml` from `~stencil/email` — unescaped, it becomes a working link or button in mail the app signs. This holds for every email, including one added to an existing file and a shared wrapper's heading, intro and button text (see the `email` skill)
- Never add dark mode toggles — `dark:` variants work automatically via browser preference
- Never use `npx` or `bunx` (not installed — don't try to create a shim) — use `bun x`
- Never transliterate a pasted vendor head snippet (Meta Pixel, Kit, an Impact `<meta name="impact-site-verification" value="…">` tag) into JSX in `root.tsx` — JSX rejects attributes React does not declare (`value` on `<meta>` is the common one), the typecheck fails, and renaming the attribute breaks the vendor's check. Tell the app builder to paste the snippet as-is into **Settings → Grow → Tracking → Script tags**; it is placed verbatim in `<head>` of every page of the Published app (not the App preview)
- Never use `value=""` on `<SelectItem>` — Radix reserves empty string for "no selection / show placeholder" and throws at runtime. Use a descriptive value like `value="all"` and check `value === "all"` in the handler to mean "no filter"
