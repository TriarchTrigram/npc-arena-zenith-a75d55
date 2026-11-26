---
name: stock-photos
description: When a real photograph beats a generated image and how to find, place and credit one with `searchStockPhotos` and `placeStockPhoto` (Unsplash; Stencil's photo library first for sample data). Load before filling any photo slot — people, places, food, products in use, nature.
allowed-tools: searchStockPhotos placeStockPhoto
metadata:
  agents: [builder]
---

# Stock photos

Real-world subjects get real photographs. Generated photography of people, places and products is the most recognisable "AI-made" look a page can have; a well-chosen editorial photo is not. Two tools, both server-side (the app never talks to Unsplash):

- `searchStockPhotos` — one query, up to 10 candidates, each with a thumbnail you can look at. With `sampleData: true`, for seeded sample rows only, Stencil's own photo library comes first (`from: "library"`, ids `library:<subject>/<NN>`, a curated `alt` and `tone`, no thumbnail) and Unsplash fills the rest.
- `placeStockPhoto` — the photo you chose, by id. It records the use in the app's files (`unsplash/photos.json`), and with Unsplash for an Unsplash photo, and returns the `src`, `alt`, `credit`, `width` and `height` to pass to the component below.

For sample rows, **prefer a library photo when it fits the row as well as an Unsplash one would**: it costs none of the platform's hourly Unsplash allowance. The app's own pages (heroes, sections, cards) never pass `sampleData`.

**The only way a stock photo enters an app is `placeStockPhoto` → `<UnsplashPhoto>`.** Never hand-type an `unsplash.com` or `images.unsplash.com` URL, never download a photo into `/assets/`, never paste a URL from a search result into code without placing it first: the placement call is what Unsplash's terms require.

## Photo or generated?

| Slot | Source |
|---|---|
| People doing the thing the app is about, places, interiors, landscapes, food, products in use, materials and textures from nature | **photo** |
| Brand marks, icons, illustrations, on-brand abstract art, empty-state art, backgrounds that must match the palette exactly, anything with the app's own UI in it | **generated** (`generate-image` skill) |
| A specific object that does not exist (the app's own product, a mascot) | **generated** |

When in doubt: could a photographer have shot it? Then photo.

## Writing a search that finds an editorial photo, not stock

Unsplash is full of generic stock. Search like a photo editor: name a **concrete subject** doing something, a **setting**, the **light**, and a **mood**. Three to eight words usually beats a sentence.

- ❌ `business people meeting` → ✅ `two women reviewing printed plans at a workshop bench, window light`
- ❌ `fitness` → ✅ `runner tying shoes on wet pavement at dawn`
- ❌ `coffee` → ✅ `barista pouring latte art, dark counter, overhead`
- ❌ `technology` → ✅ `hands soldering a circuit board under a desk lamp`

Avoid the clichés that read as stock on sight: handshakes, laptops on empty desks, pointing at whiteboards, thumbs up, posed smiles at the camera, stacked coins, generic skylines.

Use `orientation` for the slot's shape (`landscape` hero, `portrait` tall card, `squarish` tile) and `color` when the set needs to sit on the palette (`black_and_white`, `teal`, `orange`, …). Ask for 6 candidates (the default); 10 only for a hero.

**One search per slot.** Searches are rate-limited for the whole platform. Write the query well, pick from what comes back, and move on. A second search for the same slot is allowed only when nothing returned fits; a third is not — use `generateImage`.

## Choosing: look at the thumbnails

The thumbnails are numbered like the list. Judge them as a set, not one at a time:

- **One look across the page**: the same kind of light (all natural daylight, or all moody tungsten), a palette that sits with the `Brand:` line, similar treatment (all candid, or all still-life). Reject the outlier even if it is the best single picture.
- **Composition fits the slot**: a hero wants negative space where the headline goes; a card wants a clear subject that survives a crop.
- **Specific over generic**: a real place with texture beats a clean, anonymous one.
- **The `alt` the tool returns** is Unsplash's description; rewrite it for the page when it is vague or wrong.

## Placing and crediting

```tsx
import { UnsplashPhoto, UnsplashCredits } from "~stencil/ui/photo/unsplash";

// values exactly as placeStockPhoto returned them
<UnsplashPhoto
  src={HERO.src}
  alt="Ceramicist trimming a bowl at the wheel in a sunlit studio"
  credit={HERO.credit}
  ratio="16/9"
  priority
  className="rounded-2xl"
/>
```

- `src` and `credit` are the tool's values, verbatim. Keep them in a `const` near the top of the file (`const HERO = { src: "…", credit: { … } }`). A library photo's credit has no `photographerUrl` and names its `source` (`unsplash`, `pexels` or `public-domain`); the component credits each source in its own words.
- `ratio` crops to the slot (`16/9`, `4/3`, `1/1`, `3/4`); omit it to keep the photo's own shape. The component builds the `srcset`, `auto=format`, quality and crop for you — never add image parameters yourself.
- `priority` on the hero and anything visible on load; everything below the fold stays lazy (the default).
- `sizes` when the photo is not full-width: `"(min-width: 768px) 50vw, 100vw"` for a half-width card, `"(min-width: 1024px) 33vw, 100vw"` for a third.
- `alt` is required and describes the picture, not the brand.

**Credits.** A photo's credit shows on hover (the default) and in one `<UnsplashCredits />` line (no props) in the page footer, which the platform renders at the end of the page when the page does not place it. Never put a permanent caption on a photo; `caption="always"` is for an app builder who asks for it. A decorative photo (background at reduced opacity, texture, colour wash) may take `caption="none"`; it is still named in the footer line. The hover caption reads "Photo by <photographer> on Unsplash" with both links; it also shows on keyboard focus, and its links stay in the page at all times, so the credit is there for assistive technology and crawlers. The footer line takes no props and names every photo on the page once:

```tsx
<UnsplashCredits className="mt-6" />
```

Every displayed photo is credited both ways. The design rule that never hides a control behind hover does not apply here: the credit is not a control, and the footer line is its always-visible form, so do not switch a photo to `caption="always"` to satisfy that rule. Placing `<UnsplashCredits>` yourself puts the line where the layout wants it, so attribution never depends on you remembering it. Pass `credits={[…]}` only to name a set of your own.

## When the tool says no

Any error — a `rate limit` (the platform's hourly Unsplash allowance is spent), a refused key, or a call that simply failed — or no candidate that fits, means that slot has no stock photo right now. Sample-data searches are the exception: the library still answers them, so keep searching the next rows with `sampleData: true`. Do **not** retry and do **not** wait: call `generateImage` for that slot with the `generate-image` skill's craft rules, and say in your reply that the slot got a generated image because stock photos were unavailable. The build still succeeds, and the slot is never left empty.
