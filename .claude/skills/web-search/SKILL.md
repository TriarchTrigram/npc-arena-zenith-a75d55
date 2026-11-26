---
name: web-search
description: Reaching the open web from a built app — searching, and fetching a page's contents — for features that enrich or verify against live sources. No API keys. Load before building anything that reads the web at runtime. Not for an app agent that should open or act on a site itself (click, fill a form, read a grid JavaScript loads) — that is the app-agents skill's browser field, so load app-agents instead.
metadata:
  agents: [chat, builder]
---

# Web search and fetch

Two server-side capabilities for reaching the open web. No API keys needed — both are proxied through the platform, same as `createAI`. **Server-side only** (loaders / actions / scheduled handlers), never from the browser.

**An app agent that must open or act on a site itself — click, fill a form, read a grid JavaScript loads — is not this skill.** `createFetch` is a reader with no browser. That ask is the `app-agents` skill's `browser: { hosts }` field; load `app-agents`.

**Pick by whether you have a URL:**
- **No URL, need to *find* pages → `createSearch` (`~stencil/search`, Exa).** Discovery/research: "find podcasts booking speakers", "conferences with open calls". Set `includeSummary`/`includeText` to get the page content back inline, so you usually don't need a second fetch.
- **Have a URL, need its *content* → `createFetch` (`~stencil/fetch`, Firecrawl).** Read/monitor a specific page you already know the address of.
- **Searching the app's own records → not this skill.** `createSearch` searches the public internet, never the app's database. For a search box over contacts, posts or any entity, load the `record-search` skill (`searchRecords` / `nearestRecords` from `~stencil/records`).

```ts
import { createSearch } from "~stencil/search";
import { createFetch } from "~stencil/fetch";

// Discovery (no URL yet):
const results = await createSearch(env).search("female keynote speakers CFP 2026", {
  numResults: 20,
  includeSummary: true, // page content inline → rank/filter without fetching
});

// Read a known page:
const { markdown } = await createFetch(env).page("https://example.com/call-for-speakers");

// Link card for a saved URL (bookmark, resource):
const { title, description, image, siteName } = await createFetch(env).page(savedLink.url);
```

**Link previews come from the same fetch — never hand-build one.** `page()` returns `title`, `description`, `image` and `siteName` alongside the markdown, read from the page's own Open Graph tags, each `null` when the page lacks it. For any feature that shows a card, thumbnail or title for a URL an app user saved or pasted, call `page()` and render those fields. Do not write a title fetcher, an HTML or regex scraper, a thumbnail URL guesser, or a video-host API call: YouTube and Vimeo watch pages expose their title and thumbnail through Open Graph, so video cards work through this same call. A pasted video link that should *play* in the page is not a card: render `<VideoEmbed url={link}>` from `~stencil/ui/video/embed` (YouTube, Vimeo, Loom, Descript, Google Drive), which needs no fetch at all. `image` is the remote address unless you ask `page()` to copy it in: for a card other app users or the public will see — an imported recipe, a saved article, a shared product — call `page(url, { storeImage: { storage, key } })` with `createStorage(env)` and a key such as `links/${id}`, and `image` comes back as `/api/files/<key>` (null when the page has no picture or the copy was refused), so viewers never call the linked site\x27s server; the app needs its `api/files/*` route for that (the `storage` skill). Only for a card the app user who pasted the link sees alone may `image` stay the remote address, rendered with an `onError` fallback. When the fetch falls back to the backup reader the four fields are `null` and the card should degrade to text.

**Social platforms usually cannot be read.** Instagram, TikTok, Facebook and X turn automated readers away, and a login wall carries no preview image. For a link to one of them, do not depend on `page()`: show the post with the platform's own embed snippet when the app builder wants the post itself shown, or let the app user upload or paste the picture, and show the card as text when neither exists. When `page()` is called anyway it can throw a `FetchError`, whose `code` is `"site-unreadable"` when the site refused, `"not-a-page"` when the address serves a file such as a video or a large download rather than a page, `"reader-unavailable"` when Stencil's own page reader is down (a platform-side problem no app change can fix: say the page could not be read right now, never that the site is blocked), `"reader-busy"` when Stencil's page reader is over its limit for the moment (also platform-side, and the same read may work minutes later), or a plain one for any other failure. Treat any `FetchError` on a link card as "no preview": do not retry, shrink or reshape the request, and never scrape the page yourself. Only for `"site-unreadable"` tell the app builder plainly that the platform cannot read that site; for `"reader-busy"` and `"reader-unavailable"` say the page could not be read right now, and never present either as an error in the app to fix.

