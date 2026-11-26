import { BACKEND_BASE, createBackendFetch, withFeature } from "./backend";

export interface SpeakParams {
  /** What to say. Required; up to 5,000 characters a call. */
  text: string;
  /** A voice id from `voices()`. Defaults to the platform's default voice. */
  voice?: string;
  /**
   * `eleven_multilingual_v2` (default) or `eleven_v3` for the best-sounding speech;
   * `eleven_flash_v2_5` or `eleven_turbo_v2_5` at half the cost and faster.
   */
  model?: string;
  /** Also return when each word starts and ends, for text that follows the voice. */
  timestamps?: boolean;
  /** The in-app feature this call belongs to, shown on the app's Usage page. */
  feature?: string;
}

export interface MusicParams {
  /** The music to compose: genre, mood, instruments, tempo. Required. */
  prompt: string;
  /** Length in seconds, 3 to 300. Required. */
  seconds: number;
  /** No vocals. Default `true`. */
  instrumental?: boolean;
  feature?: string;
}

export interface SoundEffectParams {
  /** The sound, described in a few words ("glass shattering on a tile floor"). Required. */
  text: string;
  /** Length in seconds, 0.5 to 30. Omit to let the generator pick. */
  seconds?: number;
  feature?: string;
}

export interface VoicesParams {
  /** Matches voice names and descriptions. */
  search?: string;
  gender?: string;
  accent?: string;
  /** ISO 639-1 code, such as `en` or `es`. */
  language?: string;
}

export interface AudioVoice {
  id: string;
  name: string;
  description: string;
  /** What the voice sounds like: gender, age, accent, use case. */
  labels: Record<string, string>;
  /** A short sample of the voice, playable in an `<audio>` element. */
  previewUrl: string | null;
}

export interface WordTiming {
  text: string;
  /** Seconds from the start of the clip. */
  start: number;
  end: number;
}

export interface GeneratedAudio {
  /** The clip as a byte stream — pass straight to `createStorage().put(key, body)`;
   *  the stream is known-length, so R2 accepts it directly. */
  body: ReadableStream<Uint8Array>;
  /** Always `audio/mpeg` (mp3). */
  contentType: string;
  /** The clip's length in seconds. */
  seconds: number;
  /** Each word's place in the clip; only from `speak({ timestamps: true })`. */
  words?: WordTiming[];
}

/**
 * Thrown when the provider's content check turned the text or prompt down. The same input is
 * refused every time, so a retry is pointless: tell the person and let them reword it. Not an
 * outage, so log it as a warning.
 */
export class AudioRefusedError extends Error {
  constructor(detail?: string) {
    super(`Audio generation refused: the provider's content check turned this request down${detail ? ` (${detail})` : ""}`);
    this.name = "AudioRefusedError";
  }
}

type Failure = { error?: string; detail?: string; code?: string };

/** The reply's error as a sentence an app can show; a content refusal as `AudioRefusedError`. */
async function failure(res: Response, what: string): Promise<Error> {
  const text = await res.text();
  let parsed: Failure = {};
  try {
    parsed = JSON.parse(text) as Failure;
  } catch {
    // Not JSON: the raw body is the reason.
  }
  if (res.status === 422 && parsed.code === "content_refused") return new AudioRefusedError(parsed.detail);
  if (parsed.code === "cap") return new Error(parsed.error ?? `${what} limit reached`);
  if (parsed.code === "not_configured") return new Error(`${what} is not available right now`);
  return new Error(`${what} failed: ${parsed.error ?? text}`);
}

/** A stream R2 accepts without buffering again: its length is declared up front. */
function knownLengthStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const { readable, writable } = new FixedLengthStream(bytes.byteLength);
  const writer = writable.getWriter();
  // A reader that stops early fails this write; the readable side already ends with that error.
  writer.write(bytes).then(() => writer.close()).catch(() => {});
  return readable;
}

/**
 * Speech, music and sound effects made at runtime on the platform. No keys; server-side only.
 * Pass the returned `body` straight to `createStorage().put(key, body)` and keep only the
 * key in D1; play it from the app's file route. See the runtime-audio skill.
 */
export function createAudio(env: Env) {
  const backendFetch = createBackendFetch(env);

  async function generate(path: string, what: string, feature: string | undefined, body: object): Promise<Response> {
    const send = () =>
      backendFetch(`${BACKEND_BASE}/audio/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const res = await (feature ? withFeature(feature, send) : send());
    if (!res.ok) throw await failure(res, what);
    if (!res.body) throw new Error(`${what} returned an empty response`);
    return res;
  }

  function clipOf(res: Response): GeneratedAudio {
    return {
      body: res.body as ReadableStream<Uint8Array>,
      contentType: res.headers.get("Content-Type") ?? "audio/mpeg",
      seconds: Number(res.headers.get("X-Audio-Seconds")) || 0,
    };
  }

  return {
    /** Turn text into speech. */
    async speak({ feature, ...params }: SpeakParams): Promise<GeneratedAudio> {
      const res = await generate("speech", "Speech", feature, params);
      if (!params.timestamps) return clipOf(res);
      const timed = (await res.json()) as { audio: string; contentType: string; seconds: number; words: WordTiming[] };
      const bytes = Uint8Array.from(atob(timed.audio), (ch) => ch.charCodeAt(0));
      return { body: knownLengthStream(bytes), contentType: timed.contentType, seconds: timed.seconds, words: timed.words };
    },

    /** Compose a piece of music from a description. Takes up to a few minutes for a long piece. */
    async music({ feature, ...params }: MusicParams): Promise<GeneratedAudio> {
      return clipOf(await generate("music", "Music", feature, params));
    },

    /** Make a sound effect from a short description. */
    async soundEffect({ feature, ...params }: SoundEffectParams): Promise<GeneratedAudio> {
      return clipOf(await generate("sfx", "Sound effect", feature, params));
    },

    /** The voices `speak` can use, each with what it sounds like. */
    async voices(params: VoicesParams = {}): Promise<AudioVoice[]> {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
      const res = await backendFetch(`${BACKEND_BASE}/audio/voices?${query.toString()}`);
      if (!res.ok) throw await failure(res, "Voice list");
      return ((await res.json()) as { voices: AudioVoice[] }).voices;
    },
  };
}

export type Audio = ReturnType<typeof createAudio>;
