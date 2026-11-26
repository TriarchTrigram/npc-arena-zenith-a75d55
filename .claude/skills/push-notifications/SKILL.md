---
name: push-notifications
description: Web Push and home-screen install in a Stencil app — app-user opt-in, server-side sending, delivery control (ttl, urgency, tag), and the install prompt. Load for push notifications, reminders, alerts, "notify me", mobile/PWA notifications, "install the app", "add to home screen", an install banner or guide, or when a notification arrives late/never. The platform injects the service worker, manifest, VAPID key and install detection; never hand-roll them.
allowed-tools: previewUser enablePwa setMobileAppSettings
metadata:
  agents: [chat, builder]
---

# Push notifications

The platform provides the transport (service worker, manifest, VAPID key, the
`window.stencil.push` client API and the `window.stencil.install` client API). You
write only a client opt-in button, a server-side `send()`, and — if the app builder
wants one — the visual install prompt (see "Install prompt" below).

Push is fire-and-forget: it pokes a device and keeps no history. For anything an
app user should be able to open and read later — a bell, inbox, unread count —
use the notification store (`~stencil/notifications`, `in-app-notifications`
skill), usually alongside the push.

## Requirements

- **Mobile app must be enabled** by the app builder (More → Settings → Mobile app → Enable mobile app) —
  not something you toggle from code. If off, `subscribe()` returns
  `reason: "not-configured"`. Remind the app builder to enable it.
- Works on the **live published app only** (not the editor preview).
- **iOS**: the app user must Add to Home Screen first (else `reason: "needs-install"`).
- The install prompt needs Mobile app enabled too — without a manifest the browser
  never reports the app as installable and `install.status()` stays `"unsupported"`.

## Never hand-roll

`window.stencil.push`, `window.stencil.install` and `~stencil/push` are the only entry
points. Do NOT write a service worker or manifest, call `serviceWorker.register` /
`Notification.requestPermission` / `pushManager.subscribe`, read a VAPID key from
`window.__ENV__`, add a `urlBase64ToUint8Array`, make a `/api/push/*` route, listen
for `beforeinstallprompt`, sniff the user agent for iPhone, or read
`display-mode: standalone` yourself — `window.stencil.install.status()` already does.

## Client opt-in

`window.stencil.push` is injected (no import), typed in `app/env.d.ts`, browser-only,
and may be briefly absent until the injector loads — always optional-chain and drive
UI from `status()`. Call `subscribe()` from a user gesture.

```tsx
import { useEffect, useState } from "react";

export function NotificationsButton() {
  const [status, setStatus] = useState<StencilPushStatus | "loading">("loading");

  useEffect(() => {
    window.stencil?.push?.status().then(setStatus).catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    const res = await window.stencil?.push?.subscribe();
    if (res?.ok) setStatus("subscribed");
    // else handle res.reason: "needs-install" | "denied" | "not-configured" | "server"
  }

  if (status === "loading" || status === "unsupported") return null;
  return status === "subscribed"
    ? <button onClick={() => window.stencil?.push?.unsubscribe().then(() => setStatus("default"))}>Turn off notifications</button>
    : <button onClick={enable}>Turn on notifications</button>;
}
```

## Install prompt

An app builder who asks for "install the app", "add to home screen", an install
banner, guide or nudge wants a prompt for app users to put the Published app on
their phone. The platform owns the detection; you own only the design.

`window.stencil.install` is injected (no import), typed in `app/env.d.ts`,
browser-only, and absent in the editor preview — always optional-chain. On a share
link the handle exists but `status()` stays `"unsupported"` (no manifest there), so
the prompt shows only on the Published app. The
injector script is async, so the handle can appear after your component mounts;
it is guaranteed present once the window `load` event has fired.

Tell the app builder where the prompt will and won't appear, so nobody spends a build
hunting a "missing" banner: only on the Published app with Mobile app on, on iPhone and
iPad, and in Chrome on Android or a computer once the browser offers the install. Never
in the App preview, on a share link, in desktop Safari or Firefox, or once installed.
You cannot see it in the preview either — say so instead of claiming you checked it.

- `status()` is **synchronous** and returns `"installed"` (already on the home
  screen — show nothing), `"promptable"` (Android and desktop Chrome — one tap
  opens the browser's real install dialog), `"manual"` (iPhone and iPad — show the
  Add to Home Screen steps) or `"unsupported"` (show nothing).
- `"manual"` also appears inside in-app browsers (Instagram, Gmail, Facebook), which
  have no Add to Home Screen — do not promise the steps will work; suggest Safari.
- Chromium decides installability **after** the page loads, so a status read at
  mount is often `"unsupported"` and flips to `"promptable"` a moment later.
  Subscribe with `onChange()`; never read `status()` once and stop.
- `prompt()` must run from a click. It resolves `{ ok: true, outcome }` with
  `"accepted"` or `"dismissed"`; after a dismissal the browser offers a fresh
  prompt on the next page load.
- Remember a dismissal in `localStorage` **with an expiry** (a week is a good
  default). A session flag nags on every visit; a permanent flag never asks again.
- Do not write Android steps for iPhone or vice versa — the copy is chosen by
  `status`, not by the user agent.
