import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentRunState, RunMessage as DownMessage, RunStreamFrame } from "../../types/agents";

/** The one down message the view builds itself: an answer to the open question. */
const answerMessage = (questionId: string, value: unknown): DownMessage => ({
  id: crypto.randomUUID(),
  role: "user",
  parts: [{ type: "data-answer", data: { questionId, value } }],
});

const RECONNECT_MS = 2_000;
const POLL_MS = 2_000;
const FINISHED: readonly AgentRunState[] = ["done", "accepted", "failed", "stopped", "expired"];

export interface AgentRunProgress {
  done: number;
  total: number;
  label: string;
  /** `done / total` as a whole percent, or null while `total` is 0. */
  percent: number | null;
}

/** The question the agent is waiting on; `schema` is JSON Schema for the answer, `enum` lists the choices. */
export interface AgentRunQuestion {
  questionId: string;
  prompt: string;
  schema: Record<string, unknown>;
}

export interface AgentRun {
  state: AgentRunState | null;
  /** Every stream row in order, down messages and up chunks alike. */
  frames: RunStreamFrame[];
  /** What was sent to the run: the first message, notes, files and answers. */
  messages: DownMessage[];
  progress: AgentRunProgress | null;
  question: AgentRunQuestion | null;
  summary: string | null;
  /** The agent's structured output, once it ends with one. */
  result: unknown;
  error: string | null;
  /** The latest text the agent wrote. */
  text: string;
  connected: boolean;
  answer(questionId: string, value: unknown): Promise<void>;
  send(message: { text?: string; files?: File[] }): Promise<void>;
  stop(): Promise<void>;
}

async function postCommand(runId: string, command: string, body: BodyInit, headers?: HeadersInit): Promise<void> {
  const res = await fetch(`/api/agents/runs/${runId}/${command}`, { method: "POST", headers, body });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `${command} failed with ${res.status}`);
  }
}

const postJson = (runId: string, command: string, body: unknown) =>
  postCommand(runId, command, JSON.stringify(body), { "Content-Type": "application/json" });

/**
 * Follow one run from the browser: opens the run's stream, keeps the rows in order,
 * and reconnects from the last row it saw until the run finishes. Pass null for no run.
 */
