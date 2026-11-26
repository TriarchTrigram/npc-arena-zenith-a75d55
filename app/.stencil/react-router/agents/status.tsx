import type { LoaderFunctionArgs } from "react-router";
import { loadOwnedRun } from "./owned-run";

/** `GET /api/agents/runs/:runId` — the run as the app user who started it may see it. */
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const run = await loadOwnedRun(request, context.cloudflare.env, params.runId);
  return Response.json({ run });
}
