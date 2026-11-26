---
name: app-agents
description: Last resort for AI work inside an app. Use only when the app builder asks for an agent by name — "an agent", "an AI agent in my app" — or for an AI that works for minutes on many files and asks them questions part-way — "an AI that works through my files for a while", "an assistant that asks me when unsure" — and for any question about one of the app's agent runs: "what is the agent doing", "why is it stuck", "why did the run fail", "fix the agent" — and for letting an existing agent open or browse a website in a real browser: "let the agent check availability on X", "the agent should open site Y", "can the agent click through site Z" (agents declare browser: { hosts }, see "Letting an agent use a browser"; this is not the web-search skill's createFetch). Not for: one-file or one-prompt AI (ai-sdk, createAI); audio or video conversion, captions or transcripts (media-processing); work on a schedule (recurring-actions); a batch with no judgement in it (a plain background route). An app agent costs a separate machine for minutes and 50 credits per run by default, billed to the app builder, so when in doubt build the simpler thing. Covers the app/agents/<name>/index.ts definition with its typed output, tools the agent calls back into the app, the trigger route, messages and files sent mid-run, the live run view, accept, draft rows, hooks, reading a run's log, and what to say when agents are not yet available for the workspace.
allowed-tools: appAgents appAgentLog appAgentRunEvents
metadata:
  agents: [chat, builder]
---

# App agents

An **app agent** is a worker an app user starts from inside the app. It runs for minutes on a separate machine with a copy of the files the app hands it, writes files into an output folder, ends with a structured **result** when the definition declares one, can call a few tools the app exposes, can ask the app user one question at a time, reads notes and photos the app user sends while it works, and streams its progress to the screen that started it. When it finishes, the app user reviews the output and accepts it; only then do its files land in the app's storage.

## Try these first

An app agent is the most expensive thing an app can run: a separate machine for minutes, 50 credits per run by default billed to the app builder, and a folder under `app/agents/` to keep working. Before you build one, go down this list and take the first that fits:

1. **One AI call** — `generateText` or `generateObject` through `createAI` (`ai-sdk` skill). "Summarise each uploaded contract into a short note" is one call per file from a route, not an agent.
2. **`media-processing`** — converting, cutting or combining audio and video; captions and transcripts.
3. **`recurring-actions`** — anything that runs on a schedule.
4. **A plain background route** — a batch with no judgement in it: loop over the records, call the AI once each, write the rows.

Build an agent only when none fits because the work needs all of: minutes, many files, a judgement call part-way (a question to the app user, a choice the prompt cannot settle in advance) and no other platform capability that covers it — or when the app builder asked for an agent in so many words. The example below earns its agent from the `ask_user` step and the notes that arrive mid-run, not from the summarising.

**Prove it before you create `app/agents/<name>`.** Quote in your report the sentence of the brief that asks for this — "let my users run an AI that goes through a whole folder of contracts, asks me when a clause is unclear, and drafts a row per contract". If no sentence fits, build the simpler version from the list and write in your report: "This could become an app agent later if you want it to work on many files at once and ask you questions as it goes." When in doubt, the simpler version wins.

**Check the workspace may run agents before you create `app/agents/<name>`.** The system prompt says so under "App agents are switched on" or "App agents are not switched on for this workspace"; with neither heading, call `appAgentLog` (active on every turn) first: an `unavailable` answer means not yet. Not switched on means every run is refused in the App preview and on the Published app, so build the simpler version from the list above instead and say in one line that app agents are not open to this workspace yet. Never build code whose every run you know will be refused.

## How a run works

1. A trigger route in the app checks the app user owns the records whose files it wants to hand over, then calls `createAgents(env).run("<name>", { message, files, input, onBehalfOf })`.
2. The platform copies those bucket keys into the run's `/work/in` folder, starts the agent with its prompt and skills, and streams the run to the app.
3. The agent reads `/work/in` and the message, writes to `/work/out`, calls `report_progress(label, done, total)` as it goes, may `ask_user(prompt, choices)`, and ends with a summary and, when `output` is declared, the result.
4. The app shows the stream with `useAgentRun` or `<AgentRunView>`; the app user answers questions, can send a note or a photo mid-run, can stop the run.
5. Done: `onDone` receives the typed `result`; the app user reviews and accepts. `accept(runId)` copies `/work/out` into the app's bucket under `agent-runs/<agent>/<runId>/…` and returns the new keys. Nothing else is written to the app's storage before that.