export function useAgentRun(runId: string | null): AgentRun {
  const [frames, setFrames] = useState<RunStreamFrame[]>([]);
  const [connected, setConnected] = useState(false);
  const lastSeq = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    setFrames([]);
    lastSeq.current = 0;
    finished.current = false;
    if (!runId || typeof window === "undefined") return;

    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let opened = false;

    const take = (frame: RunStreamFrame) => {
      if (typeof frame.seq === "number") lastSeq.current = Math.max(lastSeq.current, frame.seq);
      if (frame.dir === "up" && frame.part?.type === "finish") finished.current = true;
      setFrames((prev) => [...prev, frame]);
    };

    // A proxy that refuses WebSockets gets the same rows over plain HTTP, two seconds at a time.
    const poll = async () => {
      if (closed || finished.current) return;
      try {
        const res = await fetch(`/api/agents/runs/${runId}/frames?after=${lastSeq.current}`);
        if (res.ok) {
          const { frames } = (await res.json()) as { frames: RunStreamFrame[] };
          setConnected(true);
          for (const frame of frames) take(frame);
        }
      } catch (err) {
        console.warn("[agents] frames poll failed", err);
      }
      if (!closed && !finished.current) timer = setTimeout(poll, POLL_MS);
    };

    const connect = () => {
      const origin = window.location.origin.replace(/^http/, "ws");
      socket = new WebSocket(`${origin}/api/agents/runs/${runId}/stream?after=${lastSeq.current}`);
      socket.onopen = () => {
        opened = true;
        setConnected(true);
      };
      socket.onmessage = (message) => {
        let frame: RunStreamFrame;
        try {
          frame = JSON.parse(String(message.data)) as RunStreamFrame;
        } catch {
          console.warn("[agents] bad stream frame", message.data);
          return;
        }
        take(frame);
      };
      socket.onclose = () => {
        setConnected(false);
        if (closed || finished.current) return;
        timer = setTimeout(opened ? connect : poll, RECONNECT_MS);
      };
    };
    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [runId]);

  let state: AgentRunState | null = null;
  let progress: AgentRunProgress | null = null;
  let question: AgentRunQuestion | null = null;
  let summary: string | null = null;
  let result: unknown = null;
  let error: string | null = null;
  const messages: DownMessage[] = [];
  const texts = new Map<string, string>();
  let textId: string | null = null;
  for (const frame of frames) {
    if (frame.dir === "down") {
      messages.push(frame.part);
      for (const p of frame.part.parts) {
        if (p.type === "data-answer" && p.data.questionId === question?.questionId) question = null;
      }
      continue;
    }
    const part = frame.part;
    switch (part.type) {
      case "data-state":
        state = part.data.state;
        if (part.data.error) error = part.data.error;
        if (state !== "waiting") question = null;
        // The files are prepared once the run queues; the agent's own progress starts from nothing.
        if (state === "queued") progress = null;
        break;
      case "data-progress": {
        const { done, total, label } = part.data;
        progress = { done, total, label, percent: total > 0 ? Math.round((done / total) * 100) : null };
        break;
      }
      case "data-question":
        question = part.data;
        break;
      case "data-summary":
        summary = part.data.text;
        break;
      case "data-result":
        result = part.data;
        break;
      case "text-start":
        textId = part.id;
        texts.set(part.id, "");
        break;
      case "text-delta":
        textId = part.id;
        texts.set(part.id, (texts.get(part.id) ?? "") + part.delta);
        break;
      case "error":
        error = part.errorText;
        break;
    }
  }
  if (state && FINISHED.includes(state)) question = null;
  const text = textId ? (texts.get(textId) ?? "") : "";

  const answer = useCallback(
    (questionId: string, value: unknown) =>
      runId ? postJson(runId, "messages", { message: answerMessage(questionId, value) }) : Promise.resolve(),
    [runId],
  );
  const send = useCallback(
    ({ text, files }: { text?: string; files?: File[] }) => {
      if (!runId) return Promise.resolve();
      const form = new FormData();
      if (text?.trim()) form.set("text", text.trim());
      for (const file of files ?? []) form.append("files", file, file.name);
      return postCommand(runId, "messages", form);
    },
    [runId],
  );
  const stop = useCallback(() => (runId ? postJson(runId, "stop", {}) : Promise.resolve()), [runId]);

  return { state, frames, messages, progress, question, summary, result, error, text, connected, answer, send, stop };
}

const STATE_LABEL: Record<AgentRunState, string> = {
  queued: "Queued",
  copying: "Preparing files",
  running: "Running",
  waiting: "Waiting for you",
  done: "Done",
  accepted: "Accepted",
  failed: "Failed",
  stopped: "Stopped",
  expired: "Expired",
};

