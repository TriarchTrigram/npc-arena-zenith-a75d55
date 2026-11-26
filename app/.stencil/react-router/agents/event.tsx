import type { ActionFunctionArgs } from "react-router";
import { verifyPlatformBearer } from "../../internal";
import type { AgentEvent } from "../../types/agents";

const EVENT_TYPES: ReadonlySet<string> = new Set(["done", "failed", "needs_input", "expiring"]);

function parseEvent(body: unknown): AgentEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string" || !EVENT_TYPES.has(b.type)) return null;
  if (typeof b.runId !== "string" || typeof b.agent !== "string" || typeof b.onBehalfOf !== "string") return null;
  return b as AgentEvent;
}

/**
 * `POST /api/internal/agent-event` — the platform tells the app a run finished, failed,
 * needs an answer or is about to expire; the definition's hook runs in the background.
 * A hook that throws answers 500 so the platform retries.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const { env, ctx } = context.cloudflare;
  const unauthorized = verifyPlatformBearer(request, env);
  if (unauthorized) return unauthorized;

  const event = parseEvent(await request.json().catch(() => null));
  if (!event) return Response.json({ error: "invalid agent event" }, { status: 400 });

  // Imported here, not at module scope, so the definitions stay out of the client bundle.
  const { agentByName } = await import("../../agents/registry");
  const definition = agentByName(event.agent);
  if (!definition) return Response.json({ error: `no agent named "${event.agent}"` }, { status: 404 });

  let work: Promise<void> | void;
  try {
    switch (event.type) {
      case "done":
        work = definition.onDone?.(event, env);
        break;
      case "failed":
        work = definition.onFailed?.(event, env);
        break;
      case "needs_input":
        work = definition.onNeedsInput?.(event, env);
        break;
      case "expiring":
        work = definition.onExpiring?.(event, env);
        break;
    }
  } catch (err) {
    console.error(`[agents] ${event.type} hook of ${event.agent} failed for run ${event.runId}:`, err);
    return Response.json({ ok: false, error: "hook failed" }, { status: 500 });
  }

  if (work) {
    ctx.waitUntil(
      work.catch((err) =>
        console.error(`[agents] ${event.type} hook of ${event.agent} failed for run ${event.runId}:`, err),
      ),
    );
  }
  return Response.json({ ok: true });
}
