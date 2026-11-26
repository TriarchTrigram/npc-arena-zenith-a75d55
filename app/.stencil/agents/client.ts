import { BACKEND_BASE, createBackendFetch } from "../backend";
import type { AgentRunState, AgentRunStatus, StartRunRequest } from "../types/agents";
import { answerMessage, textMessage, type DownMessage } from "./wire";

/** A non-2xx answer from the platform; `message` is the platform's own `error` text. */
export class AgentsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AgentsError";
  }
}

/** A full message, or a string for one text part. */
export type MessageInput = DownMessage | string;

export type RunOptions = Omit<StartRunRequest, "agent" | "message"> & { message: MessageInput };

export interface AgentsClient {
  /** Start a run for an app user; `files` are bucket keys copied into the run's `in/` folder. */
  run(agent: string, options: RunOptions): Promise<AgentRunStatus>;
  status(runId: string): Promise<AgentRunStatus>;
  list(filter?: { agent?: string; state?: AgentRunState }): Promise<AgentRunStatus[]>;
  /** Hand the run another message (a note, a file) that the agent reads at its next turn. */
  send(runId: string, message: MessageInput): Promise<AgentRunStatus>;
  answer(runId: string, questionId: string, value: unknown): Promise<AgentRunStatus>;
  stop(runId: string): Promise<AgentRunStatus>;
  /** Copy the run's outputs into the app's bucket; returns the new keys. */
  accept(runId: string, paths?: string[]): Promise<{ run: AgentRunStatus; keys: string[] }>;
  /** A 10-minute token that lets a browser open the run's stream. */
  viewerToken(runId: string): Promise<{ token: string; expiresAt: number }>;
}

const asMessage = (message: MessageInput): DownMessage => (typeof message === "string" ? textMessage(message) : message);

export function createAgents(env: Env): AgentsClient {
  const backendFetch = createBackendFetch(env);

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await backendFetch(`${BACKEND_BASE}/agents${path}`, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new AgentsError(body?.error ?? `agents request failed with ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  }

  const post = <T>(path: string, body?: unknown) =>
    call<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

  const send = (runId: string, message: MessageInput) =>
    post<{ run: AgentRunStatus }>(`/runs/${runId}/messages`, { message: asMessage(message) }).then((r) => r.run);

  return {
    run: (agent, { message, ...rest }) =>
      post<{ run: AgentRunStatus }>("/runs", { agent, ...rest, message: asMessage(message) } satisfies StartRunRequest).then(
        (r) => r.run,
      ),
    status: (runId) => call<{ run: AgentRunStatus }>(`/runs/${runId}`).then((r) => r.run),
    list: (filter = {}) => {
      const query = new URLSearchParams();
      if (filter.agent) query.set("agent", filter.agent);
      if (filter.state) query.set("state", filter.state);
      const qs = query.toString();
      return call<{ runs: AgentRunStatus[] }>(`/runs${qs ? `?${qs}` : ""}`).then((r) => r.runs);
    },
    send,
    answer: (runId, questionId, value) => send(runId, answerMessage(questionId, value)),
    stop: (runId) => post<{ run: AgentRunStatus }>(`/runs/${runId}/stop`).then((r) => r.run),
    accept: (runId, paths) => post(`/runs/${runId}/accept`, paths ? { paths } : {}),
    viewerToken: (runId) => post(`/runs/${runId}/viewer-token`),
  };
}
