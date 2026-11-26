import { BACKEND_BASE, createBackendFetch } from "./backend";

/** A job's lifecycle: queued → processing → one of succeeded / failed / cancelled. */
export type MediaStatus = "queued" | "processing" | "succeeded" | "failed" | "cancelled";

export type VideoFormat = "mp4" | "webm";
export type AudioFormat = "mp3" | "wav" | "ogg" | "m4a";
export type MediaFormat = VideoFormat | AudioFormat;

/** Turn the speech in a stored video (or audio file), hours long included, into a WebVTT
 *  caption file stored beside it, at `captionKeyFor(input)` (`~stencil/storage`).
 *  The platform extracts, splits and transcribes; the file's size is not a limit. */
export interface CaptionsRequest {
  operation: "captions";
  /** A key in the app's own storage — never a URL. */
  input: string;
  /** The spoken language as an ISO 639-1 code (`"en"`). Detected when omitted. */
  language?: string;
  /** Names and terms the speaker is likely to say, to steer their spelling. */
  prompt?: string;
}

/**
 * One operation over stored media. Every file reference is an app-storage key
 * (`uploads/voice.mp3`) or an absolute http(s) URL. Where `format` is optional
 * it defaults as noted; a file whose name has no known extension needs it.
 */
export type MediaRequest =
  | CaptionsRequest
  /** Re-encode one file into another format — a `.mov` into `mp4`, a voice note into `mp3`. */
  | { operation: "convert"; input: string; format: MediaFormat }
  /** Keep the part between `start` and `end` (seconds). `format` defaults to the input's own. */
  | { operation: "trim"; input: string; start?: number; end?: number; format?: MediaFormat }
  /** Play the inputs one after another. Video clips are letterboxed to the first
   *  clip's size; every clip must have sound, or none. `format` defaults to the first input's. */
  | { operation: "concat"; inputs: string[]; format?: MediaFormat }
  /** Layer audio tracks on top of each other, the longest sets the length.
   *  `volumes` is one multiplier per input (1 = as is). `format` defaults to mp3. */
  | { operation: "mix"; inputs: string[]; volumes?: number[]; format?: AudioFormat }
  /** Lay an audio track under a video. `loop` repeats it to the video's length,
   *  `keepVideoAudio` (default true) mixes it with the video's own sound rather
   *  than replacing it. `format` defaults to mp4. */
  | {
      operation: "addAudio";
      video: string;
      audio: string;
      volume?: number;
      loop?: boolean;
      keepVideoAudio?: boolean;
      format?: VideoFormat;
    };

export interface MediaJob {
  /** The job id — poll `status(jobId)`, and store it against your own row. */
  jobId: string;
  status: MediaStatus;
}

export interface MediaJobStatus {
  jobId: string;
  status: MediaStatus;
  /** Progress 0–100 while `processing`. */
  percent: number | null;
  /** The finished file's R2 key in the app's own storage, once `succeeded`. Serve
   *  it from your own route with range requests (see the `storage` skill). For a
   *  `captions` job this is `captionKeyFor(input)`. */
  key: string | null;
  /** Billed container seconds, recorded for succeeded, failed and cancelled runs. */
  durationSeconds: number | null;
  /** The failure reason when `failed`. */
  error: string | null;
}

/**
 * Combine and convert the app's stored audio and video, proxied through the
 * Stencil backend service. No keys required. Server-side only (loaders /
 * actions / scheduled handlers). Jobs run on the platform and return an R2 key
 * in the app's storage — never bytes — so keep the `jobId` and the finished key
 * in D1 and serve the file from your own route.
 */
