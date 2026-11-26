---
name: media-processing
description: Combining, cutting or converting audio and video the app already stores — laying a voice track over music, putting background music under a video, trimming a clip, stitching clips into one, converting a file (a WhatsApp .ogg voice note, a .mov) so it plays everywhere — and captions or a transcript for an uploaded video, hours long included. Uses createMedia(env).transform from ~stencil/media (ffmpeg and speech to text on the platform, keyless, server-side, asynchronous). Load whenever the brief needs to change media rather than just store and play it, or wants captions, subtitles or a transcript on uploaded video. Do NOT reach for ffmpeg.wasm, fluent-ffmpeg or any npm media library — they cannot run on Cloudflare Workers.
metadata:
  agents: [chat, builder]
---

# Media processing (audio and video)

`createMedia(env).transform(request)` from `~stencil/media` mixes, trims, joins and
converts the app's stored audio and video on the platform. No API keys. **Server-side
only** — loaders, actions or scheduled handlers, never the browser. Output is always an
**R2 key in the app's own storage — never bytes** — so you keep the key in D1 and serve
the file from your own route.

Storage and playback are the **`storage`** skill; generating a video from React is the
**`remotion`** skill; making new sound (speech from text, music, a sound effect) is the
**`runtime-audio`** skill. This skill is the step between them: taking files the app has and
making new ones.

## Do not use ffmpeg.wasm or any npm media library

The app deploys to Cloudflare Workers. `ffmpeg.wasm`, `fluent-ffmpeg`, `@ffmpeg/*` and
anything that spawns a binary or loads a multi-megabyte codec cannot run there, and the
browser is the wrong place for a 200 MB file. There is exactly one supported path:
`createMedia(env).transform`. Reach for it instead of a `/api/process-audio` route built on
a library.

## The shape: a job you poll

Media work is slower than a request, so `transform()` returns immediately with a `jobId`
and the job runs on the platform. You store the `jobId` against your own row, poll
`status(jobId)` from a resource route, and when it is `succeeded` you save the `key`.

```ts
import { createMedia } from "~stencil/media";
import { createDb } from "~stencil/db";
import { requireAuth } from "~stencil/auth/server";
import { tracks } from "~/generated/db-schema";

export async function action({ request, context }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env);
  const form = await request.formData();

  const { jobId } = await createMedia(context.cloudflare.env).transform({
    operation: "mix",
    // App-storage keys (what `storage.put` took) or absolute http(s) URLs.
    inputs: [String(form.get("voiceKey")), String(form.get("musicKey"))],
    volumes: [1, 0.3],
    format: "mp3",
  });

  // The platform only knows a job happened — link it to your own domain row.
  await db.insert(tracks).values({
    id: crypto.randomUUID(),
    userId: user.id,
    jobId,
    status: "processing",
    createdAt: new Date().toISOString(),
  });
  return { jobId };
}
```

## Operations

Every file reference is an app-storage key or an absolute http(s) URL. Inputs can be any
common audio or video file (mp3, wav, ogg, m4a, aac, mp4, webm, mov); outputs are one of
`mp4`, `webm` (video) or `mp3`, `wav`, `ogg`, `m4a` (audio).

