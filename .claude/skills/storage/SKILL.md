---
name: storage
description: File uploads, images, video, audio, attachments, or any binary data — adding them, extending an existing upload feature, fixing one that's not working (wrong file location, upload failing, media not playing), deleting a record that has a file, photo or video attached, or a photo, picture, cover-art or video address an app user pastes, types, imports from a link or pulls from a feed. Load before reading or editing any code that calls `createStorage` or touches `~stencil/storage`. File content always goes in R2 — never store bytes in D1, only the R2 key. Covers the platform uploader (`~stencil/upload`: any size, many files, progress, retries, plain refusals), range-based media serving, and deleting files with their records.
metadata:
  agents: [chat, builder]
---

# File Storage (R2)

Use `createStorage` from `~stencil/storage` in loaders and actions only (server-side). Keys are automatically scoped per-app — pass `avatars/user.jpg`, not the full prefixed path.

**Never store file bytes in D1 — store files in R2, keep the key (string) in D1.**

## Typed arrays and the typecheck

`Uint8Array`, `Float32Array` and the other typed arrays are generic over their buffer, and the default `ArrayBufferLike` includes `SharedArrayBuffer`. So bytes you get from a parser, a decoder, or `new Uint8Array(...)` do **not** typecheck as `BodyInit`, `BlobPart`, or a `Float32Array<ArrayBuffer>` parameter — `TS2345` / `TS2322 ... not assignable`. Call `.slice()` on the typed array before handing it to `new Response(...)`, `new Blob([...])`, or Web Audio: it copies into a fresh `ArrayBuffer`-backed view (`Uint8Array<ArrayBuffer>`) and the error goes away. Only when the copy matters, cast instead: `bytes as Uint8Array<ArrayBuffer>`. Fix every call site in one pass, then typecheck once.

## A file from an outsider is untrusted content

Any upload that reaches a public form, a shared upload link, a sign-up form or any screen another app user can use came from someone you don't control, and its declared type is just a claim. A web page or an SVG uploaded as a "logo" and shown from the app's own address runs the uploader's script as whoever opens it — another app user, or the app builder in their admin screens. Treat every upload as untrusted:

- **Restrict what you accept.** Give the upload route an `accept` list for the field — an avatar field takes `["image/*"]`, a contract field `["application/pdf"]` — and `handleUpload` refuses the rest before a byte is stored, in a sentence the screen shows. The type is read from the file's first bytes, not from the browser's claim.
- **A declared size is a claim too.** A `size` the browser sends when an upload starts is for drawing progress and an early refusal, never for a cap or a storage allowance: a client that declared one byte can send gigabytes. `maxBytes` is enforced on the bytes that were stored, at the finish. See **Finish once, measure, then stop accepting bytes**.
- **Storage pins the type.** `put` keeps the declared type only when it is on the safe-media allowlist (images, PDF, audio/video, plain text, captions) and the file's first bytes match it; HTML, SVG, XML, a mislabelled web page and every other type are stored as `application/octet-stream`. A read through `createStorage` reports the same pinned type for a file already stored under another one, so an older web page or SVG comes back as `application/octet-stream` too. So the type you read is never a page type, and SVG is always a download — there is no inline SVG upload on Stencil, so don't promise one; a vector logo is converted to PNG or WebP on the client before upload if it must display.
- **Every byte leaves storage through one helper.** `serveR2Object` serves the allowlist inline under the stored type, everything else as a download, always with `X-Content-Type-Options: nosniff`. This is the **only** way to return stored bytes, including from your own routes — see *Custom serving routes* below. A route that does `new Response(obj.body)` with `obj.httpMetadata`, `writeHttpMetadata` or a type read from a record reopens the hole, and the security scan flags it.

### Custom serving routes

A feature often wants a file address `/api/files/<key>` does not express — a record id instead of a key, a per-account token, an owner check, a file fetched from somewhere else. Build that route, but end it in the helper: do your lookup, then hand the **key** to `serveR2Object`:

```ts
// app/routes/api.logo.$id.tsx — id-addressed, owner-checked, still served by the helper
import type { Route } from "./+types/api.logo.$id";
import { data } from "~stencil/data";
import { createStorage, serveR2Object, imageTransformFromRequest } from "~stencil/storage";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const db = await data(request, env);
  const studio = await db.from("studios").get(params.id); // throws notFound
  if (!studio.logoKey) throw new Response("Not found", { status: 404 });
  return serveR2Object(createStorage(env), studio.logoKey, request, {
    transform: imageTransformFromRequest(request, env),
  });
}
```

