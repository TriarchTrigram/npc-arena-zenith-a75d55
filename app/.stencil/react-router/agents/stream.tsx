import type { LoaderFunctionArgs } from "react-router";
import { BACKEND_BASE } from "../../backend";
import { createAgents } from "../../agents/client";
import { loadOwnedRun } from "./owned-run";

/**
 * `GET /api/agents/runs/:runId/stream` — the browser's WebSocket to the run. Ownership is
 * checked here; the forwarded upgrade carries a short-lived viewer token the platform trusts.
 */
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return Response.json({ error: "expected a websocket upgrade" }, { status: 426 });
  }
  const run = await loadOwnedRun(request, env, params.runId);
  const { token } = await createAgents(env).viewerToken(run.id);
  const after = new URL(request.url).searchParams.get("after") ?? "0";

  const upstream = new Request(
    `${BACKEND_BASE}/agents/runs/${run.id}/stream?token=${encodeURIComponent(token)}&after=${encodeURIComponent(after)}`,
    { headers: { Upgrade: "websocket", Connection: "Upgrade" } },
  );
  return env.BACKEND_SERVICE ? env.BACKEND_SERVICE.fetch(upstream) : fetch(upstream);
}
