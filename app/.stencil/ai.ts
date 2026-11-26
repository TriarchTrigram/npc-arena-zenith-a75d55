import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";
import {
  createProviderRegistry,
  generateObject,
  wrapLanguageModel,
  wrapProvider,
  type LanguageModelMiddleware,
  type ProviderRegistryProvider,
  type UserContent,
} from "ai";
import { z, type ZodType } from "zod";
import { BACKEND_BASE, createBackendFetch, withFeature } from "./backend";
import { createImage } from "./image";
import { requestLanguage } from "./request-context";
import { createStorage, sniffImageType } from "./storage";

export interface TranscribeParams {
  /**
   * The speech to turn into text: an uploaded `File`/`Blob`, raw bytes, or
   * `{ key }` naming an audio file already in the app's own storage (what
   * `createStorage().put` took). A video must become audio first —
   * `createMedia(env).transform({ operation: "convert", input, format: "mp3" })`
   * — then pass its finished key. Max 10 MB; a larger file is rejected (a video
   * of any length is the `captions` media operation instead).
   */
  audio: Blob | ArrayBuffer | Uint8Array | { key: string };
  /** The spoken language as an ISO 639-1 code (`"en"`, `"es"`). Detected when omitted. */
  language?: string;
  /** Names and terms the speaker is likely to say — people, products, jargon — to steer their spelling. */
  prompt?: string;
  /** The in-app feature this transcription belongs to on the Usage page, e.g. `"voice-notes"`. */
  feature?: string;
}

export interface TranscriptSegment {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  /** The whole transcription as one string. */
  text: string;
  /** Detected (or given) language code. */
  language: string | null;
  /** Length of the audio in seconds. */
  duration: number | null;
  /** The transcription in timed pieces — for timestamps, chapters, or jumping the player. */
  segments: TranscriptSegment[];
  /** The same, as WebVTT captions ready to attach to a `<video>`. */
  vtt: string | null;
}

export interface ReadDocumentParams {
  /**
   * The upload to read: a `File`/`Blob`, raw bytes, or `{ key }` naming a file already in the
   * app's own storage. A PDF, a picture (a photo, a screenshot, a scan) or plain text, up to
   * 20 MB. A PDF is read as a whole, up to 100 pages.
   */
  file: Blob | ArrayBuffer | Uint8Array | { key: string };
  /** The file's type when its bytes cannot say (a `.txt`); read from the `File` or the stored object when omitted. */
  contentType?: string;
  /** What to look for, in plain words, on top of the standard instructions: "the total is the line marked Total due". */
  instructions?: string;
  /** The model that reads a PDF or picture. Haiku 5.5 unless the document needs more. */
  model?: ModelId;
  /** The in-app feature this read belongs to on the Usage page, e.g. `"invoice-scan"`. */
  feature?: string;
}

/** What an uploaded document turned out to be, read from its bytes before its declared type. */
export type DocumentKind = "pdf" | "image" | "text";

/** How much of a document could be read: "partly" means some words or areas were unreadable, "none" a blank or illegible page. */
export type DocumentLegibility = "all" | "partly" | "none";

export interface DocumentText {
  kind: DocumentKind;
  /** Every word in reading order, one line per heading, paragraph, list item or table row. */
  text: string;
  legibility: DocumentLegibility;
}

export interface DocumentFields<T> {
  kind: DocumentKind;
  /** The fields the schema asked for, filled from what the document says. */
  fields: T;
  legibility: DocumentLegibility;
}

export interface ReadDocument {
  /** The plain text of the document. A text file is read directly, with no model call. */
  (params: ReadDocumentParams): Promise<DocumentText>;
  /** The fields a Zod schema names, filled from the document; follows the `generateObject` schema rules. */
  <T>(params: ReadDocumentParams & { schema: ZodType<T> }): Promise<DocumentFields<T>>;
}

