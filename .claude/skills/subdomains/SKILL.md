---
name: subdomains
description: >
  Use when each app user should have their own address under the app's domain —
  "their own URL", "a page at their own link", "storefront per user", "portal per
  client", "white-label", "sarah.mysite.com", per-seller or per-photographer sites,
  or any request to show one app user's content on a web address of their own.
  Covers who a request belongs to, claiming an address, scoping loaders to it,
  building links to it, and login across it. The platform resolves the address and
  owns the claim flow — never parse `Host` and never concatenate a tenant URL.
allowed-tools: getSubdomainSettings setSubdomainSettings
metadata:
  agents: [chat, builder]
---

# App-user subdomains

An app builder can switch on app-user subdomains for a domain in Stencil
(More → Settings → Domains → "Subdomains for your app users"). From then on every
`<word>.<domain>` is served by this app, and the platform tells the app which app
user the request is for.

**The switch is the app builder's, not yours.** Nothing in the app turns it on, and
an app built against this skill still works when it is off — there is just never a
tenant. If the app builder has not switched it on, build the feature anyway and tell
them where the switch is.

## The one hard rule

**Never read `Host` and never build a tenant address by hand.**

```ts
// Never. The hostname is caller-controlled and says nothing about whether the
// app builder switched subdomains on, or who holds the word.
const who = new URL(request.url).hostname.split(".")[0];
const link = `https://${user.subdomain}.${domain}/gallery`;
```

`~stencil/tenant` is the only source: `getTenant` / `requireTenant` to read who a
request belongs to, `tenantUrl` to build an address. They read headers the dispatcher
stamps and strips inbound copies of, so they are the platform's word rather than the
visitor's.

## The model

A tenant **is an app user who holds a subdomain**. There is no tenant table, no
tenant id, no separate signup.

```ts
type Tenant = { subdomain: string; domain: string; user: AuthUser };
```

- `getTenant(request, env)` → the tenant, or `null` on the domain itself, on the
  Stencil address, in local dev, and when nobody holds the word. One lookup per
  request however many loaders ask.
- `requireTenant(request, env)` → the tenant, or throws the platform's tenant-miss
  response. Use it in a loader that only makes sense on someone's own address: the
  dispatcher turns that response into whatever the app builder chose for unclaimed
  addresses (bounce to the main site, or the app's not-found page).
- `tenantUrl(request, tenant | "word", path)` → the address. Off a subdomain-serving
  domain it stays on the current origin, so one set of links works in preview, on the
  Stencil address and on the real domain.
- `tenantDomain(request)` → the domain subdomains are served under, or `null`. Use it
  to decide whether to offer the feature in the UI at all.

## Wiring (once per app)

1. Spread the route pack into `app/routes.ts` — relative path, like the auth pack:

   ```ts
   import { stencilTenantRoutes } from "./.stencil/react-router/tenant/routes";

   export default [index("routes/home.tsx"), ...stencilTenantRoutes] satisfies RouteConfig;
   ```

2. Resolve the tenant once in the root loader:

   ```ts
   import { withStrings } from "~stencil/react-router/strings";
   import { withTenant } from "~stencil/react-router/tenant/loader";

   export const loader = withStrings(withTenant<Route.LoaderArgs>());
   ```

3. Read it anywhere in the tree with `useTenant()` from `~stencil/react-router/root`.

## Recipes

### Let an app user claim their address

Drop `<SubdomainField />` on the profile or onboarding screen. It checks the word as
it is typed (shape, reserved, taken, recently released), shows the address it would
produce, and saves. Never rebuild that flow — the rules live in the platform.

```tsx
import { SubdomainField } from "~stencil/ui/tenant/subdomain-field";

