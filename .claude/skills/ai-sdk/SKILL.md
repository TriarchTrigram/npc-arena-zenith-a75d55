---
name: ai-sdk
description: Use when writing or editing AI features — useChat, streamText, generateText, generateObject, embed, transcribe (speech or video to text), readDocument (the text or fields of an uploaded PDF, picture or text file; the document-reading skill has the recipe), chat persistence, tool calls, rendering a model's answer on screen (it is Markdown), and any free-use allowance, quota or usage limit on an AI feature (N free prompts, then upgrade). Covers the correct @ai-sdk/react v3 / ai v6 API, and the Zod schema rules for generateObject (no .min/.max constraints — Anthropic rejects them, e.g. "'minItems' values other than 0 or 1 are not supported" — at most 16 nullable or union fields and at most 24 optional fields per schema).
allowed-tools: createEntity
metadata:
  agents: [chat, builder]
---

# AI SDK Reference (`ai` v6 / `@ai-sdk/react` v3)

## Setup

`createAI` from `~stencil/ai` returns a provider registry. Server-side only. No API keys needed.

```ts
import { createAI } from "~stencil/ai";
const ai = createAI(context.cloudflare.env);
```

## What an app's AI can do

Every call goes through Stencil's AI gateway, which serves a fixed list of routes. Take the answer from this table, never from the provider SDK or a probe: the SDK ships factories (`transcriptionModel`, `speechModel`, `imageModel`) whose requests the gateway does not serve, so they would type-check and then fail at runtime with a 404 the app user sees as a broken feature — `createAI` leaves them off its type for that reason.