Beside `report_progress`, `ask_user` and `finish`, every run has **`extract_faces`** built in: it finds every face in the run's photos (a list or a manifest, batched and resumable), and writes boxes, landmarks, detection scores, quality signals and 128-float embeddings to a file the agent reads with code. It never names people or makes groups — the agent's prompt says how to compare and what to save, and the `face-recognition` skill says what to tell it. Do not build a recognition backend, add a vision vendor or ask the app builder to configure anything for faces.

Every run has a budget (minutes and credits) and the platform clamps it to its ceilings. Default: 30 minutes, 50 credits. The run's own folder — inputs, outputs, the model transcript and the run log — lives under `agent-runs/<runId>/` in the app's own bucket; `createStorage(env)` does not see it.

## 1. Define it — `app/agents/<name>/index.ts`

One folder per agent under `app/agents/`; the folder name is the agent's `name`. Load the `agent-knowledge` skill to write its `skills/` folder.

```ts
// app/agents/file-summarizer/index.ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineAgent, tool } from "~stencil/agents";
import { createDb } from "~stencil/db";
import { createNotifications } from "~stencil/notifications";
import { summaries, summaryRuns } from "~/generated/db-schema";

export default defineAgent({
  name: "file-summarizer",
  description: "Summarises every document the app user hands it, one summary per file.",
  prompt: `You summarise documents for a busy reader.
Your inputs are in /work/in — one file each; the message says what the reader cares about. For every file:
1. Read it in full.
2. Write /work/out/<same base name>.summary.md: a 3–5 sentence summary, then a bullet list of decisions, dates and amounts it mentions.
3. Call report_progress with the file you just finished, the files done so far and the total.
Call save_draft once per file with the summary text so the app can show it for review.
If a file is unreadable or in a language you cannot read, call ask_user once with the file name and the choices "skip" and "stop"; never guess.
A note or a photo may arrive while you work; read it before the next file.
When every file is done, end with the result: one line per file and the list of what you skipped.`,
  model: "claude-sonnet-5-5",
  modelReason: "Reads whole documents carefully at a fraction of Opus's price.",
  budget: { minutes: 20, credits: 30 },
  output: z.object({
    files: z.array(z.object({ fileName: z.string(), headline: z.string() })),
    skipped: z.array(z.string()),
  }),
  tools: [
    tool({
      name: "save_draft",
      description: "Save one file's summary as a draft row the app user will review.",
      input: z.object({ fileName: z.string(), summary: z.string() }),
      replay: "safe",
      handler: async ({ fileName, summary }, { env, run, member }) => {
        const db = createDb(env);
        const now = new Date().toISOString();
        await db
          .insert(summaries)
          .values({
            id: `${run.id}:${fileName}`,
            ownerId: member.id,
            fileName,
            body: summary,
            runId: run.id,
            status: "ai_suggested",
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({ target: summaries.id, set: { body: summary, updatedAt: now } });
        return { saved: true };
      },
    }),
  ],
  onDone: async ({ runId, onBehalfOf, result, outputs, cost }, env) => {
    // `result` is typed from `output`: { files: {...}[]; skipped: string[] }.
    await createDb(env)
      .update(summaryRuns)
      .set({ result, fileCount: outputs?.files.length ?? 0, credits: cost.credits, finishedAt: new Date().toISOString() })
      .where(eq(summaryRuns.id, runId));
    await createNotifications(env).send({
      toUserId: onBehalfOf,
      title: "Your summaries are ready",
      body: `${result.files.length} summarised, ${result.skipped.length} skipped.`,
      link: `/summaries?run=${runId}`,
    });
  },
});
```

