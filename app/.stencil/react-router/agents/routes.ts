import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/**
 * The Stencil agents route pack. Spread it into `app/routes.ts` with a RELATIVE import
 * (`./.stencil/react-router/agents/routes`): the config loader runs before aliases resolve.
 */
export const stencilAgentRoutes: RouteConfigEntry[] = [
  route("api/agents/runs/:runId", ".stencil/react-router/agents/status.tsx"),
  route("api/agents/runs/:runId/stream", ".stencil/react-router/agents/stream.tsx"),
  route("api/agents/runs/:runId/frames", ".stencil/react-router/agents/frames.tsx"),
  // `:command` is `messages` (a note, a file or an answer) or `stop`.
  route("api/agents/runs/:runId/:command", ".stencil/react-router/agents/command.tsx"),
  route("api/internal/agent-event", ".stencil/react-router/agents/event.tsx"),
  route("api/internal/agent-files", ".stencil/react-router/agents/files.tsx"),
  route("mcp/agent-run", ".stencil/react-router/agents/mcp-door.tsx"),
];