| Need | Served | Use |
|---|---|---|
| Chat, writing, classification | yes | `ai.languageModel(...)` with `streamText` / `generateText` (Model IDs below) |
| Structured output | yes | `generateObject` / `Output` with a Zod schema (Structured output below) |
| Reading an uploaded document or picture — the text of a PDF or text file, the words in a photo, screenshot or scan, fields out of an invoice or form | yes | `ai.readDocument` (Reading uploaded documents below; the `document-reading` skill has the recipe) |
| Reading a Word file (.docx) or a spreadsheet (CSV, Excel) | **no** — not yet | say so plainly; ask app users for a PDF instead |
| A picture inside a chat or a custom vision call | yes | an `{ type: "image" }` part in a `languageModel` message, downscaled first (`image-transform` skill) |
| Embeddings and search by meaning | yes | `ai.textEmbeddingModel("openai:text-embedding-3-small")` + `nearestRecords` (Embeddings below) |
| Speech to text | yes | `ai.transcribe` (Speech to text below); a whole video is the `captions` media job |
| Generating an image | yes | `createImage(env)` from `~stencil/image` (`runtime-image-generation` skill), never an image model through `ai` |
| Live dictation as someone speaks | browser | the `voice-input` skill (`SpeechRecognition`), not the gateway |
| Text to speech (read aloud, a spoken reply, an audio version of a post) | yes | `createAudio(env).speak` from `~stencil/audio`, not `createAI` — the `runtime-audio` skill |
| Music and sound effects (a jingle, a game sound) | yes | `createAudio(env).music` / `.soundEffect` from `~stencil/audio` — the `runtime-audio` skill |
| Any other provider endpoint (the SDK's `speechModel`, moderation, assistants, realtime or streaming speech, voice cloning) | **no** | the gateway answers 404. Say so plainly and offer the nearest row above |

The gateway serves `openai:` ids for embeddings and for `languageModel` text, but OpenAI ids are not allow-listed, so a wrong one fails only at runtime; use the Anthropic ids below for chat.

## Model IDs

Stencil's AI gateway serves exactly these Anthropic ids and refuses any other with a 400 that names this list. For an app these are the only ids that exist: there is no Haiku 4.6, no Claude 3 Haiku, no dated Sonnet 4.5 other than the one below. Haiku 4.5 still answers for older apps but is not for new code. Never construct, "update" or recall a model id from memory.

Pick the cheapest model that does the job; a cheaper model also answers sooner, so the person waits less.

- First choice for anything answer-shaped — classification, fills, tags, word choice, short rewrites, a summary, a `generateObject` with a known shape: `ai.languageModel("anthropic:claude-haiku-5-5")` with thinking off (see Call options)
- A call made from a scheduled handler is answer-shaped almost by definition (nobody reads it as it streams), so it starts on Haiku 5.5 with thinking off unless it writes prose a person will read; the `recurring-actions` skill says how such a handler runs only on new work
- Long writing and real reasoning — an article, a course, a plan, multi-step analysis, open-ended chat: `anthropic:claude-sonnet-5-5`. It thinks on every call and thinking cannot be turned off, so set `maxOutputTokens` with room for the thinking and the answer together (see Call options)
- Only when the app builder asks for one by name, or Sonnet 5.5 demonstrably falls short on that call: `anthropic:claude-opus-4-8`, `anthropic:claude-opus-5`, `anthropic:claude-opus-5-5`, `anthropic:claude-fable-5`, `anthropic:claude-fable-5-1`, `anthropic:claude-fable-5-2`. Never as a default, and never for a whole app: name the one call that needs it. Fable 5.2 also refuses a replayed thinking block (400) when the system prompt, tools or earlier turns changed since it was produced, so an app that assembles its own `messages` across turns must send them unchanged on the next call
- Also served: `anthropic:claude-sonnet-5`, `anthropic:claude-opus-4-7`, `anthropic:claude-sonnet-4-5-20250929`
- Embeddings: `ai.textEmbeddingModel("openai:text-embedding-3-small")`

Every id must be namespaced `provider:model`. `tsc` catches a missing `provider:` prefix, but a namespaced id with a wrong model name type-checks and fails at runtime, so take ids only from this list.

If `package.json` has `@ai-sdk/anthropic` at 3.0.128 or newer, it must also have `"overrides": { "@ai-sdk/provider": "<the version @ai-sdk/anthropic depends on; 3.0.18 for 3.0.128>" }`. Add it if it's missing, and add it in the same change when you add `@ai-sdk/anthropic` to an app that didn't have it: without it `ai` and the Anthropic SDK install two copies of `@ai-sdk/provider` and typecheck fails with TS2883. Don't remove it. When bumping AI packages, keep it equal to the version `@ai-sdk/anthropic` uses. If an AI SDK error looks like a version mismatch (a missing field, or `instanceof` failing on an SDK error class), check this pin first.

Never change a model id as a fix unless the failing route's error names the model (the gateway's message starts with `Model "anthropic:…" is not available`). When you do, change only that route — not every call site in the app. A model switch the app builder asked for ("move the summary to Haiku") is the same kind of change: it needs no error to justify it, and it touches only the call site of the feature they named. The one exception is a platform update step at the top of your instructions that tells you to replace a model id across the app: do exactly what it says, everywhere it says.

## Name the feature on every call

Every AI call names the in-app feature it serves, so the app builder's Usage page shows spend per feature ("fill the blanks" is 80% of it) rather than per model alone. Pass `feature` where the model is created: a short, stable, lowercase label for the thing the app user sees, one label per feature, reused by every call that feature makes. Without it the call is recorded under the route that made it. Renaming a label starts a new row on the Usage page; it is a label change, not a feature change, so do not rename one to "fix" its numbers.

```ts
const model = ai.languageModel("anthropic:claude-haiku-5-5", { feature: "fill-the-blanks" });
const { text } = await ai.transcribe({ audio, feature: "voice-notes" });
```

An app that shows its own AI usage reads `await ai.usage()`: this billing period's calls, credits and dollars per feature for this deploy, from Stencil's own record, so the app keeps no price list of its own.

## The language the model writes in

In an app that speaks more than one language (it has an `app/strings/strings.<language>.json` file), `ai.languageModel` already tells the model to write in the language of the app user whose request is being served, unless an instruction in the prompt names a different output language. Add nothing for it: no language line in the prompt, no language column, no picker. An app with one language sends exactly what the code wrote.

