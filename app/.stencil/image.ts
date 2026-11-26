import { BACKEND_BASE, createBackendFetch } from "./backend";
import { appendWatermark, loadMark, type TransformWatermarkParams } from "./watermark";

export type { TransformWatermarkParams } from "./watermark";

export interface GenerateImageParams {
  /** What to draw. Required. */
  prompt: string;
  /**
   * Which text-to-image model to use. Defaults to Cloudflare Workers AI
   * `@cf/black-forest-labs/flux-1-schnell`; any Workers AI image model id is
   * accepted. OpenAI's `gpt-image-2.5-sunburst` and Google's `gemini-3.1-flash-image` are
   * also available but cost more — reach for them only when the app builder
   * specifically asks. See the runtime-image skill.
   */
  model?: string;
  /**
   * Up to 6 pictures the model should match — the same person, product or art
   * style kept consistent across many images, in the order given. Only the Gemini
   * image models and FLUX.2 (`@cf/black-forest-labs/flux-2-*`) accept them; any
   * other model answers 400. Raw bytes, a base64 string or a data URL; under
   * 10 MB each and under 40 MB together.
   */
  references?: Array<Uint8Array | ArrayBuffer | string>;
}

/** Base64 for the JSON body; a string reference is already encoded (base64 or data URL). */
function encodeReference(ref: Uint8Array | ArrayBuffer | string): string {
  if (typeof ref === "string") return ref;
  const bytes = ref instanceof Uint8Array ? ref : new Uint8Array(ref);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export interface GeneratedImage {
  /** The image as a byte stream — pass straight to `createStorage().put(key, body)`;
   *  the response is known-length, so R2 accepts the stream directly. */
  body: ReadableStream<Uint8Array>;
  /** Image MIME type (e.g. image/png, image/jpeg), from the model's output. */
  contentType: string;
}

export type ImageGravity =
  | "auto"
  | "face"
  | {
      x: number;
      y: number;
      /**
       * How the point places the crop. `"box-center"` (default) centres the kept area on it;
       * `"remainder"` shifts the cut like CSS `object-position` (0 keeps one edge, 1 the other).
       */
      mode?: "remainder" | "box-center";
    };

/**
 * A `gravity` value in its link form, the one the image routes read: `auto`, `face`,
 * or a point such as `0.5x0.2` (`0.5x0.2-remainder` with a mode). A string is passed as given.
 */
function gravityParam(gravity: ImageGravity | string): string {
  if (typeof gravity === "string") return gravity;
  const fraction = (n: number) => Math.min(1, Math.max(0, n)).toFixed(4);
  return `${fraction(gravity.x)}x${fraction(gravity.y)}${gravity.mode ? `-${gravity.mode}` : ""}`;
}

export interface TransformImageParams {
  /** Target width in pixels. Omit one dimension to scale by the other. */
  width?: number;
  /** Target height in pixels. */
  height?: number;
  /** How the image fills the target box. Default `scale-down`. */
  fit?: "scale-down" | "contain" | "pad" | "squeeze" | "cover" | "crop";
  /**
   * What a `cover` or `crop` resize keeps: `"face"`, `"auto"` (the most notable area), or a
   * point `{ x, y }` (each 0–1 of the source, from its top-left), also as a link value
   * (`"0.5x0.2"`). Anything else is ignored. Default: the centre.
   */
  gravity?: ImageGravity | string;
  /** Right-angle rotation applied before resizing. */
  rotate?: 90 | 180 | 270;
  /**
   * Pixels to cut off each edge of the source before any resize — an exact
   * region an app user chose with a crop frame. Whole numbers, 0 or more; a trim
   * that leaves nothing is rejected with a 400. The compact form is the same four
   * values as one string, `"top;right;bottom;left"`.
   */
  trim?: { top?: number; right?: number; bottom?: number; left?: number } | string;
  /** Output format. Default `image/webp`. */
  format?: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";
  /** Output quality 1–100 for lossy formats. */
  quality?: number;
  /**
   * Cut the subject out and make everything behind it transparent — a logo, a
   * mascot, a product or a clothing photo. Keep the default WebP or pick PNG:
   * JPEG has no transparency, so the cleared background would come back black.
   */
  removeBackground?: boolean;
  /**
   * Draw a mark over the picture server-side, so the returned bytes are already
   * composited — the clean source never reaches the visitor. A client-side
   * overlay is decoration, not protection. The mark is named by its storage
   * key: an upload of this app's, or a platform asset such as `assets/logo.png`.
   * Options in `./watermark`.
   */
  watermark?: TransformWatermarkParams;
}

export interface PdfPreviewParams {
  /** Which page to render, 1-based. Default 1. */
  page?: number;
  /** Rendered width in px (max 2000); height follows the page's aspect ratio. Default 1000. */
  width?: number;
  /** Output format. Default `image/webp`. */
  format?: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";
}

export interface PdfPreview extends GeneratedImage {
  /** Total pages in the document — useful for a "1 of 12" caption. */
  pageCount: number | null;
}

/**
 * Thrown by `generate()` when the image model's safety filter turned the prompt down.
 * The same prompt is refused every time, so a retry is pointless: tell the person and
 * let them describe the scene differently. Not an outage, so log it as a warning.
 */
export class ImageRefusedError extends Error {
  constructor(detail?: string) {
    super(`Image generation refused: the model's safety filter turned this prompt down${detail ? ` (${detail})` : ""}`);
    this.name = "ImageRefusedError";
  }
}

/**
 * Generate an image from a text prompt at runtime, proxied through the Stencil
 * backend service (Workers AI). No keys required. Server-side only (loaders /
 * actions / scheduled handlers). Pass the returned `body` straight to
 * `createStorage().put(key, body)` and keep only the key in D1 — never image bytes.
 */
export function createImage(env: Env) {
  const backendFetch = createBackendFetch(env);

  return {
    async generate(params: GenerateImageParams): Promise<GeneratedImage> {
      const { references, ...rest } = params;
      const body = references?.length ? { ...rest, references: references.map(encodeReference) } : rest;
      const res = await backendFetch(`${BACKEND_BASE}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 422) {
          let refusal: { code?: string; detail?: string } = {};
          try {
            refusal = JSON.parse(text) as { code?: string; detail?: string };
          } catch {
            // Not JSON — reported as a plain failure below.
          }
          if (refusal.code === "content_refused") throw new ImageRefusedError(refusal.detail);
        }
        throw new Error(`Image generation failed: ${text}`);
      }
      if (!res.body) throw new Error("Image generation returned an empty response");
      const contentType = res.headers.get("Content-Type") ?? "image/png";
      return { body: res.body as ReadableStream<Uint8Array>, contentType };
    },

    /**
     * Resize / crop / trim / convert / watermark / cut out an existing image at runtime via the
     * Cloudflare Images binding — the worker-compatible path (Sharp and other
     * native codecs can't run on Workers). Pass the source bytes (an uploaded
     * `File`, or bytes read from R2); pass the returned `body` straight to
     * `createStorage().put(key, body)` and keep only the key in D1.
     */
    async transform(
      /** The image bytes. Max 20 MB — a larger source is rejected with a 413. */
      source: Blob | ArrayBuffer | Uint8Array,
      params: TransformImageParams = {},
    ): Promise<GeneratedImage> {
      const { watermark, removeBackground, trim, gravity, ...options } = params;
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) query.set(key, String(value));
      }
      if (typeof trim === "string") query.set("trim", trim);
      else for (const [edge, value] of Object.entries(trim ?? {})) {
        if (value !== undefined) query.set(`trim.${edge}`, String(value));
      }
      if (gravity) query.set("gravity", gravityParam(gravity));
      if (removeBackground) query.set("segment", "foreground");
      // The current TS lib's generic Uint8Array<ArrayBufferLike> no longer widens to BodyInit - requires casting.
      let body: BodyInit = source as BodyInit;
      if (watermark) {
        appendWatermark(query, watermark);
        const mark = await loadMark(env, watermark.key);
        if (mark) {
          const form = new FormData();
          form.append("source", source instanceof Blob ? source : new Blob([source as BlobPart]), "source");
          form.append("watermark", mark, "watermark");
          body = form;
        } else {
          query.set("watermarkKey", watermark.key);
        }
      }
      const res = await backendFetch(`${BACKEND_BASE}/image/transform?${query.toString()}`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`Image transform failed: ${await res.text()}`);
      if (!res.body) throw new Error("Image transform returned an empty response");
      const contentType = res.headers.get("Content-Type") ?? "image/webp";
      return { body: res.body as ReadableStream<Uint8Array>, contentType };
    },

    /**
     * Render one page of a PDF to an image — a first-page thumbnail for an
     * uploaded document, say. Cloudflare Images cannot read a PDF, so this goes
     * through the platform's PDF renderer rather than `transform`.
     *
     * Do this **once, when the file is uploaded**, and store the result beside
     * the PDF; never re-render on every page view. Pass the returned `body`
     * straight to `createStorage().put(key, body)` and keep only the key in D1.
     *
     * Throws with the reason when the PDF cannot be read — a password-protected
     * file says so, which is worth showing the person who uploaded it.
     */
    async fromPdf(
      source: Blob | ArrayBuffer | Uint8Array,
      params: PdfPreviewParams = {},
    ): Promise<PdfPreview> {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, String(value));
      }
      const res = await backendFetch(`${BACKEND_BASE}/pdf/render?${query.toString()}`, {
        method: "POST",
        // The current TS lib's generic Uint8Array<ArrayBufferLike> no longer widens to BodyInit - requires casting.
        body: source as BodyInit,
      });
      if (!res.ok) {
        let reason = await res.text();
        try {
          reason = (JSON.parse(reason) as { error?: string }).error ?? reason;
        } catch {
          // Not JSON — use the raw body.
        }
        throw new Error(`PDF preview failed: ${reason}`);
      }
      if (!res.body) throw new Error("PDF preview returned an empty response");
      const pageCount = Number(res.headers.get("X-Page-Count"));
      return {
        body: res.body as ReadableStream<Uint8Array>,
        contentType: res.headers.get("Content-Type") ?? "image/webp",
        pageCount: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : null,
      };
    },
  };
}

export type Image = ReturnType<typeof createImage>;
