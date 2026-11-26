/**
 * The browser half of the platform uploader: `uploadFile` sends one file to the app's upload
 * route (`handleUpload` in `./server`) in parts with progress, retries and a clean abort;
 * `uploadFiles` sends many, a few at a time, and remembers the batch in the browser so a reload
 * continues it. A refusal is an `UploadError` with a plain message.
 */

const PART_BYTES = 10 * 1024 * 1024;
const PART_ATTEMPTS = 4;
const RETRY_BASE_MS = 500;
const SNIFF_BYTES = 32;
const DEFAULT_ROUTE = "/api/upload";
const DEFAULT_CONCURRENCY = 3;
const SAVED_DB = "stencil-upload";
const SAVED_STORE = "files";
// R2 drops an unfinished upload after 7 days; a saved one is forgotten a day sooner.
const SAVED_MS = 6 * 24 * 60 * 60 * 1000;
const GENERIC_FAILURE = "The upload didn't finish. Check your connection and try again.";

export class UploadError extends Error {
  constructor(
    message: string,
    readonly file: File,
    /** The HTTP status behind a refusal; undefined when the connection failed. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface UploadOptions {
  /** The app's upload route. Defaults to `/api/upload`. */
  route?: string;
  /** Bytes sent so far out of the file's size, as 0–100. */
  onProgress?: (percent: number) => void;
  /** Aborting stops the upload and drops the half-stored file. */
  signal?: AbortSignal;
}

export interface UploadedFile {
  key: string;
  /** `/api/files/<key>`, ready for `src` or `href`. */
  url: string;
  size: number;
  contentType: string;
  file: File;
  /** True when an earlier visit already stored this file and it was not sent again. */
  resumed?: boolean;
}

/** One file of a batch that a reload or a lost connection cut short. */
export interface InterruptedUpload {
  /** The file's name, with its folder path when it was picked as part of a folder. */
  name: string;
  size: number;
  /** True when the whole file reached storage before the interruption. */
  stored: boolean;
}

interface SavedFile {
  id: string;
  name: string;
  size: number;
  savedAt: number;
  uploadId?: string;
  key?: string;
  contentType?: string;
  /** Only parts the server answered for, so each etag is a receipt and not a guess. */
  parts: { partNumber: number; etag: string }[];
  done?: boolean;
}

/** Which saved batch a call means: the route it uploads to and the record it uploads into. */
export interface BatchScope {
  /** The app's upload route. Defaults to `/api/upload`. */
  route?: string;
  /** The record the files belong to, such as `gallery:42`, so its batch is offered only there. */
  batch?: string;
}

export interface UploadFilesOptions extends Omit<UploadOptions, "onProgress">, BatchScope {
  /** How many files travel at once. Defaults to 3. */
  concurrency?: number;
  /** Bytes sent across every file, as 0–100. */
  onProgress?: (percent: number) => void;
  /** Bytes sent so far of one file, as 0–100, for a progress row per file. */
  onFileProgress?: (file: File, percent: number) => void;
  /** Called as each file finishes or fails, in completion order. */
  onFile?: (result: { file: File; uploaded?: UploadedFile; error?: UploadError }) => void;
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

let savedDb: Promise<IDBDatabase> | undefined;

// Best effort: where the browser has no IndexedDB or refuses the write, the
// upload still runs and only loses the ability to continue after a reload.
async function saved<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  try {
    savedDb ??= (() => {
      const open = indexedDB.open(SAVED_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(SAVED_STORE, { keyPath: "id" });
      return request(open);
    })();
    const db = await savedDb;
    return await request(run(db.transaction(SAVED_STORE, mode).objectStore(SAVED_STORE)));
  } catch (err) {
    console.warn("[upload] batch progress was not saved, so a reload cannot continue it:", err);
    return undefined;
  }
}

// Last-modified is part of the match so an edited file never continues onto the old file's parts.
function savedFile(scope: string, file: File): SavedFile {
  const name = file.webkitRelativePath || file.name;
  const id = `${scope}${name}\n${file.size}\n${file.lastModified}`;
  return { id, name, size: file.size, savedAt: Date.now(), parts: [] };
}

// The id prefix of one route's one batch; a call that names no batch sees only unnamed ones.
const savedScope = ({ route = DEFAULT_ROUTE, batch = "" }: BatchScope) => `${route}\n${batch}\n`;

const savedRange = (scope: string) => IDBKeyRange.bound(scope, `${scope}\uffff`);

async function savedFiles(scope: string): Promise<SavedFile[]> {
  const all = (await saved<SavedFile[]>("readonly", (s) => s.getAll(savedRange(scope)))) ?? [];
  return all.filter((f) => Date.now() - f.savedAt < SAVED_MS);
}

// One call's own records, so an earlier batch still waiting in the same scope keeps its own.
async function forgetBatch(states: Iterable<SavedFile>) {
  const ids = [...new Set([...states].map((f) => f.id))];
  if (ids.length) await saved("readwrite", (s) => ids.map((id) => s.delete(id)).at(-1)!);
}

function abortUpload(route: string, uploadId: string, key?: string) {
  return fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "abort", uploadId, key }),
    keepalive: true,
  }).catch(() => undefined);
}