- A feature with its own language choice (a "story language" picker, a translate button) passes it and it wins: `ai.languageModel(id, { feature, language: "fr" })`.
- Work done for someone other than the person behind the request has no request language to read, or the wrong one: a scheduled handler, a webhook, an admin action that writes a document or email for each app user. There the language travels with the recipient. Read it with `appUserLanguage(env, userId)` from `~stencil/locale` and pass it, once per recipient:

```ts
import { appUserLanguage } from "~stencil/locale";

const model = ai.languageModel("anthropic:claude-sonnet-5-5", {
  feature: "weekly-worksheet",
  language: await appUserLanguage(env, recipient.id), // undefined when they chose none, or the app no longer speaks it
});
```

`readDocument` and `transcribe` are not affected: a document is read as written.

## Call options

- Never set `temperature`, `topP` or `topK` on Anthropic calls. Every 5.x model rejects them with a 400, and a call to Sonnet 4.5 or Haiku 4.5 is served on a 5.5 model with them dropped (the app builder sees a warning for it under Monitoring). Leaving them out is always safe.
- For stable or machine-readable output, use structured output (`generateObject`, or `Output` with a schema) — not a low temperature. For the same answer to the same input, see Repeatable answers.
- Every Anthropic 5.x model (`claude-haiku-5-5`, `claude-sonnet-5`, `claude-opus-5` and the rest) thinks before it answers unless the call turns thinking off. That thinking is paid out of `maxOutputTokens` and costs tokens and latency, so a call can spend its whole cap thinking and write nothing, or start the answer and be cut off. Haiku 4.5 never thought, so a call moved from it to 5.5 now behaves this way.
- Choose per call. A quick, answer-shaped task (a classification, a fill, a short rewrite, a `generateObject` with a known shape) runs on Haiku 5.5 with thinking off: `providerOptions: { anthropic: { thinking: { type: "disabled" } } }`. The whole cap then goes to the answer, and the call is faster and cheaper. A task that needs reasoning keeps thinking on and raises `maxOutputTokens` to leave room for both the thinking and the answer.
- Which models accept thinking off: Haiku 5.5 and Sonnet 5 accept `thinking: { type: "disabled" }` at effort `high` or below (the SDK lowers `xhigh`/`max` to `high` for you). On Opus 5, lower `effort` instead. Opus 5.5, Sonnet 5.5 and Fable (`claude-fable-5`, `claude-fable-5-1`, `claude-fable-5-2`) reject it with a 400; `@ai-sdk/anthropic` 3.0.128 swaps it for the lowest thinking setting (`between_tools`, Sonnet 5.5) or drops it (Opus 5.5, Fable), with a warning, so the call still thinks. On those models, lower `effort` instead. There is no thinking budget (`budgetTokens`) on any 5.x model.
- While the app's `@ai-sdk/anthropic` is below 3.0.128 (check `package.json`), leaving `maxOutputTokens` unset means 4096, so set it explicitly on any call that may write more than a few paragraphs.
- `AIOutputLimitError` (thrown by `~stencil/ai` when a reply ends at its cap empty, or cut off mid-answer on a 5.x model) means the call made the wrong choice above, and its message names the fix for that model. On Haiku 5.5 or Sonnet 5: a quick task turns thinking off on the call that threw; a reasoning task raises its `maxOutputTokens`. On Sonnet 5.5, Opus 5.5, Opus 5 or Fable, "thinking off" is not available, so a quick task moves to Haiku 5.5 with thinking off, and a call that must stay on that model raises its `maxOutputTokens` (lowering `effort` helps only when the reply did think). A call that already had thinking off spent the whole cap on the answer: raise `maxOutputTokens`. The same failure appears for the app builder under Monitoring as a Scout card with the model, the cap, the tokens used and the thinking setting.

## Repeatable answers

