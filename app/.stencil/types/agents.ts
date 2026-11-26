/**
 * What an app sees of an agent run: the run record, the stream rows and the events
 * the platform pushes. A copy of the platform contract (`shared/app-agents/types.ts`);
 * the template cannot import `shared/`. Messages and stream parts are the `agents/wire` envelope.
 */
import type { DownMessage, LogRow, RunState, UpChunk } from "../agents/wire";

export type AgentEnvironment = "preview" | "published";

/** `copying → queued → running ⇄ waiting → done → accepted`; the last three are reachable from any state. */
export type AgentRunState = RunState;

/** Which files of the app's bucket a run may be given. */
export type AgentStorageScope = "declared" | "none";

/** One tool an agent may call back into the app, as the deploy registers it. */
export type AgentToolManifest = {
  name: string;
  description: string;
  /** JSON Schema of the tool's arguments, published to the model. */
  inputSchema: Record<string, unknown>;
  /** `safe` calls run again after an interruption; `never` ones are reported as "may have run". */
  replay: "safe" | "never";
};

/** Hosts an agent's browser may open (`example.com`, or `*.example.com` for it and its subdomains), and guarded control labels it may still use. */
export type AgentBrowserAccess = { hosts: string[]; allow?: string[] };

/** One definition as the deploy registers it. */
export type AgentDefinitionManifest = {
  name: string;
  description: string;
  /** The model the definition recommends; the app builder may override it in More. */
  model: string;
  /** One short line on why that model, shown beside the "Recommended" tag. */
  modelReason?: string | null;
  prompt: string;
  budget: { minutes: number; credits: number };
  storage: AgentStorageScope;
  tools: AgentToolManifest[];
  /** JSON Schema (draft-07) of the result the agent must end with; null when the definition declares none. */
  output: Record<string, unknown> | null;
  /** The websites the agent may browse, or null when it has no browser. */
  browser: AgentBrowserAccess | null;
  /** The agent's own knowledge: skill folders beside the definition, as `name → markdown`. */
  skills: Record<string, string>;
};

/** A pending `ask_user` question, held on the run until answered; `schema` is JSON Schema for the answer. */
export type AgentQuestion = {
  questionId: string;
  prompt: string;
  schema: Record<string, unknown>;
  askedAt: number;
};

/** One file the run produced, relative to the run's `out/` folder. */
export type AgentOutputFile = { path: string; size: number; contentType?: string };

export type AgentOutputManifest = { files: AgentOutputFile[]; hash: string };

/** What `GET /agents/runs/:id` answers; the same shape `useAgentRun` reads. */
export type AgentRunStatus = {
  id: string;
  agent: string;
  environment: AgentEnvironment;
  state: AgentRunState;
  startedBy: string;
  /** The model the run used: the app builder's override when set, else the definition's. */
  model: string | null;
  attempt: number;
  queuePosition: number | null;
  costCredits: number;
  costMicroUsd: number;
  elapsedMs: number;
  question: AgentQuestion | null;
  summary: string | null;
  error: string | null;
  /** The validated structured output, once the run is done; null before that and for agents without `output`. */
  result: unknown;
  outputs: AgentOutputManifest | null;
  /** Keys in the app's bucket: the full model conversation and the run's log, once written. */
  transcriptKey: string | null;
  logKey: string | null;
  expiresAt: number | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  acceptedAt: number | null;
  /** When the run's `in/` and `out/` were removed; null while its files are still kept. */
  folderDeletedAt: number | null;
};

/** One frame of the run stream: a down message the app sent, or an up chunk the box emitted. */
export type RunStreamFrame = LogRow;
export type RunStreamPart = UpChunk;
export type RunMessage = DownMessage;

/** The cost of a run as an event reports it. */
export type AgentRunCost = { credits: number; microUsd: number };

/** Events the platform pushes to the app's `api/internal/agent-event` route. */
export type AgentEvent =
  | {
      type: "done";
      runId: string;
      agent: string;
      onBehalfOf: string;
      summary: string | null;
      result: unknown;
      outputs: AgentOutputManifest | null;
      cost: AgentRunCost;
    }
  | { type: "failed"; runId: string; agent: string; onBehalfOf: string; error: string; cost: AgentRunCost }
  | { type: "needs_input"; runId: string; agent: string; onBehalfOf: string; question: AgentQuestion }
  | { type: "expiring"; runId: string; agent: string; onBehalfOf: string; expiresAt: number };

/** What `POST /agents/runs` takes. */
export type StartRunRequest = {
  agent: string;
  onBehalfOf: string;
  /** The first message of the run; its file parts join `files`. */
  message: DownMessage;
  /** Keys in the app's bucket (relative to its `public/<appId>/` prefix) copied into the run's `in/` folder. */
  files?: string[];
  /** Structured parameters the agent reads beside the message. */
  input?: Record<string, unknown>;
  previousRunId?: string;
};