// A refusal carries `{ error }` in plain words; a reply that is not JSON came
// from the edge, not the route, so it is translated by status.
async function errorFrom(res: { status: number; text: () => Promise<string> }, file: File) {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: string };
    if (body.error) return new UploadError(body.error, file, res.status);
  } catch {
    // not JSON: fall through to the status
  }
  const message = res.status === 413 ? "That file is too large." : GENERIC_FAILURE;
  return new UploadError(message, file, res.status);
}

async function postJson<T>(route: string, body: unknown, file: File, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new UploadError(GENERIC_FAILURE, file);
  }
  if (!res.ok) throw await errorFrom(res, file);
  return (await res.json()) as T;
}

// XMLHttpRequest, because fetch reports no upload progress.
function sendPart(
  route: string,
  form: FormData,
  file: File,
  onBytes: (sent: number) => void,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onerror = () => reject(new UploadError(GENERIC_FAILURE, file));
    xhr.onabort = () => reject(signal?.reason ?? new UploadError("The upload was cancelled.", file));
    xhr.onload = async () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as { etag: string });
      } else {
        reject(await errorFrom({ status: xhr.status, text: async () => xhr.responseText }, file));
      }
    };
    xhr.open("POST", route);
    xhr.send(form);
  });
}

// A connection failure or a server fault is retried with a growing pause; a
// refusal (4xx) is final, and so is an abort.
function retryable(err: unknown): boolean {
  return err instanceof UploadError && (err.status === undefined || err.status >= 500);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** Upload one file. Resolves with the stored key and URL, or rejects with an `UploadError`. */
export function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadedFile> {
  return sendFile(file, options, savedFile(savedScope(options), file), false);
}

// `state` is what is known about the file so far: empty for a first send, or
// what an earlier visit saved. With `persist` every step forward is saved.
async function sendFile(
  file: File,
  options: UploadOptions,
  state: SavedFile,
  persist: boolean,
): Promise<UploadedFile> {
  const route = options.route ?? DEFAULT_ROUTE;
  const { signal } = options;
  const report = (sent: number) =>
    options.onProgress?.(Math.min(100, Math.round((sent / Math.max(1, file.size)) * 100)));
  const keep = async (changes: Partial<SavedFile>) => {
    Object.assign(state, changes);
    if (persist) await saved("readwrite", (s) => s.put(state));
  };
  const restart = { uploadId: undefined, key: undefined, parts: [], done: false };

  const resumed = Boolean(state.key);
  if (state.key) {
    // The server, not the saved state, says whether the finished file is in storage.
    const stored = await postJson<{ size: number | null; url: string }>(
      route,
      { action: "status", key: state.key },
      file,
      signal,
    );
    if (stored.size === file.size) {
      await keep({ done: true });
      report(file.size);
      const contentType = state.contentType ?? file.type;
      return { key: state.key, url: stored.url, size: stored.size, contentType, file, resumed: true };
    }
    if (state.done) await keep(restart);
  }

  if (!state.uploadId) {
    const head = toBase64(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    await keep(
      await postJson<{ uploadId: string; key: string; contentType: string }>(
        route,
        { action: "create", name: file.name, type: file.type, size: file.size, head },
        file,
        signal,
      ),
    );
  }
  const { uploadId, key, contentType } = state as Required<SavedFile>;
  const total = Math.max(1, Math.ceil(file.size / PART_BYTES));

  try {
    for (let i = 0; i < total; i++) {
      const partNumber = i + 1;
      const offset = i * PART_BYTES;
      if (state.parts.some((p) => p.partNumber === partNumber)) {
        report(Math.min(file.size, offset + PART_BYTES));
        continue;
      }
      const form = new FormData();
      form.append("action", "part");
      form.append("uploadId", uploadId);
      form.append("key", key);
      form.append("partNumber", String(partNumber));
      form.append("chunk", file.slice(offset, offset + PART_BYTES));
      for (let attempt = 1; ; attempt++) {
        try {
          const { etag } = await sendPart(route, form, file, (sent) => report(offset + sent), signal);
          await keep({ parts: [...state.parts, { partNumber, etag }] });
          break;
        } catch (err) {
          if (attempt >= PART_ATTEMPTS || !retryable(err) || signal?.aborted) throw err;
          await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        }
      }
    }
    const done = await postJson<{ key: string; url: string; size: number }>(
      route,
      { action: "complete", uploadId, key, parts: state.parts, name: file.name, contentType },
      file,
      signal,
    );
    await keep({ done: true });
    report(file.size);
    return { ...done, contentType, file };
  } catch (err) {
    const answered = err instanceof UploadError && err.status !== undefined;
    // A dropped connection leaves the half-sent file in place for the next visit to continue.
    if (persist && retryable(err) && !signal?.aborted && !(resumed && answered)) throw err;
    // The failure being thrown is the one to report; the abort only keeps a half file out of storage.
    await abortUpload(route, uploadId, key);
    // The server no longer takes the saved upload (R2 dropped it, or it was
    // aborted), so the file is sent whole, once.
    if (resumed && answered && !signal?.aborted) {
      await keep(restart);
      return sendFile(file, options, state, persist);
    }
    if (persist) await saved("readwrite", (s) => s.delete(state.id));
    throw err;
  }
}

/**
 * Upload many files — a multi-select, a dropped folder, a whole shoot — a few
 * at a time. Every file is tried; the result lists what landed and what was
 * refused or failed, each failure with its sentence for the app user.
 *
 * The batch is remembered in this browser until the call returns. Called again
 * with the same files and the same `batch` after a reload, it skips the stored ones
 * (`resumed`), continues a half-sent one from its last finished part and sends the rest.
 */
export async function uploadFiles(
  files: Iterable<File>,
  options: UploadFilesOptions = {},
): Promise<{ uploaded: UploadedFile[]; failed: { file: File; error: UploadError }[] }> {
  const queue = [...files];
  const route = options.route ?? DEFAULT_ROUTE;
  const scope = savedScope(options);
  const known = new Map((await savedFiles(scope)).map((f) => [f.id, f]));
  const states = new Map<File, SavedFile>();
  const fresh: SavedFile[] = [];
  for (const file of queue) {
    const blank = savedFile(scope, file);
    const state = known.get(blank.id) ?? blank;
    if (state === blank) fresh.push(blank);
    // A second file with the same name, size and date starts clean instead of sharing one upload.
    known.delete(blank.id);
    states.set(file, state);
  }
  // Every file is saved before the first byte moves, so a reload knows the files still waiting too.
  if (fresh.length) await saved("readwrite", (s) => fresh.map((state) => s.put(state)).at(-1)!);
  const uploaded: UploadedFile[] = [];
  const failed: { file: File; error: UploadError }[] = [];
  const totalBytes = Math.max(1, queue.reduce((sum, f) => sum + f.size, 0));
  const sent = new Map<File, number>();
  const reportAll = () => {
    let bytes = 0;
    for (const n of sent.values()) bytes += n;
    options.onProgress?.(Math.min(100, Math.round((bytes / totalBytes) * 100)));
  };

  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        const result = await sendFile(
          file,
          {
            route,
            signal: options.signal,
            onProgress: (percent) => {
              sent.set(file!, (percent / 100) * file!.size);
              options.onFileProgress?.(file!, percent);
              reportAll();
            },
          },
          states.get(file)!,
          true,
        );
        uploaded.push(result);
        options.onFile?.({ file, uploaded: result });
      } catch (err) {
        if (options.signal?.aborted) {
          await forgetBatch(states.values());
          throw err;
        }
        const error = err instanceof UploadError ? err : new UploadError(GENERIC_FAILURE, file);
        failed.push({ file, error });
        options.onFile?.({ file, error });
      }
    }
  };
  const lanes = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, queue.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  // While any file of this call is unfinished, its stored ones stay too, so a re-pick skips them.
  const mine = new Set([...states.values()].map((f) => f.id));
  const left = (await savedFiles(scope)).filter((f) => mine.has(f.id));
  if (left.every((f) => f.done)) await forgetBatch(left);
  return { uploaded, failed };
}

