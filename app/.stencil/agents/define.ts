import { z } from "zod";
import type { AuthUser } from "../types/auth";
import type { AgentBrowserAccess, AgentDefinitionManifest, AgentEvent, AgentStorageScope, AgentToolManifest } from "../types/agents";
import { DEFAULT_BUDGET, DEFAULT_MODEL } from "./types";

/** Passed to every tool handler. Scope reads and writes to `member`. */
export interface AgentToolContext {
  env: Env;
  run: { id: string; agent: string; onBehalfOf: string };
  /** The app user the run acts for — the same shape a loader gets from requireAuth. */
  member: AuthUser;
}

export interface AgentTool<S extends z.ZodType = z.ZodType> {
  /** Stable tool id the agent calls, e.g. `"save_summary"`. */
  name: string;
  /** One line telling the model what the tool does and when to reach for it. */
  description: string;
  /** Zod schema for the arguments; also published to the model as JSON Schema. */
  input: S;
  /** `safe` calls run again after an interruption; `never` (the default) ones are reported as "may have run". */
  replay?: "safe" | "never";
  // Method (not arrow) so a heterogeneous `tools` array keeps each handler's
  // args inferred from its own schema instead of collapsing to `unknown`.
  handler(args: z.infer<S>, ctx: AgentToolContext): unknown | Promise<unknown>;
}

type EventOf<T extends AgentEvent["type"]> = Extract<AgentEvent, { type: T }>;
export type AgentHook<T extends AgentEvent["type"]> = (event: EventOf<T>, env: Env) => Promise<void> | void;

type OutputSchema = z.ZodType | undefined;
/** The `done` event with `result` typed from the definition's `output`; null when it declares none. */
export type AgentDoneEvent<O extends OutputSchema> = Omit<EventOf<"done">, "result"> & {
  result: O extends z.ZodType ? z.infer<O> : null;
};

export interface AgentDefinitionInput<O extends OutputSchema = OutputSchema> {
  /** Folder name under `app/agents/`; the id a trigger route passes to `run()`. */
  name: string;
  description: string;
  /** The recommended model; the app builder can pick another in More → Agents. */
  model?: string;
  /** One short line on why that model is the recommendation. */
  modelReason?: string;
  /** The system prompt: who the agent is, what `/work/in` holds, what to leave in `/work/out`. */
  prompt: string;
  budget?: { minutes?: number; credits?: number };
  storage?: AgentStorageScope;
  tools?: AgentTool[];
  /** Zod schema of the result the agent must end with; it reaches `onDone` validated and typed. */
  output?: O;
  /**
   * Give the agent a real browser for these hosts only (`"bookings.example.com"`, or
   * `"*.example.com"` for a site and its subdomains). It gets a `browse` tool that drives the
   * browser from a plan of plain steps; it can never pay, delete, send, sign up or publish there
   * unless `allow` names that control's label.
   */
  browser?: AgentBrowserAccess;
  onDone?: (event: AgentDoneEvent<O>, env: Env) => Promise<void> | void;
  onFailed?: AgentHook<"failed">;
  onNeedsInput?: AgentHook<"needs_input">;
  onExpiring?: AgentHook<"expiring">;
}

export interface AgentDefinition<O extends OutputSchema = OutputSchema> extends AgentDefinitionInput<O> {
  model: string;
  budget: { minutes: number; credits: number };
  storage: AgentStorageScope;
  tools: AgentTool[];
}

/** Declare a tool with its handler args inferred from `input`. */
export function tool<S extends z.ZodType>(t: AgentTool<S>): AgentTool<S> {
  return t;
}

/** Declare an agent; the result is the default export of `app/agents/<name>/index.ts`. */
export function defineAgent<O extends OutputSchema = undefined>(def: AgentDefinitionInput<O>): AgentDefinition<O> {
  return {
    ...def,
    model: def.model ?? DEFAULT_MODEL,
    budget: {
      minutes: def.budget?.minutes ?? DEFAULT_BUDGET.minutes,
      credits: def.budget?.credits ?? DEFAULT_BUDGET.credits,
    },
    storage: def.storage ?? "declared",
    tools: def.tools ?? [],
  };
}

export function toolManifest(t: AgentTool): AgentToolManifest {
  return {
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input) as Record<string, unknown>,
    replay: t.replay ?? "never",
  };
}

function browserAccess(browser: AgentBrowserAccess | undefined): AgentBrowserAccess | null {
  if (!browser) return null;
  const hosts = (browser.hosts ?? []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (hosts.length === 0) throw new Error("browser.hosts must name at least one host");
  const allow = (browser.allow ?? []).map((a) => String(a).trim()).filter(Boolean);
  return { hosts, ...(allow.length ? { allow } : {}) };
}

/** The registrable form of a definition; `skills` is read from disk by the deploy. */
export function agentManifest(def: AgentDefinition): Omit<AgentDefinitionManifest, "skills"> {
  return {
    name: def.name,
    description: def.description,
    model: def.model,
    modelReason: def.modelReason ?? null,
    prompt: def.prompt,
    budget: def.budget,
    storage: def.storage,
    tools: def.tools.map(toolManifest),
    output: def.output ? (z.toJSONSchema(def.output, { target: "draft-7" }) as Record<string, unknown>) : null,
    browser: browserAccess(def.browser),
  };
}
