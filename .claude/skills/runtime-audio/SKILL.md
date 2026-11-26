---
name: runtime-audio
description: Making sound AT RUNTIME — text to speech (read aloud, a spoken reply from a coach or assistant, an audio version of a post or lesson, a voiced greeting), music (a jingle, a theme, a backing track from a description) and sound effects (a game sound, a notification chime, an ambience). Uses createAudio from ~stencil/audio (keyless, server-side, mp3 out). Load whenever the brief asks the app to speak, narrate, read something out, compose music or make a sound, and whenever an app builder asks whether text to speech is available or asks for an outside audio service by name. NOT for speech to text (the ai-sdk and voice-input skills) and NOT for mixing or converting audio the app already stores (the media-processing skill).
allowed-tools: createEntity
metadata:
  agents: [chat, builder]
---

# Runtime audio: speech, music and sound effects

`createAudio(env)` from `~stencil/audio` turns text into speech, a description into
music, and a few words into a sound effect, on the platform. No API keys. **Server-side
only**: loaders, actions or scheduled handlers, never the browser. Every result is an
mp3 stream you pipe into the app's storage.

Text to speech is available. Never tell an app builder it is not, never fall back to the
browser's `speechSynthesis` for read-aloud, and never look for a speech model on
`createAI`: speech lives here.