Bytes that are not in the app's storage — an inbound email attachment, a file proxied from another host or store — go through `untrustedFileResponse(body, claimedType, { downloadAs? })` from `~stencil/storage`, which applies the same allowlist and nosniff:

```ts
const upstream = await fetch(sourceUrl);
return untrustedFileResponse(upstream.body, upstream.headers.get("Content-Type"));
```

Never write `new Response(bytes, { headers: { "Content-Type": storedType } })` for a file someone else supplied, whatever the route is called.

---

## A picture from an outside address an app user supplied is copied in, never rendered

The rule is about where a picture comes from, not the field it arrived in. Any outside address an app user supplied — a "Photo URL", "Image link" or "Logo address" they typed or pasted, the preview image of a link they imported (a recipe page, a saved article), the cover art in a podcast or RSS feed they added, an address that reached the row through a webhook or an API route — is **never** saved as the address and never rendered as `<img src={row.photoUrl}>`, a CSS `background-image`, a `<video src>` or `poster`, or an `og:image`. Every other app user who opens that screen would then load the picture from the poster's own server, which learns each viewer's IP address, device and the page they were on, and can swap the picture for a different one after it was looked at. Anything not uploaded into the app counts, however it got there.

Prefer an upload field (the patterns above). Otherwise the action copies the picture into the app's own storage once with `storeImageFromUrl` and saves the returned key; the screen renders `/api/files/<key>` like any upload:

```ts
import { data } from "~stencil/data";
import { createStorage, storeImageFromUrl } from "~stencil/storage";

export async function action({ request, context }: Route.ActionArgs) {
  const db = await data(request, context.cloudflare.env);
  const storage = createStorage(context.cloudflare.env);
  const form = await request.formData();
  const photoUrl = String(form.get("photoUrl") ?? "");
  const stored = await storeImageFromUrl(storage, photoUrl, `listings/${crypto.randomUUID()}`);
  // A refusal (not a web address, a private host, not a picture, over 20 MB) carries a plain reason.
  if (!stored.ok) return Response.json({ error: stored.reason }, { status: 400 });
  await db.from("listings").create({ title: String(form.get("title")), photoKey: stored.key });
  return Response.json({ success: true });
}
```

The key is nothing on its own: `/api/files/<key>` answers 404 until the app serves it. An app whose only pictures are pasted addresses has no upload field, so it has no file route yet — add `app/routes/api.files.$.tsx` and its `routes.ts` line from "Serve files via a resource route" below in the same change, or every photo renders broken.

`storeImageFromUrl` fetches only public http(s) addresses (redirects re-checked, private networks refused), accepts PNG, JPEG, GIF, WebP and AVIF under 20 MB, and sets the stored type from the bytes, not from what the other server claimed. The column holds a storage key, so it is deleted with the record by `deleteStoredFiles` and resized by URL like every other stored image. An address only the app builder can set (a brand logo in settings, a hero image) is their own content and may stay a plain address.

A link an app user imports goes the same way without a second call: `createFetch(env).page(url, { storeImage: { storage, key } })` copies the page's preview image in and returns `image` as `/api/files/<key>` (null when the page has no picture or the copy was refused), so a recipe, article or product card other people see never shows the linked site's address (the `web-search` skill). Cover art from a podcast or RSS feed is an address in the feed, so the import passes it through `storeImageFromUrl` like a pasted one and stores the key, never the feed's address.

Video has no copy path. A pasted YouTube, Vimeo, Loom, Descript or Google Drive link plays through `<VideoEmbed>` from `~stencil/ui/video/embed`, which loads the provider's player only when pressed. A direct video file address (an `.mp4` or `.mov` link, a file on the poster's own server) is never rendered as `<video src>` for other people: the field becomes an upload through the platform uploader below, which also gives the video a playable copy and captions.

## Uploading: the platform uploader

Every upload field — one photo or a thousand, a PDF, a 2 GB video — goes through the platform uploader: `handleUpload` from `~stencil/upload/server` behind one resource route, and `uploadFile` / `uploadFiles` from `~stencil/upload/client` in the screen. Never write the chunking, the retries, the progress or the abort yourself, and never post a file an app user picked to an action in one request: the Worker's ~100 MB body limit kills that at the edge with no response the app can show, and a hand-written copy drifts from every other one.

