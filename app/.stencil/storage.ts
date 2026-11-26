import { contentDisposition } from "./files";
import { createImage } from "./image";
import { readCapped, safeFetch } from "./safe-fetch";
import { forgetStoredFiles } from "./stored-files";

/** How many times a momentary storage fault is retried, and the pause before
 *  each retry. Kept small so a bucket that is really down still fails fast. */
const PUT_RETRIES = 2;
const PUT_RETRY_MS = 250;

/** R2's generic internal error, whose message asks the caller to try again. */
function isTransientStorageError(error: unknown): boolean {
  return error instanceof Error && (error as Partial<R2Error>).code === 10001;
}

// A stream is consumed by the first attempt, so only buffered bodies are retried.
async function putWithRetry(
  bucket: R2Bucket,
  key: string,
  body: Parameters<R2Bucket["put"]>[1],
  options?: R2PutOptions,
): Promise<R2Object | null> {
  const retries = body instanceof ReadableStream ? 0 : PUT_RETRIES;
  for (let attempt = 0; ; attempt++) {
    try {
      return await bucket.put(key, body, options);
    } catch (error) {
      if (attempt >= retries || !isTransientStorageError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, PUT_RETRY_MS * (attempt + 1)));
    }
  }
}

/** Limits every chunked upload is held to, whatever the app's own route checks.
 *  An app that takes bigger files raises them here on purpose. */
export interface UploadLimits {
  /** The biggest file a chunked upload may finish as; a bigger one is deleted at
   *  completion and `UploadTooLargeError` is thrown. Default 2 GiB. */
  maxUploadBytes?: number;
  /** The biggest single part `uploadPart` stores. Default 10 MiB. */
  maxPartBytes?: number;
}

const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_MAX_PART_BYTES = 10 * 1024 * 1024;
// R2 refuses a part under 5 MiB unless it is the last, so this bounds how many parts a file at the ceiling can need.
const R2_MIN_PART_BYTES = 5 * 1024 * 1024;

/** Create a storage client scoped to this app's prefix in the workspace R2 bucket.
 *  A put that fails with a transient storage fault is retried before it surfaces,
 *  and a chunked upload is held to `limits` on the bytes that really arrive. */
export function createStorage(env: Env, limits: UploadLimits = {}): R2Bucket {
  // Key the app's storage by its immutable id, not its slug, so a URL rename is
  // a pure data change that touches no objects.
  const prefix = `public/${env.APP_ID}/`;
  const bucket = env.STORAGE;
  const bounds = {
    maxUploadBytes: limits.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES,
    maxPartBytes: limits.maxPartBytes ?? DEFAULT_MAX_PART_BYTES,
  };

  return new Proxy(bucket, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      switch (prop) {
        case "put":
          return async (
            key: string,
            body: Parameters<R2Bucket["put"]>[1],
            options?: R2PutOptions,
          ) => putWithRetry(target, `${prefix}${key}`, body, await pinUploadType(body, options));
        case "get":
        case "head":
          return async (key: string, ...args: unknown[]) =>
            pinStoredType(await value.call(target, `${prefix}${key}`, ...args));
        case "createMultipartUpload":
          return async (key: string, options?: R2MultipartOptions) =>
            boundUpload(
              await value.call(target, `${prefix}${key}`, pinDeclaredType(options)),
              target,
              bounds,
            );
        case "resumeMultipartUpload":
          return (key: string, uploadId: string) =>
            boundUpload(value.call(target, `${prefix}${key}`, uploadId), target, bounds);
        case "delete":
          return async (keys: string | string[]) => {
            const list = typeof keys === "string" ? [keys] : keys;
            await value.call(target, list.map((k: string) => `${prefix}${k}`));
            await forgetStoredFiles(env, list);
          };
        case "list":
          // Strip the app prefix back off returned keys so list is symmetric
          // with put/get/head/delete — otherwise a key read from list() and
          // passed back to get() double-prefixes and 404s (the object is lost).
          return async (options?: R2ListOptions): Promise<R2Objects> => {
            const listed: R2Objects = await value.call(target, {
              ...options,
              prefix: `${prefix}${options?.prefix ?? ""}`,
            });
            const strip = (key: string) =>
              key.startsWith(prefix) ? key.slice(prefix.length) : key;
            return {
              ...listed,
              objects: listed.objects.map(
                (obj) =>
                  new Proxy(obj, {
                    get(t, p, r) {
                      if (p === "key") return strip(t.key);
                      const v = Reflect.get(t, p, r);
                      return typeof v === "function" ? v.bind(t) : v;
                    },
                  }),
              ),
              delimitedPrefixes: listed.delimitedPrefixes.map(strip),
            };
          };
        default:
          return value.bind(target);
      }
    },
  });
}