| Operation | Request | What you get |
|---|---|---|
| `convert` | `{ operation: "convert", input, format }` | The same media in another format. A `.ogg` voice note as `mp3`; any uploaded video that is not already H.264 MP4 (HEVC, `.mov`, webm) as `mp4` — the default for every video upload, see **Playable video** below. An audio `format` from a video drops the picture. |
| `trim` | `{ operation: "trim", input, start?, end?, format? }` | The part between `start` and `end`, in seconds. `format` defaults to the input's own. |
| `concat` | `{ operation: "concat", inputs: [...], format? }` | The inputs played one after another. Video clips are letterboxed to the first clip's size; every clip must have sound, or none of them. `format` defaults to the first input's. |
| `mix` | `{ operation: "mix", inputs: [...], volumes?, format? }` | The audio tracks layered on top of each other — a voice over music. The longest sets the length; `volumes` is one multiplier per input (`1` = as is, `0.3` = quiet). Audio formats only; defaults to `mp3`. |
| `addAudio` | `{ operation: "addAudio", video, audio, volume?, loop?, keepVideoAudio?, format? }` | The video with the audio track laid under it. `loop: true` repeats a short track for the whole video; `keepVideoAudio` (default `true`) mixes with the video's own sound rather than replacing it. Video formats only; defaults to `mp4`. |
| `captions` | `{ operation: "captions", input, language?, prompt? }` | A WebVTT caption file of everything said in the video (or audio file), stored **beside it** at `captionKeyFor(input)`. `input` must be a key in the app's storage, not a URL. `language` is the spoken language as an ISO 639-1 code (detected when omitted); `prompt` lists names and terms the speaker is likely to say. No `format`. See **Captions** below. |

A file whose name has no known extension needs an explicit `format` where it would
otherwise default. At most 8 inputs per job, 2 GB per input, 30 minutes per job.
`captions` is the exception to the input limit: the platform reads the stored video
in place, so a multi-gigabyte recording captions like a short one.

**Background music under a generated video** is `addAudio` with the Remotion render's key
as `video` — render first, then add the track once `status()` reports the render succeeded.

**The words in a video** are the `captions` operation — see below. `convert` to `mp3`
followed by `createAI(env).transcribe({ audio: { key } })` (the `ai-sdk` skill) is only
for a short clip whose plain text the app needs right away; it is capped at 10 MB of
audio and never the way to caption an uploaded video.

## Playable video: every upload that is not H.264 MP4 is converted

Only H.264 picture with AAC (or no) sound in an MP4 container plays on every phone and
browser. An iPhone export is often HEVC and a screen recording often `.mov`; both parse
(the duration shows) and then fail with "This Video Could Not Be Loaded" on an iPhone,
Android Chrome and most Windows browsers. So `convert` to `mp4` is the default for
**every** uploaded video, not something the app builder asks for. `convertForPlayback`
from `~stencil/media` reads the stored file's headers and queues the job only when it is
needed, returning `null` for a file that already plays:

```ts
import { convertForPlayback } from "~stencil/media";

const job = await convertForPlayback(env, storage, video.key); // MediaJob | null
if (job) await db.update(videos).set({ convertJobId: job.jobId, convertStatus: "processing" }).where(eq(videos.id, video.id));
```

Poll `status(jobId)` as below; on `succeeded` save its `key` as the row's `playableKey`
and serve `playableKey ?? key`, so the original plays until the job lands. Keep the
original in storage and delete both with the row. The `storage` skill's video section
shows the row and the player.

## Captions: every uploaded video gets a caption file beside it

One job, hours of video included. The platform pulls the audio out of the stored video, cuts it at
silences into pieces its speech model accepts, transcribes each piece, shifts the
timings back into place and writes one WebVTT file at `captionKeyFor(videoKey)` (from
`~stencil/storage`) — the video's own key plus `.vtt`. Never split a video by hand,
never loop `trim` + `transcribe`, never upload the video somewhere else for this. The
one limit is time, not size: a job still running after three hours of processing is
stopped with the error `render exceeded maximum time`. `prompt` is at most 1000
characters and is passed whole to every piece; put the names first anyway, since
the end of the previous piece's text is appended to it as far as room allows.

Start the job right after the upload completes, in the same action that saves the
video's key, and keep the `jobId` on the row:

```ts
import { createMedia } from "~stencil/media";

const { jobId } = await createMedia(env).transform({
  operation: "captions",
  input: video.key,
  prompt: "Names that come up: Stencil, Nana, BO/SM", // optional: steers spelling
});
await db.update(videos).set({ captionsJobId: jobId, captionsStatus: "processing" }).where(eq(videos.id, video.id));
```

Poll `status(jobId)` from a resource route exactly as above. On `succeeded` the `key` is
`captionKeyFor(video.key)`: set `captionsStatus: "ready"` on the row. On `failed`, show
`error` — "the video has no audio track to caption" is the common one.

