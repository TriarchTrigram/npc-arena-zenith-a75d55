import type { AgentRunState } from "../types/agents";

export type {
  AgentBrowserAccess,
  AgentDefinitionManifest,
  AgentEnvironment,
  AgentEvent,
  AgentOutputFile,
  AgentOutputManifest,
  AgentQuestion,
  AgentRunCost,
  AgentRunState,
  AgentRunStatus,
  AgentStorageScope,
  AgentToolManifest,
  RunMessage,
  RunStreamFrame,
  RunStreamPart,
  StartRunRequest,
} from "../types/agents";
export type { DownMessage, DownPart, LogRow, UpChunk } from "./wire";
export { MAX_DATA_URL_BYTES, answerMessage, messageText, textMessage } from "./wire";

export const TERMINAL_RUN_STATES: readonly AgentRunState[] = ["done", "accepted", "failed", "stopped", "expired"];

export function isTerminalRunState(state: AgentRunState): boolean {
  return TERMINAL_RUN_STATES.includes(state);
}

export const AGENT_EVENT_PATH = "/api/internal/agent-event";
/** The app route the platform reads and writes the app's bucket through (run folders, inputs, accepted outputs). */
export const AGENT_FILES_PATH = "/api/internal/agent-files";
export const AGENTS_UNAVAILABLE = "Agents are not available for this workspace yet";
export const RESULT_UNAVAILABLE = "the agent could not produce the declared result";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const DEFAULT_BUDGET = { minutes: 30, credits: 50 } as const;
