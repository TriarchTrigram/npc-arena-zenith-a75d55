---
name: file-export
description: Handing an app user a file — a "Download" or "Export" button, a "Download all", CSV or spreadsheet export, saving a generated image or canvas, saving or sharing several browser-made images at once (a story set, a batch of cards, "save all to my phone"), serving a stored file (an upload, a finished video render) as a download, or relaying a file that lives on another host (a render provider, a connected service) as a download, or a row the app sends to a Google Sheet (a form answer, a sign-up, a record copied to the app builder's sheet). Load before wiring any download, export or sheet row, before touching code that imports `~stencil/files`, and for fixes — a download that does nothing, the wrong file type, "download all" saving only the first or only the last file, Chrome saying it will block a download, a file that won't open in Excel or doesn't match the preview. Never hand-roll CSV escaping, MIME types, Content-Disposition, or blob-anchor code. For printable documents (invoice, report) see `print-to-pdf`.
metadata:
  agents: [chat, builder]
---

# File export & downloads

`~stencil/files` is the one supported path for handing an app user a finished file. Every
helper derives the Content-Type from the filename's extension and builds the download
headers correctly — hand-rolled versions of any of this (CSV string-joins, MIME lookup
tables, blob-anchor snippets) are bugs waiting to be re-found; don't write them.

## Pick the path

| The file is… | Use |
| --- | --- |
| Tabular data — records, a report, "export my data" | `toCsv(rows)` → `fileResponse` in a resource route |
| Generated or fetched on the server — AI output, a transformed image | `fileResponse(bytes, "name.ext")` |
| Already in R2 — an upload, a finished video render | `serveR2Object(storage, key, request, { downloadAs: "name.ext" })` |
| On another host — a render provider, a connected service's URL | `downloadResponse(url, "name.ext", { hosts })` in a resource route |
| Generated in the browser — a canvas, composed text | `saveFile(data, "name.ext")` |
| Many stored files at once — an album's photos, every file in a vault, "Download all" | `zipResponse(storage, files, "name.zip")` in a resource route (see below) |
| Several files generated in the browser — a story set, a batch of cards | `saveFiles(files)` from one click (see below) |
| The same set, into the phone's Photos or another app | `shareFiles(files)` — the `share-to-apps` skill |
| Tabular data built in the browser — rows already on screen, a filtered view | `toCsv(rows)` → `saveFile(csv, "name.csv")` |
| Rows sent to a Google Sheet — a form answer, a record copied to the app builder's sheet | `sheetText(value)` on every string cell before it leaves the app |
| A printable document — invoice, receipt, report, ticket | Compose HTML and use the `print-to-pdf` skill; the browser's own print dialog saves the PDF |

Prefer the server rows: a download served with `Content-Disposition` behaves identically
in every browser and needs no client code beyond a plain `<a href>`. Reach for `saveFile`
only when the bytes genuinely originate in the browser.

## Spreadsheet / CSV export

```tsx
// app/routes/api.export-contacts.tsx — register route("api/export-contacts", ...)
import type { Route } from "./+types/api.export-contacts";
import { requireAuth } from "~stencil/auth/server";
import { createDb } from "~stencil/db";
import { toCsv, fileResponse } from "~stencil/files";
import { contacts } from "~/generated/db-schema";
import { eq } from "drizzle-orm";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const rows = await db.select().from(contacts).where(eq(contacts.createdBy, user.id));

  return fileResponse(
    toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "createdAt", label: "Added" },
    ]),
    "contacts.csv",
  );
}
```

The download button is a plain anchor — never `fetch` the route and re-save the bytes:

```tsx
<Button asChild>
  <a href="/api/export-contacts">Export CSV</a>
</Button>
```

What `toCsv` settles so you don't have to:

- **Formula injection is neutralised.** A text cell starting with `=`, `+`, `-`, `@`, a tab
  or a carriage return would be executed as a formula by Excel and Google Sheets — a
  security hole when the cell came from app-user input. `toCsv` prefixes those with an
  apostrophe. Never bypass it with hand-joined strings, never re-implement the guard with a
  shorter character list, and never strip the apostrophes back out.
- Excel-friendly output: UTF-8 BOM (accents decode correctly), CRLF lines, RFC 4180 quoting.
- Columns default to every key across the rows; pass `columns` to control order and headers.

### CSV built in the browser

When the rows are already on screen — a filtered table, the cards the app user can see —
`toCsv` runs in the browser too. The only thing that changes is the save:

```tsx
import { toCsv, saveFile } from "~stencil/files";

function exportVisible(rows: Contact[]) {
  saveFile(toCsv(rows, ["name", "email", "note"]), "visible-contacts.csv");
}
```

Call it from a click handler, never during render. `rows.map((r) => r.join(",")).join("\n")`
handed to `saveFile` is the hand-rolled writer this skill exists to prevent: it has no
formula guard, no quoting and no BOM.

## Rows sent to a Google Sheet

A row the app appends to the app builder's Google Sheet — a contact form, a sign-up, a
record copied over through the Sheets API, an Apps Script web app or a webhook — is a
spreadsheet cell with no file in between, and Sheets runs a leading `=` as a formula the
moment the row lands. Anyone who can submit the form can plant one. Pass every string
through `sheetText` before it leaves the app, except on a Sheets API call that stores values
as `RAW` (see below):

```ts
import { sheetText } from "~stencil/files";
import { secret } from "~stencil/secrets";

const webhookUrl = secret(env, "GOOGLE_SHEETS_WEBHOOK_URL");
if (!webhookUrl) {
  return Response.json(
    { error: "The Google Sheet isn't connected yet — add GOOGLE_SHEETS_WEBHOOK_URL in More → Settings → Secrets." },
    { status: 503 },
  );
}
await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: sheetText(form.name),
    email: sheetText(form.email),
    message: sheetText(form.message),
  }),
});
```

`secret` returns `undefined` until the app builder sets the value, so read it into a const
and return early; passing the call straight to `fetch` does not typecheck.

Numbers and dates go through untouched; only strings are guarded. The guard belongs
wherever Sheets would parse the value as typed: a webhook, an Apps Script web app, a CSV
import, or a Sheets API call with `valueInputOption: "USER_ENTERED"`. When the app calls the
Sheets API directly, use `valueInputOption: "RAW"` and pass the string as is: `RAW` already
stores it as plain text, and the apostrophe `sheetText` adds would show in the cell.

CSV opens in Excel, Numbers, and Google Sheets — it is the supported spreadsheet export.
Generating real `.xlsx` is not a platform capability; don't install spreadsheet libraries
to fake it.

## Delivering a stored artifact

Anything already in the app's R2 — an upload, or the finished `key` from a video render —
becomes a download by serving it with a filename:

```ts
return serveR2Object(storage, video.r2Key, request, { downloadAs: `${video.title}.mp4` });
```

A "Download video" button is an anchor pointing at that route. Omit `downloadAs` when the
route feeds an inline `<video>`/`<img>` — the option exists for the take-away copy.

### Download all: many stored files as one zip

"Download all", "Save photos", "Download this speaker's files": one resource route returning
`zipResponse` from `~stencil/storage`. It streams the stored files into a zip without holding
them in memory, keeps every name unique and safe to unpack, and sets the download headers.
Never write a zip maker or install a zip library (`jszip`, `fflate`, `archiver`) for this.

```ts
// app/routes/albums.$id.download.tsx — register route("albums/:id/download", ...)
import type { Route } from "./+types/albums.$id.download";
import { requireAuth } from "~stencil/auth/server";
import { createDb } from "~stencil/db";
import { createStorage, zipResponse } from "~stencil/storage";
import { albums, photos } from "~/generated/db-schema";
import { and, eq } from "drizzle-orm";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const db = createDb(env);
  const [album] = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, params.id), eq(albums.createdBy, user.id)));
  if (!album) throw new Response("Not found", { status: 404 });
  const rows = await db.select().from(photos).where(eq(photos.albumId, album.id));

  return zipResponse(
    createStorage(env),
    rows.map((photo) => ({ key: photo.fileKey, name: photo.originalName })),
    `${album.title}.zip`,
  );
}
```

```tsx
<Button asChild>
  <a href={`/albums/${album.id}/download`}>Download all ({photos.length})</a>
</Button>
```

- **The route is the access check.** Load the records exactly as the page that lists them
  does (same sign-in, same owner or share-link rule) and pass only those files. Never take
  storage keys from the query string or a form.
- **Zip what the app user sees.** Build the list from the same query as the screen. Anything
  on screen that is not stored yet (an unsaved design, a canvas) is saved first, or it is
  missing from the zip.
- `key` takes what the record holds: a stored key or its `/api/files/...` URL. `name` is
  the name inside the zip — the original file name, or `${speaker.name}/${file.name}` for
  folders. Two files with the same name become `photo.jpg` and `photo (2).jpg`.
- **Limits**: 400 files and 2 GB per zip by default; over either the route answers 413 before
  sending anything. For a bigger set, split the download (per day, per folder, per 400) and
  show the count on each button. The fourth argument `{ maxFiles, maxBytes }` lowers either
  limit, or raises `maxBytes` up to 4 GB; don't raise `maxFiles`, since every file costs
  two storage reads out of the request's budget.
- **The button is a plain anchor**, never a `fetch` that re-saves a blob: the browser shows
  its own progress with the full size, on a phone as well as a computer.
- On a phone a zip lands in Files, not the camera roll. For photos keep a per-photo save or
  the share sheet (`shareFiles`, below) beside Download all.

## Downloading a file from another host

Browsers ignore the `download` attribute on a cross-origin `<a>`, so a link straight at a
provider URL navigates or opens a tab instead of saving. Any file the app did not serve
itself goes through the app — a resource route fetches it server-side and streams it back
same-origin with `downloadResponse`:

```tsx
// app/routes/download.$id.tsx — register route("download/:id", ...)
import type { Route } from "./+types/download.$id";
import { requireAuth } from "~stencil/auth/server";
import { createDb } from "~stencil/db";
import { downloadResponse } from "~stencil/files";
import { renders } from "~/generated/db-schema";
import { and, eq } from "drizzle-orm";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const [file] = await db
    .select()
    .from(renders)
    .where(and(eq(renders.id, params.id), eq(renders.createdBy, user.id)));
  if (!file) return new Response("Not found", { status: 404 });

  return downloadResponse(file.url, `${file.title}.pdf`, {
    hosts: ["renders.example-provider.com"],
  });
}
```

The download button is a plain anchor at `/download/${file.id}`.

- **`hosts` is required and stays narrow.** List the app's own known hosts — its render
  provider, its storage bucket's public host — as exact names or `*.` wildcards. It is what
  keeps the route from being an open proxy: never derive it from the request or from the
  stored URL itself.
- **One app-user click → one gesture.** For "Download all" of files the app serves, give each
  file its own anchor or serve one zip with `zipResponse` (above); for files built in the
  browser call `saveFiles` (below). Never loop clicks or form posts on a timer, never post the bytes
  through a hidden frame, never zip in the browser: a timer leaves the click's permission
  so Chrome drops every download after the first, a shared frame cancels each request
  when the next starts so only the last file lands, and Chrome flags a zip saved from a
  blob address as a dangerous download.
- Files already in the app's own R2 keep using `serveR2Object`; `downloadResponse` is only
  for files on a host the app doesn't serve.
- A picture address an app user pasted is not a download and never goes through this relay:
  copy it into storage once with `storeImageFromUrl` (the `storage` skill) and serve the copy.

## Saving client-generated files

```tsx
import { saveFile } from "~stencil/files";

async function downloadCard(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Canvas export failed");
  saveFile(blob, "card.png");
}
```

`saveFile` is browser-only: call it from an event handler, never during render or SSR.

### Several files from one click

A set the app drew itself — four story slides, a batch of cards — saves in one go with
`saveFiles`. Build the `File`s when the images render, before the click, and call it with no
`await` in between: every save then fires inside the same click, so Chrome asks once to
"download multiple files" and saves them all after Allow, while Safari and Firefox save
each straight away.

```tsx
import { saveFiles, toFile } from "~stencil/files";

// Built once, when the slides render; the click handlers have nothing to await.
const files = useMemo(
  () => slideBlobs.map((blob, i) => toFile(blob, `story-${i + 1}.png`)),
  [slideBlobs],
);

<Button onClick={() => saveFiles(files)}>Download all</Button>
```

On a phone a download lands in Files, not Photos. When the app user wants the images in
their camera roll or in another app, show **Save to Photos** / **Share** where
`canShareFiles(files)` is true and call `shareFiles(files)` from the tap — it opens the
share sheet with every image attached (Save Image saves them all) and falls back to
`saveFiles` where sharing is unsupported. The `share-to-apps` skill has the button, the
copy and the Instagram caveats. Keep Download all beside it on every device.

Do not branch on the device or the browser, open a hidden frame, post the bytes back to
the app to re-download them, or build a zip in the browser — each of these loses files
or trips a browser guard; the two helpers are the whole answer. A real zip of stored
files is a server route returning `zipResponse`, not a browser job.

When the app draws the exported image itself (a canvas of creatives, cards, slides), the
recurring bugs live upstream of the save — settle each the same way every time:

- **Wait for webfonts**: `await document.fonts.ready` before drawing text to the canvas,
  or the export renders in fallback glyphs while the preview looked right.
- **Explicit output size**: set the canvas `width`/`height` to the intended pixel
  dimensions (× `devicePixelRatio` for sharp output) — never whatever the viewport gave you.
- **Name matches encoder**: `canvas.toBlob(cb, "image/png")` → `.png`. Don't label a PNG
  `.jpg`; `saveFile` derives the MIME type from the extension you pass.
- **Show state**: disable the button and show a spinner while generating, and a clear done
  signal after — the save itself fires no event the app can observe.

## Printable documents

For a document the app user keeps on paper or as a PDF — invoices, receipts, reports,
certificates, tickets — compose it as ordinary HTML + Tailwind and use the print pattern
from the `print-to-pdf` skill. The browser's print dialog does the PDF making, with page
sizes, fonts, and pagination handled by the layout engine.

Do **not** hand-draw documents: no jsPDF or canvas page geometry, no manual font
embedding, no laying out lines in point coordinates. There is no server-side PDF
*generator* on the platform; `createImage(env).fromPdf` (the `pdf-preview` skill) goes the
other way — it rasterises an existing PDF into an image.
