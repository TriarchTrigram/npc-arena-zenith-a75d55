---
name: image-transform
description: Resizing, cropping (centre, around the face, around a chosen point, or an exact app-user-chosen region), compressing, rotating, format-converting, or removing the background of an existing image server-side — thumbnails, avatar crops, print crops, downscaling before an AI vision call, WebP/AVIF conversion, transparent cut-outs of the product, clothing and profile photos app users upload. Uses createImage(env).transform from ~stencil/image (Cloudflare Images binding, keyless, server-side). Load whenever the brief needs server-side image processing on uploaded or stored images — note that *displaying* a stored image at a different size needs no transform-and-store: the serving route resizes by URL (see the storage skill). For stamping a watermark/logo onto pictures (`transform`'s `watermark` option), load the `watermark` skill. Do NOT reach for Sharp, jimp, or any native/npm image library — they can't run on Cloudflare Workers.
metadata:
  agents: [chat, builder]
---

# Image transform

`createImage(env).transform(source, params)` from `~stencil/image` resizes, crops,
rotates, and format-converts an image at request time, proxied through the Stencil
backend (Cloudflare Images binding). No API keys. **Server-side only** — loaders,
actions, or scheduled handlers, never the browser.

## Do not use Sharp (or any native image library)

The app deploys to Cloudflare Workers (workerd). **Sharp** is a native libvips
`.node` addon and **cannot load on Workers**, even with `nodejs_compat` — importing it
fails the whole worker at startup. The same goes for any package that shells out to
ImageMagick or bundles a native codec. There is exactly one supported server-side path
for resizing an image: `createImage(env).transform`. Reach for it instead of `sharp`,
`jimp`, `@napi-rs/image`, or a `/api/process-image` route built on them.

## API

```ts
const { body, contentType } = await createImage(env).transform(source, {
  width: 1600,
  fit: "scale-down",
  format: "image/webp",
  quality: 80,
});
```

- `source` (required) — the image bytes: an uploaded `File`/`Blob`, an `ArrayBuffer`,
  or a `Uint8Array` (e.g. bytes read back from R2). **Max 20 MB** — a larger source is
  rejected with a 413, so cap the upload before calling (see below).
- `width` / `height` — target size in pixels. Omit one to scale by the other.
- `fit` — how the image fills the box: `scale-down` (default), `contain`, `pad`,
  `squeeze`, `cover`, `crop`. `cover` and `crop` throw part of the picture away:
  use them for avatars, icons and uniform tiles the app builder asked for, never as
  the default for photos (see "Photos keep their shape" in the `storage` skill).
- `gravity` — which part of the picture a `cover` or `crop` keeps: `"face"` centres on
  the faces in the photo, `"auto"` on its most notable area, and `{ x, y }` (each 0–1
  of the source, from its top-left) on a point. A point may carry `mode`: `"box-center"`
  (default) centres the kept area on it, `"remainder"` shifts the cut the way CSS
  `object-position` does. Default: the centre. See "Keep the face or a chosen point in
  the crop" below.
- `rotate` — `90`, `180`, or `270`.
- `trim` — `{ top, right, bottom, left }`, pixels to cut off each edge of the source
  before any resize: the exact region an app user chose with a crop frame (offset and
  zoom included), not a centre crop. Whole numbers measured on the source, 0 or more;
  combine with `width`/`height`/`fit` to size the cut-out. A trim that leaves nothing
  is rejected with a 400.
- `format` — `image/webp` (default), `image/jpeg`, `image/png`, `image/gif`,
  `image/avif`.
- `quality` — `1`–`100` for lossy formats.
- `removeBackground` — `true` cuts the subject out and makes everything behind it
  transparent. See "Remove a background" below.

Returns the transformed image as a byte **stream** (`body`) plus its `contentType` —
pass `body` straight to `createStorage().put(key, body)`. The response is known-length,
so R2 accepts the stream directly; no need to buffer it in the worker first.

### The 20 MB source limit

`transform` cannot read a source over 20 MB — photos straight off a modern camera or
phone routinely exceed it. Check the size in the upload handler and tell the app user,
rather than letting the transform fail:

```ts
const MAX_IMAGE_BYTES = 20_000_000; // 20 MB, decimal — not 20 MiB
if (file.size > MAX_IMAGE_BYTES) {
  return data({ error: "That image is over 20 MB — please upload a smaller file." }, { status: 400 });
}
```

The same limit applies to the stored mark named by `watermark.key`, and the limit is on
the source you send, not on the size you transform it down to. Store the original in R2
unchanged if you need it; only the bytes handed to `transform` are capped.

## Showing a stored image smaller or sharper? Don't store a copy — size the URL

To display a stored image at a different size (thumbnails, list photos, sharp
hero images), **do not** transform at upload time and store a second file. Store
the original once; the serving route resizes on the way out when the URL asks
for a size — `/api/files/<key>?width=800` keeps the photo's own shape, and
`?width=128&height=128&fit=cover` is the avatar square — and the variant
is cached at the edge. In a screen, `<StoredPhoto>` from `~stencil/ui/photo/stored`
writes those sizes for you and lazy-loads the picture. That works for every image already in storage, needs no
naming convention linking two files, and never drifts out of sync with the
original. The route wiring (`serveR2Object` + `imageTransformFromRequest`) and
the accepted params are in the `storage` skill's serving section.

Upload handlers store the file once, untouched:

```ts
// app/routes/api.upload-photo.tsx  (register in app/routes.ts)
import type { Route } from "./+types/api.upload-photo";
import { createStorage } from "~stencil/storage";
import { requireAuth } from "~stencil/auth/server";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const storage = createStorage(env);

  const form = await request.formData();
  const file = form.get("photo") as File;

  const key = `photos/${user.id}/${crypto.randomUUID()}`;
  await storage.put(key, file, { httpMetadata: { contentType: file.type } });

  return Response.json({ key });
}
```

Reach for `transform` + `put` only when the transformed bytes are genuinely a
different stored asset — a watermarked copy that must exist so the clean source
is never served (see the `watermark` skill), or a permanent conversion of the
stored file itself.

## An app user frames the photo: the ready crop control

"Drag your photo into place" for an avatar, a cover or a banner is a ready control on an
app built from the component library: install `image-cropper` with `components_get` and
show it right after the app user picks the photo, before the upload is saved. Never write
a crop frame, a zoom slider or drag maths there, and never crop with a canvas in the
browser. It offers a circle, square or 16:9 frame (no rotate, flip or tilt) and reports
the chosen frame and a rectangle: `onChange({ shape, area })`, `shape` being `"circle"`,
`"square"` or `"landscape"` (16:9) and `area` being `{ x, y, width, height }` as
fractions (0–1) of the original. Post both with the file, turn `area` into `trim`, and
give the output the frame's own shape:

```ts
// width and height: the source's pixel size (see "Photos keep their shape" in `storage`)
const left = Math.round(area.x * width);
const top = Math.round(area.y * height);
const trim = {
  left,
  top,
  right: Math.max(0, width - left - Math.round(area.width * width)),
  bottom: Math.max(0, height - top - Math.round(area.height * height)),
};
// A box in any other shape makes `cover` cut into the area the app user framed.
const size = shape === "landscape" ? { width: 1600, height: 900 } : { width: 512, height: 512 };
const { body } = await createImage(env).transform(file, { trim, ...size, fit: "cover" });
```

A circle is stored as its square and shown with `rounded-full`. A phone photo saved
sideways needs nothing extra: the browser's pixel size, `area` and `trim` all measure
the photo as it is displayed, so never swap the axes or add `rotate` for it.

## Keep the face or a chosen point in the crop

A fixed-shape frame (an avatar circle, a card photo, a cover or hero band) cut from
the centre takes heads off. Never write face-finding, a "head-safe" crop rule or
`object-position` maths for it — say what to keep, on `<StoredPhoto>` or in `transform`:

```tsx
{/* a person: keep the face */}
<StoredPhoto ratio="16/9" gravity="face" src={`/api/files/${photo.key}`} alt="…" width={640} height={360} className="w-full h-auto" />
{/* a spot the app user picked, stored on the record as two 0–1 numbers */}
<StoredPhoto ratio="16/9" gravity={`${photo.focusX}x${photo.focusY}`} src={`/api/files/${photo.key}`} alt="…" width={640} height={360} className="w-full h-auto" />
```

- `gravity="face"` needs nothing stored and works on every photo already uploaded; a
  photo with no face is cut from the centre. Use it by default wherever a `ratio`
  frame shows people. `gravity="auto"` is the same for a subject that is not a person.
- A point is for "let me choose what shows": store `focus_x` and `focus_y` (numbers,
  0–1, default 0.5) beside the image key, set them from where the app user clicks or
  drags on the photo, and pass them as `<x>x<y>`. One stored point serves every frame
  shape, so never store a crop per screen. The point is where the middle of the frame
  goes; add `-remainder` (`0.3x0.2-remainder`) to place it as `object-position` would.
- `<StoredPhoto>` writes `gravity` into the link as `?gravity=`, which `/api/files/` and
  `/assets/` both read; write it by hand (`?width=640&height=360&fit=cover&gravity=face`)
  only where a place takes an address and no element. `transform` takes the same values
  as `gravity: "face"` or `gravity: { x: 0.3, y: 0.2 }` for a stored or printed copy.
- It only has an effect on a fixed-shape crop: a `ratio`, or both `width` and `height`
  with `fit=cover` or `fit=crop`. For an exact rectangle (offset and zoom from a crop
  frame) use `trim`.

## Downscale before an AI vision call

A full-size photo wastes tokens and can exceed model input limits. When stored
image bytes go to a vision model (or any classifier), `transform` them down
first — this is the byte-in/byte-out case the serving route can't cover:

```ts
const object = await storage.get(photoKey);
if (!object) throw new Response("Not found", { status: 404 });
const { body } = await createImage(env).transform(await object.arrayBuffer(), {
  width: 1024,
  fit: "scale-down",
  format: "image/webp",
});
const bytes = await new Response(body).arrayBuffer(); // hand these to the model
```

Nothing is stored: the downscaled bytes exist only for the call.

## Remove a background

`removeBackground: true` runs a segmentation model that keeps the subject and clears
everything behind it — soft edges, shadows and textured backdrops included. It is for
pictures the app handles **at runtime**: the product shots, clothing and item photos app
users upload, or files already in storage. Never colour-key one of those by hand, in a
script or on a canvas: that is what this option replaces.

It is a paid model call, so run it **once, when the picture is uploaded**, and store the
cut-out as a **new file beside the original**. Never overwrite the original, and never
remove a background on the serving route.

It does not reach a **build-time asset** — a logo or mascot the app builder attached to
the chat, or a picture from `generateImage` — because those are static files the app
serves from `public`, not uploads it handles, and there is no build-time cut-out yet. Do
not wire an upload route or a scheduled handler just to pass a static file through
`transform`. Ask the app builder for a transparent PNG or SVG, or regenerate the mark on
a plain flat background the page can match; if neither is possible, place the picture as
it is and say so in your reply, rather than spending the build on a hand-made cut-out.

```ts
const cutout = await createImage(env).transform(file, {
  removeBackground: true,
  format: "image/png",
});
const cutoutKey = `${key}-cutout.png`;
await storage.put(cutoutKey, cutout.body, { httpMetadata: { contentType: cutout.contentType } });
```

Keep the default WebP or ask for PNG: JPEG has no transparency, so the cleared background
would come back black. Other params combine in the same pass — `width: 1200` resizes the
cut-out, and `watermark` marks it.

## Watermarking

`transform` composites a mark onto the picture when you pass the `watermark` option,
naming a mark you have stored in R2 — the delivered bytes are already marked
server-side, which a client-side overlay can never guarantee. The options and the
serve-only-the-marked-copy pattern are in the `watermark` skill.

## Previewing a PDF

`transform` cannot read a PDF — Cloudflare Images only ingests image formats. To render a
page of an uploaded PDF to an image (a document thumbnail, say), use `createImage(env).fromPdf`
— see the `pdf-preview` skill.
