---
name: document-reading
description: Reading what is inside a file an app user uploads — the text of a PDF or text file, the words in a photo, screenshot or scanned page, and pulling fields out of an invoice, receipt, form, test result, plan, report or brand guide as records (amounts, dates, names, line items). Uses createAI(env).readDocument from ~stencil/ai (keyless, server-side; a PDF or picture goes through the app's AI, a text file is read in place). Load whenever a brief wants the app to "read", "scan", "extract", "pull out", "import from", "summarise" or "use as input" an uploaded document or picture, or an AI feature should know what an uploaded file says. Do NOT install pdf-parse, pdfjs-dist, pdf-lib, mammoth, docx, jszip, tesseract.js or any PDF, Word or OCR library — they cannot run on Cloudflare Workers, and a hand-written reader costs the app builder builds to maintain. Word files (.docx) and spreadsheets (CSV, Excel) are not read yet: say so plainly. Not for turning a PDF page into a picture (the pdf-preview skill).
metadata:
  agents: [chat, builder]
---

# Reading uploaded documents

`createAI(env).readDocument(params)` from `~stencil/ai` reads an upload the app has — a PDF,
a photo or screenshot, a scanned page, a text or Markdown file — and returns either its plain
text or the fields a Zod schema names. No API keys. **Server-side only** — loaders, actions or
scheduled handlers, never the browser.

Storing and serving the file is the **`storage`** skill; this is the step after it. A PDF
page as a picture (a thumbnail) is the **`pdf-preview`** skill; a transcript of speech is
`ai.transcribe` in the **`ai-sdk`** skill.

**Not read yet: Word files (`.docx`, `.doc`, `.odt`, `.rtf`) and spreadsheets (CSV, Excel).**
Tell the app builder so plainly, in the plan and in the app's own copy, and offer the nearest
thing: ask app users for a PDF (every word processor and spreadsheet exports one) or a picture.
Never parse one by hand or with a library.

## Do not install a PDF, Word or OCR library

The app deploys to Cloudflare Workers. `pdf-parse`, `pdfjs-dist`, `pdf-lib`, `mammoth`,
`docx`, `jszip`, `tesseract.js` and anything that loads a native binary or a multi-megabyte
model either fail to load there or run against the platform's rules, and every one of them
is a reader nobody else maintains. There is exactly one supported path: `readDocument`.
Reach for it instead of a `/api/parse-pdf` route built on a library, a browser-side parser,
or a `generateText` call with a hand-assembled file part.

## API

```ts
import { createAI } from "~stencil/ai";
const ai = createAI(context.cloudflare.env);

// The plain text
const { text, legibility, kind } = await ai.readDocument({ file: { key }, feature: "notes-import" });

// The fields a schema names
const { fields, legibility } = await ai.readDocument({ file, schema: Invoice, feature: "invoice-scan" });
```

| Param | What it is |
|---|---|
| `file` | A `File`/`Blob` from a form, raw bytes, or `{ key }` for a file already in the app's storage — pass the key rather than reading the object yourself. |
| `schema` | Optional Zod schema of the fields wanted. Without it the result is `text`; with it, `fields`. The `ai-sdk` skill's **schema rules** apply: no `.min()`/`.max()`, at most 16 nullable or union fields and at most 24 optional fields, and a field is required when the document always has it. |
| `instructions` | Optional plain-words guidance added to the standard prompt: *"the total is the line marked Total due"*, *"dates are day/month/year"*, *"ignore the cover page"*. |
| `contentType` | Only when the bytes cannot say what the file is (a `.txt` with no type). A `File` or a stored object carries its own. |
| `model` | The model that reads a PDF or picture; Haiku 5.5 unless the document needs more. |
| `feature` | The in-app feature on the Usage page, e.g. `"invoice-scan"`. Always pass one. |

The result always carries `kind` (`"pdf" | "image" | "text"`) and `legibility`: `"all"` when
every word was readable, `"partly"` when some words or areas were not (a faint scan, a
cropped photo, a handwritten margin), `"none"` when there is no readable text (a blank or
illegible page). A text file is read in the Worker with no model call and is always `"all"`
(or `"none"` when empty).

It throws, with a plain reason, for a file over 20 MB, a type it does not read (a Word file,
a spreadsheet, a HEIC photo), or a missing key. Catch it in the action and show the reason, as
the `ai-sdk` skill's **Never swallow a failed call** says.

## Read once, after the upload, and keep the result on the row

Reading costs a model call for a PDF or picture, so do it in the action that saves the
upload's key (or in a "Read this file" action), store what came back in D1 with the record,
and never read on a page view. The screen uploads through `uploadFile` (the `storage` skill)
and posts the key:

```ts
// app/routes/api.read-invoice.tsx — resource route
import type { Route } from "./+types/api.read-invoice";
import { z } from "zod";
import { createAI } from "~stencil/ai";
import { data } from "~stencil/data";

const Invoice = z.object({
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  issuedOn: z.string().optional().describe("The issue date as YYYY-MM-DD"),
  total: z.number().optional().describe("The amount due after tax"),
  currency: z.string().optional().describe("ISO 4217 code, e.g. USD"),
  lines: z.array(z.object({ description: z.string(), amount: z.number().optional() })),
});

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = await data(request, env);
  const form = await request.formData();
  const fileKey = String(form.get("key")); // from uploadFile in the screen
  try {
    const { fields, legibility } = await createAI(env).readDocument({
      file: { key: fileKey },
      schema: Invoice,
      instructions: "The total is the amount due after tax, not the subtotal.",
      feature: "invoice-scan",
    });
    const invoice = await db.from("invoices").create({
      fileKey,
      ...fields,
      lines: JSON.stringify(fields.lines),
      needsReview: legibility !== "all",
    });
    return { ok: true as const, invoice, legibility };
  } catch (error) {
    console.error("invoice scan failed", error);
    return { ok: false as const, error: "Couldn't read that file — try a clearer scan or a PDF." };
  }
}
```

The upload route's `accept` lists what the reader takes:
`["application/pdf", "image/*", "text/plain"]`. Do not list Word or spreadsheet types: a file
the reader cannot take should be refused at the upload, with the copy saying "PDF or picture".

**The plain text as AI input.** When an AI feature should know what a file says (a brand
voice guide, a knowledge base, a client's notes), read it once with no schema when the file
is saved and store `text` on the row; every later call puts that text in its prompt. Do not
send the file to the model again on each question.

## A read is a draft until a person has seen it

The model reads well, but a `7` can be a `1` on a faint scan and a total can be the
subtotal. Whenever the fields are money, dates, identifiers or anything the app acts on,
show them in an editable form before saving — the same shape as a transcript correction —
and mark the row when `legibility` is not `"all"`:

- `"partly"` → show "Some of this file couldn't be read — check the fields" above the form.
- `"none"` → do not save fields; tell the person the file has no readable text and ask for a
  clearer scan or a PDF.

Never show a read as a finished record with nothing to check. A wrong number saved silently
is the failure nobody finds.

## Limits, cost and what to say

- **Size and length.** 20 MB per file; a PDF is read as a whole, up to about 100 pages. A
  picture is downscaled before it is sent, so a phone photo needs no resizing by the app.
- **Cost.** A PDF or picture is one model call on the app builder's AI usage, under
  `feature`. A text file costs nothing. Guard a feature app users can press repeatedly with
  an allowance (the `ai-sdk` skill's **Free uses, quotas and limits**).
- **Long documents.** Ask for `schema` fields rather than the whole `text` of a 60-page
  report, or read the text once and store it. A whole-text read of a very long PDF can hit
  the reply's output cap (`AIOutputLimitError`): that is the signal to ask for fields.
- **Not read yet.** Word files (`.docx`, `.doc`, `.odt`, `.rtf`), spreadsheets (CSV, Excel)
  and HEIC photos. Tell the app builder plainly, and offer the nearest thing: ask app users
  for a PDF, or a JPEG for a photo.
- **Scanned pages and photos of documents** are read as pictures — the model reads the words
  off the picture. A multi-page scan saved as a PDF is read as a PDF.

## Checklist

- Every read goes through `createAI(env).readDocument` in a loader/action — no npm PDF,
  Word or OCR library, nothing in the browser.
- `file` is `{ key }` for a stored upload (the `storage` skill's upload paths) or the `File`
  from a form; `feature` is set on every call.
- Fields come from a `schema` that follows the `ai-sdk` skill's schema rules; the plain text
  comes from a call with no schema.
- Read once after the upload and store the result on the row; never on a page view.
- `legibility` reaches the screen: a review form for fields the app acts on, a plain
  message for `"none"`.
- A thrown error is shown to the person who uploaded, with the reason.
- Word files and spreadsheets are named as not read yet, in the plan and in the app's copy.