A score, a grade, a pass/fail verdict or a classification that a person will compare across runs must come out the same for the same input. No sampling setting delivers that: `temperature: 0` was never a guarantee and is not accepted (see Call options). Build it in two parts, both of them:

- A fixed rubric, scored as structured output. Put the criteria in the prompt, give each one its own field in the schema with a small enum or an integer range, and compute the total in code. The model then decides a handful of narrow questions instead of inventing a number.
- Reuse the stored result. Key it on a hash of the normalised input (trimmed, whitespace collapsed) together with the rubric version, store it in the app database, and return the stored result while the key matches. Only this makes a second run of unchanged text return the first run's score. Tell the person when a result is reused ("same text as before"), and recompute when the rubric changes.

```ts
const key = await sha256(`rubric-v2\n${text.trim().replace(/\s+/g, " ")}`);
const stored = await db.query.scores.findFirst({ where: eq(scores.inputKey, key) });
if (stored) return { ok: true as const, score: stored, reused: true };
const { object } = await generateObject({
  model: ai.languageModel("anthropic:claude-haiku-5-5", { feature: "score" }),
  providerOptions: { anthropic: { thinking: { type: "disabled" } } },
  schema: z.object({ clarity: z.number().int().min(0).max(5), specificity: z.number().int().min(0).max(5) }),
  prompt: `${rubric}\n\n${text}`,
});
```

## How long a call may run

- There is no clock to beat on the gateway: it keeps a one-piece `generateText` or `generateObject` call alive for as long as the model writes, and the route's ~30 s CPU budget does not count time spent waiting on the model. Never add an `abortSignal` timeout of your own, split a job or shrink `maxOutputTokens` to fit a guessed limit — 25 s, 26 s and 90 s have all been guessed, none comes from Stencil, and each one cuts off a call that would have finished.
- What does bound a call is the person waiting. A route that holds the browser's request while the model writes shows nothing until the whole answer is back, and the browser itself gives up after a few minutes. Anything that can take longer than about a minute — a whole article, a course, a plan with many sections, a call allowed more than ~4,000 output tokens — streams to the screen (`streamText` with `toUIMessageStreamResponse` or `toTextStreamResponse`, rendered as it arrives), or is split into calls that each update the screen (an outline first, then one call per section). Splitting is for the person's wait, never for a time limit.
- A stand-in is never the AI's answer. If a call fails and the app shows something built from the app user's own words instead, label it as such on screen ("The AI couldn't write this; here is a draft from your notes") and `console.error` the failure as in the next section. A fallback shown in the same place and shape as a real answer, with nothing logged, is the one failure nobody ever finds.

## Never swallow a failed call

A failed AI call must reach the person who pressed the button. The gateway records every failed call for the app builder, who sees it as a card on Needs you under Monitoring; the app's job is the person on screen.

- In a route, catch around the AI call and return `failed("<step>", error, "<plain sentence>")` from `~stencil/errors` — it logs the error and returns a discriminable `{ ok: false, error }` — never an empty object with a 200.
- On screen, show that error next to the control (inline text with `role="alert"`, or a toast) and leave what the person typed in place. A bare `catch {}` that leaves placeholders showing is a dead button to the person using it.
- Keep the provider's message out of the UI and out of any row the app stores (a job's `error` column shows on a page later); it belongs in `console.error` only, which is where `failed` puts it.
- A streamed call that is not sent to the browser (a loader or scheduled handler that awaits `result.text`) must pass `onError` to `streamText` or check that the text is non-empty before storing it: a stream error such as `AIOutputLimitError` from `~stencil/ai` goes to `onError`, and the stream still finishes with empty text.

```ts
export async function action({ request, context }: Route.ActionArgs) {
  const ai = createAI(context.cloudflare.env);
  try {
    const { object } = await generateObject({
      model: ai.languageModel("anthropic:claude-haiku-5-5"),
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      schema,
      prompt,
    });
    return { ok: true as const, fills: object };
  } catch (error) {
    return failed("smart fill", error, "Couldn't fill this in right now — please try again.");
  }
}
```

---