**Server — `app/routes/api.upload.tsx`** (register `route("api/upload", "routes/api.upload.tsx")`):

```ts
import type { Route } from "./+types/api.upload";
import { requireAuth } from "~stencil/auth/server";
import { createStorage } from "~stencil/storage";
import { handleUpload } from "~stencil/upload/server";

export async function action({ request, context }: Route.ActionArgs) {
  // Same gate as the screen that uploads: requireRole here when that screen is admin-only.
  const { user } = await requireAuth(request, context.cloudflare.env);
  return handleUpload(request, createStorage(context.cloudflare.env), {
    key: (file) => `uploads/${user.id}/${crypto.randomUUID()}-${file.name}`,
    maxBytes: 500 * 1024 * 1024,
    accept: ["image/*", "video/*", "application/pdf"],
    allowance: { env: context.cloudflare.env, owner: user.id },
  });
}
```

`key` names where the file lands (keep `crypto.randomUUID()` in it). `maxBytes` is the biggest file the route stores (10 MB when left out, so a route that takes bigger files always sets it) and `accept` the types it stores, exact or by family; both are the server's own rules, built per request. `allowance` is what one app user may keep stored in total, and every route a signed-in app user uploads through passes it: the platform records each finished file against `owner` (always `user.id` from the route's gate), refuses an upload that would take them past the total with a sentence the screen shows as it is, and stops counting a file when `storage.delete` or `deleteStoredFiles` removes it. The total is 5 GB unless `bytes` says otherwise (`allowance: { env, owner: user.id, bytes: 20 * 1024 ** 3 }`); set `bytes` when the app builder names a number or the app is built around big files. Never write an allowance of your own: no usage table, no counter in `onComplete`, no remaining-space sum in `maxBytes`; a build that touches a route carrying one moves it onto `allowance`. Only files finished through a route with `allowance` count, so files stored before it are in nobody's total. `onComplete({ key, size, contentType, name })` runs once per finished file. The screen saves the key to its row afterwards (the pattern at the end); `onComplete` is only for bookkeeping the route itself owns.

**Screen — `<UploadZone>`, the default for every upload field:**

```tsx
import * as uploader from "~stencil/upload/client";
import { UploadZone } from "~stencil/ui/upload/zone";

<UploadZone
  uploader={uploader}
  batch={`gallery:${gallery.id}`}
  onUploaded={(files) => fetcher.submit({ keys: files.map((f) => f.key) }, { method: "post", encType: "application/json" })}
/>
```

It is the whole field: a drop area that takes files and whole folders, "Choose files" and "Choose a folder" buttons, the allowed formats and size cap shown before anything is picked, a progress row per file, each refusal's sentence beside its file, Retry for the files that failed, Cancel for the batch, and the offer to continue a batch a reload cut short. It asks the upload route what it takes, so the help text and `<input accept>` always match the route's own `accept` and `maxBytes`; never write them a second time in the screen. `onUploaded(files)` is called once per batch with what reached storage (after a Cancel too); save each `key` there, by key, as in the pattern at the end. Props: `multiple={false}` for a field that holds one file, `route` when the screen uses a route other than `/api/upload`, `batch` as described below, `label` for the line inside the drop area. Never hand-build a drop area, a file input, progress rows or a retry list; build a screen of your own on the functions below only when the field is not a drop area at all (an avatar button, a paste into an editor).

**Client — the functions under it:**

```tsx
import { uploadFile, uploadFiles, UploadError } from "~stencil/upload/client";

// One file, with progress; the result's key is what the row stores.
const { key, url } = await uploadFile(file, { onProgress: setPercent });

// Many files — a multi-select or a dropped folder — three at a time; every file is tried.
// `batch` names the record the files attach to (see below).
const { uploaded, failed } = await uploadFiles(input.files, {
  batch: `gallery:${gallery.id}`,
  onProgress: setPercent,
  onFile: ({ file, error }) => error && toast.error(`${file.name}: ${error.message}`),
});
```

A refusal or a failure is an `UploadError`: show `error.message` as it is — "That file is over 500 MB.", "That file type isn't accepted here (images, videos or PDF).", "That file isn't the type its name says it is." or "The upload didn't finish. Check your connection and try again." — never a message of your own. Pass `signal` from an `AbortController` for a Cancel button. A screen of its own tells app users what the field takes before they pick: `await uploadRules(route)` from the same module answers `{ accept, maxBytes, hint }` from the route itself, with `hint` the sentence for the help text ("Images or PDF, up to 20 MB per file.") and `accept.join(",")` the value for `<input accept>`.

