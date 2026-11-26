---
name: instant-actions
description: >
  Makes everyday actions in a built app feel instant. Load before writing any screen where an
  app user posts, replies, comments, sends a message, saves a note, hearts or toggles something,
  searches as they type, or moves between tabs — and when fixing a report like "the app feels
  slow", "my reply takes ages to show up", "the button stays greyed out", "search lags behind
  my typing", or "I tapped twice and it un-liked". Covers optimistic creates with a
  browser-made id, the "Didn't send" failure state, state-not-toggle writes, shell-link
  prefetch, a debounced search box, and follow-up work after the response with `waitUntil`.
metadata:
  agents: [builder]
---

# Instant actions

An app with twelve posts can still feel slow. The default shape — submit, await the
insert, await the reload, then show the row — makes an app user watch a dimmed field
for the sum of two round trips on every reply, and shows them nothing at all when
the save fails. Five rules below; each has the code to copy.

## 1. Text an app user just wrote shows at once

Replies, comments, posts, messages, notes. The browser makes the row's id, sends it
with the form, and renders the item straight away from what it typed; the server
inserts with that id, so the reload brings back the same row under the same key
and nothing jumps. The write is still awaited on the server — this is optimistic
on screen, never fire-and-forget.

```tsx
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { createDb } from "~stencil/db";
import { replies } from "~/generated/db-schema";
import { requireAuth } from "~stencil/auth/server";

export async function action({ request, params, context }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const form = await request.formData();
  const id = String(form.get("id"));
  const body = String(form.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false as const, error: "Bad request." };
  if (!body) return { ok: false as const, error: "Write something first." };
  try {
    const db = createDb(context.cloudflare.env);
    const now = new Date().toISOString();
    await db
      .insert(replies)
      .values({ id, postId: params.id, body, createdBy: user.id, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: replies.id }); // a retry with the same id is a success, never a duplicate
    return { ok: true as const };
  } catch (err) {
    console.error(`[replies] insert failed for post ${params.id}:`, err);
    return { ok: false as const, error: "Didn't send." };
  }
}

type Draft = { id: string; body: string };

export default function Post({ loaderData }: Route.ComponentProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [text, setText] = useState("");
  const loaded = new Set(loaderData.replies.map((r) => r.id));
  const pending = drafts.filter((d) => !loaded.has(d.id)); // once the reload has the row, the draft is done

  return (
    <>
      {loaderData.replies.map((r) => <ReplyRow key={r.id} reply={r} />)}
      {pending.map((d) => (
        <LocalReply
          key={d.id}
          draft={d}
          onEdit={() => {
            setText(d.body);
            setDrafts((ds) => ds.filter((x) => x.id !== d.id));
          }}
        />
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setDrafts((ds) => [...ds, { id: crypto.randomUUID(), body }]);
          setText(""); // the field clears now, not after the round trip
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Reply</button>
      </form>
    </>
  );
}

// One keyed fetcher per sent item, so several can be in flight at once.
function LocalReply({ draft, onEdit }: { draft: Draft; onEdit: () => void }) {
  const fetcher = useFetcher<typeof action>({ key: `reply:${draft.id}` });
  const send = () => fetcher.submit({ id: draft.id, body: draft.body }, { method: "post" });
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data === undefined) send();
  }, []);
  const failed = fetcher.state === "idle" && fetcher.data?.ok === false;
  return (
    <div className={failed ? "" : "opacity-60"}>
      <p>{draft.body}</p>
      {failed && (
        <p role="alert" className="text-sm text-red-600">
          Didn't send. <button type="button" onClick={send}>Retry</button>{" "}
          <button type="button" onClick={onEdit}>Edit</button>
        </p>
      )}
    </div>
  );
}
```

- The submit button is never disabled by a send in flight, and the field never dims.
- The id is made in the submit handler, never in a `useState` initialiser or at module
  level: the server render must not produce one (the `hydration-safe-rendering` skill).
- The action checks the id's shape and the text, and returns `{ ok: false, error }` for both;
  a thrown error would blank the page (rule 2).
- Dev mode may run the mount effect twice; the repeated id lands once, which is the point.
- An app on the data SDK keeps this one insert on `createDb`: the SDK's `create` never takes
  an `id`, and the id is the whole point. The action then scopes the row itself
  (`requireAuth`, `createdBy: user.id`), as the template's Drizzle example does.

## 2. A failed send is never silent and never loses text

- The item stays where it was, marked **Didn't send**, with **Retry** (resubmits the same
  id and text) and **Edit** (puts the text back in the field and drops the item), as above.
- A failed toggle goes back to what the server last said and shows a short message (rule 4).
- Every action returns `{ ok: false, error }` on failure — a refused value, a caught
  database error — never a thrown error, which replaces the whole screen with an error
  boundary and the text the app user typed with it. `requireAuth` and `requireRole` keep
  throwing their redirects; everything after them is a returned result.

## 3. What stays server-confirmed

Money, access, invites, removing people, deletes, publishing and account changes show
the pending state the `form-layout` skill describes and update only on the action's
answer: an app user must never see "paid", "removed" or "published" for something that
did not happen. A photo post shows the local preview with upload progress and is not
shown as posted until the upload has landed (the `storage` skill).

## 4. Toggles send the state wanted, not "toggle"