export function createMedia(env: Env) {
  const backendFetch = createBackendFetch(env);

  return {
    /** Start a job and return immediately with a `jobId` to poll. */
    async transform(request: MediaRequest): Promise<MediaJob> {
      const res = await backendFetch(`${BACKEND_BASE}/media/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`Media job failed: ${await res.text()}`);
      return res.json() as Promise<MediaJob>;
    },

    /** The current state of one job. */
    async status(jobId: string): Promise<MediaJobStatus> {
      const res = await backendFetch(`${BACKEND_BASE}/media/status/${encodeURIComponent(jobId)}`);
      if (!res.ok) throw new Error(`Media job status failed: ${await res.text()}`);
      return res.json() as Promise<MediaJobStatus>;
    },

    /** Cancel a job. Kills a running one (and still bills its partial time); a
     *  still-queued job is just marked cancelled. */
    async cancel(jobId: string): Promise<{ ok: boolean; status: MediaStatus }> {
      const res = await backendFetch(`${BACKEND_BASE}/media/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(`Media job cancel failed: ${await res.text()}`);
      return res.json() as Promise<{ ok: boolean; status: MediaStatus }>;
    },
  };
}

export type Media = ReturnType<typeof createMedia>;

// An MP4-family brand with H.264 picture and AAC (or no) sound is what every phone
// and browser decodes. QuickTime (`qt  `), HEVC (`hvc1`/`hev1`), VP9 and the rest are not.
const PLAYABLE_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1"]);
const PLAYABLE_SAMPLE_ENTRIES = new Set(["avc1", "avc3", "mp4a"]);
const SAMPLE_TABLE_PATH = new Set(["trak", "mdia", "minf", "stbl"]);
// A `moov` past this is not worth buffering in the Worker; the file is converted instead.
const MAX_BOX_BYTES = 32 * 1024 * 1024;

function fourcc(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

/** The boxes laid end to end between `start` and `end` of an ISO BMFF buffer. */
function* boxes(view: DataView, start: number, end: number) {
  for (let at = start; at + 8 <= end; ) {
    let size = view.getUint32(at);
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) size = end - at;
    if (size < header) return;
    yield { type: fourcc(view, at + 4), body: at + header, end: Math.min(at + size, end) };
    at += size;
  }
}

/** Every track's sample-entry codes (`avc1`, `hvc1`, `mp4a`, …) from a `moov` body. */
function sampleEntries(view: DataView, start: number, end: number, out: string[] = []): string[] {
  for (const box of boxes(view, start, end)) {
    if (SAMPLE_TABLE_PATH.has(box.type)) sampleEntries(view, box.body, box.end, out);
    if (box.type !== "stsd") continue;
    const count = view.getUint32(box.body + 4);
    for (let i = 0, at = box.body + 8; i < count && at + 8 <= box.end; i++) {
      out.push(fourcc(view, at + 4));
      const size = view.getUint32(at);
      if (size < 8) break;
      at += size;
    }
  }
  return out;
}

async function readRange(storage: R2Bucket, key: string, offset: number, length: number): Promise<DataView> {
  const object = await storage.get(key, { range: { offset, length } });
  if (!object) throw new Error(`No stored file at ${key}`);
  return new DataView(await object.arrayBuffer());
}

/** Whether a stored video already plays everywhere — H.264 picture, AAC or no sound,
 *  in an MP4 container with `moov` before `mdat` — read from its box headers, so only
 *  the `ftyp` and `moov` boxes leave storage. Anything unreadable as MP4 counts as not playable. */
export async function isPlayableVideo(storage: R2Bucket, key: string): Promise<boolean> {
  const head = await storage.head(key);
  if (!head) throw new Error(`No stored file at ${key}`);
  let brands: string[] | null = null;
  let entries: string[] | null = null;
  for (let at = 0; at + 8 <= head.size && !(brands && entries); ) {
    const header = await readRange(storage, key, at, Math.min(16, head.size - at));
    let size = header.getUint32(0);
    let headerBytes = 8;
    if (size === 1 && header.byteLength >= 16) {
      size = Number(header.getBigUint64(8));
      headerBytes = 16;
    } else if (size === 0) size = head.size - at;
    const type = fourcc(header, 4);
    if (size < headerBytes || (at === 0 && type !== "ftyp")) return false;
    // A `moov` after `mdat` makes a phone fetch the tail before it can seek; the convert writes fast start.
    if (type === "mdat" && !entries) return false;
    if (type === "ftyp" || type === "moov") {
      if (size > MAX_BOX_BYTES) return false;
      const body = await readRange(storage, key, at + headerBytes, size - headerBytes);
      if (type === "ftyp") {
        brands = [];
        for (let i = 0; i + 4 <= body.byteLength; i += 4) if (i !== 4) brands.push(fourcc(body, i));
      } else entries = sampleEntries(body, 0, body.byteLength);
    }
    at += size;
  }
  if (!brands?.some((b) => PLAYABLE_BRANDS.has(b)) || !entries?.length) return false;
  return entries.every((e) => PLAYABLE_SAMPLE_ENTRIES.has(e)) && entries.some((e) => e !== "mp4a");
}

/** Queue the `convert` that turns an uploaded video into H.264 MP4, the form every
 *  phone and browser plays, unless `isPlayableVideo` says it already is (then `null`).
 *  Keep the `jobId` on the video's row; `status(jobId).key` is the file to serve once
 *  `succeeded`. The original stays in storage and is served until then. */
export async function convertForPlayback(env: Env, storage: R2Bucket, key: string): Promise<MediaJob | null> {
  if (await isPlayableVideo(storage, key)) return null;
  return createMedia(env).transform({ operation: "convert", input: key, format: "mp4" });
}