## Free uses, quotas and limits

Every AI call an app makes is paid for by the app builder, so a limit on who may call one — three free suggestions per app user, a daily cap, a trial — is money the app guards in its own table. Counting the use is a claim, never a read-then-write: read the counter, refuse if the allowance is spent, then count under the value you read with `claim` from `~stencil/data`, and run the AI call only on a returned row. Reading the count, running the call for several seconds, then writing the old count plus one lets every request sent in parallel pass and the counter move once: the app user gets unlimited free prompts and every one lands on the app builder's bill.

```ts
const usage = await db.from("ai_usage").get(usageId);   // one row per app user, created on first visit
if (usage.freeUsed >= 3) return { ok: false as const, error: "You have used your 3 free suggestions — upgrade for more." };
const used = await db.from("ai_usage").claim(usageId, { freeUsed: usage.freeUsed + 1 }, { where: { freeUsed: usage.freeUsed } });
if (!used) return { ok: false as const, error: "Still working on your last request — try again in a moment." };
const { text } = await generateText({ model: ai.languageModel("anthropic:claude-sonnet-5-5"), prompt });
```

A paid plan is checked the same way, on the operation and not only on the screen (the `payments` skill). The `data-sdk` skill's "Claim before a side effect" has the rest of the shapes.

---

## Server-side

### Chat stream

```ts
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createAI } from "~stencil/ai";

export async function action({ request, context }: Route.ActionArgs) {
  const { messages }: { messages: UIMessage[] } = await request.json();
  const ai = createAI(context.cloudflare.env);

  const result = streamText({
    model: ai.languageModel("anthropic:claude-sonnet-5-5"),
    maxOutputTokens: 8192, // thinking and the reply share this cap
    system: "...",
    messages: await convertToModelMessages(messages), // UIMessage[] → ModelMessage[]
  });

  // Call consumeStream() so onFinish fires even if the client disconnects
  result.consumeStream();

  return result.toUIMessageStreamResponse({
    onFinish: async ({ messages }) => {
      // messages: UIMessage[] — full conversation including the new response
      // persist to D1 here
    },
  });
}
```

### `toUIMessageStreamResponse` options

```ts
result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => { ... }, // UIMessage[] — full conversation
  generateMessageId: () => crypto.randomUUID(),
  originalMessages: messages, // enables persistence mode (auto message ID)
  messageMetadata: ({ part }) => ({ createdAt: Date.now() }),
  sendReasoning: true,   // default true
  sendSources: false,    // default false
  onError: (error) => "An error occurred.",
});
```

### Generate text (non-streaming)

```ts
import { generateText } from "ai";
const { text } = await generateText({
  model: ai.languageModel("anthropic:claude-sonnet-5-5"),
  maxOutputTokens: 8192, // thinking and the reply share this cap
  prompt: "...",
});
```

### Structured output

```ts
import { generateObject } from "ai";
import { z } from "zod";
const { object } = await generateObject({
  model: ai.languageModel("anthropic:claude-haiku-5-5"),
  providerOptions: { anthropic: { thinking: { type: "disabled" } } },
  schema: z.object({ name: z.string(), score: z.number() }),
  prompt: "...",
});
```

**Schema rules (Anthropic rejects constraint keywords — every request 400s, deterministically):**

Anthropic's structured outputs support only plain shapes: types, `enum`, `const`,
`anyOf`/`allOf`, string `format`s (`date-time`, `email`, `uri`, `uuid`, …), and
array `minItems` of 0 or 1. They **reject** numeric constraints (`minimum`,
`maximum`, `multipleOf`), string lengths (`minLength`/`maxLength`), array counts
beyond `.min(1)` (`minItems > 1`, `maxItems`), and recursive schemas. Zod methods
that emit these — `.min()`, `.max()`, `.length()`, `.gte()`, `.lte()`,
`.positive()`, `.multipleOf()` — make **every** `generateObject`/`streamObject`
call fail with a generic error the app user just sees as "something went wrong".