/** Thrown when a chunked upload goes over a limit: a part over the part cap, a part
 *  numbered past what the ceiling allows, or at completion a joined file over the
 *  ceiling, which is then already deleted. `size` is what really arrived. */
export class UploadTooLargeError extends Error {
  constructor(
    readonly size: number,
    readonly maxBytes: number,
  ) {
    super(`Upload is ${size} bytes, over the ${maxBytes}-byte limit`);
    this.name = "UploadTooLargeError";
  }
}

type PartBody = Parameters<R2MultipartUpload["uploadPart"]>[1];

// A part's size is read from its bytes, never from a header: a stream is read up
// to the cap and refused past it.
async function cappedPart(value: PartBody, maxBytes: number): Promise<PartBody> {
  if (value instanceof ReadableStream) {
    const bytes = await readCapped(value, maxBytes);
    if (typeof bytes === "number") throw new UploadTooLargeError(bytes, maxBytes);
    return bytes;
  }
  const size =
    typeof value === "string"
      ? new Blob([value]).size
      : value instanceof Blob
        ? value.size
        : value.byteLength;
  if (size > maxBytes) throw new UploadTooLargeError(size, maxBytes);
  return value;
}

// The store's own upload object takes any part and joins them without measuring;
// this one refuses past the limits and deletes a finished file over the ceiling.
function boundUpload(
  upload: R2MultipartUpload,
  bucket: R2Bucket,
  limits: Required<UploadLimits>,
): R2MultipartUpload {
  const maxParts = Math.ceil(limits.maxUploadBytes / R2_MIN_PART_BYTES);
  return {
    key: upload.key,
    uploadId: upload.uploadId,
    async uploadPart(partNumber, value, options) {
      if (partNumber > maxParts) {
        throw new UploadTooLargeError((partNumber - 1) * R2_MIN_PART_BYTES, limits.maxUploadBytes);
      }
      return upload.uploadPart(partNumber, await cappedPart(value, limits.maxPartBytes), options);
    },
    abort: () => upload.abort(),
    async complete(parts) {
      const object = await upload.complete(parts);
      if (object.size > limits.maxUploadBytes) {
        await bucket.delete(upload.key);
        throw new UploadTooLargeError(object.size, limits.maxUploadBytes);
      }
      return object;
    },
  };
}

/** Finish a chunked upload on the bytes that were really stored: joins the parts,
 *  reads the object's own size, and over `maxBytes` (read on the server, never from
 *  the request) deletes it and throws. Completing retires the `uploadId`: no more parts land. */
export async function completeUpload(
  storage: R2Bucket,
  key: string,
  uploadId: string,
  parts: R2UploadedPart[],
  maxBytes?: number,
): Promise<{ key: string; size: number }> {
  const upload = storage.resumeMultipartUpload(key, uploadId);
  const object = await upload.complete(
    parts
      .slice()
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
  );
  if (maxBytes !== undefined && object.size > maxBytes) {
    await storage.delete(key);
    throw new UploadTooLargeError(object.size, maxBytes);
  }
  return { key, size: object.size };
}

// Content types safe to render inline from the app's own origin. Everything else
// — most importantly HTML, SVG and XML — is served as a download, so an uploaded
// file that is secretly a web page can't execute with the viewer's session.
const INLINE_SAFE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "text/vtt",
]);

const GENERIC_BYTES = "application/octet-stream";

