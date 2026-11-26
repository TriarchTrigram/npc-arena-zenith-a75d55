---
name: runtime-image-generation
description: Generating images AT RUNTIME from user input — an avatar maker, an "illustrate my note" button, an AI art tool, anywhere the running app must create an image on demand. Uses createImage from ~stencil/image (Cloudflare Workers AI, keyless, server-side). Load when the brief asks the app to generate images WHILE RUNNING in response to user input. NOT for static build-time assets (heroes, logos, backgrounds, textures) — those are drawn at build time with the generate-image skill, not this.
allowed-tools: createEntity
metadata:
  agents: [chat, builder]
---

# Runtime image generation

`createImage(env)` from `~stencil/image` turns a text prompt into an image at request
time, proxied through the Stencil backend (Cloudflare Workers AI). No API keys.
**Server-side only** — loaders, actions, or scheduled handlers, never the browser.

Use this **only** when the app must generate an image in response to user input
while running (avatar generators, "illustrate this" buttons, AI art features). For
static assets baked into the design at build time — hero images, logos,
backgrounds, textures — the Builder Agent draws them with the `generate-image`
skill instead. Don't wire this in unless the brief asks for runtime generation.

## API

```ts
const { body, contentType } = await createImage(env).generate({ prompt, model });
```

- `prompt` (required) — what to draw.
- `model` (optional) — any Cloudflare Workers AI text-to-image model **id**.
  Defaults to `@cf/black-forest-labs/flux-1-schnell`. OpenAI's `gpt-image-2.5-sunburst` and
  Google's `gemini-3.1-flash-image` also work but cost significantly more per
  image — only pass one if the app builder specifically asks for that provider;
  otherwise stay on the default.
- A model id the provider no longer serves fails with `Image model "<id>" is not available
  through Stencil` (HTTP 400). Switch the model; do not retry it or treat it as an outage.
- `references` (optional) — up to 6 pictures the model should match (raw bytes, a base64
  string or a data URL, under 10 MB each and under 40 MB together). Only the Gemini image
  models and FLUX.2 (`@cf/black-forest-labs/flux-2-*`) accept them; any other model
  answers 400. The order is kept as passed.

Returns the image as a byte **stream** (`body`) plus the `contentType` the model
produced — pipe it straight into R2, never buffered in the worker.

### When the model refuses a prompt

Every image model runs prompts through a safety filter, and it refuses some
ordinary prompts — in practice, scenes that describe people, children's storybook
scenes included. A refusal is not an outage: the same prompt is refused every time, so a retry changes
nothing. `generate()` throws `ImageRefusedError` (from `~stencil/image`) for it, and
a plain `Error` for everything else. Catch them apart:

```ts
import { createImage, ImageRefusedError } from "~stencil/image";

try {
  const { body, contentType } = await createImage(env).generate({ prompt });
  // ...store it
} catch (error) {
  if (error instanceof ImageRefusedError) {
    console.warn("illustration refused", error.message);
    return { ok: false as const, error: "That description couldn't be drawn — try describing the scene differently." };
  }
  console.error("illustration failed", error);
  return { ok: false as const, error: "Couldn't draw this right now — please try again." };
}
```

- Show the refusal message next to the control, and let the person reword the
  prompt. Keep the provider's wording out of the UI.
- Log a refusal with `console.warn`, never `console.error`: it is not a bug in the
  app, and nothing in the code fixes it.
- Do not retry a refused prompt on another model or with a reshuffled prompt on
  your own. Routing around the filter is the app builder's call, not the app's —
  if they ask for it, pass `model` on the retry so the choice is visible in code.

### Recommended models

Pass the model's full id — any Workers AI text-to-image model works (see the
Cloudflare Workers AI models catalog for the full list):

| model id | notes |
|---|---|
| `@cf/black-forest-labs/flux-1-schnell` | Default. Fast, high quality, strong prompt adherence. |