/** Haiku 4.x spellings apps may no longer name; `anthropic:claude-haiku-5-5` replaces them all. */
type RetiredHaikuId =
  | "anthropic:claude-haiku-4-5-20251001"
  | "anthropic:claude-haiku-4-5"
  | "anthropic:claude-haiku-4-6"
  | "anthropic:claude-3-haiku-20240307"
  | "anthropic:claude-3-5-haiku-latest";

type ModelId = `${"openai" | "anthropic"}:${string}`;

type Registry = ProviderRegistryProvider<{ openai: OpenAIProvider; anthropic: AnthropicProvider }>;

export interface AICallOptions {
  /**
   * The in-app feature this model serves, as the Usage page groups spend: a short, stable,
   * lowercase label such as `"fill-the-blanks"`. Without it the call is recorded under the
   * route that made it. Renaming the label starts a new row; it does not change the feature.
   */
  feature?: string;
  /**
   * The language the model writes in, as an ISO 639-1 code (`"es"`). On an app with a second
   * language it defaults to the language of the request being served; pass it for work done for
   * someone else (a schedule, a send to many), from `appUserLanguage` in `~stencil/locale`.
   */
  language?: string;
}

/** One in-app feature's AI spend this billing period, as `ai.usage()` reads it. */
export interface AIFeatureUsage {
  /** The label the code gave the call or its route id; null for calls from a build before tagging. */
  feature: string | null;
  calls: number;
  /** Calls made before their model had a price; counted in `calls`, not in the cost. */
  unpricedCalls: number;
  /** Null when no call in the row has a price. */
  credits: number | null;
  costUsd: number | null;
}

export interface AIUsage {
  /** ISO instants; the window is [from, to). */
  period: { from: string; to: string };
  environment: "production" | "preview";
  /** Costliest first. */
  features: AIFeatureUsage[];
  total: { calls: number; unpricedCalls: number; credits: number; costUsd: number };
  /** False while Stencil pays for the AI inside apps; the credits are a measure, not a charge. */
  charged: boolean;
}

export type AI = Omit<Registry, "languageModel" | "imageModel" | "transcriptionModel" | "speechModel"> & {
  languageModel<K extends ModelId>(
    id: K extends RetiredHaikuId ? "Haiku 4.x is retired for apps: use anthropic:claude-haiku-5-5" : K,
    options?: AICallOptions,
  ): ReturnType<Registry["languageModel"]>;
  transcribe(params: TranscribeParams): Promise<Transcript>;
  readDocument: ReadDocument;
  /** What this app's AI cost this billing period, per feature, for this deploy (preview or published). */
  usage(): Promise<AIUsage>;
};

/**
 * Thrown when a reply ended at its output cap with nothing written, or (on a Claude 5.x model,
 * which thinks by default and pays for it out of `maxOutputTokens`) was cut off mid-answer.
 */
export class AIOutputLimitError extends Error {
  constructor(wrote: boolean, advice: string) {
    super(
      (wrote
        ? "The AI reply was cut off at its output limit"
        : "The AI reply hit its output limit before writing any text") + ` — ${advice}`,
    );
    this.name = "AIOutputLimitError";
  }
}

type CallParams = { providerOptions?: Record<string, Record<string, unknown>> };

const thinkingRequested = (params: CallParams) =>
  (params.providerOptions?.anthropic?.thinking as { type?: string } | undefined)?.type;

// How a model thinks when the call sets nothing: the 5.x models think by default, and Sonnet 5.5,
// Opus 5.5 and Fable cannot have it turned off (the SDK rewrites or drops the setting).
const thinkingDefault = (modelId: string): "off" | "on" | "always" => {
  if (/claude-(sonnet-5-5|opus-5-5|fable-5)/.test(modelId)) return "always";
  if (/claude-[a-z]+-5(-|$)/.test(modelId)) return "on";
  return "off";
};

// A cut-off reply is a failure only when thinking could have eaten the cap. Elsewhere a small cap
// is the length guard the call asked for.
const thinks = (modelId: string, params: CallParams) =>
  thinkingDefault(modelId) === "always" || (thinkingDefault(modelId) === "on" && thinkingRequested(params) !== "disabled");