function baseType(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

/** The type an untrusted file may be served under: itself when the allow-list
 *  renders it inline, otherwise generic bytes, which every browser downloads. */
function pinnedContentType(type: string | null | undefined): string {
  const base = baseType(type);
  return INLINE_SAFE_CONTENT_TYPES.has(base) ? base : GENERIC_BYTES;
}

// Leading bytes of the inline-safe picture and document types. A file that
// claims one of these and does not start with it is not that type.
const BYTE_SIGNATURES: Record<string, Array<Array<number | null>>> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
  "image/avif": [[null, null, null, null, 0x66, 0x74, 0x79, 0x70]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
};

// Markup a browser would run as a page if a route ever reflected or guessed its type.
const MARKUP_START = /^(?:\uFEFF|\s)*<(?:\?xml|svg|!doctype|html|script)/i;

function hasSignature(head: Uint8Array, signatures: Array<Array<number | null>>): boolean {
  return signatures.some(
    (sig) =>
      head.length >= sig.length && sig.every((byte, i) => byte === null || head[i] === byte),
  );
}

async function leadingBytes(body: Parameters<R2Bucket["put"]>[1]): Promise<Uint8Array | null> {
  if (body === null || body instanceof ReadableStream) return null;
  if (typeof body === "string") return new TextEncoder().encode(body.slice(0, 64));
  if (body instanceof Blob) return new Uint8Array(await body.slice(0, 64).arrayBuffer());
  if (body instanceof ArrayBuffer) return new Uint8Array(body, 0, Math.min(64, body.byteLength));
  return new Uint8Array(body.buffer, body.byteOffset, Math.min(64, body.byteLength));
}

function withContentType<T extends { httpMetadata?: R2PutOptions["httpMetadata"] }>(
  options: T | undefined,
  contentType: string,
): T {
  const meta = options?.httpMetadata;
  if (meta instanceof Headers) {
    const headers = new Headers(meta);
    headers.set("Content-Type", contentType);
    return { ...options, httpMetadata: headers } as T;
  }
  return { ...options, httpMetadata: { ...meta, contentType } } as T;
}

function declaredType(options: { httpMetadata?: R2PutOptions["httpMetadata"] } | undefined) {
  const meta = options?.httpMetadata;
  return baseType(meta instanceof Headers ? meta.get("Content-Type") : meta?.contentType);
}

/** The declared type is stored only when the allow-list could render it inline;
 *  HTML, SVG, XML and every other type are stored as generic bytes. */
function pinDeclaredType<T extends { httpMetadata?: R2PutOptions["httpMetadata"] }>(
  options: T | undefined,
): T | undefined {
  const declared = declaredType(options);
  if (!declared || pinnedContentType(declared) === declared) return options;
  return withContentType(options, GENERIC_BYTES);
}

// A buffered body is also checked against its claimed type's signature, so a web
// page uploaded as "image/png" is stored as generic bytes. A stream cannot be
// peeked without consuming it, so it keeps whatever `pinDeclaredType` allows.
async function pinUploadType(
  body: Parameters<R2Bucket["put"]>[1],
  options: R2PutOptions | undefined,
): Promise<R2PutOptions | undefined> {
  const pinned = pinDeclaredType(options);
  const declared = declaredType(pinned);
  if (!declared || declared === GENERIC_BYTES) return pinned;
  const head = await leadingBytes(body);
  if (!head) return pinned;
  const signatures = BYTE_SIGNATURES[declared];
  const mismatch = signatures ? !hasSignature(head, signatures) : false;
  const markup = MARKUP_START.test(new TextDecoder("latin1").decode(head));
  return mismatch || markup ? withContentType(pinned, GENERIC_BYTES) : pinned;
}

// A stored object may still carry a page type. A read reports the pinned type,
// so a route that copies it into its own response sends a download; the object
// in storage is left as it is.
function pinStoredType<T extends R2Object | null>(obj: T): T {
  const stored = obj?.httpMetadata?.contentType;
  if (!obj || !stored) return obj;
  const contentType = pinnedContentType(stored);
  if (contentType === baseType(stored)) return obj;
  return new Proxy(obj, {
    get(target, prop) {
      if (prop === "httpMetadata") return { ...target.httpMetadata, contentType };
      if (prop === "writeHttpMetadata") {
        return (headers: Headers) => {
          target.writeHttpMetadata(headers);
          headers.set("Content-Type", contentType);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** The key of a video's caption file: the video's own key plus `.vtt`, so the
 *  pair can never drift apart. A `captions` media job writes exactly this key,
 *  and a caption file the app builder uploads or edits goes under it too. */
export function captionKeyFor(videoKey: string): string {
  return `${videoKey}.vtt`;
}

// The transform engine's ingest formats — exactly the image entries of the
// inline-safe list, so a resized variant can never widen what renders inline.
const TRANSFORMABLE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

// The engine rejects a larger source with a 413.
const TRANSFORM_MAX_SOURCE_BYTES = 20_000_000;
const TRANSFORM_MAX_DIMENSION = 4096;

const SERVE_TRANSFORM_FITS = new Set([
  "scale-down",
  "contain",
  "pad",
  "squeeze",
  "cover",
  "crop",
]);

export interface ServeImageTransform {
  /** The app env — the transform runs through the platform's image engine. */
  env: Env;
  /** Target width in pixels (capped at 4096). Omit one dimension to scale by the other. */
  width?: number;
  /** Target height in pixels (capped at 4096). */
  height?: number;
  /** How the image fills the target box. Default `scale-down`. */
  fit?: "scale-down" | "contain" | "pad" | "squeeze" | "cover" | "crop";
  /** Which part a `cover` or `crop` keeps, in link form: `face`, `auto` or a point such as `0.5x0.2`. Default: the centre. */
  gravity?: string;
  /** Output format. Default `image/webp`. */
  format?: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";
  /** Output quality 1–100 for lossy formats. */
  quality?: number;
}

/**
 * Read a serve-time image transform from the request's query string —
 * `?width=` / `?height=` (pixels), `?fit=`, `?gravity=` (`face`, `auto` or a point
 * such as `0.5x0.2` or `0.5x0.2-remainder`), `?format=` (`webp` or `image/webp`), `?quality=` — for a file
 * route to pass straight to `serveR2Object`'s `transform` option. Returns undefined
 * when the URL asks for no transform, so a plain request serves the object as-is.
 */
export function imageTransformFromRequest(
  request: Request,
  env: Env,
): ServeImageTransform | undefined {
  const query = new URL(request.url).searchParams;
  const int = (name: string): number | undefined => {
    const raw = query.get(name);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  const transform: ServeImageTransform = { env };
  const width = int("width");
  if (width) transform.width = width;
  const height = int("height");
  if (height) transform.height = height;
  const fit = query.get("fit");
  if (fit && SERVE_TRANSFORM_FITS.has(fit)) {
    transform.fit = fit as ServeImageTransform["fit"];
  }
  transform.gravity = query.get("gravity") ?? undefined;
  const rawFormat = query.get("format")?.toLowerCase();
  const format =
    rawFormat && !rawFormat.includes("/")
      ? `image/${rawFormat === "jpg" ? "jpeg" : rawFormat}`
      : rawFormat;
  if (format && TRANSFORMABLE_IMAGE_TYPES.has(format)) {
    transform.format = format as ServeImageTransform["format"];
  }
  const quality = int("quality");
  if (quality) transform.quality = quality;
  if (!transform.width && !transform.height && !transform.format && !transform.quality) {
    return undefined;
  }
  return transform;
}

// Renders the requested variant, or null when the transform fails — the caller
// then serves the original unchanged. Dimensions are clamped so a URL cannot
// request unbounded work; the engine's output type is always inline-safe.
async function renderImageVariant(
  transform: ServeImageTransform,
  source: ArrayBuffer,
  cacheControl: string,
  downloadAs?: string,
): Promise<Response | null> {
  const clamp = (value: number | undefined, max: number) =>
    value && Number.isInteger(value) && value > 0 ? Math.min(value, max) : undefined;
  try {
    const { body, contentType } = await createImage(transform.env).transform(source, {
      width: clamp(transform.width, TRANSFORM_MAX_DIMENSION),
      height: clamp(transform.height, TRANSFORM_MAX_DIMENSION),
      fit: transform.fit,
      gravity: transform.gravity,
      format: transform.format,
      quality: clamp(transform.quality, 100),
    });
    const bytes = await new Response(body).arrayBuffer();
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": downloadAs ? contentDisposition(downloadAs) : "inline",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return null;
  }
}

// The worker's default edge cache, keyed on the request URL (which carries the
// transform params), so each variant is computed once per edge location. Both
// sides are best-effort: a runtime without it just recomputes per request.
async function edgeCacheMatch(url: string): Promise<Response | undefined> {
  try {
    return await caches.default.match(url);
  } catch {
    return undefined;
  }
}

async function edgeCachePut(url: string, response: Response): Promise<void> {
  try {
    await caches.default.put(url, response);
  } catch {
    // Serving already succeeded; the next request recomputes.
  }
}

async function edgeCacheDelete(url: string): Promise<void> {
  try {
    await caches.default.delete(url);
  } catch {
    // The entry expires on its own.
  }
}

// Short enough that a deleted file drops out of browser and edge caches soon after;
// revalidation is a cheap 304 against the ETag. Pass `cacheControl` for truly immutable content.
const DEFAULT_CACHE_CONTROL = "public, max-age=3600";

export const FILES_ROUTE = "/api/files/";

type StoredFileRef = string | null | undefined;

// A stored key, or the `/api/files/<key>` URL (relative or absolute, with or without
// transform params) an app saved instead of the key.
export function keyFromStoredFileRef(ref: string): string | null {
  const trimmed = ref.trim();
  const at = trimmed.indexOf(FILES_ROUTE);
  if (at === -1) return trimmed || null;
  const path = trimmed.slice(at + FILES_ROUTE.length).split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return path || null;
  }
}

export type StoreImageFromUrlResult =
  | { ok: true; key: string; contentType: string; size: number }
  | { ok: false; reason: string };

const NOT_A_PICTURE = "That address didn't return a picture.";
const TOO_BIG = "That picture is over 20 MB — please use a smaller one.";

const refused = (reason: string): StoreImageFromUrlResult => ({ ok: false, reason });

function bytesAt(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

// The upstream Content-Type is a claim; the stored type comes from the bytes,
// so only the transformable image formats can ever be stored this way.
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytesAt(bytes, 0, "\x89PNG")) return "image/png";
  if (bytesAt(bytes, 0, "\xff\xd8\xff")) return "image/jpeg";
  if (bytesAt(bytes, 0, "GIF8")) return "image/gif";
  if (bytesAt(bytes, 0, "RIFF") && bytesAt(bytes, 8, "WEBP")) return "image/webp";
  if (bytesAt(bytes, 4, "ftypavif")) return "image/avif";
  return null;
}

/**
 * Copy a picture from an outside address an app user supplied — pasted, imported
 * from a link or pulled from a feed — into the app's own storage, so other app
 * users load it from the app's origin and the poster's server never learns who
 * viewed it or swaps the picture later. Only public
 * http(s) addresses are fetched — every redirect is re-checked and private
 * networks are refused — the bytes must be a PNG, JPEG, GIF, WebP or AVIF under
 * 20 MB, and the stored type is read from the bytes, not the upstream header.
 * Save the returned `key` and render `/api/files/<key>`; never store or
 * render the pasted address itself. A refusal carries a `reason` plain enough
 * to show the app user.
 */
export async function storeImageFromUrl(
  storage: R2Bucket,
  url: string,
  key: string,
): Promise<StoreImageFromUrlResult> {
  const fetched = await safeFetch(url, {
    maxBytes: TRANSFORM_MAX_SOURCE_BYTES,
    headers: { Accept: "image/*" },
  });
  if (!fetched.ok) {
    if (fetched.code === "too-big") return refused(TOO_BIG);
    return refused(fetched.code === "status" ? NOT_A_PICTURE : fetched.reason);
  }
  const { bytes } = fetched;
  const contentType = sniffImageType(bytes);
  if (!contentType) return refused(NOT_A_PICTURE);
  await storage.put(key, bytes, { httpMetadata: { contentType } });
  return { ok: true, key, contentType, size: bytes.byteLength };
}

/** Delete every stored file a record references (its file columns: bare keys or
 *  `/api/files/...` URLs, single values or arrays; blanks skipped). A file shared by
 *  several records is passed only when its last owner goes. */
export async function deleteStoredFiles(
  storage: R2Bucket,
  ...refs: Array<StoredFileRef | StoredFileRef[]>
): Promise<void> {
  const keys = new Set<string>();
  for (const ref of refs.flat()) {
    const key = typeof ref === "string" ? keyFromStoredFileRef(ref) : null;
    if (key) keys.add(key);
  }
  if (keys.size > 0) await storage.delete([...keys]);
}

// Builds the serving headers for a stored object. Its content type came from the
// uploading client and can't be trusted: only the allowlist renders inline under a
// server-pinned type; anything else is forced to download as generic bytes.
function safeServingHeaders(obj: R2Object): Headers {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const contentType = pinnedContentType(obj.httpMetadata?.contentType);
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", contentType === GENERIC_BYTES ? "attachment" : "inline");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

/**
 * Serve bytes whose type someone else chose — an email attachment, a file
 * proxied from another store, anything not read with `serveR2Object` — under
 * the same rules it applies: the type is pinned to the inline-safe allow-list,
 * everything else downloads as generic bytes, and type guessing is off. Pass
 * `downloadAs` to save the bytes as a file with that name instead of showing them.
 */
export function untrustedFileResponse(
  body: BodyInit | null,
  claimedType: string | null | undefined,
  opts: { downloadAs?: string; cacheControl?: string; size?: number } = {},
): Response {
  const contentType = pinnedContentType(claimedType);
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": opts.downloadAs
      ? contentDisposition(opts.downloadAs)
      : contentType === GENERIC_BYTES
        ? "attachment"
        : "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": opts.cacheControl ?? "private, no-store",
  });
  if (opts.size !== undefined) headers.set("Content-Length", String(opts.size));
  return new Response(body, { headers });
}

/**
 * Serve an R2 object as an HTTP response, honoring the request's `Range`
 * header with a `206 Partial Content` reply. Required for <video>/<audio>
 * seeking of large media. `storage` should be the `createStorage(env)` client
 * so the key is scoped automatically.
 *
 * Bytes are served as a download unless the stored type is a known-safe media
 * type, so untrusted uploads can never execute on the app's own origin. Pass
 * `downloadAs` to make the browser save the object as a file with that name
 * instead of displaying it.
 *
 * Pass `transform` (usually `imageTransformFromRequest(request, env)`) to serve
 * a stored image resized or converted on the way out — the stored file stays
 * untouched, and the variant is cached at the edge per URL. A non-image, a
 * source over 20 MB, a failed transform, or a Range request serves the object
 * unchanged.
 */
export async function serveR2Object(
  storage: R2Bucket,
  key: string,
  request: Request,
  opts: {
    cacheControl?: string;
    downloadAs?: string;
    transform?: ServeImageTransform;
  } = {},
): Promise<Response> {
  const cacheControl = opts.cacheControl ?? DEFAULT_CACHE_CONTROL;
  const rangeHeader = request.headers.get("Range");

  if (!rangeHeader) {
    const transform = request.method === "GET" ? opts.transform : undefined;
    if (transform) {
      const cached = await edgeCacheMatch(request.url);
      // A cached variant outlives its source only until the next request for it.
      if (cached && (await storage.head(key))) return cached;
      if (cached) await edgeCacheDelete(request.url);
    }
    const obj = await storage.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    if (request.headers.get("If-None-Match") === obj.httpEtag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: obj.httpEtag, "Cache-Control": cacheControl },
      });
    }
    const headers = safeServingHeaders(obj);

    let body: BodyInit = obj.body;
    if (
      transform &&
      TRANSFORMABLE_IMAGE_TYPES.has(headers.get("Content-Type") ?? "") &&
      obj.size <= TRANSFORM_MAX_SOURCE_BYTES
    ) {
      const source = await obj.arrayBuffer();
      body = source;
      const variant = await renderImageVariant(
        transform,
        source,
        cacheControl,
        opts.downloadAs,
      );
      if (variant) {
        await edgeCachePut(request.url, variant.clone());
        return variant;
      }
    }

    headers.set("Content-Length", String(obj.size));
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", cacheControl);
    headers.set("ETag", obj.httpEtag);
    if (opts.downloadAs) {
      headers.set("Content-Disposition", contentDisposition(opts.downloadAs));
    }
    return new Response(body, { headers });
  }

  const head = await storage.head(key);
  if (!head) return new Response("Not found", { status: 404 });
  const size = head.size;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response("Invalid range", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
    });
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  if (start > end || start >= size) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
    });
  }

  const obj = await storage.get(key, {
    range: { offset: start, length: end - start + 1 },
  });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = safeServingHeaders(obj);
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", cacheControl);
  headers.set("ETag", obj.httpEtag);
  if (opts.downloadAs) {
    headers.set("Content-Disposition", contentDisposition(opts.downloadAs));
  }
  return new Response(obj.body, { status: 206, headers });
}