```ts
// BAD — z.array(...).min(3) becomes minItems: 3 → Anthropic rejects the request:
//   "For 'array' type, 'minItems' values other than 0 or 1 are not supported"
schema: z.object({ ideas: z.array(z.string()).min(3).max(5) }),

// GOOD — .min(1) is fine; put the count in .describe() and the prompt:
schema: z.object({
  ideas: z.array(z.string()).min(1).describe("Between 3 and 5 ideas"),
}),
prompt: "... Return between 3 and 5 ideas.",
```

If a count or range is a hard requirement, check it in code after the call and
retry once — don't encode it in the schema.

**Schema size (Anthropic refuses a schema it cannot compile — every request 400s, deterministically):**

Anthropic compiles the whole schema into a grammar before the call and refuses one it cannot
compile, counted across the entire schema — nested objects and array items included:

- more than **16 nullable or union-typed fields** (`.nullable()`, `.nullish()`, `z.union()`,
  `z.discriminatedUnion()`): `Schemas contains too many parameters with union types`;
- more than **24 optional fields** (`.optional()`): `Schemas contains too many optional
  parameters`;
- one that is too big or too branching overall: `Schema is too complex.` or `The compiled
  grammar is too large`. A schema of 18 optional fields has been refused this way, so these
  limits are ceilings, not budgets to fill.

An `.optional()` field is not free. Make a field required when the answer always has it, and
keep the optional ones to the few the model may truly leave out.

