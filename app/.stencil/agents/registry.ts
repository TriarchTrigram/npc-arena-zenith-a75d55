import type { AgentDefinition, AgentTool } from "./define";

/**
 * Every definition under `app/agents/<name>/index.ts`, loaded at build time. Imported
 * only from server code: a definition may reach `.server` modules through its hooks.
 */
const modules = import.meta.glob<{ default?: AgentDefinition }>("../../agents/*/index.ts", { eager: true });

const definitions: AgentDefinition[] = Object.values(modules)
  .map((m) => m.default)
  .filter((d): d is AgentDefinition => !!d && typeof d.name === "string");

export function agentByName(name: string): AgentDefinition | null {
  return definitions.find((d) => d.name === name) ?? null;
}

/** A tool by name across every definition; the run token says which names a run may call. */
export function toolByName(name: string): { agent: string; tool: AgentTool } | null {
  for (const def of definitions) {
    const tool = def.tools.find((t) => t.name === name);
    if (tool) return { agent: def.name, tool };
  }
  return null;
}