```ts
import { createFetch, FetchError } from "~stencil/fetch";

try {
  const { image } = await createFetch(env).page(savedLink.url);
} catch (err) {
  if (err instanceof FetchError) {
    // no preview: leave the image empty and let the app user add one; do not retry
  } else throw err;
}
```

**A raw file, feed or JSON at an address the app did not write goes through `safeFetch`, never a bare `fetch()`.** `page()` returns a page's text; for the bytes themselves (an RSS or podcast feed, a calendar file, a CSV, a document to import), or any address an app user typed, a fetched page named or a webhook carried, call `safeFetch(url, { maxBytes, timeoutMs })` from `~stencil/safe-fetch`. It fetches public http(s) addresses only, re-checks every redirect and caps size and time; on `ok` read `bytes` (`new TextDecoder().decode(bytes)` for text), otherwise show `reason`. Every further address found inside what it returned (a feed's transcript links, a sitemap's entries) goes through `safeFetch` again. When the app hands such an address to another service instead of fetching it, refuse it first if `publicUrlProblem(url)` returns a reason. The route that triggers either one calls `requireAuth`.

**Never implement search as a model call.** `createAI`/`generateObject` over the model's own memory is not search: it returns stale, invented results with total confidence. If a feature asks to find, search, discover, or show latest/current/live anything — prices, events, products, listings, opportunities — it MUST go through `createSearch` or `createFetch`.

**When `createSearch` throws, read the message before changing anything.** A `502` from the helper means the search provider answered with an error, and the message carries its reason: a rejected key, exhausted quota, or rate limit is a platform-side problem that no change to the app can fix, so do not shrink the query, lower `numResults`, or add retries. Only a reason that names a request parameter calls for a code change. Surface the message in the app's error log and tell the app builder when it is platform-side.

Great fit for scheduled work (load the `recurring-actions` skill): a scheduled handler runs `createSearch` to gather fresh leads, uses `createAI` to score each against a user's descriptor, and upserts the good ones. Keep result counts modest — a scheduled run is one normal request and must fit normal limits. **Every app shares one provider key capped at 10 searches per second**, and the proxy retries a rate-limited search only twice, so never fan out dozens of searches with `Promise.all`: search one item at a time, or at most a few in parallel, and spread a long queue over several runs. Only add these when the app genuinely needs the web; don't wire them in otherwise.

### Search `type` — default `auto`, and when (not) to go deep

`search()` takes an optional `type`. **Leave it unset (`auto`) unless you have a specific reason** — `auto` lets Exa pick, and `fast`/`instant` trade a little quality for lower latency.

The `deep` family (`deep-lite`, `deep`, `deep-reasoning`) runs *agentic, multi-source research* and returns a synthesized answer on the result's `output` field (`output.content` — a string, or a structured object when you pass `outputSchema`). It is powerful but **costs ~2× a standard search (~$12–15 vs ~$7 per 1k) and takes several seconds**, so it is gated by usage, not capability:

- **Interactive (loader) and scheduled-handler paths → `auto` or `fast` only. NEVER `deep`/`deep-reasoning`.** Their multi-second latency blows the "one normal request" cadence contract a loader or scheduled run must honour.
- **Routine discovery / lead-gen ("find pages matching X") → `auto` + `includeSummary`, then extract structured fields with `createAI`.** This is the right pattern for the recurring-action lead-gen flow above — do *not* reach for `deep` here.
- **Reserve `deep`/`deep-reasoning` for explicit, user-invoked background research** where synthesis over many sources is the actual goal (e.g. a "research this topic" button the user clicks and waits on), not a page load.

```ts
// Deep research (user-invoked, background): synthesized answer, optionally structured.
const results = await createSearch(env).search("state of solid-state EV batteries 2026", {
  type: "deep",
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      keyPlayers: { type: "array", items: { type: "string" } },
    },
  },
});
const answer = results.output?.content; // structured object here; still iterate `results` for sources
```

