import { getSession } from "../../auth/server";
import { AgentsError, createAgents } from "../../agents/client";
import type { AgentRunStatus } from "../../types/agents";

/**
 * The run a request may act on: the caller must be signed in and be the app user who
 * started it. Throws the Response to return otherwise, so a route reads like a loader.
 */
export async function loadOwnedRun(request: Request, env: Env, runId: string | undefined): Promise<AgentRunStatus> {
  if (!runId) throw Response.json({ error: "missing run id" }, { status: 400 });
  const session = await getSession(request, env);
  if (!session) throw Response.json({ error: "unauthorized" }, { status: 401 });

  let run: AgentRunStatus;
  try {
    run = await createAgents(env).status(runId);
  } catch (err) {
    if (err instanceof AgentsError) throw Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
  if (run.startedBy !== session.user.id) throw Response.json({ error: "not found" }, { status: 404 });
  return run;
}
