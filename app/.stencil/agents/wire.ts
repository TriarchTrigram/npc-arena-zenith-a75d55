/**
 * The envelope every hop of an agent run speaks: `UIMessage` parts down, UI message stream
 * chunks up; only the page and the box adapter read inside them. Copied verbatim to
 * `sandbox/app-agent/wire.ts` and the template's `agents/wire.ts` (neither can import `shared/`).
 */
import { z } from "zod";

export const RUN_STATES = ["queued", "copying", "running", "waiting", "done", "accepted", "failed", "stopped", "expired"] as const;
export type RunState = (typeof RUN_STATES)[number];

const dataPart = <N extends string, D extends z.ZodType>(name: N, data: D) =>
  z.object({
    type: z.literal(`data-${name}` as `data-${N}`),
    id: z.string().optional(),
    data,
    transient: z.boolean().optional(),
  });

// Parts shared by both directions

export const textPart = z.object({ type: z.literal("text"), text: z.string(), state: z.enum(["streaming", "done"]).optional() });
/** `url` is a key in the app's bucket (`agent-runs/<runId>/in/…`) or a data URL under 1 MB; bytes never ride in a part. */
export const filePart = z.object({
  type: z.literal("file"),
  url: z.string().min(1),
  mediaType: z.string().min(1),
  filename: z.string().optional(),
});

// Up parts (box → page)

export const progressData = z.object({ done: z.number().min(0), total: z.number().min(0), label: z.string() });
export const dataProgress = dataPart("progress", progressData);

/** `schema` is JSON Schema for the answer's `value`; an enum lists the choices the page offers. */
export const questionData = z.object({ questionId: z.string().min(1), prompt: z.string().min(1), schema: z.record(z.string(), z.unknown()) });
export const dataQuestion = dataPart("question", questionData);

export const dataResult = dataPart("result", z.unknown());

export const stateData = z.object({ state: z.enum(RUN_STATES), error: z.string().optional() });
export const dataState = dataPart("state", stateData);

export const dataSummary = dataPart("summary", z.object({ text: z.string() }));

/** An intent entry before a model or tool call and an outcome after it; the page never renders these. */
export const journalData = z.object({
  kind: z.enum(["intent", "outcome"]),
  callId: z.string(),
  tool: z.string(),
  input: z.unknown().optional(),
  ok: z.boolean().optional(),
  error: z.string().optional(),
});
export const dataJournal = dataPart("journal", journalData);

// Run-record parts: the model side of a run, for the Stencil team and the Builder Agent; a viewer never renders them.

export const tokenUsage = z.object({
  input_tokens: z.number().nullish(),
  output_tokens: z.number().nullish(),
  cache_read_input_tokens: z.number().nullish(),
  cache_creation_input_tokens: z.number().nullish(),
});
/** One per assistant message; the messages of one model call share `messageId`, the last carrying the final usage. */
export const usageData = z.object({ model: z.string(), messageId: z.string(), parentToolUseId: z.string().optional(), usage: tokenUsage });
export const dataUsage = dataPart("usage", usageData);

export const runResultData = z.object({
  subtype: z.string(),
  numTurns: z.number(),
  durationMs: z.number(),
  durationApiMs: z.number(),
  usage: z.record(z.string(), z.unknown()),
  modelUsage: z.record(z.string(), z.unknown()),
  sessionId: z.string().nullable(),
  isError: z.boolean(),
});
export const dataRunResult = dataPart("run-result", runResultData);

export const compactionData = z.object({ trigger: z.string(), preTokens: z.number(), postTokens: z.number().optional(), durationMs: z.number().optional() });
export const dataCompaction = dataPart("compaction", compactionData);

export const apiStatusData = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("retry"), attempt: z.number(), maxRetries: z.number(), retryDelayMs: z.number(), errorStatus: z.number().nullable(), error: z.string() }),
  z.object({ kind: z.literal("rate_limit"), status: z.string(), rateLimitType: z.string().optional(), resetsAt: z.number().optional(), utilization: z.number().optional() }),
]);
export const dataApiStatus = dataPart("api-status", apiStatusData);

export const dataSession = dataPart("session", z.object({ sessionId: z.string() }));

export const proxyRequestData = z.object({
  requestId: z.string(),
  method: z.string(),
  apiPath: z.string(),
  requestBody: z
    .object({
      model: z.string().optional(),
      max_tokens: z.number().optional(),
      stream: z.boolean().optional(),
      thinking: z.unknown().optional(),
      message_count: z.number(),
      last_role: z.string().optional(),
      last_preview: z.string(),
      tool_count: z.number(),
    })
    .nullable(),
});
export const dataProxyRequest = dataPart("proxy-request", proxyRequestData);

export const proxyResponseData = z.object({
  requestId: z.string(),
  responseStatus: z.number(),
  durationMs: z.number(),
  attempts: z.number(),
  upstreamError: z.boolean().optional(),
  upstreamErrorBody: z.string().optional(),
  upstreamRequestId: z.string().optional(),
  cfRay: z.string().optional(),
});
export const dataProxyResponse = dataPart("proxy-response", proxyResponseData);