/** A typed answer: the schema's own type for numbers and booleans, text otherwise. */
function coerceAnswer(schema: Record<string, unknown>, raw: string): unknown {
  if (schema.type === "number" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  if (schema.type === "boolean" && (raw === "true" || raw === "false")) return raw === "true";
  return raw;
}

export interface AgentRunViewProps {
  runId: string | null;
  className?: string;
}

const inputClass = "flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm";
const primaryButtonClass = "rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50";

/**
 * A ready-made run panel. It talks to `/api/agents/runs/*`, so the app must spread
 * `stencilAgentRoutes` into `app/routes.ts`.
 */
export function AgentRunView({ runId, className }: AgentRunViewProps) {
  const run = useAgentRun(runId);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const question = run.question;

  const submit = async (work: () => Promise<void>, fallback: string) => {
    setSending(true);
    setSendError(null);
    try {
      await work();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : fallback);
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = (value: unknown) => {
    if (!question || value === "") return;
    void submit(async () => {
      await run.answer(question.questionId, value);
      setDraft("");
    }, "Could not send the answer.");
  };

  const submitNote = () => {
    if (!note.trim() && files.length === 0) return;
    void submit(async () => {
      await run.send({ text: note, files });
      setNote("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
    }, "Could not send the message.");
  };

  if (!runId) return null;
  const state = run.state;
  const percent = run.progress?.percent ?? null;
  const active = state === "running" || state === "waiting" || state === "queued" || state === "copying";
  const stateLabel =
    state === "copying" && run.progress && run.progress.total > 0
      ? `${STATE_LABEL.copying} ${run.progress.done} / ${run.progress.total}`
      : state
        ? STATE_LABEL[state]
        : run.connected
          ? "Connecting"
          : "Starting";
  const choices = Array.isArray(question?.schema.enum) ? (question.schema.enum as unknown[]) : null;

  return (
    <section className={`rounded-lg border border-border bg-card p-4 text-card-foreground ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span
          data-testid="agent-run-state"
          className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {stateLabel}
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => void run.stop()}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Stop
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-label={run.progress?.label ?? "Progress"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          data-testid="agent-run-progress"
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full bg-primary transition-all ${percent === null && active ? "w-1/3 animate-pulse" : ""}`}
            style={percent !== null ? { width: `${Math.min(100, Math.max(0, percent))}%` } : undefined}
          />
        </div>
        {run.progress?.label ? <p className="mt-1 text-xs text-muted-foreground">{run.progress.label}</p> : null}
      </div>

      {run.messages.length ? (
        <ul data-testid="agent-run-sent" className="mt-3 space-y-1 text-xs text-muted-foreground">
          {run.messages.map((message) =>
            message.parts.map((part, i) => {
              if (part.type === "text") return <li key={`${message.id}:${i}`}>Sent: {part.text}</li>;
              if (part.type === "file") {
                return (
                  <li key={`${message.id}:${i}`} data-testid="agent-run-sent-file">
                    {part.filename ?? part.url}
                  </li>
                );
              }
              return null;
            }),
          )}
        </ul>
      ) : null}

      {run.text ? <p className="mt-3 whitespace-pre-wrap text-sm">{run.text}</p> : null}

      {question ? (
        <form
          data-testid="agent-run-question"
          className="mt-4 space-y-2 rounded-md border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitAnswer(coerceAnswer(question.schema, draft.trim()));
          }}
        >
          <p className="text-sm font-medium">{question.prompt}</p>
          {choices?.length ? (
            <div className="flex flex-wrap gap-2">
              {choices.map((choice) => (
                <button
                  key={String(choice)}
                  type="button"
                  disabled={sending}
                  onClick={() => submitAnswer(choice)}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {String(choice)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your answer" className={inputClass} />
              <button type="submit" disabled={sending || !draft.trim()} className={primaryButtonClass}>
                Answer
              </button>
            </div>
          )}
        </form>
      ) : null}

      {run.result !== null && run.result !== undefined ? (
        <pre data-testid="agent-run-result" className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(run.result, null, 2)}
        </pre>
      ) : null}

      {run.summary ? (
        <div data-testid="agent-run-summary" className="mt-4 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
          {run.summary}
        </div>
      ) : null}

      {run.error ? <p className="mt-3 text-sm text-destructive">{run.error}</p> : null}

      {active ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitNote();
          }}
        >
          <input
            data-testid="agent-run-send-text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Send the agent a note"
            className={inputClass}
          />
          <input
            ref={fileInput}
            data-testid="agent-run-send-file"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-xs"
          />
          <button
            data-testid="agent-run-send"
            type="submit"
            disabled={sending || (!note.trim() && files.length === 0)}
            className={primaryButtonClass}
          >
            Send
          </button>
        </form>
      ) : null}

      {sendError ? <p className="mt-2 text-xs text-destructive">{sendError}</p> : null}
    </section>
  );
}