- Use the iPhone steps below as written unless the app builder gives their own.
  Current Safari keeps Share inside the ••• menu beside the address bar; never
  write "the Share button at the bottom of the screen".

```tsx
import { useEffect, useState } from "react";

const DISMISS_KEY = "install-prompt-dismissed-until";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed() {
  return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
}

export function InstallPrompt() {
  const [status, setStatus] = useState<StencilInstallStatus>("unsupported");
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    function connect() {
      const install = window.stencil?.install;
      if (!install) return;
      setStatus(install.status());
      setHidden(isDismissed());
      unsubscribe = install.onChange(setStatus);
    }
    if (document.readyState === "complete") connect();
    else window.addEventListener("load", connect, { once: true });
    return () => {
      window.removeEventListener("load", connect);
      unsubscribe?.();
    };
  }, []);

  if (hidden || status === "installed" || status === "unsupported") return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS));
    setHidden(true);
  }

  async function install() {
    const res = await window.stencil?.install?.prompt();
    if (!res?.ok || res.outcome === "dismissed") dismiss();
  }

  return (
    <div role="dialog" aria-label="Install this app">
      {status === "promptable" ? (
        <>
          <p>Install this app for quick access from your home screen.</p>
          <button onClick={install}>Install</button>
        </>
      ) : (
        <ol>
          <li>Open this page in Safari.</li>
          <li>Tap the ••• button beside the address bar, then Share. If Share is already on the toolbar, tap it there.</li>
          <li>Scroll down and tap Add to Home Screen, then Add.</li>
        </ol>
      )}
      <button onClick={dismiss}>Not now</button>
    </div>
  );
}
```

Style it with the app's own design language (`components/design.tsx`, shadcn
`Sheet` or `Card`) — the markup above is the behaviour, not the look.

## Server send

From a loader, action, or recurring-action handler. Pick exactly one audience:
`toUserId`, `toUserIds`, or `broadcast: true`.

```ts
import { createPush } from "~stencil/push";

await createPush(context.cloudflare.env).send({
  toUserId: order.userId,
  title: "Order shipped 📦",
  body: `Order #${order.id} is on its way.`,
  url: `/orders/${order.id}`, // opened on click
  tag: "order-status",        // replaces the previous order update
  ttl: 86400,                 // still true tomorrow
});
```

A daily per-app quota applies — don't broadcast on every request. For reminders,
call `send()` from a recurring action.

## Delivery control — set these deliberately

The OS decides *when* to display a notification, but these fields decide what it's
allowed to do. Defaults are sensible; override them when the message has a shelf life.

| Field | Default | Use it when |
|---|---|---|
| `ttl` (seconds) | `3600` | **Time-bound message.** How long the push service holds it for an offline device. `ttl: 900` on "starts in 10 minutes" makes it expire instead of arriving an hour late. Long (`86400`) only for messages that stay true. |
| `urgency` | `"high"` | Drop to `"normal"`/`"low"` for digests. `high` is what lets a notification break through Android Doze, so keep it for anything the app user is waiting on. |
| `tag` | none | **Any recurring or status message.** Same tag replaces the previous notification instead of stacking — an hourly reminder stays one line in the shade. Use a stable per-purpose key: `"practice-reminder"`, `"order-status"`. |
| `renotify` | `false` | With `tag`, re-alert (sound/vibrate) on replacement instead of silently swapping. |
| `requireInteraction` | `false` | Desktop only — keep it up until the app user acts. |

**A late notification is worse than none.** For anything with a start time, pair a
short `ttl` with a `tag` so at most one current copy exists.

## Check the result — `delivered` does not mean "seen"

`send()` returns `{ id, status, recipients, delivered, failed, pruned }`.

- `status: "no_recipients"` — **the send did nothing**: the audience matched zero
  live subscriptions. This is the most common push bug, and it is not an error you
  can see without checking. Log it.
- `delivered` counts push-service ACKs, not displays. The platform tracks real
  clicks separately (the service worker reports them); don't try to build your own
  read receipts. If the app needs a real per-app-user read state, that is the
  notification store's job (`in-app-notifications` skill) — send a row there too.

```ts
const res = await createPush(env).send({ toUserIds: ids, title, body, tag: "reminder" });
if (res.status === "no_recipients") {
  console.warn(`reminder: nobody reachable (targeted ${ids.length} users)`);
}
```

## Audience pitfall — target ids that actually opted in

`toUserId`/`toUserIds` match the user id that was **signed in when the device
subscribed**. A send to any other id silently resolves to zero recipients.

When a recurring action derives its audience from data ownership, that set must be
real app users:

```ts
// RISKY: created_by may be the platform's preview user for everything seeded during
// the build — that id never has a subscription, so every run sends to nobody.
const owners = await db.selectDistinct({ userId: pieces.createdBy }).from(pieces);
```

Rules:

- A row you write on the app builder's behalf during a build belongs to the preview user
  until they sign up on their app (`insertRows` with `sample: false`, then `reownRows` to
  their account), and the preview id (from your instructions, or `previewUser`) never has a
  subscription — so an audience derived from ownership alone reaches nobody.
- Derive audiences from the **auth user table** where possible, and treat data
  ownership as a filter on top of it, so an app user with no rows yet is still reachable.
- Never assume an audience is non-empty. Check `status`.