<SubdomainField value={user.subdomain} onSaved={(word) => setAddress(word)} />
```

The app builder can also set someone's address from Stencil (More →
Users), so an app user with no field in front of them can still have one.

### A screen that serves one app user's content

```ts
import { requireTenant } from "~stencil/tenant";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const tenant = await requireTenant(request, env);
  const db = createDb(env);
  return { galleries: await db.select().from(galleries).where(eq(galleries.userId, tenant.user.id)) };
}
```

Filter in the query, by `tenant.user.id`. Fetching everything and filtering in the
component ships every app user's rows to every visitor — the data is in the payload
whatever the UI renders.

### One route tree, not two

`/` branches on whether there is a tenant: the app builder's own landing page on the
domain, the app user's own space on their address.

```tsx
const tenant = useTenant();
return tenant ? <SellerHome seller={tenant.user} /> : <MarketingHome />;
```

Do not build a parallel set of routes for subdomains.

### Links and emails

Every link to an app user's space — share buttons, "view as your clients see it",
links inside emails — comes from `tenantUrl`:

```ts
const share = tenantUrl(request, tenant, `/gallery/${gallery.id}`);
```

Email itself is unchanged: the sender and the From name stay the app's. Only the
links inside change.

## Install branding per app user

A phone that saves an app user's address to its home screen can show that app user's
own name, icon, colour and start page instead of the app's. The app stores them with
`setTenantBranding`; Stencil reads them back on that subdomain and falls back to the
app's own values for any field left out, and everywhere else.

1. The icon is an upload: the existing upload field and file route (the `storage`
   skill), a square picture, kept as its key or `/api/files/<key>` address. The file
   route must serve it to a visitor with no session, or the phone gets no icon.
2. The app's own settings route saves it, behind the app's own authorization (the app
   user editing their own space, or an admin). The pack has no write endpoint.

   ```ts
   import { setTenantBranding } from "~stencil/tenant";

   const result = await setTenantBranding(env, user.id, {
     name: "Soft Business Club",       // 1 to 60 characters, required
     shortName: "SBC",                 // optional, up to 12, under the icon
     iconPath: "/api/files/icons/sbc.png",
     themeColor: "#aa3366",            // optional, #rrggbb
     startPath: "/home",               // optional, a path on their address
   });
   if (!result.ok) return { error: result.reason };
   ```

   `setTenantBranding(env, userId, null)` clears it. `getTenantBranding(request, env)`
   reads it for the current subdomain, to prefill the form.
3. Tell the app builder what phones show: the icon on every phone at once; the name,
   colour and start page once the app is installable (More → Settings → Mobile app).
   Someone who already saved the address removes it and adds it again to see a change.

Never write the `tenant_branding` table directly, and never build a per-subdomain
manifest, icon route or service worker in the app: the platform serves those.

## Login

One login covers the domain and every address under it — the session cookie is
scoped to the domain when subdomains are on. So sign-in belongs on the main domain;
an app user who logs in there is already logged in on their own address. Do not add a
login page per subdomain, and do not copy sessions across addresses.

## What not to touch

- **The app builder's own admin screens stay on the main domain.** A tenant address
  shows one app user's space, not the app's management UI.
- **Never write the `subdomain` column or the `released_subdomain` table directly** —
  `setSubdomain` owns them, including the 30-day hold on a word someone gave up.
- **Do not invent a subdomain for anyone.** A word is only ever chosen by the app user
  or by the app builder; suggesting one in the field is fine, saving it for them is not.
- **Do not gate on eligibility you cannot see.** Whether a given app user qualifies is
  the app's own rule (a plan, a role, a flag on their row) — decide it in the app and
  render the field accordingly.

## Before you finish

Check all three on the published app, not the preview:

1. An app user's own address serves their content.
2. Another app user's address serves *theirs* — not the first one's, and not everyone's.
3. A made-up address (`nobody.<domain>`) lands where the app builder chose, and never
   on someone else's data.

## The switch, from chat

Whether app users may hold a subdomain at all is a setting on the domain, read with `getSubdomainSettings` and changed with `setSubdomainSettings`: on or off, who is eligible, who picks the word, what an unknown subdomain does, and the words to block. A connected domain needs DNS records at its domain seller once switched on; the result lists them. The app's own pages for subdomains are the build this skill describes; the switch is not.