export interface UploadRules {
  /** The types the route stores, as `handleUpload` was given them; null when it stores any. */
  accept: string[] | null;
  maxBytes: number | null;
  /** What the field takes, in words: "Images or PDF, up to 20 MB per file." */
  hint: string | null;
}

/** What the upload route accepts for this app user right now, to show before a file is picked. */
export async function uploadRules(route = DEFAULT_ROUTE): Promise<UploadRules> {
  const res = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rules" }),
  });
  if (!res.ok) throw new Error(`The upload route answered ${res.status} for its rules.`);
  return (await res.json()) as UploadRules;
}

/**
 * The files of this scope's `uploadFiles` batch that a reload or a lost connection cut short, or `[]`.
 * The browser cannot keep the files, so the app user picks them again for `uploadFiles`.
 */
export async function interruptedUploads(scope: BatchScope = {}): Promise<InterruptedUpload[]> {
  const files = await savedFiles(savedScope(scope));
  return files.map((f) => ({ name: f.name, size: f.size, stored: Boolean(f.done) }));
}

/** Forget the interrupted batch when the app user chooses not to continue, and drop its half-sent files. */
export async function forgetInterruptedUploads(scope: BatchScope = {}): Promise<void> {
  const route = scope.route ?? DEFAULT_ROUTE;
  const files = await savedFiles(savedScope(scope));
  for (const f of files) {
    if (!f.done && f.uploadId) void abortUpload(route, f.uploadId, f.key);
  }
  await saved("readwrite", (s) => s.delete(savedRange(savedScope(scope))));
}