Stick with the default unless the brief wants a specific look. Stable Diffusion XL
(`@cf/stabilityai/stable-diffusion-xl-base-1.0`, `@cf/bytedance/stable-diffusion-xl-lightning`)
is retired at Cloudflare and answers 400, so never pass either id. When an app builder asks
for "SDXL" by name, do not swap models silently: tell them SDXL was retired, offer the default
(FLUX.1 Schnell) as the supported replacement, and only then build with it.

### Keep one character or style across many images

When the app must draw the **same person, mascot or product** on every picture, or
match one art style throughout (a personalised storybook, a brand mascot, product
shots), a text description alone drifts from image to image. Pass the photo and/or a
style frame as `references` with a Gemini image model:

```ts
const { body, contentType } = await createImage(env).generate({
  prompt: "Page 4: Mia feeds the ducks at the pond, watercolor",
  model: "gemini-3.1-flash-image",
  references: [childPhotoBytes, styleFrameBytes], // max 6, under 40 MB together
});
```

Read the reference bytes from the app's storage (`createStorage(env).get(key)`) or
from the upload in the request. Gemini costs more per image than the default, so
reach for this only when consistency across pictures is the point of the feature.

OpenAI (`gpt-image-2.5-sunburst`) and Google (`gemini-3.1-flash-image`) are also reachable
through the same `model` param, but each costs significantly more per image than
the Workers AI default — only pass one when the app builder asks for that
provider by name. DALL·E is retired at OpenAI: an app builder who asks for
"DALL·E" gets `gpt-image-2.5-sunburst`.

## Store in R2, keep the key in D1

Never hold image bytes in the database. Write them to R2 with `createStorage`,
store only the returned key, and serve them from your own resource route.

```ts
// app/routes/api.generate-avatar.tsx  (register in app/routes.ts)
import type { Route } from "./+types/api.generate-avatar";
import { createImage } from "~stencil/image";
import { createStorage } from "~stencil/storage";
import { createDb } from "~stencil/db";
import { requireAuth } from "~stencil/auth/server";
import { avatars } from "~/generated/db-schema";

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const { prompt } = await request.json<{ prompt: string }>();

  const { body, contentType } = await createImage(env).generate({ prompt });

  // Pipe the stream straight into R2 — the bytes are never buffered in the worker.
  const key = `avatars/${user.id}/${crypto.randomUUID()}`;
  await createStorage(env).put(key, body, { httpMetadata: { contentType } });

  const db = createDb(env);
  const now = new Date().toISOString();
  await db.insert(avatars).values({
    id: crypto.randomUUID(),
    createdBy: user.id,
    imageKey: key,
    createdAt: now,
  });

  return Response.json({ key });
}
```

## Serve the stored image

R2 keys are not public URLs. Serve the bytes through your own resource route so
access stays under your control, and end it in `serveR2Object`: it shows pictures
inline, downloads any other stored file, and turns type guessing off. Never return
the object yourself with its stored type (see the `storage` skill, *Custom serving routes*):

```ts
// app/routes/img.$.tsx  →  register as route("img/*", "routes/img.$.tsx")
import type { Route } from "./+types/img.$";
import { createStorage, serveR2Object } from "~stencil/storage";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });
  return serveR2Object(createStorage(context.cloudflare.env), key, request);
}
```

Then reference it as `/img/<key>` in an `<img>` (always with `alt`, `width`, `height`).

## Rules

- **Server-side only** — call it in a loader / action / scheduled handler. Never
  from the browser or a `useEffect`.
- **Pipe the stream into R2, store only the key in D1** — never image bytes in D1.
- Add an entity (via `createEntity`) to hold the key + owner if the
  generated images need to persist and list per user.
- Generate on an explicit user action; a diffusion call takes a few seconds, so
  show a pending state and don't block a page's initial render on it.
- Catch `ImageRefusedError` apart from other failures and show the person a
  message they can act on (see "When the model refuses a prompt").
