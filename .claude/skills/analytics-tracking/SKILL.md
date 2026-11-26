---
name: analytics-tracking
description: Track custom analytics events in the app — measure app user actions like a button click, form submit, signup, or purchase, and declare the app's main actions so the app builder can see which features get used and which never do. Use when building or changing any screen with a meaningful action, or when the app builder wants to "track clicks on the Sign Up button", "measure contact form submits", "see which features people use", or otherwise record and later see a specific action in Insights. Wires up a single tracking call — no setup, keys, or SDK needed.
metadata:
  agents: [chat, builder]
---

You help app builders measure the actions that matter in their app by wiring up **custom analytics events**, and by declaring those events so Insights can show the ones nobody has used yet.

## The two calls

Every **published** Stencil app automatically loads a tiny analytics beacon that exposes a global:

```js
window.stencil.track(name, props)   // one action happened
window.stencil.declare(names)       // every action this app can report
```

- `name` — a short, human-readable event name (string, required). This is exactly what the app builder sees as a named metric in Insights.
- `props` — an optional plain object of extra context (e.g. `{ plan: "pro" }`). Keep it small; it's stored alongside the event.
- `names` — the full list of event names the app's `track` calls use. Insights lists every declared name, so a feature nobody uses shows as **Nobody yet** instead of being invisible.

There is **nothing to install, no API key, and no configuration** — traffic and pageviews are already captured automatically. When an app user is signed in, the beacon ties each event to them (as a keyed hash, never their email), which is what powers the per-app-user view in Insights. You never pass the app user yourself.

## Keep one list of events

Put every event name in one app-owned module and route all tracking through it, so the declared list and the fired names can't drift apart:

```ts
// app/lib/analytics.ts
export const EVENTS = {
  signUp: "Sign Up",
  contactSubmitted: "Contact Form Submitted",
  checkoutCompleted: "Checkout Completed",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export function track(name: EventName, props?: Record<string, unknown>) {
  window.stencil?.track?.(name, props);
}

/** Call once on the client when the app mounts (e.g. a useEffect in app/root.tsx). */
export function declareEvents() {
  window.stencil?.declare?.(Object.values(EVENTS));
}
```

```tsx
// app/root.tsx — inside the root component
useEffect(() => { declareEvents(); }, []);
```

The optional chaining matters — `window.stencil` only exists on the published app (see "Where events fire" below), and the app must never crash because the beacon isn't there.

### TypeScript

`window.stencil` is already typed by the platform in `app/.stencil/env.d.ts`, `track` and `declare` included, so the module above compiles as written. Never add your own `declare global` or `interface Window` block for `stencil` — a second declaration clashes with the platform's and fails the typecheck.

## Track the main actions by default

When you build or change a screen that has a meaningful action, wire a `track` call for it without being asked — app builders expect Insights to show which features get used. "Main" means the handful of things the app exists to do: signing up, completing a purchase or booking, submitting a form, creating or finishing the core record (a post, a lesson, a plan), and opening a major section the builder would ask about (the template library, the daily feature). Not every click: no tracking on navigation, filters, hovers, or scrolling.

Call it inside the handler where the action actually succeeds:

```tsx
async function handleSignUp() {
  // ...existing signup logic...
  track(EVENTS.signUp, { source: "hero" });
}
```

If the app builder says they don't want tracking, remove the calls and the `declare` and leave the module empty; don't argue the point.

## Naming conventions

- Use clear, title-case, action-oriented names: **"Sign Up"**, **"Contact Form Submitted"**, **"Add to Cart"**, **"Checkout Completed"**, **"Template Opened"**.
- Keep the name **stable** — it's the metric's identity. Renaming it later starts a new, separate metric.
- Use one name per distinct action; use `props` for variants (e.g. `track("Add to Cart", { product: "Tote" })`) rather than baking the variant into the name.

## Where events fire (set expectations)

- Events are only sent from the **published** app served on its real domain. They do **not** fire in the App preview (previews are intentionally excluded from analytics), so the app builder won't see a new event while testing in the preview — that's expected. Tell them to publish, then use the published app.
- Counts appear in the app's **More → Analytics** page: the **Custom events** card on the Traffic tab, and the **Features used** card and per-app-user list on the **App users** tab. Declared names appear on App users once someone has opened the published app after the change. Counts may take a short while to show up, and — like all the analytics — high-volume counts are privacy-first estimates.

## Rules

- Never send personal or sensitive data in `props` (no emails, passwords, tokens, full names). Keep props to non-identifying context.
- One `track` call per action occurrence; put it where the action actually succeeds (e.g. after a successful submit), not on render.
- Every name passed to `track` must be in `EVENTS` so it is declared too.
- Mention the tracking in your summary to the app builder when you add it unasked, in one line, so they know where to look.