**An interrupted batch continues.** `uploadFiles` remembers its batch in the browser until it returns, so a reload, a closed laptop or a crashed tab loses nothing that already landed. `<UploadZone>` does all of this when it is given `batch`. A screen that calls `uploadFiles` itself names the record it uploads into as `batch`, checks for that record's batch on load and offers to continue it:

```tsx
import { interruptedUploads, forgetInterruptedUploads } from "~stencil/upload/client";

const batch = `gallery:${gallery.id}`; // the same value in all three calls
await uploadFiles(input.files, { batch, onProgress: setPercent });

// In an effect on the upload screen, keyed on `batch`: [] when nothing was cut short here.
const waiting = await interruptedUploads({ batch });
const stored = waiting.filter((f) => f.stored).length;
// → "212 of 300 photos were uploaded before the page closed. Pick the same folder to send the rest."
```

A browser cannot keep the files themselves across a reload, so the offer asks the app user to pick the same files or folder again, and the screen passes them to `uploadFiles` as usual. Files already in storage are not sent again and come back in `uploaded` with `resumed: true` and their original `key`; a half-sent file continues from its last finished part; the rest upload normally. Save rows by `key` (insert only when no row has it), because a file whose row was saved before the reload comes back a second time. A "Start over" or "Dismiss" button calls `forgetInterruptedUploads({ batch })`. Never build a "retry failed" list or keep batch state in component state or `localStorage` yourself. `batch` keeps one record's offer off another's: a batch cut short in gallery 1 is offered in gallery 1 only, and the same files picked in gallery 2 upload fresh instead of coming back `resumed` with gallery 1's keys. Build it from the row the files attach to (`gallery:<id>`, `order:<id>:receipts`); a screen with no row yet uses a fixed name of its own (`new-listing`). Never call any of the three without it on a screen that uploads into a record. Add the same `route` (`{ route, batch }`) to all three when the screen uses one other than `/api/upload`. `uploadFile` (one file) does not continue after a reload.

What the uploader owns, so the app does not: 10 MB parts, up to three files in flight, four attempts per part with a growing pause, byte-level progress, a batch that continues after a reload, an abort that leaves no half file in storage (a batch file cut off by a lost connection is kept for up to 6 days so it can continue), and the type decision — the server reads it from the file's first bytes, so an iPhone photo with no declared type is stored as `image/heic` and a web page renamed `.png` is not stored as an image.

**What is inside the upload** — the text of a PDF or text file, the words in a photo or scan, fields out of an invoice or form — is `createAI(env).readDocument({ file: { key } })` from `~stencil/ai`, read once after the upload and stored on the row: the `document-reading` skill. Never a PDF, Word or OCR library; Word files and spreadsheets are not read yet, so say so.

### Finish once, measure, then stop accepting bytes

A size the browser declares is for progress and an early, friendly refusal, never a limit: a client that declared one byte can send gigabytes. `handleUpload` enforces `maxBytes` on the stored bytes at the finish through `completeUpload`, which joins the parts, reads the object's real size, deletes it and answers 413 when it is over, and retires the `uploadId` so no more parts land. Any content check (moderation, a virus scan) runs in `onComplete`, on the sealed bytes — a check that ran before the last write can be beaten by one more write.

The platform also holds every chunked upload to a ceiling, whatever the route sets: a part over 10 MiB or numbered past what a 2 GiB file can need is refused, and a finished file over 2 GiB is deleted at completion, each as an `UploadTooLargeError`. That is the backstop, not the app's rule — `maxBytes` still enforces the app's own cap, and `allowance` each app user's total. An app that genuinely takes bigger files raises the ceiling on purpose, in every route that touches that upload: `createStorage(env, { maxUploadBytes: 8 * 1024 * 1024 * 1024 })` (and `maxPartBytes` when its client sends bigger parts).

### Below the uploader

An app that streams a file from another service, or needs a part size of its own, drives the primitives `handleUpload` is built on: `storage.createMultipartUpload(key, { httpMetadata })`, `storage.resumeMultipartUpload(key, uploadId).uploadPart(n, bytes)` and `completeUpload(storage, key, uploadId, parts, maxBytes)` from `~stencil/storage`, which measures and seals exactly as above, with `.abort()` on failure. A file that is already on the server as bytes (a generated PDF, a fetched image) is a plain `storage.put(key, bytes, { httpMetadata: { contentType } })`; a file an app user picks is never.