export const textStart = z.object({ type: z.literal("text-start"), id: z.string() });
export const textDelta = z.object({ type: z.literal("text-delta"), id: z.string(), delta: z.string() });
export const textEnd = z.object({ type: z.literal("text-end"), id: z.string() });
/** `parentToolUseId` is set on a call made inside a sub-agent, naming the tool call that started it. */
export const toolInputAvailable = z.object({
  type: z.literal("tool-input-available"),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(),
  parentToolUseId: z.string().optional(),
});
/** A result over the box's cap is cut, with `truncated` and the length it had. */
export const toolOutputAvailable = z.object({
  type: z.literal("tool-output-available"),
  toolCallId: z.string(),
  output: z.unknown(),
  parentToolUseId: z.string().optional(),
  truncated: z.boolean().optional(),
  originalLength: z.number().optional(),
});
export const errorChunk = z.object({ type: z.literal("error"), errorText: z.string() });
export const finishChunk = z.object({ type: z.literal("finish") });

export const upChunk = z.discriminatedUnion("type", [
  textStart,
  textDelta,
  textEnd,
  filePart,
  toolInputAvailable,
  toolOutputAvailable,
  dataProgress,
  dataQuestion,
  dataResult,
  dataState,
  dataSummary,
  dataJournal,
  dataUsage,
  dataRunResult,
  dataCompaction,
  dataApiStatus,
  dataSession,
  dataProxyRequest,
  dataProxyResponse,
  errorChunk,
  finishChunk,
]);
export type UpChunk = z.infer<typeof upChunk>;

// Down parts (app → box)

export const answerData = z.object({ questionId: z.string().min(1), value: z.unknown() });
export const dataAnswer = dataPart("answer", answerData);

/** Platform only, never from app code. */
export const controlData = z.object({ op: z.literal("stop") });
export const dataControl = dataPart("control", controlData);

export const downPart = z.discriminatedUnion("type", [textPart, filePart, dataAnswer, dataControl]);
export type DownPart = z.infer<typeof downPart>;

export const downMessage = z.object({
  id: z.string().min(1),
  role: z.literal("user"),
  parts: z.array(downPart).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DownMessage = z.infer<typeof downMessage>;

// The log

/** One row of a run's log: the run object's table while the run lives, `log.ndjson` after. */
export const logRow = z.discriminatedUnion("dir", [
  z.object({ seq: z.number().int(), at: z.number(), dir: z.literal("down"), part: downMessage }),
  z.object({ seq: z.number().int(), at: z.number(), dir: z.literal("up"), part: upChunk }),
]);
export type LogRow = z.infer<typeof logRow>;
export type LogDirection = LogRow["dir"];

/** Up chunk types a viewer never renders. */
export const TRANSIENT_UP_TYPES: ReadonlySet<string> = new Set([
  "data-journal",
  "data-usage",
  "data-run-result",
  "data-compaction",
  "data-api-status",
  "data-session",
  "data-proxy-request",
  "data-proxy-response",
]);
/** Tool names the box translates into parts (or hides) instead of emitting as tool steps. */
export const HARNESS_TOOLS: ReadonlySet<string> = new Set(["StructuredOutput", "report_progress", "ask_user", "finish", "input_status", "request_input", "release_input"]);

export const MAX_DATA_URL_BYTES = 1024 * 1024;

export function runInputPrefix(runId: string): string {
  return `agent-runs/${runId}/in/`;
}

export function isRunInputKey(url: string, runId: string): boolean {
  return url.startsWith(runInputPrefix(runId)) && url.length > runInputPrefix(runId).length;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function textMessage(text: string, id = newId()): DownMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

export function answerMessage(questionId: string, value: unknown, id = newId()): DownMessage {
  return { id, role: "user", parts: [{ type: "data-answer", data: { questionId, value } }] };
}

export function stopMessage(id = newId()): DownMessage {
  return { id, role: "user", parts: [{ type: "data-control", data: { op: "stop" } }] };
}

/** The text of a down message, for logs and summaries. */
export function messageText(message: DownMessage): string {
  return message.parts
    .filter((p): p is z.infer<typeof textPart> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

/**
 * Check an answer against the question's schema: an enum must be hit exactly, a declared
 * primitive type must match, and nothing else is enforced. Returns the reason it fails.
 */
export function answerMismatch(schema: Record<string, unknown>, value: unknown): string | null {
  const choices = schema.enum;
  if (Array.isArray(choices) && !choices.some((c) => c === value)) return `the answer must be one of: ${choices.join(", ")}`;
  const type = schema.type;
  if (type === "string" && typeof value !== "string") return "the answer must be text";
  if (type === "number" && typeof value !== "number") return "the answer must be a number";
  if (type === "boolean" && typeof value !== "boolean") return "the answer must be true or false";
  return null;
}