Never name the audio vendor to an app builder. When they ask for one by name ("can I
use ElevenLabs?"), answer that Stencil's built-in audio makes speech, music and sound
effects with no account or key of theirs, and neither confirm nor deny what runs
underneath. Model ids stay in code.

## Which call

| The brief wants | Call |
|---|---|
| Read aloud, a spoken reply, an audio version of a post, a voiced message | `speak` |
| Words that light up as they are spoken (read-along, karaoke-style captions) | `speak` with `timestamps: true` |
| A jingle, a theme tune, a backing track, focus or meditation music | `music` |
| A game sound, a chime, a whoosh, rain, a crowd | `soundEffect` |
| A sound described in words (a mechanical key, a door, rain), even a short UI sound | `soundEffect`, generated once and stored |
| Letting the app builder or an app user pick a voice | `voices` |

Not here: realtime or streaming speech, a conversation spoken live, cloning a person's
voice, changing one voice into another. Say plainly that those are not available.

**Synthesize or generate?** A sound the app builder described ("a heavy mechanical
keyboard click", "a creaky door") is generated with `soundEffect`: never synthesize it in
the browser, because a noise burst and an oscillator do not sound like the thing. The Web
Audio API is fine only for a bare beep or tone with no character asked for, or when the
brief says it wants no stored file.

## API

```ts
import { createAudio, AudioRefusedError } from "~stencil/audio";

const audio = createAudio(env);

const speech = await audio.speak({ text, voice, model, timestamps, feature });
const song = await audio.music({ prompt, seconds, instrumental, feature });
const effect = await audio.soundEffect({ text, seconds, feature });
const voices = await audio.voices({ search, gender, accent, language });
```

`createAudio` is a function you import from the `~stencil/audio` module in server code. There
is no audio tool, so do not search the tool list for one.

Each of the first three returns `{ body, contentType, seconds }`: the clip as a
known-length byte stream, `audio/mpeg`, and its length in seconds. `speak` with
`timestamps: true` also returns `words`: `{ text, start, end }` per word, in seconds.

- **`speak`** — `text` up to 5,000 characters. `voice` is a voice id from `voices()`;
  leave it out for the platform's default voice. `model` defaults to
  `eleven_multilingual_v2` (best quality, 29 languages); pass `eleven_flash_v2_5` when
  the reply must come back fast or the app speaks a lot, at half the cost. Split a text
  longer than 5,000 characters at paragraph breaks and store one clip per part.
- **`music`** — `prompt` describes genre, mood, instruments and tempo; `seconds` is
  required, 3 to 300. Instrumental unless `instrumental: false`. A long piece takes a
  minute or more to compose.
- **`soundEffect`** — `text` is a short description of the sound; `seconds` is optional,
  0.5 to 30.
- **`voices`** — up to 40 voices, each `{ id, name, description, labels, previewUrl }`.
  `labels` say what it sounds like (gender, age, accent, use case).
- **`feature`** — a short label ("lesson-read-aloud") shown on the app's Usage page.

## Store in R2, keep the key in D1

Never hold audio bytes in the database, and never generate the same clip twice. Make it
once, on an explicit action, write it to storage, keep the key and the length on the
record, and play the stored file from then on.

```ts
// app/routes/api.posts.$id.listen.tsx  (register in app/routes.ts)
import type { Route } from "./+types/api.posts.$id.listen";
import { createAudio, AudioRefusedError } from "~stencil/audio";
import { createStorage } from "~stencil/storage";
import { data } from "~stencil/data";

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = await data(request, env);
  const post = await db.from("posts").get(params.id);
  if (!post) throw new Response("Not found", { status: 404 });
  if (post.audioKey) return { ok: true as const, audioKey: post.audioKey };

  try {
    const { body, contentType, seconds } = await createAudio(env).speak({ text: post.body, feature: "post-listen" });
    const audioKey = `audio/posts/${post.id}.mp3`;
    await createStorage(env).put(audioKey, body, { httpMetadata: { contentType } });
    await db.from("posts").update(post.id, { audioKey, audioSeconds: seconds });
    return { ok: true as const, audioKey };
  } catch (error) {
    if (error instanceof AudioRefusedError) {
      console.warn("post audio refused", error.message);
      return { ok: false as const, error: "This text couldn't be read aloud. Try rewording it." };
    }
    console.error("post audio failed", error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Couldn't make the audio right now. Please try again." };
  }
}
```

Add the `audioKey` (text) and `audioSeconds` (number) fields to the entity with
`updateEntity` or `createEntity`. When the text changes, clear `audioKey` so the next
listen makes a fresh clip; delete the old file with the record (the `storage` skill).

## Play it

Serve the stored clip from the app's `api/files/*` route, built with `serveR2Object` as
the `storage` skill shows. That route answers range requests, which is what lets an
`<audio>` element seek. Never write a second serving route for audio.

```tsx
<audio src={`/api/files/${post.audioKey}`} controls preload="metadata" />
```

A browser plays sound only after a tap. A sound effect in a game or a spoken reply plays
from the click or key handler that caused it (`new Audio(url).play()`), never from an
effect on page load.

A sound that fires often (a key press, a notification) is loaded once and replayed, so
every play is instant. Make the clip on first use or at an explicit action, keep its key
in a settings row, pass the key from the loader, and never create a new `Audio` per press:

```tsx
const click = useRef<HTMLAudioElement | null>(null);
useEffect(() => {
  const el = new Audio(`/api/files/${clickKey}`);
  el.preload = "auto";
  click.current = el;
}, [clickKey]);

function playClick() {
  const el = click.current;
  if (!el) return;
  el.currentTime = 0;
  void el.play();
}
```

## Cast a voice

Pick the voice once and keep its id; never call `voices()` on every request.

- When the app builder describes the voice ("a warm British woman"), call `voices` with
  `gender`, `accent`, `language` or `search` in a loader or a one-off action, choose the
  closest match by `labels` and `description`, and write the chosen id into the code or
  a settings row. Tell the app builder which voice you picked by name.
- When app users choose their own voice, list `voices()` on a settings screen, play each
  `previewUrl` in an `<audio>` element, and store the chosen id on the app user's row.

## Read-along with timestamps

`speak({ text, timestamps: true })` returns `words`. Store them as JSON on the record
beside the key, and highlight the word whose `start <= currentTime < end` from the
`<audio>` element's `timeupdate` event. Words come back in spoken order, so the index of
the current word only moves forward.

## Limits and errors

Audio has generous limits that exist to stop abuse: per app per day, and per signed-in
app user per hour (10 clips, 20,000 characters of speech). A call past one throws a plain
`Error` whose message is a sentence written for the person, such as "This person has
reached the limit of 10 audio clips an hour. Try again later." Show `error.message`
beside the control.

- `AudioRefusedError` — the provider's content check turned the text or prompt down. The
  same input is refused every time: **never retry a refusal**, never reword it on your
  own. Show a message asking the person to reword, and log with `console.warn`.
- Any other `Error` — a limit, a text that is too long, or the service being unavailable.
  The message is safe to show. Log with `console.error`.

## Rules

- **Server-side only.** Never call it from the browser or a `useEffect`.
- **Pipe `body` into R2 and keep the key in D1.** Never audio bytes in D1, never a data URL.
- **Generate once, on an explicit action, and reuse the stored clip.** Never in a loader
  that runs on every page view, never for every row of a list at once.
- Show a pending state: speech takes a few seconds, music can take a minute or more.
- Catch `AudioRefusedError` apart from other failures, and never retry it.
- To lay a voice over music or put a track under a video, make both clips here and
  combine them with the `media-processing` skill.