## Get / List / Delete

```ts
export async function loader({ context }: Route.LoaderArgs) {
  const storage = createStorage(context.cloudflare.env);
  const obj = await storage.get("avatars/user.jpg");
  if (!obj) throw new Response("Not found", { status: 404 });
  const listed = await storage.list({ prefix: "avatars/" });
  await storage.delete("avatars/old-photo.jpg");
  return { files: listed.objects };
}
```

## The app's own public files (`/assets/*`) are storage keys too

Everything served at `/assets/<name>` — generated images, copied uploads, fonts, a file put with the `assets_put` tool — lives under the same app-scoped prefix `createStorage` reads, as the key `assets/<name>`. When server code needs one of those files (to inline it, parse it, draw a share card from it, attach it to an email), read it from storage:

```ts
const object = await createStorage(env).get("assets/build-log.html");
if (!object) throw new Response("Not found", { status: 404 });
const html = await object.text(); // or .arrayBuffer() / .body
```

**Never `fetch()` the app's own address from a loader, action or scheduled handler** — not `new URL("/assets/x", request.url)`, not `/api/files/<key>`, not the custom domain by name. A storage read is direct; a fetch of the app's own address leaves the worker, goes out through the edge and comes back in as a second request.

## Delete the file when its record is deleted

**Deleting a record deletes the files it owns. Always.** A row that keeps a key or a `/api/files/...` URL owns that object; removing the row alone leaves the file online at its old address for anyone who kept the link, and the app builder's storage grows forever. The data layer does not know which columns hold files, so every delete action does it explicitly with `deleteStoredFiles` — read the row for its file columns, delete the row, then delete the files. The row must go first: `get` is allowed by the table's read rule and `delete` by its delete rule, so on a table anyone can read but only the owner can delete, a viewer's request would otherwise destroy the files and then be refused the row.

```ts
import { data } from "~stencil/data";
import { createStorage, deleteStoredFiles } from "~stencil/storage";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = await data(request, env);
  const form = await request.formData();
  const post = await db.from("posts").get(String(form.get("id"))); // throws notFound, never returns null
  await db.from("posts").delete(post.id);
  // Every file column — keys or /api/files URLs, single values or arrays; blanks are skipped.
  await deleteStoredFiles(createStorage(env), post.photoKey, post.videoUrl, post.galleryKeys);
  return { ok: true };
}
```

This applies to **every** path that removes the record — the single-item delete, the "delete all" or parent delete that removes children, the admin clean-up — and to replacing a file: when an app user uploads a new avatar, delete the old key after the new one is saved. If one upload can be referenced by several rows (a shared library), delete the file only when its last owner goes.

Once the object is deleted, a fresh request for the old address is a 404 immediately, including resized variants. A browser that already loaded the file keeps its copy for at most an hour (the default `Cache-Control` from `serveR2Object`), then revalidates and gets the 404.

## Serve files via a resource route

Create `app/routes/api.files.$.tsx`. Use `serveR2Object` — it honors the `Range` header (`206 Partial Content`), which is **required for `<video>`/`<audio>` seeking and smooth playback of large media**. A plain `new Response(obj.body)` cannot be scrubbed and forces the whole file to download first.

```ts
import type { Route } from "./+types/api.files.$";
import { createStorage, serveR2Object, imageTransformFromRequest } from "~stencil/storage";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const storage = createStorage(env);
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });
  // Gate this the way the screens that show these files are gated (Access control, below).
  return serveR2Object(storage, key, request, {
    transform: imageTransformFromRequest(request, env),
  });
}
```

Register in `app/routes.ts`:
```ts
route("api/files/*", "routes/api.files.$.tsx"),
```

Reference in components:
```tsx
<StoredPhoto src="/api/files/avatars/user.jpg" alt="Avatar" width={64} height={64} />
<video src="/api/files/uploads/lesson.mp4" controls preload="metadata" />
```

## Video: captions beside the file, and a ready player

A video an app user or app builder uploads should carry captions, the way it would on
a video host. The caption file is a stored object **beside** the video under one
platform-wide key, `captionKeyFor(videoKey)` (the video key plus `.vtt`), served by the
same file route (`text/vtt` is on the inline allowlist), and deleted with the video:

```ts
import { captionKeyFor, deleteStoredFiles } from "~stencil/storage";

await deleteStoredFiles(storage, video.key, captionKeyFor(video.key));
```

Make the file with the `captions` media job — `createMedia(env).transform({ operation:
"captions", input: video.key })`, hours long included, see the **`media-processing`** skill — or let
the app builder upload or edit one under that key. Play it with the platform's player,
which attaches the track and leaves the controls to the browser:

```tsx
import { VideoPlayer } from "~stencil/ui/video/player";

<VideoPlayer
  src={`/api/files/${video.key}`}
  captions={video.hasCaptions ? `/api/files/${captionKeyFor(video.key)}` : null}
  className="w-full rounded-lg"
/>
```

Use `<VideoPlayer>` for every uploaded video, captioned or not — a bare `<video>` is for
a decorative loop with no sound.

### Every uploaded video plays on a phone: convert it to H.264 MP4

A phone or a laptop plays an upload only when it is H.264 picture (AAC or no sound)
in an MP4 container. An iPhone export is often HEVC, a screen recording is often
`.mov`, and both parse (the duration shows) and then fail with "This Video Could Not
Be Loaded" on an iPhone, Android Chrome and most Windows browsers while they play on
the Mac that made them. So in the same action that saves the video's key — next to
the `captions` job — queue the platform's `convert` with `convertForPlayback`, which
reads the stored file's headers and returns `null` when it is already H.264 MP4:

```ts
import { convertForPlayback } from "~stencil/media";

const job = await convertForPlayback(env, storage, video.key);
if (job) await db.update(videos).set({ convertJobId: job.jobId, convertStatus: "processing" }).where(eq(videos.id, video.id));
```

Poll `status(convertJobId)` from the same resource route as captions. On `succeeded`
save its `key` as the row's `playableKey` and set `convertStatus: "ready"`; on `failed`
keep serving the original and show `error` to the app builder. `<VideoPlayer>` gets
`playableKey ?? key`, so the original plays until the conversion lands and nothing
waits on it. Keep the original: it is the app builder's file, and the caption job and any
later edit read it. `deleteStoredFiles(storage, video.key, video.playableKey,
captionKeyFor(video.key))` when the row goes. Build every new video upload this way
without being asked; the **`media-processing`** skill has the job shape.

## Serve an image at the size you show it

With `imageTransformFromRequest` wired into the file route (above), the route serves
any size a URL asks for — **never store a second, smaller copy of an image**, and never
write a resizing route. The stored file stays untouched; the resized variant is computed
through the platform's image engine and cached at the edge per URL, so it works for every
image already in storage, not just new uploads. Draw every stored picture with
`<StoredPhoto>` from `~stencil/ui/photo/stored`: it takes `<img>`'s props, asks for a
copy sized for its slot and the screen, and loads only when scrolled into view:

```tsx
{/* its own shape, sized for wherever it is shown: a list tile and a full-width view alike */}
<StoredPhoto src={`/api/files/${photo.key}`} alt="…" width={photo.width} height={photo.height} className="w-full h-auto" />
{/* visible on load (a cover, a header logo): fetched first, not lazily */}
<StoredPhoto priority src={`/api/files/${cover.key}`} alt="…" width={cover.width} height={cover.height} className="w-full h-auto" />
{/* a fixed square is a deliberate choice: avatars, icons, or uniform tiles the app builder asked for;
    gravity="face" keeps the face in the crop */}
<StoredPhoto ratio="1/1" gravity="face" src={`/api/files/${avatarKey}`} alt="…" width={128} height={128} className="size-16 rounded-full" />
```

A hand-written size (`/api/files/<key>?width=800`, about twice the displayed width) is
only for a place that takes an address and no element: a CSS background, an `og:image`,
a video poster.

### Photos keep their shape

An uploaded photo is landscape, portrait or square, and the app user who uploaded it
expects to see all of it. **Default to the photo's own aspect ratio** everywhere a
stored photo is shown — gallery grids, cards, detail screens, order and print-size
screens, lightboxes:

- Ask the URL for `width` only (or `width` + `height` with the default `scale-down`,
  which only bounds the box) and render with `className="w-full h-auto"`. Never put a
  photo in a fixed-ratio tile with `object-cover`: it clips the sides of every
  landscape photo in a portrait tile and the top and bottom of every portrait photo
  in a landscape tile, and app users notice on group photos and prints.