- Keep one `generateObject` schema to what one answer needs. An extraction with many
  sections (a contract's parties, money, dates and clauses) is several calls with a small
  schema each, not one call with a 30-field form.
- Never give every field a `sourceText` twin or a per-field `confidence`; ask for those
  once at the top level, or only on the few fields that need them.
- A form with one answer per entry of a list (a grade and a note for each of 14 fields) is an
  array of small objects, or one call per entry, not a flat object of 28 optional fields.

```ts
// BAD — 20 nullable fields → "too many parameters with union types (20 …, limit: 16)"
schema: z.object({ partyA: z.string().nullable(), partyB: z.string().nullable(), /* …18 more */ }),
// BAD — 28 optional fields → "too many optional parameters (28) … (limit: 24)"
schema: z.object({ grade1: z.string().optional(), note1: z.string().optional(), /* …26 more */ }),

// GOOD — required where the answer always has it, and split into the two questions it really is
const PartiesSchema = z.object({ partyA: z.string(), partyB: z.string() });
const MoneySchema = z.object({ total: z.number(), currency: z.string().optional() });
```

When a schema is refused anyway, Stencil retries the call once in tool mode (the schema
goes in as a tool the prompt tells the model to call, with no grammar compiled), so the app still
gets its answer at the cost of a second round trip; the app builder sees it under Monitoring as a
warning that names the schema as too complex. Treat that warning as a bug in the schema and shrink it.

**Never force a tool choice.** Sonnet 5.5, Opus 5.5 and Fable 5.1 and 5.2 refuse one with a 400
(`tool_choice: type "tool" and "any" are not supported for this model`), and the older Sonnet names
are served on Sonnet 5.5. The SDK and the gateway turn `toolChoice: "required"`, a named
`toolChoice` and `structuredOutputMode: "jsonTool"` into `auto` with an instruction, so a reply can
come back as text with no object or tool call in it. For a fixed reply shape use `generateObject`
with a schema under the limits above and leave `structuredOutputMode` and `toolChoice` unset; for
a tool the model must call, say so in the prompt and check the result for the call.

### Embeddings

```ts
import { embed } from "ai";
const { embedding } = await embed({
  model: ai.textEmbeddingModel("openai:text-embedding-3-small"),
  value: "...",
});
```

To search records by meaning, store that `embedding` in a json column on the row (refreshed on every write) and query with `nearestRecords` from `~stencil/records` — load the `record-search` skill. Do not hand-roll vector storage or a similarity loop.

### Speech to text

`ai.transcribe` turns a recording or an uploaded audio file into text on the platform — no keys, nothing shipped to the browser, timestamps included. Server-side only.

```ts
export async function action({ request, context }: Route.ActionArgs) {
  const ai = createAI(context.cloudflare.env);
  const form = await request.formData();
  const recording = form.get("audio") as File;
  try {
    const { text, segments, vtt } = await ai.transcribe({
      audio: recording,
      prompt: "Names that come up: Stencil, Yaply, Drightly", // optional: steers spelling
    });
    return { ok: true as const, text, segments, vtt };
  } catch (error) {
    return failed("transcription", error, "Couldn't transcribe that right now — please try again.");
  }
}
```

- `audio` is a `File`/`Blob`, bytes, or `{ key }` for a file already in the app's storage — `transcribe` loads it from storage for you, so pass the key rather than reading the file into the action yourself.
- The result has `text`, timed `segments` (`{ start, end, text }` in seconds) for chapters or a click-to-seek transcript, and `vtt` captions ready for a `<track>` on a `<video>`.
- **Captions for an uploaded video are one media job, whatever its length.** `createMedia(env).transform({ operation: "captions", input: videoKey })` pulls the audio out, splits it, transcribes every piece and stores a WebVTT file at `captionKeyFor(videoKey)` beside the video; `<VideoPlayer>` shows it. The `media-processing` skill has the recipe. Do not convert, split or stitch a video by hand for this.
- `ai.transcribe` itself takes at most 10 MB per file (about 10 minutes of mp3) and is for clips: a voice note, a short recording, a file you need the plain text of right now. A longer file is the `captions` job, not a `trim` loop.
- Transcription is slow for long files — do it in an action after upload and save the transcript to D1 with the record, never on every page view.
- Live dictation while someone speaks (a mic button that fills a text box) is a different thing: the `voice-input` skill.

### Reading uploaded documents

`ai.readDocument` reads what is inside an upload — a PDF, a photo, screenshot or scanned page, or a text file — and returns its plain text, or the fields a Zod schema names. A PDF or picture goes to the model as a document (one paid call, under `feature`); a text file is read in the Worker. Server-side only; never a PDF, Word or OCR library, never a hand-assembled file part.

```ts
const { text, legibility } = await ai.readDocument({ file: { key: doc.fileKey }, feature: "notes-import" });
const { fields } = await ai.readDocument({ file, schema: InvoiceSchema, feature: "invoice-scan" });
```

`legibility` is `"all"`, `"partly"` or `"none"`; show a review form when it is not `"all"`. The `document-reading` skill has the upload-to-record recipe, the limits (20 MB, PDFs up to about 100 pages) and what to say about Word files and spreadsheets, which are not read yet.

---

## Client-side: `useChat`

### Basic usage

```tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, sendMessage, status, stop, error } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

// status: "submitted" | "streaming" | "ready" | "error"
const isLoading = status === "submitted" || status === "streaming";

sendMessage({ text: input });           // send text
sendMessage({ text: input, files });    // send with file attachments
```

### Seed from DB (persistence)

```tsx
// Use `messages` option — NOT `initialMessages` (that's the old v2 API, removed in v3)
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  messages: loaderData.history, // UIMessage[] loaded from DB in the loader
});
```

### All `useChat` options

| Option | Description |
|---|---|
| `transport` | `new DefaultChatTransport({ api, headers, body, credentials })` |
| `messages` | Seed initial messages (e.g. from DB) |
| `id` | Unique chat ID (auto-generated if omitted) |
| `onToolCall` | Fires when a client-side tool is invoked |
| `onFinish` | Fires when streaming completes |
| `onError` | Error handler |
| `onData` | Fires when a data part is received |
| `sendAutomaticallyWhen` | `({ messages }) => boolean` — auto-resubmit condition |
| `generateId` | Custom ID generator for messages |

### All `useChat` return values

| Value | Description |
|---|---|
| `messages` | `UIMessage[]` — full conversation |
| `setMessages` | Replace history programmatically |
| `sendMessage({ text, files?, metadata?, messageId? })` | Submit a message |
| `regenerate()` | Regenerate last assistant message |
| `stop()` | Abort current stream |
| `status` | `"submitted" \| "streaming" \| "ready" \| "error"` |
| `error` | Last error (if any) |
| `clearError()` | Reset error state |
| `addToolOutput(toolCallId, output)` | Return tool result to the model |

### `DefaultChatTransport` options

```ts
new DefaultChatTransport({
  api: "/api/chat",
  headers: () => ({ Authorization: `Bearer ${token}` }), // static or fn
  body: { sessionId },
  credentials: "same-origin",
})
```

---

## `UIMessage` shape

Text lives in `parts` — there is no top-level `content` field.

```ts
{
  id: string,
  role: "user" | "assistant" | "system",
  parts: [
    { type: "text", text: string, isStreaming?: boolean },
    { type: "reasoning", reasoning: string },
    { type: `tool-${toolName}`, state: "input-streaming" | "input-available" | "output-available" | "output-error", input?, output?, errorText? },
    { type: "file", filename: string, mimeType: string, url: string },
    { type: `data-${customType}`, data: any },
  ],
  metadata?: any,
}

// Extract text content:
const text = message.parts
  .filter(p => p.type === "text")
  .map(p => p.text)
  .join("");
```

---

## Model output is Markdown — render it

Every served model answers in Markdown: `**bold**`, `- ` bullets, `|` tables, headings, fenced code. Dropped into a text node, those markers reach the screen as literal asterisks and pipes, the build passes, and nothing errors — the app builder only finds out when an app user asks a question long enough to draw a table. Set up rendering in the same change that adds the AI call:

1. Render every assistant text part with the template's `~/components/markdown` component (react-markdown with GitHub-flavoured tables, styled with `prose`). Do the same for a `generateText` result shown on screen.
2. Turn on the `prose` styles once per app: add `@plugin "@tailwindcss/typography";` to `app/app.css` after the existing imports. The plugin is installed but not registered, so without the line the component renders but bullets, headings and table borders are missing.
3. Keep app-user messages as plain text. Rendering what one app user typed as Markdown lets them inject formatting and links into what another app user sees.

```tsx
import { Markdown } from "~/components/markdown";

{message.role === "assistant" ? <Markdown>{text}</Markdown> : <p>{text}</p>}
```

Pass the text as it streams — the component re-renders each chunk, and an unclosed marker shows for a moment until its pair arrives. Ask the model for plain prose in `system` only when the surface truly cannot hold formatting (a one-line label, a `<title>`, a push notification); never as a way to avoid the component. The `chat-ui` skill's bubbles follow the same rule.

Whatever the surface, the `system` prompt of every call that writes text an app user reads carries the app's copy style: plain words, no em dashes or en dashes, no hype, and the spelling convention the rest of the app uses. Add any voice rule from the app builder's saved instructions to it word for word, so the app's generated text sounds like the app builder and not like a model.

---

## Full persistence pattern

```ts
// Loader — fetch history from D1
export async function loader({ context }: Route.LoaderArgs) {
  const db = createDb(context.cloudflare.env);
  const rows = await db
    .select()
    .from(chatMessages)
    .orderBy(asc(chatMessages.createdAt));
  return { history: rows };
}

// Component — seed useChat
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  messages: loaderData.history,
});

// Action — save in onFinish
const result = streamText({
  model: ai.languageModel("anthropic:claude-sonnet-5-5"),
  maxOutputTokens: 8192,
  messages: await convertToModelMessages(messages),
});

result.consumeStream(); // ensure onFinish fires even on client disconnect

return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    const now = new Date().toISOString();
    for (const msg of messages) {
      const content = msg.parts
        .filter(p => p.type === "text")
        .map(p => p.text)
        .join("");
      await db
        .insert(chatMessages)
        .values({ id: msg.id, role: msg.role, content, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: chatMessages.id, set: { content, updatedAt: now } });
    }
  },
});
```