- **`name`** — the folder name; what the trigger route passes to `run()`.
- **`prompt`** — the whole job in the agent's words: what `/work/in` and the message hold, what to leave in `/work/out`, when to call which tool, when to ask. `report_progress(label, done, total)` and `ask_user(prompt, choices)` are built in; name them in the prompt so the agent uses them.
- **`output`** — optional zod schema of the result the agent must end with. The platform validates it and `onDone` gets it typed as `result`; without `output`, `result` is `null`. Write it to a row the page shows (a `result` JSON column on the run's record), not into the summary text.
- **`model`** — the model you **recommend** for this agent, with **`modelReason`**, one short line on why. Always pick one on purpose and write the reason; never leave the default standing without one. The three choices are `claude-haiku-5-5` (fastest and cheapest: sorting, extracting, short rewrites), `claude-sonnet-5-5` (the all-rounder: reads carefully, writes well, a fraction of Opus's price) and `claude-opus-5-5` (judgement calls, long tangled inputs). The app builder can pick another model in More → Agents; a build never resets their choice, because it lives on the agent's row, not in the code.
- **`budget`** — optional minutes and credits; the platform clamps both to its ceilings. The app builder can lower either per run, and add a monthly credit cap, on the Agents page or through the Chat Agent; those limits live on the agent's row and a build never resets them. A run past the monthly cap is refused with 402 and "This agent hit its monthly limit of N credits." — surface that `AgentsError` message unchanged, like the 403 below.
- **`storage`** — `"declared"` (default) hands the run only the keys the trigger passes; `"none"` hands it no files.
- **`tools`** — what the agent may call back into the app. Each `tool()` has a zod `input`, a `handler(args, ctx)` with `ctx.env`, `ctx.run` (`id`, `agent`, `onBehalfOf`) and `ctx.member` (the app user the run acts for — scope every read and write to them), and `replay`: `"safe"` when running the call twice is harmless (an upsert keyed by `run.id`), `"never"` (default) when it is not (a send, a charge). After an interruption the platform re-runs `safe` calls and reports `never` ones as "may have run".
- **Hooks** — `onDone({ runId, agent, onBehalfOf, summary, result, outputs, cost })`, `onFailed({ error, cost })`, `onNeedsInput({ question })`, `onExpiring({ expiresAt })` run in the app when the platform reports the event. Use them for notifications and bookkeeping, not for the work itself.

A definition must import nothing that needs a browser or a request: the deploy loads the file outside the app to read its shape. `~stencil/*` server modules, `zod` and the generated schema are fine.

### Letting an agent use a browser

An agent can open a website in a real browser when its definition says so:

```ts
browser: { hosts: ["bookings.doc.govt.nz", "www.doc.govt.nz"] },
```

- Add `browser` only when the task really needs a website the app cannot reach through a tool or an API. List the exact hosts, nothing wider: a hostname (`bookings.example.com`) or a site and its subdomains (`*.example.com`). Never a wildcard for the whole web.
- The agent then gets a `browse` tool: it writes a plan of plain steps with one checkpoint each, and the platform drives a real browser with a cheap decision model clicking (Claude plans, the decision model clicks). The browser can open only the listed hosts, in code; the agent cannot widen that.
- Guarded controls — pay, buy, checkout, delete, send, submit, sign up, register, publish, connect, invite — are never clicked. Add `allow: ["Check availability"]` only for a named control the task needs, and say so in your reply.
- Runs that browse cost browser time and decisions on top of the model's turns; keep `budget` honest.
- **Bot checks.** A site that refuses automated browsers (a reCAPTCHA, hCaptcha or Turnstile widget, a Cloudflare "Just a moment" page, a waiting queue) ends the browse with a `bot-check` row in the run log, and the agent does not browse that host again in the run. Stencil does not solve CAPTCHAs: never suggest, build or prompt a way around one. Tell the app builder in plain words: "<host> runs a bot check (reCAPTCHA / Cloudflare) and refuses automated browsers, so the agent could not read it. Options: use the site's API or a data feed, keep the app's own request path, or pick a host that allows it." A host that has shown one does not belong in `browser.hosts`.
- **Tell the app builder** in your reply which websites the agent may open, and that it can never pay, delete, send or sign up there unless they ask for it.
- When the app builder asks for something that needs a site ("check availability on X"), propose the host list and confirm it with them in the reply before or as you add it.

### Draft rows

Any table a tool writes gets a `run_id` column and a `status` column whose first value is `"ai_suggested"`. The app lists those rows for review with an accept and a discard action per row; accepting flips `status` to the table's normal value. Never let an agent write straight into the status vocabulary the app already shows — the app user reviews first. Use the same server function the UI path uses to write the row.

## 2. Trigger it — a route the app user calls

```ts
// app/routes/api.summarize.tsx
import type { ActionFunctionArgs } from "react-router";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "~stencil/auth/server";
import { createDb, inList } from "~stencil/db";
import { createAgents, AgentsError } from "~stencil/agents";
import { documents } from "~/generated/db-schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const { user } = await requireAuth(request, env);
  const { documentIds, focus } = (await request.json()) as { documentIds: string[]; focus?: string };

  // Only files on records this app user owns may be handed to the run.
  const rows = await createDb(env)
    .select({ key: documents.fileKey })
    .from(documents)
    .where(and(eq(documents.ownerId, user.id), inList(documents.id, documentIds)));
  if (rows.length === 0) return Response.json({ error: "No documents selected." }, { status: 400 });

  try {
    const run = await createAgents(env).run("file-summarizer", {
      message: focus ? `Summarise with this in mind: ${focus}` : "Summarise every file.",
      files: rows.map((r) => r.key),
      input: { documentCount: rows.length },
      onBehalfOf: user.id,
    });
    return Response.json({ runId: run.id });
  } catch (err) {
    if (err instanceof AgentsError && err.status === 403) {
      return Response.json({ error: "AI agents are not switched on for this app yet." }, { status: 403 });
    }
    if (err instanceof AgentsError && err.status === 402) {
      return Response.json({ error: "The workspace is out of credits." }, { status: 402 });
    }
    throw err;
  }
}
```

`message` is the first thing the agent reads — a string, or a full message `{ id, role: "user", parts }` whose parts are `text` and `file` (`url` a bucket key or a `data:` URL under 1 MB). `files` are keys as `createStorage(env)` knows them, copied into `/work/in`; `input` is structured data the agent reads beside the message. The ownership check is not optional: `files` is any bucket key, so the route — not the agent — decides what the app user may hand over. `onBehalfOf` is always the session user's id, never a value from the request.

`run()` answers as soon as the run exists, in state `copying`: the platform copies `files` into the run in the background, and a big set — hundreds of photos — takes a little while to prepare. The route returns the run id at once, whatever the number of files; never wait for the files in the route, and never block the page on anything but this one start call.

### Talk to a running agent from a Worker route

```ts
const agents = createAgents(env);
await agents.send(runId, "The client also wants the payment dates called out.");
await agents.send(runId, {
  id: crypto.randomUUID(),
  role: "user",
  parts: [{ type: "file", url: photo.fileKey, mediaType: "image/jpeg", filename: "receipt.jpg" }],
});
await agents.answer(runId, questionId, "skip");
```

Check the caller owns the run (`status(runId).startedBy === user.id`) before sending on their behalf. `useAgentRun` already does this for the page, so most apps never need these.

## 3. Show it — `useAgentRun` and `<AgentRunView>`

`app/routes.ts` already spreads `stencilAgentRoutes`, which serves the run endpoints the browser needs. Keep it registered.

```tsx
import { AgentRunView } from "~stencil/ui/agents/run";

export default function SummariesPage() {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/summarize", { method: "POST", body: JSON.stringify({ documentIds }) });
      const data = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok || !data.runId) throw new Error(data.error ?? "Could not start");
      setRunId(data.runId);
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <button type="button" disabled={starting || runId !== null} onClick={() => void start()}>
        {starting ? "Starting…" : "Summarise"}
      </button>
      <AgentRunView runId={runId} />
    </>
  );
}
```

The button is pending only while the start request is in flight — about a second, however many files the run takes. Once `runId` is set, `<AgentRunView>` takes over: it shows "Preparing files 120 / 646" while the platform copies the inputs, then "Queued" and "Running" once the agent starts. The page never waits on the files itself.

`<AgentRunView>` shows the state, a progress bar, the latest text, the messages sent so far, the open question with an answer form (buttons when the question's schema has choices, a text input otherwise), the result as JSON, the summary, and — while the run is active — a form to send a note or a photo. It talks to `/api/agents/runs/<id>/*` and reconnects on its own. For a custom layout use the hook it is built on:

```ts
const run = useAgentRun(runId);
// run.state, run.progress ({ done, total, label, percent }), run.text, run.question ({ questionId, prompt, schema }),
// run.result, run.summary, run.error, run.messages
// run.answer(questionId, value), run.send({ text, files: File[] }), run.stop()
```

`send` takes a note, image files from an `<input type="file">`, or both; each file must be under 1 MB. Only the app user who started a run can read or steer it; a stranger gets a 404.

## 4. Accept it — the output lands only when the app user says so

```ts
// in an action the review screen posts to
const { keys } = await createAgents(env).accept(runId);
// keys: ["agent-runs/file-summarizer/<runId>/contract-a.summary.md", ...] — relative to the app's bucket
```

`accept(runId, paths?)` copies the run's `/work/out` (or only `paths`) into the app's own bucket under `agent-runs/<agent>/<runId>/…` and returns the new keys; store them on the records they belong to. It is idempotent, so a double click is safe. Pair it with flipping the run's draft rows from `"ai_suggested"` to the table's normal status in the same action.

`createAgents(env)` also gives `status(runId)`, `list({ agent?, state? })`, `stop(runId)`. A run status carries `result`, `summary`, `outputs`, `costCredits`, and `transcriptKey` / `logKey` once written. States: `copying` (the files are being prepared), `queued`, `running`, `waiting` (a question is open), `done`, `accepted`, `failed`, `stopped`, `expired`.

## When a run misbehaves — read its log before you change anything

Three tools, three questions. `appAgents` answers "what state is it in and how did it get there": per run its state, attempt, place in the queue, last heartbeat (the box's periodic "still alive" signal; a stale one means the box is gone), first output time and `history` — every state change with when and why, as the station recorded it ("box silent for 60 s, respawning", "queued over an hour, failed", "credit budget exceeded"). `appAgentLog` answers "what did it do": the steps. `appAgentRunEvents` answers "how do its runs usually go": the archive across runs. Costs are credits, never dollars; neither tool has a dollar figure.

- Read the run's state from `appAgents` first. A `failed → queued` entry with reason "automatic retry" is not a bug: the station re-queues a failed run exactly once (`autoRetriedAt` is set), on the same row and run folder, so the earlier attempt's files are still there; a second failure stays `failed`. A rising `attempt` is a box respawn after a dead heartbeat, not a new run. The Builder Agent reads `appAgents` only: a model or limit change goes through the Chat Agent's `set`, which refuses the Builder Agent.
- Every run keeps a step-by-step log: each tool call with its input and whether it succeeded, progress reports, questions, errors, the agent's text and its result. `appAgentLog` reads it — live from the run while it is going, from the archive after — so a stuck, slow or failed agent is never diagnosed blind. Call it before forming a theory or editing a file. With no `runId` it picks the app's active run, else the newest; pass `agent` to narrow the pick, or a `runId` from `appAgents`. The default answer is the tail, the last 50 rows. Read a long run from the start with `after: 0` and keep calling with the `nextAfter` it returns until it says the log ended; the whole log is readable that way.
- Answer from what the log says. A journal row `outcome extract_faces error: …` repeated over every photo is the fault; the run's summary is the agent's own guess about it. Never explain a run from the app's own tables (a row in the app's runs table says nothing about why the run stopped) and never estimate how long "the early phase" takes — the log has timestamps.
- `transcript: true` reads the full model transcript, one JSON line per model message, paged by `line` and `lines`. Reach for it when the log shows the agent choosing wrongly and you need its reasoning; for "what happened" the log is enough and far shorter.
- Fix the cause the log shows: a tool handler that throws, a prompt that never calls `report_progress`, an input the agent cannot read. Keep the rows that drove the change, with their `seq`, in your tool work and in the Builder Agent handoff; the app builder's reply describes them in plain words (see "Reporting to the app builder").
- A `bot-check` row (the host, the check and the still of the page) means the site refused the browser, not that the agent or its plan was wrong. Say so to the app builder: "<host> runs a bot check (reCAPTCHA / Cloudflare) and refuses automated browsers, so the agent could not read it. Stencil does not solve CAPTCHAs." Offer the site's API or a data feed, the app's own request path, or another host. When asked to "fix the agent" after such a run, do not change the browse plan or the prompt to retry that host, and never suggest a workaround for the check.

## Learning from finished runs — `appAgentRunEvents`

`appAgentLog` is for one run, live or newest. `appAgentRunEvents` reads the archive of the app's finished runs across runs, filtered — so before you change an agent's prompt, tools or model, look at how its last runs actually went.

- Call it with `summary: true` first (`agent` to narrow, `lastRuns` up to 20): per run you get the tool mix with call counts, the failed tool calls per tool, model calls, proxy errors, errors, duration, state and cost. That is the comparison between runs; read it before any theory.
- Then drill in: `failedOnly: true` for every failed tool call, failed proxy response and error; `tool` for one tool's calls and results; `kinds` for one kind of event (`data-journal`, `data-usage`, `data-proxy-response`, `text`, …); `search` for words in an event's text. Page with the `nextAfter` it returns.
- A run that is still going is not fully archived: the tool says so and points you to `appAgentLog`. You never write SQL; the filters are the query, and it only reads this app's runs.
- The events that drove a change (run id and `seq`) stay in your tool work and in the Builder Agent handoff, as with the log; never in the app builder's reply.

## Reporting to the app builder — plain English, no dumps

This applies to the Chat Agent and the Builder Agent alike, whether or not this skill is loaded: app builders are not engineers, and the reply is for them.

- **Never print raw evidence in the conversation.** No log rows, tool payloads, JSON results, code, stack traces, run or sequence identifiers, or any data dump — not even as a shortcut to show that you read the run. Describe what you found instead: "the agent read all 40 files, then its save step failed on the last 12 with the same permission error".
- **Say four things:** what happened, what you saw that shows it, what it means for them (what the app user got or did not get, what it cost), and what to do next — or what you are still unsure about.
- **Raw evidence has a place: tool work and the handoff.** Exact run ids, `seq` numbers and the rows that show a fault go into the build request to the Builder Agent, or into the Builder Agent's own report of the code it changed, never into the app builder's reply.
- **Claims stay inside the evidence.** No failed tool calls is not proof the output was right or the work efficient. A count of proxy requests is a count of requests, not of face-service calls or any other named thing, until you read what they were. Read the relevant events before you attribute a number or a cause. When the archive is unavailable or returns nothing, say that limit plainly and stop there; never invent a likely cause to fill the gap.

## Where the app builder sees it

More → Agents lists every agent the app defines with its recommended model and your reason, a model picker (Haiku / Sonnet / Opus) showing what a run costs and takes on each, the budget per run (and the ceiling applied), the app builder's own limits, each agent's knowledge with who wrote each skill last and an Edit button, and the recent runs with their cost. When you add or change an agent, say so in your report: "You will see it under More → Agents after this build; it runs in the App preview now and on the Published app once you publish."

**Chat Agent, when asked what an agent is doing, why it is stuck, why it is slow or why it failed:** `appAgents`, `appAgentLog` and `appAgentRunEvents` are active on every turn, with or without this skill — never say a run cannot be read. Call `appAgentLog` for a live run and `appAgentRunEvents` (summary first, then the failures or events that matter) for a finished one, and answer from what they return — the tool calls, their errors, the progress counts and the timestamps. Never answer from the app's own tables, from the run's summary alone, or from a guess about how long a phase "normally" takes. If the log shows a fault in the agent's code or prompt, hand the fix to the Builder Agent with the run id and the rows that show it; the reply to the app builder stays in plain words, as above.

**Chat Agent, when planning a handoff:** never put an app agent into a handoff unless the app builder asked for one, or you asked them and they said yes. Otherwise hand off the plain version — one AI call, a media job, a schedule or a background route, as in "Try these first" — and mention the agent in one line as an option: "This could become an app agent later if you want it to work on many files at once and ask you questions as it goes."

**Chat Agent, before a model change or a new agent:** read the `appAgents` tool and state what each model costs and takes per run for that agent ("Haiku: about 2 credits · about 4 min; Sonnet: about 10 credits · about 5 min; Opus: about 20 credits · about 6 min, estimates until it has run three times"), then switch it with `appAgents` `set` — no build, no credits — or, for a new agent, say which model the Builder Agent will recommend and why. Never switch a model by rebuilding the definition.

## When the platform says no

Agents are rolling out gradually. If `run()` throws an `AgentsError` with status 403 ("Agents are not available for this workspace yet"), the app's code is fine; the workspace is not on the rollout yet.

Chat Agent: when a test run answers 403, tell the app builder plainly — "Agents aren't switched on for your workspace yet; the code is in place and will work the moment they are" — and offer to add a Backlog item ("Switch on the file summariser once agents are available") so it is not lost. Do not retry, do not work around it with `createAI`, and do not describe the feature as live.

Builder Agent: you should not meet this 403 by surprise — "Try these first" has you check first. If a run still answers 403, report it as what it is: the workspace is not on the rollout yet, so the agent cannot run here, and offer the simpler version that runs now. Never call the refusal a "no-op", never say publishing is held or blocked by it (agents never gate a publish), and never send the app builder to a settings page for agents: More → Agents is hidden until agents are switched on, and no "Monitoring → Agents" page exists.