**Play it.** Serve the caption file through the same file route as the video (it is a
stored object like any other; the route already serves `text/vtt` inline) and hand both
URLs to `<VideoPlayer>`:

```tsx
import { VideoPlayer } from "~stencil/ui/video/player";

<VideoPlayer
  src={`/api/files/${video.key}`}
  captions={video.captionsStatus === "ready" ? `/api/files/${captionKeyFor(video.key)}` : null}
  captionsLang="en"
  className="w-full rounded-lg"
/>
```

The browser's own controls carry the captions switch, speed and fullscreen. Pass
`captions={null}` while the job runs or when there is no file; the player then simply
shows no captions control. `captionsOn={false}` starts with them hidden.

**Let the app builder fix the words.** Generated captions have mistakes, so when the
brief asks for editing or approval before publishing, read the stored `.vtt` into a
textarea (`storage.get(captionKeyFor(key))`), save the edited text back to the **same
key** with `storage.put(captionKeyFor(key), text, { httpMetadata: { contentType: "text/vtt" } })`,
and keep an `approved` flag on the row to decide when the player gets the file. A caption
file the app builder uploads by hand goes under the same key.

**Delete together.** `deleteStoredFiles(storage, video.key, captionKeyFor(video.key))`
when the video's row goes — the caption file is the row's file too.

## Poll for status — from a resource route, never `useEffect` fetch

`status(jobId)` returns `queued | processing (percent) | succeeded (key, durationSeconds)
| failed (error) | cancelled`. Drive progress with a **resource route + `useFetcher`**,
exactly as the `remotion` skill does.

```ts
// app/routes/api.media-status.$jobId.tsx — resource route
import { createMedia } from "~stencil/media";
export async function loader({ params, context }: Route.LoaderArgs) {
  return createMedia(context.cloudflare.env).status(params.jobId!);
}
```

```tsx
// In the component: poll the resource route on an interval with useFetcher.
const fetcher = useFetcher<typeof loader>();
useEffect(() => {
  const id = setInterval(() => fetcher.load(`/api/media-status/${jobId}`), 2000);
  return () => clearInterval(id);
}, [jobId]);
const percent = fetcher.data?.percent ?? 0;
```

When the poll comes back `succeeded`, write `key` onto your row and stop polling. On
`failed`, show `error` — it names the input and the reason (no audio track, a start past
the end, an unreadable file) so the app user can fix the upload. `cancel(jobId)` stops a
running job.

## Serve the result from your own route

On `succeeded`, `status(jobId)` gives an R2 `key` in the app's own storage. Serve it with
**range requests** so seeking works — the media-serving pattern in the **`storage`** skill:

```tsx
<audio src={`/api/files/${track.resultKey}`} controls preload="metadata" />
```

**The app owns its files.** Keep the `jobId` and the key in D1 against your domain row,
and when you delete the record, delete the R2 objects too (`deleteStoredFiles`). The
platform never prunes app content on a timer.

## Checklist

- Media work goes through `createMedia(env).transform` in a loader/action — no npm media
  libraries, no processing in the browser.
- Inputs are keys the app stored (through the `storage` skill's upload paths) or URLs.
- Store the `jobId` on your own row at request time; poll `status()` via a resource route
  + `useFetcher`; save the `key` on `succeeded`; show `error` on `failed`.
- Serve the result with range requests; delete the R2 object when you delete the record.
- Pick the operation that matches the brief: voice over music is `mix`, music under a
  video is `addAudio`, clips in a row is `concat`, captions, subtitles or a transcript
  on an uploaded video is `captions`.
- Every uploaded video goes through `convertForPlayback` in the action that saves its
  key, so HEVC and `.mov` uploads become H.264 `mp4` without being asked; "make it play
  on an iPhone" for an audio file is `convert` to `m4a`.
- Captions live at `captionKeyFor(videoKey)`, play through `<VideoPlayer captions>`, and
  are deleted with the video.
