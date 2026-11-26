import type { LoaderFunctionArgs } from "react-router";
import { BACKEND_BASE } from "../../backend";
import { createAgents } from "../../agents/client";
import { loadOwnedRun } from "./owned-run";

/**
 * `GET /api/agents/runs/:runId/frames?after=` — the run's stream parts after a sequence number,
 * for a browser whose WebSocket to the stream cannot open; the same viewer token as the socket.
 */
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const run = await loadOwnedRun(request, env, params.runId);
  const { token } = await createAgents(env).viewerToken(run.id);
  const after = new URL(request.url).searchParams.get("after") ?? "0";
  const upstream = new Request(
    `${BACKEND_BASE}/agents/runs/${run.id}/frames?token=${encodeURIComponent(token)}&after=${encodeURIComponent(after)}`,
  );
  const res = await (env.BACKEND_SERVICE ? env.BACKEND_SERVICE.fetch(upstream) : fetch(upstream));
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