// The one lever that helps on this model. With thinking off, or on a model whose lowest
// setting still thinks, the cap most likely went on the answer itself.
const limitAdvice = (modelId: string, params: CallParams): string => {
  const mode = thinkingDefault(modelId);
  if (mode === "off" || thinkingRequested(params) === "disabled") return "raise maxOutputTokens on the call";
  if (mode === "on" && !/claude-opus-5/.test(modelId)) {
    return (
      "on a quick-task call turn thinking off (providerOptions.anthropic.thinking = { type: \"disabled\" }); " +
      "where the call needs reasoning, raise maxOutputTokens"
    );
  }
  return (
    "raise maxOutputTokens; on a quick-task call move it to anthropic:claude-haiku-5-5 with thinking off " +
    "(this model cannot turn thinking off), or lower providerOptions.anthropic.effort"
  );
};

const failReplyAtLimit: LanguageModelMiddleware = {
  specificationVersion: "v3",
  async wrapGenerate({ doGenerate, model, params }) {
    const result = await doGenerate();
    const wrote = result.content.some((c) => (c.type === "text" && c.text.trim() !== "") || c.type === "tool-call");
    if (result.finishReason.unified === "length" && (!wrote || thinks(model.modelId, params))) {
      throw new AIOutputLimitError(wrote, limitAdvice(model.modelId, params));
    }
    return result;
  },
  async wrapStream({ doStream, model, params }) {
    const { stream, ...rest } = await doStream();
    let wrote = false;
    const checked = stream.pipeThrough(
      new TransformStream({
        transform(part, controller) {
          if ((part.type === "text-delta" && part.delta.trim() !== "") || part.type === "tool-call") wrote = true;
          if (part.type === "finish" && part.finishReason.unified === "length" && (!wrote || thinks(model.modelId, params))) {
            controller.enqueue({ type: "error", error: new AIOutputLimitError(wrote, limitAdvice(model.modelId, params)) });
          }
          controller.enqueue(part);
        },
      }),
    );
    return { stream: checked, ...rest };
  },
};

// Anthropic takes a request of 32 MB, and a PDF grows by a third as base64; the image path
// has the transform's own 20 MB cap, so one limit covers every kind.
const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
// Anthropic shrinks a longer edge itself, so a bigger picture is only more bytes to send.
const DOCUMENT_IMAGE_EDGE = 1568;
const DOCUMENT_MODEL: ModelId = "anthropic:claude-haiku-5-5";

const LEGIBILITY = z
  .enum(["all", "partly", "none"])
  .describe('"all" when every word was readable, "partly" when some words or areas were not, "none" when there is no readable text');

const TRANSCRIBE_PROMPT =
  "Write out every word in this document in reading order, as plain text. Keep each heading, paragraph, list item " +
  'and table row on its own line, with a table row\'s cells separated by " | ". Do not summarise, translate, correct ' +
  "or add anything. Then say how much of it was legible.";
const FIELDS_PROMPT =
  "Read this document and fill in the fields from what it says. Leave a field empty rather than guessing when the " +
  "document does not state it. Then say how much of the document was legible.";