- `fit=cover`, `fit=crop` and `object-cover` are for avatars, icons, thumbnails of a
  known shape, and galleries the app builder explicitly asked to be uniform. Make that
  crop visible in the code (`aspect-square`) so it reads as a choice, not an accident.
  When the app user should choose what the frame keeps (a profile photo, a cover),
  show the ready crop control after they pick the file: "An app user frames the
  photo" in the `image-transform` skill.
- Save the photo's pixel size next to its key so `<img width height>` reserves the
  right box and the page doesn't shift as photos load. Read it in the browser before
  the upload and send it with the file:

```ts
// client, before the upload
const bitmap = await createImageBitmap(file);
form.set("width", String(bitmap.width));
form.set("height", String(bitmap.height));
bitmap.close();

// action: integer columns beside the key, so the gallery below can read photo.width / photo.height
await db.insert(photos).values({
  key,
  width: Number(formData.get("width")),
  height: Number(formData.get("height")),
});
```

A natural-shape gallery with no measuring and no masonry library — CSS columns flow
the photos, each at its own shape, and a dialog shows the clicked one whole:

```tsx
<div className="columns-2 gap-4 md:columns-3">
  {photos.map((photo) => (
    <button key={photo.id} type="button" onClick={() => setOpen(photo)} className="mb-4 block w-full break-inside-avoid">
      <StoredPhoto
        src={`/api/files/${photo.key}`}
        alt={photo.caption}
        width={photo.width}
        height={photo.height}
        className="w-full h-auto rounded-lg"
      />
    </button>
  ))}
</div>

<Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
  <DialogContent className="sm:max-w-5xl p-2">
    {open && (
      <StoredPhoto
        priority
        src={`/api/files/${open.key}`}
        alt={open.caption}
        width={open.width}
        height={open.height}
        className="mx-auto max-h-[85vh] w-auto h-auto object-contain"
      />
    )}
  </DialogContent>
</Dialog>
```

Use the same `w-auto h-auto object-contain` image on any screen that opens from a
photo — a detail page, a print-size picker, an order form — so the photo an app user
is about to buy is the whole photo.

Accepted params: `width` / `height` (pixels, capped at 4096), `fit`
(`scale-down` | `contain` | `pad` | `squeeze` | `cover` | `crop`), `format`
(`webp`, `jpeg`, `png`, `gif`, `avif`), `quality` (1–100). A non-image, a source
over 20 MB, or a `Range` request serves the stored object unchanged, so the same
route keeps serving video, audio, and documents correctly.

To hand the object over as a **download** instead of displaying it, pass `downloadAs` — it sets `Content-Disposition: attachment` with that filename, so a plain `<a href>` at the route saves the file the same way in every browser (see the `file-export` skill):
```ts
return serveR2Object(storage, key, request, { downloadAs: "invoice-march.pdf" });
```

> **Access control: the upload and file routes carry the same gate as the screens that use them.** `/api/files/*` as written above is public by key — keys use `crypto.randomUUID()`, so they're unguessable ("unlisted"), but anyone with the URL can fetch the file — and the upload routes above admit any signed-in app user. That is right only for an app whose screens are open to every signed-in app user. When the screen that attaches or shows a file is admin-only, call `requireRole` in the upload action and in the file loader too. When the file belongs to a **private, paywalled or unpublished** record (a course video behind a purchase, photos of an unpublished listing), look the key up in D1, run that record's own check, and only then `serveR2Object` — don't hand out the raw `/api/files/<key>` URL. Sign-in alone on the upload and nothing on the read is the shape that lets a stranger fill the app builder's storage and open an admin's pasted images by address.

## Typical pattern: upload → store key in D1

```tsx
// screen: upload first, then save the key with the rest of the form
const { key } = await uploadFile(file, { onProgress: setPercent });
fetcher.submit({ photoKey: key }, { method: "post" });

// action: the key is a string column, never the bytes. It must be this app user's own
// file — the route minted it under their prefix — so nobody points a row at someone else's.
const photoKey = String(form.get("photoKey"));
if (!photoKey.startsWith(`uploads/${user.id}/`)) throw new Response("Forbidden", { status: 403 });
await db.update(profiles).set({ photoKey }).where(eq(profiles.userId, user.id));

// loader: read key, build URL
const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
return { photoUrl: profile.photoKey ? `/api/files/${profile.photoKey}` : null };
```