A heart, a follow, a done checkbox, a pin: the form carries the state the app user
asked for (`hearted=true`), so a retried or doubled request lands the same state
instead of flipping it back. The screen reads the pending state from the fetcher's
`formData`; when the action fails that `formData` is gone, so the control falls back
to the loaded value by itself.

```tsx
const fetcher = useFetcher<typeof action>({ key: `heart:${post.id}` });
const hearted = fetcher.formData ? fetcher.formData.get("hearted") === "true" : post.hearted;
<fetcher.Form method="post">
  <input type="hidden" name="intent" value="heart" />
  <input type="hidden" name="postId" value={post.id} />
  <input type="hidden" name="hearted" value={hearted ? "false" : "true"} />
  <button type="submit" aria-pressed={hearted}>{hearted ? "♥ Hearted" : "♡ Heart"}</button>
  {fetcher.data?.ok === false && <span role="alert" className="text-sm text-red-600">{fetcher.data.error}</span>}
</fetcher.Form>
```

```ts
// in the action, after requireAuth
if (form.get("hearted") === "true") {
  await db.insert(hearts).values({ id: `${postId}:${user.id}`, postId, userId: user.id, createdAt: now })
    .onConflictDoNothing({ target: hearts.id });
} else {
  await db.delete(hearts).where(eq(hearts.id, `${postId}:${user.id}`));
}
```

## 5. Navigation and search

**Every link in a shell carries `prefetch="intent"`** — sidebar, tab bar, bottom nav,
the account menu — so the next page's code and data start loading on hover or touch
start, before the click. Never on sign out: that is `<SignOutButton>`, a POST, never a link.

```tsx
<Link to="/app/feed" prefetch="intent">Feed</Link>
```

**A search box updates the URL about 300 ms after typing stops**, with `replace: true`,
so the loader runs once per pause and the back button does not walk through every
character. The loader reads `q` from the URL as the `record-search` skill shows.

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const [q, setQ] = useState(searchParams.get("q") ?? "");
useEffect(() => {
  if (q === (searchParams.get("q") ?? "")) return;
  const t = setTimeout(
    () => setSearchParams(q ? { q } : {}, { replace: true, preventScrollReset: true }),
    300,
  );
  return () => clearTimeout(t);
}, [q]);
<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
```

**Work the response does not need runs after it.** Mention notifications, emails,
analytics, a digest row: once the write has been awaited, hand the follow-up to
`context.cloudflare.ctx.waitUntil` and return. It still runs to completion; the app
user just does not wait for it. Never put the write itself in `waitUntil`, and never
start the follow-up before the write has landed.

```ts
await db.insert(replies).values({ id, postId, body, createdBy: user.id, createdAt: now, updatedAt: now })
  .onConflictDoNothing({ target: replies.id });
context.cloudflare.ctx.waitUntil(
  notifyMentions(context.cloudflare.env, { replyId: id, postId, body, fromUserId: user.id })
    .catch((err) => console.error(`[replies] mention notifications failed for reply ${id}:`, err)),
);
return { ok: true as const };
```

`notifyMentions` is the app's own server function: it finds the mentioned app users and
calls `createNotifications(env).send(...)` (the `in-app-notifications` skill). The
`.catch` is required — a rejection inside `waitUntil` with no handler is lost silently.

## 6. Resolve the signed-in app user once per fetch

Within one worker fetch, `requireAuth` reads the session once and every caller shares
it: the action and the usage tag on a post, every loader and the usage tag on a
navigation, and on a document post (a form submitted before hydration, JS off, or a
native `<form>`) the action and the loaders that follow it. A client-side `<Form>` or
`useFetcher` post's revalidation loaders are a separate fetch and read again. An app
helper that builds on it (the app user plus their workspace, role or profile) keeps that
property only when it memoises the same way: `memoPerRequest` from
`~stencil/request-context`. The key is a module-level `Symbol`.

```ts
import { memoPerRequest, forgetPerRequest } from "~stencil/request-context";
import { requireAuth } from "~stencil/auth/server";

const VIEWER = Symbol("viewer");

export function getViewer(request: Request, env: Env) {
  return memoPerRequest(VIEWER, async () => {
    const { user } = await requireAuth(request, env);
    const profile = await loadProfile(env, user.id); // your own query
    return { user, profile };
  });
}
```

- **Never key a cache on the Request object** (`new WeakMap<Request, …>`). React Router
  hands the handlers inside one fetch rebuilt Requests, so such a cache misses and the
  lookup runs again in each loader.
- **Do not skip the memo on POST.** The layer's session read is shared with the usage
  tag under its own key either way; what the memo saves is the helper's own queries (the
  profile read), which on a document post the action and the loaders that follow it
  share in the same fetch. Call `forgetPerRequest(VIEWER)` in the action only when it
  changed what the memo holds (the profile was edited), so those loaders, and anything
  else the action does after the change, resolve fresh.
- **An action that updates the signed-in app user's own row and returns data calls
  `forgetSession()`** from `~stencil/auth/server`, so a loader in the same fetch reads
  the new row rather than the memoised one. Unless the update also rotated the session
  (Better Auth's two-factor verify does): then keep the memo, since the request's cookie
  names a deleted row and a re-read would sign the app user out, and forward the new
  cookie on the response. When your helper wraps `requireAuth`, call both:
  `forgetSession()` for the layer's row and `forgetPerRequest(VIEWER)` for yours; each
  key is dropped on its own.
- **An action that changes who is signed in ends in a redirect** (`signOut` throws one),
  so no loader in the same fetch can see the old session.