function bytesAt(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

// Storage keeps a Markdown, CSV, JSON or HTML upload as generic bytes, so its start says
// whether it is text: valid UTF-8 with no NUL byte.
function startsAsText(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 4096);
  if (head.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

function documentKindOf(bytes: Uint8Array, declared: string | null): DocumentKind | null {
  const type = (declared ?? "").split(";")[0].trim().toLowerCase();
  if (bytesAt(bytes, 0, "%PDF")) return "pdf";
  // The ISO container is a HEIC photo or a video; the image transform reads neither.
  if (bytesAt(bytes, 4, "ftyp") || type === "image/heic") return null;
  if (sniffImageType(bytes) || type.startsWith("image/")) return "image";
  if (type.startsWith("text/") || type === "application/json") return "text";
  if (type === "application/octet-stream" && startsAsText(bytes)) return "text";
  return null;
}

async function documentBytes(env: Env, file: ReadDocumentParams["file"]): Promise<{ bytes: Uint8Array; declared: string | null }> {
  if ("key" in file) {
    const object = await createStorage(env).get(file.key);
    if (!object) throw new Error(`Reading the document failed: no stored file at \`${file.key}\``);
    return { bytes: new Uint8Array(await object.arrayBuffer()), declared: object.httpMetadata?.contentType ?? null };
  }
  if (file instanceof Blob) return { bytes: new Uint8Array(await file.arrayBuffer()), declared: file.type || null };
  return { bytes: file instanceof Uint8Array ? file : new Uint8Array(file), declared: null };
}

// Every provider call runs inside the feature's tag, so the gateway request the SDK makes carries it.
const tagFeature = (feature: string): LanguageModelMiddleware => ({
  specificationVersion: "v3",
  wrapGenerate: ({ doGenerate }) => withFeature(feature, doGenerate),
  wrapStream: ({ doStream }) => withFeature(feature, doStream),
});

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function languageName(language: string): string {
  try {
    return LANGUAGE_NAMES.of(language) ?? language;
  } catch {
    // Not a language tag, so it is already a name ("Spanish"): used as written.
    return language;
  }
}

// The instruction goes after the call's own system messages and before the first turn:
// Anthropic refuses a system message that follows a user message.
const writeIn = (language: string): LanguageModelMiddleware => ({
  specificationVersion: "v3",
  transformParams: async ({ params }) => {
    const turn = params.prompt.findIndex((message) => message.role !== "system");
    const prompt = [...params.prompt];
    prompt.splice(turn === -1 ? prompt.length : turn, 0, {
      role: "system",
      content:
        `Write everything a person will read in ${languageName(language)}. Everything else in this ` +
        `request may be in another language; answer in ${languageName(language)} anyway. Only an ` +
        "instruction naming a different output language overrides this.",
    });
    return { ...params, prompt };
  },
});

/**
 * Create an AI provider registry proxied through the Stencil gateway, which serves only chat
 * (`languageModel`), embeddings (`textEmbeddingModel`), `transcribe()`, `readDocument()` and
 * `usage()`. The providers' other factories (image, transcription, speech models) reach no
 * route, so the type leaves them off.
 */
export function createAI(env: Env): AI {
  const backendFetch = createBackendFetch(env);

  const openai = createOpenAI({
    baseURL: `${BACKEND_BASE}/ai/openai/v1`,
    apiKey: "unused",
    fetch: backendFetch,
  });

  const anthropic = createAnthropic({
    baseURL: `${BACKEND_BASE}/ai/anthropic`,
    apiKey: "unused",
    fetch: backendFetch,
  });

  // `wrapProvider` returns a bare ProviderV3; typing the registry by its provider types keeps
  // `createAI`'s declared type free of ai's nested @ai-sdk/provider copy, which declaration emit can't name.
  const registry: Registry = createProviderRegistry({
    openai,
    anthropic: wrapProvider({
      provider: anthropic,
      languageModelMiddleware: [failReplyAtLimit],
    }) as AnthropicProvider,
  });

  const baseLanguageModel = registry.languageModel.bind(registry);
  const ai: Omit<AI, "languageModel" | "transcribe" | "readDocument" | "usage"> = registry;

  const featureModel = (id: string, feature?: string) => {
    const model = baseLanguageModel(id as ModelId);
    return feature ? wrapLanguageModel({ model, middleware: tagFeature(feature) }) : model;
  };

  const languageModel = (id: string, options?: AICallOptions) => {
    const model = featureModel(id, options?.feature);
    const language = options?.language ?? requestLanguage.getStore()?.language;
    return language ? wrapLanguageModel({ model, middleware: writeIn(language) }) : model;
  };

  /**
   * Read what is inside an upload: the plain text, or the fields a schema names. A PDF or
   * picture goes to a model that reads documents (a paid call, on the app builder's AI usage);
   * a text file is read in the Worker. Server-side only (loaders / actions / scheduled
   * handlers): read it once after the upload and keep the result in D1 with the record.
   */
  const readDocument = (async (params: ReadDocumentParams & { schema?: ZodType<unknown> }) => {
    const { bytes, declared } = await documentBytes(env, params.file);
    const kind = documentKindOf(bytes, params.contentType ?? declared);
    if (!kind) {
      const what = params.contentType ?? declared;
      throw new Error(
        `Reading the document failed: ${what ? `a ${what} file` : "this file type"} is not supported — a PDF, a picture or plain text is`,
      );
    }
    if (bytes.byteLength > DOCUMENT_MAX_BYTES) {
      throw new Error(`Reading the document failed: the file is ${(bytes.byteLength / 1048576).toFixed(1)} MB, over the 20 MB limit`);
    }

    const content: Exclude<UserContent, string> = [];
    if (kind === "pdf") {
      content.push({ type: "file", data: bytes, mediaType: "application/pdf" });
    } else if (kind === "image") {
      const { body } = await createImage(env).transform(bytes, {
        width: DOCUMENT_IMAGE_EDGE,
        height: DOCUMENT_IMAGE_EDGE,
        fit: "scale-down",
        format: "image/webp",
      });
      content.push({ type: "image", image: new Uint8Array(await new Response(body).arrayBuffer()), mediaType: "image/webp" });
    } else {
      const text = new TextDecoder().decode(bytes).trim();
      if (!params.schema) return { kind, text, legibility: text ? "all" : "none" } satisfies DocumentText;
      content.push({ type: "text", text: `The document:\n\n${text}` });
    }

    const prompt = params.schema ? FIELDS_PROMPT : TRANSCRIBE_PROMPT;
    content.push({ type: "text", text: params.instructions ? `${prompt}\n\n${params.instructions}` : prompt });
    const { object } = await generateObject({
      // A document is read as written, so this call takes no language instruction.
      model: featureModel(params.model ?? DOCUMENT_MODEL, params.feature),
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      maxOutputTokens: 16384,
      schema: params.schema
        ? z.object({ fields: params.schema, legibility: LEGIBILITY })
        : z.object({ text: z.string().describe("every word of the document in reading order"), legibility: LEGIBILITY }),
      messages: [{ role: "user", content }],
    });
    return "fields" in object
      ? ({ kind, fields: object.fields, legibility: object.legibility } satisfies DocumentFields<unknown>)
      : ({ kind, text: object.text, legibility: object.legibility } satisfies DocumentText);
  }) as ReadDocument;

  return Object.assign(ai, {
    languageModel,
    readDocument,
    /**
     * Turn recorded speech into text on the platform (Whisper on Workers AI; the
     * audio never leaves Cloudflare). No keys required. Server-side only (loaders /
     * actions / scheduled handlers): accept the recording or upload in an action,
     * or store it and pass `{ key }`, and keep the transcript in D1.
     */
    async transcribe({ audio, language, prompt, feature }: TranscribeParams): Promise<Transcript> {
      let blob: Blob;
      if ("key" in audio) {
        const object = await createStorage(env).get(audio.key);
        if (!object) throw new Error(`Transcription failed: no stored file at \`${audio.key}\``);
        blob = await object.blob();
      } else {
        // The current TS lib's generic Uint8Array<ArrayBufferLike> no longer widens to BlobPart - requires casting.
        blob = audio instanceof Blob ? audio : new Blob([audio as BlobPart]);
      }
      const form = new FormData();
      form.append("audio", blob, "audio");
      if (language) form.append("language", language);
      if (prompt) form.append("prompt", prompt);
      const send = () => backendFetch(`${BACKEND_BASE}/ai/transcribe`, { method: "POST", body: form });
      const res = await (feature ? withFeature(feature, send) : send());
      if (!res.ok) throw new Error(`Transcription failed: ${await res.text()}`);
      return res.json() as Promise<Transcript>;
    },

    async usage(): Promise<AIUsage> {
      const res = await backendFetch(`${BACKEND_BASE}/usage/ai`);
      if (!res.ok) throw new Error(`Reading AI usage failed: ${await res.text()}`);
      return res.json() as Promise<AIUsage>;
    },
  });
}