export interface ZipFile {
  /** The stored key, or the `/api/files/<key>` URL a record holds. */
  key: string;
  /** The name inside the zip (`/` makes folders); defaults to the key's last segment. */
  name?: string;
}

export interface ZipLimits {
  /** Most files one zip may hold. Each costs two storage reads of the request's budget. */
  maxFiles?: number;
  /** Largest zip served, in bytes; the format written here ends at 4 GiB. */
  maxBytes?: number;
}

const ZIP_MAX_FILES = 400;
const ZIP_MAX_BYTES = 2 * 1024 ** 3;
const ZIP_FORMAT_MAX_BYTES = 0xffff_ffff;
// Sizes follow the data, and names are UTF-8.
const ZIP_FLAGS = 0x0808;

interface ZipEntry {
  key: string;
  name: Uint8Array;
  head: R2Object;
  offset: number;
  crc: number;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

// A name safe to unpack anywhere: no absolute or `..` path, no characters Windows
// refuses, and a counter when two files would land on the same name.
function zipEntryName(raw: string, taken: Set<string>): string {
  const clean =
    raw
      .replace(/\\/g, "/")
      .split("/")
      .map((part) => part.replace(/[\x00-\x1f<>:"|?*]/g, "_").trim())
      .filter((part) => part && part !== "." && part !== "..")
      .join("/") || "file";
  const dot = clean.lastIndexOf(".");
  const stem = dot > clean.lastIndexOf("/") + 1 ? clean.slice(0, dot) : clean;
  let name = clean;
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    name = `${stem} (${n})${clean.slice(stem.length)}`;
  }
  taken.add(name.toLowerCase());
  return name;
}

// The header before a file's bytes, or (`central`) its row in the closing directory.
function zipHeader(entry: ZipEntry, central: boolean): Uint8Array<ArrayBuffer> {
  const fixed = central ? 46 : 30;
  const out = new Uint8Array(fixed + entry.name.length);
  const view = new DataView(out.buffer);
  const at = central ? 6 : 4;
  const when = entry.head.uploaded;
  view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  if (central) view.setUint16(4, 20, true);
  view.setUint16(at, 20, true);
  view.setUint16(at + 2, ZIP_FLAGS, true);
  view.setUint16(
    at + 6,
    (when.getUTCHours() << 11) | (when.getUTCMinutes() << 5) | (when.getUTCSeconds() >> 1),
    true,
  );
  view.setUint16(
    at + 8,
    (Math.max(0, when.getUTCFullYear() - 1980) << 9) |
      ((when.getUTCMonth() + 1) << 5) |
      when.getUTCDate(),
    true,
  );
  if (central) {
    view.setUint32(at + 10, entry.crc, true);
    view.setUint32(at + 14, entry.head.size, true);
    view.setUint32(at + 18, entry.head.size, true);
    view.setUint32(42, entry.offset, true);
  }
  view.setUint16(at + 22, entry.name.length, true);
  out.set(entry.name, fixed);
  return out;
}

// The app user's browser stopped reading: routine, so it is never logged as a fault.
class DownloadCancelled extends Error {}

async function writeZip(
  storage: R2Bucket,
  entries: ZipEntry[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
): Promise<void> {
  const send = (bytes: Uint8Array) =>
    writer.write(bytes).catch((err) => {
      throw new DownloadCancelled("download cancelled", { cause: err });
    });
  for (const entry of entries) {
    await send(zipHeader(entry, false));
    // The length is already promised, so a file replaced since it was measured fails the download.
    const obj = await storage.get(entry.key, { onlyIf: { etagMatches: entry.head.etag } });
    if (!obj || !("body" in obj)) throw new Error(`stored file changed mid-download: ${entry.key}`);
    let crc = 0xffff_ffff;
    const reader = obj.body.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      for (const byte of chunk.value) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
      await send(chunk.value);
    }
    entry.crc = (crc ^ 0xffff_ffff) >>> 0;
    const descriptor = new DataView(new ArrayBuffer(16));
    descriptor.setUint32(0, 0x08074b50, true);
    descriptor.setUint32(4, entry.crc, true);
    descriptor.setUint32(8, entry.head.size, true);
    descriptor.setUint32(12, entry.head.size, true);
    await send(new Uint8Array(descriptor.buffer));
  }
  let directoryBytes = 0;
  for (const entry of entries) {
    const row = zipHeader(entry, true);
    directoryBytes += row.length;
    await send(row);
  }
  const last = entries[entries.length - 1];
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directoryBytes, true);
  end.setUint32(16, last.offset + 30 + last.name.length + last.head.size + 16, true);
  await send(new Uint8Array(end.buffer));
  await writer.close();
}

/**
 * Serve many stored files as one zip download, streamed uncompressed so memory stays
 * flat. Pass only files this app user may read; one missing from storage is left out,
 * and over a limit the answer is a 413 before any byte is sent.
 */
export async function zipResponse(
  storage: R2Bucket,
  files: readonly ZipFile[],
  filename: string,
  limits: ZipLimits = {},
): Promise<Response> {
  const maxFiles = Math.min(limits.maxFiles ?? ZIP_MAX_FILES, 0xffff);
  if (files.length > maxFiles) {
    return new Response(`Too many files for one download (limit ${maxFiles})`, { status: 413 });
  }
  const taken = new Set<string>();
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  let offset = 0;
  let directoryBytes = 0;
  // Six at a time: the most storage reads a request may have open at once.
  for (let i = 0; i < files.length; i += 6) {
    const batch = files.slice(i, i + 6).map((file) => ({
      file,
      key: keyFromStoredFileRef(file.key),
    }));
    const heads = await Promise.all(batch.map(({ key }) => (key ? storage.head(key) : null)));
    batch.forEach(({ file, key }, n) => {
      const head = heads[n];
      if (!key || !head) return;
      const name = encoder.encode(zipEntryName(file.name ?? key.split("/").pop() ?? "", taken));
      entries.push({ key, name, head, offset, crc: 0 });
      offset += 30 + name.length + head.size + 16;
      directoryBytes += 46 + name.length;
    });
  }
  const total = offset + directoryBytes + 22;
  if (entries.length === 0) return new Response("Not found", { status: 404 });
  const maxBytes = Math.min(limits.maxBytes ?? ZIP_MAX_BYTES, ZIP_FORMAT_MAX_BYTES);
  if (total > maxBytes) {
    return new Response("These files are too large for one download", { status: 413 });
  }

  const { readable, writable } = new FixedLengthStream(total);
  const writer = writable.getWriter();
  writeZip(storage, entries, writer).catch((err) => {
    if (!(err instanceof DownloadCancelled)) {
      console.error(`[storage] zip download "${filename}" (${entries.length} files) failed:`, err);
    }
    // Ends the download as failed; on a stream that is already gone this has nothing left to do.
    writer.abort(err).catch(() => {});
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(filename),
      "Content-Length": String(total),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
